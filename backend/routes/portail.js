const express = require('express');
const crypto = require('crypto');
const path = require('path');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');
const pool = require('../config/database');
const { hashPassword, comparePassword, validateEmail, validatePassword } = require('../utils/auth');
const { sendMail } = require('../services/mailer');
const { readDocument } = require('../services/documentReader');
const { emettreConfirmation, sha256 } = require('../services/portailConfirmation');
const portailAuth = require('../middleware/portailAuth');
const { loginLimiter, passwordResetLimiter, registerLimiter } = require('../middleware/rateLimit');

/**
 * Portail client (option, PORTAIL_CLIENT_ENABLED=true) : lecture seule des dossiers, factures et documents
 * d'UN client. Chaque requête de données est filtrée par req.portail.idclients (lu en base d'après le jeton) ;
 * un dossier, un document ou une facture d'un autre client répond 404, comme s'il n'existait pas.
 */
const router = express.Router();

const escapeHtml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DOSSIER_ACTIF = '(d.facturable IS NULL OR d.facturable != -1)';
// Documents visibles : tous, sauf les types masqués par l'équipe
const DOCUMENT_VISIBLE = '(doc.idtypesdocuments IS NULL OR doc.idtypesdocuments NOT IN (SELECT idtypesdocuments FROM portail_types_masques))';

const journaliser = async (req, action, reference) => {
    try {
        await pool.query('INSERT INTO portail_journal (client_user_id, action, reference, ip) VALUES (?, ?, ?, ?)',
            [req.portail.id, action, reference ? String(reference) : null, req.ip]);
    } catch (e) { console.error('Journal portail :', e.message); }
};

// ───────────────────────── Authentification (publique)

