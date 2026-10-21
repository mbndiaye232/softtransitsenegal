/**
 * Crée la base PostgreSQL du Sénégal (PG_DATABASE de backend/.env) à partir d'une copie de la base du Gabon,
 * en gardant la structure complète et les référentiels génériques (pays, tiers, moyens de transport, permissions,
 * agents de la structure…), puis en vidant toutes les données métier et les référentiels propres au Gabon.
 * La base source n'est jamais modifiée (pg_dump en lecture seule).
 *
 * Étapes suivantes : python scripts/import-tec-senegal.py (TEC, régimes, rubriques), node scripts/run-migrations-senegal.js.
 *
 * Usage : node scripts/prepare-db-senegal.js [--force]   (--force : supprime la base cible si elle existe)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { spawnSync } = require('child_process');
const { Client } = require('pg');

const SOURCE = process.env.SOURCE_DATABASE || 'softtransit_gabon';
const TARGET = process.env.PG_DATABASE;
if (!TARGET || TARGET === SOURCE) {
    console.error(`PG_DATABASE doit être défini et différent de la base source (${SOURCE}).`);
    process.exit(1);
}
const conn = { host: process.env.PG_HOST || 'localhost', port: process.env.PG_PORT || 5433, user: process.env.PG_USER, password: process.env.PG_PASSWORD };
const cli = ['-h', String(conn.host), '-p', String(conn.port), '-U', conn.user];
const run = (cmd, args, input) => {
    const r = spawnSync(cmd, args, { input, env: { ...process.env, PGPASSWORD: conn.password }, maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`${cmd} a échoué : ${r.stderr.toString('latin1')}`);
    return r.stdout;
};

(async () => {
    const admin = new Client({ ...conn, database: 'postgres' });
    await admin.connect();
    const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TARGET])).rowCount > 0;
    if (exists && !process.argv.includes('--force')) {
        console.error(`La base ${TARGET} existe déjà (utiliser --force pour la recréer).`);
        process.exit(1);
    }
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [TARGET]);
    await admin.query(`DROP DATABASE IF EXISTS ${TARGET}`);
    await admin.query(`CREATE DATABASE ${TARGET} ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'French_France.1252' LC_CTYPE 'French_France.1252'`);
    await admin.end();
    run('psql', [...cli, '-d', TARGET, '-q', '-v', 'ON_ERROR_STOP=1'], run('pg_dump', [...cli, '-d', SOURCE, '--no-owner', '--no-privileges', '-E', 'UTF8']));

    const db = new Client({ ...conn, database: TARGET });
    await db.connect();

    // 1. Données métier : tout est vidé (les agents, permissions et référentiels génériques sont conservés)
    await db.query(`TRUNCATE TABLE
        audit_logs, billoflading, clients, comptesclients, comptesmails, conteneurbl, contenuconteneurordretrbordereauliv,
        contenusconteneurs, cotations, declarations, documents, dossier_cotations, dossiers, entrepot, facturesrecues,
        liaisoncotationsrubriques, liaisonotdocumentsaremettre, liaisonregimeot, liaisontiersdomainesactivites, miseenlivraison,
        mouvementscomptesclients, notesdedetails, ordresdetransport, ordrestransit, sommier, sommier_article, transports,
        apurement, apurement_ligne, articles, billoflandingmaya, booking, bordereauxdelivraisons, chargementcamion, detailfactures,
        detentions, elementspiecescaisses, enlevement, factures, facturesfournisseursclients, fichesynthetiquedossier, groupage,
        journal, liaisondossiersdeclarants, liaisonfacturejustificatifs, liaisonfacturesrubriques, liaisonltaproduits,
        liaisonlviproduits, liaisonrubriquesfacturesrecues, liquidations_articles, liquidationsarticles, livraisons, operations,
        piecescaisses, reglements, relances, rubriquesdescommissions, sauvegardesbddocs, sommier_alert_log
        RESTART IDENTITY CASCADE`);

    // 2. Référentiels propres au Gabon : lieux du Gabon (les autres lieux du monde et ceux du Sénégal sont conservés)
    const gabon = (await db.query(`SELECT idpays FROM pays WHERE nompays ILIKE 'Gabon'`)).rows.map(r => r.idpays);
    if (gabon.length) await db.query('DELETE FROM lieux WHERE idpays = ANY($1)', [gabon]);

    // 3. Devise de référence : franc CFA (F CFA) ; les taux des autres devises sont ceux de la base du Gabon (parité XAF = XOF)
    await db.query(`UPDATE devises SET symbole = 'F CFA' WHERE est_reference`);

    // 4. Structure : conserve la fiche Soft Services Technologiques, sans cachets ni logo propres au Gabon
    await db.query(`UPDATE structur SET logosociete = NULL, cheminlogo = NULL, cachetfacture = NULL, chemin_cachet_facture = NULL,
        cachetlivraison = NULL, chemin_cachet_livraison = NULL, autrecachet = NULL, chemin_cachet_autre = NULL`);

    await db.end();
    console.log(`Base ${TARGET} prête (copie de structure de ${SOURCE}, données métier vidées).`);
})().catch(e => { console.error(e); process.exit(1); });
