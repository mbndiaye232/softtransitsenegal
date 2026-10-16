const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/domaines-activite
 * List all activity domains
 */
router.get('/', checkPermission('CONFIG', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM domaineactivite ORDER BY LibelleDomaineActivite'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching activity domains:', error);
        res.status(500).json({ error: 'Failed to fetch activity domains' });
    }
});

/**
 * POST /api/domaines-activite
 * Create a new activity domain
 */
router.post('/', checkPermission('CONFIG', 'can_create'), async (req, res) => {
    try {
        const { LibelleDomaineActivite, Code } = req.body;
        if (!LibelleDomaineActivite) {
            return res.status(400).json({ error: 'Le libellé est obligatoire' });
        }

        const [result] = await pool.query(
            'INSERT INTO domaineactivite (LibelleDomaineActivite, Code) VALUES (?, ?)',
            [LibelleDomaineActivite, Code || null]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'DOMAINE_ACTIVITE',
            resource_id: result.insertId,
            details: { LibelleDomaineActivite, Code },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({ id: result.insertId, message: 'Domaine d\'activité créé avec succès' });
    } catch (error) {
        console.error('Error creating activity domain:', error);
        res.status(500).json({ error: 'Failed to create activity domain' });
    }
});

/**
 * PUT /api/domaines-activite/:id
 * Update an activity domain
 */
router.put('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { LibelleDomaineActivite, Code } = req.body;

        if (!LibelleDomaineActivite) {
            return res.status(400).json({ error: 'Le libellé est obligatoire' });
        }

        await pool.query(
            'UPDATE domaineactivite SET LibelleDomaineActivite = ?, Code = ? WHERE IDDomaineActivite = ?',
            [LibelleDomaineActivite, Code || null, id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'DOMAINE_ACTIVITE',
            resource_id: id,
            details: { LibelleDomaineActivite, Code },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Domaine d\'activité mis à jour avec succès' });
    } catch (error) {
        console.error('Error updating activity domain:', error);
        res.status(500).json({ error: 'Failed to update activity domain' });
    }
});

/**
 * DELETE /api/domaines-activite/:id
 * Delete an activity domain
 */
router.delete('/:id', checkPermission('CONFIG', 'can_delete'), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM domaineactivite WHERE IDDomaineActivite = ?', [id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'DOMAINE_ACTIVITE',
            resource_id: id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Domaine d\'activité supprimé avec succès' });
    } catch (error) {
        console.error('Error deleting activity domain:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'Ce domaine est utilisé par des tiers existants.' });
        }
        res.status(500).json({ error: 'Failed to delete activity domain' });
    }
});

module.exports = router;
