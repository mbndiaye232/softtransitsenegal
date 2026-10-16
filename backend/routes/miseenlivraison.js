const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const DeliveryNotePDFGenerator = require('../services/DeliveryNotePDFGenerator');
const { recomputeAndSaveDossierEtape } = require('../services/etapeService');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/miseenlivraison/dossier/:dossierId
 * Fetch delivery info for a dossier
 */
router.get('/dossier/:dossierId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `    SELECT ml.*, a.NomAgent as foreman_name, a.Tel as foreman_phone, a.cheminphoto as foreman_photo 
                 FROM miseenlivraison ml
                 LEFT JOIN agents a ON ml.Idcontremaitre = a.IDAgents
                 WHERE ml.IDDossiers = ?`,
            [req.params.dossierId]
        );
        res.json(rows.length > 0 ? rows[0] : null);
    } catch (err) {
        console.error('Fetch miseenlivraison error:', err);
        res.status(500).json({ error: 'Failed to fetch delivery info' });
    }
});

/**
 * POST /api/miseenlivraison
 * Create or update delivery info
 */
router.post('/', checkPermission('DOSSIERS', 'can_edit'), async (req, res) => {
    const {
        IDDossiers,
        DateMiseEnLivraison,
        DateRemiseContremaitre,
        DateRetourConteneur,
        DateEffectiveLivraison,
        Idcontremaitre,
        observationsML,
        Pregate
    } = req.body;

    try {
        // Check if exists
        const [exist] = await pool.query('SELECT IDMiseEnLivraison FROM miseenlivraison WHERE IDDossiers = ?', [IDDossiers]);

        if (exist.length > 0) {
            // Update
            await pool.query(
                `UPDATE miseenlivraison SET 
                    DateMiseEnLivraison = ?, 
                    DateRemiseContremaitre = ?, 
                    DateRetourConteneur = ?, 
                    DateEffectiveLivraison = ?, 
                    Idcontremaitre = ?, 
                    observationsML = ?, 
                    Pregate = ? 
                 WHERE IDDossiers = ?`,
                [
                    DateMiseEnLivraison || null,
                    DateRemiseContremaitre || null,
                    DateRetourConteneur || null,
                    DateEffectiveLivraison || null,
                    Idcontremaitre || null,
                    observationsML || '',
                    Pregate || '',
                    IDDossiers
                ]
            );
            recomputeAndSaveDossierEtape(IDDossiers);
            res.json({ message: 'Mise en livraison updated' });
        } else {
            // Insert
            await pool.query(
                `INSERT INTO miseenlivraison (
                    IDDossiers, 
                    DateMiseEnLivraison, 
                    DateRemiseContremaitre, 
                    DateRetourConteneur,
                    DateEffectiveLivraison,
                    Idcontremaitre, 
                    observationsML, 
                    Pregate
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    IDDossiers,
                    DateMiseEnLivraison || null,
                    DateRemiseContremaitre || null,
                    DateRetourConteneur || null,
                    DateEffectiveLivraison || null,
                    Idcontremaitre || null,
                    observationsML || '',
                    Pregate || ''
                ]
            );
            recomputeAndSaveDossierEtape(IDDossiers);
            res.status(201).json({ message: 'Mise en livraison created' });
        }
    } catch (err) {
        console.error('Save miseenlivraison error:', err);
        res.status(500).json({ error: 'Failed to save delivery info' });
    }
});

/**
 * GET /api/miseenlivraison/foremen
 * Get all agents in the "Contremaîtres" group (ID 11)
 */
router.get('/foremen', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT IDAgents as id, NomAgent as name, Tel as phone, Email as email, cheminphoto as photo FROM agents WHERE IDGroupes = 11 AND (structur_id = ? OR structur_id = 0)',
            [req.structur_id]
        );
        res.json(rows);
    } catch (err) {
        console.error('Fetch foremen error:', err);
        res.status(500).json({ error: 'Failed to fetch foremen' });
    }
});

/**
 * GET /api/miseenlivraison/:dossierId/pdf
 * Generate and download delivery note PDF
 */
router.get('/:dossierId/pdf', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const generator = new DeliveryNotePDFGenerator(pool);
        const outputPath = await generator.generatePDF(req.params.dossierId);
        res.download(outputPath);
    } catch (err) {
        console.error('PDF generation error:', err);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

module.exports = router;
