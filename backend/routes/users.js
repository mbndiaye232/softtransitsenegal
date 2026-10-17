const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, requireRole, requireSuperAdmin, checkPermission } = require('../middleware/auth');
const { hashPassword, validateEmail, validatePassword } = require('../utils/auth');
const auditService = require('../services/auditService');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

const ROLES_VALIDES = ['USER', 'ADMIN', 'SUPER_ADMIN'];

// Message d'erreur si req.user n'a pas le droit d'attribuer newRole ou de toucher un compte de rôle targetRole.
// SUPER_ADMIN n'est attribué que par PUT /:id/super-admin ; ADMIN seulement par un ADMIN ou un SUPER_ADMIN.
function roleViolation(req, newRole, targetRole) {
    if (req.user.role === 'SUPER_ADMIN') return null;
    if (newRole === 'SUPER_ADMIN' || targetRole === 'SUPER_ADMIN') {
        return 'Opération réservée au super administrateur';
    }
    if (req.user.role !== 'ADMIN' && (newRole === 'ADMIN' || targetRole === 'ADMIN')) {
        return 'Seul un administrateur peut attribuer ou modifier le rôle Administrateur';
    }
    return null;
}

/**
 * GET /api/users/me/permissions
 * Retourne les permissions de l'utilisateur connecté (pour le menu frontend)
 */
