const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');
const emailService = require('../services/EmailService');
const { validateEmail } = require('../utils/auth');
const { deleteFile } = require('../utils/storage');

const escapeHtml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const { recomputeAndSaveDossierEtape } = require('../services/etapeService');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Create a new invoice
router.post('/', checkPermission('FACTURES', 'can_create'), async (req, res) => {
    const connection = await pool.getConnection();
    const { idDossier, rubriques, observations } = req.body;
    const idAgent = req.user.id;

    try {
        await connection.beginTransaction();

        // 0. Get structur_id from the agent
        const [[agent]] = await connection.query(
            'SELECT structur_id FROM agents WHERE IDAgents = ? LIMIT 1',
            [idAgent]
        );
        if (!agent) {
            await connection.rollback();
            return res.status(400).json({ error: 'Agent introuvable. Veuillez vous reconnecter.' });
        }
        const structurId = agent.structur_id;

        // 1. Validate rubriques and determine invoice type
        if (!rubriques || rubriques.length === 0) {
            return res.status(400).json({ error: 'At least one rubrique is required' });
        }

        let hasCategory10 = false;
        let hasCategoryOthers = false;

        const processedRubriques = rubriques.map(r => {
            const code = r.code || r.CodeRubrique || '';
            const is10 = String(code).startsWith('10');
            if (is10) hasCategory10 = true;
            else hasCategoryOthers = true;
            return { ...r, is10, code };
        });

        let prefix = '';
        if (hasCategory10 && !hasCategoryOthers) prefix = 'FD'; // Facture Douane
        else if (!hasCategory10 && hasCategoryOthers) prefix = 'FP'; // Facture Prestations
        else prefix = 'FG'; // Facture Globale

        // 2. Generate Invoice Number
        const [lastInvoice] = await connection.query(
            'SELECT NumeroFacture FROM factures WHERE NumeroFacture LIKE ? ORDER BY NumeroFacture DESC LIMIT 1',
            [`${prefix}-%`]
        );

        let nextNum = 1;
        if (lastInvoice.length > 0) {
            const lastNum = parseInt(lastInvoice[0].NumeroFacture.split('-')[1]);
            nextNum = lastNum + 1;
        }
        const numeroFacture = `${prefix}-${String(nextNum).padStart(5, '0')}`;

        // 3. Calculate Totals
        let totalHTDouane = 0;
        let totalHTDebours = 0;
        let totalHTPrestations = 0;
        let totalTVA = 0;

        // Get TVA rate (assuming 18% if not found or from a config)
        // For simplicity, let's use a constant or look for it in the taxes table if needed.
        const tvaRate = 0.18;

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

        // 4. Compute DateEcheance from client payment terms
        // FD → DelaiReglementDouane days, FP/FG → DelaiReglement days
        const [[clientRow]] = await connection.query(
            `SELECT c.DelaiReglement, c.DelaiReglementDouane
             FROM dossiers d JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
             WHERE d.IDDossiers = ? LIMIT 1`,
            [idDossier]
        );
        const delaiJours = prefix === 'FD'
            ? (parseInt(clientRow?.DelaiReglementDouane) || 0)
            : (parseInt(clientRow?.DelaiReglement) || 0);
        const dateEcheance = delaiJours > 0
            ? new Date(Date.now() + delaiJours * 86400000).toISOString().slice(0, 10)
            : null;

        // 5. Insert into factures table
        const [result] = await connection.query(
            `INSERT INTO factures (
                IDDossiers, NumeroFacture, MontantHTFacture, MontantTVAFacture,
                MontantTTCFacture, IDAgents, Observations, DateFacture, structur_id,
                Validee, MontantRegleFacture, ReliquatFacture, DateEcheance
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, 0, 0, ?, ?)`,
            [idDossier, numeroFacture, totalHT, totalTVA, totalTTC, idAgent, observations, structurId, totalTTC, dateEcheance]
        );

        const idFacture = result.insertId;

        // 5. Insert into liaisonfacturesrubriques
        const liaisonValues = rubriques.map(r => [
            idFacture,
            r.idRubrique || r.IDRubriques,
            r.montant || 0,
            r.code || r.CodeRubrique,
            r.libelle || r.libelleRubrique,
            String(r.complement || '').slice(0, 30)  // colonne complement : 30 caractères au plus (PostgreSQL refuse sinon la facture entière)
        ]);

        await connection.query(
            `INSERT INTO liaisonfacturesrubriques (
                IDFactures, IDRubriques, MontantHTFactures, CodeRubrique, libelleRubrique, Complement
            ) VALUES ?`,
            [liaisonValues]
        );

        await connection.commit();
        res.status(201).json({
            message: 'Invoice created successfully',
            idFacture,
            numeroFacture,
            totals: { totalHT, totalTVA, totalTTC }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating invoice - FULL ERROR:', error.code, error.sqlMessage || error.message);
        res.status(500).json({ error: error.sqlMessage || error.message });
    } finally {
        connection.release();
    }
});

// Generate PDF for an invoice
router.get('/:id/pdf', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const InvoicePDFGenerator = require('../services/InvoicePDFGenerator');
        const generator = new InvoicePDFGenerator(pool);
        const pdfPath = await generator.generatePDF(req.params.id);
        res.download(pdfPath);
    } catch (error) {
        console.error('Error generating invoice PDF:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
});

// Get invoices for a dossier
router.get('/dossier/:dossierId', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT f.*,
                    u.NomAgent as AgentName,
                    c.EmailClient, c.NomRS as ClientName,
                    c.DelaiReglement, c.DelaiReglementDouane,
                    d.CodeDossier, d.Libelle as LibelleDossier, d.CodeDossierCourt
             FROM factures f
             LEFT JOIN agents u ON f.IDAgents = u.IDAgents
             JOIN dossiers d ON f.IDDossiers = d.IDDossiers
             JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
             WHERE f.IDDossiers = ?
             ORDER BY f.DateFacture DESC`,
            [req.params.dossierId]
        );
        // Compute DateEcheance on-the-fly for invoices that don't have one yet
        const enriched = rows.map(f => {
            if (!f.DateEcheance && f.DateFacture) {
                const prefix = (f.NumeroFacture || '').substring(0, 2);
                const delai = prefix === 'FD'
                    ? parseInt(f.DelaiReglementDouane) || 0
                    : parseInt(f.DelaiReglement) || 0;
                if (delai > 0) {
                    const d = new Date(f.DateFacture);
                    d.setDate(d.getDate() + delai);
                    f.DateEcheance = d.toISOString().slice(0, 10);
                }
            }
            return f;
        });
        res.json(enriched);
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get invoice details
router.get('/:id', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const [invoice] = await pool.query(
            'SELECT * FROM factures WHERE IDFactures = ?',
            [req.params.id]
        );

        if (invoice.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const [rubriques] = await pool.query(
            'SELECT * FROM liaisonfacturesrubriques WHERE IDFactures = ?',
            [req.params.id]
        );

        res.json({
            ...invoice[0],
            rubriques
        });
    } catch (error) {
        console.error('Error fetching invoice details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/factures/client/:clientId - Get all invoices for a client
router.get('/client/:clientId', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    console.log(`GET /api/factures/client/${req.params.clientId} hit`);
    try {
        const [rows] = await pool.query(`
            SELECT f.*, d.CodeDossier, d.Libelle as DossierLibelle
            FROM factures f
            JOIN dossiers d ON f.IDDossiers = d.IDDossiers
            WHERE d.IDCLIENTS = ?
            ORDER BY f.DateFacture DESC
        `, [req.params.clientId]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching client invoices:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/factures/:id/validate - Validate an invoice
router.patch('/:id/validate', checkPermission('FACTURES', 'can_edit'), async (req, res) => {
    try {
        const [result] = await pool.query(
            'UPDATE factures SET Validee = 1 WHERE IDFactures = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Facture introuvable' });
        }

        // Recompute dossier étape (validation -> Facturé / Partiellement Payé / Clôturé)
        const [[fac]] = await pool.query('SELECT IDDossiers FROM factures WHERE IDFactures = ?', [req.params.id]);
        if (fac?.IDDossiers) recomputeAndSaveDossierEtape(fac.IDDossiers);

        res.json({ message: 'Facture validée avec succès' });
    } catch (error) {
        console.error('Error validating invoice:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// PATCH /api/factures/:id/unvalidate - Invalidate an invoice
router.patch('/:id/unvalidate', checkPermission('FACTURES', 'can_edit'), async (req, res) => {
    try {
        // 1. Check if invoice has payments
        const [payments] = await pool.query(
            'SELECT IDReglements FROM reglements WHERE IDFactures = ? LIMIT 1',
            [req.params.id]
        );

        if (payments.length > 0) {
            return res.status(400).json({
                error: 'Impossible d\'invalider cette facture car elle a reçu un ou plusieurs règlements. Veuillez annuler les règlements d\'abord.'
            });
        }

        const [result] = await pool.query(
            'UPDATE factures SET Validee = 0 WHERE IDFactures = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Facture introuvable' });
        }

        const [[fac]] = await pool.query('SELECT IDDossiers FROM factures WHERE IDFactures = ?', [req.params.id]);
        if (fac?.IDDossiers) recomputeAndSaveDossierEtape(fac.IDDossiers);

        res.json({ message: 'Facture dévalidée avec succès' });
    } catch (error) {
        console.error('Error unvalidating invoice:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// DELETE /api/factures/:id - Delete an invoice
router.delete('/:id', checkPermission('FACTURES', 'can_edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if invoice is validated or has payments
        const [[invoice]] = await connection.query(
            'SELECT Validee FROM factures WHERE IDFactures = ?',
            [req.params.id]
        );

        if (!invoice) {
            await connection.rollback();
            return res.status(404).json({ error: 'Facture introuvable' });
        }

        if (invoice.Validee === 1) {
            await connection.rollback();
            return res.status(400).json({
                error: 'Impossible de supprimer cette facture car elle est validée.'
            });
        }

        const [payments] = await connection.query(
            'SELECT IDReglements FROM reglements WHERE IDFactures = ? LIMIT 1',
            [req.params.id]
        );

        if (payments.length > 0) {
            return res.status(400).json({
                error: 'Impossible de supprimer cette facture car elle a reçu un ou plusieurs règlements. Veuillez annuler les règlements d\'abord.'
            });
        }

        // 2. Delete related rubrics
        await connection.query('DELETE FROM liaisonfacturesrubriques WHERE IDFactures = ?', [req.params.id]);

        // 3. Delete invoice
        const [result] = await connection.query('DELETE FROM factures WHERE IDFactures = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Facture introuvable' });
        }

        await connection.commit();
        res.json({ message: 'Facture supprimée avec succès' });

    } catch (error) {
        await connection.rollback();
        console.error('Error deleting invoice:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    } finally {
        connection.release();
    }
});


// --- JUSTIFICATIFS MANAGEMENT ---

/**
 * POST /api/factures/:id/justificatifs
 * Upload a supporting document for an invoice
 */
router.post('/:id/justificatifs', checkPermission('FACTURES', 'can_edit'), upload.single('justificatif'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier n\'a été téléchargé' });
        }

        const [result] = await pool.query(
            `INSERT INTO liaisonfacturejustificatifs 
            (IDFactures, FileName, OriginalName, FilePath, MimeType, FileSize, IdAgent) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.params.id,
                req.file.filename,
                req.file.originalname,
                req.file.path,
                req.file.mimetype,
                req.file.size,
                req.user.id
            ]
        );

        res.status(201).json({
            id: result.insertId,
            message: 'Justificatif ajouté avec succès',
            file: {
                name: req.file.originalname,
                id: result.insertId
            }
        });
    } catch (error) {
        console.error('Error uploading justificatif:', error);
        res.status(500).json({ error: 'Erreur lors du téléchargement du justificatif' });
    }
});

