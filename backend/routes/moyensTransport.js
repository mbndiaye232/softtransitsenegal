const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/moyens-transport
 * Get all transport modes with their types and linked tiers
 */
router.get('/', checkPermission('CONFIG', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                mt.*, 
                tmt.LibelleTypeMoyenTransport,
                tr.libtier as NomTier
            FROM moyenstransport mt
            LEFT JOIN typesmoyenstransport tmt ON mt.idtypeMoyensTransport = tmt.IDTypesMoyensTransport
            LEFT JOIN tiers tr ON mt.IDTiers = tr.IDTiers
            ORDER BY mt.LibelleMoyensTransport
        `);
        res.json(rows);
    } catch (err) {
        console.error('Fetch moyens transport error:', err);
        res.status(500).json({ error: 'Failed to fetch transport modes' });
    }
});

/**
 * GET /api/moyens-transport/types
 * Get all transport types (Maritime, Aérien, etc.)
 */
router.get('/types', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM typesmoyenstransport ORDER BY LibelleTypeMoyenTransport');
        res.json(rows);
    } catch (err) {
        console.error('Fetch transport types error:', err);
        res.status(500).json({ error: 'Failed to fetch transport types' });
    }
});

/**
 * POST /api/moyens-transport/types
 * Create a new transport type
 */
router.post('/types', checkPermission('CONFIG', 'can_create'), async (req, res) => {
    const { LibelleTypeMoyenTransport } = req.body;
    if (!LibelleTypeMoyenTransport) {
        return res.status(400).json({ error: 'Le libellé est obligatoire' });
    }
    try {
        const [result] = await pool.query(
            'INSERT INTO typesmoyenstransport (LibelleTypeMoyenTransport) VALUES (?)',
            [LibelleTypeMoyenTransport]
        );
        res.status(201).json({ id: result.insertId, message: 'Type de transport créé avec succès' });
    } catch (err) {
        console.error('Create transport type error:', err);
        res.status(500).json({ error: 'Failed to create transport type' });
    }
});

/**
 * PUT /api/moyens-transport/types/:id
 * Update a transport type
 */
router.put('/types/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { id } = req.params;
    const { LibelleTypeMoyenTransport } = req.body;
    if (!LibelleTypeMoyenTransport) {
        return res.status(400).json({ error: 'Le libellé est obligatoire' });
    }
    try {
        await pool.query(
            'UPDATE typesmoyenstransport SET LibelleTypeMoyenTransport = ? WHERE IDTypesMoyensTransport = ?',
            [LibelleTypeMoyenTransport, id]
        );
        res.json({ message: 'Type de transport mis à jour avec succès' });
    } catch (err) {
        console.error('Update transport type error:', err);
        res.status(500).json({ error: 'Failed to update transport type' });
    }
});

/**
 * DELETE /api/moyens-transport/types/:id
 * Delete a transport type
 */
router.delete('/types/:id', checkPermission('CONFIG', 'can_delete'), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM typesmoyenstransport WHERE IDTypesMoyensTransport = ?', [id]);
        res.json({ message: 'Type de transport supprimé avec succès' });
    } catch (err) {
        console.error('Delete transport type error:', err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'Ce type est utilisé par des moyens de transport existants.' });
        }
        res.status(500).json({ error: 'Failed to delete transport type' });
    }
});

/**
 * POST /api/moyens-transport
 * Create a new transport mode
 */
router.post('/', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { LibelleMoyensTransport, idtypeMoyensTransport, Observations, IDTiers } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO moyenstransport (LibelleMoyensTransport, idtypeMoyensTransport, Observations, IDTiers) VALUES (?, ?, ?, ?)',
            [LibelleMoyensTransport, idtypeMoyensTransport, Observations || null, IDTiers || 0]
        );
        res.status(201).json({
            id: result.insertId,
            message: 'Transport mode created successfully'
        });
    } catch (err) {
        console.error('Create transport mode error:', err);
        res.status(500).json({ error: 'Failed to create transport mode' });
    }
});

/**
 * PUT /api/moyens-transport/:id
 * Update a transport mode
 */
router.put('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { id } = req.params;
    const { LibelleMoyensTransport, idtypeMoyensTransport, Observations, IDTiers } = req.body;
    try {
        await pool.query(
            'UPDATE moyenstransport SET LibelleMoyensTransport = ?, idtypeMoyensTransport = ?, Observations = ?, IDTiers = ? WHERE IDMoyensTransport = ?',
            [LibelleMoyensTransport, idtypeMoyensTransport, Observations || null, IDTiers || 0, id]
        );
        res.json({ message: 'Transport mode updated successfully' });
    } catch (err) {
        console.error('Update transport mode error:', err);
        res.status(500).json({ error: 'Failed to update transport mode' });
    }
});

/**
 * DELETE /api/moyens-transport/:id
 * Delete a transport mode
 */
router.delete('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM moyenstransport WHERE IDMoyensTransport = ?', [id]);
        res.json({ message: 'Transport mode deleted successfully' });
    } catch (err) {
        console.error('Delete transport mode error:', err);
        res.status(500).json({ error: 'Failed to delete transport mode' });
    }
});

module.exports = router;
