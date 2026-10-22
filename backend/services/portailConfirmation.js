const crypto = require('crypto');
const pool = require('../config/database');
const { sendMail } = require('./mailer');

const escapeHtml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

/**
 * Génère un nouveau lien de confirmation d'adresse e-mail (24 h, stocké haché) et l'envoie au titulaire de l'adresse.
 * Tant que l'adresse n'est pas confirmée, l'équipe ne peut pas valider le compte : l'inscription ne prouve
 * pas que la personne possède l'adresse qu'elle a saisie.
 */
async function emettreConfirmation(clientUserId, { strict = false } = {}) {
    const [rows] = await pool.query('SELECT nom, email, societe_declaree FROM client_users WHERE id = ? AND email_verified_at IS NULL', [clientUserId]);
    if (!rows.length) return false;
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE client_users SET verify_token_hash = ?, verify_expires = ? WHERE id = ?',
        [sha256(token), new Date(Date.now() + 24 * 60 * 60 * 1000), clientUserId]);
    const lien = `${process.env.FRONTEND_URL}/portail/confirmer?token=${token}`;
    try {
        await sendMail({
            to: rows[0].email,
            subject: 'Confirmez votre adresse e-mail',
            html: `<p>Une demande d'accès à l'espace client a été faite avec cette adresse e-mail :</p>` +
                  `<p><strong>${escapeHtml(rows[0].nom)}</strong> — société déclarée : <strong>${escapeHtml(rows[0].societe_declaree)}</strong></p>` +
                  `<p>Si c'est bien vous, cliquez sur ce lien pour confirmer votre adresse et choisir votre mot de passe (valable 24 heures) :</p>` +
                  `<p><a href="${lien}">${lien}</a></p>` +
                  `<p><strong>Si vous n'êtes pas à l'origine de cette demande, ne cliquez pas</strong> et ignorez ce message.</p>`,
        });
    } catch (mailErr) {
        console.error('Mail de confirmation portail :', mailErr.message);
        // Inscription publique : on ne révèle rien au visiteur. Renvoi par l'équipe (strict) : l'échec doit se voir à l'écran.
        if (strict) throw Object.assign(new Error(mailErr.message), { code: 'MAIL' });
    }
    return true;
}

module.exports = { emettreConfirmation, sha256 };
