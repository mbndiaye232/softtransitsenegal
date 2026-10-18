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

// Session du super administrateur (compte n° 1 de la base de test) : jeton signé avec le secret local,
// car son mot de passe réel n'est pas connu des tests.
setup('session super administrateur', async () => {
    const fs = require('node:fs')
    const backend = require('node:path').join(__dirname, '..', '..', 'backend')
    require(require('node:path').join(backend, 'node_modules', 'dotenv')).config({ path: require('node:path').join(backend, '.env') })
    const jwt = require(require('node:path').join(backend, 'node_modules', 'jsonwebtoken'))
    const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '2h' })
    const state = { cookies: [], origins: [{ origin: 'http://localhost:5174', localStorage: [
        { name: 'token', value: token }, { name: 'user', value: JSON.stringify({ id: 1 }) },
    ] }] }
    fs.mkdirSync('.auth', { recursive: true })
    fs.writeFileSync('.auth/super.json', JSON.stringify(state))
})
