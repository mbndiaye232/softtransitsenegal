const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/types-documents-ot - List all OT document types
router.get('/', checkPermission('CONFIG', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM typesdocumentsot ORDER BY LibelleTypeDocumentsOT');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/types-documents-ot - Create OT document type
router.post('/', checkPermission('CONFIG', 'can_create'), async (req, res) => {
    const { LibelleTypeDocumentsOT, Observations } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO typesdocumentsot (LibelleTypeDocumentsOT, Observations) VALUES (?, ?)',
            [LibelleTypeDocumentsOT, Observations]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/types-documents-ot/:id - Update OT document type
router.put('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { LibelleTypeDocumentsOT, Observations } = req.body;
    try {
        const [result] = await pool.query(
            'UPDATE typesdocumentsot SET LibelleTypeDocumentsOT = ?, Observations = ? WHERE IDTypesDocumentsOT = ?',
            [LibelleTypeDocumentsOT, Observations, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Type introuvable' });
        res.json({ message: 'Type mis à jour' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/types-documents-ot/:id - Delete OT document type
router.delete('/:id', checkPermission('CONFIG', 'can_delete'), async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM typesdocumentsot WHERE IDTypesDocumentsOT = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Type introuvable' });
        res.json({ message: 'Type supprimé' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Impossible de supprimer : probablement utilisé par un ordre de transit." });
    }
});

module.exports = router;
