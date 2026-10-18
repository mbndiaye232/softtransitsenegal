import { test, expect } from '@playwright/test'
import { agentId } from './helpers'

test.describe('Rôle d\'accès : on ne peut pas modifier son propre rôle (ni celui d\'un super administrateur)', () => {
    test.describe('super administrateur', () => {
        test.use({ storageState: '.auth/super.json' })

        test('son propre profil affiche « Super administrateur », champ verrouillé, et s\'enregistre', async ({ page }) => {
            await page.goto('/users/1')
            const role = page.locator('select[name="role"]')
            await expect(page.locator('input[name="NomAgent"]')).not.toHaveValue('')
            await expect(role).toBeDisabled()
            await expect(role).toHaveValue('SUPER_ADMIN')
            await expect(role.locator('option:checked')).toHaveText(/super administrateur/i)

            const [reponse] = await Promise.all([
                page.waitForResponse(r => r.request().method() === 'PUT' && /\/users\/1$/.test(r.url())),
                page.getByRole('button', { name: /sauvegarder les modifications/i }).click(),
            ])
            expect(reponse.status()).toBe(200)
            await expect(page.getByText(/Agent modifié avec succès/)).toBeVisible()
        })
    })

    test.describe('administrateur', () => {
        test.use({ storageState: '.auth/admin.json' })

        test('le champ est verrouillé sur son propre compte, libre sur celui d\'un collaborateur', async ({ page }) => {
            const moi = await agentId('e2e_admin')
            await page.goto(`/users/${moi}`)
            await expect(page.locator('input[name="NomAgent"]')).not.toHaveValue('')
            await expect(page.locator('select[name="role"]')).toBeDisabled()

            const collaborateur = await agentId('e2e_user')
            await page.goto(`/users/${collaborateur}`)
            await expect(page.locator('input[name="NomAgent"]')).not.toHaveValue('')
            await expect(page.locator('select[name="role"]')).toBeEnabled()
        })
    })
})
