const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/devises
 * List all currencies
 */
router.get('/', checkPermission('FINANCES', 'can_view'), async (req, res) => {
    try {
        const [devises] = await pool.query(
            'SELECT IDDevises, libelle, Symbole, TauxChangeDeviseCFA, est_reference FROM devises ORDER BY libelle'
        );
        res.json(devises);
    } catch (error) {
        console.error('Error fetching currencies:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/devises
 * Create a new currency
 */
router.post('/', checkPermission('FINANCES', 'can_create'), async (req, res) => {
    try {
        const { libelle, Symbole, TauxChangeDeviseCFA } = req.body;

        if (!libelle || !Symbole) {
            return res.status(400).json({ error: 'Le libellé et le symbole sont obligatoires' });
        }

        const [result] = await pool.query(
            'INSERT INTO devises (libelle, Symbole, TauxChangeDeviseCFA, IdAgent) VALUES (?, ?, ?, ?)',
            [libelle, Symbole, TauxChangeDeviseCFA || 0, req.user.id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'DEVISE',
            resource_id: result.insertId,
            details: { libelle, Symbole },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({
            IDDevises: result.insertId,
            message: 'Devise créée avec succès'
        });
    } catch (error) {
        console.error('Error creating currency:', error);
        res.status(500).json({ error: 'Failed to create currency' });
    }
});

/**
 * PUT /api/devises/:id
 * Update an existing currency
 * Le taux de la devise de référence est toujours forcé à 1 (elle ne se
 * modifie qu'en changeant quelle devise est la référence, voir set-reference).
 */
router.put('/:id', checkPermission('FINANCES', 'can_edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { libelle, Symbole, TauxChangeDeviseCFA } = req.body;

        if (!libelle || !Symbole) {
            return res.status(400).json({ error: 'Le libellé et le symbole sont obligatoires' });
        }

        const [[current]] = await pool.query('SELECT est_reference FROM devises WHERE IDDevises = ?', [id]);
        if (!current) return res.status(404).json({ error: 'Devise introuvable' });
        const taux = current.est_reference ? 1 : (TauxChangeDeviseCFA || 0);

        await pool.query(
            'UPDATE devises SET libelle = ?, Symbole = ?, TauxChangeDeviseCFA = ?, IdAgent = ? WHERE IDDevises = ?',
            [libelle, Symbole, taux, req.user.id, id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'DEVISE',
            resource_id: id,
            details: { libelle, Symbole },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Devise mise à jour avec succès' });
    } catch (error) {
        console.error('Error updating currency:', error);
        res.status(500).json({ error: 'Failed to update currency' });
    }
});

/**
 * PUT /api/devises/:id/set-reference
 * Fait de cette devise la nouvelle devise de référence (taux = 1) et
 * recalcule le taux de toutes les autres devises (y compris l'ancienne
 * référence) pour qu'elles restent cohérentes entre elles.
 *
 * Ex : Dollar=2310,7 FC et on choisit Dollar comme référence
 *   -> Dollar devient 1, Franc Congolais devient 1/2310,7, Euro devient
 *      (ancien taux Euro)/2310,7, etc.
 */
router.put('/:id/set-reference', checkPermission('FINANCES', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;

        await connection.beginTransaction();

        const [[target]] = await connection.query(
            'SELECT IDDevises, TauxChangeDeviseCFA, est_reference FROM devises WHERE IDDevises = ? FOR UPDATE', [id]
        );
        if (!target) {
            await connection.rollback();
            return res.status(404).json({ error: 'Devise introuvable' });
        }
        if (target.est_reference) {
            await connection.rollback();
            return res.json({ message: 'Cette devise est déjà la référence' });
        }

        const facteur = parseFloat(target.TauxChangeDeviseCFA);
        if (!facteur || facteur <= 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Cette devise doit avoir un taux de change renseigné avant de devenir la référence' });
        }

        // Recalcule tous les taux relativement à la nouvelle référence
        // (inclut l'ancienne référence, qui passe de 1 à 1/facteur)
        await connection.query(
            'UPDATE devises SET TauxChangeDeviseCFA = TauxChangeDeviseCFA / ? WHERE IDDevises != ?',
            [facteur, id]
        );
        await connection.query('UPDATE devises SET est_reference = false WHERE est_reference = true');
        await connection.query('UPDATE devises SET TauxChangeDeviseCFA = 1, est_reference = true, IdAgent = ? WHERE IDDevises = ?', [req.user.id, id]);

        await connection.commit();

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'DEVISE',
            resource_id: id,
            details: { set_reference: true, facteur },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        const [devises] = await pool.query('SELECT IDDevises, libelle, Symbole, TauxChangeDeviseCFA, est_reference FROM devises ORDER BY libelle');
        res.json({ message: 'Devise de référence mise à jour, taux recalculés', devises });
    } catch (error) {
        await connection.rollback();
        console.error('Error setting reference currency:', error);
        res.status(500).json({ error: 'Failed to set reference currency' });
    } finally {
        connection.release();
    }
});

/**
 * DELETE /api/devises/:id
 * Delete a currency
 */
router.delete('/:id', checkPermission('FINANCES', 'can_delete'), async (req, res) => {
    try {
        const { id } = req.params;

        const [[current]] = await pool.query('SELECT est_reference FROM devises WHERE IDDevises = ?', [id]);
        if (current?.est_reference) {
            return res.status(400).json({ error: "Impossible de supprimer la devise de référence. Définissez d'abord une autre devise comme référence." });
        }

        await pool.query('DELETE FROM devises WHERE IDDevises = ?', [id]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'DEVISE',
            resource_id: id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Devise supprimée avec succès' });
    } catch (error) {
        console.error('Error deleting currency:', error);
        res.status(500).json({ error: 'Impossible de supprimer cette devise. Elle est probablement liée à d’autres enregistrements.' });
    }
});

module.exports = router;