/**
 * GET /api/factures/:id/justificatifs
 * List all supporting documents for an invoice
 */
router.get('/:id/justificatifs', checkPermission('FACTURES', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM liaisonfacturejustificatifs WHERE IDFactures = ? ORDER BY UploadedAt DESC',
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching justificatifs:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des justificatifs' });
    }
});

/**
 * DELETE /api/factures/justificatifs/:id
 * Remove a supporting document
 */
router.delete('/justificatifs/:id', checkPermission('FACTURES', 'can_edit'), async (req, res) => {
    try {
        // 1. Get file path
        const [rows] = await pool.query(
            'SELECT FilePath FROM liaisonfacturejustificatifs WHERE IDLiaisonFactureJustificatif = ?',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Justificatif introuvable' });
        }

        const filePath = rows[0].FilePath;

        // 2. Delete from database
        await pool.query('DELETE FROM liaisonfacturejustificatifs WHERE IDLiaisonFactureJustificatif = ?', [req.params.id]);

        // 3. Delete the stored file (storage.js refuse tout chemin hors du dossier uploads)
        if (filePath) {
            try {
                await deleteFile(filePath);
            } catch (e) {
                console.error(`Fichier justificatif non supprimé (${filePath}):`, e.message);
            }
        }

        res.json({ message: 'Justificatif supprimé avec succès' });
    } catch (error) {
        console.error('Error deleting justificatif:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du justificatif' });
    }
});

