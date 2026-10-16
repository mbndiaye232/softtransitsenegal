const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/etapes-dossiers
 * List all dossier stages
 */
router.get('/', checkPermission('STATUTS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT IDEtapesDossiers, libelleEtapesDossiers, Observations FROM etapesdossiers ORDER BY IDEtapesDossiers ASC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching dossier stages:', error);
        res.status(500).json({ error: 'Failed to fetch dossier stages' });
    }
});

/**
 * POST /api/etapes-dossiers
 * Create a new dossier stage
 */
router.post('/', checkPermission('STATUTS', 'can_create'), async (req, res) => {
    try {
        const { libelleEtapesDossiers, Observations } = req.body;
        
        if (!libelleEtapesDossiers) {
            return res.status(400).json({ error: 'Le libellé est obligatoire' });
        }

        const [result] = await pool.query(
            'INSERT INTO etapesdossiers (libelleEtapesDossiers, Observations) VALUES (?, ?)',
            [libelleEtapesDossiers, Observations || null]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'ETAPE_DOSSIER',
            resource_id: result.insertId,
            details: { libelleEtapesDossiers, Observations },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({ 
            IDEtapesDossiers: result.insertId, 
            libelleEtapesDossiers, 
            Observations,
            message: 'Étape créée avec succès' 
        });
    } catch (error) {
        console.error('Error creating dossier stage:', error);
        res.status(500).json({ error: 'Failed to create dossier stage' });
    }
});

/**
 * PUT /api/etapes-dossiers/:id
 * Update a dossier stage
 */
router.put('/:id', checkPermission('STATUTS', 'can_edit'), async (req, res) => {
    try {
        const { libelleEtapesDossiers, Observations } = req.body;
        const { id } = req.params;

        if (!libelleEtapesDossiers) {
            return res.status(400).json({ error: 'Le libellé est obligatoire' });
        }

        await pool.query(
            'UPDATE etapesdossiers SET libelleEtapesDossiers = ?, Observations = ? WHERE IDEtapesDossiers = ?',
            [libelleEtapesDossiers, Observations || null, id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'ETAPE_DOSSIER',
            resource_id: id,
            details: { libelleEtapesDossiers, Observations },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Étape mise à jour avec succès' });
    } catch (error) {
        console.error('Error updating dossier stage:', error);
        res.status(500).json({ error: 'Failed to update dossier stage' });
    }
});

/**
 * DELETE /api/etapes-dossiers/:id
 * Delete a dossier stage
 */
router.delete('/:id', checkPermission('STATUTS', 'can_delete'), async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query('DELETE FROM etapesdossiers WHERE IDEtapesDossiers = ?', [id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'ETAPE_DOSSIER',
            resource_id: id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Étape supprimée avec succès' });
    } catch (error) {
        console.error('Error deleting dossier stage:', error);
        res.status(500).json({ error: 'Failed to delete dossier stage' });
    }
});

module.exports = router;
