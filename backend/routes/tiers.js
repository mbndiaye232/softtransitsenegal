const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/tiers
 * List all tiers
 */
router.get('/', checkPermission('TIERS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT 
                t.*,
                s.NomSociete as structur_name,
                st.libelle as statut_label,
                acts.activity_ids,
                acts.activity_labels
            FROM tiers t
            JOIN structur s ON t.structur_id = s.IDSociete
            LEFT JOIN statuts st ON t.IDStatuts = st.IDStatuts
            LEFT JOIN (
                SELECT ta.id_tier, 
                       string_agg(ta.id_activite::text, ',') as activity_ids,
                       string_agg(a.libelle, ',') as activity_labels
                FROM tier_activites ta
                JOIN activites a ON ta.id_activite = a.id_activite
                GROUP BY ta.id_tier
            ) acts ON t.IDTiers = acts.id_tier
        `;
        let params = [];

        if (!req.is_viewing_all) {
            query += ' WHERE t.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' ORDER BY t.libtier';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Get tiers error:', error);
        res.status(500).json({ error: 'Failed to fetch tiers' });
    }
});

/**
 * GET /api/tiers/:id
 * Get a specific tier
 */
router.get('/:id', checkPermission('TIERS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT * FROM tiers WHERE IDTiers = ?
        `;
        let params = [req.params.id];

        if (!req.is_viewing_all) {
            query += ' AND structur_id = ?';
            params.push(req.structur_id);
        }

        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Tier not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Get tier error:', error);
        res.status(500).json({ error: 'Failed to fetch tier' });
    }
});

/**
 * POST /api/tiers
 * Create a new tier
 */
