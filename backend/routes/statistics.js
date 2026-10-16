const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/statistics/dashboard
 * Get counts for dossiers, credits, and active team members
 */
router.get('/dashboard', async (req, res) => {
    try {
        const structur_id = req.structur_id;

        // 1. Dossiers counts (exclude soft-deleted: Facturable = -1)
        const [dossierStats] = await pool.query(
            `SELECT
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN IdEtapeDossiers = 7 THEN 1 ELSE 0 END), 0) as closed,
                COALESCE(SUM(CASE WHEN IdEtapeDossiers != 7 THEN 1 ELSE 0 END), 0) as active
             FROM dossiers
             WHERE structur_id = ? AND (Facturable IS NULL OR Facturable != -1)`,
            [structur_id]
        );

        // 2. User/Team count (table is 'Agents')
        const [userStats] = await pool.query(
            "SELECT COUNT(*) as count FROM agents WHERE structur_id = ? AND is_active = 1",
            [structur_id]
        );

        // 3. Pending notes (exclude soft-deleted dossiers)
        const [noteStats] = await pool.query(
            `SELECT COUNT(*) as count
             FROM notesdedetails nd
             JOIN dossiers d ON nd.IDDossiers = d.IDDossiers
             WHERE d.structur_id = ? AND nd.Valide = 0
               AND (d.Facturable IS NULL OR d.Facturable != -1)`,
            [structur_id]
        );

        res.json({
            activeDossiers: Number(dossierStats[0].active) || 0,
            closedDossiers: Number(dossierStats[0].closed) || 0,
            pendingNotes: Number(noteStats[0].count) || 0,
            activeTeam: Number(userStats[0].count) || 0
        });
    } catch (err) {
        console.error('Dashboard statistics error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

module.exports = router;
