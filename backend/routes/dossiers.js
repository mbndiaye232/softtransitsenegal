// backend/routes/dossiers.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');
const auditService = require('../services/auditService');
const { recomputeAllDossiersEtape } = require('../services/etapeService');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Helper to generate full code
function generateFullCode(nature, mode, type, year, increment) {
    const incStr = String(increment).padStart(5, '0');
    return `${nature}-${mode}-${type}-${year}-${incStr}`;
}

// Helper to generate short code (e.g., IMA-03-00002)
function generateShortCode(nature, mode, year, increment) {
    const natureLetter = nature.startsWith('IMP') ? 'I' : 'E';
    const modePart = mode; // MA, AE, TE
    const yearPart = String(year).slice(-2);
    const incStr = String(increment).padStart(5, '0');
    return `${natureLetter}${modePart}-${yearPart}-${incStr}`;
}

// Auto-select document type based on mode
function getDocumentType(mode) {
    if (mode === 'MA') return 'BL';
    if (mode === 'AE') return 'LTA';
    if (mode === 'TE') return 'LVI';
    return null;
}

// Middleware for validation
const dossierValidation = [
    body('label').notEmpty().withMessage('Label is required'),
    body('nature').isIn(['IMP', 'EXP']).withMessage('Nature must be IMP or EXP'),
    body('mode').isIn(['MA', 'AE', 'TE']).withMessage('Mode must be MA, AE, or TE'),
    body('type').isIn(['TC', 'GR', 'CO']).withMessage('Type must be TC, GR, or CO'),
    body('description').optional().isString(),
];

/**
 * GET /api/dossiers
 * List all dossiers for the tenant (or all for provider)
 */
