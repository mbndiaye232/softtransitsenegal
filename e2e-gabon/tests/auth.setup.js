import { test as setup, expect } from '@playwright/test'

const COMPTES = [
    ['admin', 'e2e_admin', process.env.E2E_ADMIN_PASSWORD],
    ['manager', 'e2e_manager', process.env.E2E_MANAGER_PASSWORD],
    ['user', 'e2e_user', process.env.E2E_USER_PASSWORD],
]

setup.setTimeout(120_000)

for (const [nom, login, password] of COMPTES) {
    setup(`connexion ${nom}`, async ({ page }) => {
        expect(password, `mot de passe ${nom} absent : lancer « npm run db »`).toBeTruthy()
        await page.goto('/login')
        await page.fill('input[name="login"]', login)
        await page.fill('input[name="password"]', password)
        await page.getByRole('button', { name: /se connecter/i }).click()
        await page.waitForURL('**/dashboard', { timeout: 20_000 })
        await page.context().storageState({ path: `.auth/${nom}.json` })
    })
}
