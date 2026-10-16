const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/taxes - List all taxes, optionally filtered by NTS
router.get('/', checkPermission('TAXES', 'can_view'), async (req, res) => {
    try {
        const { nts } = req.query;
        let query = 'SELECT * FROM taxes';
        const params = [];

        if (nts) {
            query = `
                SELECT DISTINCT t.*, tx.Taux
                FROM taxes t
                INNER JOIN tarifs tr ON t.CodeTaxe = tr.CodeTaxe
                LEFT JOIN taux tx ON tr.CodeTaux = tx.CodeTaux
                WHERE tr.NTS = ?
            `;
            params.push(nts);
        }

        query += ' ORDER BY CodeTaxe';

        const [taxes] = await pool.query(query, params);
        res.json(taxes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/taxes - Create a new taxe
router.post('/', checkPermission('TAXES', 'can_create'), async (req, res) => {
    try {
        const { CodeTaxe, LibelleTaxe, LibelleTaxeComplet, Base, Niveau } = req.body;
        if (!CodeTaxe || !LibelleTaxe) {
            return res.status(400).json({ error: 'CodeTaxe et LibelleTaxe sont obligatoires' });
        }

        const [existing] = await pool.query('SELECT IDTaxes FROM taxes WHERE CodeTaxe = ?', [CodeTaxe]);
        if (existing.length > 0) {
            return res.status(409).json({ error: `Le code taxe ${CodeTaxe} existe déjà` });
        }

        const [result] = await pool.query(
            'INSERT INTO taxes (CodeTaxe, LibelleTaxe, LibelleTaxeComplet, Base, Niveau, IdAgent) VALUES (?, ?, ?, ?, ?, ?)',
            [CodeTaxe, LibelleTaxe, LibelleTaxeComplet || '', Base || '', Niveau || 1, req.user.id]
        );
        res.status(201).json({ message: 'Taxe créée avec succès', id: result.insertId, CodeTaxe });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/taxes/:id - Update a taxe
router.put('/:id', checkPermission('TAXES', 'can_edit'), async (req, res) => {
    try {
        const { LibelleTaxe, LibelleTaxeComplet, Base, Niveau } = req.body;
        if (!LibelleTaxe) {
            return res.status(400).json({ error: 'LibelleTaxe est obligatoire' });
        }
        const [result] = await pool.query(
            'UPDATE taxes SET LibelleTaxe = ?, LibelleTaxeComplet = ?, Base = ?, Niveau = ? WHERE IDTaxes = ?',
            [LibelleTaxe, LibelleTaxeComplet || '', Base || '', Niveau || 1, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Taxe introuvable' });
        }
        res.json({ message: 'Taxe mise à jour avec succès' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/taxes/:id - Delete a taxe
router.delete('/:id', checkPermission('TAXES', 'can_delete'), async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM taxes WHERE IDTaxes = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Taxe introuvable' });
        }
        res.json({ message: 'Taxe supprimée avec succès' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

