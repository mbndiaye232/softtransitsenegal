const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

console.log('--- TRANSPORTS ROUTES LOADED ---');

/**
 * GET /api/transports/dossier/:dossierId
 * Get transport info for a specific dossier
 */
router.get('/dossier/:dossierId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    console.log('GET /api/transports/dossier/', req.params.dossierId);
    try {
        // Dans la capture, 'idbl' semble être utilisé pour lier au dossier
        const [rows] = await pool.query(
            'SELECT * FROM transports WHERE idbl = ?',
            [req.params.dossierId]
        );

        if (rows.length === 0) {
            return res.json(null);
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Fetch transport error:', err);
        res.status(500).json({ error: 'Failed to fetch transport data' });
    }
});

/**
 * POST /api/transports
 * Create or Update transport info
 */
router.post('/', checkPermission('DOSSIERS', 'can_edit'), async (req, res) => {
    const {
        idbl,
        DateDepart,
        IdLieuDepart,
        IdLieuArrive,
        IDMoyensTransport,
        NumeroTitreTransport,
        libelleTransport,
        Observations,
        DateArriveePrevue,
        HeureArriveePrevue,
        NumeroEscale
    } = req.body;

    try {
        console.log('Attempting to save transport for IDBL:', idbl);
        // Check if exists
        const [exist] = await pool.query('SELECT IDTransports FROM transports WHERE idbl = ?', [idbl]);

        if (exist.length > 0) {
            console.log('Transport exists, updating...');
            // Update
            await pool.query(
                `UPDATE transports SET 
                    DateDepart = ?, IdLieuDepart = ?, IdLieuArrive = ?, IdAgent = ?, 
                    IDMoyensTransport = ?, NumeroTitreTransport = ?, libelleTransport = ?, 
                    Observations = ?, DateArriveePrevue = ?, HeureArriveePrevue = ?, NumeroEscale = ?
                 WHERE idbl = ?`,
                [
                    DateDepart || null, IdLieuDepart || null, IdLieuArrive || null, req.user.id,
                    IDMoyensTransport ? parseInt(IDMoyensTransport) : null,
                    NumeroTitreTransport || '', libelleTransport || '',
                    Observations || '', DateArriveePrevue || null, HeureArriveePrevue || null, NumeroEscale || '',
                    idbl
                ]
            );
            res.json({ message: 'Transport updated' });
        } else {
            console.log('Transport does not exist, inserting...');
            // Insert
            await pool.query(
                `INSERT INTO transports (
                    idbl, DateDepart, IdLieuDepart, IdLieuArrive, IdAgent, 
                    IDMoyensTransport, NumeroTitreTransport, libelleTransport, 
                    Observations, DateArriveePrevue, HeureArriveePrevue, NumeroEscale
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    idbl, DateDepart || null, IdLieuDepart || null, IdLieuArrive || null, req.user.id,
                    IDMoyensTransport ? parseInt(IDMoyensTransport) : null,
                    NumeroTitreTransport || '', libelleTransport || '',
                    Observations || '', DateArriveePrevue || null, HeureArriveePrevue || null, NumeroEscale || ''
                ]
            );
            res.status(201).json({ message: 'Transport created' });
        }
    } catch (err) {
        console.error('Save transport error details:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to save transport data' });
    }
});

module.exports = router;
