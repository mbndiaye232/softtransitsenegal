const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

console.log('--- BILL OF LADING ROUTES LOADED ---');

/**
 * GET /api/bill-of-lading/dossier/:dossierId
 * Get bill of lading info for a specific dossier
 */
router.get('/dossier/:dossierId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM billoflading WHERE idbl = ?',
            [req.params.dossierId]
        );

        if (rows.length === 0) {
            return res.json(null);
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Fetch BL error:', err);
        res.status(500).json({ error: 'Failed to fetch BL data' });
    }
});

/**
 * POST /api/bill-of-lading
 * Create or Update bill of lading
 */
router.post('/', checkPermission('DOSSIERS', 'can_edit'), async (req, res) => {
    const {
        idbl,
        NumeroTitreTransport,
        Consignee,
        Notify,
        LieuReception,
        LieuPaiementFret,
        NbreBLOriginaux,
        NombreConteneurs,
        Fournisseur,
        DureeFranchise,
        TypeTitreTransport,
        AdresseLivraisonFinale,
        Expediteur
    } = req.body;

    try {
        // Check if exists
        const [exist] = await pool.query('SELECT IDBillOfLading FROM billoflading WHERE idbl = ?', [idbl]);

        if (exist.length > 0) {
            // Update
            await pool.query(
                `UPDATE billoflading SET 
                    NumeroTitreTransport = ?, Consignee = ?, Notify = ?, LieuReception = ?, 
                    LieuPaiementFret = ?, NbreBLOriginaux = ?, NombreConteneurs = ?, 
                    Fournisseur = ?, DureeFranchise = ?, TypeTitreTransport = ?, 
                    AdresseLivraisonFinale = ?, Expediteur = ?
                 WHERE idbl = ?`,
                [
                    NumeroTitreTransport || '', Consignee || '', Notify || '', LieuReception || '',
                    LieuPaiementFret || '', NbreBLOriginaux || 0, NombreConteneurs || 0,
                    Fournisseur || '', DureeFranchise || 0, TypeTitreTransport || '',
                    AdresseLivraisonFinale || '', Expediteur || '',
                    idbl
                ]
            );
            res.json({ message: 'Bill of Lading updated' });
        } else {
            // Insert
            await pool.query(
                `INSERT INTO billoflading (
                    idbl, NumeroTitreTransport, Consignee, Notify, LieuReception, 
                    LieuPaiementFret, NbreBLOriginaux, NombreConteneurs, Fournisseur, 
                    DureeFranchise, TypeTitreTransport, AdresseLivraisonFinale, Expediteur
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    idbl, NumeroTitreTransport || '', Consignee || '', Notify || '', LieuReception || '',
                    LieuPaiementFret || '', NbreBLOriginaux || 0, NombreConteneurs || 0, Fournisseur || '',
                    DureeFranchise || 0, TypeTitreTransport || '', AdresseLivraisonFinale || '', Expediteur || ''
                ]
            );
            res.status(201).json({ message: 'Bill of Lading created' });
        }
    } catch (err) {
        console.error('Save BL error:', err);
        res.status(500).json({ error: 'Failed to save BL data' });
    }
});

module.exports = router;
