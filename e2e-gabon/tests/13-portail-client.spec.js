import { test, expect, request } from '@playwright/test'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { RUN, apiAs, apiAnon, createClientUI, createDossierUI, sql } from './helpers'

// Portail client : isolation entre clients, validation des inscriptions, types de documents masqués.
// Le serveur de test est lancé avec PORTAIL_CLIENT_ENABLED=true (playwright.config.js) ; données fictives uniquement.
test.use({ storageState: '.auth/admin.json' })

const CLIENT_A = `E2E Portail Client A ${RUN}`
const CLIENT_B = `E2E Portail Client B ${RUN}`
const DOSSIER_A = `E2E Portail dossier A ${RUN}`
const DOSSIER_B = `E2E Portail dossier B ${RUN}`
const MAIL_A = `a.${RUN.toLowerCase()}@portail-e2e.test`
const MAIL_B = `b.${RUN.toLowerCase()}@portail-e2e.test`
const MDP = 'Portail-E2E-2026'
const CONTENU = `contenu confidentiel du client ${RUN}`

const portail = async (token) => request.newContext({
    baseURL: 'http://localhost:3101/api/portail/', extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
})

async function connecter(email, password = MDP) {
    const api = await portail()
    const r = await api.post('auth/login', { data: { email, password } })
    const corps = await r.json().catch(() => ({}))
    await api.dispose()
    return { status: r.status(), ...corps }
}

// Confirmation d'adresse : le jeton n'est stocké que haché, le test en pose donc un connu en base puis utilise l'API
async function confirmerEmail(email, jeton = `jeton-verif-${RUN}-${email}`, password = MDP) {
    await sql(`UPDATE client_users SET verify_token_hash = $1, verify_expires = NOW() + interval '10 minutes' WHERE lower(email) = $2`,
        [crypto.createHash('sha256').update(jeton).digest('hex'), email.toLowerCase()])
    const api = await portail()
    const r = await api.post('auth/verify-email', { data: { token: jeton, password } })
    await api.dispose()
    return r.status()
}

const ids = {}
let tokenA