router.get('/', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT 
                d.IDDossiers as id, 
                d.IDCLIENTS as clientId, 
                c.NomRS as clientName,
                d.Libelle as label, 
                d.CodeDossier as code, 
                d.CodeDossierCourt as shortCode, 
                d.NatureDossier as nature, 
                d.ModeExpedition as mode, 
                d.TypeDossier as type, 
                d.Typedocument as documentType, 
                d.DescriptionDossiers as description, 
                d.NumeroDPI as dpiNumber, 
                d.EtapeCotation as quotationStep, 
                d.SaisiLe as createdAt,
                CASE WHEN d.IdEtapeDossiers = 7 THEN 'CLOSED' ELSE 'OPEN' END as status,
                EXISTS(SELECT 1 FROM factures f WHERE f.IDDossiers = d.IDDossiers) as isBilled,
                s.NomSociete as company_name
            FROM dossiers d
            JOIN structur s ON d.structur_id = s.IDSociete
            LEFT JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
        `;
        let params = [];

        if (!req.is_viewing_all) {
            query += ' WHERE d.structur_id = ? AND (d.Facturable IS NULL OR d.Facturable != -1)';
            params.push(req.structur_id);
        } else {
            query += ' WHERE (d.Facturable IS NULL OR d.Facturable != -1)';
        }

        query += ' ORDER BY d.SaisiLe DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('List dossiers error:', err);
        res.status(500).json({ error: 'Failed to fetch dossiers' });
    }
});

/**
 * GET /api/dossiers/client/:clientId
 * List dossiers for a specific client
 */
router.get('/client/:clientId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    console.log(`DEBUG: Fetching dossiers for client ${req.params.clientId}, structur_id: ${req.structur_id}`);
    try {
        let query = `
            SELECT d.IDDossiers as id, d.CodeDossier as code, d.Libelle as label,
                   EXISTS(SELECT 1 FROM factures f WHERE f.IDDossiers = d.IDDossiers) as isBilled
            FROM dossiers d
            WHERE d.IDCLIENTS = ? AND (d.Facturable IS NULL OR d.Facturable != -1)
        `;
        let params = [req.params.clientId];

        if (!req.user.is_provider) {
            query += ' AND d.structur_id = ?';
            params.push(req.structur_id);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Get dossiers by client error:', err);
        res.status(500).json({ error: 'Failed to fetch dossiers for client' });
    }
});

/**
 * POST /api/dossiers
 * Create a new dossier
 */
router.post('/', checkPermission('DOSSIERS', 'can_create'), upload.single('file'), dossierValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { label, nature, mode, type, description, clientId, dpiNumber, quotationStep, contactName, contactPhone, contactEmail, observations, dateRemiseDocs } = req.body;

    if (!clientId) {
        return res.status(400).json({ error: 'Veuillez sélectionner un client' });
    }

    let fileUrl = req.file ? `/uploads/dossiers/${req.file.filename}` : null;
    const year = new Date().getFullYear();

    try {
        // Move file dynamically to client folder
        if (req.file && clientId) {
            const [clientRows] = await pool.query('SELECT NomRS FROM clients WHERE IDCLIENTS = ?', [clientId]);
            let clientNameSafe = 'unknown';
            if (clientRows.length > 0) {
                clientNameSafe = (clientRows[0].NomRS || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
            }

            const fs = require('fs');
            const path = require('path');
            const dynamicOutputDir = path.join(__dirname, '..', 'uploads', 'clients', `${clientId}_${clientNameSafe}`, 'dossiers');

            if (!fs.existsSync(dynamicOutputDir)) {
                fs.mkdirSync(dynamicOutputDir, { recursive: true });
            }

            const newPath = path.join(dynamicOutputDir, req.file.filename);
            fs.renameSync(req.file.path, newPath);

            fileUrl = `/uploads/clients/${clientId}_${clientNameSafe}/dossiers/${req.file.filename}`;
        }

        // Determine next increment
        const [rows] = await pool.query(
            `SELECT MAX(substring(CodeDossier from '(\\d+)$')::bigint) as maxInc
             FROM dossiers
             WHERE NatureDossier = ? AND ModeExpedition = ? AND TypeDossier = ?
             AND EXTRACT(YEAR FROM SaisiLe) = ?`,
            [nature, mode, type, year]
        );
        const nextInc = (rows[0].maxInc || 0) + 1;
        const code = generateFullCode(nature, mode, type, year, nextInc);
        const shortCode = generateShortCode(nature, mode, year, nextInc);
        const documentType = getDocumentType(mode);

        const [result] = await pool.query(
            `INSERT INTO dossiers (
                IDCLIENTS, Libelle, CodeDossier, CodeDossierCourt, NatureDossier, ModeExpedition, TypeDossier,
                Typedocument, DescriptionDossiers, NumeroDPI, EtapeCotation, PersonneContact, 
                TelPersonneContact, EmailPersonneContact, Observations, cheminfiche, IdAgentValidation,
                Facturable, SaisiLe, IdEtapeDossiers, structur_id, IdAgentSaisi, IdAgModiff, DateRemise
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), 1, ?, ?, ?, ?)`,
            [
                clientId || null, label, code, shortCode, nature, mode, type,
                documentType, description || null, dpiNumber || null, quotationStep ? 1 : 0,
                contactName || null, contactPhone || null, contactEmail || null, observations || null,
                fileUrl, req.user.id, req.structur_id, req.user.id, req.user.id, dateRemiseDocs || null
            ]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'DOSSIER',
            resource_id: result.insertId,
            details: { code, label, clientId },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.status(201).json({ id: result.insertId, code, shortCode, documentType });
    } catch (err) {
        console.error('Create dossier error:', err);
        res.status(500).json({ error: 'Failed to create dossier' });
    }
});

/**
 * GET /api/dossiers/:id
 * Retrieve a dossier
 */
router.get('/:id', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT d.IDDossiers as id, d.IDCLIENTS as clientId, c.NomRS as clientName, c.NomRS as NomClient,
                    d.Libelle as label, d.CodeDossier as code, 
                    d.CodeDossierCourt as shortCode, d.NatureDossier as nature, d.ModeExpedition as mode, 
                    d.TypeDossier as type, d.Typedocument as documentType, d.DescriptionDossiers as description,
                    d.NumeroDPI as dpiNumber, d.EtapeCotation as quotationStep, d.PersonneContact as contactName,
                    d.TelPersonneContact as contactPhone, d.EmailPersonneContact as contactEmail,
                    d.observations as observations, d.cheminfiche as fileUrl, d.IdAgentValidation as validatedByAgentId,
                    d.Facturable as isFacturable, d.SaisiLe as createdAt, d.DateRemise as dateRemiseDocs
             FROM dossiers d
             LEFT JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
             WHERE d.IDDossiers = ?
        `;
        let params = [req.params.id];

        if (!req.user.is_provider) {
            query += ' AND structur_id = ?';
            params.push(req.structur_id);
        }

        const [rows] = await pool.query(query, params);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Dossier not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Get dossier error:', err);
        res.status(500).json({ error: 'Failed to fetch dossier' });
    }
});

