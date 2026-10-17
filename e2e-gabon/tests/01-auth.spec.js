import { test, expect } from '@playwright/test'
import { openNav } from './helpers'

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
