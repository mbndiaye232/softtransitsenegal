/**
 * Service d'alertes d'échéance — Sommiers v2
 *
 * Paliers EXACTS : J-30, J-15, J-7, J-3, J-2, J-1, J-0.
 *                  Aucune alerte après la date d'échéance.
 *
 * Destinataires :
 *   1. Email société   → structur.Emailstructur
 *   2. Agents          → agents WHERE recevoir_alerte_suspension = 1
 *   3. Email client    → clients.EmailClient si Alerte_Suspension = 1
 *
 * Déduplication : sommier_alert_log
 *   - Pour les horizons positifs (30,15,7,3,2,1) : un seul mail par horizon.
 *   - Pour les horizons <= 0 : un mail par JOUR (alert_date = CURDATE()).
 */
const pool         = require('../config/database');
const { sendMail } = require('./mailer');

// Paliers EXACTS — alerte envoyée seulement à ces jours précis
const PRE_HORIZONS = [30, 15, 7, 3, 2, 1];

/* ─── Couleur / urgence selon jours restants ─────────────────────────────── */
function alertStyle(days) {
    if (days <= 0)  return { urgence: '⛔ DÉPASSÉ',    color: '#000000', bg: '#f3f4f6' };
    if (days <= 3)  return { urgence: '🚨 CRITIQUE',   color: '#7f1d1d', bg: '#fef2f2' };
    if (days <= 7)  return { urgence: '⚠️ URGENT',     color: '#ef4444', bg: '#fee2e2' };
    if (days <= 15) return { urgence: '⚠️ Attention',  color: '#c2410c', bg: '#fff7ed' };
    if (days <= 30) return { urgence: 'ℹ️ Rappel',     color: '#fb923c', bg: '#fff7ed' };
    return              { urgence: 'ℹ️ Information',  color: '#166534', bg: '#f0fdf4' };
}

/* ─── HTML de l'email ────────────────────────────────────────────────────── */
function buildHtml(som, daysLeft) {
    const { urgence, color, bg } = alertStyle(daysLeft);
    const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const echeance = fmtDate(som.date_echeance);
    const debut    = fmtDate(som.date_declaration);

    const sub = daysLeft >= 0
        ? `J-${daysLeft}`
        : `J+${Math.abs(daysLeft)} (dépassé)`;

    return `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <div style="background:${color};color:white;padding:20px 28px;">
    <div style="font-size:18px;font-weight:800;margin-bottom:4px;">${urgence} — Échéance sommier</div>
    <div style="font-size:14px;opacity:.9;">Alerte automatique Soft Transit · ${sub}</div>
  </div>
  <div style="padding:28px;background:white;">
    <p style="margin:0 0 16px;font-size:15px;color:#111827;">
      ${daysLeft > 0
        ? `Le sommier suivant arrive à échéance dans <strong style="color:${color};">${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.`
        : daysLeft === 0
        ? `Le sommier suivant arrive à échéance <strong style="color:${color};">aujourd'hui</strong>.`
        : `Le sommier suivant a dépassé son échéance de <strong style="color:${color};">${Math.abs(daysLeft)} jour${Math.abs(daysLeft) > 1 ? 's' : ''}</strong>.`}
    </p>
    <table style="width:100%;border-collapse:collapse;background:${bg};border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;width:45%;">N° déclaration</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#111827;">${som.numero_declaration}</td></tr>
      <tr style="background:white;"><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Client</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">${som.client_nom || '—'}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Régime</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">${som.regime_code} — ${som.regime_libelle || ''}</td></tr>
      <tr style="background:white;"><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Date déclaration</td>
          <td style="padding:10px 16px;font-size:13px;color:#111827;">${debut}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;font-weight:700;">Échéance</td>
          <td style="padding:10px 16px;font-size:15px;font-weight:800;color:${color};">${echeance}</td></tr>
    </table>
    <div style="background:${bg};border-left:4px solid ${color};padding:14px 18px;border-radius:4px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#374151;">
        ${daysLeft <= 0
          ? '<strong>Action immédiate :</strong> apurez ou demandez une prorogation auprès de la douane sans délai.'
          : daysLeft <= 3
          ? '<strong>Action immédiate requise :</strong> procédez à l\'apurement ou demandez une prorogation.'
          : 'Vérifiez l\'avancement de l\'apurement et anticipez les démarches.'}
      </p>
    </div>
    <div style="text-align:center;margin:24px 0 16px;">
      <a href="${process.env.FRONTEND_URL || 'https://softtransit.net'}/sommiers"
         style="background:${color};color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
        Voir les sommiers
      </a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
      Email automatique Soft Transit SaaS · Ne pas répondre.
    </p>
  </div>
</div>`;
}

async function sendAlertEmails(recipients, som, daysLeft) {
    const { urgence } = alertStyle(daysLeft);
    const label   = urgence.replace(/[^\w\s-]/g, '').trim();
    const sub     = daysLeft >= 0 ? `J-${daysLeft}` : `J+${Math.abs(daysLeft)}`;
    const subject = `[${label} ${sub}] Sommier — ${som.regime_code} / Déclaration ${som.numero_declaration}`;
    const html    = buildHtml(som, daysLeft);
    const sent    = [];
    for (const email of recipients) {
        if (!email || !email.includes('@')) continue;
        try {
            await sendMail({ to: email.trim(), subject, html });
            sent.push(email.trim());
            console.log(`[SommierAlert] ${sub} → ${email} (sommier #${som.id})`);
        } catch (err) {
            console.error(`[SommierAlert] Échec envoi à ${email}:`, err.message);
        }
    }
    return sent;
}