router.post('/', checkPermission('TIERS', 'can_create'), async (req, res) => {
    try {
        const {
            libtier,
            adresseTiers,
            TelTiers,
            CelTiers,
            EmailTiers,
            NINEATiers,
            SiteWeb,
            IDStatuts,
            Observations,
            activityIds // Array of IDs
        } = req.body;

        if (!libtier) {
            return res.status(400).json({ error: 'Le libellé est requis' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [result] = await connection.query(
                `INSERT INTO tiers (
                    structur_id, libtier, adresseTiers, TelTiers, CelTiers, 
                    EmailTiers, NINEATiers, SiteWeb, IDStatuts, Observations,
                    SaisiLe, IdAgentSaisi
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
                [
                    req.structur_id,
                    libtier,
                    adresseTiers || null,
                    TelTiers || null,
                    CelTiers || null,
                    EmailTiers || null,
                    NINEATiers || null,
                    SiteWeb || null,
                    IDStatuts || null,
                    Observations || null,
                    req.user.id
                ]
            );

            const tierId = result.insertId;

            // Save activities
            if (activityIds && Array.isArray(activityIds)) {
                const activityValues = activityIds.map(activityId => [tierId, activityId]);
                if (activityValues.length > 0) {
                    await connection.query(
                        'INSERT INTO tier_activites (id_tier, id_activite) VALUES ?',
                        [activityValues]
                    );
                }
            }

            await auditService.log({
                agent_id: req.user.id,
                structur_id: req.user.structur_id,
                action: 'CREATE',
                resource_type: 'TIER',
                resource_id: tierId,
                details: { name: libtier },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });

            await connection.commit();
            res.status(201).json({
                id: tierId,
                message: 'Tier créé avec succès'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Create tier error:', error);
        res.status(500).json({ error: 'Failed to create tier' });
    }
});

/**
 * PUT /api/tiers/:id
 * Update a tier
 */
router.put('/:id', checkPermission('TIERS', 'can_edit'), async (req, res) => {
    try {
        const {
            libtier,
            adresseTiers,
            TelTiers,
            CelTiers,
            EmailTiers,
            NINEATiers,
            SiteWeb,
            IDStatuts,
            Observations,
            activityIds // Array of IDs
        } = req.body;

        // Verify existence and ownership
        let checkQuery = 'SELECT IDTiers FROM tiers WHERE IDTiers = ?';
        let checkParams = [req.params.id];
        if (!req.is_viewing_all) {
            checkQuery += ' AND structur_id = ?';
            checkParams.push(req.structur_id);
        }
        const [existing] = await pool.query(checkQuery, checkParams);

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Tier not found' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            await connection.query(
                `UPDATE tiers SET 
                    libtier = ?, adresseTiers = ?, TelTiers = ?, CelTiers = ?, 
                    EmailTiers = ?, NINEATiers = ?, SiteWeb = ?, IDStatuts = ?, 
                    Observations = ?, Modifiele = NOW(), idagentmodification = ?
                WHERE IDTiers = ?`,
                [
                    libtier,
                    adresseTiers || null,
                    TelTiers || null,
                    CelTiers || null,
                    EmailTiers || null,
                    NINEATiers || null,
                    SiteWeb || null,
                    IDStatuts || null,
                    Observations || null,
                    req.user.id,
                    req.params.id
                ]
            );

            // Update activities: Delete and Re-insert
            await connection.query('DELETE FROM tier_activites WHERE id_tier = ?', [req.params.id]);

            if (activityIds && Array.isArray(activityIds)) {
                const activityValues = activityIds.map(activityId => [req.params.id, activityId]);
                if (activityValues.length > 0) {
                    await connection.query(
                        'INSERT INTO tier_activites (id_tier, id_activite) VALUES ?',
                        [activityValues]
                    );
                }
            }

            await auditService.log({
                agent_id: req.user.id,
                structur_id: req.user.structur_id,
                action: 'UPDATE',
                resource_type: 'TIER',
                resource_id: req.params.id,
                details: { name: libtier },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });

            await connection.commit();
            res.json({ message: 'Tier mis à jour avec succès' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Update tier error:', error);
        res.status(500).json({ error: 'Failed to update tier' });
    }
});

/**
 * DELETE /api/tiers/:id
 * Delete (or deactivate) a tier
 */
router.delete('/:id', checkPermission('TIERS', 'can_delete'), async (req, res) => {
    try {
        // Verify existence and ownership
        let checkQuery = 'SELECT IDTiers FROM tiers WHERE IDTiers = ?';
        let checkParams = [req.params.id];
        if (!req.is_viewing_all) {
            checkQuery += ' AND structur_id = ?';
            checkParams.push(req.structur_id);
        }
        const [existing] = await pool.query(checkQuery, checkParams);

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Tier not found' });
        }

        // Soft delete or Hard delete? Most logic uses 'is_active' or simple DELETE if no foreign keys block it.
        // The schema inspection didn't show 'is_active' explicitly in the CREATE statement but inspect_tiers.js didn't show all columns clearly for key/default. 
        // Based on the inspect output: 
        // { Field: 'is_active', ... } WAS NOT THERE. 
        // WAIT. I should check the previous output carefully.

        // Output from Step 534:
        // [ { Field: 'IDTiers', ... }, { Field: 'structur_id', ... }, { Field: 'libtier', ... }, ... ]
        // It ends with 'SiteWeb'. NO 'is_active'.

        // I need to add 'is_active' column if I want soft delete, OR just do DELETE.
        // Given existing tables usually have no is_active (except Agents/Users usually), I will assume standard DELETE for now to avoid schema changes unless requested.
        // BUT, user operations usually require history. 
        // I will use DELETE for now, if it fails due to foreign key, I'll catch it.

        await pool.query('DELETE FROM tiers WHERE IDTiers = ?', [req.params.id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'TIER',
            resource_id: req.params.id,
            details: 'Tier deleted',
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Tier deleted successfully' });

    } catch (error) {
        console.error('Delete tier error:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'Ce tiers est utilisé dans des dossiers et ne peut être supprimé.' });
        }
        res.status(500).json({ error: 'Failed to delete tier' });
    }
});

module.exports = router;
