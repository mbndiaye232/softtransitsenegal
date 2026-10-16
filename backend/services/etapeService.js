/**
 * etapeService — Calcule et persiste l'étape d'un dossier dans `dossiers.IdEtapeDossiers`.
 *
 * Mapping des étapes (table etapesdossiers) :
 *   1 = Ouvert
 *   2 = Déclaré          (une déclaration existe)
 *   3 = Mis en livraison (une mise en livraison existe, sans DateEffectiveLivraison)
 *   4 = Livré            (mise en livraison avec DateEffectiveLivraison renseignée)
 *   5 = Facturé          (au moins une facture validée, rien payé)
 *   6 = Partiellement Payé (factures validées, paiement partiel)
 *   7 = Clôturé          (toutes les factures validées sont intégralement réglées)
 *   8 = Indéterminé      (ne doit pas se produire)
 */
const pool = require('../config/database');

/**
 * Calcule l'étape d'un dossier à partir des données liées.
 * Retourne un entier 1..7 (jamais 8).
 *
 * @param {number|string} dossierId  IDDossiers
 * @returns {Promise<number>}        Étape calculée (1..7)
 */
async function computeDossierEtape(dossierId) {
    if (!dossierId) return 1;

    // 1) Factures validées : somme des montants et reliquats
    const [[factAgg]] = await pool.query(
        `SELECT
            COUNT(*) AS nb_validees,
            COALESCE(SUM(MontantTTCFacture), 0) AS total_ttc,
            COALESCE(SUM(ReliquatFacture),  0) AS total_reliquat
         FROM factures
         WHERE IDDossiers = ? AND Validee = 1`,
        [dossierId]
    );

    if (factAgg.nb_validees > 0) {
        const totalTTC = parseFloat(factAgg.total_ttc) || 0;
        const reliquat = parseFloat(factAgg.total_reliquat) || 0;
        // Tolérance pour arrondis décimaux (1 FC)
        if (reliquat <= 1) return 7;                    // Clôturé
        if (reliquat >= totalTTC - 1) return 5;         // Facturé, rien payé
        return 6;                                       // Partiellement payé
    }

    // 2) Mise en livraison
    const [[mlAgg]] = await pool.query(
        `SELECT
            COUNT(*) AS nb_ml,
            MAX(DateEffectiveLivraison) AS max_date_eff
         FROM miseenlivraison
         WHERE IDDossiers = ?`,
        [dossierId]
    );

    if (mlAgg.nb_ml > 0) {
        if (mlAgg.max_date_eff) return 4;               // Livré
        return 3;                                       // Mis en livraison
    }

    // 3) Déclaration
    const [[declAgg]] = await pool.query(
        `SELECT COUNT(*) AS nb FROM declarations WHERE IDDossiers = ?`,
        [dossierId]
    );
    if (declAgg.nb > 0) return 2;                       // Déclaré

    // 4) Par défaut : Ouvert
    return 1;
}

/**
 * Calcule puis persiste l'étape d'un dossier dans `dossiers.IdEtapeDossiers`.
 * Best-effort : log et avale les erreurs (ne fait pas échouer la requête appelante).
 *
 * @param {number|string} dossierId
 * @returns {Promise<number|null>}  Étape persistée, ou null en cas d'erreur
 */
async function recomputeAndSaveDossierEtape(dossierId) {
    if (!dossierId) return null;
    try {
        const etape = await computeDossierEtape(dossierId);
        await pool.query(
            'UPDATE dossiers SET IdEtapeDossiers = ? WHERE IDDossiers = ?',
            [etape, dossierId]
        );
        return etape;
    } catch (err) {
        console.error(`[etapeService] recompute failed for dossier ${dossierId}:`, err.message);
        return null;
    }
}

/**
 * Recalcule l'étape de tous les dossiers (backfill).
 * À utiliser une seule fois après le déploiement de cette feature.
 *
 * @param {Object} [opts]
 * @param {number} [opts.structurId]   Limiter à une structure (sinon : tous)
 * @returns {Promise<{updated: number, errors: number}>}
 */
async function recomputeAllDossiersEtape({ structurId } = {}) {
    const params = [];
    let query = 'SELECT IDDossiers FROM dossiers WHERE (Facturable IS NULL OR Facturable != -1)';
    if (structurId) {
        query += ' AND structur_id = ?';
        params.push(structurId);
    }
    const [rows] = await pool.query(query, params);

    let updated = 0;
    let errors  = 0;
    for (const r of rows) {
        const result = await recomputeAndSaveDossierEtape(r.IDDossiers);
        if (result === null) errors++; else updated++;
    }
    return { updated, errors, total: rows.length };
}

module.exports = {
    computeDossierEtape,
    recomputeAndSaveDossierEtape,
    recomputeAllDossiersEtape,
};