/**
 * PUT /api/dossiers/:id
 * Update a dossier
 */
router.put('/:id', checkPermission('DOSSIERS', 'can_edit'), upload.single('file'), dossierValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { label, nature, mode, type, description, editCode, isFacturable, clientId, dpiNumber, quotationStep, contactName, contactPhone, contactEmail, observations, dateRemiseDocs } = req.body;
    let fileUrl = req.file ? `/uploads/dossiers/${req.file.filename}` : undefined;

    try {
        let query = `SELECT * FROM dossiers WHERE IDDossiers = ?`;
        let params = [req.params.id];
        if (!req.user.is_provider) {
            query += ' AND structur_id = ?';
            params.push(req.structur_id);
        }

        const [exist] = await pool.query(query, params);
        if (exist.length === 0) {
            return res.status(404).json({ error: 'Dossier not found' });
        }

        const dossier = exist[0];
        const finalClientId = clientId || dossier.IDCLIENTS;

        if (req.file && finalClientId) {
            const [clientRows] = await pool.query('SELECT NomRS FROM clients WHERE IDCLIENTS = ?', [finalClientId]);
            let clientNameSafe = 'unknown';
            if (clientRows.length > 0) {
                clientNameSafe = (clientRows[0].NomRS || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
            }

            const fs = require('fs');
            const path = require('path');
            const dynamicOutputDir = path.join(__dirname, '..', 'uploads', 'clients', `${finalClientId}_${clientNameSafe}`, 'dossiers');

            if (!fs.existsSync(dynamicOutputDir)) {
                fs.mkdirSync(dynamicOutputDir, { recursive: true });
            }

            const newPath = path.join(dynamicOutputDir, req.file.filename);
            fs.renameSync(req.file.path, newPath);

            fileUrl = `/uploads/clients/${finalClientId}_${clientNameSafe}/dossiers/${req.file.filename}`;
        }

        let newCode = dossier.CodeDossier;
        let newShortCode = dossier.CodeDossierCourt;
        let newDocumentType = dossier.Typedocument;

        if (editCode === 'true' || editCode === true) {
            const year = new Date(dossier.SaisiLe).getFullYear();
            const increment = parseInt(dossier.CodeDossier.split('-').pop());
            newCode = generateFullCode(nature, mode, type, year, increment);
            newShortCode = generateShortCode(nature, mode, year, increment);
            newDocumentType = getDocumentType(mode);
        }

        let updateQuery = `UPDATE dossiers SET Libelle = ?, NatureDossier = ?, ModeExpedition = ?, TypeDossier = ?, DescriptionDossiers = ?, CodeDossier = ?, CodeDossierCourt = ?, Typedocument = ?, Facturable = ?, IDCLIENTS = ?, NumeroDPI = ?, EtapeCotation = ?, PersonneContact = ?, TelPersonneContact = ?, EmailPersonneContact = ?, Observations = ?, IdAgModiff = ?, DateRemise = ?`;
        let updateParams = [label, nature, mode, type, description || null, newCode, newShortCode, newDocumentType, isFacturable ? 1 : 0, clientId || null, dpiNumber || null, quotationStep ? 1 : 0, contactName || null, contactPhone || null, contactEmail || null, observations || null, req.user.id, dateRemiseDocs || null];

        if (fileUrl) {
            updateQuery += `, cheminfiche = ?`;
            updateParams.push(fileUrl);
        }

        updateQuery += ` WHERE IDDossiers = ?`;
        updateParams.push(req.params.id);

        await pool.query(updateQuery, updateParams);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'DOSSIER',
            resource_id: req.params.id,
            details: { code: newCode, label },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Dossier updated successfully' });
    } catch (err) {
        console.error('Update dossier error:', err);
        res.status(500).json({ error: 'Failed to update dossier' });
    }
});

/**
 * DELETE /api/dossiers/:id
 * Soft delete a dossier
 */
