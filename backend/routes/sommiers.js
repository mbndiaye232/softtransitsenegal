/**
 * CRUD sommiers (régimes suspensifs v2).
 *   GET    /api/sommiers              - liste filtrable
 *   GET    /api/sommiers/:id          - détail + articles + apurements
 *   POST   /api/sommiers              - création (avec articles figés)
 *   PUT    /api/sommiers/:id          - modification en-tête (pas les articles)
 *   DELETE /api/sommiers/:id          - soft delete
 *   POST   /api/sommiers/:id/resilier - résiliation
 *   POST   /api/sommiers/:id/liberer-caution - libère la caution
 *
 *   GET /api/sommiers/by-entrepot/:entrepot_id  - vue articles agrégée par entrepôt
 *
 * Filtre regimes : seuls les régimes de type SUSPENSIF (regimedeclaration.type_regime_id) sont éligibles.
 */
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

router.use(authMiddleware);
router.use(tenantMiddleware);

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const SOMMIER_SELECT = `
    s.*,
    rd.CodeRegimeDeclaration   AS regime_code,
    rd.LibelleRegimeDeclaration AS regime_libelle,
    d.CodeDossier              AS dossier_code,
    d.Libelle                  AS dossier_libelle,
    cl.NomRS                   AS client_nom,
    cl.NINEA                   AS client_ninea,
    (s.date_echeance - CURRENT_DATE) AS jours_avant_echeance
`;
const SOMMIER_JOINS = `
    FROM sommier s
    JOIN regimedeclaration rd ON rd.IDRegimeDeclaration = s.IDRegimeDeclaration
    LEFT JOIN dossiers d      ON d.IDDossiers = s.IDDossiers
    LEFT JOIN clients cl      ON cl.IDCLIENTS = s.IDCLIENTS
`;