test.describe.serial('Portail client', () => {
    test('préparation : deux clients, leurs dossiers, documents et factures fictifs', async ({ page }) => {
        await createClientUI(page, CLIENT_A, { email: MAIL_A })
        await createClientUI(page, CLIENT_B, { email: MAIL_B })
        await createDossierUI(page, CLIENT_A, DOSSIER_A)
        await createDossierUI(page, CLIENT_B, DOSSIER_B)

        ids.clientA = (await sql('SELECT idclients FROM clients WHERE nomrs = $1', [CLIENT_A]))[0].idclients
        ids.clientB = (await sql('SELECT idclients FROM clients WHERE nomrs = $1', [CLIENT_B]))[0].idclients
        ids.dossierA = (await sql('SELECT iddossiers FROM dossiers WHERE libelle = $1', [DOSSIER_A]))[0].iddossiers
        ids.dossierB = (await sql('SELECT iddossiers FROM dossiers WHERE libelle = $1', [DOSSIER_B]))[0].iddossiers

        // Types de documents : « Rapports » sera masqué, « Facture » reste visible
        const admin = await apiAs('admin')
        const types = await (await admin.get('/api/portail-admin/types-documents')).json()
        ids.typeRapports = types.find(t => t.libelle === 'Rapports').id
        ids.typeFacture = types.find(t => t.libelle === 'Facture').id

        const televerser = async (dossier, titre, typeId) => {
            const r = await admin.post('documents', {
                multipart: { dossierId: String(dossier), title: titre, description: 'e2e', number: RUN, typeId: String(typeId),
                    document: { name: `${titre}.txt`, mimeType: 'text/plain', buffer: Buffer.from(CONTENU) } },
            })
            expect(r.status(), await r.text()).toBe(201)
            return (await r.json()).id
        }
        ids.docA = await televerser(ids.dossierA, `E2E Bordereau A ${RUN}`, ids.typeFacture)
        ids.docARapport = await televerser(ids.dossierA, `E2E Rapport A ${RUN}`, ids.typeRapports)
        ids.docB = await televerser(ids.dossierB, `E2E Bordereau B ${RUN}`, ids.typeFacture)
        await admin.dispose()

        // Factures : une validée et une brouillon pour A, une validée pour B
        const facture = async (dossier, numero, valide, ttc, regle) => (await sql(
            `INSERT INTO factures (structur_id, iddossiers, numerofacture, datefacture, dateecheance, montanthtfacture, montanttvafacture,
                                   montantttcfacture, montantreglefacture, reliquatfacture, validee, idagents)
             VALUES (1, $1, $2, CURRENT_DATE, CURRENT_DATE + 30, $3::numeric, 0, $3::numeric, $4::numeric, $3::numeric - $4::numeric, $5::int, (SELECT MIN(idagents) FROM agents)) RETURNING idfactures`,
            [dossier, numero, ttc, regle, valide]))[0].idfactures
        ids.factureA = await facture(ids.dossierA, `E2E-FA-${RUN}`, 1, 570000, 300000)
        ids.factureABrouillon = await facture(ids.dossierA, `E2E-FA-BROUILLON-${RUN}`, 0, 111000, 0)
        ids.factureB = await facture(ids.dossierB, `E2E-FB-${RUN}`, 1, 999000, 0)

        // Transport : un navire pour chaque dossier (le lien se fait par transports.idbl)
        const transport = (dossier, navire, titre, escale, observation) => sql(
            `INSERT INTO transports (datedepart, idlieudepart, idlieuarrive, idagent, idmoyenstransport, numerotitretransport, libelletransport,
                                     observations, datearriveeprevue, heurearriveeprevue, numeroescale, idbl)
             VALUES ('2026-09-28', (SELECT MIN(idlieux) FROM lieux), (SELECT MAX(idlieux) FROM lieux), (SELECT MIN(idagents) FROM agents),
                     (SELECT MIN(idmoyenstransport) FROM moyenstransport), $1, $2, $3, '2026-10-24', '08:00', $4, $5)`,
            [titre, navire, observation, escale, dossier])
        await transport(ids.dossierA, `NAVIRE-A-${RUN}`, `BL-A-${RUN}`, `ESC-A-${RUN}`, 'note interne A confidentielle')
        await transport(ids.dossierB, `NAVIRE-B-${RUN}`, `BL-B-${RUN}`, `ESC-B-${RUN}`, 'note interne B')
        ids.lieuDepart = (await sql('SELECT nomlieu FROM lieux WHERE idlieux = (SELECT MIN(idlieux) FROM lieux)'))[0].nomlieu
        ids.lieuArrivee = (await sql('SELECT nomlieu FROM lieux WHERE idlieux = (SELECT MAX(idlieux) FROM lieux)'))[0].nomlieu
    })

    test('inscription : champs contrôlés, doublon sans fuite, connexion refusée avant validation', async () => {
        const api = await portail()
        const base = { nom: 'Marie Cliente', societe: CLIENT_A, telephone: '+241 01 02 03 04' }
        expect((await api.post('auth/register', { data: { ...base, email: 'pas-un-mail' } })).status()).toBe(400)
        expect((await api.post('auth/register', { data: { ...base, nom: '', email: MAIL_A } })).status()).toBe(400)
        expect((await api.post('auth/register', { data: { ...base, email: MAIL_A } })).status()).toBe(201)
        // même adresse : même réponse, aucun doublon créé
        expect((await api.post('auth/register', { data: { ...base, email: MAIL_A.toUpperCase() } })).status()).toBe(201)
        expect((await api.post('auth/register', { data: { ...base, nom: 'Paul Client', societe: CLIENT_B, email: MAIL_B } })).status()).toBe(201)
        await api.dispose()
        expect(await sql('SELECT id FROM client_users WHERE lower(email) = $1', [MAIL_A])).toHaveLength(1)

        // aucun mot de passe n'existe tant que le titulaire de l'adresse n'a pas cliqué sur le lien : connexion impossible
        const compte = (await sql('SELECT password_hash FROM client_users WHERE lower(email) = $1', [MAIL_A]))[0]
        expect(compte.password_hash).toBeNull()
        for (const mdp of [MDP, 'Mauvais-mdp-1']) expect((await connecter(MAIL_A, mdp)).status).toBe(401)
    })

    test('un imposteur ne peut ni imposer un mot de passe ni occuper l\'adresse d\'autrui', async () => {
        const api = await portail()
        // l'imposteur saisit l'adresse de A et tente de fournir son propre mot de passe : il est ignoré
        const imposteur = await api.post('auth/register', { data: { nom: 'Imposteur', societe: CLIENT_A, email: MAIL_A, password: 'Imposteur-Mdp-2026' } })
        expect(imposteur.status()).toBe(201)
        expect((await sql('SELECT password_hash FROM client_users WHERE lower(email) = $1', [MAIL_A]))[0].password_hash).toBeNull()
        expect((await connecter(MAIL_A, 'Imposteur-Mdp-2026')).status).toBe(401)
        // la dernière demande non confirmée remplace la précédente : l'adresse n'est pas « prise » par l'imposteur
        expect((await api.post('auth/register', { data: { nom: 'Marie Cliente', societe: CLIENT_A, email: MAIL_A } })).status()).toBe(201)
        await api.dispose()
        expect((await sql('SELECT nom FROM client_users WHERE lower(email) = $1', [MAIL_A]))[0].nom).toBe('Marie Cliente')
        expect(await sql('SELECT id FROM client_users WHERE lower(email) = $1', [MAIL_A])).toHaveLength(1)
        // le mot de passe doit respecter les règles, et un mot de passe refusé ne consomme pas le lien
        expect(await confirmerEmail(MAIL_A, 'essai-faible', 'faible')).toBe(400)
        expect((await sql('SELECT email_verified_at FROM client_users WHERE lower(email) = $1', [MAIL_A]))[0].email_verified_at).toBeNull()
    })

    test('administration réservée aux administrateurs ; validation par l\'équipe', async () => {
        const user = await apiAs('user')
        expect([401, 403]).toContain((await user.get('/api/portail-admin/comptes')).status())
        await user.dispose()
        expect((await (await apiAnon()).get('/api/portail-admin/comptes')).status()).toBe(401)

        const admin = await apiAs('admin')
        const comptes = await (await admin.get('/api/portail-admin/comptes?statut=EN_ATTENTE')).json()
        let a = comptes.find(c => c.email === MAIL_A)
        const b = comptes.find(c => c.email === MAIL_B)
        expect(a, 'demande de A visible').toBeTruthy()
        ids.userA = a.id; ids.userB = b.id

        // adresse non confirmée : aucune suggestion, validation refusée
        expect(a.email_confirme).toBe(false)
        expect(a.client_suggere).toBeNull()
        const refus = await admin.post(`/api/portail-admin/comptes/${a.id}/valider`, { data: { idclients: Number(ids.clientA) } })
        expect(refus.status()).toBe(400)
        expect((await refus.json()).error).toMatch(/pas confirmée/)
        expect((await connecter(MAIL_A)).status).toBe(401)
        expect((await admin.post(`/api/portail-admin/comptes/${a.id}/renvoyer-confirmation`)).status()).toBe(200)

        // confirmation par le titulaire de l'adresse : mauvais lien refusé, bon lien accepté une seule fois
        expect(await confirmerEmail(MAIL_A, 'x')).toBe(200)
        expect((await (await apiAnon()).post('/api/portail/auth/verify-email', { data: { token: 'jeton-inconnu', password: MDP } })).status()).toBe(400)
        expect(await confirmerEmail(MAIL_A, 'x')).toBe(400) // déjà confirmée
        expect(await confirmerEmail(MAIL_B)).toBe(200)
        expect((await admin.post(`/api/portail-admin/comptes/${a.id}/renvoyer-confirmation`)).status()).toBe(404)
        expect((await connecter(MAIL_A)).code).toBe('EN_ATTENTE')

        a = (await (await admin.get('/api/portail-admin/comptes?statut=EN_ATTENTE')).json()).find(c => c.email === MAIL_A)
        expect(a.email_confirme).toBe(true)
        expect(a.client_suggere, 'client suggéré d\'après l\'e-mail confirmé').toBe(CLIENT_A)

        expect((await admin.post(`/api/portail-admin/comptes/${a.id}/valider`, { data: {} })).status()).toBe(400)
        expect((await admin.post(`/api/portail-admin/comptes/${a.id}/valider`, { data: { idclients: 999999999 } })).status()).toBe(400)
        expect((await admin.post(`/api/portail-admin/comptes/${a.id}/valider`, { data: { idclients: Number(ids.clientA) } })).status()).toBe(200)
        expect((await admin.post(`/api/portail-admin/comptes/${b.id}/valider`, { data: { idclients: Number(ids.clientB) } })).status()).toBe(200)
        await admin.dispose()
    })

    test('séparation des jetons : personnel et clients', async () => {
        const connexion = await connecter(MAIL_A)
        expect(connexion.status).toBe(200)
        tokenA = connexion.token

        // jeton du portail refusé par l'API du personnel
        const staff = await request.newContext({ baseURL: 'http://localhost:3101/api/', extraHTTPHeaders: { Authorization: `Bearer ${tokenA}` } })
        for (const route of ['dossiers', 'clients', 'documents/dossier/1', 'factures/1']) {
            expect((await staff.get(route)).status(), route).toBe(401)
        }
        await staff.dispose()

        // jeton du personnel refusé par le portail
        const adminToken = JSON.parse(fs.readFileSync('.auth/admin.json', 'utf8')).origins.flatMap(o => o.localStorage).find(i => i.name === 'token').value
        const p = await portail(adminToken)
        expect((await p.get('dossiers')).status()).toBe(401)
        await p.dispose()
        // sans jeton
        const anonyme = await portail()
        expect((await anonyme.get('dossiers')).status()).toBe(401)
        await anonyme.dispose()
    })

    test('isolation : le client A ne voit et ne télécharge que ses propres données', async () => {
        const p = await portail(tokenA)

        const liste = await (await p.get('dossiers')).json()
        expect(liste.map(d => d.libelle)).toContain(DOSSIER_A)
        expect(liste.map(d => d.libelle)).not.toContain(DOSSIER_B)
        expect(liste.every(d => String(d.id) !== String(ids.dossierB))).toBe(true)

        const detail = await (await p.get(`dossiers/${ids.dossierA}`)).json()
        expect(detail.libelle).toBe(DOSSIER_A)
        // le détail ne contient aucune donnée interne (observations, agents, notes…)
        expect(Object.keys(detail).sort()).toEqual(['code', 'date_ouverture', 'documents', 'etape', 'etape_id', 'etapes', 'factures', 'id', 'libelle', 'mode', 'nature', 'totaux', 'transport', 'type'].sort())

        // arrivée du navire : seulement celle de son dossier, sans note interne ni agent
        expect(Object.keys(detail.transport).sort()).toEqual(['arrivee_prevue', 'compagnie', 'date_depart', 'escale', 'heure_arrivee', 'lieu_arrivee',
            'lieu_depart', 'moyen', 'pays_arrivee', 'pays_depart', 'titre'].sort())
        expect(detail.transport.titre).toBe(`BL-A-${RUN}`)
        expect(detail.transport.escale).toBe(`ESC-A-${RUN}`)
        expect(detail.transport.lieu_depart).toBe(ids.lieuDepart)
        expect(detail.transport.lieu_arrivee).toBe(ids.lieuArrivee)
        expect(String(detail.transport.arrivee_prevue)).toContain('2026-10-24')
        expect(String(detail.transport.heure_arrivee)).toContain('08:00')
        expect(JSON.stringify(detail)).not.toContain('confidentielle')
        expect(JSON.stringify(detail)).not.toContain(`-B-${RUN}`)
        expect(String(liste.find(d => d.libelle === DOSSIER_A).arrivee_prevue)).toContain('2026-10-24')

        // dossier, documents et facture de B : 404, comme s'ils n'existaient pas
        expect((await p.get(`dossiers/${ids.dossierB}`)).status()).toBe(404)
        expect((await p.get(`dossiers/${ids.dossierB}/documents.zip`)).status()).toBe(404)
        expect((await p.get(`documents/${ids.docB}/download`)).status()).toBe(404)
        expect((await p.get(`factures/${ids.factureB}/pdf`)).status()).toBe(404)
        // identifiants invalides
        for (const route of ['dossiers/abc', 'dossiers/-1', 'documents/0/download', 'factures/9999999999/pdf']) {
            expect([400, 404, 500]).toContain((await p.get(route)).status())
            expect((await p.get(route)).status(), route).not.toBe(200)
        }

        // factures : seulement les validées de A
        const { factures, totaux } = await (await p.get('factures')).json()
        expect(factures.map(f => f.numero)).toEqual([`E2E-FA-${RUN}`])
        expect(Number(totaux.facture)).toBe(570000)
        expect(Number(totaux.regle)).toBe(300000)
        expect(Number(totaux.reliquat)).toBe(270000)
        expect((await p.get(`factures/${ids.factureABrouillon}/pdf`)).status()).toBe(404)
        const resume = await (await p.get('resume')).json()
        expect(Number(resume.factures)).toBe(1)

        const pdf = await p.get(`factures/${ids.factureA}/pdf`)
        expect(pdf.status(), await pdf.text().catch(() => '')).toBe(200)
        expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')

        // téléchargement : le contenu est déchiffré et identique à l'original
        const dl = await p.get(`documents/${ids.docA}/download`)
        expect(dl.status()).toBe(200)
        expect((await dl.body()).toString()).toBe(CONTENU)
        expect(dl.headers()['content-disposition']).toContain('attachment')
        await p.dispose()
    })

    test('types de documents masqués par l\'équipe : absents de la liste, du téléchargement et du zip', async () => {
        const admin = await apiAs('admin')
        const p = await portail(tokenA)

        // par défaut : tout est visible
        let docs = (await (await p.get(`dossiers/${ids.dossierA}`)).json()).documents
        expect(docs).toHaveLength(2)
        expect((await p.get(`documents/${ids.docARapport}/download`)).status()).toBe(200)

        expect((await admin.put(`/api/portail-admin/types-documents/${ids.typeRapports}`, { data: { visible: false } })).status()).toBe(200)
        docs = (await (await p.get(`dossiers/${ids.dossierA}`)).json()).documents
        expect(docs.map(d => d.id.toString())).toEqual([String(ids.docA)])
        expect((await p.get(`documents/${ids.docARapport}/download`)).status()).toBe(404)
        const zip = await p.get(`dossiers/${ids.dossierA}/documents.zip`)
        expect(zip.status()).toBe(200)
        expect(zip.headers()['content-type']).toContain('zip')
        const octets = await zip.body()
        expect(octets.subarray(0, 2).toString()).toBe('PK')
        expect(octets.includes(Buffer.from(`Rapport A ${RUN}`))).toBe(false)
        expect(octets.includes(Buffer.from(`Bordereau A ${RUN}`))).toBe(true)
        const liste = await (await p.get('dossiers')).json()
        expect(Number(liste.find(d => d.libelle === DOSSIER_A).nb_documents)).toBe(1)

        // remis visible
        expect((await admin.put(`/api/portail-admin/types-documents/${ids.typeRapports}`, { data: { visible: true } })).status()).toBe(200)
        expect((await p.get(`documents/${ids.docARapport}/download`)).status()).toBe(200)
        await p.dispose(); await admin.dispose()
    })

    test('suspension, réactivation, journal des téléchargements et mot de passe oublié', async () => {
        const admin = await apiAs('admin')
        const p = await portail(tokenA)

        expect((await admin.post(`/api/portail-admin/comptes/${ids.userA}/suspendre`)).status()).toBe(200)
        expect((await p.get('dossiers')).status(), 'jeton existant refusé dès la suspension').toBe(401)
        expect((await connecter(MAIL_A)).status).toBe(403)
        expect((await admin.post(`/api/portail-admin/comptes/${ids.userA}/valider`, { data: { idclients: Number(ids.clientA) } })).status()).toBe(200)
        const retour = await connecter(MAIL_A)
        expect(retour.status).toBe(200)
        tokenA = retour.token

        const journal = await (await admin.get('/api/portail-admin/journal')).json()
        const actions = journal.filter(j => j.email === MAIL_A).map(j => j.action)
        expect(actions).toEqual(expect.arrayContaining(['CONNEXION', 'TELECHARGE_DOCUMENT', 'TELECHARGE_ZIP']))

        // mot de passe oublié : réponse identique pour une adresse inconnue
        const anonyme = await portail()
        const inconnu = await (await anonyme.post('auth/forgot-password', { data: { email: `inconnu.${RUN}@portail-e2e.test` } })).json()
        const connu = await (await anonyme.post('auth/forgot-password', { data: { email: MAIL_A } })).json()
        expect(inconnu.message).toBe(connu.message)
        // réinitialisation avec un jeton (le jeton n'est stocké que haché) 
        await sql('UPDATE client_users SET reset_token_hash = $1, reset_expires = NOW() + interval \'10 minutes\' WHERE id = $2',
            [crypto.createHash('sha256').update(`jeton-e2e-${RUN}`).digest('hex'), ids.userA])
        expect((await anonyme.post('auth/reset-password', { data: { token: 'mauvais', newPassword: 'Nouveau-Mdp-2026' } })).status()).toBe(400)
        expect((await anonyme.post('auth/reset-password', { data: { token: `jeton-e2e-${RUN}`, newPassword: 'Nouveau-Mdp-2026' } })).status()).toBe(200)
        expect((await anonyme.post('auth/reset-password', { data: { token: `jeton-e2e-${RUN}`, newPassword: 'Autre-Mdp-2026' } })).status(), 'jeton à usage unique').toBe(400)
        await anonyme.dispose()
        expect((await connecter(MAIL_A, MDP)).status).toBe(401)
        expect((await connecter(MAIL_A, 'Nouveau-Mdp-2026')).status).toBe(200)
        await p.dispose(); await admin.dispose()
    })

    test('nettoyage : documents fictifs supprimés', async () => {
        const admin = await apiAs('admin')
        for (const id of [ids.docA, ids.docARapport, ids.docB]) await admin.delete(`documents/${id}`)
        await admin.dispose()
    })
})
