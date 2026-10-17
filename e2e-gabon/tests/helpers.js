import fs from 'node:fs'
import { request } from '@playwright/test'

export const API = 'http://localhost:3101/api/'
// Suffixe unique par exécution : les données fictives créées ne se télescopent jamais
export const RUN = Date.now().toString(36).toUpperCase()

export function tokenOf(role) {
    const state = JSON.parse(fs.readFileSync(`.auth/${role}.json`, 'utf8'))
    return state.origins.flatMap(o => o.localStorage).find(i => i.name === 'token').value
}

export const apiAs = (role) =>
    request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${tokenOf(role)}` } })

export const apiAnon = () => request.newContext({ baseURL: API })

// Id d'un agent d'après son login (via l'API, en admin)
export async function agentId(login) {
    const admin = await apiAs('admin')
    const users = await (await admin.get('users')).json()
    await admin.dispose()
    return users.find(u => u.login === login)?.id
}

// Le menu flottant est replié par défaut (et se replie à chaque changement de page)
export async function openNav(page) {
    const wrapper = page.locator('.floating-nav-wrapper')
    if (!(await wrapper.evaluate(el => el.classList.contains('expanded')))) {
        await page.locator('.fnav-trigger').click()
    }
}

// ── Création de données fictives par l'interface ─────────────────────────────
export async function createClientUI(page, nom, { statut = 'SARL', tel = '+241 01 00 00 00', email } = {}) {
    await page.goto('/clients/new')
    await page.fill('input[name="NomRS"]', nom)
    await page.fill('input[name="NINEA"]', `E2E-${RUN}`)
    await page.fill('input[name="adresseClient"]', 'Boulevard fictif, Libreville (Gabon)')
    await page.selectOption('select[name="IDStatuts"]', { label: statut })
    await page.fill('input[name="TelClient"]', tel)
    if (email) await page.fill('input[name="EmailClient"]', email)
    await page.fill('input[name="DelaiReglement"]', '30')
    await page.fill('input[name="DelaiReglementDouane"]', '15')
    await page.getByRole('button', { name: /valider le dossier client/i }).click()
    await page.waitForURL('**/clients', { timeout: 15_000 })
}

export async function createDossierUI(page, clientNom, libelle) {
    await page.goto('/dossiers/new')
    await page.getByPlaceholder(/rechercher un client/i).fill(clientNom)
    await page.getByText(clientNom).first().click()
    await page.locator('input[name="label"]').fill(libelle)
    await page.getByRole('button', { name: /valider et créer le dossier/i }).click()
    await page.waitForURL('**/dossiers', { timeout: 15_000 })
}

export async function openDossier(page, libelle) {
    await page.goto('/dossiers')
    await page.getByPlaceholder(/rechercher code, libellé, client/i).fill(libelle)
    await page.getByText(libelle).first().click()
    await page.waitForURL(/\/dossiers\/\d+/)
    return Number(page.url().match(/\/dossiers\/(\d+)/)[1])
}
