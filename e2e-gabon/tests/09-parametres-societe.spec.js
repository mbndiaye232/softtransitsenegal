import { test, expect } from '@playwright/test'
import { apiAs } from './helpers'

test.use({ storageState: '.auth/admin.json' })

test.describe('Paramètres de la société', () => {
    test('un numéro de téléphone international long est enregistré', async ({ page }) => {
        await page.goto('/settings')
        const tel = page.locator('input[name="telSociete"]')
        const cel = page.locator('input[name="celSociete"]')
        await expect(page.locator('input[name="NomSociete"]')).not.toHaveValue('')

        await tel.fill('+241(0) 60 01 01 00')
        await cel.fill('+221 77 647 35 35')
        await page.getByRole('button', { name: /enregistrer|mettre à jour|sauvegarder/i }).last().click()
        await expect(page.getByText(/mise à jour avec succès/i)).toBeVisible()

        await page.reload()
        await expect(page.locator('input[name="telSociete"]')).toHaveValue('+241(0) 60 01 01 00')
        await expect(page.locator('input[name="celSociete"]')).toHaveValue('+221 77 647 35 35')
    })

    test('une valeur trop longue est refusée avec un message clair (400), pas une erreur 500', async () => {
        const api = await apiAs('admin')
        const r = await api.put('structures/me', { multipart: { telSociete: '0'.repeat(80) } })
        expect(r.status()).toBe(400)
        expect((await r.json()).error).toMatch(/trop longue/i)
        await api.dispose()
    })
})
