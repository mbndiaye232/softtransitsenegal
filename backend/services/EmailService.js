/**
 * @deprecated Utiliser directement `require('./mailer').sendMail` à la place.
 * Cette classe est conservée pour compatibilité ascendante.
 *
 * Elle s'appuie maintenant sur le mailer partagé qui privilégie l'API HTTP
 * Brevo (port 443, non bloqué par Render/Railway) et bascule sur SMTP en
 * dernier recours.
 */
const { sendMail } = require('./mailer');

class EmailService {
    /**
     * Envoie un email avec pièces jointes.
     * @param {Object} options
     * @param {string} options.to
     * @param {string} options.subject
     * @param {string} [options.text]
     * @param {string} [options.html]
     * @param {Array}  [options.attachments] - [{ filename, path|content }]
     */
    async sendEmail({ to, subject, text, html, attachments }) {
        // Normalise les pièces jointes : si on a un `path`, on lit le fichier
        // (les anciens appelants passaient { filename, path }).
        const fs = require('fs');
        const normalizedAttachments = (attachments || []).map(a => {
            if (a.content) return { filename: a.filename, content: a.content };
            if (a.path)    return { filename: a.filename, content: fs.readFileSync(a.path) };
            return a;
        });

        try {
            const info = await sendMail({ to, subject, text, html, attachments: normalizedAttachments });
            console.log(`Email sent via ${info.provider}: ${info.messageId || '(no id)'}`);
            return info;
        } catch (error) {
            console.error('Email sending failed:', error.message);
            throw error;
        }
    }
}

module.exports = new EmailService();
