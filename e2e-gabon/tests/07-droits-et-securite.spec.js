import { test, expect } from '@playwright/test'
import { RUN, apiAs, apiAnon, createClientUI } from './helpers'

test.describe('Collaborateur sans aucun droit', () => {
    test.use({ storageState: '.auth/user.json' })

    test('l\'API refuse les modules sensibles', async () => {
        const api = await apiAs('user')
        for (const route of ['users', 'clients', 'devis/1', 'factures/1', 'devises', 'taxes']) {
            const r = await api.get(route)
            expect([401, 403], `GET ${route} → ${r.status()}`).toContain(r.status())
        }
        expect((await api.post('users', { data: {} })).status()).toBe(403)
        expect((await api.post('factures/1/send-email', { data: { emailDestinataire: 'a@b.cc' } })).status()).toBe(403)
        await api.dispose()
    })

    test('l\'écran des agents n\'affiche aucun agent', async ({ page }) => {
        await page.goto('/users')
        await page.waitForTimeout(1500)
        await expect(page.getByText('E2E Administrateur')).toHaveCount(0)
    })
})

test.describe('Sécurité de l\'API', () => {
    test('sans jeton ou avec un jeton invalide : 401', async () => {
        const anon = await apiAnon()
        expect((await anon.get('clients')).status()).toBe(401)
        expect((await anon.get('users')).status()).toBe(401)
        const faux = await (await import('@playwright/test')).request.newContext({
            baseURL: 'http://localhost:3101/api/', extraHTTPHeaders: { Authorization: 'Bearer faux.jeton.invalide' },
        })
        expect((await faux.get('clients')).status()).toBe(401)
        await anon.dispose(); await faux.dispose()
    })

    test('une injection SQL dans le login ne donne pas accès', async () => {
        const anon = await apiAnon()
        const r = await anon.post('auth/login', { data: { login: "' OR '1'='1' --", password: 'x' } })
        expect(r.status()).toBe(401)
        const corps = await r.json()
        expect(corps.token).toBeUndefined()
        await anon.dispose()
    })

    test('l\'envoi d\'une facture refuse un destinataire multiple ou invalide', async () => {
        const api = await apiAs('admin')
        for (const dest of ['a@b.cc, d@e.ff', 'a@b.cc;d@e.ff', 'pas-un-mail']) {
            const r = await api.post('factures/1/send-email', { data: { emailDestinataire: dest } })
            expect(r.status(), dest).toBe(400)
        }
        await api.dispose()
    })

    test('l\'en-tête ne révèle pas la technologie du serveur', async () => {
        const anon = await apiAnon()
        const r = await anon.get('health')
        expect(r.headers()['x-powered-by']).toBeUndefined()
        await anon.dispose()
    })
})

test.describe('Injection de script (XSS) dans une donnée saisie', () => {
    test.use({ storageState: '.auth/admin.json' })

    test('un nom de client contenant du HTML est affiché tel quel, sans s\'exécuter', async ({ page }) => {
        const nom = `E2E <img src=x onerror="window.__xss=1"> ${RUN}`
        await createClientUI(page, nom)
        await page.goto('/clients')
        await page.getByPlaceholder(/rechercher par nom/i).fill(`${RUN}`)
        await page.waitForTimeout(1200)
        expect(await page.evaluate(() => window.__xss)).toBeUndefined()
        await expect(page.getByText(/E2E <img src=x/).first()).toBeVisible()

        // nettoyage
        page.on('dialog', d => d.accept())
        await page.locator('button[title="Supprimer"]').first().click()
        await page.waitForTimeout(800)
    })
})
