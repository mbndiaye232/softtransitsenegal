const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/regimes - List all customs regimes
router.get('/', checkPermission('REGIMES', 'can_view'), async (req, res) => {
    try {
        const [regimes] = await pool.query(
            'SELECT * FROM regimedeclaration ORDER BY CodeRegimeDeclaration'
        );
        res.json(regimes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/regimes
 * Create a new customs regime
 */
router.post('/', checkPermission('REGIMES', 'can_edit'), async (req, res) => {
    try {
        const { CodeRegimeDeclaration, LibelleRegimeDeclaration, Observations } = req.body;
        if (!CodeRegimeDeclaration || !LibelleRegimeDeclaration) {
            return res.status(400).json({ error: 'Code and Libelle are required' });
        }

        const [result] = await pool.query(
            'INSERT INTO regimedeclaration (CodeRegimeDeclaration, LibelleRegimeDeclaration, Observations) VALUES (?, ?, ?)',
            [CodeRegimeDeclaration, LibelleRegimeDeclaration, Observations]
        );
        res.status(201).json({ id: result.insertId, message: 'Regime created' });
    } catch (error) {
        console.error('Error creating regime:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PUT /api/regimes/:id
 * Update a customs regime
 */
router.put('/:id', checkPermission('REGIMES', 'can_edit'), async (req, res) => {
    try {
        const { CodeRegimeDeclaration, LibelleRegimeDeclaration, Observations } = req.body;
        await pool.query(
            'UPDATE regimedeclaration SET CodeRegimeDeclaration = ?, LibelleRegimeDeclaration = ?, Observations = ? WHERE IDRegimeDeclaration = ?',
            [CodeRegimeDeclaration, LibelleRegimeDeclaration, Observations, req.params.id]
        );
        res.json({ message: 'Regime updated' });
    } catch (error) {
        console.error('Error updating regime:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/regimes/:id
 * Delete a customs regime
 */
router.delete('/:id', checkPermission('REGIMES', 'can_edit'), async (req, res) => {
    try {
        await pool.query('DELETE FROM regimedeclaration WHERE IDRegimeDeclaration = ?', [req.params.id]);
        res.json({ message: 'Regime deleted' });
    } catch (error) {
        console.error('Error deleting regime:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
