const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/produits - Get all products with pagination
router.get('/', checkPermission('PRODUITS', 'can_view'), async (req, res) => {
    try {
        const { page = 1, limit = 100, search = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT IDProduits, NTS, Libelle FROM produits';
        let countQuery = 'SELECT COUNT(*) as total FROM produits';
        const params = [];
        const countParams = [];

        if (search) {
            const searchTerm = `%${search}%`;
            query += ' WHERE NTS LIKE ? OR Libelle LIKE ?';
            countQuery += ' WHERE NTS LIKE ? OR Libelle LIKE ?';
            params.push(searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm);
        }

        query += ' ORDER BY NTS LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [products] = await pool.query(query, params);
        const [countResult] = await pool.query(countQuery, countParams);

        res.json({
            products,
            total: countResult[0].total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/produits/search - Search products by NTS or label
router.get('/search', checkPermission('PRODUITS', 'can_view'), async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const searchTerm = `%${q}%`;
        const [products] = await pool.query(
            `SELECT IDProduits, NTS, Libelle 
             FROM produits 
             WHERE NTS LIKE ? OR Libelle LIKE ? 
             ORDER BY NTS 
             LIMIT 50`,
            [searchTerm, searchTerm]
        );

        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/produits/:nts - Get product by NTS
router.get('/:nts', checkPermission('PRODUITS', 'can_view'), async (req, res) => {
    try {
        const [products] = await pool.query(
            'SELECT * FROM produits WHERE NTS = ?',
            [req.params.nts]
        );

        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(products[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/produits - Create a new product
router.post('/', checkPermission('PRODUITS', 'can_create'), async (req, res) => {
    try {
        const { NTS, Libelle } = req.body;
        if (!NTS || !Libelle) {
            return res.status(400).json({ error: 'NTS et Libelle sont obligatoires' });
        }

        // Check if NTS already exists
        const [existing] = await pool.query('SELECT IDProduits FROM produits WHERE NTS = ?', [NTS]);
        if (existing.length > 0) {
            return res.status(409).json({ error: `Le code NTS ${NTS} existe déjà` });
        }

        const [result] = await pool.query(
            'INSERT INTO produits (NTS, Libelle, IDAgents) VALUES (?, ?, ?)',
            [NTS, Libelle, req.user.id]
        );
        res.status(201).json({ message: 'Produit créé avec succès', id: result.insertId, NTS, Libelle });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/produits/:nts - Update product label
router.put('/:nts', checkPermission('PRODUITS', 'can_edit'), async (req, res) => {
    try {
        const { Libelle } = req.body;
        if (!Libelle) {
            return res.status(400).json({ error: 'Libelle est obligatoire' });
        }
        const [result] = await pool.query(
            'UPDATE produits SET Libelle = ? WHERE NTS = ?',
            [Libelle, req.params.nts]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Produit introuvable' });
        }
        res.json({ message: 'Produit mis à jour avec succès' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/produits/:nts - Delete product by NTS
router.delete('/:nts', checkPermission('PRODUITS', 'can_delete'), async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM produits WHERE NTS = ?', [req.params.nts]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Produit introuvable' });
        }
        res.json({ message: 'Produit supprimé avec succès' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
