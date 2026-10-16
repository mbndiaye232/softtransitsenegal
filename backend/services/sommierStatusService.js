/**
 * Recalcule le statut d'un sommier après modification de ses compteurs apurés.
 *
 * Règle métier :
 *   Un sommier est APURÉ si pour CHAQUE article :
 *     poids_initial > 0 ET poids_apure >= poids_initial
 *     OU
 *     colis_initial > 0 ET colis_apure >= colis_initial
 *
 *   La valeur n'entre pas dans le critère.
 */
const pool = require('../config/database');

async function recomputeSommierStatut(sommierId) {
    const [[counts]] = await pool.query(
        `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN (poids_initial > 0 AND poids_apure >= poids_initial)
                       OR (colis_initial > 0 AND colis_apure >= colis_initial)
                     THEN 1 ELSE 0 END) AS apures
         FROM sommier_article WHERE sommier_id = ?`,
        [sommierId]
    );
    if (counts.total > 0 && Number(counts.total) === Number(counts.apures)) {
        await pool.query(
            `UPDATE sommier
             SET statut = 'APURE',
                 date_apurement_total = COALESCE(date_apurement_total, CURRENT_DATE)
             WHERE id = ? AND statut = 'ACTIF'`,
            [sommierId]
        );
        return 'APURE';
    }
    // Sinon, repasser de APURE à ACTIF si la situation a changé (suppression d'un apurement, etc.)
    const [r] = await pool.query(
        `UPDATE sommier
         SET statut = 'ACTIF', date_apurement_total = NULL
         WHERE id = ? AND statut = 'APURE'`,
        [sommierId]
    );
    // Si on vient de repasser de APURE à ACTIF, purger les logs d'alertes
    // pour permettre le renvoi des alertes au prochain palier d'échéance.
    if (r.affectedRows > 0) {
        await pool.query(
            `DELETE FROM sommier_alert_log WHERE sommier_id = ?`,
            [sommierId]
        );
    }
    return 'ACTIF';
}

module.exports = { recomputeSommierStatut };
