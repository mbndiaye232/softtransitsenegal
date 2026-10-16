/**
 * CRUD entrepôts.
 *   GET    /api/entrepots        - liste (filtrée par tenant)
 *   GET    /api/entrepots/:id    - détail
 *   POST   /api/entrepots        - création
 *   PUT    /api/entrepots/:id    - modification
 *   DELETE /api/entrepots/:id    - soft delete
 */
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

router.use(authMiddleware);
router.use(tenantMiddleware);

const SELECT = `e.id, e.structur_id, e.libelle, e.code, e.adresse, e.type_entrepot,
                e.created_at, e.updated_at`;

/* ─── GET / : liste ──────────────────────────────────────────────────────── */
router.get('/', checkPermission('ENTREPOTS', 'can_view'), async (req, res) => {
    try {
        const where  = ['e.deleted_at IS NULL'];
        const params = [];
        if (!req.is_viewing_all) {
            where.push('e.structur_id = ?');
            params.push(req.structur_id);
        }
        const [rows] = await pool.query(
            `SELECT ${SELECT} FROM entrepot e
             WHERE ${where.join(' AND ')}
             ORDER BY e.libelle ASC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('entrepots GET / :', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─── GET /:id ───────────────────────────────────────────────────────────── */
router.get('/:id', checkPermission('ENTREPOTS', 'can_view'), async (req, res) => {
    try {
        const [[row]] = await pool.query(
            `SELECT ${SELECT} FROM entrepot e WHERE e.id = ? AND e.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!row) return res.status(404).json({ error: 'Entrepôt introuvable' });
        if (!req.is_viewing_all && row.structur_id !== req.structur_id) {
            return res.status(403).json({ error: 'Accès refusé' });
        }
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── POST / : création ──────────────────────────────────────────────────── */
router.post('/', checkPermission('ENTREPOTS', 'can_create'), async (req, res) => {
    try {
        const { libelle, code, adresse, type_entrepot } = req.body;
        if (!libelle || !libelle.trim()) {
            return res.status(400).json({ error: 'Libellé requis' });
        }
        const [r] = await pool.query(
            `INSERT INTO entrepot (structur_id, libelle, code, adresse, type_entrepot)
             VALUES (?, ?, ?, ?, ?)`,
            [req.structur_id, libelle.trim(), code || null, adresse || null, type_entrepot || 'REEL']
        );
        res.status(201).json({ id: r.insertId });
    } catch (err) {
        console.error('entrepots POST / :', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─── PUT /:id ───────────────────────────────────────────────────────────── */
router.put('/:id', checkPermission('ENTREPOTS', 'can_edit'), async (req, res) => {
    try {
        const { libelle, code, adresse, type_entrepot } = req.body;
        const fields = [];
        const params = [];
        if (libelle !== undefined)       { fields.push('libelle = ?');       params.push(libelle); }
        if (code !== undefined)          { fields.push('code = ?');          params.push(code || null); }
        if (adresse !== undefined)       { fields.push('adresse = ?');       params.push(adresse); }
        if (type_entrepot !== undefined) { fields.push('type_entrepot = ?'); params.push(type_entrepot); }
        if (!fields.length) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });

        params.push(req.params.id);
        const where = req.is_viewing_all
            ? 'id = ? AND deleted_at IS NULL'
            : 'id = ? AND deleted_at IS NULL AND structur_id = ?';
        if (!req.is_viewing_all) params.push(req.structur_id);

        const [r] = await pool.query(`UPDATE entrepot SET ${fields.join(', ')} WHERE ${where}`, params);
        if (!r.affectedRows) return res.status(404).json({ error: 'Entrepôt introuvable' });
        res.json({ updated: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── DELETE /:id (soft) ─────────────────────────────────────────────────── */
router.delete('/:id', checkPermission('ENTREPOTS', 'can_delete'), async (req, res) => {
    try {
        // Bloquer si entrepôt utilisé par des articles
        const [[{ n }]] = await pool.query(
            `SELECT COUNT(*) AS n FROM sommier_article WHERE entrepot_id = ?`,
            [req.params.id]
        );
        if (n > 0) {
            return res.status(409).json({ error: `Entrepôt utilisé par ${n} article(s). Impossible de supprimer.` });
        }
        const where = req.is_viewing_all
            ? 'id = ? AND deleted_at IS NULL'
            : 'id = ? AND deleted_at IS NULL AND structur_id = ?';
        const params = [req.params.id];
        if (!req.is_viewing_all) params.push(req.structur_id);

        const [r] = await pool.query(`UPDATE entrepot SET deleted_at = NOW() WHERE ${where}`, params);
        if (!r.affectedRows) return res.status(404).json({ error: 'Entrepôt introuvable' });
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
