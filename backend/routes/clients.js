const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const auditService = require('../services/auditService');
const { uploadFile } = require('../utils/storage');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Memory storage — fichiers uploadés vers Cloudflare R2
const uploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const isTruthy = (v) => v === true || v === 1 || v === '1' || v === 'true';

/**
 * Persiste la sélection des rubriques sur lesquelles s'applique la commission
 * débours du client (table rubriquesdescommissions).
 * - « Sur tous les débours » coché  → toutes les rubriques 11xx s'appliquent,
 *   aucune ligne spécifique n'est conservée (la sélection est vidée).
 * - Décoché → on enregistre uniquement les rubriques cochées.
 * @param {*} connection      connexion transactionnelle
 * @param {number} clientId
 * @param {*} sappliqueTous   valeur brute (FormData) de sappliqueTousDebours
 * @param {*} rubriquesRaw    JSON string d'un tableau d'IDRubriques
 */
async function saveCommissionRubriques(connection, clientId, sappliqueTous, rubriquesRaw) {
    await connection.query('DELETE FROM rubriquesdescommissions WHERE IDCLIENTS = ?', [clientId]);
    if (isTruthy(sappliqueTous)) return; // toutes les rubriques 11xx → pas de sélection spécifique

    let ids = [];
    try { ids = JSON.parse(rubriquesRaw || '[]'); } catch { ids = []; }
    ids = [...new Set(ids.map(Number).filter(Boolean))];
    if (ids.length === 0) return;

    // On ne garde que les rubriques de débours réelles (code 11xx) et on récupère leur code.
    const [rubs] = await connection.query(
        "SELECT IDRubriques, CodeRubrique FROM rubriques WHERE IDRubriques IN (?) AND CodeRubrique LIKE '11%'",
        [ids]
    );
    if (rubs.length === 0) return;

    const values = rubs.map(r => [clientId, r.IDRubriques, r.CodeRubrique]);
    await connection.query(
        'INSERT INTO rubriquesdescommissions (IDCLIENTS, IDRubriques, CodeRubrique) VALUES ?',
        [values]
    );
}

/**
 * GET /api/clients
 * List all clients for the current company (or all for provider)
 */
