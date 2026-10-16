const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/tarifs - List all tarifs with joins (paginated)
router.get('/', checkPermission('TAXES', 'can_view'), async (req, res) => {
    try {
        const { nts, page = 1, limit = 50, search = '' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let query = `
            SELECT 
                tar.IDTarifs,
                tar.NTS,
                tar.CodeTaux,
                tar.CodeTaxe,
                tar.IDTaux,
                tar.IDTaxes,
                p.Libelle as LibelleProduit,
                tx.LibelleTaxe,
                tx.LibelleTaxeComplet,
                tx.Base,
                tx.Niveau,
                ta.Taux
            FROM tarifs tar
            LEFT JOIN produits p ON tar.NTS = p.NTS
            LEFT JOIN taxes tx ON tar.CodeTaxe = tx.CodeTaxe
            LEFT JOIN taux ta ON tar.CodeTaux = ta.CodeTaux
        `;
        
        let countQuery = `SELECT COUNT(*) as total FROM tarifs tar LEFT JOIN produits p ON tar.NTS = p.NTS`;
        
        const params = [];
        const countParams = [];
        const conditions = [];

        if (nts) {
            conditions.push('tar.NTS = ?');
            params.push(nts);
            countParams.push(nts);
        }

        if (search) {
            const searchTerm = `%${search}%`;
            conditions.push('(tar.NTS LIKE ? OR p.Libelle LIKE ? OR tar.CodeTaxe LIKE ?)');
            params.push(searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        query += ' ORDER BY tar.NTS, tar.CodeTaxe LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await pool.query(query, params);
        const [totalRows] = await pool.query(countQuery, countParams);

        res.json({
            data: rows,
            total: totalRows[0].total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/tarifs - Create a new tarif (association NTS + Taxe + Taux)
router.post('/', checkPermission('TAXES', 'can_create'), async (req, res) => {
    try {
        const { NTS, CodeTaxe, CodeTaux } = req.body;
        if (!NTS || !CodeTaxe || !CodeTaux) {
            return res.status(400).json({ error: 'NTS, CodeTaxe et CodeTaux sont obligatoires' });
        }

        // Check for duplicate
        const [existing] = await pool.query(
            'SELECT IDTarifs FROM tarifs WHERE NTS = ? AND CodeTaxe = ? AND CodeTaux = ?',
            [NTS, CodeTaxe, CodeTaux]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Cette association NTS/Taxe/Taux existe déjà' });
        }

        // Retrieve IDProduits
        const [produits] = await pool.query('SELECT IDProduits FROM produits WHERE NTS = ?', [NTS]);
        if (produits.length === 0) {
            return res.status(404).json({ error: `Le code NTS ${NTS} n'existe pas dans les produits` });
        }
        const IDProduits = produits[0].IDProduits;

        // Retrieve IDTaxes
        const [taxes] = await pool.query('SELECT IDTaxes FROM taxes WHERE CodeTaxe = ?', [CodeTaxe]);
        if (taxes.length === 0) {
            return res.status(404).json({ error: `Le code taxe ${CodeTaxe} n'existe pas` });
        }
        const IDTaxes = taxes[0].IDTaxes;

        // Retrieve IDTaux
        const [tauxRows] = await pool.query('SELECT IDTaux FROM taux WHERE CodeTaux = ?', [CodeTaux]);
        if (tauxRows.length === 0) {
            return res.status(404).json({ error: `Le code taux ${CodeTaux} n'existe pas` });
        }
        const IDTaux = tauxRows[0].IDTaux;

        const [result] = await pool.query(
            `INSERT INTO tarifs (NTS, CodeTaux, CodeTaxe, IDTaux, IDTaxes, IDProduits, IdAgent)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [NTS, CodeTaux, CodeTaxe, IDTaux, IDTaxes, IDProduits, req.user.id]
        );

        res.status(201).json({ message: 'Tarif créé avec succès', id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/tarifs/bulk-update - Apply a (Taxe, Taux) pair to one or many NTS
router.put('/bulk-update', checkPermission('TAXES', 'can_create'), async (req, res) => {
    try {
        const { mode, ntsPrefix, CodeTaxe, CodeTaux } = req.body;

        if (!mode || !CodeTaxe || !CodeTaux) {
            return res.status(400).json({ error: 'mode, CodeTaxe et CodeTaux sont obligatoires' });
        }
        if (!['individual', 'category', 'integral'].includes(mode)) {
            return res.status(400).json({ error: 'mode invalide (individual|category|integral)' });
        }
        if ((mode === 'individual' || mode === 'category') && !ntsPrefix) {
            return res.status(400).json({ error: 'ntsPrefix est obligatoire pour ce mode' });
        }

        // Verify CodeTaxe and CodeTaux exist
        const [taxeRows] = await pool.query('SELECT IDTaxes FROM taxes WHERE CodeTaxe = ?', [CodeTaxe]);
        if (taxeRows.length === 0) return res.status(404).json({ error: `Le code taxe "${CodeTaxe}" n'existe pas` });
        const IDTaxes = taxeRows[0].IDTaxes;

        const [tauxRows] = await pool.query('SELECT IDTaux FROM taux WHERE CodeTaux = ?', [CodeTaux]);
        if (tauxRows.length === 0) return res.status(404).json({ error: `Le code taux "${CodeTaux}" n'existe pas` });
        const IDTaux = tauxRows[0].IDTaux;

        // Find target products
        let produitsRows;
        if (mode === 'individual') {
            // ntsPrefix can be an array of NTS or a single string
            const prefixes = Array.isArray(ntsPrefix) ? ntsPrefix : [ntsPrefix];
            [produitsRows] = await pool.query('SELECT NTS, IDProduits FROM produits WHERE NTS IN (?)', [prefixes]);
            if (produitsRows.length === 0) return res.status(404).json({ error: `Aucun des NTS fournis n'existe` });
        } else if (mode === 'category') {
            [produitsRows] = await pool.query('SELECT NTS, IDProduits FROM produits WHERE NTS LIKE ?', [`${ntsPrefix}%`]);
            if (produitsRows.length === 0) return res.status(404).json({ error: `Aucun produit ne commence par "${ntsPrefix}"` });
        } else {
            // integral
            [produitsRows] = await pool.query('SELECT NTS, IDProduits FROM produits');
        }

        let created = 0;
        let updated = 0;

        for (const produit of produitsRows) {
            // Check if product is already associated with this tax (RULE: only one association per tax)
            const [existing] = await pool.query(
                'SELECT IDTarifs FROM tarifs WHERE NTS = ? AND CodeTaxe = ?',
                [produit.NTS, CodeTaxe]
            );

            if (existing.length > 0) {
                await pool.query(
                    'UPDATE tarifs SET CodeTaux = ?, IDTaux = ?, IdAgent = ? WHERE IDTarifs = ?',
                    [CodeTaux, IDTaux, req.user.id, existing[0].IDTarifs]
                );
                updated++;
            } else {
                await pool.query(
                    `INSERT INTO tarifs (NTS, CodeTaxe, CodeTaux, IDTaux, IDTaxes, IDProduits, IdAgent)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [produit.NTS, CodeTaxe, CodeTaux, IDTaux, IDTaxes, produit.IDProduits, req.user.id]
                );
                created++;
            }
        }

        res.json({
            message: `Mise à jour effectuée`,
            created,
            updated,
            total: produitsRows.length
        });
    } catch (error) {
        console.error('bulk-update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/tarifs/:id - Delete a tarif
router.delete('/:id', checkPermission('TAXES', 'can_delete'), async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM tarifs WHERE IDTarifs = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Tarif introuvable' });
        }
        res.json({ message: 'Tarif supprimé avec succès' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
