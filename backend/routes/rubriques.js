const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply auth middleware to all routes except GET if we want it public, 
// but usually in this app everything is protected.
router.use(authMiddleware);

/**
 * GET /api/rubriques
 * List all rubriques (excluding 18xx internal ones)
 */
router.get('/', checkPermission('STATUTS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM rubriques WHERE CodeRubrique NOT LIKE '18%' ORDER BY CodeRubrique ASC"
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching rubriques:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/rubriques
 * Create a new rubric
 */
router.post('/', checkPermission('RUBRIQUES', 'can_create'), async (req, res) => {
    try {
        const { CodeRubrique, libelleRubrique, AFacturer, NumeroCompte, Observations } = req.body;
        
        if (!CodeRubrique || !libelleRubrique) {
            return res.status(400).json({ error: 'Le code et le libellé sont obligatoires' });
        }

        const [result] = await pool.query(
            'INSERT INTO rubriques (CodeRubrique, libelleRubrique, AFacturer, NumeroCompte, Observations) VALUES (?, ?, ?, ?, ?)',
            [CodeRubrique, libelleRubrique, AFacturer || 0, NumeroCompte || null, Observations || null]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'RUBRIQUE',
            resource_id: result.insertId,
            details: { CodeRubrique, libelleRubrique },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({ 
            IDRubriques: result.insertId, 
            message: 'Rubrique créée avec succès' 
        });
    } catch (error) {
        console.error('Error creating rubric:', error);
        res.status(500).json({ error: 'Failed to create rubric' });
    }
});

/**
 * PUT /api/rubriques/:id
 * Update an existing rubric
 */
router.put('/:id', checkPermission('RUBRIQUES', 'can_edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { CodeRubrique, libelleRubrique, AFacturer, NumeroCompte, Observations } = req.body;

        if (!CodeRubrique || !libelleRubrique) {
            return res.status(400).json({ error: 'Le code et le libellé sont obligatoires' });
        }

        await pool.query(
            'UPDATE rubriques SET CodeRubrique = ?, libelleRubrique = ?, AFacturer = ?, NumeroCompte = ?, Observations = ? WHERE IDRubriques = ?',
            [CodeRubrique, libelleRubrique, AFacturer || 0, NumeroCompte || null, Observations || null, id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'RUBRIQUE',
            resource_id: id,
            details: { CodeRubrique, libelleRubrique },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Rubrique mise à jour avec succès' });
    } catch (error) {
        console.error('Error updating rubric:', error);
        res.status(500).json({ error: 'Failed to update rubric' });
    }
});

/**
 * DELETE /api/rubriques/:id
 * Delete a rubric
 */
router.delete('/:id', checkPermission('RUBRIQUES', 'can_delete'), async (req, res) => {
    try {
        const { id } = req.params;

        // Optional: check if rubric is used in factures or cotations before delete
        // For now, simple delete as per request
        await pool.query('DELETE FROM rubriques WHERE IDRubriques = ?', [id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'RUBRIQUE',
            resource_id: id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Rubrique supprimée avec succès' });
    } catch (error) {
        console.error('Error deleting rubric:', error);
        res.status(500).json({ error: 'Failed to delete rubric. Elle est probablement utilisée dans des documents.' });
    }
});

module.exports = router;