router.post('/auth/register', registerLimiter, async (req, res) => {
    try {
        const nom = String(req.body.nom || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const societe = String(req.body.societe || '').trim();
        const telephone = String(req.body.telephone || '').trim().slice(0, 40);

        if (nom.length < 2 || nom.length > 150) return res.status(400).json({ error: 'Indiquez votre nom.' });
        if (!validateEmail(email) || email.length > 255) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
        if (societe.length < 2 || societe.length > 200) return res.status(400).json({ error: 'Indiquez le nom de votre société.' });

        const [dejaLa] = await pool.query('SELECT id, statut, email_verified_at FROM client_users WHERE lower(email) = ?', [email]);
        let id = null;
        if (!dejaLa.length) {
            const [r] = await pool.query(
                `INSERT INTO client_users (email, nom, telephone, societe_declaree) VALUES (?, ?, ?, ?)`,
                [email, nom, telephone || null, societe]
            );
            id = r.insertId;
        } else if (dejaLa[0].statut === 'EN_ATTENTE' && !dejaLa[0].email_verified_at) {
            // Adresse jamais confirmée : la dernière demande remplace la précédente (le titulaire de la boîte voit nom et
            // société dans l'e-mail). Le mot de passe n'est jamais fourni ici : un tiers ne peut pas en imposer un.
            await pool.query('UPDATE client_users SET nom = ?, telephone = ?, societe_declaree = ? WHERE id = ?',
                [nom, telephone || null, societe, dejaLa[0].id]);
            id = dejaLa[0].id;
        }
        if (id) await emettreConfirmation(id);
        // Même réponse que l'adresse existe déjà ou non : on ne révèle pas quelles adresses ont un compte
        res.status(201).json({ message: "Votre demande est enregistrée. Un e-mail vient de vous être envoyé : cliquez sur le lien qu'il contient pour confirmer votre adresse et choisir votre mot de passe. Notre équipe examinera ensuite votre demande." });
    } catch (e) {
        console.error('Portail inscription :', e);
        res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
    }
});

router.post('/auth/verify-email', passwordResetLimiter, async (req, res) => {
    try {
        const token = String(req.body.token || '');
        if (!token) return res.status(400).json({ error: 'Lien invalide.' });
        // Le mot de passe est choisi ici, par la personne qui lit la boîte e-mail : confirmer l'adresse et définir
        // le mot de passe sont une seule opération (le lien ne peut pas confirmer un compte dont un tiers connaît le mot de passe).
        const pw = validatePassword(String(req.body.password || ''));
        if (!pw.valid) return res.status(400).json({ error: pw.message });
        const [r] = await pool.query(
            `UPDATE client_users SET email_verified_at = NOW(), password_hash = ?, verify_token_hash = NULL, verify_expires = NULL
             WHERE verify_token_hash = ? AND verify_expires > NOW() AND email_verified_at IS NULL`,
            [await hashPassword(String(req.body.password)), sha256(token)]
        );
        if (!r.affectedRows) return res.status(400).json({ error: "Lien invalide ou expiré. Refaites votre demande d'accès." });
        res.json({ message: "Adresse confirmée et mot de passe enregistré. Notre équipe va examiner votre demande ; vous serez prévenu par e-mail de l'ouverture de votre accès." });
    } catch (e) {
        console.error('Portail confirmation e-mail :', e);
        res.status(500).json({ error: 'Erreur lors de la confirmation.' });
    }
});

router.post('/auth/login', loginLimiter, async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        if (!email || !password) return res.status(400).json({ error: 'E-mail et mot de passe requis.' });

        const [rows] = await pool.query('SELECT id, nom, email, idclients, statut, password_hash, email_verified_at FROM client_users WHERE lower(email) = ?', [email]);
        const u = rows[0];
        // Mot de passe vérifié d'abord : on ne confirme l'existence d'un compte qu'à qui connaît son mot de passe
        if (!u || !u.password_hash || !(await comparePassword(password, u.password_hash))) return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
        if (u.statut === 'EN_ATTENTE') return res.status(403).json({ code: 'EN_ATTENTE', error: 'Votre demande est en attente de validation par notre équipe.' });
        if (u.statut !== 'ACTIF' || !u.idclients) return res.status(403).json({ code: u.statut, error: 'Cet accès n\'est pas actif. Contactez-nous.' });

        await pool.query('UPDATE client_users SET last_login = NOW() WHERE id = ?', [u.id]);
        req.portail = { id: u.id };
        await journaliser(req, 'CONNEXION');
        const token = jwt.sign({ clientUserId: u.id }, process.env.JWT_SECRET, { audience: 'portail', expiresIn: process.env.PORTAIL_JWT_EXPIRES_IN || '8h' });
        res.json({ token, user: { nom: u.nom, email: u.email } });
    } catch (e) {
        console.error('Portail connexion :', e);
        res.status(500).json({ error: 'Erreur lors de la connexion.' });
    }
});

