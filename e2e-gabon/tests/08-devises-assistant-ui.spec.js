import { test, expect } from '@playwright/test'
import { RUN, apiAs } from './helpers'

test.use({ storageState: '.auth/admin.json' })

test.describe('Devises et devise de référence', () => {
    test('une seule devise est marquée « référence » (API et écran)', async ({ page }) => {
        const api = await apiAs('admin')
        const devises = await (await api.get('devises')).json()
        const reference = devises.filter(d => d.est_reference === true || d.est_reference === 1)
        expect(reference).toHaveLength(1)
        expect(Number(reference[0].TauxChangeDeviseCFA)).toBe(1)
        await api.dispose()

        await page.goto('/devises')
        await expect(page.getByText(/^\s*Référence\s*$/)).toHaveCount(1)
    })

    test('la devise de référence du Gabon est le franc CFA, affiché « F XAF »', async ({ page }) => {
        const api = await apiAs('admin')
        const devises = await (await api.get('devises')).json()
        const ref = devises.find(d => d.est_reference === true || d.est_reference === 1)
        expect(ref.Symbole).toBe('F XAF')
        expect(ref.libelle).toBe('Franc CFA')
        await api.dispose()

        await page.goto('/devises')
        await expect(page.getByText(/TAUX DE CHANGE VERS FRANC CFA/i).first()).toBeVisible().catch(() => {})
        const texte = await page.locator('body').innerText()
        expect(texte).toContain('F XAF')
        expect(texte).not.toMatch(/Franc Congolais|\bFC\b/)
    })

    test('création puis modification d\'une devise fictive par l\'interface', async ({ page }) => {
        const libelle = `E2E Dinar fictif ${RUN}`
        await page.goto('/devises')
        await page.getByRole('button', { name: /nouvelle devise/i }).click()
        await page.getByPlaceholder(/Ex: Dollar US/).fill(libelle)
        await page.getByPlaceholder(/Ex: \$, €, CNY/).fill('EDF')
        await page.getByPlaceholder('Ex: 655.957').fill('123.45')
        await page.getByRole('button', { name: 'Ajouter', exact: true }).click()

        await page.getByPlaceholder('Rechercher...').fill(libelle)
        await expect(page.getByText(libelle).first()).toBeVisible()

        await page.getByRole('button', { name: 'Modifier', exact: true }).first().click()
        await page.getByPlaceholder('Ex: 655.957').fill('200')
        await page.getByRole('button', { name: /enregistrer|mettre à jour|modifier/i }).last().click()

        const api = await apiAs('admin')
        await expect.poll(async () => {
            const liste = await (await api.get('devises')).json()
            return Number(liste.find(d => d.libelle === libelle)?.TauxChangeDeviseCFA)
        }, { timeout: 10_000 }).toBe(200)

        // la devise de référence ne peut pas être supprimée
        const liste = await (await api.get('devises')).json()
        const ref = liste.find(d => d.est_reference === true || d.est_reference === 1)
        expect((await api.delete(`devises/${ref.IDDevises ?? ref.id}`)).status()).toBeGreaterThanOrEqual(400)

        // nettoyage de la devise fictive
        const fictive = liste.find(d => d.libelle === libelle)
        expect((await api.delete(`devises/${fictive.IDDevises ?? fictive.id}`)).ok()).toBeTruthy()
        await api.dispose()
    })
})

test.describe('Assistant d\'aide', () => {
    test('le bouton ouvre le panneau, l\'agrandit et Échap le ferme', async ({ page }) => {
        await page.goto('/dashboard')
        await page.getByRole('button', { name: "Ouvrir l'assistant" }).click()
        const cadre = page.locator('iframe[title="Assistant Soft Transit"]')
        await expect(cadre).toBeVisible()
        await expect(cadre).toHaveAttribute('src', /guidestransit/)

        const avant = (await cadre.boundingBox()).width
        await page.getByTitle('Agrandir').click()
        await expect.poll(async () => (await cadre.boundingBox()).width).toBeGreaterThan(avant)

        await page.keyboard.press('Escape')
        await expect(cadre).toHaveCount(0)
    })
})

test.describe('Tableaux : les boutons d\'action restent accessibles', () => {
    test('les tableaux d\'administration défilent horizontalement au lieu d\'être rognés', async ({ page }) => {
        await page.setViewportSize({ width: 900, height: 700 })
        for (const route of ['/rubriques', '/pays', '/users']) {
            await page.goto(route)
            await page.waitForLoadState('networkidle').catch(() => {})
            const table = page.locator('table').first()
            if (!(await table.count())) continue
            const defilable = await table.evaluate(t => {
                for (let el = t.parentElement; el; el = el.parentElement) {
                    const o = getComputedStyle(el).overflowX
                    if (o === 'auto' || o === 'scroll') return true
                }
                return false
            })
            expect(defilable, `${route} : tableau sans conteneur défilant`).toBe(true)
        }
    })
})
