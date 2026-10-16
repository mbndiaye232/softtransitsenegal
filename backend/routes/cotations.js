// backend/routes/cotations.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/cotations/dashboard
 * Get non-closed dossiers with their current assignment status
 */
router.get('/dashboard', checkPermission('COTATIONS', 'can_view'), async (req, res) => {
    try {
        const query = `
            SELECT 
                d.IDDossiers as id,
                d.CodeDossier as code,
                d.CodeDossierCourt as shortCode,
                d.Libelle as label,
                cl.NomRS as clientName,
                cl.NINEA as clientNinea,
                dc.id as active_cotation_id,
                dc.agent_id as active_agent_id,
                a.NomAgent as active_agent_name,
                dc.date_effet as active_date_effet,
                stats.total_colis,
                stats.total_poids,
                stats.orbus_number
            FROM dossiers d
            LEFT JOIN clients cl ON d.IDCLIENTS = cl.IDCLIENTS
            LEFT JOIN dossier_cotations dc ON d.IDDossiers = dc.dossier_id AND dc.is_active = 1
            LEFT JOIN agents a ON dc.agent_id = a.IDAgents
            LEFT JOIN (
                SELECT 
                    nd.IDDossiers,
                    SUM(art.NBCOLIS) as total_colis,
                    SUM(art.BRUT) as total_poids,
                    MAX(nd.ORBUS) as orbus_number
                FROM notesdedetails nd
                LEFT JOIN articles art ON nd.IDNotesDeDetails = art.IDNotesDeDetails
                GROUP BY nd.IDDossiers
            ) stats ON d.IDDossiers = stats.IDDossiers
            WHERE d.structur_id = ?
            AND d.IdEtapeDossiers != 7 -- Not closed
            ORDER BY d.DateOuvertureDossiers DESC
        `;
        const [rows] = await pool.query(query, [req.structur_id]);
        res.json(rows);
    } catch (err) {
        console.error('Cotation dashboard error:', err);
        res.status(500).json({ error: 'Failed to fetch cotation dashboard data' });
    }
});

/**
 * GET /api/cotations/dossier/:id
 * List all cotations (history) for a specific dossier
 */
router.get('/dossier/:id', checkPermission('COTATIONS', 'can_view'), async (req, res) => {
    try {
        const query = `
            SELECT c.*, a.NomAgent as agent_name
            FROM dossier_cotations c
            JOIN agents a ON c.agent_id = a.IDAgents
            WHERE c.dossier_id = ?
            ORDER BY c.date_effet DESC, c.created_at DESC
        `;
        const [rows] = await pool.query(query, [req.params.id]);
        res.json(rows);
    } catch (err) {
        console.error('List cotations error:', err);
        res.status(500).json({ error: 'Failed to fetch cotations' });
    }
});

/**
 * POST /api/cotations
 * Assign or reassign an agent to a dossier
 */
router.post('/', checkPermission('COTATIONS', 'can_create'), async (req, res) => {
    const { dossier_id, agent_id, date_effet, motif } = req.body;

    if (!dossier_id || !agent_id || !date_effet) {
        return res.status(400).json({ error: 'Dossier, agent and effective date are required' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if there's an active cotation for this dossier
        const [active] = await connection.query(
            'SELECT * FROM dossier_cotations WHERE dossier_id = ? AND is_active = 1',
            [dossier_id]
        );

        if (active.length > 0) {
            const current = active[0];
            // If it's the same agent, maybe just update date_effet? 
            // Better to follow the "reassign" logic which creates history.

            // 2. Close the active cotation
            await connection.query(
                'UPDATE dossier_cotations SET is_active = 0, date_fin = ?, motif_fin = ? WHERE id = ?',
                [date_effet, motif || 'Réaffectation', current.id]
            );
        }

        // 3. Create the new active cotation
        const [result] = await connection.query(
            'INSERT INTO dossier_cotations (dossier_id, agent_id, date_effet, is_active) VALUES (?, ?, ?, 1)',
            [dossier_id, agent_id, date_effet]
        );

        await connection.commit();

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'COTATION',
            resource_id: result.insertId,
            details: { dossier_id, agent_id, date_effet, motif },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({ id: result.insertId, message: 'Cotation assigned successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('Assign cotation error:', err);
        res.status(500).json({ error: 'Failed to assign cotation' });
    } finally {
        connection.release();
    }
});

module.exports = router;
