const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const TransportOrderPDFGenerator = require('../services/TransportOrderPDFGenerator');
const DeliveryNotePDFGenerator = require('../services/DeliveryNotePDFGenerator');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/ordre-transport/dossier/:dossierId
 * Fetch transport orders for a dossier
 */
router.get('/dossier/:dossierId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [orders] = await pool.query(
            'SELECT * FROM ordresdetransport WHERE IDDossiers = ? ORDER BY DateOrdreTransport DESC',
            [req.params.dossierId]
        );

        // Fetch contents for each order
        for (let order of orders) {
            const [contents] = await pool.query(
                'SELECT * FROM contenuconteneurordretrbordereauliv WHERE CodeOrdreTransport = ?',
                [order.CodeOrdreTransport]
            );
            order.contents = contents;
        }

        res.json(orders);
    } catch (err) {
        console.error('Fetch transport orders error:', err);
        res.status(500).json({ error: 'Failed to fetch transport orders' });
    }
});

/**
 * POST /api/ordre-transport
 * Create or Update a transport order
 */
router.post('/', checkPermission('DOSSIERS', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const {
            IDDossiers,
            CodeOrdreTransport,
            DateOrdreTransport,
            TransporteuretAdresse,
            Introduction,
            BL,
            AdresseDeLivraison,
            CodeDossier,
            NumDeclaration,
            DateDeclaration,
            Pregate,
            CodeOrdreTransit,
            forùulepolitesse,
            sectionlivraison,
            sectioncontremaitre,
            contents // Array of objects { NumeroTC, TypeTC, ObjetTC, Quantite, PoidsNet, Unite }
        } = req.body;

        // Convert empty strings to NULL for UNIQUE columns
        const rawNumeserie = req.body.Numeserie;
        const Numeserie = rawNumeserie && String(rawNumeserie).trim() !== '' ? String(rawNumeserie).trim() : null;
        // Normalize date fields: strip time portion from ISO timestamps, convert empty → null
        const safeDate = (d) => d && String(d).trim() !== '' ? String(d).split('T')[0] : null;

        // 1. Delete existing contents for this CodeOrdreTransport if any
        await connection.query(
            'DELETE FROM contenuconteneurordretrbordereauliv WHERE CodeOrdreTransport = ?',
            [CodeOrdreTransport]
        );

        // 2. Insert new contents
        if (contents && contents.length > 0) {
            const contentValues = contents.map(c => [
                CodeOrdreTransport,
                c.NumeroTC,
                c.TypeTC,
                c.ObjetTC,
                c.Quantite || 0,
                c.PoidsNet || 0,
                c.Unite
            ]);
            await connection.query(
                'INSERT INTO contenuconteneurordretrbordereauliv (CodeOrdreTransport, NumeroTC, TypeTC, ObjetTC, Quantite, PoidsNet, Unite) VALUES ?',
                [contentValues]
            );
        }

        // 3. Check if order exists
        const [existing] = await connection.query(
            'SELECT IDOrdresDeTransport FROM ordresdetransport WHERE IDDossiers = ? AND CodeOrdreTransport = ?',
            [IDDossiers, CodeOrdreTransport]
        );

        if (existing.length > 0) {
            // Update
            await connection.query(
                `UPDATE ordresdetransport SET 
                    DateOrdreTransport = ?, TransporteuretAdresse = ?, Introduction = ?, BL = ?, 
                    AdresseDeLivraison = ?, CodeDossier = ?, Numeserie = ?, NumDeclaration = ?, 
                    DateDeclaration = ?, Pregate = ?, CodeOrdreTransit = ?, forùulepolitesse = ?, 
                    sectionlivraison = ?, sectioncontremaitre = ?
                WHERE IDOrdresDeTransport = ?`,
                [
                    safeDate(DateOrdreTransport) || new Date(), TransporteuretAdresse, Introduction, BL,
                    AdresseDeLivraison, CodeDossier, Numeserie, NumDeclaration,
                    safeDate(DateDeclaration), Pregate, CodeOrdreTransit, forùulepolitesse,
                    sectionlivraison, sectioncontremaitre,
                    existing[0].IDOrdresDeTransport
                ]
            );
        } else {
            // Insert
            await connection.query(
                `INSERT INTO ordresdetransport (
                    IDDossiers, CodeOrdreTransport, DateOrdreTransport, TransporteuretAdresse, 
                    Introduction, BL, AdresseDeLivraison, CodeDossier, Numeserie, 
                    NumDeclaration, DateDeclaration, Pregate, CodeOrdreTransit, 
                    forùulepolitesse, sectionlivraison, sectioncontremaitre
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    IDDossiers, CodeOrdreTransport, safeDate(DateOrdreTransport) || new Date(), TransporteuretAdresse,
                    Introduction, BL, AdresseDeLivraison, CodeDossier, Numeserie,
                    NumDeclaration, safeDate(DateDeclaration), Pregate, CodeOrdreTransit,
                    forùulepolitesse, sectionlivraison, sectioncontremaitre
                ]
            );
        }

        await connection.commit();
        res.json({ message: 'Transport order saved successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('Save transport order error:', err);
        res.status(500).json({ error: 'Failed to save transport order' });
    } finally {
        connection.release();
    }
});

/**
 * DELETE /api/ordre-transport/:id
 */
router.delete('/:id', checkPermission('DOSSIERS', 'can_delete'), async (req, res) => {
    try {
        const [order] = await pool.query('SELECT IDDossiers, CodeOrdreTransport FROM ordresdetransport WHERE IDOrdresDeTransport = ?', [req.params.id]);
        if (order.length === 0) return res.status(404).json({ error: 'Order not found' });

        const { IDDossiers, CodeOrdreTransport } = order[0];

        await pool.query('DELETE FROM contenuconteneurordretrbordereauliv WHERE CodeOrdreTransport = ?', [CodeOrdreTransport]);
        await pool.query('DELETE FROM ordresdetransport WHERE IDOrdresDeTransport = ?', [req.params.id]);

        res.json({ message: 'Transport order deleted' });
    } catch (err) {
        console.error('Delete transport order error:', err);
        res.status(500).json({ error: 'Failed to delete transport order' });
    }
});

/**
 * GET /api/ordre-transport/:code/pdf
 * Generate and download transport order PDF
 */
router.get('/:code/pdf', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const generator = new TransportOrderPDFGenerator(pool);
        const outputPath = await generator.generatePDF(req.params.code);
        res.download(outputPath);
    } catch (err) {
        console.error('PDF generation error:', err);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

/**
 * GET /api/ordre-transport/:id/bl-pdf
 * Generate and download delivery slip (Bordereau de Livraison) PDF using OTR ID
 */
router.get('/:id/bl-pdf', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const generator = new DeliveryNotePDFGenerator(pool);
        const outputPath = await generator.generateFromOTR(req.params.id);
        res.download(outputPath);
    } catch (err) {
        console.error('BL generation error:', err);
        res.status(500).json({ error: 'Failed to generate BL PDF' });
    }
});

module.exports = router;
