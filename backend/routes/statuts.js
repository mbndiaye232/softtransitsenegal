const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/statuts
 * List all statuses
 */
router.get('/', checkPermission('STATUTS', 'can_view'), async (req, res) => {
    try {
        const [statuts] = await pool.query('SELECT * FROM statuts ORDER BY libelle ASC');
        res.json(statuts);
    } catch (error) {
        console.error('Error fetching statuts:', error);
        res.status(500).json({ error: 'Failed to fetch statuts' });
    }
});

/**
 * POST /api/statuts
 * Create a new status
 */
router.post('/', checkPermission('STATUTS', 'can_create'), async (req, res) => {
    try {
        const { libelle } = req.body;
        if (!libelle) {
            return res.status(400).json({ error: 'Libelle is required' });
        }

        const [result] = await pool.query('INSERT INTO statuts (libelle) VALUES (?)', [libelle]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'STATUT',
            resource_id: result.insertId,
            details: { libelle },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({ id: result.insertId, libelle });
    } catch (error) {
        console.error('Error creating statut:', error);
        res.status(500).json({ error: 'Failed to create statut' });
    }
});

/**
 * PUT /api/statuts/:id
 * Update a status
 */
router.put('/:id', checkPermission('STATUTS', 'can_edit'), async (req, res) => {
    try {
        const { libelle } = req.body;
        if (!libelle) {
            return res.status(400).json({ error: 'Libelle is required' });
        }

        await pool.query('UPDATE statuts SET libelle = ? WHERE IDStatuts = ?', [libelle, req.params.id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'STATUT',
            resource_id: req.params.id,
            details: { libelle },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Statut updated successfully' });
    } catch (error) {
        console.error('Error updating statut:', error);
        res.status(500).json({ error: 'Failed to update statut' });
    }
});

/**
 * DELETE /api/statuts/:id
 * Delete a status
 */
router.delete('/:id', checkPermission('STATUTS', 'can_delete'), async (req, res) => {
    try {
        await pool.query('DELETE FROM statuts WHERE IDStatuts = ?', [req.params.id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'STATUT',
            resource_id: req.params.id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Statut deleted successfully' });
    } catch (error) {
        console.error('Error deleting statut:', error);
        res.status(500).json({ error: 'Failed to delete statut' });
    }
});

module.exports = router;
