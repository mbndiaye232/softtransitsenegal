const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/types-documents - List all document types
router.get('/', checkPermission('CONFIG', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT IDTypesDocuments as id, LibelleTypeDocument as label FROM typesdocuments ORDER BY LibelleTypeDocument');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/types-documents - Create document type
router.post('/', checkPermission('CONFIG', 'can_create'), async (req, res) => {
    const { label } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO typesdocuments (LibelleTypeDocument) VALUES (?)',
            [label]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/types-documents/:id - Update document type
router.put('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { label } = req.body;
    try {
        const [result] = await pool.query(
            'UPDATE typesdocuments SET LibelleTypeDocument = ? WHERE IDTypesDocuments = ?',
            [label, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Type not found' });
        res.json({ message: 'Type updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/types-documents/:id - Delete document type
router.delete('/:id', checkPermission('CONFIG', 'can_delete'), async (req, res) => {
    try {
        // Optionnel : vérifier si des documents utilisent ce type avant suppression
        const [docs] = await pool.query('SELECT 1 FROM documents WHERE IDTypesDocuments = ? LIMIT 1', [req.params.id]);
        if (docs.length > 0) {
            return res.status(400).json({ error: 'Ce type est utilisé par des documents existants et ne peut être supprimé.' });
        }

        const [result] = await pool.query('DELETE FROM typesdocuments WHERE IDTypesDocuments = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Type not found' });
        res.json({ message: 'Type deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
