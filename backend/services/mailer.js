/**
 * Mailer partagé : Brevo HTTP API (préféré) avec fallback SMTP.
 *
 * Pourquoi : Render et Railway bloquent les ports SMTP sortants (25/465/587)
 * en tier gratuit. L'envoi via API HTTPS sur le port 443 contourne ce blocage.
 *
 * Configuration requise (à définir dans les variables d'environnement
 * du service backend sur Render) :
 *   - BREVO_API_KEY        : clé API Brevo (obtenue sur https://app.brevo.com)
 *   - BREVO_SENDER_EMAIL   : adresse expéditeur (par défaut SMTP_USER ou noreply@softtransit.net)
 *   - BREVO_SENDER_NAME    : nom expéditeur affiché (par défaut "Soft Transit")
 *
 * Si BREVO_API_KEY est absent, on tente SMTP en fallback (utile en dev local).
 */
const axios = require('axios');
const nodemailer = require('nodemailer');

const DEFAULT_FROM_NAME = process.env.BREVO_SENDER_NAME || 'Soft Transit';
const DEFAULT_FROM_EMAIL = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'noreply@softtransit.net';

/**
 * Envoie un email via Brevo API si BREVO_API_KEY est défini,
 * sinon via SMTP en fallback.
 *
 * @param {Object} opts
 * @param {string} [opts.fromEmail]   - Adresse expéditeur (défaut : env BREVO_SENDER_EMAIL ou SMTP_USER)
 * @param {string} [opts.fromName]    - Nom expéditeur (défaut : "Soft Transit")
 * @param {string|string[]} opts.to   - Destinataire(s)
 * @param {string} opts.subject       - Objet
 * @param {string} [opts.html]        - Corps HTML
 * @param {string} [opts.text]        - Corps texte (utilisé si pas de html)
 * @param {Array}  [opts.attachments] - [{ filename, content (Buffer|string) }]
 * @returns {Promise<{ provider: 'brevo'|'smtp', messageId?: string }>}
 */
async function sendMail({ fromEmail, fromName, to, subject, html, text, attachments = [] }) {
    const sender = {
        email: fromEmail || DEFAULT_FROM_EMAIL,
        name:  fromName  || DEFAULT_FROM_NAME,
    };
    const recipients = Array.isArray(to) ? to : [to];

    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    // ── Brevo HTTP API (port 443 — jamais bloqué par Render/Railway) ────────
    if (BREVO_API_KEY) {
        const brevoAttachments = attachments.map(a => ({
            name: a.filename,
            content: Buffer.isBuffer(a.content)
                ? a.content.toString('base64')
                : Buffer.from(a.content).toString('base64'),
        }));

        const payload = {
            sender,
            to: recipients.map(email => ({ email })),
            subject,
            ...(html ? { htmlContent: html } : {}),
            ...(text ? { textContent: text } : {}),
            ...(brevoAttachments.length ? { attachment: brevoAttachments } : {}),
        };

        const res = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
            headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
            timeout: 30000,
        });
        return { provider: 'brevo', messageId: res.data?.messageId };
    }

    // ── Fallback SMTP (dev local ou si BREVO_API_KEY pas encore configuré) ──
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        throw new Error(
            "Envoi d'email impossible : ni BREVO_API_KEY ni SMTP_HOST/SMTP_USER ne sont configurés. " +
            "Ajoutez BREVO_API_KEY dans Render (gratuit sur brevo.com)."
        );
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 20000,
    });

    const info = await transporter.sendMail({
        from: `"${sender.name}" <${sender.email}>`,
        to: recipients.join(', '),
        subject,
        html,
        text,
        attachments: attachments.map(a => ({ filename: a.filename, content: a.content })),
    });
    return { provider: 'smtp', messageId: info.messageId };
}

module.exports = { sendMail };
