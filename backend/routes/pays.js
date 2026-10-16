const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/pays
 * List all countries
 */
router.get('/', checkPermission('CONFIG', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM pays ORDER BY NomPays ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});

/**
 * POST /api/pays
 * Create a new country
 */
router.post('/', checkPermission('CONFIG', 'can_create'), async (req, res) => {
    try {
        const { NomPays, codePays3, CodePays2, CodeNumerique, NomPaysEng } = req.body;
        if (!NomPays) return res.status(400).json({ error: 'Le nom du pays est obligatoire' });

        const [result] = await pool.query(
            'INSERT INTO pays (NomPays, codePays3, CodePays2, CodeNumerique, NomPaysEng) VALUES (?, ?, ?, ?, ?)',
            [NomPays, codePays3, CodePays2, CodeNumerique, NomPaysEng]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'PAYS',
            resource_id: result.insertId,
            details: { NomPays, CodePays2 },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({ id: result.insertId, message: 'Pays créé avec succès' });
    } catch (error) {
        console.error('Error creating country:', error);
        res.status(500).json({ error: 'Failed to create country' });
    }
});

/**
 * PUT /api/pays/:id
 * Update a country
 */
router.put('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { NomPays, codePays3, CodePays2, CodeNumerique, NomPaysEng } = req.body;
        
        await pool.query(
            'UPDATE pays SET NomPays = ?, codePays3 = ?, CodePays2 = ?, CodeNumerique = ?, NomPaysEng = ? WHERE IDPays = ?',
            [NomPays, codePays3, CodePays2, CodeNumerique, NomPaysEng, id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'PAYS',
            resource_id: id,
            details: { NomPays },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Pays mis à jour avec succès' });
    } catch (error) {
        console.error('Error updating country:', error);
        res.status(500).json({ error: 'Failed to update country' });
    }
});

/**
 * DELETE /api/pays/:id
 * Delete a country
 */
router.delete('/:id', checkPermission('CONFIG', 'can_delete'), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM pays WHERE IDPays = ?', [id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'PAYS',
            resource_id: id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Pays supprimé avec succès' });
    } catch (error) {
        console.error('Error deleting country:', error);
        res.status(500).json({ error: 'Impossible de supprimer ce pays. Il est probablement lié à d’autres enregistrements (clients, tiers, etc.).' });
    }
});

module.exports = router;
