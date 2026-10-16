const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const auditService = require('../services/auditService');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/notes - List notes (optional filter by dossier_id)
router.get('/', checkPermission('NOTES', 'can_view'), async (req, res) => {
    try {
        const { dossier_id } = req.query;
        let query = `
            SELECT n.*, d.Libelle as dossier_label, s.NomSociete as company_name,
                   a.NomAgent as agent_name
            FROM notesdedetails n
            JOIN dossiers d ON n.IDDossiers = d.IDDossiers
            JOIN structur s ON d.structur_id = s.IDSociete
            LEFT JOIN agents a ON n.IdAgent = a.IDAgents
            WHERE n.deleted_at IS NULL
        `;
        const params = [];

        if (!req.is_viewing_all) {
            query += ' AND d.structur_id = ?';
            params.push(req.structur_id);
            if (dossier_id) {
                query += ' AND n.IDDossiers = ?';
                params.push(dossier_id);
            }
        } else if (dossier_id) {
            query += ' AND n.IDDossiers = ?';
            params.push(dossier_id);
        }

        query += ' ORDER BY n.DateCreation DESC';

        const [notes] = await pool.query(query, params);
        res.json(notes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/notes - Create a new note
router.post('/', checkPermission('NOTES', 'can_create'), async (req, res) => {
    try {
        const { IDDossiers, Repertoire, NINEA, Provenance } = req.body;

        // Verify dossier ownership
        const [dossier] = await pool.query('SELECT IDDossiers FROM dossiers WHERE IDDossiers = ? AND (structur_id = ? OR ? = 1)',
            [IDDossiers, req.structur_id, req.user.is_provider ? 1 : 0]);

        if (dossier.length === 0) {
            return res.status(403).json({ error: 'Dossier not found or access denied' });
        }

        // Generate REPERTOIRE if not provided.
        // We use MAX of existing sequence numbers (not COUNT) because COUNT
        // breaks when notes are deleted or when 2 inserts race. We also retry
        // on ER_DUP_ENTRY (race condition) up to 5 times.
        const year = new Date().getFullYear();
        const computeNextRepertoire = async () => {
            const [maxRow] = await pool.query(
                `SELECT REPERTOIRE FROM notesdedetails
                 WHERE REPERTOIRE LIKE ?
                 ORDER BY substring(REPERTOIRE from '(\\d+)$')::bigint DESC NULLS LAST
                 LIMIT 1`,
                [`REP-${year}-%`]
            );
            let nextSeq = 1;
            if (maxRow.length > 0 && maxRow[0].REPERTOIRE) {
                const lastSeq = parseInt(maxRow[0].REPERTOIRE.split('-').pop(), 10);
                if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
            }
            return `REP-${year}-${nextSeq.toString().padStart(4, '0')}`;
        };

        let repertoire = Repertoire;
        const autoGenerate = !repertoire || repertoire.trim() === '';

        let result;
        let attempts = 0;
        const maxAttempts = 5;
        while (true) {
            if (autoGenerate) repertoire = await computeNextRepertoire();
            try {
                [result] = await pool.query(
                    'INSERT INTO notesdedetails (IDDossiers, REPERTOIRE, NINEA, CodeProvenance, IdAgent, DateCreation) VALUES (?, ?, ?, ?, ?, NOW())',
                    [IDDossiers, repertoire, NINEA, Provenance, req.user.id]
                );
                break;
            } catch (e) {
                attempts++;
                if (autoGenerate && e.code === 'ER_DUP_ENTRY' && attempts < maxAttempts) {
                    // Race: another insert took our number. Recompute and retry.
                    continue;
                }
                throw e;
            }
        }

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'NOTE',
            resource_id: result.insertId,
            details: { repertoire, IDDossiers },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({ id: result.insertId, message: 'Note created successfully', repertoire });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/notes/:id - Get note details
router.get('/:id', checkPermission('NOTES', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT n.*
            FROM notesdedetails n
            JOIN dossiers d ON n.IDDossiers = d.IDDossiers
            WHERE n.IDNotesDeDetails = ? AND n.deleted_at IS NULL
        `;
        let params = [req.params.id];

        if (!req.user.is_provider) {
            query += ' AND d.structur_id = ?';
            params.push(req.structur_id);
        }

        const [notes] = await pool.query(query, params);
        if (notes.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.json(notes[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/notes/:id - Update note
router.put('/:id', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    try {
        const { Repertoire, NINEA, Provenance } = req.body;

        // Verify ownership
        let checkQuery = `
            SELECT n.IDNotesDeDetails, n.Valide
            FROM notesdedetails n
            JOIN dossiers d ON n.IDDossiers = d.IDDossiers
            WHERE n.IDNotesDeDetails = ? AND n.deleted_at IS NULL
        `;
        let checkParams = [req.params.id];
        if (!req.user.is_provider) {
            checkQuery += ' AND d.structur_id = ?';
            checkParams.push(req.structur_id);
        }

        const [exist] = await pool.query(checkQuery, checkParams);
        if (exist.length === 0) return res.status(404).json({ error: 'Note not found' });
        if (exist[0].Valide === 1) return res.status(400).json({ error: 'Note is validated and cannot be modified' });

        await pool.query(
            'UPDATE notesdedetails SET REPERTOIRE = ?, NINEA = ?, CodeProvenance = ? WHERE IDNotesDeDetails = ?',
            [Repertoire, NINEA, Provenance, req.params.id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'NOTE',
            resource_id: req.params.id,
            details: { repertoire: Repertoire },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Note updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/notes/:id - Delete note
router.delete('/:id', checkPermission('NOTES', 'can_delete'), async (req, res) => {
    try {
        let checkQuery = `
            SELECT n.IDNotesDeDetails
            FROM notesdedetails n
            JOIN dossiers d ON n.IDDossiers = d.IDDossiers
            WHERE n.IDNotesDeDetails = ? AND n.deleted_at IS NULL
        `;
        let checkParams = [req.params.id];
        if (!req.user.is_provider) {
            checkQuery += ' AND d.structur_id = ?';
            checkParams.push(req.structur_id);
        }

        const [exist] = await pool.query(checkQuery, checkParams);
        if (exist.length === 0) return res.status(404).json({ error: 'Note not found' });

        // Soft delete: set deleted_at instead of physical DELETE
        await pool.query(
            'UPDATE notesdedetails SET deleted_at = NOW() WHERE IDNotesDeDetails = ?',
            [req.params.id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'NOTE',
            resource_id: req.params.id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Note deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/notes/:id/distribute - Calculate global distribution
router.post('/:id/distribute', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const noteId = req.params.id;
        const { globalFret, globalAssurance, globalWeight } = req.body;

        await connection.beginTransaction();

        // Ownership check
        let checkQuery = `
            SELECT n.IDNotesDeDetails 
            FROM notesdedetails n
            JOIN dossiers d ON n.IDDossiers = d.IDDossiers
            WHERE n.IDNotesDeDetails = ?
        `;
        let checkParams = [noteId];
        if (!req.user.is_provider) {
            checkQuery += ' AND d.structur_id = ?';
            checkParams.push(req.structur_id);
        }
        const [exist] = await connection.query(checkQuery, checkParams);
        if (exist.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Note not found' });
        }

        // Get all articles for this note
        const [articles] = await connection.query(
            'SELECT IDArticles, FOB, BRUT FROM articles WHERE IDNotesDeDetails = ?',
            [noteId]
        );

        if (articles.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'No articles found for this note' });
        }

        // Calculate total FOB and total weight
        const totalFOB = articles.reduce((sum, art) => sum + parseFloat(art.FOB || 0), 0);
        const totalWeight = articles.reduce((sum, art) => sum + parseFloat(art.BRUT || 0), 0);

        if (totalFOB === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Total FOB is zero, cannot distribute' });
        }

        // Calculate coefficients
        // Calculate coefficients based on Total FOB
        const fretCoefficient = totalFOB > 0 ? parseFloat(globalFret || 0) / totalFOB : 0;
        const assuranceCoefficient = totalFOB > 0 ? parseFloat(globalAssurance || 0) / totalFOB : 0;
        const weightCoefficient = totalFOB > 0 ? parseFloat(globalWeight || 0) / totalFOB : 0;

        // Update each article with distributed values
        for (const article of articles) {
            const articleFOB = parseFloat(article.FOB || 0);

            const distributedFret = articleFOB * fretCoefficient;
            const distributedAssurance = articleFOB * assuranceCoefficient;
            const distributedWeight = articleFOB * weightCoefficient;

            await connection.query(
                `UPDATE articles 
                 SET FRET = ?, ASSURANCES = ?, BRUT = ?
                 WHERE IDArticles = ?`,
                [distributedFret, distributedAssurance, distributedWeight, article.IDArticles]
            );
        }

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DISTRIBUTE',
            resource_type: 'NOTE',
            resource_id: noteId,
            details: { globalFret, globalAssurance, globalWeight },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        await connection.commit();

        res.json({
            message: 'Distribution completed successfully',
            totalFOB,
            totalWeight,
            coefficients: {
                fret: fretCoefficient,
                assurance: assuranceCoefficient,
                weight: weightCoefficient
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        connection.release();
    }
});

// POST /api/notes/:id/convert-to-fcfa - Convert all article values to FCFA
router.post('/:id/convert-to-fcfa', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const noteId = req.params.id;
        await connection.beginTransaction();

        // Ownership check
        let checkQuery = 'SELECT n.IDNotesDeDetails FROM notesdedetails n JOIN dossiers d ON n.IDDossiers = d.IDDossiers WHERE n.IDNotesDeDetails = ? AND n.deleted_at IS NULL';
        let checkParams = [noteId];
        if (!req.user.is_provider) {
            checkQuery += ' AND d.structur_id = ?';
            checkParams.push(req.structur_id);
        }
        const [exist] = await connection.query(checkQuery, checkParams);
        if (exist.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Note not found' }); }

        // Get all articles for this note
        const [articles] = await connection.query(
            'SELECT IDArticles, FOB, FRET, ASSURANCES, IDDEVISEFOB, IDDEVISEFRET, IDDEVISEASS FROM articles WHERE IDNotesDeDetails = ?',
            [noteId]
        );

        if (articles.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'No articles found for this note' });
        }

        // Get all exchange rates
        const [devises] = await connection.query('SELECT IDDevises, TauxChangeDeviseCFA FROM devises');
        const exchangeRates = {};
        devises.forEach(d => {
            exchangeRates[d.IDDevises] = parseFloat(d.TauxChangeDeviseCFA || 1);
        });

        // Convert each article
        for (const article of articles) {
            const fobRate = exchangeRates[article.IDDEVISEFOB] || 1;
            const fretRate = exchangeRates[article.IDDEVISEFRET] || 1;
            const assRate = exchangeRates[article.IDDEVISEASS] || 1;

            const fobCFA = parseFloat(article.FOB || 0) * fobRate;
            const fretCFA = parseFloat(article.FRET || 0) * fretRate;
            const assCFA = parseFloat(article.ASSURANCES || 0) * assRate;
            const caf = fobCFA + fretCFA + assCFA;

            await connection.query(
                `UPDATE articles 
                 SET FOBCFA = ?, FRETCFA = ?, ASSURANCESCFA = ?, CAF = ?
                 WHERE IDArticles = ?`,
                [fobCFA, fretCFA, assCFA, caf, article.IDArticles]
            );
        }

        await connection.commit();

        res.json({ message: 'Currency conversion completed successfully' });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        connection.release();
    }
});

// --- Articles ---

// GET /api/notes/:id/articles - Get articles for a note
router.get('/:id/articles', checkPermission('NOTES', 'can_view'), async (req, res) => {
    try {
        const [articles] = await pool.query(
            `SELECT a.* FROM articles a 
             JOIN notesdedetails n ON a.IDNotesDeDetails = n.IDNotesDeDetails
             JOIN dossiers d ON n.IDDossiers = d.IDDossiers
             WHERE a.IDNotesDeDetails = ? ${!req.user.is_provider ? 'AND d.structur_id = ?' : ''} 
             ORDER BY a.NumeroArticle`,
            !req.user.is_provider ? [req.params.id, req.structur_id] : [req.params.id]
        );
        res.json(articles);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/notes/:id/articles - Add article to note
router.post('/:id/articles', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    try {
        const IDNotesDeDetails = req.params.id;
        const {
            NumeroArticle, NTS, Libelle, CodeRegimeDeclaration, Origine, Provenance,
            FOB, Fret, Assurances, IdAgent, DPI, TitreExo, BRUT, NET, QC, QM,
            CommissionFournisseur, NBCOLIS, IDDEVISEFOB, IDDEVISEFRET, IDDEVISEASS
        } = req.body;

        // Expanded insert with all fields from schema
        const [result] = await pool.query(
            `INSERT INTO articles (
                IDNotesDeDetails, NumeroArticle, NTS, Libelle, CodeRegimeDeclaration, 
                Origine, Provenance, FOB, FRET, ASSURANCES, IdAgent,
                DPI, TitreExo, BRUT, NET, QC, QM, CommissionFournisseur, NBCOLIS, 
                IDDEVISEFOB, IDDEVISEFRET, IDDEVISEASS
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                IDNotesDeDetails, NumeroArticle, NTS, Libelle, CodeRegimeDeclaration,
                Origine, Provenance, FOB || 0, Fret || 0, Assurances || 0, IdAgent,
                DPI, TitreExo, BRUT || 0, NET || 0, QC || 0, QM || 0,
                CommissionFournisseur || 0, NBCOLIS || null,
                IDDEVISEFOB || 1, IDDEVISEFRET || 1, IDDEVISEASS || 1
            ]
        );

        res.status(201).json({ id: result.insertId, message: 'Article added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/notes/articles/:id - Update article (Note: route path adjusted to avoid conflict)
router.put('/articles/:id', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    try {
        const {
            NTS, Libelle, CodeRegimeDeclaration, Origine, Provenance,
            FOB, Fret, Assurances, DPI, TitreExo, BRUT, NET, QC, QM,
            CommissionFournisseur, NBCOLIS, IDDEVISEFOB, IDDEVISEFRET, IDDEVISEASS
        } = req.body;

        const toFloat = v => (v === '' || v === null || v === undefined) ? 0 : parseFloat(v) || 0;
        const toInt   = v => (v === '' || v === null || v === undefined) ? 0 : parseInt(v)   || 0;

        await pool.query(
            `UPDATE articles SET
                NTS = ?, Libelle = ?, CodeRegimeDeclaration = ?,
                Origine = ?, Provenance = ?, FOB = ?, FRET = ?, ASSURANCES = ?,
                DPI = ?, TitreExo = ?, BRUT = ?, NET = ?, QC = ?, QM = ?,
                CommissionFournisseur = ?, NBCOLIS = ?,
                IDDEVISEFOB = ?, IDDEVISEFRET = ?, IDDEVISEASS = ?
            WHERE IDArticles = ?`,
            [
                NTS || null, Libelle || null, CodeRegimeDeclaration || null,
                Origine || null, Provenance || null,
                toFloat(FOB), toFloat(Fret), toFloat(Assurances),
                DPI || null, TitreExo || null,
                toFloat(BRUT), toFloat(NET), toFloat(QC), toFloat(QM),
                toFloat(CommissionFournisseur), toInt(NBCOLIS),
                toInt(IDDEVISEFOB) || 1, toInt(IDDEVISEFRET) || 1, toInt(IDDEVISEASS) || 1,
                req.params.id
            ]
        );
        res.json({ message: 'Article updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/notes/articles/:id - Delete article
router.delete('/articles/:id', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    try {
        await pool.query('DELETE FROM articles WHERE IDArticles = ?', [req.params.id]);
        res.json({ message: 'Article deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/notes/articles/:id/calculate-taxes - Calculate taxes for an article
router.post('/articles/:id/calculate-taxes', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const articleId = req.params.id;
        const { excludedTaxCodes } = req.body;

        await connection.beginTransaction();

        // 1. Get article details
        const [articles] = await connection.query('SELECT * FROM articles WHERE IDArticles = ?', [articleId]);
        if (articles.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Article not found' });
        }

        const article = articles[0];

        // 2. Fetch Exchange Rates and Calculate CFA
        const [devises] = await connection.query('SELECT IDDevises, TauxChangeDeviseCFA FROM devises');
        const devisesMap = {};
        devises.forEach(d => devisesMap[d.IDDevises] = parseFloat(d.TauxChangeDeviseCFA || 1));

        const rateFob = devisesMap[article.IDDEVISEFOB] || 1;
        const rateFret = devisesMap[article.IDDEVISEFRET] || 1;
        const rateAss = devisesMap[article.IDDEVISEASS] || 1;

        const FOBCFA = Math.round(parseFloat(article.FOB || article.fob || 0) * rateFob);
        const FRETCFA = Math.round(parseFloat(article.FRET || article.Fret || article.fret || 0) * rateFret);
        const ASSURANCESCFA = Math.round(parseFloat(article.ASSURANCES || article.Assurances || article.assurances || 0) * rateAss);
        const Commission = Math.round(parseFloat(article.CommissionFournisseur || article.commissionfournisseur || 0));

        const CAF = FOBCFA + FRETCFA + ASSURANCESCFA + Commission;

        await connection.query(
            'UPDATE articles SET FOBCFA=?, FRETCFA=?, ASSURANCESCFA=?, CAF=? WHERE IDArticles=?',
            [FOBCFA, FRETCFA, ASSURANCESCFA, CAF, articleId]
        );

        // 3. Clear existing liquidations for this article
        await connection.query('DELETE FROM liquidations_articles WHERE IDArticles = ?', [articleId]);

        // 4. Get all taxes and applicable tariffs
        const [allTaxes] = await connection.query('SELECT * FROM taxes ORDER BY Niveau ASC');

        const [tarifs] = await connection.query(
            `SELECT t.*, ta.CodeTaux, ta.Taux as Valeur
             FROM tarifs t
             LEFT JOIN taux ta ON t.IDTaux = ta.IDTaux
             WHERE t.NTS = ?`,
            [article.NTS]
        );

        // Map tariffs by CodeTaxe for easy lookup
        const tarifsMap = {};
        tarifs.forEach(t => {
            tarifsMap[t.CodeTaxe] = t;
        });

        // 5. Get tax complements (dependencies)
        const [complements] = await connection.query(
            `SELECT tc.*, tp.CodeTaxe as PrincipalCode, tc_comp.CodeTaxe as ComplementCode
             FROM taxes_complements tc
             JOIN taxes tp ON tc.IDTaxesPrincipal = tp.IDTaxes
             JOIN taxes tc_comp ON tc.IDTaxesComplement = tc_comp.IDTaxes`
        );

        const complementsMap = {};
        complements.forEach(c => {
            if (!complementsMap[c.PrincipalCode]) {
                complementsMap[c.PrincipalCode] = [];
            }
            complementsMap[c.PrincipalCode].push(c.ComplementCode);
        });

        const calculatedTaxes = [];
        const calculatedAmounts = {};

        // 6. Calculate taxes in order (using all taxes)
        for (const tax of allTaxes) {
            const taxCode = tax.CodeTaxe;
            const tarif = tarifsMap[taxCode];

            // If no tariff found for this NTS + Tax, it is not applicable
            if (!tarif) {
                calculatedTaxes.push({
                    IDArticles: articleId,
                    IDTaxes: tax.IDTaxes,
                    CodeTaxe: taxCode,
                    LibelleTaxe: tax.LibelleTaxe,
                    Taux: 0,
                    Montant: 0,
                    IsExcluded: false,
                    IsApplicable: false
                });
                continue;
            }

            const taxBaseType = (tax.Base || 'V').toUpperCase(); // Use Base from Tax definition
            const taxRate = parseFloat(tarif.Valeur || 0);

            // Check if excluded
            const isExcluded = excludedTaxCodes && excludedTaxCodes.includes(taxCode);

            let baseValue = 0;
            let amount = 0;

            if (!isExcluded) {
                if (taxBaseType === 'V' || taxBaseType === 'VALEUR') {
                    baseValue = CAF;
                } else if (taxBaseType === 'P' || taxBaseType === 'POIDS') {
                    baseValue = parseFloat(article.BRUT || 0);
                } else if (taxBaseType === 'QC') {
                    baseValue = parseFloat(article.QC || 0);
                } else if (taxBaseType === 'QM') {
                    baseValue = parseFloat(article.QM || 0);
                } else {
                    baseValue = 0;
                }

                if (tax.Niveau > 1 && complementsMap[taxCode]) {
                    for (const compCode of complementsMap[taxCode]) {
                        baseValue += calculatedAmounts[compCode] || 0;
                    }
                }

                amount = Math.round((baseValue * taxRate) / 100);
                calculatedAmounts[taxCode] = amount;
            }

            calculatedTaxes.push({
                IDArticles: articleId,
                IDTaxes: tax.IDTaxes,
                CodeTaxe: taxCode,
                LibelleTaxe: tax.LibelleTaxe,
                Taux: taxRate,
                Montant: amount,
                IsExcluded: isExcluded,
                IsApplicable: true
            });

            if (!isExcluded) {
                await connection.query(
                    `INSERT INTO liquidations_articles 
                    (IDArticles, IDTaxes, CodeTaxe, LibelleTaxe, IDTaux, TauxApplique, BaseCalcul, Montant)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        articleId, tax.IDTaxes, taxCode, tax.LibelleTaxe,
                        tarif.IDTaux, taxRate, baseValue, amount
                    ]
                );
            }
        }

        await connection.commit();

        res.json({
            CAF: CAF.toFixed(0),
            taxes: calculatedTaxes.map(t => ({
                ...t,
                Montant: t.Montant.toFixed(0) // Return rounded amounts
            })),
            total: Object.values(calculatedAmounts).reduce((a, b) => a + b, 0).toFixed(0)
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('calculate-taxes error:', error.message, error.stack);
        res.status(500).json({ error: error.message || 'Server error' });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE /api/notes/articles/:id/liquidations - Clear liquidations for an article (Annuler)
router.delete('/articles/:id/liquidations', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    try {
        const articleId = req.params.id;
        await pool.query('DELETE FROM liquidations_articles WHERE IDArticles = ?', [articleId]);
        res.json({ message: 'Liquidation annulée' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- PDF Generation ---

const NoteDetailPDFGenerator = require('../services/pdfGenerator');
const path = require('path');

// GET /api/notes/:id/generate-pdf - Generate and download PDF for note de détail
router.get('/:id/generate-pdf', checkPermission('NOTES', 'can_view'), async (req, res) => {
    try {
        const noteId = req.params.id;

        // Check if note exists
        const [notes] = await pool.query('SELECT * FROM notesdedetails WHERE IDNotesDeDetails = ?', [noteId]);
        if (notes.length === 0) {
            return res.status(404).json({ error: 'Note de détail not found' });
        }

        // Generate PDF
        const pdfGenerator = new NoteDetailPDFGenerator(pool);
        const pdfPath = await pdfGenerator.generatePDF(noteId);

        // Send the file for download
        const filename = path.basename(pdfPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const fs = require('fs');
        const fileStream = fs.createReadStream(pdfPath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ error: 'Error generating PDF: ' + error.message });
    }
});

// POST /api/notes/:id/validate - Validate a note de détail (blocks further modifications)
router.post('/:id/validate', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    try {
        const noteId = req.params.id;

        // Check ownership
        let checkQuery = 'SELECT n.IDNotesDeDetails FROM notesdedetails n JOIN dossiers d ON n.IDDossiers = d.IDDossiers WHERE n.IDNotesDeDetails = ? AND n.deleted_at IS NULL';
        let checkParams = [noteId];
        if (!req.user.is_provider) {
            checkQuery += ' AND d.structur_id = ?';
            checkParams.push(req.structur_id);
        }
        const [exist] = await pool.query(checkQuery, checkParams);
        if (exist.length === 0) return res.status(404).json({ error: 'Note not found' });

        // Update Valide field to 1
        await pool.query('UPDATE notesdedetails SET Valide = 1 WHERE IDNotesDeDetails = ?', [noteId]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'VALIDATE',
            resource_type: 'NOTE',
            resource_id: noteId,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Note de détail validée avec succès', validated: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/notes/:id/unvalidate - Unvalidate a note de détail (re-opens modifications)
router.post('/:id/unvalidate', checkPermission('NOTES', 'can_edit'), async (req, res) => {
    try {
        const noteId = req.params.id;

        let checkQuery = 'SELECT n.IDNotesDeDetails FROM notesdedetails n JOIN dossiers d ON n.IDDossiers = d.IDDossiers WHERE n.IDNotesDeDetails = ? AND n.deleted_at IS NULL';
        let checkParams = [noteId];
        if (!req.user.is_provider) {
            checkQuery += ' AND d.structur_id = ?';
            checkParams.push(req.structur_id);
        }
        const [exist] = await pool.query(checkQuery, checkParams);
        if (exist.length === 0) return res.status(404).json({ error: 'Note not found' });

        await pool.query('UPDATE notesdedetails SET Valide = 0 WHERE IDNotesDeDetails = ?', [noteId]);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UNVALIDATE',
            resource_type: 'NOTE',
            resource_id: noteId,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Note de détail dévalidée avec succès', validated: false });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/notes/:id/pdf-status - Check if note has been validated
router.get('/:id/pdf-status', checkPermission('NOTES', 'can_view'), async (req, res) => {
    try {
        const noteId = req.params.id;
        const [notes] = await pool.query('SELECT Valide FROM notesdedetails WHERE IDNotesDeDetails = ?', [noteId]);

        if (notes.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json({ validated: notes[0].Valide === 1 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

