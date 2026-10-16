/**
 * Endpoints de lecture des tables de référence du régime suspensif.
 * Toutes les listes sont triées par `ordre` puis par `libelle`.
 *
 * GET /api/regime-references/types              -> type_regime
 * GET /api/regime-references/categories         -> categorie_regime
 * GET /api/regime-references/cautions           -> type_caution
 * GET /api/regime-references/statuts            -> statut_suspension
 * GET /api/regime-references/modes-apurement    -> mode_apurement
 * GET /api/regime-references/regimes-eligibles  -> regimedeclaration (avec FK resolues)
 * GET /api/regime-references/all                -> tout en un appel pour init UI
 */
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

const SIMPLE_TABLES = {
    'types':            { table: 'type_regime',       cols: 'id, code, libelle, description, ordre' },
    'categories':       { table: 'categorie_regime',  cols: 'id, code, libelle, description, ordre' },
    'cautions':         { table: 'type_caution',      cols: 'id, code, libelle, description, ordre' },
    'statuts':          { table: 'statut_suspension', cols: 'id, code, libelle, description, couleur, ordre' },
    'modes-apurement':  { table: 'mode_apurement',    cols: 'id, code, libelle, description, libere_caution, ordre' },
};

Object.entries(SIMPLE_TABLES).forEach(([endpoint, def]) => {
    router.get(`/${endpoint}`, async (req, res) => {
        try {
            const [rows] = await pool.query(
                `SELECT ${def.cols} FROM ${def.table}
                 WHERE actif = 1
                 ORDER BY ordre ASC, libelle ASC`
            );
            res.json(rows);
        } catch (err) {
            console.error(`[regime-references/${endpoint}]`, err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });
});

/**
 * GET /regimes-eligibles  -> regimedeclaration enrichi (type + categorie)
 * Optionnel : ?type=SUSPENSIF pour ne retourner que les suspensifs.
 */
router.get('/regimes-eligibles', async (req, res) => {
    try {
        const params = [];
        let where = '';
        if (req.query.type) {
            where = 'WHERE tr.code = ?';
            params.push(req.query.type);
        }
        const [rows] = await pool.query(
            `SELECT
                rd.IDRegimeDeclaration as id,
                rd.CodeRegimeDeclaration as code,
                rd.LibelleRegimeDeclaration as libelle,
                rd.duree_max_jours,
                rd.renouvelable,
                rd.requires_caution,
                rd.taux_caution_pct,
                rd.requires_apurement,
                rd.base_legale,
                rd.documents_requis,
                tr.id as type_regime_id,
                tr.code as type_regime_code,
                tr.libelle as type_regime_libelle,
                cr.id as categorie_id,
                cr.code as categorie_code,
                cr.libelle as categorie_libelle
             FROM regimedeclaration rd
             LEFT JOIN type_regime tr ON tr.id = rd.type_regime_id
             LEFT JOIN categorie_regime cr ON cr.id = rd.categorie_regime_id
             ${where}
             ORDER BY rd.CodeRegimeDeclaration ASC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('[regime-references/regimes-eligibles]', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /all -> charge tout en une seule requête (init UI).
 */
router.get('/all', async (req, res) => {
    try {
        const [types]   = await pool.query('SELECT id, code, libelle, description, ordre FROM type_regime WHERE actif=1 ORDER BY ordre');
        const [cats]    = await pool.query('SELECT id, code, libelle, description, ordre FROM categorie_regime WHERE actif=1 ORDER BY ordre');
        const [caut]    = await pool.query('SELECT id, code, libelle, description, ordre FROM type_caution WHERE actif=1 ORDER BY ordre');
        const [statuts] = await pool.query('SELECT id, code, libelle, description, couleur, ordre FROM statut_suspension WHERE actif=1 ORDER BY ordre');
        const [modes]   = await pool.query('SELECT id, code, libelle, description, libere_caution, ordre FROM mode_apurement WHERE actif=1 ORDER BY ordre');
        res.json({
            types_regime: types,
            categories_regime: cats,
            types_caution: caut,
            statuts_suspension: statuts,
            modes_apurement: modes
        });
    } catch (err) {
        console.error('[regime-references/all]', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
