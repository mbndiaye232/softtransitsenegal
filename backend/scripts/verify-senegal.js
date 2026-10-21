/**
 * Vérification de bout en bout (API) de la base du Sénégal : TEC chargé, calcul des droits et taxes avec niveaux et
 * compléments (TVA niveau 3, TI niveau 2…), persistance des commissions du client (rubriques de débours ciblées).
 *
 * Prérequis : serveur démarré sur une base de TEST (jamais sur la base de développement), avec un agent SUPER_ADMIN.
 *   PG_DATABASE=softtransit_senegal_test PORT=3104 node server.js
 * Usage : VERIF_URL=http://localhost:3104/api VERIF_LOGIN=testsn VERIF_PASSWORD=... node scripts/verify-senegal.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const API = (process.env.VERIF_URL || 'http://localhost:3104/api').replace(/\/$/, '');
const DB = process.env.VERIF_DATABASE || 'softtransit_senegal_test';
if (!/test/.test(DB)) { console.error('La vérification ne doit tourner que sur une base de test.'); process.exit(1); }

let echecs = 0;
const ok = (cond, msg, detail = '') => { console.log(`${cond ? 'OK   ' : 'ECHEC'} ${msg}${cond ? '' : ' ' + detail}`); if (!cond) echecs++; };

(async () => {
    const db = new Client({ host: process.env.PG_HOST, port: process.env.PG_PORT, user: process.env.PG_USER, password: process.env.PG_PASSWORD, database: DB });
    await db.connect();

    const login = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: process.env.VERIF_LOGIN, password: process.env.VERIF_PASSWORD }) })).json();
    const H = { Authorization: `Bearer ${login.token}` };
    const get = async (u) => (await fetch(`${API}/${u}`, { headers: H })).json();
    const send = async (m, u, body, form) => {
        const r = await fetch(`${API}/${u}`, { method: m, headers: form ? H : { ...H, 'Content-Type': 'application/json' }, body: form || JSON.stringify(body) });
        const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch { /* corps non JSON */ }
        return { status: r.status, body: j, text: t };
    };

    // 1. Référentiels chargés
    const regimes = await get('regimes');
    ok(Array.isArray(regimes) && regimes.length === 264, 'API /regimes : 264 régimes', `reçu ${regimes.length}`);
    const nbTarifs = (await db.query('SELECT count(*) n FROM tarifs')).rows[0].n;
    ok(Number(nbTarifs) === 50281, 'tarifs : 50 281 lignes', nbTarifs);
    const niv = (await db.query("SELECT codetaxe, niveau FROM taxes WHERE codetaxe IN ('05','53','34','50','01') ORDER BY 1")).rows.map(r => `${r.codetaxe}:${r.niveau}`).join(' ');
    ok(niv === '01:1 05:3 34:2 50:2 53:2', 'niveaux des taxes (DD 1, TI/TCI/cosmétiques 2, TVA 3)', niv);

    // 2. Client avec commissions et rubriques de débours ciblées
    const statut = (await db.query('SELECT idstatuts FROM statuts ORDER BY 1 LIMIT 1')).rows[0].idstatuts;
    const rubs = (await db.query("SELECT idrubriques, coderubrique FROM rubriques WHERE coderubrique IN ('1104','1108','1101') ORDER BY 2")).rows;
    const cible = rubs.filter(r => ['1104', '1108'].includes(r.coderubrique)).map(r => Number(r.idrubriques));
    const form = new FormData();
    Object.entries({ NomRS: 'Client Test Sénégal', NINEA: '00000000', adresseClient: 'Dakar (test)', IDStatuts: String(statut), TelClient: '+221 33 000 00 00',
        EmailClient: 'client@test.sn', DelaiReglement: '30', DelaiReglementDouane: '15', TauxCommissionDebours: '5', TauxCommissionDDouane: '2',
        sappliqueTousDebours: 'false', commissionRubriques: JSON.stringify(cible) }).forEach(([k, v]) => form.append(k, v));
    const cr = await send('POST', 'clients', null, form);
    ok(cr.status === 201 || cr.status === 200, 'création du client avec commissions', cr.text.slice(0, 160));
    const clientId = cr.body.id || cr.body.clientId || cr.body.IDCLIENTS || (await db.query("SELECT idclients FROM clients WHERE nomrs='Client Test Sénégal'")).rows[0].idclients;
    const c1 = await get(`clients/${clientId}`);
    ok(JSON.stringify([...(c1.commissionRubriques || [])].sort()) === JSON.stringify([...cible].sort()),
        'GET client : rubriques de commission débours ciblées restituées', JSON.stringify(c1.commissionRubriques));
    ok(String(c1.TauxCommissionDebours) === '5' && String(c1.TauxCommissionDDouane) === '2', 'taux de commission conservés', `${c1.TauxCommissionDebours}/${c1.TauxCommissionDDouane}`);
    const f2 = new FormData();
    Object.entries({ NomRS: 'Client Test Sénégal', NINEA: '00000000', IDStatuts: String(statut), TauxCommissionDebours: '5', TauxCommissionDDouane: '2',
        sappliqueTousDebours: 'true', commissionRubriques: '[]' }).forEach(([k, v]) => f2.append(k, v));
    const up = await send('PUT', `clients/${clientId}`, null, f2);
    const c2 = await get(`clients/${clientId}`);
    ok(up.status === 200 && (c2.commissionRubriques || []).length === 0, '« Sur tous les débours » : la sélection est vidée', up.text.slice(0, 160));

    // 3. Dossier, note de détail, article et calcul des taxes (NTS ayant DD, TI et TVA)
    const nts = (await db.query(`SELECT t.nts FROM tarifs t WHERE t.codetaxe = '05' AND t.nts IN (SELECT nts FROM tarifs WHERE codetaxe = '53')
        AND t.nts IN (SELECT nts FROM tarifs WHERE codetaxe = '01') ORDER BY t.nts LIMIT 1`)).rows[0].nts;
    const df = new FormData();
    Object.entries({ label: 'Dossier test Sénégal', nature: 'IMP', mode: 'MA', type: 'TC', description: '', contactId: '', clientId: String(clientId),
        dpiNumber: '', quotationStep: '0', contactName: '', contactPhone: '', contactEmail: '', observations: '' }).forEach(([k, v]) => df.append(k, v));
    const dr = await send('POST', 'dossiers', null, df);
    const dossierId = dr.body.id;
    ok(!!dossierId, 'création du dossier', dr.text.slice(0, 160));
    const note = await send('POST', 'notes', { IDDossiers: dossierId, NINEA: '00000000', Provenance: 'FR' });
    const noteId = note.body.id || note.body.IDNotesDeDetails;
    ok(!!noteId, 'création de la note de détail', note.text.slice(0, 160));
    const art = await send('POST', `notes/${noteId}/articles`, { NumeroArticle: 1, NTS: nts, Libelle: 'Article test', FOB: 10000000, Fret: 1000000, Assurances: 100000,
        BRUT: 1000, NET: 900, NBCOLIS: 1, CodeRegimeDeclaration: 'C300', Origine: 'FR', Provenance: 'FR', IDDEVISEFOB: 1, IDDEVISEFRET: 1, IDDEVISEASS: 1 });
    const articleId = art.body.id;
    ok(!!articleId, `création de l'article (NTS ${nts})`, art.text.slice(0, 160));
    const calc = await send('POST', `notes/articles/${articleId}/calculate-taxes`, {});
    ok(calc.status === 200, 'calcul des taxes', calc.text.slice(0, 160));

    // Calcul attendu : DD = CAF x taux ; RS, taxes additionnelles… sur CAF ; TI = (CAF + DD + RS) x taux ; TVA = (CAF + DD + RS + TAD + cosmétiques + TI) x taux
    const CAF = 11100000;
    const taux = Object.fromEntries((await db.query(`SELECT t.codetaxe, x.taux FROM tarifs t JOIN taux x ON x.idtaux = t.idtaux WHERE t.nts = $1`, [nts])).rows.map(r => [r.codetaxe, Number(r.taux)]));
    const montant = {};
    const arr = (c) => Math.round(c);
    const niveaux = (await db.query('SELECT codetaxe, niveau, base FROM taxes ORDER BY niveau, idtaxes')).rows;
    const comps = (await db.query('SELECT codetaxeprincipal p, codetaxecomplement c FROM taxes_complements')).rows;
    for (const t of niveaux) {
        if (!(t.codetaxe in taux) || String(t.base).toUpperCase() !== 'V') continue;
        let base = CAF;
        if (t.niveau > 1) comps.filter(x => x.p === t.codetaxe).forEach(x => { base += montant[x.c] || 0; });
        montant[t.codetaxe] = arr(base * taux[t.codetaxe] / 100);
    }
    const liq = (await db.query('SELECT codetaxe, montant FROM liquidations_articles WHERE idarticles = $1', [articleId])).rows;
    const obtenu = Object.fromEntries(liq.map(r => [r.codetaxe, Number(r.montant)]));
    for (const code of Object.keys(montant)) {
        ok(montant[code] === (obtenu[code] ?? 0), `taxe ${code} : attendu ${montant[code]}`, `obtenu ${obtenu[code]}`);
    }
    ok(montant['05'] > Math.round(CAF * taux['05'] / 100), 'TVA calculée sur CAF + DD + autres taxes (et non sur la seule CAF)', `${montant['05']}`);

    // Nettoyage des données de test
    await db.query('DELETE FROM liquidations_articles WHERE idarticles = $1', [articleId]);
    console.log(echecs === 0 ? '\nTOUT EST OK' : `\n${echecs} ÉCHEC(S)`);
    await db.end();
    process.exit(echecs === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
