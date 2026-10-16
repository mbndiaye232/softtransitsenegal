const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/incoterms - List all incoterms
router.get('/', checkPermission('CONFIG', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM incoterm ORDER BY CodeIncoterm');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/incoterms - Create incoterm
router.post('/', checkPermission('CONFIG', 'can_create'), async (req, res) => {
    const { CodeIncoterm, Observations } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO incoterm (CodeIncoterm, Observations) VALUES (?, ?)',
            [CodeIncoterm, Observations]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/incoterms/:id - Update incoterm
router.put('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { CodeIncoterm, Observations } = req.body;
    try {
        const [result] = await pool.query(
            'UPDATE incoterm SET CodeIncoterm = ?, Observations = ? WHERE IDIncoterm = ?',
            [CodeIncoterm, Observations, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Incoterm introuvable' });
        res.json({ message: 'Incoterm mis à jour' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/incoterms/:id - Delete incoterm
router.delete('/:id', checkPermission('CONFIG', 'can_delete'), async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM incoterm WHERE IDIncoterm = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Incoterm introuvable' });
        res.json({ message: 'Incoterm supprimé' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Impossible de supprimer : probablement utilisé par un ordre de transit." });
    }
});

module.exports = router;