router.post('/auth/forgot-password', passwordResetLimiter, async (req, res) => {
    const reponse = { message: 'Si cette adresse a un compte actif, un lien de réinitialisation vient d\'être envoyé.' };
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!validateEmail(email)) return res.json(reponse);
        const [rows] = await pool.query(`SELECT id, nom, email FROM client_users WHERE lower(email) = ? AND statut = 'ACTIF'`, [email]);
        if (rows.length) {
            const token = crypto.randomBytes(32).toString('hex');
            await pool.query('UPDATE client_users SET reset_token_hash = ?, reset_expires = ? WHERE id = ?',
                [sha256(token), new Date(Date.now() + 30 * 60 * 1000), rows[0].id]);
            const lien = `${process.env.FRONTEND_URL}/portail/reinitialiser?token=${token}`;
            try {
                await sendMail({
                    to: rows[0].email,
                    subject: 'Réinitialisation de votre mot de passe',
                    html: `<p>Bonjour ${escapeHtml(rows[0].nom)},</p><p>Pour choisir un nouveau mot de passe, cliquez sur ce lien (valable 30 minutes) :</p>` +
                          `<p><a href="${lien}">${lien}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
                });
            } catch (mailErr) { console.error('Mail de réinitialisation portail :', mailErr.message); }
        }
        res.json(reponse);
    } catch (e) {
        console.error('Portail mot de passe oublié :', e);
        res.json(reponse);
    }
});

router.post('/auth/reset-password', passwordResetLimiter, async (req, res) => {
    try {
        const token = String(req.body.token || '');
        const pw = validatePassword(String(req.body.newPassword || ''));
        if (!token) return res.status(400).json({ error: 'Lien invalide.' });
        if (!pw.valid) return res.status(400).json({ error: pw.message });
        const [rows] = await pool.query(
            `SELECT id FROM client_users WHERE reset_token_hash = ? AND reset_expires > NOW() AND statut = 'ACTIF'`, [sha256(token)]);
        if (!rows.length) return res.status(400).json({ error: 'Lien invalide ou expiré.' });
        await pool.query('UPDATE client_users SET password_hash = ?, reset_token_hash = NULL, reset_expires = NULL WHERE id = ?',
            [await hashPassword(req.body.newPassword), rows[0].id]);
        res.json({ message: 'Mot de passe modifié. Vous pouvez vous connecter.' });
    } catch (e) {
        console.error('Portail réinitialisation :', e);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation.' });
    }
});

// ───────────────────────── Données (connecté, lecture seule)

router.use(portailAuth);

router.get('/auth/me', async (req, res) => {
    const [rows] = await pool.query('SELECT nomrs AS nomrs FROM clients WHERE idclients = ?', [req.portail.idclients]);
    res.json({ nom: req.portail.nom, email: req.portail.email, client: rows[0] ? rows[0].nomrs : null });
});

// Factures validées du client (une facture non validée est un brouillon interne : jamais visible)
const FACTURES_SQL = `
    SELECT f.idfactures AS id, f.numerofacture AS numero, f.datefacture AS date, f.dateecheance AS echeance,
           f.montantttcfacture AS ttc, COALESCE(f.montantreglefacture, 0) AS regle,
           COALESCE(f.reliquatfacture, f.montantttcfacture - COALESCE(f.montantreglefacture, 0)) AS reliquat,
           d.iddossiers AS dossier_id, d.codedossier AS dossier_code, d.libelle AS dossier_libelle
    FROM factures f JOIN dossiers d ON d.iddossiers = f.iddossiers
    WHERE d.idclients = ? AND f.validee = 1 AND ${DOSSIER_ACTIF}`;

// Transport d'un dossier : le lien se fait par transports.idbl (= identifiant du dossier, convention de l'application).
// Ni les observations internes ni l'agent ne sont exposés.
const TRANSPORT_SQL = `
    SELECT COALESCE(m.libellemoyenstransport, t.libelletransport) AS moyen, ti.libtier AS compagnie,
           t.numerotitretransport AS titre, t.numeroescale AS escale,
           t.datedepart AS date_depart, ld.nomlieu AS lieu_depart, pd.nompays AS pays_depart,
           t.datearriveeprevue AS arrivee_prevue, t.heurearriveeprevue AS heure_arrivee, la.nomlieu AS lieu_arrivee, pa.nompays AS pays_arrivee
    FROM transports t
         LEFT JOIN moyenstransport m ON m.idmoyenstransport = t.idmoyenstransport
         LEFT JOIN tiers ti ON ti.idtiers = m.idtiers
         LEFT JOIN lieux ld ON ld.idlieux = t.idlieudepart LEFT JOIN pays pd ON pd.idpays = ld.idpays
         LEFT JOIN lieux la ON la.idlieux = t.idlieuarrive LEFT JOIN pays pa ON pa.idpays = la.idpays
    WHERE t.idbl = ? ORDER BY t.idtransports DESC LIMIT 1`;

const totaux = (factures) => factures.reduce((t, f) => ({
    facture: t.facture + Number(f.ttc || 0), regle: t.regle + Number(f.regle || 0), reliquat: t.reliquat + Number(f.reliquat || 0),
}), { facture: 0, regle: 0, reliquat: 0 });

router.get('/resume', async (req, res) => {
    try {
        const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM dossiers d WHERE d.idclients = ? AND ${DOSSIER_ACTIF}`, [req.portail.idclients]);
        const [factures] = await pool.query(FACTURES_SQL, [req.portail.idclients]);
        res.json({ dossiers: Number(n), factures: factures.length, ...totaux(factures) });
    } catch (e) {
        console.error('Portail résumé :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/dossiers', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT d.iddossiers AS id, d.codedossier AS code, d.libelle AS libelle, d.naturedossier AS nature, d.modeexpedition AS mode,
                    d.typedossier AS type, COALESCE(d.dateouverturedossiers, d.saisile) AS date_ouverture, e.libelleetapesdossiers AS etape,
                    (SELECT COUNT(*) FROM documents doc WHERE doc.iddossiers = d.iddossiers AND ${DOCUMENT_VISIBLE}) AS nb_documents,
                    (SELECT t.datearriveeprevue FROM transports t WHERE t.idbl = d.iddossiers ORDER BY t.idtransports DESC LIMIT 1) AS arrivee_prevue,
                    (SELECT COALESCE(SUM(COALESCE(f.reliquatfacture, f.montantttcfacture - COALESCE(f.montantreglefacture, 0))), 0)
                       FROM factures f WHERE f.iddossiers = d.iddossiers AND f.validee = 1) AS reliquat
             FROM dossiers d LEFT JOIN etapesdossiers e ON e.idetapesdossiers = d.idetapedossiers
             WHERE d.idclients = ? AND ${DOSSIER_ACTIF}
             ORDER BY COALESCE(d.dateouverturedossiers, d.saisile) DESC, d.iddossiers DESC`,
            [req.portail.idclients]
        );
        res.json(rows);
    } catch (e) {
        console.error('Portail dossiers :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/dossiers/:id', async (req, res) => {
    try {
        const [dossiers] = await pool.query(
            `SELECT d.iddossiers AS id, d.codedossier AS code, d.libelle AS libelle, d.naturedossier AS nature, d.modeexpedition AS mode,
                    d.typedossier AS type, COALESCE(d.dateouverturedossiers, d.saisile) AS date_ouverture, d.idetapedossiers AS etape_id,
                    e.libelleetapesdossiers AS etape
             FROM dossiers d LEFT JOIN etapesdossiers e ON e.idetapesdossiers = d.idetapedossiers
             WHERE d.iddossiers = ? AND d.idclients = ? AND ${DOSSIER_ACTIF}`,
            [req.params.id, req.portail.idclients]
        );
        if (!dossiers.length) return res.status(404).json({ error: 'Dossier introuvable' });
        const dossier = dossiers[0];

        const [etapes] = await pool.query('SELECT idetapesdossiers AS id, libelleetapesdossiers AS libelle FROM etapesdossiers ORDER BY idetapesdossiers');
        const [documents] = await pool.query(
            `SELECT doc.iddocuments AS id, doc.libelledocument AS libelle, t.libelletypedocument AS type, doc.datepublication AS date
             FROM documents doc LEFT JOIN typesdocuments t ON t.idtypesdocuments = doc.idtypesdocuments
             WHERE doc.iddossiers = ? AND ${DOCUMENT_VISIBLE} ORDER BY doc.datepublication DESC, doc.iddocuments DESC`,
            [dossier.id]
        );
        const [factures] = await pool.query(`${FACTURES_SQL} AND d.iddossiers = ? ORDER BY f.datefacture DESC`, [req.portail.idclients, dossier.id]);
        const [transports] = await pool.query(TRANSPORT_SQL, [dossier.id]);
        res.json({ ...dossier, transport: transports[0] || null, etapes, documents, factures, totaux: totaux(factures) });
    } catch (e) {
        console.error('Portail dossier :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/documents/:id/download', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT doc.chemindocument AS chemin, doc.libelledocument AS libelle
             FROM documents doc JOIN dossiers d ON d.iddossiers = doc.iddossiers
             WHERE doc.iddocuments = ? AND d.idclients = ? AND ${DOSSIER_ACTIF} AND ${DOCUMENT_VISIBLE}`,
            [req.params.id, req.portail.idclients]
        );
        if (!rows.length) return res.status(404).json({ error: 'Document introuvable' });
        const contenu = await readDocument(rows[0].chemin);
        if (!contenu) return res.status(404).json({ error: 'Fichier introuvable' });
        await journaliser(req, 'TELECHARGE_DOCUMENT', req.params.id);
        const ext = path.extname(rows[0].chemin);
        res.attachment(`${rows[0].libelle || 'document'}${ext}`);
        res.type(ext || 'application/octet-stream');
        res.send(contenu);
    } catch (e) {
        console.error('Portail document :', e);
        res.status(500).json({ error: 'Erreur lors du téléchargement' });
    }
});

router.get('/dossiers/:id/documents.zip', async (req, res) => {
    try {
        const [dossiers] = await pool.query(`SELECT d.codedossier AS code FROM dossiers d WHERE d.iddossiers = ? AND d.idclients = ? AND ${DOSSIER_ACTIF}`,
            [req.params.id, req.portail.idclients]);
        if (!dossiers.length) return res.status(404).json({ error: 'Dossier introuvable' });
        const [docs] = await pool.query(
            `SELECT doc.iddocuments AS id, doc.chemindocument AS chemin, doc.libelledocument AS libelle
             FROM documents doc WHERE doc.iddossiers = ? AND ${DOCUMENT_VISIBLE} ORDER BY doc.iddocuments`, [req.params.id]);
        if (!docs.length) return res.status(404).json({ error: 'Aucun document disponible' });

        await journaliser(req, 'TELECHARGE_ZIP', req.params.id);
        res.attachment(`${dossiers[0].code || 'dossier'}-documents.zip`);
        const zip = archiver('zip', { zlib: { level: 6 } });
        zip.on('error', (e) => { console.error('Portail zip :', e); res.destroy(e); });
        zip.pipe(res);
        const noms = new Set();
        for (const d of docs) {
            try {
                const contenu = await readDocument(d.chemin);
                if (!contenu) continue;
                const ext = path.extname(d.chemin);
                let nom = `${(d.libelle || 'document').replace(/[\\/:*?"<>|]/g, '_')}${ext}`;
                for (let i = 2; noms.has(nom); i++) nom = `${(d.libelle || 'document').replace(/[\\/:*?"<>|]/g, '_')} (${i})${ext}`;
                noms.add(nom);
                zip.append(contenu, { name: nom });
            } catch (e) { console.warn(`Portail zip : document ${d.id} ignoré (${e.message})`); }
        }
        await zip.finalize();
    } catch (e) {
        console.error('Portail zip :', e);
        if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de la préparation du fichier' });
    }
});

router.get('/factures', async (req, res) => {
    try {
        const [factures] = await pool.query(`${FACTURES_SQL} ORDER BY f.datefacture DESC, f.idfactures DESC`, [req.portail.idclients]);
        res.json({ factures, totaux: totaux(factures) });
    } catch (e) {
        console.error('Portail factures :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/factures/:id/pdf', async (req, res) => {
    try {
        const [rows] = await pool.query(`${FACTURES_SQL} AND f.idfactures = ?`, [req.portail.idclients, req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Facture introuvable' });
        const InvoicePDFGenerator = require('../services/InvoicePDFGenerator');
        const pdfPath = await new InvoicePDFGenerator(pool).generatePDF(rows[0].id);
        await journaliser(req, 'TELECHARGE_FACTURE', rows[0].id);
        res.download(pdfPath, `Facture-${rows[0].numero || rows[0].id}.pdf`);
    } catch (e) {
        console.error('Portail facture PDF :', e);
        res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
});

module.exports = router;
