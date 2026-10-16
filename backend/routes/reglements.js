const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');
const { recomputeAndSaveDossierEtape } = require('../services/etapeService');

router.use(authMiddleware);

// GET /api/reglements/modes - Get all payment methods
router.get('/modes', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM modesreglements ORDER BY libelle');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching modes reglements:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/reglements/modes
 * Create a new payment method
 */
router.post('/modes', async (req, res) => {
    try {
        const { libelle } = req.body;
        if (!libelle) return res.status(400).json({ error: 'Libelle is required' });

        const [result] = await pool.query('INSERT INTO modesreglements (libelle) VALUES (?)', [libelle]);
        res.status(201).json({ id: result.insertId, libelle });
    } catch (error) {
        console.error('Error creating mode reglement:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PUT /api/reglements/modes/:id
 * Update a payment method
 */
router.put('/modes/:id', async (req, res) => {
    try {
        const { libelle } = req.body;
        await pool.query('UPDATE modesreglements SET libelle = ? WHERE IDModesReglements = ?', [libelle, req.params.id]);
        res.json({ message: 'Mode updated' });
    } catch (error) {
        console.error('Error updating mode reglement:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/reglements/modes/:id
 * Delete a payment method
 */
router.delete('/modes/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM modesreglements WHERE IDModesReglements = ?', [req.params.id]);
        res.json({ message: 'Mode deleted' });
    } catch (error) {
        console.error('Error deleting mode reglement:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reglements/factures-impayees/:clientId - Get unpaid invoices for a client
router.get('/factures-impayees/:clientId', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const clientId = req.params.clientId;
        let query = `
            SELECT f.*, d.CodeDossier, d.Libelle 
            FROM factures f
            JOIN dossiers d ON f.IDDossiers = d.IDDossiers
            WHERE d.IDCLIENTS = ? AND f.ReliquatFacture > 0 AND f.Validee = 1
        `;
        let params = [clientId];

        // Apply tenant isolation
        if (!req.user.is_provider) {
            query += ' AND f.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' ORDER BY f.Datefacture ASC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching unpaid invoices:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/reglements - Process a payment
router.post('/', checkPermission('FACTURES', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { clientId, montantReglement, dateReglement, listFactures, idModeReglement, observations } = req.body;

        if (!clientId || !montantReglement || !listFactures || listFactures.length === 0) {
            return res.status(400).json({ error: 'Paramètres manquants' });
        }

        let remainingAmount = parseFloat(montantReglement);

        // Sort invoices by date to pay oldest first if needed, though they should be processed in the order received
        for (const factureId of listFactures) {
            // Get current invoice state locking the row
            const [invoices] = await connection.query(
                'SELECT MontantTTCFacture, MontantRegleFacture, ReliquatFacture FROM factures WHERE IDFactures = ? FOR UPDATE',
                [factureId]
            );

            if (invoices.length === 0) continue;
            const invoice = invoices[0];
            const reliquat = parseFloat(invoice.ReliquatFacture);

            if (reliquat <= 0 || remainingAmount <= 0) continue;

            const amountToApply = Math.min(reliquat, remainingAmount);

            // Update invoice
            const nouveauRegle = parseFloat(invoice.MontantRegleFacture) + amountToApply;
            const nouveauReliquat = parseFloat(invoice.MontantTTCFacture) - nouveauRegle;

            await connection.query(
                'UPDATE factures SET MontantRegleFacture = ?, ReliquatFacture = ? WHERE IDFactures = ?',
                [nouveauRegle, nouveauReliquat, factureId]
            );

            // Record payment line
            await connection.query(
                `INSERT INTO reglements (IDFactures, Datereglement, MontantReglement, IdModeReglement, IdAgent, Observations) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [factureId, dateReglement || new Date(), amountToApply, idModeReglement || 0, req.user.id, observations]
            );

            remainingAmount -= amountToApply;
        }

        // Handle overpayment -> client credit
        if (remainingAmount > 0) {
            // Check if client has a compte client
            const [comptes] = await connection.query(
                'SELECT IDComptesClients, SoldeCompteClient, TotalCredit FROM comptesclients WHERE IDCLIENTS = ? FOR UPDATE',
                [clientId]
            );

            let compteId;
            if (comptes.length === 0) {
                // Create compte client
                const [clientRow] = await connection.query('SELECT NomRS FROM clients WHERE IDCLIENTS = ?', [clientId]);
                const libelle = clientRow.length > 0 ? `COMPTE ${clientRow[0].NomRS}` : 'COMPTE CLIENT';

                const [insertCompte] = await connection.query(
                    'INSERT INTO comptesclients (LibelleCompteClients, IDCLIENTS, IdAgent, SoldeCompteClient, TotalCredit, TotalDebit) VALUES (?, ?, ?, ?, ?, ?)',
                    [libelle, clientId, req.user.id, remainingAmount, remainingAmount, 0]
                );
                compteId = insertCompte.insertId;
            } else {
                compteId = comptes[0].IDComptesClients;
                const newSolde = parseFloat(comptes[0].SoldeCompteClient) + remainingAmount;
                const newTotalCredit = parseFloat(comptes[0].TotalCredit) + remainingAmount;

                await connection.query(
                    'UPDATE comptesclients SET SoldeCompteClient = ?, TotalCredit = ? WHERE IDComptesClients = ?',
                    [newSolde, newTotalCredit, compteId]
                );
            }

            // Record movement
            await connection.query(
                `INSERT INTO mouvementscomptesclients (IDComptesClients, libelle, DateMouvement, MontantMouvement, Sens, Observations, IdAgent, Etat, IdModeReglement) 
                 VALUES (?, 'Trop-perçu du règlement', ?, ?, 'C', ?, ?, 'V', ?)`,
                [compteId, dateReglement || new Date(), remainingAmount, observations, req.user.id, idModeReglement || 0]
            );
        }

        // Audit
        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'REGLEMENT',
            resource_id: clientId,
            details: `Règlement traité : ${montantReglement} | Reste alloué compte : ${remainingAmount}`,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        await connection.commit();

        // Recompute étape on every affected dossier (best-effort, after commit)
        try {
            const [touchedDossiers] = await pool.query(
                `SELECT DISTINCT f.IDDossiers
                 FROM factures f
                 WHERE f.IDFactures IN (${listFactures.map(() => '?').join(',')})`,
                listFactures
            );
            for (const d of touchedDossiers) {
                if (d.IDDossiers) recomputeAndSaveDossierEtape(d.IDDossiers);
            }
        } catch (e) {
            console.error('[reglements] recompute étape failed:', e.message);
        }

        res.json({ message: 'Règlement traité avec succès', remainingAmount });

    } catch (error) {
        await connection.rollback();
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    } finally {
        connection.release();
    }
});

// GET /api/reglements/history/:clientId - Get complete payment history for a client
router.get('/history/:clientId', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    console.log(`GET /api/reglements/history/${req.params.clientId} hit`);
    try {
        const [rows] = await pool.query(`
            SELECT r.*, f.NumeroFacture, d.CodeDossier, m.libelle as modeLibelle
            FROM reglements r
            LEFT JOIN factures f ON r.IDFactures = f.IDFactures
            LEFT JOIN dossiers d ON f.IDDossiers = d.IDDossiers
            LEFT JOIN modesreglements m ON r.IdModeReglement = m.IDModesReglements
            WHERE d.IDCLIENTS = ?
            ORDER BY r.Datereglement DESC, r.IDReglements DESC
        `, [req.params.clientId]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reglements/movements/:clientId - Get account movements for a client
router.get('/movements/:clientId', checkPermission('CLIENTS', 'can_view'), async (req, res) => {
    console.log(`GET /api/reglements/movements/${req.params.clientId} hit`);
    try {
        const [rows] = await pool.query(`
            SELECT m.*, cc.LibelleCompteClients
            FROM mouvementscomptesclients m
            JOIN comptesclients cc ON m.IDComptesClients = cc.IDComptesClients
            WHERE cc.IDCLIENTS = ?
            ORDER BY m.DateMouvement DESC, m.IDMouvementsComptesClients DESC
        `, [req.params.clientId]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching account movements:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/reglements/:id - Cancel a payment
router.delete('/:id', checkPermission('FACTURES', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get payment details
        const [payments] = await connection.query(
            'SELECT * FROM reglements WHERE IDReglements = ? FOR UPDATE',
            [req.params.id]
        );

        if (payments.length === 0) {
            return res.status(404).json({ error: 'Règlement introuvable' });
        }

        const payment = payments[0];

        // 2. Adjust invoice balance
        const [invoices] = await connection.query(
            'SELECT MontantRegleFacture, ReliquatFacture, MontantTTCFacture FROM factures WHERE IDFactures = ? FOR UPDATE',
            [payment.IDFactures]
        );

        if (invoices.length > 0) {
            const invoice = invoices[0];
            const nouveauRegle = parseFloat(invoice.MontantRegleFacture) - parseFloat(payment.MontantReglement);
            const nouveauReliquat = parseFloat(invoice.MontantTTCFacture) - nouveauRegle;

            await connection.query(
                'UPDATE factures SET MontantRegleFacture = ?, ReliquatFacture = ? WHERE IDFactures = ?',
                [nouveauRegle, nouveauReliquat, payment.IDFactures]
            );
        }

        // 3. Delete payment record
        await connection.query('DELETE FROM reglements WHERE IDReglements = ?', [req.params.id]);

        // Audit
        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'REGLEMENT',
            resource_id: payment.IDFactures,
            details: `Règlement annulé: ${payment.MontantReglement} pour facture ID ${payment.IDFactures}`,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        await connection.commit();

        // Recompute étape du dossier impacté
        try {
            const [[fac]] = await pool.query('SELECT IDDossiers FROM factures WHERE IDFactures = ?', [payment.IDFactures]);
            if (fac?.IDDossiers) recomputeAndSaveDossierEtape(fac.IDDossiers);
        } catch (e) {
            console.error('[reglements] recompute étape after cancel failed:', e.message);
        }

        res.json({ message: 'Règlement annulé avec succès' });

    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling payment:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    } finally {
        connection.release();
    }
});

// DELETE /api/reglements/movement/:id - Cancel an account movement
router.delete('/movement/:id', checkPermission('CLIENTS', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get movement details
        const [movements] = await connection.query(
            'SELECT * FROM mouvementscomptesclients WHERE IDMouvementsComptesClients = ? FOR UPDATE',
            [req.params.id]
        );

        if (movements.length === 0) {
            return res.status(404).json({ error: 'Mouvement introuvable' });
        }

        const movement = movements[0];

        // 2. Adjust client account balance
        const [comptes] = await connection.query(
            'SELECT SoldeCompteClient, TotalCredit, TotalDebit FROM comptesclients WHERE IDComptesClients = ? FOR UPDATE',
            [movement.IDComptesClients]
        );

        if (comptes.length > 0) {
            const compte = comptes[0];
            let newSolde = parseFloat(compte.SoldeCompteClient);
            let newTotalCredit = parseFloat(compte.TotalCredit);
            let newTotalDebit = parseFloat(compte.TotalDebit);

            if (movement.Sens === 'C') { // Credit cancelled
                newSolde -= parseFloat(movement.MontantMouvement);
                newTotalCredit -= parseFloat(movement.MontantMouvement);
            } else { // Debit cancelled
                newSolde += parseFloat(movement.MontantMouvement);
                newTotalDebit -= parseFloat(movement.MontantMouvement);
            }

            await connection.query(
                `UPDATE comptesclients 
                 SET SoldeCompteClient = ?, TotalCredit = ?, TotalDebit = ? 
                 WHERE IDComptesClients = ?`,
                [newSolde, newTotalCredit, newTotalDebit, movement.IDComptesClients]
            );
        }

        // 3. Delete movement record
        await connection.query('DELETE FROM mouvementscomptesclients WHERE IDMouvementsComptesClients = ?', [req.params.id]);

        // Audit
        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'MOUVEMENT_COMPTE',
            resource_id: movement.IDComptesClients,
            details: `Mouvement annulé: ${movement.MontantMouvement} (${movement.Sens})`,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        await connection.commit();
        res.json({ message: 'Mouvement annulé avec succès' });

    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling movement:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
