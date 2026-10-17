import { test, expect } from '@playwright/test'
import { openNav, apiAnon } from './helpers'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentification', () => {
    test('une page protégée renvoie vers /login quand on n\'est pas connecté', async ({ page }) => {
        await page.goto('/dossiers')
        await expect(page).toHaveURL(/\/login/)
    })

    test('un mauvais mot de passe est refusé avec un message', async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="login"]', 'e2e_admin')
        await page.fill('input[name="password"]', 'Mauvais-mot-de-passe-1')
        await page.getByRole('button', { name: /se connecter/i }).click()
        await expect(page.locator('.alert')).toBeVisible()
        await expect(page).toHaveURL(/\/login/)
        expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
    })

    test('le formulaire vide n\'ouvre pas de session', async ({ page }) => {
        await page.goto('/login')
        await page.getByRole('button', { name: /se connecter/i }).click()
        await expect(page).toHaveURL(/\/login/)
    })

    test('connexion puis déconnexion', async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[name="login"]', 'e2e_admin')
        await page.fill('input[name="password"]', process.env.E2E_ADMIN_PASSWORD)
        await page.getByRole('button', { name: /se connecter/i }).click()
        await page.waitForURL('**/dashboard')
        await expect(page.getByText(/Bienvenue, E2E/i)).toBeVisible()
        expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy()

        await openNav(page)
        await page.getByRole('button', { name: /quitter/i }).first().click()
        await expect(page).toHaveURL(/\/login/)
        expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
        await page.goto('/clients')
        await expect(page).toHaveURL(/\/login/)
    })

    test("la page de connexion est celle d'une application mono-structure (ni SaaS, ni inscription)", async ({ page }) => {
        await page.goto('/login')
        const texte = await page.locator('body').innerText()
        expect(texte).not.toMatch(/saas|multi-?locataire|demander un accès|nouveau sur la plateforme/i)
        expect(texte).toContain('Soft Transit Gabon')
        await expect(page.getByRole('link', { name: /demander un accès/i })).toHaveCount(0)
    })

    test("l'ancienne adresse /register renvoie vers la connexion", async ({ page }) => {
        await page.goto('/register')
        await expect(page).toHaveURL(/\/login/)
    })

    test("l'inscription publique d'une société n'existe plus côté serveur", async () => {
        const anon = await apiAnon()
        const r = await anon.post('auth/register', {
            data: { companyName: 'E2E Société pirate', companyEmail: 'pirate@e2e.test', adminName: 'Pirate',
                adminEmail: 'pirate-admin@e2e.test', adminLogin: 'pirate_e2e', adminPassword: 'Aa1-Pirate-2026' },
        })
        expect(r.status()).toBe(404)
        await anon.dispose()
    })

    test('la page « mot de passe oublié » répond sans révéler si l\'adresse existe', async ({ page }) => {
        await page.goto('/forgot-password')
        await page.locator('input[type="email"], input[name="email"]').first().fill('inconnu-e2e@exemple.test')
        const [resp] = await Promise.all([
            page.waitForResponse(r => r.url().includes('/auth/forgot-password')),
            page.getByRole('button', { name: /envoyer|réinitialiser|valider/i }).first().click(),
        ])
        expect(resp.status()).toBe(200)
        const body = await resp.json()
        expect(body.message).toMatch(/if the email exists/i)
        expect(body.resetToken).toBeUndefined()
    })
})
