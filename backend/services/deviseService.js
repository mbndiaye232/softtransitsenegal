/**
 * Devise de référence de l'application (celle dont le taux vaut toujours 1).
 * Voir migrations-pg/003_devise_reference.sql : un seul devises.est_reference
 * peut être vrai à la fois (contrainte d'unicité partielle).
 */
const pool = require('../config/database');

const FALLBACK = { IDDevises: null, libelle: 'Franc Congolais', Symbole: 'FC' };

/**
 * @returns {{IDDevises: number, libelle: string, Symbole: string}}
 */
async function getReferenceCurrency() {
    const [rows] = await pool.query(
        'SELECT IDDevises, libelle, Symbole FROM devises WHERE est_reference = true LIMIT 1'
    );
    return rows[0] || FALLBACK;
}

module.exports = { getReferenceCurrency };
