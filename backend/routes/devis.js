// backend/routes/devis.js
// Gestion des devis (cotations client) - tables cotations & LiaisonCotationsRubriques
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

router.use(authMiddleware);
router.use(tenantMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/devis  — Créer un nouveau devis
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', checkPermission('COTATIONS', 'can_create'), async (req, res) => {
    const connection = await pool.getConnection();
    const { idDossier, rubriques, observations } = req.body;
    const idAgent = req.user.id;

    try {
        await connection.beginTransaction();

        if (!rubriques || rubriques.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Au moins une rubrique est requise' });
        }

        // 1. Récupérer structur_id de l'agent
        const [[agent]] = await connection.query(
            'SELECT structur_id FROM agents WHERE IDAgents = ? LIMIT 1',
            [idAgent]
        );
        if (!agent) {
            await connection.rollback();
            return res.status(400).json({ error: 'Agent introuvable.' });
        }
        const structurId = agent.structur_id;

        // 2. Générer le numéro de cotation (CT-XXXXX)
        const [lastDevis] = await connection.query(
            "SELECT NumeroCotation FROM cotations WHERE NumeroCotation LIKE 'CT-%' ORDER BY NumeroCotation DESC LIMIT 1"
        );
        let nextNum = 1;
        if (lastDevis.length > 0) {
            const last = lastDevis[0].NumeroCotation;
            const parts = last.split('-');
            if (parts.length === 2) {
                nextNum = parseInt(parts[1], 10) + 1;
            }
        }
        const numeroCotation = `CT-${String(nextNum).padStart(5, '0')}`;

        // 3. Calculer les totaux
        const tvaRate = 0.18;
        let totalHTDouane = 0, totalHTDebours = 0, totalHTPrestations = 0, totalTVA = 0;

        rubriques.forEach(r => {
            const amount = parseFloat(r.montant) || 0;
            const code = String(r.code || r.CodeRubrique || '');
            if (code.startsWith('10')) {
                totalHTDouane += amount;
            } else if (code.startsWith('11')) {
                totalHTDebours += amount;
            } else if (code.startsWith('40')) {
                totalHTPrestations += amount;
                totalTVA += amount * tvaRate;
            }
        });

        const totalHT = totalHTDouane + totalHTDebours + totalHTPrestations;
        const totalTTC = totalHT + totalTVA;

        // 4. Insérer dans cotations
        const [result] = await connection.query(
            `INSERT INTO cotations 
                (IDDossiers, NumeroCotation, MontantHTCotation, MontantTVACotation, MontantTTCCotation,
                 IdagentSaisie, Observations, DateCotation, structur_id, Acceptee)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, 0)`,
            [idDossier, numeroCotation, totalHT, totalTVA, totalTTC, idAgent, observations || '', structurId]
        );

        const idCotation = result.insertId;

        // 5. Insérer dans LiaisonCotationsRubriques
        const liaisonValues = rubriques.map(r => [
            r.idRubrique || r.IDRubriques,
            idCotation,
            r.montant || 0,
            r.code || r.CodeRubrique,
            r.libelle || r.libelleRubrique,
            r.complement || ''
        ]);

        await connection.query(
            `INSERT INTO liaisoncotationsrubriques
                (IDRubriques, IDCotation, MontantHTCotation, CodeRubrique, libelleRubrique, Complement)
             VALUES ?`,
            [liaisonValues]
        );

        await connection.commit();
        res.status(201).json({
            message: 'Devis créé avec succès',
            idCotation,
            numeroCotation,
            totals: { totalHT, totalTVA, totalTTC }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erreur création devis:', error);
        res.status(500).json({ error: error.sqlMessage || error.message });
    } finally {
        connection.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/devis/dossier/:dossierId  — Lister les devis d'un dossier
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dossier/:dossierId', checkPermission('COTATIONS', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT c.*, a.NomAgent as AgentName
             FROM cotations c
             LEFT JOIN agents a ON c.IdagentSaisie = a.IDAgents
             WHERE c.IDDossiers = ?
             ORDER BY c.DateCotation DESC, c.IDCotations DESC`,
            [req.params.dossierId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Erreur liste devis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/devis/:id  — Détails d'un devis + ses rubriques
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', checkPermission('COTATIONS', 'can_view'), async (req, res) => {
    try {
        const [[devis]] = await pool.query(
            `SELECT c.*, a.NomAgent as AgentName,
                    d.CodeDossier, d.Libelle as DossierLibelle, d.IDCLIENTS,
                    cl.NomRS as ClientName, cl.adresseClient as ClientAddress, cl.NINEA as ClientNINEA
             FROM cotations c
             LEFT JOIN agents a ON c.IdagentSaisie = a.IDAgents
             LEFT JOIN dossiers d ON c.IDDossiers = d.IDDossiers
             LEFT JOIN clients cl ON d.IDCLIENTS = cl.IDCLIENTS
             WHERE c.IDCotations = ?`,
            [req.params.id]
        );

        if (!devis) return res.status(404).json({ error: 'Devis introuvable' });

        const [rubriques] = await pool.query(
            'SELECT * FROM liaisoncotationsrubriques WHERE IDCotation = ?',
            [req.params.id]
        );

        res.json({ ...devis, rubriques });
    } catch (error) {
        console.error('Erreur détail devis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/devis/:id/accepter  — Marquer le devis comme accepté / refusé
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/accepter', checkPermission('COTATIONS', 'can_edit'), async (req, res) => {
    const { acceptee } = req.body; // 1=accepté, 0=non accepté, -1=refusé
    try {
        const [result] = await pool.query(
            'UPDATE cotations SET Acceptee = ? WHERE IDCotations = ?',
            [acceptee, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Devis introuvable' });
        res.json({ message: 'Statut du devis mis à jour' });
    } catch (error) {
        console.error('Erreur mise à jour statut devis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/devis/:id  — Supprimer un devis (uniquement si non accepté)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', checkPermission('COTATIONS', 'can_delete'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [[devis]] = await connection.query(
            'SELECT Acceptee FROM cotations WHERE IDCotations = ?',
            [req.params.id]
        );

        if (!devis) {
            await connection.rollback();
            return res.status(404).json({ error: 'Devis introuvable' });
        }

        if (Number(devis.Acceptee) === 1) {
            await connection.rollback();
            return res.status(400).json({ error: 'Impossible de supprimer un devis accepté.' });
        }

        await connection.query('DELETE FROM liaisoncotationsrubriques WHERE IDCotation = ?', [req.params.id]);
        await connection.query('DELETE FROM cotations WHERE IDCotations = ?', [req.params.id]);

        await connection.commit();
        res.json({ message: 'Devis supprimé avec succès' });
    } catch (error) {
        await connection.rollback();
        console.error('Erreur suppression devis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    } finally {
        connection.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/devis/:id/pdf  — Générer le PDF du devis
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/pdf', checkPermission('COTATIONS', 'can_view'), async (req, res) => {
    try {
        const DevisPDFGenerator = require('../services/DevisPDFGenerator');
        const generator = new DevisPDFGenerator(pool);
        const pdfPath = await generator.generatePDF(req.params.id);
        res.download(pdfPath);
    } catch (error) {
        console.error('Erreur génération PDF devis:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du PDF : ' + error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/devis/:id/convertir  — Convertir un devis accepté en facture
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/convertir', checkPermission('FACTURES', 'can_create'), async (req, res) => {
    const connection = await pool.getConnection();
    const { rubriques, observations } = req.body;
    const idAgent = req.user.id;

    try {
        await connection.beginTransaction();

        // 1. Vérifier que le devis existe et est accepté
        const [[devis]] = await connection.query(
            'SELECT * FROM cotations WHERE IDCotations = ?',
            [req.params.id]
        );
        if (!devis) {
            await connection.rollback();
            return res.status(404).json({ error: 'Devis introuvable' });
        }
        if (Number(devis.Acceptee) !== 1) {
            await connection.rollback();
            return res.status(400).json({ error: 'Seul un devis accepté peut être converti en facture.' });
        }

        if (!rubriques || rubriques.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Au moins une rubrique est requise' });
        }

        // 2. Récupérer structur_id
        const [[agent]] = await connection.query(
            'SELECT structur_id FROM agents WHERE IDAgents = ? LIMIT 1',
            [idAgent]
        );
        if (!agent) {
            await connection.rollback();
            return res.status(400).json({ error: 'Agent introuvable.' });
        }
        const structurId = agent.structur_id;

        // 3. Déterminer le type et préfixe de la facture
        let hasCategory10 = false, hasCategoryOthers = false;
        const tvaRate = 0.18;
        let totalHTDouane = 0, totalHTDebours = 0, totalHTPrestations = 0, totalTVA = 0;

        rubriques.forEach(r => {
            const code = String(r.code || r.CodeRubrique || '');
            const amount = parseFloat(r.montant) || 0;
            if (code.startsWith('10')) { hasCategory10 = true; totalHTDouane += amount; }
            else {
                hasCategoryOthers = true;
                if (code.startsWith('11')) totalHTDebours += amount;
                else if (code.startsWith('40')) { totalHTPrestations += amount; totalTVA += amount * tvaRate; }
            }
        });

        let prefix = 'FG';
        if (hasCategory10 && !hasCategoryOthers) prefix = 'FD';
        else if (!hasCategory10 && hasCategoryOthers) prefix = 'FP';

        const totalHT = totalHTDouane + totalHTDebours + totalHTPrestations;
        const totalTTC = totalHT + totalTVA;

        // 4. Générer un numéro de facture
        const [lastInvoice] = await connection.query(
            'SELECT NumeroFacture FROM factures WHERE NumeroFacture LIKE ? ORDER BY NumeroFacture DESC LIMIT 1',
            [`${prefix}-%`]
        );
        let nextNum = 1;
        if (lastInvoice.length > 0) {
            const lastNum = parseInt(lastInvoice[0].NumeroFacture.split('-')[1], 10);
            nextNum = lastNum + 1;
        }
        const numeroFacture = `${prefix}-${String(nextNum).padStart(5, '0')}`;

        // 5. Créer la facture
        const [result] = await connection.query(
            `INSERT INTO factures
                (IDDossiers, NumeroFacture, MontantHTFacture, MontantTVAFacture,
                 MontantTTCFacture, IDAgents, Observations, DateFacture, structur_id,
                 Validee, MontantRegleFacture, ReliquatFacture)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, 0, 0, ?)`,
            [devis.IDDossiers, numeroFacture, totalHT, totalTVA, totalTTC,
                idAgent, observations || `Facture issue du devis ${devis.NumeroCotation}`, structurId, totalTTC]
        );
        const idFacture = result.insertId;

        // 6. Insérer les rubriques de la facture
        const liaisonValues = rubriques.map(r => [
            idFacture,
            r.idRubrique || r.IDRubriques,
            r.montant || 0,
            r.code || r.CodeRubrique,
            r.libelle || r.libelleRubrique,
            r.complement || ''
        ]);
        await connection.query(
            `INSERT INTO liaisonfacturesrubriques
                (IDFactures, IDRubriques, MontantHTFactures, CodeRubrique, libelleRubrique, Complement)
             VALUES ?`,
            [liaisonValues]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Facture créée avec succès depuis le devis',
            idFacture,
            numeroFacture,
            totals: { totalHT, totalTVA, totalTTC }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erreur conversion devis en facture:', error);
        res.status(500).json({ error: error.sqlMessage || error.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
