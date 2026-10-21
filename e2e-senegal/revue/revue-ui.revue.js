const { test, request } = require('@playwright/test')
const fs = require('fs'), path = require('path')
const OUT = process.env.REVUE_OUT || path.join(__dirname, 'resultats', 'captures')
const API = 'http://localhost:3104/api/'

test('captures de revue', async ({ page, browser }) => {
    fs.mkdirSync(OUT, { recursive: true })
    const shot = (nom, o = {}) => page.screenshot({ path: path.join(OUT, nom + '.png'), ...o })
    // connexion (déconnecté) et portail
    const anon = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await anon.goto('http://localhost:5176/login'); await anon.waitForTimeout(1500); await anon.screenshot({ path: path.join(OUT, '01-connexion.png') })
    await anon.goto('http://localhost:5176/portail'); await anon.waitForTimeout(1200); await anon.screenshot({ path: path.join(OUT, '02-portail.png') })
    await anon.close()

    const api0 = await request.newContext({ baseURL: API })
    const { token } = await (await api0.post('auth/login', { data: { login: 'testsn', password: process.env.VERIF_PASSWORD } })).json()
    const api = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
    const statut = (await (await api.get('statuts')).json())[0]
    const cf = { NomRS: 'Société Sénégalaise de Négoce', NINEA: '00812345', adresseClient: 'Dakar, Plateau', IDStatuts: String(statut.IDStatuts || statut.id), TelClient: '+221 33 800 00 00', EmailClient: 'contact@ssn.sn', DelaiReglement: '30', DelaiReglementDouane: '15' }
    await api.post('clients', { multipart: cf })
    const clients = await (await api.get('clients')).json()
    const cl = clients[0]
    await api.post('dossiers', { multipart: { label: 'Importation de matériel agricole', nature: 'IMP', mode: 'MA', type: 'TC', description: '', contactId: '', clientId: String(cl.IDCLIENTS), dpiNumber: '', quotationStep: '0', contactName: '', contactPhone: '', contactEmail: '', observations: '' } })
    const dossiers = await (await api.get('dossiers')).json()

    await page.goto('/login')
    await page.fill('input[name="login"]', 'testsn'); await page.fill('input[name="password"]', process.env.VERIF_PASSWORD)
    await page.getByRole('button', { name: /se connecter/i }).click(); await page.waitForURL('**/dashboard', { timeout: 60_000 })
    await page.waitForTimeout(2500)
    await shot('03-dashboard-fenetre')
    for (let i = 0; i < 3; i++) { const x = page.locator('button:has(svg.lucide-x)').first(); if (await x.isVisible().catch(() => false)) { await x.click(); await page.waitForTimeout(400) } }
    await shot('04-dashboard'); await shot('04b-dashboard-complet', { fullPage: true })
    for (const [url, nom] of [['/clients', '05-clients'], ['/clients/new', '06-client-nouveau'], ['/dossiers', '07-dossiers'], [`/dossiers/${dossiers[0].id}`, '08-dossier'],
        ['/produits', '09-produits'], ['/tarifs', '10-tarifs'], ['/devises', '11-devises'], ['/parameters-hub', '12-parametres'], ['/sommiers', '13-sommiers'],
        ['/etats-financiers', '14-etats-financiers'], ['/settings', '19-societe'], ['/statuts', '20-statuts'], ['/groupes', '21-groupes'], ['/transport-arrivals', '22-arrivees'], ['/users', '15-agents'], ['/regimes-declaration', '16-regimes'], ['/suivi-dossiers', '17-suivi-dossiers'], ['/portail-admin', '18-portail-admin']]) {
        await page.goto(url); await page.waitForTimeout(1600); await shot(nom)
    }
    for (const [onglet, nom] of [['Cotation', '30-onglet-cotation'], ['Transports', '31-onglet-transports'], ['Notes de détail', '32-onglet-notes'], ['Devis', '33-onglet-devis'], ['Facturation', '34-onglet-facturation'], ['Règlements', '35-onglet-reglements']]) {
        await page.goto(`/dossiers/${dossiers[0].id}`); await page.waitForTimeout(1500)
        await page.getByRole('button', { name: 'Détails', exact: true }).first().locator('xpath=..').getByRole('button', { name: onglet, exact: true }).first().click()
        await page.waitForTimeout(1800); await shot(nom)
    }
    await page.goto('/sommiers'); await page.waitForTimeout(1200)
    await page.getByRole('button', { name: /nouveau sommier/i }).first().click(); await page.waitForTimeout(1000); await shot('36-modale-sommier')
})
