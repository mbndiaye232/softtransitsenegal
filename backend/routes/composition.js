const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

console.log('--- COMPOSITION ROUTES LOADED ---');

// ==========================================
// CONTENEURS (TC)
// ==========================================

// GET /api/composition/check-billoflading/:dossierId
// Check if a billoflading record exists for this dossier
router.get('/check-billoflading/:dossierId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT idbl, IDBillOfLading FROM billoflading WHERE idbl = ?',
            [req.params.dossierId]
        );
        if (rows.length > 0) {
            res.json({ exists: true, billoflading: rows[0] });
        } else {
            res.json({ exists: false, billoflading: null });
        }
    } catch (err) {
        console.error('Check billoflading error:', err);
        res.status(500).json({ error: 'Failed to check billoflading' });
    }
});

// GET /api/composition/containers/:dossierId
router.get('/containers/:dossierId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM conteneurbl WHERE idblltalvibooking = ? ORDER BY IDConteneurBL DESC',
            [req.params.dossierId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Fetch containers error:', err);
        res.status(500).json({ error: 'Failed to fetch containers' });
    }
});

// POST /api/composition/containers
router.post('/containers', checkPermission('DOSSIERS', 'can_edit'), async (req, res) => {
    const { idblltalvibooking, NumeroTC, TypeTC, TareTC, DimensionTC, UnitePoids } = req.body;
    try {
        // Verify Bill of Lading exists for this dossier (FK constraint requires it)
        const [blExists] = await pool.query('SELECT idbl FROM billoflading WHERE idbl = ?', [idblltalvibooking]);

        if (blExists.length === 0) {
            return res.status(400).json({
                error: 'BILLOFLADING_REQUIRED',
                message: 'Veuillez d\'abord créer un Titre de Transport pour ce dossier avant d\'ajouter des conteneurs.'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO conteneurbl (idblltalvibooking, NumeroTC, TypeTC, TareTC, DimensionTC, UnitePoids) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [idblltalvibooking, NumeroTC, TypeTC, TareTC || 0, DimensionTC || 0, UnitePoids || 'Kg']
        );
        res.status(201).json({ id: result.insertId, message: 'Container added' });
    } catch (err) {
        console.error('Add container error:', err);
        res.status(500).json({ error: 'Failed to add container' });
    }
});

// PUT /api/composition/containers/:id
router.put('/containers/:id', checkPermission('DOSSIERS', 'can_edit'), async (req, res) => {
    const { NumeroTC, TypeTC, TareTC, DimensionTC, UnitePoids } = req.body;
    try {
        await pool.query(
            `UPDATE conteneurbl SET NumeroTC=?, TypeTC=?, TareTC=?, DimensionTC=?, UnitePoids=? WHERE IDConteneurBL=?`,
            [NumeroTC, TypeTC, TareTC, DimensionTC, UnitePoids, req.params.id]
        );
        res.json({ message: 'Container updated' });
    } catch (err) {
        console.error('Update container error:', err);
        res.status(500).json({ error: 'Failed to update container' });
    }
});

// DELETE /api/composition/containers/:id
router.delete('/containers/:id', checkPermission('DOSSIERS', 'can_delete'), async (req, res) => {
    try {
        await pool.query('DELETE FROM conteneurbl WHERE IDConteneurBL = ?', [req.params.id]);
        res.json({ message: 'Container deleted' });
    } catch (err) {
        console.error('Delete container error:', err);
        res.status(500).json({ error: 'Failed to delete container' });
    }
});

// ==========================================
// CONTENTS OF CONTAINERS
// ==========================================

// GET /api/composition/containers/:containerId/content
router.get('/containers/:containerId/content', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM contenusconteneurs WHERE IDConteneurBL = ?',
            [req.params.containerId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Fetch container content error:', err);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

// POST /api/composition/containers/content
router.post('/containers/content', checkPermission('DOSSIERS', 'can_edit'), async (req, res) => {
    const { IDConteneurBL, ObjetConteneur, Quantite, PoidsTotalNet, Unite } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO contenusconteneurs (IDConteneurBL, ObjetConteneur, Quantite, PoidsTotalNet, Unite) 
             VALUES (?, ?, ?, ?, ?)`,
            [IDConteneurBL, ObjetConteneur, Quantite || 0, PoidsTotalNet || 0, Unite || 'Kg']
        );
        res.status(201).json({ id: result.insertId, message: 'Content added' });
    } catch (err) {
        console.error('Add content error:', err);
        res.status(500).json({ error: 'Failed to add content' });
    }
});

// DELETE /api/composition/containers/content/:id
router.delete('/containers/content/:id', checkPermission('DOSSIERS', 'can_delete'), async (req, res) => {
    try {
        await pool.query('DELETE FROM contenusconteneurs WHERE IDContenusConteneurs = ?', [req.params.id]);
        res.json({ message: 'Content deleted' });
    } catch (err) {
        console.error('Delete content error:', err);
        res.status(500).json({ error: 'Failed to delete content' });
    }
});

// ==========================================
// GROUPAGE / CONVENTIONNEL
// ==========================================

// GET /api/composition/groupage/:dossierId
router.get('/groupage/:dossierId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM groupage WHERE idblltalvibooking = ? ORDER BY IDGroupage DESC',
            [req.params.dossierId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Fetch groupage error:', err);
        res.status(500).json({ error: 'Failed to fetch groupage' });
    }
});

// POST /api/composition/groupage
router.post('/groupage', checkPermission('DOSSIERS', 'can_edit'), async (req, res) => {
    const { idblltalvibooking, NatureEtQuantiteDesMarchandises, PoidsTaxation, UnitePoids, TarifMontant, Total } = req.body;
    try {
        // Verify Bill of Lading exists for this dossier (FK constraint requires it)
        const [blExists] = await pool.query('SELECT idbl FROM billoflading WHERE idbl = ?', [idblltalvibooking]);

        if (blExists.length === 0) {
            return res.status(400).json({
                error: 'BILLOFLADING_REQUIRED',
                message: 'Veuillez d\'abord créer un Titre de Transport pour ce dossier avant d\'ajouter des articles de groupage.'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO groupage (idblltalvibooking, NatureEtQuantiteDesMarchandises, PoidsTaxation, UnitePoids, TarifMontant, Total) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [idblltalvibooking, NatureEtQuantiteDesMarchandises, PoidsTaxation || 0, UnitePoids || 'Kg', TarifMontant || 0, Total || 0]
        );
        res.status(201).json({ id: result.insertId, message: 'Groupage item added' });
    } catch (err) {
        console.error('Add groupage error:', err);
        res.status(500).json({ error: 'Failed to add groupage item' });
    }
});

// DELETE /api/composition/groupage/:id
router.delete('/groupage/:id', checkPermission('DOSSIERS', 'can_delete'), async (req, res) => {
    try {
        await pool.query('DELETE FROM groupage WHERE IDGroupage = ?', [req.params.id]);
        res.json({ message: 'Groupage item deleted' });
    } catch (err) {
        console.error('Delete groupage error:', err);
        res.status(500).json({ error: 'Failed to delete groupage item' });
    }
});

module.exports = router;
