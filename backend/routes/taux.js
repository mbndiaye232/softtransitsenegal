const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/taux - List all taux
router.get('/', checkPermission('TAXES', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM taux ORDER BY CodeTaux');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/taux - Create a new taux
router.post('/', checkPermission('TAXES', 'can_create'), async (req, res) => {
    try {
        const { CodeTaux, Taux } = req.body;
        if (!CodeTaux || Taux === undefined || Taux === null) {
            return res.status(400).json({ error: 'CodeTaux et Taux sont obligatoires' });
        }

        // Check if CodeTaux already exists
        const [existing] = await pool.query('SELECT IDTaux FROM taux WHERE CodeTaux = ?', [CodeTaux]);
        if (existing.length > 0) {
            return res.status(409).json({ error: `Le code taux ${CodeTaux} existe déjà` });
        }

        const [result] = await pool.query(
            'INSERT INTO taux (CodeTaux, Taux, IdAgent) VALUES (?, ?, ?)',
            [CodeTaux, parseFloat(Taux), req.user.id]
        );
        res.status(201).json({ message: 'Taux créé avec succès', id: result.insertId, CodeTaux, Taux });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/taux/:id - Update a taux
router.put('/:id', checkPermission('TAXES', 'can_edit'), async (req, res) => {
    try {
        const { Taux } = req.body;
        if (Taux === undefined || Taux === null) {
            return res.status(400).json({ error: 'Taux est obligatoire' });
        }
        const [result] = await pool.query(
            'UPDATE taux SET Taux = ? WHERE IDTaux = ?',
            [parseFloat(Taux), req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Taux introuvable' });
        }
        res.json({ message: 'Taux mis à jour avec succès' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/taux/:id - Delete a taux
router.delete('/:id', checkPermission('TAXES', 'can_delete'), async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM taux WHERE IDTaux = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Taux introuvable' });
        }
        res.json({ message: 'Taux supprimé avec succès' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
