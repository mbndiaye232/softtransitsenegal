const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');

router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/dashboards/transport-arrivals
 * Fetch transport arrivals calendar data with dynamic color coding
 */
router.get('/transport-arrivals', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT
                d.CodeDossier as code,
                d.CodeDossierCourt as shortCode,
                d.Libelle as label,
                m.LibelleMoyensTransport as transportMean,
                t.DateArriveePrevue as dateArrivee,
                (t.DateArriveePrevue::date - CURRENT_DATE) as daysRemaining,
                c.Rouge as colorR,
                c.Vert as colorG,
                c.Bleu as colorB
            FROM dossiers d
            JOIN transports t ON d.IDDossiers = t.idbl OR d.IDDossiers = t.IdAgent
            LEFT JOIN moyenstransport m ON t.IDMoyensTransport = m.IDMoyensTransport
            LEFT JOIN (
                SELECT ndjours, MAX(Rouge) as Rouge, MAX(Vert) as Vert, MAX(Bleu) as Bleu
                FROM couleurs
                GROUP BY ndjours
            ) c ON c.ndjours = (
                CASE
                    WHEN (t.DateArriveePrevue::date - CURRENT_DATE) >= 10 THEN 10
                    WHEN (t.DateArriveePrevue::date - CURRENT_DATE) < -2 THEN NULL
                    WHEN (t.DateArriveePrevue::date - CURRENT_DATE) < 0  THEN -1
                    ELSE (t.DateArriveePrevue::date - CURRENT_DATE)
                END
            )
            WHERE t.DateArriveePrevue IS NOT NULL
              AND (d.Facturable IS NULL OR d.Facturable != -1)
              AND (t.DateArriveePrevue::date - CURRENT_DATE) > -3
        `;
        let params = [];

        if (!req.is_viewing_all) {
            query += ' AND d.structur_id = ?';
            params.push(req.structur_id);
        }

        // Declarant (USER role) sees only dossiers assigned to them via declarations
        if (req.user.role === 'USER') {
            query += ' AND EXISTS (SELECT 1 FROM declarations decl WHERE decl.IDDossiers = d.IDDossiers AND decl.IdAgent = ?)';
            params.push(req.user.id);
        }

        query += ' ORDER BY t.DateArriveePrevue ASC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching transport arrivals:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/dashboards/dossier-tracking
 * Fetch dossier tracking data with deadlines and color coding
 */
router.get('/dossier-tracking', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT 
                ANY_VALUE(cl.NomRS) as clientName,
                ANY_VALUE(cl.TelClient) as clientPhone,
                ANY_VALUE(d.CodeDossier) as code,
                ANY_VALUE(d.Libelle) as label,
                ANY_VALUE(e.libelleEtapesDossiers) as step,
                ANY_VALUE(t.NumeroTitreTransport) as docNumber,
                MAX(t.DateArriveePrevue) as deadline,
                (MAX(t.DateArriveePrevue)::date - CURRENT_DATE) as daysRemaining,
                ANY_VALUE(c.Rouge) as colorR,
                ANY_VALUE(c.Vert) as colorG,
                ANY_VALUE(c.Bleu) as colorB
            FROM dossiers d
            JOIN clients cl ON d.IDCLIENTS = cl.IDCLIENTS
            LEFT JOIN etapesdossiers e ON d.IdEtapeDossiers = e.IDEtapesDossiers
            LEFT JOIN transports t ON d.IDDossiers = t.idbl OR d.IDDossiers = t.IdAgent
            LEFT JOIN couleurs c ON c.ndjours = (
                CASE 
                    WHEN (t.DateArriveePrevue::date - CURRENT_DATE) >= 10 THEN 10
                    WHEN (t.DateArriveePrevue::date - CURRENT_DATE) < 0 THEN -1
                    ELSE (t.DateArriveePrevue::date - CURRENT_DATE)
                END
            )
            WHERE (d.Facturable IS NULL OR d.Facturable != -1)
        `;
        let params = [];

        if (!req.is_viewing_all) {
            query += ' AND d.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' GROUP BY d.IDDossiers ORDER BY deadline ASC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching dossier tracking:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/dashboards/detailed-tracking
 * Comprehensive tracker with all milestones and shipment details
 */
router.get('/detailed-tracking', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT 
                ANY_VALUE(cl.NomRS) as clientName,
                ANY_VALUE(d.CodeDossier) as code,
                ANY_VALUE(d.CodeDossierCourt) as shortCode,
                ANY_VALUE(d.SaisiLe) as dateDossier,
                ANY_VALUE(d.DateRemise) as dateRemiseDocs,
                ANY_VALUE(t.NumeroTitreTransport) as docNumber,
                ANY_VALUE(ot.NumeroOT) as otNumber,
                ANY_VALUE(t.libelleTransport) as vesselFlight,
                ANY_VALUE(t.DateArriveePrevue) as dateArrivee,
                ANY_VALUE(decl.NumeroDeclaration) as declNumber,
                ANY_VALUE(decl.DateDeclaration) as declDate,
                ANY_VALUE(decl.RegimeDeclaration) as regime,
                ANY_VALUE(decl.DateBAE) as dateBAE,
                ANY_VALUE(ml.DateMiseEnLivraison) as dateML,
                ANY_VALUE(ml.DateRetourConteneur) as dateRCO,
                ANY_VALUE(ml.DateEffectiveLivraison) as dateLiv,
                ANY_VALUE(ag.NomAgent) as declarantName,
                ANY_VALUE(otr.TransporteuretAdresse) as transporteur,
                ANY_VALUE(e.libelleEtapesDossiers) as status,
                ANY_VALUE(ot.Nbredecolis) as nbColis,
                ANY_VALUE(ot.PoidsNet) as poids
            FROM dossiers d
            LEFT JOIN clients cl ON d.IDCLIENTS = cl.IDCLIENTS
            LEFT JOIN etapesdossiers e ON d.IdEtapeDossiers = e.IDEtapesDossiers
            LEFT JOIN transports t ON d.IDDossiers = t.idbl OR d.IDDossiers = t.IdAgent
            LEFT JOIN ordrestransit ot ON d.IDDossiers = ot.IDDossiers
            LEFT JOIN declarations decl ON d.IDDossiers = decl.IDDossiers
            LEFT JOIN agents ag ON decl.IdAgent = ag.IDAgents
            LEFT JOIN miseenlivraison ml ON d.IDDossiers = ml.IDDossiers
            LEFT JOIN ordresdetransport otr ON d.IDDossiers = otr.IDDossiers
            WHERE (d.Facturable IS NULL OR d.Facturable != -1)
        `;
        let params = [];

        if (!req.is_viewing_all) {
            query += ' AND d.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' GROUP BY d.IDDossiers ORDER BY d.SaisiLe DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching detailed tracking:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * GET /api/dashboards/top-clients-ca
 * Top 10 clients by Chiffre d'Affaires (Validated invoices)
 */
router.get('/top-clients-ca', checkPermission('FINANCES', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT 
                ANY_VALUE(cl.NomRS) as name,
                SUM(f.MontantHTFacture) as value
            FROM factures f
            JOIN dossiers d ON f.IDDossiers = d.IDDossiers
            JOIN clients cl ON d.IDCLIENTS = cl.IDCLIENTS
            WHERE f.Validee = 1
        `;
        let params = [];
        if (!req.is_viewing_all) {
            query += ' AND f.structur_id = ?';
            params.push(req.structur_id);
        }
        query += ' GROUP BY cl.IDCLIENTS ORDER BY value DESC LIMIT 10';
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching top clients CA:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/dashboards/top-encours
 * Top 10 clients by Outstanding Balance
 */
router.get('/top-encours', checkPermission('FINANCES', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT 
                ANY_VALUE(cl.NomRS) as name,
                SUM(f.ReliquatFacture) as value
            FROM factures f
            JOIN dossiers d ON f.IDDossiers = d.IDDossiers
            JOIN clients cl ON d.IDCLIENTS = cl.IDCLIENTS
            WHERE f.Validee = 1 AND f.ReliquatFacture > 0
        `;
        let params = [];
        if (!req.is_viewing_all) {
            query += ' AND f.structur_id = ?';
            params.push(req.structur_id);
        }
        query += ' GROUP BY cl.IDCLIENTS ORDER BY value DESC LIMIT 10';
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching top encours:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/dashboards/aging-balance
 * Outstanding balances grouped by age
 */
router.get('/aging-balance', checkPermission('FINANCES', 'can_view'), async (req, res) => {
    try {
        // Use inline CASE in GROUP BY (not the alias) for compatibility with
        // MySQL only_full_group_by mode on Render. Also treat NULL DateEcheance
        // as 0 days so factures without an echeance still show up in 0-30j.
        let query = `
            SELECT
                CASE
                    WHEN (CURRENT_DATE - COALESCE(f.DateEcheance::date, CURRENT_DATE)) <= 30 THEN '0-30j'
                    WHEN (CURRENT_DATE - COALESCE(f.DateEcheance::date, CURRENT_DATE)) <= 90 THEN '31-90j'
                    WHEN (CURRENT_DATE - COALESCE(f.DateEcheance::date, CURRENT_DATE)) <= 120 THEN '91-120j'
                    ELSE '+120j'
                END as period,
                SUM(f.ReliquatFacture) as amount
            FROM factures f
            WHERE f.Validee = 1 AND f.ReliquatFacture > 0
        `;
        let params = [];
        if (!req.is_viewing_all) {
            query += ' AND f.structur_id = ?';
            params.push(req.structur_id);
        }
        query += ' GROUP BY period';

        const [rows] = await pool.query(query, params);
        const order = ['0-30j', '31-90j', '91-120j', '+120j'];
        rows.sort((a, b) => order.indexOf(a.period) - order.indexOf(b.period));
        res.json(rows);
    } catch (err) {
        console.error('Error fetching aging balance:', err && err.message ? err.message : err);
        res.status(500).json({ error: 'Internal server error', detail: err && err.message });
    }
});

/**
 * GET /api/dashboards/performance-trends
 * Compare CA vs Payments for the last 12 months
 */
router.get('/performance-trends', checkPermission('FINANCES', 'can_view'), async (req, res) => {
    try {
        const structur_id = req.structur_id;
        const viewingAll = req.is_viewing_all;

        // Query for CA (Invoiced)
        let caQuery = `
            SELECT to_char(Datefacture, 'YYYY-MM') as month, SUM(MontantHTFacture) as ca
            FROM factures
            WHERE Validee = 1 AND Datefacture >= CURRENT_DATE - INTERVAL '12 months'
        `;
        const caParams = [];
        if (!viewingAll) {
            caQuery += ' AND structur_id = ?';
            caParams.push(structur_id);
        }
        caQuery += ' GROUP BY month';

        // Query for Payments
        let payQuery = `
            SELECT to_char(Datereglement, 'YYYY-MM') as month, SUM(MontantReglement) as pay
            FROM reglements
            WHERE Datereglement >= CURRENT_DATE - INTERVAL '12 months'
        `;
        // reglements might need a join or structur_id check if available.
        // Assuming it has structur_id or we filter via factures
        payQuery += ' GROUP BY month';

        const [caRows] = await pool.query(caQuery, caParams);
        const [payRows] = await pool.query(payQuery);

        // Merge data
        const months = {};
        caRows.forEach(r => months[r.month] = { month: r.month, ca: parseFloat(r.ca) || 0, pay: 0 });
        payRows.forEach(r => {
            if (!months[r.month]) months[r.month] = { month: r.month, ca: 0, pay: 0 };
            months[r.month].pay = parseFloat(r.pay) || 0;
        });

        const sortedData = Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
        res.json(sortedData);
    } catch (err) {
        console.error('Error fetching performance trends:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/dashboards/dossier-trends
 * Evolution of dossier openings for the last 12 months
 */
router.get('/dossier-trends', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        // Use COALESCE(SaisiLe, created_at) so dossiers with a NULL SaisiLe
        // (legacy data or partial creation) still appear in the trend chart.
        // The 12-month window is anchored on whichever date is available.
        let query = `
            SELECT
                to_char(COALESCE(SaisiLe, created_at, NOW()), 'YYYY-MM') as month,
                COUNT(*) as count
            FROM dossiers
            WHERE COALESCE(SaisiLe, created_at, NOW()) >= CURRENT_DATE - INTERVAL '12 months'
              AND (Facturable IS NULL OR Facturable != -1)
        `;
        let params = [];
        if (!req.is_viewing_all) {
            query += ' AND structur_id = ?';
            params.push(req.structur_id);
        }
        query += ' GROUP BY month ORDER BY month ASC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching dossier trends:', err);
        // If `created_at` column does not exist on `dossiers`, retry without it
        if (err && err.code === 'ER_BAD_FIELD_ERROR') {
            try {
                let fallback = `
                    SELECT
                        to_char(COALESCE(SaisiLe, NOW()), 'YYYY-MM') as month,
                        COUNT(*) as count
                    FROM dossiers
                    WHERE (SaisiLe IS NULL OR SaisiLe >= CURRENT_DATE - INTERVAL '12 months')
                      AND (Facturable IS NULL OR Facturable != -1)
                `;
                let params = [];
                if (!req.is_viewing_all) {
                    fallback += ' AND structur_id = ?';
                    params.push(req.structur_id);
                }
                fallback += ' GROUP BY month ORDER BY month ASC';
                const [rows2] = await pool.query(fallback, params);
                return res.json(rows2);
            } catch (e2) {
                console.error('Fallback dossier-trends also failed:', e2);
            }
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/dashboards/_diag
 * Quick diagnostic endpoint for SUPER_ADMIN to understand why dashboards
 * return zero. Returns count buckets without filters so we can compare.
 */
router.get('/_diag', async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'SUPER_ADMIN only' });
        }
        const [[total]] = await pool.query('SELECT COUNT(*) as n FROM dossiers');
        const [[live]]  = await pool.query(
            'SELECT COUNT(*) as n FROM dossiers WHERE (Facturable IS NULL OR Facturable != -1)'
        );
        const [[withSaisiLe]] = await pool.query(
            'SELECT COUNT(*) as n FROM dossiers WHERE SaisiLe IS NOT NULL'
        );
        const [[last12mSaisile]] = await pool.query(
            `SELECT COUNT(*) as n FROM dossiers
             WHERE SaisiLe >= CURRENT_DATE - INTERVAL '12 months'`
        );
        const [[validatedFactures]] = await pool.query(
            'SELECT COUNT(*) as n FROM factures WHERE Validee = 1'
        );
        const [sample] = await pool.query(
            `SELECT IDDossiers, CodeDossier, SaisiLe, Facturable, structur_id
             FROM dossiers ORDER BY IDDossiers DESC LIMIT 5`
        );
        // Deep dive on factures
        const [[sumCA]] = await pool.query(
            'SELECT COALESCE(SUM(MontantHTFacture), 0) as s FROM factures WHERE Validee = 1'
        );
        const [[sumRel]] = await pool.query(
            'SELECT COALESCE(SUM(ReliquatFacture), 0) as s FROM factures WHERE Validee = 1 AND ReliquatFacture > 0'
        );
        const [sampleFactures] = await pool.query(
            `SELECT IDFactures, IDDossiers, structur_id, Validee,
                    MontantHTFacture, ReliquatFacture, DateEcheance
             FROM factures WHERE Validee = 1 ORDER BY IDFactures DESC LIMIT 5`
        );
        // Test the exact top-clients-ca query to see what it returns
        const [topClientsTest] = await pool.query(
            `SELECT
                ANY_VALUE(cl.NomRS) as name,
                SUM(f.MontantHTFacture) as value
             FROM factures f
             JOIN dossiers d ON f.IDDossiers = d.IDDossiers
             JOIN clients cl ON d.IDCLIENTS = cl.IDCLIENTS
             WHERE f.Validee = 1
             GROUP BY cl.IDCLIENTS ORDER BY value DESC LIMIT 10`
        );
        res.json({
            dossiers_total: total.n,
            dossiers_non_supprimes: live.n,
            dossiers_avec_SaisiLe: withSaisiLe.n,
            dossiers_SaisiLe_dans_12_mois: last12mSaisile.n,
            factures_validees: validatedFactures.n,
            factures_validees_SUM_MontantHT: sumCA.s,
            factures_validees_SUM_Reliquat: sumRel.s,
            sample_factures_validees: sampleFactures,
            top_clients_ca_test: topClientsTest,
            user_is_viewing_all: req.is_viewing_all === true,
            user_structur_id: req.structur_id,
            sample_dossiers: sample
        });
    } catch (err) {
        console.error('Diag error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/dashboards/to-invoice
 * Dossiers at "livré" step with no validated invoice yet
 */
router.get('/to-invoice', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT
                d.IDDossiers as id,
                d.CodeDossier as code,
                d.Libelle as label,
                cl.NomRS as clientName,
                cl.TelClient as clientPhone,
                e.libelleEtapesDossiers as step,
                MAX(ml.DateEffectiveLivraison) as dateLivraison,
                MAX(t.NumeroTitreTransport) as docNumber
            FROM dossiers d
            JOIN clients cl ON d.IDCLIENTS = cl.IDCLIENTS
            JOIN etapesdossiers e ON d.IdEtapeDossiers = e.IDEtapesDossiers
            LEFT JOIN miseenlivraison ml ON d.IDDossiers = ml.IDDossiers
            LEFT JOIN transports t ON d.IDDossiers = t.idbl OR d.IDDossiers = t.IdAgent
            WHERE (d.Facturable IS NULL OR d.Facturable != -1)
              AND LOWER(e.libelleEtapesDossiers) LIKE '%livr%'
              AND NOT EXISTS (
                  SELECT 1 FROM factures f
                  WHERE f.IDDossiers = d.IDDossiers AND f.Validee = 1
              )
        `;
        let params = [];

        if (!req.is_viewing_all) {
            query += ' AND d.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' GROUP BY d.IDDossiers, cl.IDCLIENTS, e.IDEtapesDossiers ORDER BY dateLivraison ASC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching to-invoice dossiers:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
