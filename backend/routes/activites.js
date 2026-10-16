const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/activites
 * List all activities for the current tenant
 */
router.get('/', checkPermission('CONFIG', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM activites WHERE structur_id = ? ORDER BY libelle',
            [req.structur_id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Get activities error:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

/**
 * POST /api/activites
 * Create a new activity
 */
router.post('/', checkPermission('CONFIG', 'can_create'), async (req, res) => {
    try {
        const { libelle, code } = req.body;
        if (!libelle) {
            return res.status(400).json({ error: 'Le libellé est obligatoire' });
        }

        const [result] = await pool.query(
            'INSERT INTO activites (libelle, code, structur_id) VALUES (?, ?, ?)',
            [libelle, code || null, req.structur_id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'ACTIVITE',
            resource_id: result.insertId,
            details: { libelle, code },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({ id: result.insertId, message: 'Domaine d\'activité créé avec succès' });
    } catch (error) {
        console.error('Create activity error:', error);
        res.status(500).json({ error: 'Failed to create activity' });
    }
});

/**
 * PUT /api/activites/:id
 * Update an activity
 */
router.put('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { libelle, code } = req.body;

        if (!libelle) {
            return res.status(400).json({ error: 'Le libellé est obligatoire' });
        }

        await pool.query(
            'UPDATE activites SET libelle = ?, code = ? WHERE id_activite = ? AND structur_id = ?',
            [libelle, code || null, id, req.structur_id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'ACTIVITE',
            resource_id: id,
            details: { libelle, code },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Domaine d\'activité mis à jour avec succès' });
    } catch (error) {
        console.error('Update activity error:', error);
        res.status(500).json({ error: 'Failed to update activity' });
    }
});

/**
 * DELETE /api/activites/:id
 * Delete an activity
 */
router.delete('/:id', checkPermission('CONFIG', 'can_delete'), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(
            'DELETE FROM activites WHERE id_activite = ? AND structur_id = ?',
            [id, req.structur_id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'ACTIVITE',
            resource_id: id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Domaine d\'activité supprimé avec succès' });
    } catch (error) {
        console.error('Delete activity error:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'Ce domaine est utilisé par des tiers existants.' });
        }
        res.status(500).json({ error: 'Failed to delete activity' });
    }
});

module.exports = router;
