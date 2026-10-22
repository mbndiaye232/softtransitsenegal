const express = require('express');
const pool = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendMail } = require('../services/mailer');
const { emettreConfirmation } = require('../services/portailConfirmation');

/**
 * Administration du portail client (option, PORTAIL_CLIENT_ENABLED=true) : validation des inscriptions,
 * suspension des accès, types de documents visibles, journal des téléchargements.
 * Réservé aux administrateurs.
 */
const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('ADMIN', 'SUPER_ADMIN'));

const STATUTS = ['EN_ATTENTE', 'ACTIF', 'REFUSE', 'SUSPENDU'];

// Suggestion de client seulement pour une adresse confirmée (une adresse non vérifiée peut être celle d'un tiers).
// Pas de commentaire SQL ici : l'adaptateur pg ne gère pas une apostrophe dans le texte de la requête.
// Comptes, avec le client rattaché et, pour une demande, le client dont l'e-mail correspond (aide à la vérification)
router.get('/comptes', async (req, res) => {
    try {
        const statut = String(req.query.statut || '').toUpperCase();
        const [rows] = await pool.query(
            `SELECT u.id, u.nom, u.email, u.telephone, u.societe_declaree, u.statut, u.idclients, c.nomrs AS client,
                    u.created_at, u.validated_at, u.last_login, (u.email_verified_at IS NOT NULL) AS email_confirme,
                    CASE WHEN u.email_verified_at IS NULL THEN NULL ELSE (SELECT c2.idclients FROM clients c2
                      WHERE lower(c2.emailclient) = lower(u.email) OR lower(c2.emailpersonnecontact) = lower(u.email) LIMIT 1) END AS client_suggere_id,
                    CASE WHEN u.email_verified_at IS NULL THEN NULL ELSE (SELECT c2.nomrs FROM clients c2
                      WHERE lower(c2.emailclient) = lower(u.email) OR lower(c2.emailpersonnecontact) = lower(u.email) LIMIT 1) END AS client_suggere
             FROM client_users u LEFT JOIN clients c ON c.idclients = u.idclients
             ${STATUTS.includes(statut) ? 'WHERE u.statut = ?' : ''}
             ORDER BY (u.statut = 'EN_ATTENTE') DESC, u.created_at DESC`,
            STATUTS.includes(statut) ? [statut] : []
        );
        res.json(rows);
    } catch (e) {
        console.error('Portail admin comptes :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/comptes/:id/valider', async (req, res) => {
    try {
        const idclients = Number(req.body.idclients);
        if (!Number.isInteger(idclients)) return res.status(400).json({ error: 'Choisissez le client à rattacher.' });
        const [clients] = await pool.query('SELECT idclients AS idclients, nomrs AS nomrs FROM clients WHERE idclients = ?', [idclients]);
        if (!clients.length) return res.status(400).json({ error: 'Client introuvable.' });
        const [existe] = await pool.query('SELECT email_verified_at FROM client_users WHERE id = ?', [req.params.id]);
        if (existe.length && !existe[0].email_verified_at) {
            return res.status(400).json({ error: "L'adresse e-mail n'est pas confirmée : le demandeur doit d'abord cliquer sur le lien reçu." });
        }
        const [r] = await pool.query(
            `UPDATE client_users SET statut = 'ACTIF', idclients = ?, validated_at = NOW(), validated_by = ?
             WHERE id = ? AND statut IN ('EN_ATTENTE', 'REFUSE', 'SUSPENDU') AND email_verified_at IS NOT NULL`,
            [idclients, req.user.id, req.params.id]
        );
        if (!r.affectedRows) return res.status(404).json({ error: 'Demande introuvable ou déjà active.' });
        const [u] = await pool.query('SELECT nom, email FROM client_users WHERE id = ?', [req.params.id]);
        try {
            await sendMail({
                to: u[0].email,
                subject: 'Votre accès au portail client est activé',
                html: `<p>Bonjour ${String(u[0].nom).replace(/[<>&"]/g, '')},</p><p>Votre accès au portail est activé. ` +
                      `Vous pouvez vous connecter avec votre adresse e-mail et le mot de passe choisi à l'inscription : ` +
                      `<a href="${process.env.FRONTEND_URL}/portail">${process.env.FRONTEND_URL}/portail</a></p>`,
            });
        } catch (mailErr) { console.error('Mail d\'activation portail :', mailErr.message); }
        res.json({ message: `Accès activé pour ${clients[0].nomrs}.` });
    } catch (e) {
        console.error('Portail admin valider :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/comptes/:id/renvoyer-confirmation', async (req, res) => {
    try {
        if (!(await emettreConfirmation(req.params.id, { strict: true }))) return res.status(404).json({ error: 'Compte introuvable ou adresse déjà confirmée.' });
        res.json({ message: 'E-mail de confirmation renvoyé.' });
    } catch (e) {
        if (e.code === 'MAIL') {
            // Le nouveau lien est enregistré mais le message n'est pas parti : l'équipe doit le savoir et pouvoir agir
            const cause = /BREVO_API_KEY|SMTP_HOST/.test(e.message) ? "aucun service d'envoi d'e-mails n'est configuré sur le serveur" : e.message;
            console.error('Portail admin renvoi confirmation (e-mail non envoyé) :', e.message);
            return res.status(502).json({ error: `L'e-mail n'a pas pu être envoyé : ${cause}. Faites vérifier la configuration d'envoi des e-mails du serveur (BREVO_API_KEY).` });
        }
        console.error('Portail admin renvoi confirmation :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

const changerStatut = (route, de, vers) => router.post(`/comptes/:id/${route}`, async (req, res) => {
    try {
        const [r] = await pool.query(`UPDATE client_users SET statut = ? WHERE id = ? AND statut IN (${de.map(() => '?').join(',')})`,
            [vers, req.params.id, ...de]);
        if (!r.affectedRows) return res.status(404).json({ error: 'Compte introuvable ou dans un autre état.' });
        res.json({ message: 'Compte mis à jour.' });
    } catch (e) {
        console.error(`Portail admin ${route} :`, e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
changerStatut('refuser', ['EN_ATTENTE'], 'REFUSE');
changerStatut('suspendre', ['ACTIF'], 'SUSPENDU');

// Types de documents : visibles par défaut ; un type masqué n'apparaît plus et n'est plus téléchargeable par les clients
router.get('/types-documents', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT t.idtypesdocuments AS id, t.libelletypedocument AS libelle,
                    (m.idtypesdocuments IS NULL) AS visible
             FROM typesdocuments t LEFT JOIN portail_types_masques m ON m.idtypesdocuments = t.idtypesdocuments
             ORDER BY t.libelletypedocument`
        );
        res.json(rows.map(r => ({ id: r.id, libelle: r.libelle, visible: r.visible === true || r.visible === 1 || r.visible === 't' })));
    } catch (e) {
        console.error('Portail admin types :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.put('/types-documents/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || typeof req.body.visible !== 'boolean') return res.status(400).json({ error: 'Requête invalide.' });
        const [t] = await pool.query('SELECT 1 FROM typesdocuments WHERE idtypesdocuments = ?', [id]);
        if (!t.length) return res.status(404).json({ error: 'Type de document introuvable.' });
        if (req.body.visible) await pool.query('DELETE FROM portail_types_masques WHERE idtypesdocuments = ?', [id]);
        else await pool.query('INSERT INTO portail_types_masques (idtypesdocuments) VALUES (?) ON CONFLICT DO NOTHING', [id]);
        res.json({ message: 'Réglage enregistré.' });
    } catch (e) {
        console.error('Portail admin types :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/journal', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT j.id, j.action, j.reference, j.ip, j.created_at, u.nom, u.email, c.nomrs AS client
             FROM portail_journal j JOIN client_users u ON u.id = j.client_user_id LEFT JOIN clients c ON c.idclients = u.idclients
             ORDER BY j.created_at DESC LIMIT 200`
        );
        res.json(rows);
    } catch (e) {
        console.error('Portail admin journal :', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
