const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/groupes
 * List all groups for the current company
 */
router.get('/', checkPermission('AGENTS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT 
                g.*,
                COUNT(a.IDAgents) as user_count
            FROM groupes g
            LEFT JOIN agents a ON g.IDGroupes = a.IDGroupes AND a.is_active = 1
            WHERE g.structur_id = ? AND g.is_active = 1
            GROUP BY g.IDGroupes
            ORDER BY g.LibelleGroupe`,
            [req.structur_id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

/**
 * GET /api/groupes/:id
 * Get a specific group
 */
router.get('/:id', checkPermission('AGENTS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM groupes WHERE IDGroupes = ? AND structur_id = ?',
            [req.params.id, req.structur_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ error: 'Failed to fetch group' });
    }
});

/**
 * POST /api/groupes
 * Create a new group
 */
router.post('/', checkPermission('AGENTS', 'can_create'), async (req, res) => {
    try {
        const { LibelleGroupe, Observations } = req.body;

        if (!LibelleGroupe) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        // Check if group name already exists for this company
        const [existing] = await pool.query(
            'SELECT IDGroupes FROM groupes WHERE LibelleGroupe = ? AND structur_id = ? AND is_active = 1',
            [LibelleGroupe, req.structur_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'A group with this name already exists' });
        }

        const [result] = await pool.query(
            'INSERT INTO groupes (structur_id, LibelleGroupe, Observations, is_active) VALUES (?, ?, ?, 1)',
            [req.structur_id, LibelleGroupe, Observations || null]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'GROUP',
            resource_id: result.insertId,
            details: { LibelleGroupe },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({
            id: result.insertId,
            message: 'Group created successfully'
        });

    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

/**
 * PUT /api/groupes/:id
 * Update a group
 */
router.put('/:id', checkPermission('AGENTS', 'can_edit'), async (req, res) => {
    try {
        const { LibelleGroupe, Observations } = req.body;

        if (!LibelleGroupe) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        // Check if group exists and belongs to company
        const [existing] = await pool.query(
            'SELECT IDGroupes FROM groupes WHERE IDGroupes = ? AND structur_id = ?',
            [req.params.id, req.structur_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if new name conflicts with another group
        const [conflict] = await pool.query(
            'SELECT IDGroupes FROM groupes WHERE LibelleGroupe = ? AND structur_id = ? AND IDGroupes != ? AND is_active = 1',
            [LibelleGroupe, req.structur_id, req.params.id]
        );

        if (conflict.length > 0) {
            return res.status(400).json({ error: 'A group with this name already exists' });
        }

        await pool.query(
            'UPDATE groupes SET LibelleGroupe = ?, Observations = ? WHERE IDGroupes = ?',
            [LibelleGroupe, Observations || null, req.params.id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'GROUP',
            resource_id: req.params.id,
            details: { LibelleGroupe },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Group updated successfully' });

    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({ error: 'Failed to update group' });
    }
});

/**
 * DELETE /api/groupes/:id
 * Delete a group (soft delete)
 */
router.delete('/:id', checkPermission('AGENTS', 'can_delete'), async (req, res) => {
    try {
        const [existing] = await pool.query(
            'SELECT IDGroupes FROM groupes WHERE IDGroupes = ? AND structur_id = ?',
            [req.params.id, req.structur_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const [users] = await pool.query(
            'SELECT COUNT(*) as count FROM agents WHERE IDGroupes = ? AND is_active = 1',
            [req.params.id]
        );

        if (users[0].count > 0) {
            return res.status(400).json({
                error: `Cannot delete group: ${users[0].count} active user(s) are assigned to this group`
            });
        }

        await pool.query(
            'UPDATE groupes SET is_active = 0 WHERE IDGroupes = ?',
            [req.params.id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'GROUP',
            resource_id: req.params.id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Group deleted successfully' });

    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
});

module.exports = router;
