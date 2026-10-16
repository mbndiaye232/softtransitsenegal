/**
 * CRUD apurements (v2).
 *
 * Un apurement = en-tête (date, type sortie, référence) + ventilation par article
 * (apurement_ligne : poids, colis, valeur).
 *
 *   GET    /api/apurements/sommier/:sommier_id  - liste apurements d'un sommier
 *   GET    /api/apurements/:id                  - détail (avec lignes)
 *   POST   /api/apurements                      - création
 *   PUT    /api/apurements/:id                  - modification (en-tête uniquement)
 *   DELETE /api/apurements/:id                  - soft delete (recalcule compteurs)
 */
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const { recomputeSommierStatut } = require('../services/sommierStatusService');

router.use(authMiddleware);
router.use(tenantMiddleware);

/* ─── GET /sommier/:sommier_id : liste apurements ────────────────────────── */
router.get('/sommier/:sommier_id', checkPermission('APUREMENTS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT a.*,
                    (SELECT json_agg(json_build_object(
                        'id', al.id, 'sommier_article_id', al.sommier_article_id,
                        'designation', sa.designation, 'code_tarif', sa.code_tarif,
                        'poids', al.poids, 'colis', al.colis, 'valeur', al.valeur))
                     FROM apurement_ligne al
                     JOIN sommier_article sa ON sa.id = al.sommier_article_id
                     WHERE al.apurement_id = a.id) AS lignes
             FROM apurement a
             WHERE a.sommier_id = ? AND a.deleted_at IS NULL
             ORDER BY a.date_apurement DESC, a.id DESC`,
            [req.params.sommier_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── GET /:id ───────────────────────────────────────────────────────────── */
router.get('/:id', checkPermission('APUREMENTS', 'can_view'), async (req, res) => {
    try {
        const [[row]] = await pool.query(
            `SELECT * FROM apurement WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );
        if (!row) return res.status(404).json({ error: 'Apurement introuvable' });

        const [lignes] = await pool.query(
            `SELECT al.*, sa.designation, sa.code_tarif, sa.unite_poids
             FROM apurement_ligne al
             JOIN sommier_article sa ON sa.id = al.sommier_article_id
             WHERE al.apurement_id = ?`,
            [req.params.id]
        );
        res.json({ ...row, lignes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── POST / : création (en-tête + lignes) ───────────────────────────────── */
router.post('/', checkPermission('APUREMENTS', 'can_create'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const {
            sommier_id, date_apurement, type_sortie, reference_sortie,
            observations, lignes
        } = req.body;

        if (!sommier_id || !date_apurement || !type_sortie) {
            return res.status(400).json({ error: 'sommier_id, date_apurement, type_sortie requis' });
        }
        if (!Array.isArray(lignes) || lignes.length === 0) {
            return res.status(400).json({ error: 'Au moins une ligne d\'apurement requise' });
        }

        // Vérifier que le sommier appartient au tenant
        const [[som]] = await conn.query(
            `SELECT id, structur_id, statut FROM sommier WHERE id = ? AND deleted_at IS NULL`,
            [sommier_id]
        );
        if (!som) return res.status(404).json({ error: 'Sommier introuvable' });
        if (!req.is_viewing_all && som.structur_id !== req.structur_id) {
            return res.status(403).json({ error: 'Accès refusé' });
        }
        if (som.statut !== 'ACTIF') {
            return res.status(400).json({ error: `Sommier au statut ${som.statut} : impossible d'apurer` });
        }

        await conn.beginTransaction();

        const [r] = await conn.query(
            `INSERT INTO apurement
                (sommier_id, structur_id, date_apurement, type_sortie,
                 reference_sortie, observations, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sommier_id, som.structur_id, date_apurement, type_sortie,
             reference_sortie || null, observations || null, req.user.id]
        );
        const apurementId = r.insertId;

        for (const l of lignes) {
            if (!l.sommier_article_id) {
                throw new Error('sommier_article_id requis sur chaque ligne');
            }
            const poids  = Number(l.poids  || 0);
            const colis  = Number(l.colis  || 0);
            const valeur = Number(l.valeur || 0);
            if (poids === 0 && colis === 0 && valeur === 0) continue;

            // Vérifier que l'article appartient bien au sommier et ne dépasse pas le reste
            const [[art]] = await conn.query(
                `SELECT poids_initial, colis_initial, valeur_initial,
                        poids_apure,   colis_apure,   valeur_apure
                 FROM sommier_article WHERE id = ? AND sommier_id = ?`,
                [l.sommier_article_id, sommier_id]
            );
            if (!art) throw new Error(`Article ${l.sommier_article_id} introuvable dans ce sommier`);
            if (poids  > 0 && Number(art.poids_apure)  + poids  > Number(art.poids_initial))
                throw new Error(`Article ${l.sommier_article_id} : poids apuré dépasserait l'initial`);
            if (colis  > 0 && Number(art.colis_apure)  + colis  > Number(art.colis_initial))
                throw new Error(`Article ${l.sommier_article_id} : colis apurés dépasseraient l'initial`);
            if (valeur > 0 && Number(art.valeur_apure) + valeur > Number(art.valeur_initial))
                throw new Error(`Article ${l.sommier_article_id} : valeur apurée dépasserait l'initial`);

            await conn.query(
                `INSERT INTO apurement_ligne (apurement_id, sommier_article_id, poids, colis, valeur)
                 VALUES (?, ?, ?, ?, ?)`,
                [apurementId, l.sommier_article_id, poids, colis, valeur]
            );
            await conn.query(
                `UPDATE sommier_article
                 SET poids_apure  = poids_apure  + ?,
                     colis_apure  = colis_apure  + ?,
                     valeur_apure = valeur_apure + ?
                 WHERE id = ?`,
                [poids, colis, valeur, l.sommier_article_id]
            );
        }

        await conn.commit();

        // Recalcul statut hors transaction (lit l'état committé)
        await recomputeSommierStatut(sommier_id);

        res.status(201).json({ id: apurementId });
    } catch (err) {
        await conn.rollback();
        console.error('apurements POST / :', err);
        res.status(500).json({ error: err.sqlMessage || err.message });
    } finally {
        conn.release();
    }
});

/* ─── PUT /:id : modif en-tête uniquement (pas les lignes) ───────────────── */
router.put('/:id', checkPermission('APUREMENTS', 'can_edit'), async (req, res) => {
    try {
        const allowed = ['date_apurement', 'type_sortie', 'reference_sortie', 'observations'];
        const fields = [];
        const params = [];
        for (const k of allowed) {
            if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
        }
        if (!fields.length) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });

        params.push(req.params.id);
        const [r] = await pool.query(
            `UPDATE apurement SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
            params
        );
        if (!r.affectedRows) return res.status(404).json({ error: 'Apurement introuvable' });
        res.json({ updated: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── DELETE /:id : soft delete + retrancher des compteurs ───────────────── */
router.delete('/:id', checkPermission('APUREMENTS', 'can_delete'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const [[apu]] = await conn.query(
            `SELECT id, sommier_id, structur_id FROM apurement WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );
        if (!apu) return res.status(404).json({ error: 'Apurement introuvable' });
        if (!req.is_viewing_all && apu.structur_id !== req.structur_id) {
            return res.status(403).json({ error: 'Accès refusé' });
        }

        await conn.beginTransaction();

        // Retrancher les quantités des compteurs article
        const [lignes] = await conn.query(
            `SELECT sommier_article_id, poids, colis, valeur FROM apurement_ligne WHERE apurement_id = ?`,
            [req.params.id]
        );
        for (const l of lignes) {
            await conn.query(
                `UPDATE sommier_article
                 SET poids_apure  = GREATEST(poids_apure  - ?, 0),
                     colis_apure  = GREATEST(colis_apure  - ?, 0),
                     valeur_apure = GREATEST(valeur_apure - ?, 0)
                 WHERE id = ?`,
                [l.poids, l.colis, l.valeur, l.sommier_article_id]
            );
        }

        await conn.query(`UPDATE apurement SET deleted_at = NOW() WHERE id = ?`, [req.params.id]);
        await conn.commit();

        await recomputeSommierStatut(apu.sommier_id);
        res.json({ deleted: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