/**
 * POST /api/factures/:id/send-email
 * Send invoice PDF + dossier documents via Brevo HTTP API (preferred) or SMTP fallback
 * Body: { compteMailId, emailDestinataire, documentIds: [id, ...], message, objet }
 */
router.post('/:id/send-email', checkPermission('FACTURES', 'can_edit'), async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const { compteMailId, emailDestinataire, documentIds = [], message: customMessage, objet: customObjet } = req.body;
        const { sendMail } = require('../services/mailer');
        const { downloadFile } = require('../utils/storage');
        const { decrypt } = require('../utils/encryption');

        if (emailDestinataire && (!validateEmail(emailDestinataire.trim()) || /[,;]/.test(emailDestinataire))) {
            return res.status(400).json({ error: "Adresse e-mail du destinataire invalide (une seule adresse)" });
        }

        // 1. Fetch invoice + structure data
        const InvoicePDFGenerator = require('../services/InvoicePDFGenerator');
        const generator = new InvoicePDFGenerator(pool);
        const data = await generator.fetchInvoiceData(invoiceId);
        if (!data.invoice) return res.status(404).json({ error: 'Facture introuvable' });

        const clientEmail = (emailDestinataire || data.invoice.EmailClient || '').trim();
        if (!clientEmail) return res.status(400).json({ error: "Le client n'a pas d'adresse e-mail renseignée" });

        const societeName = data.structure?.NomSociete || 'Soft Transit';
        const subject = customObjet || `Facture ${data.invoice.NumeroFacture} — ${societeName}`;

        // 2. Determine sender identity
        let fromEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'noreply@softtransit.net';
        let fromName  = societeName;

        if (compteMailId) {
            const [[compte]] = await pool.query(
                'SELECT * FROM comptesmails WHERE IDComptesMails = ? AND structur_id = ?',
                [compteMailId, req.structur_id]
            );
            if (!compte) return res.status(404).json({ error: 'Compte mail introuvable' });
            fromEmail = compte.adressemail || compte.AdresseMail || fromEmail;
            fromName  = compte.LibelleMail || societeName;
        }

        // 3. Build HTML body
        const bodyHtml = `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px">
                <div style="background:linear-gradient(135deg,#1e3a8a,#1e40af);padding:24px 32px;border-radius:12px 12px 0 0">
                    <h2 style="color:white;margin:0;font-size:20px">${societeName}</h2>
                </div>
                <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
                    <p style="font-size:15px">Bonjour,</p>
                    <p>Veuillez trouver ci-joint la facture <strong>${data.invoice.NumeroFacture}</strong> relative au dossier <strong>${data.invoice.CodeDossier || ''}</strong>.</p>
                    ${customMessage ? `<p style="background:#fff;border-left:3px solid #1e40af;padding:12px 16px;border-radius:4px">${escapeHtml(customMessage)}</p>` : ''}
                    ${documentIds.length > 0 ? `<p>Les documents associés au dossier sont également joints à cet e-mail.</p>` : ''}
                    <p style="margin-top:24px">Cordialement,<br/><strong>L'équipe ${societeName}</strong></p>
                </div>
            </div>`;

        // 4. Generate invoice PDF → buffer
        const pdfPath = await generator.generatePDF(invoiceId);
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfFilename = `Facture_${data.invoice.NumeroFacture.replace(/\//g, '-')}.pdf`;

        // 5. Collect all attachments as Buffers
        const attachmentBuffers = [{ filename: pdfFilename, content: pdfBuffer }];

        const [justificatifs] = await pool.query(
            'SELECT OriginalName, FilePath FROM liaisonfacturejustificatifs WHERE IDFactures = ?',
            [invoiceId]
        );
        justificatifs.forEach(j => {
            const absPath = path.isAbsolute(j.FilePath) ? j.FilePath : path.join(__dirname, '..', j.FilePath);
            if (fs.existsSync(absPath)) {
                attachmentBuffers.push({ filename: j.OriginalName, content: fs.readFileSync(absPath) });
            }
        });

        if (documentIds.length > 0) {
            const placeholders = documentIds.map(() => '?').join(',');
            const [docs] = await pool.query(
                `SELECT IDDocuments, LibelleDocument, CheminDocument FROM documents
                 WHERE IDDocuments IN (${placeholders}) AND IDDossiers = ?`,
                [...documentIds, data.invoice.IDDossiers]
            );
            for (const doc of docs) {
                try {
                    let encryptedBuffer;
                    const key = doc.CheminDocument;
                    if (key.startsWith('documents/')) {
                        encryptedBuffer = await downloadFile(key);
                    } else {
                        const legacyPaths = [
                            path.join('uploads', 'others', key),
                            path.join('uploads', 'dossiers', key),
                            path.join('uploads', key),
                        ];
                        const legacyPath = legacyPaths.find(p => fs.existsSync(p));
                        if (!legacyPath) continue;
                        encryptedBuffer = fs.readFileSync(legacyPath);
                    }
                    const decryptedBuffer = decrypt(encryptedBuffer);
                    const filename = (doc.LibelleDocument || 'document') + path.extname(key);
                    attachmentBuffers.push({ filename, content: decryptedBuffer });
                } catch (e) {
                    console.warn(`Impossible d'attacher le document ${doc.IDDocuments}:`, e.message);
                }
            }
        }

        // 6. Send via shared mailer (Brevo HTTP API → port 443, non bloqué par Render)
        //    Fallback SMTP global si BREVO_API_KEY absent ;
        //    fallback SMTP par tenant si un compteMailId est fourni et que Brevo n'est pas configuré.
        try {
            if (!process.env.BREVO_API_KEY && compteMailId) {
                // Per-tenant SMTP (utilisé seulement si Brevo non configuré et compteMailId fourni)
                const nodemailer = require('nodemailer');
                const [[compte]] = await pool.query(
                    'SELECT * FROM comptesmails WHERE IDComptesMails = ? AND structur_id = ?',
                    [compteMailId, req.structur_id]
                );
                if (!compte) return res.status(404).json({ error: 'Compte mail introuvable' });
                const adresseMail = compte.adressemail || compte.AdresseMail;
                const motDePasse  = compte.MotdePasse  || compte.MotDePasse;
                const serveurSMTP = compte.ServeurSMTP || compte.serveursmtp;
                const portSMTP    = parseInt(compte.PortSMTP || compte.portsmtp || 587) || 587;
                const secureSSL   = !!(compte.SecureSSL || compte.securessl);
                if (!serveurSMTP) {
                    return res.status(400).json({ error: 'Aucun serveur SMTP configuré. Ajoutez BREVO_API_KEY dans Render (gratuit sur brevo.com).' });
                }
                const transporter = nodemailer.createTransport({
                    host: serveurSMTP, port: portSMTP, secure: secureSSL,
                    auth: { user: adresseMail, pass: motDePasse },
                    tls: { rejectUnauthorized: false },
                    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 20000,
                });
                await transporter.verify();
                await transporter.sendMail({
                    from: `"${fromName}" <${fromEmail}>`,
                    to: clientEmail,
                    subject,
                    html: bodyHtml,
                    attachments: attachmentBuffers,
                });
            } else {
                // Brevo HTTP API (préféré) ou SMTP global en fallback — géré par le mailer partagé
                await sendMail({
                    fromEmail, fromName,
                    to: clientEmail,
                    subject,
                    html: bodyHtml,
                    attachments: attachmentBuffers,
                });
            }
        } catch (sendErr) {
            const brevoMsg = sendErr?.response?.data?.message;
            const smtpMsg  = sendErr?.message || '';
            if (smtpMsg.includes('timeout') || smtpMsg.includes('ETIMEDOUT') || smtpMsg.includes('ECONNREFUSED')) {
                return res.status(400).json({
                    error: `Connexion SMTP impossible (${smtpMsg}). Render bloque les ports SMTP sortants — ajoutez BREVO_API_KEY dans les variables d'environnement Render (gratuit sur brevo.com).`,
                });
            }
            return res.status(500).json({
                error: brevoMsg ? `Erreur Brevo : ${brevoMsg}` : `Erreur d'envoi : ${smtpMsg}`,
            });
        }

        // 7. Mark as sent
        await pool.query('UPDATE factures SET dateenvoye = NOW() WHERE IDFactures = ?', [invoiceId]);
        res.json({ message: `E-mail envoyé avec succès à ${clientEmail}` });

    } catch (error) {
        console.error('Error sending invoice email:', error?.response?.data || error.message);
        const brevoErr = error?.response?.data?.message;
        res.status(500).json({ error: brevoErr ? `Erreur Brevo : ${brevoErr}` : "Erreur lors de l'envoi : " + error.message });
    }
});

module.exports = router;
