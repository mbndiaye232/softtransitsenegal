const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/unites-volume
router.get('/', checkPermission('REGIMES', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM `unitesvolume` ORDER BY `LibelleUniteVolume`'
        );

        // Seed defaults if table is empty
        if (rows.length === 0) {
            const defaults = ['m³', 'Litre', 'cm³', 'Gallon'];
            for (const label of defaults) {
                await pool.query(
                    'INSERT INTO unitesvolume (LibelleUniteVolume) VALUES (?) ON CONFLICT DO NOTHING',
                    [label]
                );
            }
            const [seeded] = await pool.query(
                'SELECT * FROM `unitesvolume` ORDER BY `LibelleUniteVolume`'
            );
            return res.json(seeded);
        }

        res.json(rows);
    } catch (error) {
        console.error('Error in GET /api/unites-volume:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/unites-volume
router.post('/', checkPermission('REGIMES', 'can_edit'), async (req, res) => {
    try {
        const { LibelleUniteVolume } = req.body;
        if (!LibelleUniteVolume) {
            return res.status(400).json({ error: 'Libelle is required' });
        }
        const [result] = await pool.query(
            'INSERT INTO `unitesvolume` (`LibelleUniteVolume`) VALUES (?)',
            [LibelleUniteVolume]
        );
        res.status(201).json({ id: result.insertId, message: 'Unité de volume créée' });
    } catch (error) {
        console.error('Error creating volume unit:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/unites-volume/:id
router.put('/:id', checkPermission('REGIMES', 'can_edit'), async (req, res) => {
    try {
        const { LibelleUniteVolume } = req.body;
        await pool.query(
            'UPDATE `unitesvolume` SET `LibelleUniteVolume` = ? WHERE `IDUniteVolume` = ?',
            [LibelleUniteVolume, req.params.id]
        );
        res.json({ message: 'Unité de volume mise à jour' });
    } catch (error) {
        console.error('Error updating volume unit:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/unites-volume/:id
router.delete('/:id', checkPermission('REGIMES', 'can_edit'), async (req, res) => {
    try {
        await pool.query('DELETE FROM `unitesvolume` WHERE `IDUniteVolume` = ?', [req.params.id]);
        res.json({ message: 'Unité de volume supprimée' });
    } catch (error) {
        console.error('Error deleting volume unit:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
