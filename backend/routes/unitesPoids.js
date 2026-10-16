const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/unites-poids - List all weight units
router.get('/', checkPermission('REGIMES', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM unitespoids ORDER BY LibelleUnitePoids'
        );

        // If empty, insert defaults
        if (rows.length === 0) {
            await pool.query("INSERT INTO unitespoids (LibelleUnitePoids) VALUES ('Kg'), ('Tonne')");
            const [newRows] = await pool.query('SELECT * FROM unitespoids ORDER BY LibelleUnitePoids');
            return res.json(newRows);
        }

        res.json(rows);
    } catch (error) {
        console.error('Error in GET /api/unites-poids:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/unites-poids - Create a new weight unit
router.post('/', checkPermission('REGIMES', 'can_edit'), async (req, res) => {
    try {
        const { LibelleUnitePoids } = req.body;
        if (!LibelleUnitePoids) {
            return res.status(400).json({ error: 'Libelle is required' });
        }

        const [result] = await pool.query(
            'INSERT INTO unitespoids (LibelleUnitePoids) VALUES (?)',
            [LibelleUnitePoids]
        );
        res.status(201).json({ id: result.insertId, message: 'Unité de poids créée' });
    } catch (error) {
        console.error('Error creating weight unit:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/unites-poids/:id - Update a weight unit
router.put('/:id', checkPermission('REGIMES', 'can_edit'), async (req, res) => {
    try {
        const { LibelleUnitePoids } = req.body;
        await pool.query(
            'UPDATE unitespoids SET LibelleUnitePoids = ? WHERE IDUnitePoids = ?',
            [LibelleUnitePoids, req.params.id]
        );
        res.json({ message: 'Unité de poids mise à jour' });
    } catch (error) {
        console.error('Error updating weight unit:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/unites-poids/:id - Delete a weight unit
router.delete('/:id', checkPermission('REGIMES', 'can_edit'), async (req, res) => {
    try {
        await pool.query('DELETE FROM unitespoids WHERE IDUnitePoids = ?', [req.params.id]);
        res.json({ message: 'Unité de poids supprimée' });
    } catch (error) {
        console.error('Error deleting weight unit:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
