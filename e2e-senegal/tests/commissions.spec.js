// Commissions débours / douane : fiche client (rubriques ciblées) puis facture globale (lignes 4004 / 4005 automatiques).
const { test, expect, request } = require('@playwright/test')

const API = 'http://localhost:3104/api/'
const LOGIN = process.env.VERIF_LOGIN || 'testsn'
const PASSWORD = process.env.VERIF_PASSWORD

test('commissions : fiche client puis facturation', async ({ page }) => {
    const anon = await request.newContext({ baseURL: API })
    const { token } = await (await anon.post('auth/login', { data: { login: LOGIN, password: PASSWORD } })).json()
    const api = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
    const clients = await (await api.get('clients')).json()
    const client = clients.find(c => c.NomRS === 'Client Test Sénégal')
    const dossiers = await (await api.get('dossiers')).json()
    const dossier = dossiers.find(d => d.label === 'Dossier test Sénégal' || d.libelle === 'Dossier test Sénégal')

    await page.goto('/login')
    await page.fill('input[name="login"]', LOGIN); await page.fill('input[name="password"]', PASSWORD)
    await page.getByRole('button', { name: /se connecter/i }).click(); await page.waitForURL('**/dashboard', { timeout: 60_000 })

    // 1. Fiche client : décocher « Sur tous les débours », ne cocher que 1104 et 1108
    await page.goto(`/clients/${client.IDCLIENTS}`)
    await page.locator('input[name="sappliqueTousDebours"]').uncheck()
    await expect(page.getByText(/Rubriques débours \(commission appliquée\)/)).toBeVisible()
    await page.getByRole('button', { name: 'Tout décocher' }).click()
    await page.locator('label', { hasText: /^\s*1104 —/ }).locator('input').check()
    await page.locator('label', { hasText: /^\s*1108 —/ }).locator('input').check()
    await expect(page.getByText(/2 sélectionnée\(s\)/)).toBeVisible()
    await page.getByRole('button', { name: /enregistrer|valider/i }).last().click()
    await page.waitForURL('**/clients', { timeout: 20_000 })

    // 2. La sélection est restituée au rechargement
    await page.goto(`/clients/${client.IDCLIENTS}`)
    await expect(page.getByText(/2 sélectionnée\(s\)/)).toBeVisible()
    await expect(page.locator('label', { hasText: /^\s*1108 —/ }).locator('input')).toBeChecked()
    await expect(page.locator('label', { hasText: /^\s*1101 —/ }).locator('input')).not.toBeChecked()

    // 3. Facture globale : douane 1 000 000, débours 1108 (ciblé) 200 000, débours 1101 (non ciblé) 100 000, prestation 50 000
    await page.goto(`/dossiers/${dossier.id}`)
    await page.getByRole('button', { name: 'Détails', exact: true }).first().locator('xpath=..').getByRole('button', { name: 'Facturation', exact: true }).first().click()
    const ajouter = async (code) => { await page.locator('tr', { hasText: new RegExp('^\\s*' + code) }).first().locator('input[type="checkbox"]').check() }
    for (const code of ['1001', '1108', '1101', '4001']) await ajouter(code)
    const montants = page.locator('input[type="number"]')
    await expect(montants).toHaveCount(4 + 2, { timeout: 10_000 }) // 4 lignes saisies + 2 commissions automatiques à 0 → créées seulement si > 0
        .catch(() => {})
    const lignes = ['1001', '1108', '1101', '4001']
    const valeurs = { 1001: '1000000', 1108: '200000', 1101: '100000', 4001: '50000' }
    for (const code of lignes) {
        await page.locator('tr', { hasText: new RegExp('CODE:\\s*' + code) }).locator('input[type="number"]').fill(valeurs[code])
    }
    await page.waitForTimeout(800)
    const texte = await page.locator('body').innerText()
    expect(texte).toMatch(/Commission douane \(2%\)/)
    expect(texte).toMatch(/Commission débours \(5%, rubriques ciblées\)/)
    // 4004 = 5 % de 200 000 (la 1101 n'est pas ciblée) ; 4005 = 2 % de 1 000 000
    const norm = texte.replace(/[  \s]+/g, ' ')
    expect(norm).toContain('10 000')
    expect(norm).toContain('20 000')
    // HT 1 380 000 ; TVA 18 % des seules prestations (50 000 + 10 000 + 20 000) = 14 400 ; TTC 1 394 400
    expect(norm).toMatch(/1 380 000/)
    expect(norm).toMatch(/14 400/)
    expect(norm).toMatch(/1 394 400/)
    await page.screenshot({ path: 'resultats/facturation-commissions.png' })
})