router.get('/me/permissions', async (req, res) => {
    try {
        // SUPER_ADMIN et ADMIN ont accès à tout
        if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
            const [all] = await pool.query('SELECT code FROM permissions');
            const fullAccess = all.map(p => ({
                code: p.code, can_view: 1, can_create: 1, can_edit: 1, can_delete: 1
            }));
            return res.json({ role: req.user.role, fullAccess: true, permissions: fullAccess });
        }
        // Autres agents : on retourne leurs permissions réelles
        const [rows] = await pool.query(
            `SELECT p.code, ap.can_view, ap.can_create, ap.can_edit, ap.can_delete
             FROM permissions p
             LEFT JOIN agent_permissions ap ON ap.permission_id = p.id AND ap.agent_id = ?
             ORDER BY p.name`,
            [req.user.id]
        );
        res.json({ role: req.user.role, fullAccess: false, permissions: rows });
    } catch (error) {
        console.error('Get my permissions error:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

/**
 * GET /api/users/permissions/list
 * List all available functional permissions
 */
router.get('/permissions/list', checkPermission('AGENTS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM permissions ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('Get permissions list error:', error);
        res.status(500).json({ error: 'Failed to fetch permissions list' });
    }
});

/**
 * GET /api/users/:id/permissions
 * Get specific agent permissions
 */
router.get('/:id/permissions', checkPermission('AGENTS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.code, p.name, ap.* 
             FROM permissions p
             LEFT JOIN agent_permissions ap ON p.id = ap.permission_id AND ap.agent_id = ?
             ORDER BY p.name`,
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Get agent permissions error:', error);
        res.status(500).json({ error: 'Failed to fetch agent permissions' });
    }
});

/**
 * PUT /api/users/:id/permissions
 * Update specific agent permissions
 */
router.put('/:id/permissions', checkPermission('AGENTS', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { permissions } = req.body; // Array of { permission_id, can_view, can_create, can_edit, can_delete }

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'Permissions must be an array' });
        }

        let targetQuery = 'SELECT IDAgents, role FROM agents WHERE IDAgents = ?';
        const targetParams = [req.params.id];
        if (!req.user.is_provider) {
            targetQuery += ' AND structur_id = ?';
            targetParams.push(req.structur_id);
        }
        const [targets] = await connection.query(targetQuery, targetParams);
        if (targets.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        const violation = roleViolation(req, null, targets[0].role);
        if (violation) {
            return res.status(403).json({ error: violation });
        }
        if (String(req.params.id) === String(req.user.id) && req.user.role === 'USER') {
            return res.status(403).json({ error: 'Vous ne pouvez pas modifier vos propres permissions' });
        }

        await connection.beginTransaction();

        for (const perm of permissions) {
            await connection.query(
                `INSERT INTO agent_permissions (agent_id, permission_id, can_view, can_create, can_edit, can_delete)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT (agent_id, permission_id) DO UPDATE SET
                    can_view = EXCLUDED.can_view,
                    can_create = EXCLUDED.can_create,
                    can_edit = EXCLUDED.can_edit,
                    can_delete = EXCLUDED.can_delete`,
                [req.params.id, perm.permission_id, perm.can_view || 0, perm.can_create || 0, perm.can_edit || 0, perm.can_delete || 0]
            );
        }

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'AGENT_PERMISSIONS',
            resource_id: req.params.id,
            details: permissions,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        await connection.commit();
        res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Update agent permissions error:', error);
        res.status(500).json({ error: 'Failed to update agent permissions' });
    } finally {
        connection.release();
    }
});

/**
 * GET /api/users/declarants
 * Return active agents who are in a "declarant" group OR have "Declarant" function
 * Used by CotationManager to populate the assignee dropdown
 */
router.get('/declarants', async (req, res) => {
    try {
        // Strategy: return agents matching ANY of these criteria (accent-safe)
        // 1. Group name contains "clarant" (matches Déclarant/declarant regardless of D/d/é/e)
        // 2. FonctionAgent contains "clarant"
        // 3. Fallback: return ALL active agents so dropdown is never empty
        const [rows] = await pool.query(
            `SELECT a.IDAgents as id, a.NomAgent as name, g.LibelleGroupe as group_name
             FROM agents a
             LEFT JOIN groupes g ON a.IDGroupes = g.IDGroupes
             WHERE a.structur_id = ?
               AND a.is_active = 1
               AND (
                   g.LibelleGroupe LIKE '%clarant%'
                   OR a.FonctionAgent LIKE '%clarant%'
               )
             ORDER BY a.NomAgent`,
            [req.structur_id]
        );

        // If no declarants found (misconfigured groups), return all active agents
        if (rows.length === 0) {
            const [all] = await pool.query(
                `SELECT a.IDAgents as id, a.NomAgent as name, g.LibelleGroupe as group_name
                 FROM agents a
                 LEFT JOIN groupes g ON a.IDGroupes = g.IDGroupes
                 WHERE a.structur_id = ? AND a.is_active = 1
                 ORDER BY a.NomAgent`,
                [req.structur_id]
            );
            return res.json(all);
        }

        res.json(rows);
    } catch (err) {
        console.error('Get declarants error:', err);
        res.status(500).json({ error: 'Failed to fetch declarants' });
    }
});

/**
 * GET /api/users
 * List all users for the current company (or all for provider)
 */
router.get('/', checkPermission('AGENTS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT 
                a.IDAgents as id,
                a.NomAgent as name,
                a.Email as email,
                a.Login as login,
                a.role,
                a.FonctionAgent as "function",
                a.Tel as phone,
                a.is_active,
                a.IDGroupes,
                g.LibelleGroupe as group_name,
                a.last_login,
                s.NomSociete as company_name
            FROM agents a
            LEFT JOIN groupes g ON a.IDGroupes = g.IDGroupes
            JOIN structur s ON a.structur_id = s.IDSociete
        `;
        let params = [];

        if (!req.is_viewing_all) {
            query += ' WHERE a.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' ORDER BY s.NomSociete, a.NomAgent';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * GET /api/users/:id
 * Get a specific user
 */
router.get('/:id', checkPermission('AGENTS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT 
                a.IDAgents as id,
                a.NomAgent as name,
                a.Email as email,
                a.Login as login,
                a.role,
                a.FonctionAgent as "function",
                a.Tel as phone,
                a.Cel as mobile,
                a.adresse as address,
                a.is_active,
                a.IDGroupes,
                a.recevoir_alerte_suspension,
                g.LibelleGroupe as group_name
            FROM agents a
            LEFT JOIN groupes g ON a.IDGroupes = g.IDGroupes
            WHERE a.IDAgents = ?
        `;
        let params = [req.params.id];

        if (!req.user.is_provider) {
            query += ' AND a.structur_id = ?';
            params.push(req.structur_id);
        }

        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', checkPermission('AGENTS', 'can_create'), async (req, res) => {
    try {
        const {
            NomAgent,
            Email,
            Login,
            password,
            role,
            FonctionAgent,
            Tel,
            Cel,
            adresse,
            IDGroupes,
            target_structur_id // Provider can specify company
        } = req.body;

        const structur_id = (req.user.is_provider && target_structur_id) ? target_structur_id : req.structur_id;

        // Validation
        if (!NomAgent || !Email || !Login || !password) {
            return res.status(400).json({ error: 'Nom, email, login et mot de passe sont requis' });
        }

        if (!validateEmail(Email)) {
            return res.status(400).json({ error: 'Format d\'email invalide' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        const newRole = role || 'USER';
        if (!ROLES_VALIDES.includes(newRole)) {
            return res.status(400).json({ error: 'Rôle invalide' });
        }
        const violation = roleViolation(req, newRole, null);
        if (violation) {
            return res.status(403).json({ error: violation });
        }

        // Check if login or email already exists
        const [existing] = await pool.query(
            'SELECT IDAgents FROM agents WHERE (Login = ? OR Email = ?) AND structur_id = ?',
            [Login, Email, structur_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Ce login ou cet email existe déjà' });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const [result] = await pool.query(
            `INSERT INTO agents (
                structur_id, IDGroupes, NomAgent, Email, Login, password_hash,
                role, FonctionAgent, Tel, Cel, adresse, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                structur_id,
                IDGroupes || null,
                NomAgent,
                Email,
                Login,
                passwordHash,
                newRole,
                FonctionAgent || null,
                Tel || null,
                Cel || null,
                adresse || null
            ]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'AGENT',
            resource_id: result.insertId,
            details: { name: NomAgent, email: Email, login: Login, group: IDGroupes },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({
            id: result.insertId,
            message: 'User created successfully'
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * PUT /api/users/:id
 * Update a user
 */
router.put('/:id', checkPermission('AGENTS', 'can_edit'), async (req, res) => {
    try {
        const {
            NomAgent,
            Email,
            Login,
            password,
            role,
            FonctionAgent,
            Tel,
            Cel,
            adresse,
            IDGroupes,
            recevoir_alerte_suspension
        } = req.body;

        // Check if user exists and belongs to company (unless provider)
        let query = 'SELECT IDAgents, role FROM agents WHERE IDAgents = ?';
        let params = [req.params.id];
        if (!req.user.is_provider) {
            query += ' AND structur_id = ?';
            params.push(req.structur_id);
        }

        const [existing] = await pool.query(query, params);

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const newRole = role || existing[0].role;
        if (!ROLES_VALIDES.includes(newRole)) {
            return res.status(400).json({ error: 'Rôle invalide' });
        }
        if (String(req.params.id) === String(req.user.id) && newRole !== req.user.role) {
            return res.status(403).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' });
        }
        const violation = roleViolation(req, newRole, existing[0].role);
        if (violation) {
            return res.status(403).json({ error: violation });
        }

        // Validation
        if (!NomAgent || !Email || !Login) {
            return res.status(400).json({ error: 'Name, email, and login are required' });
        }

        if (!validateEmail(Email)) {
            return res.status(400).json({ error: 'Format d\'email invalide' });
        }

        // Check if login or email conflicts
        let conflictQuery = 'SELECT IDAgents FROM agents WHERE (Login = ? OR Email = ?) AND IDAgents != ?';
        let conflictParams = [Login, Email, req.params.id];
        if (!req.user.is_provider) {
            conflictQuery += ' AND structur_id = ?';
            conflictParams.push(req.structur_id);
        }

        const [conflict] = await pool.query(conflictQuery, conflictParams);

        if (conflict.length > 0) {
            return res.status(400).json({ error: 'Ce login ou cet email existe déjà' });
        }

        // Build update query
        let updateFields = [
            'NomAgent = ?',
            'Email = ?',
            'Login = ?',
            'role = ?',
            'FonctionAgent = ?',
            'Tel = ?',
            'Cel = ?',
            'adresse = ?',
            'IDGroupes = ?',
            'recevoir_alerte_suspension = ?'
        ];
        let updateValues = [
            NomAgent,
            Email,
            Login,
            newRole,
            FonctionAgent || null,
            Tel || null,
            Cel || null,
            adresse || null,
            IDGroupes || null,
            recevoir_alerte_suspension ? 1 : 0
        ];

        if (password) {
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                return res.status(400).json({ error: passwordValidation.message });
            }
            const passwordHash = await hashPassword(password);
            updateFields.push('password_hash = ?');
            updateValues.push(passwordHash);
        }

        updateValues.push(req.params.id);

        await pool.query(
            `UPDATE agents SET ${updateFields.join(', ')} WHERE IDAgents = ?`,
            updateValues
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'AGENT',
            resource_id: req.params.id,
            details: { name: NomAgent, email: Email, login: Login },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'User updated successfully' });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * DELETE /api/users/:id
 * Deactivate a user (soft delete)
 */
router.delete('/:id', checkPermission('AGENTS', 'can_delete'), async (req, res) => {
    try {
        let query = 'SELECT IDAgents, role FROM agents WHERE IDAgents = ?';
        let params = [req.params.id];
        if (!req.user.is_provider) {
            query += ' AND structur_id = ?';
            params.push(req.structur_id);
        }

        const [existing] = await pool.query(query, params);

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const violation = roleViolation(req, null, existing[0].role);
        if (violation) {
            return res.status(403).json({ error: violation });
        }

        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }

        await pool.query('UPDATE agents SET is_active = 0 WHERE IDAgents = ?', [req.params.id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'AGENT',
            resource_id: req.params.id,
            details: 'Account deactivated',
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

/**
 * PATCH /api/users/:id/reactivate
 */
router.patch('/:id/reactivate', checkPermission('AGENTS', 'can_edit'), async (req, res) => {
    try {
        let query = 'SELECT IDAgents, is_active, role FROM agents WHERE IDAgents = ?';
        let params = [req.params.id];
        if (!req.user.is_provider) {
            query += ' AND structur_id = ?';
            params.push(req.structur_id);
        }

        const [existing] = await pool.query(query, params);

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const violation = roleViolation(req, null, existing[0].role);
        if (violation) {
            return res.status(403).json({ error: violation });
        }

        if (existing[0].is_active === 1) {
            return res.status(400).json({ error: 'User is already active' });
        }

        await pool.query('UPDATE agents SET is_active = 1 WHERE IDAgents = ?', [req.params.id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'AGENT',
            resource_id: req.params.id,
            details: 'Account reactivated',
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'User reactivated successfully' });
    } catch (error) {
        console.error('Reactivate user error:', error);
        res.status(500).json({ error: 'Failed to reactivate user' });
    }
});

/**
 * PUT /api/users/:id/super-admin
 * Accorder ou révoquer le rôle SUPER_ADMIN (réservé aux SUPER_ADMIN)
 */
router.put('/:id/super-admin', requireSuperAdmin, async (req, res) => {
    const { grant } = req.body; // true = accorder, false = révoquer
    const targetId = req.params.id;

    // Empêcher de se révoquer soi-même
    if (String(targetId) === String(req.user.id) && !grant) {
        return res.status(400).json({ error: 'Vous ne pouvez pas vous révoquer vous-même' });
    }

    try {
        const [[target]] = await pool.query(
            'SELECT IDAgents, NomAgent, role FROM agents WHERE IDAgents = ?',
            [targetId]
        );
        if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' });

        if (grant && target.role !== 'ADMIN' && target.role !== 'SUPER_ADMIN') {
            return res.status(400).json({ error: 'Seul un ADMIN peut être promu SUPER_ADMIN' });
        }

        const newRole = grant ? 'SUPER_ADMIN' : 'ADMIN';
        await pool.query('UPDATE agents SET role = ? WHERE IDAgents = ?', [newRole, targetId]);

        // Mettre is_provider sur la société si promotion
        if (grant) {
            await pool.query(
                'UPDATE structur SET is_provider = 1 WHERE IDSociete = (SELECT structur_id FROM agents WHERE IDAgents = ?)',
                [targetId]
            );
        }

        res.json({
            message: grant
                ? `${target.NomAgent} est maintenant SUPER_ADMIN`
                : `${target.NomAgent} est repassé ADMIN`,
            new_role: newRole
        });
    } catch (err) {
        console.error('Super admin toggle error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
