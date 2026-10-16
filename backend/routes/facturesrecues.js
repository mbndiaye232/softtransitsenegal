// backend/routes/facturesrecues.js
// Gestion des factures reçues de tiers (débours payés pour le compte du client)
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.use(tenantMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/facturesrecues/dossier/:dossierId
// Lister toutes les lignes de factures tiers pour un dossier (avec infos tiers)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dossier/:dossierId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT fr.*, 
                    t.libtier as TiersNom
             FROM facturesrecues fr
             LEFT JOIN tiers t ON fr.IDTiers = t.IDTiers
             WHERE fr.IDDossiers = ?
             ORDER BY fr.DdateHeureSaisi DESC`,
            [req.params.dossierId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Erreur liste facturesrecues:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/facturesrecues/debours/:dossierId
// Agrégation par rubrique (somme des MontantTTC identiques) pour intégration facture
// ─────────────────────────────────────────────────────────────────────────────
router.get('/debours/:dossierId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT 
                fr.IDRubriques,
                fr.CodeRubrique,
                fr.libelleRubrique,
                SUM(fr.MontantTTC) as montant,
                string_agg(DISTINCT COALESCE(fr.NomTiers, t.libtier, 'Tiers inconnu'), ', ') as tiers_concernes,
                string_agg(DISTINCT fr.NumeroFacture, ', ') as numeros_factures,
                string_agg(fr.Observations, ' | ') as observations_combinees,
                COUNT(*) as nb_factures
             FROM facturesrecues fr
             LEFT JOIN tiers t ON fr.IDTiers = t.IDTiers
             WHERE fr.IDDossiers = ?
             GROUP BY fr.IDRubriques, fr.CodeRubrique, fr.libelleRubrique
             ORDER BY fr.CodeRubrique`,
            [req.params.dossierId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Erreur debours agrégés:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/facturesrecues
// Ajouter une ligne de facture tiers
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const { idDossier, idTiers, idRubrique, codeRubrique, libelleRubrique, montantTTC, numeroFacture, observations } = req.body;

    if (!idDossier || !idRubrique || !montantTTC) {
        return res.status(400).json({ error: 'Dossier, rubrique et montant sont requis' });
    }

    try {
        // Récupérer le nom du tiers si fourni
        let nomTiers = null;
        if (idTiers) {
            const [[tier]] = await pool.query('SELECT libtier FROM tiers WHERE IDTiers = ?', [idTiers]);
            nomTiers = tier?.libtier || null;
        }

        const [result] = await pool.query(
            `INSERT INTO facturesrecues
                (IDDossiers, IDTiers, IDRubriques, CodeRubrique, libelleRubrique,
                 MontantTTC, NumeroFacture, Observations, NomTiers, IdAgent, DdateHeureSaisi)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [idDossier, idTiers || null, idRubrique, codeRubrique, libelleRubrique,
                montantTTC, numeroFacture || null, observations || null, nomTiers, req.user.id]
        );

        res.status(201).json({ id: result.insertId, message: 'Ligne ajoutée avec succès' });
    } catch (error) {
        console.error('Erreur création facturesrecues:', error);
        res.status(500).json({ error: error.sqlMessage || error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/facturesrecues/:id
// Modifier une ligne
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    const { idTiers, idRubrique, codeRubrique, libelleRubrique, montantTTC, numeroFacture, observations } = req.body;

    try {
        let nomTiers = null;
        if (idTiers) {
            const [[tier]] = await pool.query('SELECT libtier FROM tiers WHERE IDTiers = ?', [idTiers]);
            nomTiers = tier?.libtier || null;
        }

        const [result] = await pool.query(
            `UPDATE facturesrecues SET
                IDTiers = ?, IDRubriques = ?, CodeRubrique = ?, libelleRubrique = ?,
                MontantTTC = ?, NumeroFacture = ?, Observations = ?, NomTiers = ?
             WHERE IDFacturesRecues = ?`,
            [idTiers || null, idRubrique, codeRubrique, libelleRubrique,
                montantTTC, numeroFacture || null, observations || null, nomTiers, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ligne introuvable' });
        }
        res.json({ message: 'Ligne modifiée avec succès' });
    } catch (error) {
        console.error('Erreur modification facturesrecues:', error);
        res.status(500).json({ error: error.sqlMessage || error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/facturesrecues/:id
// Supprimer une ligne
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.query(
            'DELETE FROM facturesrecues WHERE IDFacturesRecues = ?',
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ligne introuvable' });
        }
        res.json({ message: 'Ligne supprimée avec succès' });
    } catch (error) {
        console.error('Erreur suppression facturesrecues:', error);
        res.status(500).json({ error: error.sqlMessage || error.message });
    }
});

module.exports = router;
