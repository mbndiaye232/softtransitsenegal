const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/taxes-complements?codeTaxe=05
// Returns complement codes for a given principal tax (or all if no filter)
router.get('/', checkPermission('TAXES', 'can_view'), async (req, res) => {
    try {
        const { codeTaxe } = req.query;
        let query = `
            SELECT tc.IDTaxesComplements, tc.IDTaxesPrincipal, tc.CodeTaxePrincipal,
                   tc.IDTaxesComplement, tc.CodeTaxeComplement,
                   t.LibelleTaxe as LibelleComplement
            FROM taxes_complements tc
            LEFT JOIN taxes t ON tc.IDTaxesComplement = t.IDTaxes
        `;
        const params = [];
        if (codeTaxe) {
            query += ' WHERE tc.CodeTaxePrincipal = ?';
            params.push(codeTaxe);
        }
        query += ' ORDER BY tc.CodeTaxePrincipal, t.Niveau, tc.CodeTaxeComplement';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/taxes-complements/:codeTaxe
// Replace all complements for a principal tax
router.put('/:codeTaxe', checkPermission('TAXES', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { codeTaxe } = req.params;
        const { complementCodes } = req.body; // array of CodeTaxe strings

        // Get IDTaxes for the principal tax
        const [principal] = await connection.query(
            'SELECT IDTaxes FROM taxes WHERE CodeTaxe = ?', [codeTaxe]
        );
        if (principal.length === 0) {
            return res.status(404).json({ error: `Taxe ${codeTaxe} introuvable` });
        }
        const idPrincipal = principal[0].IDTaxes;

        await connection.beginTransaction();

        // Delete existing complements for this tax
        await connection.query(
            'DELETE FROM taxes_complements WHERE CodeTaxePrincipal = ?', [codeTaxe]
        );

        // Insert new complements
        if (complementCodes && complementCodes.length > 0) {
            const [complements] = await connection.query(
                'SELECT IDTaxes, CodeTaxe FROM taxes WHERE CodeTaxe IN (?)',
                [complementCodes]
            );

            for (const comp of complements) {
                await connection.query(
                    `INSERT INTO taxes_complements
                     (IDTaxesPrincipal, CodeTaxePrincipal, IDTaxesComplement, CodeTaxeComplement)
                     VALUES (?, ?, ?, ?)`,
                    [idPrincipal, codeTaxe, comp.IDTaxes, comp.CodeTaxe]
                );
            }
        }

        await connection.commit();
        res.json({ message: `Compléments de la taxe ${codeTaxe} mis à jour` });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        connection.release();
    }
});

module.exports = router;