router.delete('/:id', checkPermission('DOSSIERS', 'can_delete'), async (req, res) => {
    try {
        let query = `SELECT IDDossiers FROM dossiers WHERE IDDossiers = ?`;
        let params = [req.params.id];
        if (!req.user.is_provider) {
            query += ' AND structur_id = ?';
            params.push(req.structur_id);
        }

        const [exist] = await pool.query(query, params);
        if (exist.length === 0) {
            return res.status(404).json({ error: 'Dossier not found' });
        }

        await pool.query(
            `UPDATE dossiers SET Facturable = -1 WHERE IDDossiers = ?`,
            [req.params.id]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'DOSSIER',
            resource_id: req.params.id,
            details: 'Soft delete applied',
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Dossier deleted (soft)' });
    } catch (err) {
        console.error('Delete dossier error:', err);
        res.status(500).json({ error: 'Failed to delete dossier' });
    }
});

/**
 * GET /api/dossiers/:id/taxes-liquidees
 * Returns the aggregated taxes for a dossier if ALL its notes de details are validated.
 */
router.get('/:id/taxes-liquidees', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        const dossierId = req.params.id;

        // Check ownership
        let checkQuery = 'SELECT IDDossiers FROM dossiers WHERE IDDossiers = ?';
        let checkParams = [dossierId];
        if (!req.user.is_provider) {
            checkQuery += ' AND structur_id = ?';
            checkParams.push(req.structur_id);
        }
        const [dexist] = await pool.query(checkQuery, checkParams);
        if (dexist.length === 0) return res.status(404).json({ error: 'Dossier not found' });

        // Retrieve notes for dossier (exclude soft-deleted)
        const [notes] = await pool.query(
            `SELECT IDNotesDeDetails, REPERTOIRE, Valide, DateCreation
             FROM notesdedetails
             WHERE IDDossiers = ? AND deleted_at IS NULL
             ORDER BY DateCreation ASC`,
            [dossierId]
        );
        if (notes.length === 0) {
            return res.status(400).json({ error: "Il n'existe pas de note de détail pour ce dossier. Impossible de récupérer les taxes." });
        }

        // Check if all are validated (Valide == 1).
        // If any are unvalidated, return 409 with the list so the frontend can
        // show a modal letting the user validate or delete each one.
        const unvalidated = notes.filter(n => n.Valide !== 1);
        if (unvalidated.length > 0) {
            return res.status(409).json({
                error: "Certaines notes de détail ne sont pas validées. Validez-les ou supprimez-les avant de récupérer les taxes.",
                code: 'UNVALIDATED_NOTES',
                unvalidated_notes: unvalidated.map(n => ({
                    id: n.IDNotesDeDetails,
                    repertoire: n.REPERTOIRE,
                    date_creation: n.DateCreation
                }))
            });
        }

        // Aggregate taxes (excluding soft-deleted notes)
        const [taxes] = await pool.query(`
            SELECT
                la.CodeTaxe,
                MAX(la.LibelleTaxe) as LibelleTaxeComplet,
                SUM(la.Montant) as la_somme_MontantLiquide
            FROM liquidations_articles la
            JOIN articles a ON la.IDArticles = a.IDArticles
            JOIN notesdedetails n ON a.IDNotesDeDetails = n.IDNotesDeDetails
            WHERE n.IDDossiers = ?
              AND n.deleted_at IS NULL
              AND n.Valide = 1
            GROUP BY la.CodeTaxe
            ORDER BY la.CodeTaxe
        `, [dossierId]);

        res.json(taxes);
    } catch (err) {
        console.error('Error fetching taxes for dossier:', err);
        res.status(500).json({ error: 'Failed to fetch liquidations' });
    }
});

/**
 * POST /api/dossiers/recompute-etapes (SUPER_ADMIN only)
 * Backfill : recalcule l'étape de tous les dossiers (ou d'une structure).
 * À lancer une fois après le déploiement de la feature.
 *   - Sans body : toutes les structures
 *   - Body { structur_id: N } : limiter à une structure
 */
router.post('/recompute-etapes', async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'SUPER_ADMIN only' });
        }
        const structurId = req.body?.structur_id || null;
        const result = await recomputeAllDossiersEtape({ structurId });
        res.json(result);
    } catch (err) {
        console.error('Recompute étapes error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
