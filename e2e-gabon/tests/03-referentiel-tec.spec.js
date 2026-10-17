import { test, expect } from '@playwright/test'
import { apiAs } from './helpers'

test.use({ storageState: '.auth/admin.json' })

test.describe('Référentiel douanier du Gabon (TEC)', () => {
    test('les taxes et taux du TEC sont chargés', async () => {
        const api = await apiAs('admin')
        const taxes = await (await api.get('taxes')).json()
        const codes = taxes.map(t => t.CodeTaxe).sort()
        expect(codes).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '12'])
        const ddi = taxes.find(t => t.CodeTaxe === '01')
        expect(ddi.LibelleTaxe).toBe('DDI')
        expect(ddi.LibelleTaxeComplet).toMatch(/Droit de Douanes à l.importation/)
        await api.dispose()
    })

    test('la page Produits trouve un produit par code NTS et par libellé', async ({ page }) => {
        await page.goto('/produits')
        const recherche = page.getByPlaceholder(/recherche par code nts/i)
        await recherche.fill('01012100000')
        await expect(page.getByText('Chevaux vivants, reproducteurs de race pure.')).toBeVisible()
        await recherche.fill('bovines')
        await expect(page.getByText(/Viandes bovines, fraiches/).first()).toBeVisible()
        await recherche.fill('zzzzzz-introuvable')
        await expect(page.getByText(/Viandes bovines/)).toHaveCount(0)
    })

    test('les tarifs d\'un produit lient les 3 tables (produit, taxe, taux)', async () => {
        const api = await apiAs('admin')
        const res = await api.get('tarifs?nts=01012100000')
        expect(res.ok()).toBeTruthy()
        const corps = await res.json()
        const liste = Array.isArray(corps) ? corps : (corps.data || corps.tarifs || [])
        expect(liste.length).toBeGreaterThan(0)
        expect(new Set(liste.map(l => l.CodeTaxe)).has('01')).toBeTruthy() // DDI
        await api.dispose()
    })

    test('la page Tarifs & Taxes s\'affiche avec ses filtres', async ({ page }) => {
        await page.goto('/tarifs')
        await expect(page.getByRole('heading', { name: /Tarifs & Taxes Douanières/ })).toBeVisible()
        await expect(page.getByPlaceholder(/Rechercher NTS/i)).toBeVisible()
    })

    test('les régimes SYDONIA sont importés avec code additionnel et famille', async ({ page }) => {
        const api = await apiAs('admin')
        const regimes = await (await api.get('regimes')).json()
        expect(regimes.length).toBe(57)
        const im4000 = regimes.filter(r => r.CodeRegimeDeclaration === 'IM4000')
        expect(im4000).toHaveLength(3)
        expect(new Set(im4000.map(r => r.code_additionnel)).size).toBe(3)
        expect(im4000.every(r => r.regime === 'IM4')).toBeTruthy()
        expect(regimes.every(r => r.code_additionnel && r.regime)).toBeTruthy()
        await api.dispose()

        await page.goto('/regimes-declaration')
        await page.getByPlaceholder(/Code ou libellé/i).fill('IM4000')
        await expect(page.getByText('Mise à la consommation directe, Régime Commun (RC)')).toBeVisible()
    })

    test("l'icône œil affiche une bulle avec le régime et le code additionnel au survol", async ({ page }) => {
        await page.goto('/regimes-declaration')
        await page.getByPlaceholder(/Code ou libellé/i).fill('IM4000')
        const ligne = page.locator('tr', { hasText: 'Mise à la consommation directe, Régime Commun (RC)' })
        const oeil = ligne.getByRole('button', { name: /régime et le code additionnel/i })
        await expect(page.getByRole('tooltip')).toHaveCount(0)

        await oeil.hover()
        const bulle = page.getByRole('tooltip')
        await expect(bulle).toBeVisible()
        await expect(bulle).toContainText('Régime : IM4')
        await expect(bulle).toContainText('Code additionnel : Avec taxes + code add= 000')

        await page.mouse.move(5, 5)
        await expect(bulle).toHaveCount(0)
    })
})
