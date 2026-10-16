const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const { recomputeAndSaveDossierEtape } = require('../services/etapeService');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/declarations/dossier/:dossierId
 * Get all declarations for a specific dossier
 */
router.get('/dossier/:dossierId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT d.*, a.NomAgent as agent_name 
             FROM declarations d 
             LEFT JOIN agents a ON d.IdAgent = a.IDAgents 
             WHERE d.IDDossiers = ? 
             ORDER BY d.DateDeclaration DESC`,
            [req.params.dossierId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Fetch declarations error:', err);
        res.status(500).json({ error: 'Failed to fetch declarations' });
    }
});

/**
 * GET /api/declarations/dossier/:dossierId/active-cotation
 * Get the current active agent assigned via cotation
 */
router.get('/dossier/:dossierId/active-cotation', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const query = `
            SELECT dc.*, a.NomAgent as name, a.Tel as phone, a.Email as email, a.cheminphoto as photo 
            FROM dossier_cotations dc
            JOIN agents a ON dc.agent_id = a.IDAgents
            WHERE dc.dossier_id = ? AND dc.is_active = 1
            LIMIT 1
        `;
        const [rows] = await pool.query(query, [req.params.dossierId]);
        res.json(rows.length > 0 ? rows[0] : null);
    } catch (err) {
        console.error('Fetch active cotation error:', err);
        res.status(500).json({ error: 'Failed to fetch active cotation' });
    }
});

/**
 * POST /api/declarations
 * Create a new declaration
 */
router.post('/', checkPermission('DOSSIERS', 'can_edit'), async (req, res) => {
    const {
        IDDossiers,
        NumeroDeclaration,
        DateDeclaration,
        DateBAE,
        RegimeDeclaration,
        NumeroBureau,
        IdAgent,
        Observations
    } = req.body;

    try {
        const [result] = await pool.query(
            `INSERT INTO declarations (
                structur_id, IDDossiers, NumeroDeclaration, DateDeclaration, 
                DateBAE, RegimeDeclaration, NumeroBureau, IdAgent, Observations
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.structur_id,
                IDDossiers,
                NumeroDeclaration,
                DateDeclaration || null,
                DateBAE || null,
                RegimeDeclaration,
                NumeroBureau,
                IdAgent || 0,
                Observations || ''
            ]
        );
        // Recompute dossier étape (best-effort)
        recomputeAndSaveDossierEtape(IDDossiers);
        res.status(201).json({ id: result.insertId, message: 'Declaration created' });
    } catch (err) {
        console.error('Create declaration error:', err);
        res.status(500).json({ error: 'Failed to create declaration' });
    }
});

/**
 * DELETE /api/declarations/:id
 */
router.delete('/:id', checkPermission('DOSSIERS', 'can_delete'), async (req, res) => {
    try {
        // Récupérer IDDossiers avant suppression pour recompute étape
        const [[row]] = await pool.query('SELECT IDDossiers FROM declarations WHERE IDDeclarations = ?', [req.params.id]);
        await pool.query('DELETE FROM declarations WHERE IDDeclarations = ?', [req.params.id]);
        if (row?.IDDossiers) recomputeAndSaveDossierEtape(row.IDDossiers);
        res.json({ message: 'Declaration deleted' });
    } catch (err) {
        console.error('Delete declaration error:', err);
        res.status(500).json({ error: 'Failed to delete declaration' });
    }
});

/**
 * GET /api/declarations/regimes
 * List all declaration regimes
 */
router.get('/regimes', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM regimedeclaration ORDER BY CodeRegimeDeclaration');
        res.json(rows);
    } catch (err) {
        console.error('Fetch regimes error:', err);
        res.status(500).json({ error: 'Failed to fetch regimes' });
    }
});

module.exports = router;
