const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/couleurs
 * Fetch all color codes
 */
router.get('/', checkPermission('PARAMETRES_GENERAUX', 'can_view'), async (req, res) => {
    try {
        const query = 'SELECT ndjours, Rouge, Vert, Bleu FROM couleurs ORDER BY ndjours ASC';
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching couleurs:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des couleurs' });
    }
});

/**
 * POST /api/couleurs
 * Create a new color code
 */
router.post('/', checkPermission('PARAMETRES_GENERAUX', 'can_create'), async (req, res) => {
    try {
        const { ndjours, Rouge, Vert, Bleu } = req.body;
        
        if (ndjours === undefined || ndjours === null || Rouge === undefined || Vert === undefined || Bleu === undefined) {
            return res.status(400).json({ error: 'Veuillez fournir le nombre de jours et les composantes RGB' });
        }

        const query = 'INSERT INTO couleurs (ndjours, Rouge, Vert, Bleu) VALUES (?, ?, ?, ?)';
        await pool.query(query, [ndjours, Rouge, Vert, Bleu]);
        
        res.status(201).json({ message: 'Code couleur créé avec succès', ndjours });
    } catch (err) {
        console.error('Error creating couleur:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Un code couleur pour ce nombre de jours existe déjà' });
        }
        res.status(500).json({ error: 'Erreur lors de la création du code couleur' });
    }
});

/**
 * PUT /api/couleurs/:ndjours
 * Update an existing color code
 */
router.put('/:ndjours', checkPermission('PARAMETRES_GENERAUX', 'can_edit'), async (req, res) => {
    try {
        const { ndjours } = req.params;
        const { Rouge, Vert, Bleu } = req.body;

        if (Rouge === undefined || Vert === undefined || Bleu === undefined) {
            return res.status(400).json({ error: 'Veuillez fournir les composantes RGB' });
        }

        const query = 'UPDATE couleurs SET Rouge = ?, Vert = ?, Bleu = ? WHERE ndjours = ?';
        const [result] = await pool.query(query, [Rouge, Vert, Bleu, ndjours]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Code couleur non trouvé' });
        }

        res.json({ message: 'Code couleur mis à jour avec succès' });
    } catch (err) {
        console.error('Error updating couleur:', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du code couleur' });
    }
});

/**
 * DELETE /api/couleurs/:ndjours
 * Delete a color code
 */
router.delete('/:ndjours', checkPermission('PARAMETRES_GENERAUX', 'can_delete'), async (req, res) => {
    try {
        const { ndjours } = req.params;

        const query = 'DELETE FROM couleurs WHERE ndjours = ?';
        const [result] = await pool.query(query, [ndjours]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Code couleur non trouvé' });
        }

        res.json({ message: 'Code couleur supprimé avec succès' });
    } catch (err) {
        console.error('Error deleting couleur:', err);
        res.status(500).json({ error: 'Erreur lors de la suppression du code couleur' });
    }
});

module.exports = router;