/* ─── Job principal ──────────────────────────────────────────────────────── */
async function checkSommierEcheances() {
    try {
        const [rows] = await pool.query(
            `SELECT
                s.id, s.structur_id, s.numero_declaration,
                s.date_declaration, s.date_echeance, s.statut,
                (s.date_echeance - CURRENT_DATE) AS jours_restants,
                rd.CodeRegimeDeclaration    AS regime_code,
                rd.LibelleRegimeDeclaration AS regime_libelle,
                cl.NomRS                    AS client_nom,
                cl.EmailClient              AS client_email,
                cl.Alerte_Suspension        AS client_alerte,
                st.Emailstructur            AS email_societe
             FROM sommier s
             JOIN regimedeclaration rd ON rd.IDRegimeDeclaration = s.IDRegimeDeclaration
             LEFT JOIN clients cl      ON cl.IDCLIENTS = s.IDCLIENTS
             JOIN structur st          ON st.IDSociete = s.structur_id
             WHERE s.deleted_at IS NULL
               AND s.statut = 'ACTIF'
               AND (s.date_echeance - CURRENT_DATE) BETWEEN 0 AND 30`
        );

        for (const som of rows) {
            const daysLeft = parseInt(som.jours_restants, 10);
            let horizon, dedupDate;

            if (daysLeft === 0) {
                // J-0 : alerte le jour même de l'échéance (unique)
                horizon   = 0;
                dedupDate = new Date().toISOString().slice(0, 10);
            } else {
                // CORRESPONDANCE EXACTE uniquement : J-30, J-15, J-7, J-3, J-2, J-1
                if (!PRE_HORIZONS.includes(daysLeft)) continue;
                horizon   = daysLeft;
                dedupDate = '1970-01-01'; // constante : un seul envoi global par palier
            }

            // Dédup
            const [[existing]] = await pool.query(
                `SELECT id FROM sommier_alert_log
                 WHERE sommier_id = ? AND horizon_days = ? AND alert_date = ?`,
                [som.id, horizon, dedupDate]
            );
            if (existing) continue;

            // Destinataires
            const [agentRows] = await pool.query(
                `SELECT Email FROM agents
                 WHERE structur_id = ? AND recevoir_alerte_suspension = 1
                   AND is_active = 1 AND Email IS NOT NULL AND Email != ''`,
                [som.structur_id]
            );
            const clientEmail = (Number(som.client_alerte) === 1 && som.client_email) ? som.client_email : null;
            const emails = [...new Set([
                som.email_societe,
                ...agentRows.map(a => a.Email),
                clientEmail,
            ].filter(Boolean))];

            if (emails.length === 0) {
                console.warn(`[SommierAlert] Aucun destinataire pour structur ${som.structur_id} (sommier #${som.id})`);
                continue;
            }

            const sent = await sendAlertEmails(emails, som, daysLeft);
            if (sent.length > 0) {
                await pool.query(
                    `INSERT INTO sommier_alert_log
                        (sommier_id, horizon_days, alert_date, email_sent_to)
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT DO NOTHING`,
                    [som.id, horizon, dedupDate, sent.join(',').slice(0, 255)]
                );
            }
        }

        // Purge : logs des sommiers clôturés ou loin (>30j) → libère le palier pour réutilisation
        await pool.query(`
            DELETE FROM sommier_alert_log sal
            USING sommier s
            WHERE s.id = sal.sommier_id
              AND (s.statut <> 'ACTIF' OR (s.date_echeance - CURRENT_DATE) > 30)
        `);
    } catch (err) {
        console.error('[SommierAlert] Erreur check échéances:', err);
    }
}

/* ─── Scheduler quotidien à 08h00 UTC ───────────────────────────────────── */
function startSommierAlertScheduler() {
    const now   = new Date();
    const next8 = new Date(now);
    next8.setUTCHours(8, 0, 0, 0);
    if (next8 <= now) next8.setUTCDate(next8.getUTCDate() + 1);

    setTimeout(() => {
        checkSommierEcheances();
        setInterval(checkSommierEcheances, 24 * 60 * 60 * 1000);
    }, next8 - now);

    setTimeout(checkSommierEcheances, 15_000); // check au boot

    console.log(`🔔 Sommier alert scheduler démarré — prochain check à ${next8.toUTCString()}`);
}

module.exports = { checkSommierEcheances, startSommierAlertScheduler };