router.get('/', checkPermission('CLIENTS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT c.*, s.NomSociete as company_name, cc.SoldeCompteClient
            FROM clients c
            JOIN structur s ON c.structur_id = s.IDSociete
            LEFT JOIN comptesclients cc ON cc.IDCLIENTS = c.IDCLIENTS
        `;
        let params = [];

        if (!req.is_viewing_all) {
            query += ' WHERE c.structur_id = ?';
            params.push(req.structur_id);
        }

        query += ' ORDER BY c.NomRS ASC';

        const [clients] = await pool.query(query, params);

        // Map database column names to frontend-expected names
        const mappedClients = clients.map(client => ({
            ...client,
            NomClient: client.NomRS,
            Adresse: client.adresseClient,
            Tel1: client.TelClient,
            Tel2: client.CelClient,
            Email: client.EmailClient
        }));

        res.json(mappedClients);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

/**
 * GET /api/clients/:id
 * Get client details
 */
router.get('/:id', checkPermission('CLIENTS', 'can_view'), async (req, res) => {
    try {
        let query = `
            SELECT c.*, cc.IDComptesClients, cc.SoldeCompteClient, cc.TotalCredit, cc.TotalDebit
            FROM clients c
            LEFT JOIN comptesclients cc ON cc.IDCLIENTS = c.IDCLIENTS
            WHERE c.IDCLIENTS = ?
        `;
        let params = [req.params.id];

        if (!req.user.is_provider) {
            query += ' AND c.structur_id = ?';
            params.push(req.structur_id);
        }

        const [clients] = await pool.query(query, params);

        if (clients.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Rubriques sur lesquelles porte la commission débours (si « Sur tous les débours » décoché)
        const [commRows] = await pool.query(
            'SELECT IDRubriques FROM rubriquesdescommissions WHERE IDCLIENTS = ?',
            [req.params.id]
        );

        // Map database column names to frontend-expected names
        const client = {
            ...clients[0],
            NomClient: clients[0].NomRS,
            Adresse: clients[0].adresseClient,
            Tel1: clients[0].TelClient,
            Tel2: clients[0].CelClient,
            Email: clients[0].EmailClient,
            commissionRubriques: commRows.map(r => r.IDRubriques)
        };

        res.json(client);
    } catch (error) {
        console.error('Error fetching client:', error);
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

/**
 * POST /api/clients
 * Create a new client
 */
router.post('/', checkPermission('CLIENTS', 'can_create'), uploader.single('CheminLettreEXO'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            NomRS, adresseClient, TelClient, CelClient, EmailClient, Observations,
            IDStatuts, NINEA, EncoursAutorise, AssuranceCredit, TauxRemise,
            ExonereTVA, PersonneContact, EmailPersonneContact, TelPersonneContact,
            TypeClient, CodeClient, faxClient, DelaiReglement, DelaiReglementDouane,
            NumExoneration, NumCompteSAARI, TauxCommissionDDouane, TauxCommissionDebours,
            sappliqueTousDebours, FactureDouaneAvecCommissionEtTVA
        } = req.body;

        const structur_id = req.structur_id; // Uses tenantMiddleware resolution
        const IdAgent = req.user.id;
        let cheminLettreEXO = null;
        if (req.file) {
            const ext = path.extname(req.file.originalname);
            const key = `clients/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            await uploadFile(key, req.file.buffer, req.file.mimetype);
            cheminLettreEXO = key;
        }

        await connection.beginTransaction();

        // Check uniqueness of CodeClient
        if (CodeClient) {
            const [existingCode] = await connection.query(
                `SELECT IDCLIENTS FROM clients WHERE CodeClient = ? AND structur_id = ?`,
                [CodeClient, structur_id]
            );
            if (existingCode.length > 0) {
                throw new Error(`Le code client ${CodeClient} est déjà affecté à un client`);
            }
        }

        // Check uniqueness of NumCompteSAARI
        if (NumCompteSAARI) {
            const [existingSaari] = await connection.query(
                `SELECT IDCLIENTS FROM clients WHERE NumCompteSAARI = ? AND structur_id = ?`,
                [NumCompteSAARI, structur_id]
            );
            if (existingSaari.length > 0) {
                throw new Error(`Le code SAARI client ${NumCompteSAARI} est déjà affecté à un client`);
            }
        }

        // Insert Client
        const [result] = await connection.query(
            `INSERT INTO clients (
                structur_id, NomRS, adresseClient, TelClient, IdAgent, CelClient, EmailClient,
                Observations, IDStatuts, Saisile, NINEA, EncoursAutorise, AssuranceCredit,
                CheminLettreEXO, TauxRemise, ExonereTVA, PersonneContact, EmailPersonneContact,
                TelPersonneContact, TypeClient, CodeClient, faxClient, DelaiReglement,
                DelaiReglementDouane, NumExoneration, NumCompteSAARI, TauxCommissionDDouane,
                TauxCommissionDebours, sappliqueTousDebours, FactureDouaneAvecCommissionEtTVA
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                structur_id, NomRS, adresseClient, TelClient, IdAgent, CelClient, EmailClient,
                Observations, IDStatuts || 0, NINEA, EncoursAutorise || 0, AssuranceCredit || 0,
                cheminLettreEXO, TauxRemise || 0, ExonereTVA === 'true' ? 1 : 0, PersonneContact,
                EmailPersonneContact, TelPersonneContact, TypeClient, CodeClient, faxClient,
                DelaiReglement || 0, DelaiReglementDouane || 0, NumExoneration, NumCompteSAARI,
                TauxCommissionDDouane || 0, TauxCommissionDebours || 0,
                sappliqueTousDebours === 'true' ? 1 : 0, FactureDouaneAvecCommissionEtTVA === 'true' ? 1 : 0
            ]
        );

        const clientId = result.insertId;

        // Rubriques de commission débours (si « Sur tous les débours » décoché)
        await saveCommissionRubriques(connection, clientId, sappliqueTousDebours, req.body.commissionRubriques);

        // Create Account (ComptesClients)
        await connection.query(
            `INSERT INTO comptesclients (
                LibelleCompteClients, IDCLIENTS, IdAgent, SoldeCompteClient, TotalCredit, TotalDebit
            ) VALUES (?, ?, ?, 0, 0, 0)`,
            [`Compte opérations de ${NomRS}`, clientId, IdAgent]
        );

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'CREATE',
            resource_type: 'CLIENT',
            resource_id: clientId,
            details: { name: NomRS, code: CodeClient },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        await connection.commit();
        res.status(201).json({ message: 'Client created successfully', id: clientId });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating client:', error);
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

/**
 * PUT /api/clients/:id
 * Update a client
 */
router.put('/:id', checkPermission('CLIENTS', 'can_edit'), uploader.single('CheminLettreEXO'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const clientId = req.params.id;
        const {
            NomRS, adresseClient, TelClient, CelClient, EmailClient, Observations,
            IDStatuts, NINEA, EncoursAutorise, AssuranceCredit, TauxRemise,
            ExonereTVA, PersonneContact, EmailPersonneContact, TelPersonneContact,
            TypeClient, CodeClient, faxClient, DelaiReglement, DelaiReglementDouane,
            NumExoneration, NumCompteSAARI, TauxCommissionDDouane, TauxCommissionDebours,
            sappliqueTousDebours, FactureDouaneAvecCommissionEtTVA, Alerte_Suspension
        } = req.body;

        const structur_id = req.structur_id;
        const idagentmodification = req.user.id;
        let cheminLettreEXO = undefined;

        await connection.beginTransaction();

        // Check if client exists and belongs to company
        let query = `SELECT * FROM clients WHERE IDCLIENTS = ?`;
        let params = [clientId];
        if (!req.user.is_provider) {
            query += ' AND structur_id = ?';
            params.push(structur_id);
        }

        const [existingClient] = await connection.query(query, params);

        if (existingClient.length === 0) {
            throw new Error('Client not found');
        }

        // Check uniqueness of CodeClient if changed
        if (CodeClient && CodeClient !== existingClient[0].CodeClient) {
            const [existingCode] = await connection.query(
                `SELECT IDCLIENTS FROM clients WHERE CodeClient = ? AND structur_id = ? AND IDCLIENTS != ?`,
                [CodeClient, structur_id, clientId]
            );
            if (existingCode.length > 0) {
                throw new Error(`Le code client ${CodeClient} est déjà affecté à un client`);
            }
        }

        // Check uniqueness of NumCompteSAARI if changed
        if (NumCompteSAARI && NumCompteSAARI !== existingClient[0].NumCompteSAARI) {
            const [existingSaari] = await connection.query(
                `SELECT IDCLIENTS FROM clients WHERE NumCompteSAARI = ? AND structur_id = ? AND IDCLIENTS != ?`,
                [NumCompteSAARI, structur_id, clientId]
            );
            if (existingSaari.length > 0) {
                throw new Error(`Le code SAARI client ${NumCompteSAARI} est déjà affecté à un client`);
            }
        }

        if (req.file) {
            const ext = path.extname(req.file.originalname);
            const key = `clients/${clientId}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            await uploadFile(key, req.file.buffer, req.file.mimetype);
            cheminLettreEXO = key;
        }

        // Update Client
        let updateQuery = `UPDATE clients SET
            NomRS=?, adresseClient=?, TelClient=?, CelClient=?, EmailClient=?,
            Observations=?, IDStatuts=?, Modifiele=NOW(), idagentmodification=?, NINEA=?,
            EncoursAutorise=?, AssuranceCredit=?, TauxRemise=?, ExonereTVA=?,
            PersonneContact=?, EmailPersonneContact=?, TelPersonneContact=?, TypeClient=?,
            CodeClient=?, faxClient=?, DelaiReglement=?, DelaiReglementDouane=?,
            NumExoneration=?, NumCompteSAARI=?, TauxCommissionDDouane=?,
            TauxCommissionDebours=?, sappliqueTousDebours=?, FactureDouaneAvecCommissionEtTVA=?,
            Alerte_Suspension=?`;

        const updateParams = [
            NomRS, adresseClient, TelClient, CelClient, EmailClient,
            Observations, IDStatuts || 0, idagentmodification, NINEA,
            EncoursAutorise || 0, AssuranceCredit || 0, TauxRemise || 0, ExonereTVA === 'true' ? 1 : 0,
            PersonneContact, EmailPersonneContact, TelPersonneContact, TypeClient,
            CodeClient, faxClient, DelaiReglement || 0, DelaiReglementDouane || 0,
            NumExoneration, NumCompteSAARI, TauxCommissionDDouane || 0,
            TauxCommissionDebours || 0, sappliqueTousDebours === 'true' ? 1 : 0,
            FactureDouaneAvecCommissionEtTVA === 'true' ? 1 : 0,
            Alerte_Suspension ? 1 : 0
        ];

        if (cheminLettreEXO) {
            updateQuery += `, CheminLettreEXO=?`;
            updateParams.push(cheminLettreEXO);
        }

        updateQuery += ` WHERE IDCLIENTS = ?`;
        updateParams.push(clientId);

        await connection.query(updateQuery, updateParams);

        // Rubriques de commission débours (si « Sur tous les débours » décoché)
        await saveCommissionRubriques(connection, clientId, sappliqueTousDebours, req.body.commissionRubriques);

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'CLIENT',
            resource_id: clientId,
            details: { name: NomRS, code: CodeClient },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        await connection.commit();
        res.json({ message: 'Client updated successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating client:', error);
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

/**
 * PATCH /api/clients/:id/email
 * Quick update of client email address
 */
router.patch('/:id/email', checkPermission('CLIENTS', 'can_edit'), async (req, res) => {
    try {
        const { email } = req.body;
        const clientId = req.params.id;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const [result] = await pool.query(
            'UPDATE clients SET EmailClient = ?, Modifiele = NOW(), idagentmodification = ? WHERE IDCLIENTS = ?',
            [email, req.user.id, clientId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'UPDATE',
            resource_type: 'CLIENT',
            resource_id: clientId,
            details: { field: 'EmailClient', new_value: email },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.json({ message: 'Email mis à jour avec succès' });
    } catch (error) {
        console.error('Error updating client email:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/clients/:id
 * Delete a client
 */
router.delete('/:id', checkPermission('CLIENTS', 'can_delete'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const clientId = req.params.id;

        // Check if client has associated dossiers
        const [dossiers] = await connection.query(
            'SELECT IDDossiers FROM dossiers WHERE IDCLIENTS = ? LIMIT 1',
            [clientId]
        );

        if (dossiers.length > 0) {
            return res.status(400).json({
                error: 'Impossible de supprimer ce client car il possède des dossiers associés.'
            });
        }

        const [mouvements] = await connection.query(
            `SELECT 1 FROM mouvementscomptesclients m
             JOIN comptesclients c ON c.IDComptesClients = m.IDComptesClients
             WHERE c.IDCLIENTS = ? LIMIT 1`,
            [clientId]
        );

        if (mouvements.length > 0) {
            return res.status(400).json({
                error: 'Impossible de supprimer ce client car son compte contient des mouvements.'
            });
        }

        await connection.beginTransaction();

        // La sélection des rubriques de commission est rattachée au client
        await connection.query('DELETE FROM rubriquesdescommissions WHERE IDCLIENTS = ?', [clientId]);

        // Le compte client est créé avec le client : on le retire avec lui (il est sans mouvement)
        await connection.query('DELETE FROM comptesclients WHERE IDCLIENTS = ?', [clientId]);

        const [result] = await connection.query(
            'DELETE FROM clients WHERE IDCLIENTS = ?',
            [clientId]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Client introuvable' });
        }

        await auditService.log({
            agent_id: req.user.id,
            structur_id: req.user.structur_id,
            action: 'DELETE',
            resource_type: 'CLIENT',
            resource_id: clientId,
            details: { message: 'Client deleted' },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        await connection.commit();
        res.json({ message: 'Client supprimé avec succès' });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting client:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'Impossible de supprimer ce client : il est encore référencé (relances, commissions).' });
        }
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    } finally {
        connection.release();
    }
});

module.exports = router;
