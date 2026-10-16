const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/etats-financiers/factures-clients
 * État des factures des clients exonérés ou non exonérés entre deux dates
 * 
 * Query params:
 *   - dateDebut (required): Start date (YYYY-MM-DD)
 *   - dateFin (required): End date (YYYY-MM-DD)
 *   - exonereTVA (required): 1 for exempt clients, 0 for non-exempt
 */
router.get('/factures-clients', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const { dateDebut, dateFin, exonereTVA } = req.query;

        // Validation
        if (!dateDebut) {
            return res.status(400).json({ error: 'Veuillez saisir la date de début SVP' });
        }
        if (!dateFin) {
            return res.status(400).json({ error: 'Veuillez saisir la date de fin SVP' });
        }
        if (new Date(dateFin) < new Date(dateDebut)) {
            return res.status(400).json({ error: 'La date de début ne peut pas être postérieure à la date de fin. Veuillez corriger SVP.' });
        }
        if (exonereTVA === undefined || exonereTVA === '') {
            return res.status(400).json({ error: 'Veuillez sélectionner le statut client (exonéré ou non)' });
        }

        let query = `
            SELECT 
                c.NomRS,
                c.NINEA,
                c.ExonereTVA,
                f.NumeroFacture,
                f.Datefacture,
                f.MontantHTFacture,
                f.MontantTVAFacture,
                f.MontantTTCFacture,
                f.RefCotation,
                f.MontantRegleFacture,
                f.ReliquatFacture,
                d.CodeDossier
            FROM factures f
            JOIN dossiers d ON f.IDDossiers = d.IDDossiers
            JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
            WHERE f.Datefacture BETWEEN ? AND ?
              AND c.ExonereTVA = ?
        `;
        const params = [dateDebut, dateFin, parseInt(exonereTVA)];

        // Tenant isolation
        if (!req.user.is_provider) {
            query += ' AND f.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' ORDER BY f.Datefacture ASC, c.NomRS ASC';

        const [rows] = await pool.query(query, params);

        // Calculate totals
        const totals = rows.reduce((acc, row) => {
            acc.totalHT += parseFloat(row.MontantHTFacture) || 0;
            acc.totalTVA += parseFloat(row.MontantTVAFacture) || 0;
            acc.totalTTC += parseFloat(row.MontantTTCFacture) || 0;
            acc.totalRegle += parseFloat(row.MontantRegleFacture) || 0;
            acc.totalReliquat += parseFloat(row.ReliquatFacture) || 0;
            return acc;
        }, { totalHT: 0, totalTVA: 0, totalTTC: 0, totalRegle: 0, totalReliquat: 0 });

        res.json({
            factures: rows,
            totals,
            count: rows.length,
            params: {
                dateDebut,
                dateFin,
                exonereTVA: parseInt(exonereTVA)
            }
        });

    } catch (error) {
        console.error('Error fetching factures clients état:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

/**
 * GET /api/etats-financiers/releve-client
 * Relevé de compte client
 * 
 * Query params:
 *   - clientId (required)
 *   - dateDebut (required)
 *   - dateFin (required)
 *   - typeFacture (T/D/P default: T)
 *   - etatFacture (T/N/S default: T)
 */
router.get('/releve-client', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const { clientId, dateDebut, dateFin, typeFacture = 'T', etatFacture = 'T' } = req.query;

        // Validation
        if (!clientId) {
            return res.status(400).json({ error: 'Veuillez sélectionner le client SVP' });
        }
        if (!dateDebut) {
            return res.status(400).json({ error: 'Veuillez saisir la date de début SVP' });
        }
        if (!dateFin) {
            return res.status(400).json({ error: 'Veuillez saisir la date de fin SVP' });
        }
        if (new Date(dateFin) < new Date(dateDebut)) {
            return res.status(400).json({ error: 'La date de début ne peut pas être postérieure à la date de fin. Veuillez corriger SVP.' });
        }

        let query = `
            SELECT 
                f.IDFactures,
                f.NumeroFacture,
                f.Datefacture,
                f.MontantTTCFacture,
                f.MontantRegleFacture,
                f.ReliquatFacture,
                f.DateEcheance,
                d.CodeDossier
            FROM factures f
            JOIN dossiers d ON f.IDDossiers = d.IDDossiers
            WHERE d.IDCLIENTS = ?
              AND f.Datefacture BETWEEN ? AND ?
        `;
        const params = [clientId, dateDebut, dateFin];

        // Type de facture (Toutes, Douane, Prestations)
        if (typeFacture === 'D') {
            query += " AND f.NumeroFacture LIKE 'FD%'";
        } else if (typeFacture === 'P') {
            query += " AND f.NumeroFacture NOT LIKE 'FD%'";
        }

        // Etat de facture (Toutes, Non Soldées, Soldées)
        if (etatFacture === 'N') {
            query += " AND f.ReliquatFacture > 0";
        } else if (etatFacture === 'S') {
            query += " AND f.ReliquatFacture <= 0";
        }

        // Tenant isolation
        if (!req.user.is_provider) {
            query += ' AND f.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' ORDER BY f.Datefacture ASC, f.NumeroFacture ASC';

        const [rows] = await pool.query(query, params);

        // Fetch client details
        let clientQuery = 'SELECT NomRS, EncoursAutorise, EmailClient, TelClient FROM clients WHERE IDCLIENTS = ?';
        let clientParams = [clientId];
        if (!req.user.is_provider) {
             clientQuery += ' AND structur_id = ?';
             clientParams.push(req.structur_id);
        }
        const [clientRows] = await pool.query(clientQuery, clientParams);

        if (clientRows.length === 0) {
             return res.status(404).json({ error: 'Client introuvable' });
        }

        // Calculate totals
        const totals = rows.reduce((acc, row) => {
            acc.totalSortie += parseFloat(row.MontantTTCFacture) || 0;
            acc.totalEntree += parseFloat(row.MontantRegleFacture) || 0;
            return acc;
        }, { totalSortie: 0, totalEntree: 0 });
        
        totals.reliquatClient = totals.totalSortie - totals.totalEntree;

        res.json({
            client: clientRows[0],
            factures: rows,
            totals,
            count: rows.length,
            params: {
                clientId,
                dateDebut,
                dateFin,
                typeFacture,
                etatFacture
            }
        });

    } catch (error) {
        console.error('Error fetching relevé client:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});
/**
 * GET /api/etats-financiers/releve-client/pdf
 * Imprime via PDF le relevé de compte
 */
router.get('/releve-client/pdf', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const { clientId, dateDebut, dateFin, typeFacture, etatFacture } = req.query;

        // Validation
        if (!clientId) return res.status(400).json({ error: 'Veuillez sélectionner le client SVP' });
        if (!dateDebut || !dateFin) return res.status(400).json({ error: 'Veuillez saisir les dates de début et de fin' });

        const RelevePDFGenerator = require('../services/RelevePDFGenerator');
        const pdfGenerator = new RelevePDFGenerator(pool);

        const params = {
            clientId,
            dateDebut,
            dateFin,
            typeFacture: typeFacture || 'T',
            etatFacture: etatFacture || 'T',
            structur_id: req.structur_id,
            is_provider: req.user.is_provider
        };

        const pdfPath = await pdfGenerator.generatePDF(params);

        res.download(pdfPath, `ReleveCompte_${clientId}_${Date.now()}.pdf`, (err) => {
            if (err) {
                console.error("Erreur lors de l'envoi du fichier:", err);
                if (!res.headersSent) res.status(500).json({ error: "Erreur lors de l'envoi du PDF" });
            }
        });

    } catch (error) {
        console.error('Error fetching relevé client PDF:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

/**
 * GET /api/etats-financiers/etat-factures/pdf
 * Imprime via PDF l'état des factures et règlements d'un client
 */
router.get('/etat-factures/pdf', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const { clientId, dateDebut, dateFin, typeFacture, etatFacture } = req.query;

        // Validation
        if (!clientId) return res.status(400).json({ error: 'Veuillez sélectionner le client SVP' });
        if (!dateDebut || !dateFin) return res.status(400).json({ error: 'Veuillez saisir les dates de début et de fin' });

        const RelevePDFGenerator = require('../services/RelevePDFGenerator');
        const pdfGenerator = new RelevePDFGenerator(pool);

        const params = {
            clientId,
            dateDebut,
            dateFin,
            typeFacture: typeFacture || 'T',
            etatFacture: etatFacture || 'T',
            structur_id: req.structur_id,
            is_provider: req.user.is_provider,
            isEtatFactures: true
        };

        const pdfPath = await pdfGenerator.generatePDF(params);

        res.download(pdfPath, `EtatFactures_${clientId}_${Date.now()}.pdf`, (err) => {
            if (err) {
                console.error("Erreur lors de l'envoi du fichier:", err);
                if (!res.headersSent) res.status(500).json({ error: "Erreur lors de l'envoi du PDF" });
            }
        });

    } catch (error) {
        console.error('Error fetching état factures PDF:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

/**
 * GET /api/etats-financiers/grand-livre
 * État Grand Livre pour une année spécifique
 * 
 * Query params:
 *   - annee (required): Year (YYYY)
 */
router.get('/grand-livre', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const { annee } = req.query;

        // Validation
        if (!annee || annee.length !== 4) {
            return res.status(400).json({ error: 'Veuillez saisir l\'année avec 4 chiffres SVP' });
        }

        const dateDebut = `${annee}-01-01`;
        const dateFin = `${annee}-12-31`;

        // 1. Fetch Invoices for the year
        let facturesQuery = `
            SELECT 
                f.IDFactures,
                f.NumeroFacture,
                f.Datefacture,
                f.MontantTTCFacture,
                f.MontantRegleFacture,
                f.ReliquatFacture,
                d.CodeDossier,
                d.Libelle
            FROM factures f
            LEFT JOIN dossiers d ON f.IDDossiers = d.IDDossiers
            WHERE f.Datefacture BETWEEN ? AND ?
        `;
        const facturesParams = [dateDebut, dateFin];

        // Tenant isolation
        if (!req.user.is_provider) {
            facturesQuery += ' AND f.structur_id = ?';
            facturesParams.push(req.structur_id);
        }

        facturesQuery += ' ORDER BY f.Datefacture ASC';

        const [factures] = await pool.query(facturesQuery, facturesParams);

        if (factures.length === 0) {
            return res.json({
                data: [],
                totals: { totalDebit: 0, totalCredit: 0, soldeTotal: 0 },
                count: 0
            });
        }

        const idFactures = factures.map(f => f.IDFactures);

        // 2. Fetch all payments linked to these invoices
        let reglementsQuery = `
            SELECT 
                r.IDReglements,
                r.IDFactures,
                r.MontantReglement,
                r.Datereglement
            FROM reglements r
            WHERE r.IDFactures IN (?)
        `;
        const reglementsParams = [idFactures];

        // Tenant isolation
        if (!req.user.is_provider) {
            reglementsQuery += ' AND r.structur_id = ?';
            reglementsParams.push(req.structur_id);
        }

        reglementsQuery += ' ORDER BY r.Datereglement ASC';
        
        const [reglements] = await pool.query(reglementsQuery, reglementsParams);

        // Grouping Reglements by Facture
        const reglementsByFacture = {};
        for (const reg of reglements) {
            if (!reglementsByFacture[reg.IDFactures]) {
                reglementsByFacture[reg.IDFactures] = [];
            }
            reglementsByFacture[reg.IDFactures].push(reg);
        }

        // Combine Data exactly like WLangage logic:
        // Invoice logic -> Debit. Payments inside Invoice -> Credit.
        let totalDebit = 0;
        let totalCredit = 0;

        const combinedData = factures.map(facture => {
            const debits = parseFloat(facture.MontantTTCFacture) || 0;
            totalDebit += debits;

            const factureReglements = reglementsByFacture[facture.IDFactures] || [];
            
            let factureTotalCredit = 0;
            const reglementsMapped = factureReglements.map(r => {
                const credit = parseFloat(r.MontantReglement) || 0;
                totalCredit += credit;
                factureTotalCredit += credit;
                return {
                    isReglement: true,
                    IDReglements: r.IDReglements,
                    Dates: r.Datereglement,
                    Observations: `Règlement de la facture Fact n° ${facture.NumeroFacture}`,
                    Numero: `Reg_${r.IDReglements}`,
                    Debit: 0,
                    Credit: credit
                };
            });

            return {
                isFacture: true,
                IDFactures: facture.IDFactures,
                Dates: facture.Datefacture,
                Observations: `Facture dossier ${facture.CodeDossier || ''} - ${facture.Libelle || ''}`,
                Numero: `Fact n° ${facture.NumeroFacture}`,
                Debit: debits,
                Credit: 0,
                reglements: reglementsMapped
            };
        });

        res.json({
            data: combinedData,
            totals: {
                totalDebit,
                totalCredit,
                soldeTotal: totalDebit - totalCredit
            },
            count: combinedData.length
        });

    } catch (error) {
        console.error('Error fetching grand livre:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

/**
 * GET /api/etats-financiers/ca-clients
 * État Chiffre d'Affaires cumulé par client
 */
router.get('/ca-clients', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT 
                c.IDCLIENTS,
                c.NomRS,
                c.NINEA,
                c.adresseClient,
                c.TelClient,
                SUM(f.MontantTTCFacture) as caTTC,
                SUM(f.MontantHTFacture) as caHT
            FROM clients c
            JOIN dossiers d ON c.IDCLIENTS = d.IDCLIENTS
            JOIN factures f ON d.IDDossiers = f.IDDossiers
            WHERE f.Validee = 1
        `;
        let params = [];

        if (!req.user.is_provider) {
            query += ' AND c.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' GROUP BY c.IDCLIENTS ORDER BY c.NomRS ASC';

        const [rows] = await pool.query(query, params);

        let totalCA_TTC = 0;
        let totalCA_HT = 0;

        const mappedData = rows.map(r => {
            const ttc = parseFloat(r.caTTC) || 0;
            const ht = parseFloat(r.caHT) || 0;
            totalCA_TTC += ttc;
            totalCA_HT += ht;
            return {
                id: r.IDCLIENTS,
                NomRS: r.NomRS,
                NINEA: r.NINEA,
                adresseClient: r.adresseClient,
                TelClient: r.TelClient,
                caTTC: ttc,
                caHT: ht
            };
        });

        res.json({
            data: mappedData,
            totals: {
                totalCA_TTC,
                totalCA_HT
            },
            count: mappedData.length
        });

    } catch (error) {
        console.error('Error fetching CA clients:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

/**
 * GET /api/etats-financiers/journal-saari
 * Journal Export SAARI
 */
router.get('/journal-saari', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const { annee, mois } = req.query;

        if (!annee || !mois) {
            return res.status(400).json({ error: 'Veuillez sélectionner l\'année et le mois SVP' });
        }

        // Generate date limits for the month
        const padMois = String(mois).padStart(2, '0');
        const startDate = `${annee}-${padMois}-01`;
        const lastDay = new Date(annee, mois, 0).getDate();
        const endDate = `${annee}-${padMois}-${lastDay}`;

        let query = `
            SELECT 
                f.IDFactures, 
                f.NumeroFacture, 
                f.Datefacture, 
                f.DateEcheance,
                f.MontantTVAFacture, 
                f.MontantRegleFacture,
                d.CodeDossier, 
                d.CodeDossierCourt,
                c.CodeClient, 
                c.NumCompteSAARI, 
                c.NomRS,
                SUM(CASE WHEN l.CodeRubrique LIKE '1%' THEN l.MontantHTFactures ELSE 0 END) as MontantDebours,
                SUM(CASE WHEN l.CodeRubrique LIKE '4%' THEN l.MontantHTFactures ELSE 0 END) as MontantPrestations
            FROM factures f
            LEFT JOIN dossiers d ON f.IDDossiers = d.IDDossiers
            LEFT JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
            LEFT JOIN liaisonfacturesrubriques l ON f.IDFactures = l.IDFactures
            WHERE f.Datefacture BETWEEN ? AND ?
        `;
        let params = [startDate, endDate];

        if (!req.user.is_provider) {
            query += ' AND f.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' GROUP BY f.IDFactures ORDER BY f.Datefacture ASC, f.NumeroFacture ASC';

        const [factures] = await pool.query(query, params);

        let rows = [];
        let pieceNum = 1;

        for (const f of factures) {
            const debours = parseFloat(f.MontantDebours) || 0;
            const prestations = parseFloat(f.MontantPrestations) || 0;
            const tva = parseFloat(f.MontantTVAFacture) || 0;
            const reglement = parseFloat(f.MontantRegleFacture) || 0;
        
            let hasEntries = false;
        
            const baseRow = {
                CodeJournal: "100",
                DateFacture: f.Datefacture,
                NumeroPiece: pieceNum,
                NumeroFacture: f.NumeroFacture,
                CodeDossier: f.CodeDossier || '',
                CodeDossierCourt: f.CodeDossierCourt || 'Néant',
                CodeCompteSAARI: f.NumCompteSAARI || '',
                CodeClient: f.CodeClient || '',
                DateEcheance: f.DateEcheance || null
            };

            if (debours > 0) {
                rows.push({
                    ...baseRow,
                    Libelle: `${f.NumeroFacture} débours`,
                    Debit: debours,
                    Credit: 0,
                    CompteSAARI: "471500"
                });
                hasEntries = true;
            }
        
            if (prestations > 0) {
                rows.push({
                    ...baseRow,
                    Libelle: `${f.NumeroFacture} prestations`,
                    Debit: prestations,
                    Credit: 0,
                    CompteSAARI: "70"
                });
                hasEntries = true;
            }
        
            if (tva > 0) {
                rows.push({
                    ...baseRow,
                    Libelle: `${f.NumeroFacture} TVA`,
                    Debit: tva,
                    Credit: 0,
                    CompteSAARI: "443200"
                });
                hasEntries = true;
            }
        
            if (reglement > 0) {
                rows.push({
                    ...baseRow,
                    Libelle: `Règlement ${f.NumeroFacture}`,
                    Debit: 0,
                    Credit: reglement,
                    CompteSAARI: f.NumCompteSAARI || ''
                });
                hasEntries = true;
            }
        
            if (hasEntries) {
                pieceNum++;
            }
        }

        res.json({
            data: rows,
            count: rows.length
        });

    } catch (error) {
        console.error('Error fetching journal saari:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

module.exports = router;