/* ─── GET / : liste ──────────────────────────────────────────────────────── */
router.get('/', checkPermission('SOMMIERS', 'can_view'), async (req, res) => {
    try {
        const where  = ['s.deleted_at IS NULL'];
        const params = [];
        if (!req.is_viewing_all) {
            where.push('s.structur_id = ?');
            params.push(req.structur_id);
        }
        if (req.query.statut)      { where.push('s.statut = ?');     params.push(req.query.statut); }
        if (req.query.client_id)   { where.push('s.IDCLIENTS = ?');  params.push(req.query.client_id); }
        if (req.query.dossier_id)  { where.push('s.IDDossiers = ?'); params.push(req.query.dossier_id); }
        if (req.query.echeance_dans) {
            where.push('(s.date_echeance - CURRENT_DATE) <= ?');
            params.push(parseInt(req.query.echeance_dans, 10));
        }

        const limit  = parseInt(req.query.limit  || 100, 10);
        const offset = parseInt(req.query.offset || 0, 10);

        const [rows] = await pool.query(
            `SELECT ${SOMMIER_SELECT} ${SOMMIER_JOINS}
             WHERE ${where.join(' AND ')}
             ORDER BY s.date_echeance ASC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        res.json(rows);
    } catch (err) {
        console.error('sommiers GET / :', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─── GET /by-entrepot/:entrepot_id — vue articles agrégée ───────────────── */
router.get('/by-entrepot/:entrepot_id', checkPermission('SOMMIERS', 'can_view'), async (req, res) => {
    try {
        const where  = ['sa.entrepot_id = ?', 's.deleted_at IS NULL', "s.statut = 'ACTIF'"];
        const params = [req.params.entrepot_id];
        if (!req.is_viewing_all) {
            where.push('s.structur_id = ?');
            params.push(req.structur_id);
        }
        const [rows] = await pool.query(
            `SELECT
                sa.id, sa.sommier_id, sa.designation, sa.code_tarif, sa.unite_poids,
                sa.poids_initial, sa.colis_initial, sa.valeur_initial,
                sa.poids_apure,   sa.colis_apure,   sa.valeur_apure,
                (sa.poids_initial  - sa.poids_apure)  AS poids_restant,
                (sa.colis_initial  - sa.colis_apure)  AS colis_restant,
                (sa.valeur_initial - sa.valeur_apure) AS valeur_restante,
                s.numero_declaration, s.date_echeance, s.statut,
                rd.CodeRegimeDeclaration AS regime_code,
                cl.NomRS AS client_nom,
                (s.date_echeance - CURRENT_DATE) AS jours_avant_echeance
             FROM sommier_article sa
             JOIN sommier s            ON s.id = sa.sommier_id
             JOIN regimedeclaration rd ON rd.IDRegimeDeclaration = s.IDRegimeDeclaration
             LEFT JOIN clients cl      ON cl.IDCLIENTS = s.IDCLIENTS
             WHERE ${where.join(' AND ')}
             ORDER BY s.date_echeance ASC, sa.designation ASC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('sommiers GET /by-entrepot :', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─── GET /article/:id/sorties : historique chronologique d'un article ──── */
router.get('/article/:article_id/sorties', checkPermission('SOMMIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT al.id, al.poids, al.colis, al.valeur,
                    a.id AS apurement_id,
                    a.date_apurement, a.type_sortie, a.reference_sortie, a.observations
             FROM apurement_ligne al
             JOIN apurement a ON a.id = al.apurement_id
             WHERE al.sommier_article_id = ?
               AND a.deleted_at IS NULL
             ORDER BY a.date_apurement DESC, a.id DESC`,
            [req.params.article_id]
        );
        res.json(rows);
    } catch (err) {
        console.error('sommiers GET /article/:id/sorties :', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─── GET /entrepot/:entrepot_id/sommiers — tous les sommiers d'un entrepôt ─ */
router.get('/entrepot/:entrepot_id/sommiers', checkPermission('SOMMIERS', 'can_view'), async (req, res) => {
    try {
        const where  = [
            's.deleted_at IS NULL',
            's.id IN (SELECT DISTINCT sommier_id FROM sommier_article WHERE entrepot_id = ?)'
        ];
        const params = [req.params.entrepot_id];
        if (!req.is_viewing_all) { where.push('s.structur_id = ?'); params.push(req.structur_id); }
        const [rows] = await pool.query(
            `SELECT ${SOMMIER_SELECT} ${SOMMIER_JOINS}
             WHERE ${where.join(' AND ')}
             ORDER BY s.date_declaration DESC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('sommiers GET /entrepot/:id/sommiers :', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─── GET /client/:client_id/entrepots ───────────────────────────────────── */
router.get('/client/:client_id/entrepots', checkPermission('SOMMIERS', 'can_view'), async (req, res) => {
    try {
        const where  = ['s.IDCLIENTS = ?', 's.deleted_at IS NULL'];
        const params = [req.params.client_id];
        if (!req.is_viewing_all) { where.push('s.structur_id = ?'); params.push(req.structur_id); }
        const [rows] = await pool.query(`
            SELECT e.id, e.libelle, e.adresse, e.type_entrepot,
                   COUNT(DISTINCT sa.sommier_id) AS nb_sommiers
            FROM sommier_article sa
            JOIN entrepot e ON e.id = sa.entrepot_id
            JOIN sommier s  ON s.id = sa.sommier_id
            WHERE ${where.join(' AND ')}
            GROUP BY e.id, e.libelle, e.adresse, e.type_entrepot
            ORDER BY e.libelle ASC
        `, params);
        res.json(rows);
    } catch (err) {
        console.error('sommiers GET /client/:id/entrepots :', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─── GET /client/:client_id/entrepot/:entrepot_id/sommiers ──────────────── */
router.get('/client/:client_id/entrepot/:entrepot_id/sommiers', checkPermission('SOMMIERS', 'can_view'), async (req, res) => {
    try {
        const where  = [
            's.IDCLIENTS = ?', 's.deleted_at IS NULL',
            's.id IN (SELECT DISTINCT sommier_id FROM sommier_article WHERE entrepot_id = ?)'
        ];
        const params = [req.params.client_id, req.params.entrepot_id];
        if (!req.is_viewing_all) { where.push('s.structur_id = ?'); params.push(req.structur_id); }
        const [rows] = await pool.query(
            `SELECT ${SOMMIER_SELECT} ${SOMMIER_JOINS}
             WHERE ${where.join(' AND ')}
             ORDER BY s.date_declaration DESC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('sommiers GET /client/:id/entrepot/:id/sommiers :', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─── GET /:id : détail complet ──────────────────────────────────────────── */
router.get('/:id', checkPermission('SOMMIERS', 'can_view'), async (req, res) => {
    try {
        const [[som]] = await pool.query(
            `SELECT ${SOMMIER_SELECT} ${SOMMIER_JOINS}
             WHERE s.id = ? AND s.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!som) return res.status(404).json({ error: 'Sommier introuvable' });
        if (!req.is_viewing_all && som.structur_id !== req.structur_id) {
            return res.status(403).json({ error: 'Accès refusé' });
        }

        const [articles] = await pool.query(
            `SELECT sa.*, e.libelle AS entrepot_libelle,
                    (sa.poids_initial  - sa.poids_apure)  AS poids_restant,
                    (sa.colis_initial  - sa.colis_apure)  AS colis_restant,
                    (sa.valeur_initial - sa.valeur_apure) AS valeur_restante
             FROM sommier_article sa
             JOIN entrepot e ON e.id = sa.entrepot_id
             WHERE sa.sommier_id = ?
             ORDER BY sa.numero_ligne, sa.id`,
            [req.params.id]
        );

        const [apurements] = await pool.query(
            `SELECT a.*,
                    (SELECT json_agg(json_build_object(
                        'id', al.id, 'sommier_article_id', al.sommier_article_id,
                        'designation', sa.designation,
                        'poids', al.poids, 'colis', al.colis, 'valeur', al.valeur))
                     FROM apurement_ligne al
                     JOIN sommier_article sa ON sa.id = al.sommier_article_id
                     WHERE al.apurement_id = a.id) AS lignes
             FROM apurement a
             WHERE a.sommier_id = ? AND a.deleted_at IS NULL
             ORDER BY a.date_apurement DESC, a.id DESC`,
            [req.params.id]
        );

        res.json({ ...som, articles, apurements });
    } catch (err) {
        console.error('sommiers GET /:id :', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─── POST / : création (en-tête + articles figés) ───────────────────────── */
router.post('/', checkPermission('SOMMIERS', 'can_create'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const {
            IDRegimeDeclaration, numero_declaration, date_declaration, date_echeance,
            IDDossiers, IDCLIENTS,
            caution_requise, caution_montant,
            observations, articles
        } = req.body;

        if (!IDRegimeDeclaration || !numero_declaration || !date_declaration || !date_echeance) {
            return res.status(400).json({ error: 'Régime, n° déclaration, dates début/échéance requis' });
        }
        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ error: 'Au moins un article requis' });
        }

        // Vérifier que le régime est de type Suspensif
        const [[reg]] = await pool.query(
            `SELECT rd.CodeRegimeDeclaration, tr.code AS type_code
             FROM regimedeclaration rd
             LEFT JOIN type_regime tr ON tr.id = rd.type_regime_id
             WHERE rd.IDRegimeDeclaration = ?`,
            [IDRegimeDeclaration]
        );
        if (!reg) return res.status(400).json({ error: 'Régime introuvable' });
        if (reg.type_code !== 'SUSPENSIF') {
            return res.status(400).json({ error: `Régime ${reg.CodeRegimeDeclaration} non éligible aux sommiers (seuls les régimes de type Suspensif le sont)` });
        }

        // Vérifier unicité globale du n° déclaration
        const [[dup]] = await pool.query(
            `SELECT id FROM sommier WHERE numero_declaration = ? AND deleted_at IS NULL`,
            [numero_declaration]
        );
        if (dup) return res.status(409).json({ error: `N° déclaration ${numero_declaration} déjà utilisé` });

        await conn.beginTransaction();

        const [r] = await conn.query(
            `INSERT INTO sommier
                (structur_id, IDDossiers, IDCLIENTS, IDRegimeDeclaration,
                 numero_declaration, date_declaration, date_echeance,
                 caution_requise, caution_montant, observations, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.structur_id, IDDossiers || null, IDCLIENTS || null, IDRegimeDeclaration,
             numero_declaration.trim(), date_declaration, date_echeance,
             caution_requise ? 1 : 0, caution_montant || null,
             observations || null, req.user.id]
        );
        const sommierId = r.insertId;

        for (let i = 0; i < articles.length; i++) {
            const a = articles[i];
            if (!a.entrepot_id || !a.designation) {
                throw new Error(`Article ${i + 1} : entrepôt et désignation requis`);
            }
            await conn.query(
                `INSERT INTO sommier_article
                    (sommier_id, entrepot_id, numero_ligne, designation, code_tarif,
                     poids_initial, colis_initial, valeur_initial, unite_poids)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [sommierId, a.entrepot_id, a.numero_ligne || (i + 1),
                 a.designation, a.code_tarif || null,
                 a.poids_initial || 0, a.colis_initial || 0, a.valeur_initial || 0,
                 a.unite_poids || 'KG']
            );
        }

        await conn.commit();
        res.status(201).json({ id: sommierId });
    } catch (err) {
        await conn.rollback();
        console.error('sommiers POST / :', err);
        res.status(500).json({ error: err.sqlMessage || err.message });
    } finally {
        conn.release();
    }
});

/* ─── PUT /:id : modif en-tête (pas les articles) ────────────────────────── */
router.put('/:id', checkPermission('SOMMIERS', 'can_edit'), async (req, res) => {
    try {
        const allowed = ['date_echeance', 'caution_requise', 'caution_montant',
                         'caution_liberee', 'caution_date_liberation', 'observations'];
        const fields = [];
        const params = [];
        for (const k of allowed) {
            if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
        }
        if (!fields.length) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });

        params.push(req.params.id);
        const where = req.is_viewing_all
            ? 'id = ? AND deleted_at IS NULL'
            : 'id = ? AND deleted_at IS NULL AND structur_id = ?';
        if (!req.is_viewing_all) params.push(req.structur_id);

        const [r] = await pool.query(`UPDATE sommier SET ${fields.join(', ')} WHERE ${where}`, params);
        if (!r.affectedRows) return res.status(404).json({ error: 'Sommier introuvable' });
        res.json({ updated: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── DELETE /:id (soft) ─────────────────────────────────────────────────── */
router.delete('/:id', checkPermission('SOMMIERS', 'can_delete'), async (req, res) => {
    try {
        const where = req.is_viewing_all
            ? 'id = ? AND deleted_at IS NULL'
            : 'id = ? AND deleted_at IS NULL AND structur_id = ?';
        const params = [req.params.id];
        if (!req.is_viewing_all) params.push(req.structur_id);

        const [r] = await pool.query(`UPDATE sommier SET deleted_at = NOW() WHERE ${where}`, params);
        if (!r.affectedRows) return res.status(404).json({ error: 'Sommier introuvable' });
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── POST /:id/resilier ─────────────────────────────────────────────────── */
router.post('/:id/resilier', checkPermission('SOMMIERS', 'can_edit'), async (req, res) => {
    try {
        const [r] = await pool.query(
            `UPDATE sommier SET statut = 'RESILIE' WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );
        if (!r.affectedRows) return res.status(404).json({ error: 'Sommier introuvable' });
        res.json({ resilie: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── POST /:id/liberer-caution ──────────────────────────────────────────── */
router.post('/:id/liberer-caution', checkPermission('SOMMIERS', 'can_edit'), async (req, res) => {
    try {
        const [r] = await pool.query(
            `UPDATE sommier
             SET caution_liberee = 1, caution_date_liberation = CURRENT_DATE
             WHERE id = ? AND deleted_at IS NULL AND caution_requise = 1`,
            [req.params.id]
        );
        if (!r.affectedRows) return res.status(404).json({ error: 'Sommier introuvable ou pas de caution' });
        res.json({ liberee: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
