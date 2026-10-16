const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

console.log('--- LIEUX ROUTES LOADED ---');

/**
 * GET /api/lieux
 * Get places filtered by country and optionally type
 */
router.get('/', async (req, res) => {
    console.log('GET /api/lieux with query:', req.query);
    const { idpays, type } = req.query;

    try {
        let query = 'SELECT * FROM lieux WHERE 1=1';
        const params = [];

        if (idpays) {
            query += ' AND IDPays = ?';
            params.push(idpays);
        }

        if (type) {
            // Type filtering logic: maritime -> Port, aérien -> Aéroport, terrestre -> Gare
            if (type === 'maritime') {
                query += " AND TypeLieu = 'Port'";
            } else if (type === 'aérien') {
                query += " AND (TypeLieu = 'Aéroport' OR TypeLieu = 'AIROPORT')";
            } else if (type === 'terrestre') {
                query += " AND TypeLieu = 'Gare'";
            } else {
                query += " AND TypeLieu = ?";
                params.push(type);
            }
        }

        query += ' ORDER BY NomLieu ASC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Fetch lieux error:', err);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
});

/**
 * POST /api/lieux
 * Create a new location
 */
router.post('/', async (req, res) => {
    try {
        const { NomLieu, TypeLieu, IDPays, Observations } = req.body;
        if (!NomLieu) return res.status(400).json({ error: 'NomLieu is required' });

        const [result] = await pool.query(
            'INSERT INTO lieux (NomLieu, TypeLieu, IDPays, Observations) VALUES (?, ?, ?, ?)',
            [NomLieu, TypeLieu, IDPays, Observations]
        );
        res.status(201).json({ id: result.insertId, message: 'Location created' });
    } catch (error) {
        console.error('Error creating location:', error);
        res.status(500).json({ error: 'Failed to create location' });
    }
});

/**
 * PUT /api/lieux/:id
 * Update a location
 */
router.put('/:id', async (req, res) => {
    try {
        const { NomLieu, TypeLieu, IDPays, Observations } = req.body;
        await pool.query(
            'UPDATE lieux SET NomLieu = ?, TypeLieu = ?, IDPays = ?, Observations = ? WHERE IDLieux = ?',
            [NomLieu, TypeLieu, IDPays, Observations, req.params.id]
        );
        res.json({ message: 'Location updated' });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

/**
 * DELETE /api/lieux/:id
 * Delete a location
 */
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM lieux WHERE IDLieux = ?', [req.params.id]);
        res.json({ message: 'Location deleted' });
    } catch (error) {
        console.error('Error deleting location:', error);
        res.status(500).json({ error: 'Failed to delete location' });
    }
});

module.exports = router;
