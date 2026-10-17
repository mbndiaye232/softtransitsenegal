import { test, expect } from '@playwright/test'
import { RUN, apiAs, createClientUI } from './helpers'

test.use({ storageState: '.auth/admin.json' })

const NOM = `E2E Société Gabonaise ${RUN}`

test.describe.serial('Clients (données fictives)', () => {
    test('le formulaire refuse un client sans nom', async ({ page }) => {
        await page.goto('/clients/new')
        await page.getByRole('button', { name: /valider le dossier client/i }).click()
        await expect(page).toHaveURL(/\/clients\/new/)
    })

    test('création d\'un client fictif et recherche dans la liste', async ({ page }) => {
        await createClientUI(page, NOM, { email: `contact-${RUN.toLowerCase()}@e2e.test` })
        await page.getByPlaceholder(/rechercher par nom/i).fill(NOM)
        await expect(page.getByText(NOM).first()).toBeVisible()
        await page.getByPlaceholder(/rechercher par nom/i).fill('zzz-client-inexistant')
        await expect(page.getByText(NOM)).toHaveCount(0)
    })

    test('modification du téléphone d\'un client', async ({ page }) => {
        const api = await apiAs('admin')
        const clients = await (await api.get('clients')).json()
        const client = clients.find(c => c.NomRS === NOM)
        expect(client, 'client créé introuvable').toBeTruthy()
        await api.dispose()

        await page.goto(`/clients/${client.IDCLIENTS}`)
        const tel = page.locator('input[name="TelClient"]')
        await expect(tel).toHaveValue('+241 01 00 00 00')
        await tel.fill('+241 07 11 22 33')
        await page.getByRole('button', { name: /valider le dossier client|enregistrer|mettre à jour/i }).first().click()
        await page.waitForURL('**/clients')

        await page.goto(`/clients/${client.IDCLIENTS}`)
        await expect(page.locator('input[name="TelClient"]')).toHaveValue('+241 07 11 22 33')
    })

    test('suppression du client fictif (avec confirmation)', async ({ page }) => {
        page.on('dialog', d => d.accept())
        await page.goto('/clients')
        await page.getByPlaceholder(/rechercher par nom/i).fill(NOM)
        await expect(page.getByText(NOM).first()).toBeVisible()
        const [reponse] = await Promise.all([
            page.waitForResponse(r => r.request().method() === 'DELETE' && r.url().includes('/clients/')),
            page.locator('button[title="Supprimer"]').first().click(),
        ])
        expect(reponse.status()).toBe(200)

        const api = await apiAs('admin')
        const clients = await (await api.get('clients')).json()
        expect(clients.some(c => c.NomRS === NOM)).toBe(false)
        await api.dispose()
    })
})
