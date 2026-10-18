import { test, expect } from '@playwright/test'
import { apiAs } from './helpers'

test.use({ storageState: '.auth/admin.json' })

const SUSPENSIFS_EX = ['EX2200', 'EX3050', 'EX8']

test.describe('Régimes suspensifs : classement et filtre des sommiers', () => {
    test('les 57 régimes sont classés ; 27 suspensifs, 7 exonérations, 23 définitifs', async () => {
        const api = await apiAs('admin')
        const regimes = await (await api.get('regimes')).json()
        expect(regimes).toHaveLength(57)
        expect(regimes.every(r => r.type_regime_code)).toBeTruthy()

        const parType = (t) => regimes.filter(r => r.type_regime_code === t)
        expect(parType('SUSPENSIF')).toHaveLength(27)
        expect(parType('EXONERATION')).toHaveLength(7)
        expect(parType('DEFINITIF')).toHaveLength(23)

        // un régime est suspensif s'il est de la famille IM5 (admission temporaire), IM7 (entrepôt), IM8 (transit)
        // ou l'une des exportations temporaires / entrepôt d'exportation listées
        for (const r of regimes) {
            const attendu = ['IM5', 'IM7', 'IM8'].includes(r.regime) || SUSPENSIFS_EX.includes(r.CodeRegimeDeclaration)
            expect(r.type_regime_code === 'SUSPENSIF', `${r.CodeRegimeDeclaration} (${r.regime})`).toBe(attendu)
        }
        await api.dispose()
    })

    test('chaque suspensif de transit, entrepôt et admission temporaire a sa catégorie', async () => {
        const api = await apiAs('admin')
        const regimes = await (await api.get('regimes')).json()
        const cat = (code) => regimes.find(r => r.CodeRegimeDeclaration === code)?.categorie_regime_libelle
        expect(cat('IM8000')).toMatch(/transit/i)
        expect(cat('IM7000')).toMatch(/entrep/i)
        expect(cat('IM5000')).toMatch(/admission temporaire/i)
        expect(cat('IM5100')).toMatch(/perfectionnement actif/i)
        expect(cat('EX2200')).toMatch(/perfectionnement passif/i)
        await api.dispose()
    })

    test('la bulle de l\'œil indique le type du régime', async ({ page }) => {
        await page.goto('/regimes-declaration')
        await page.getByPlaceholder(/Code ou libellé/i).fill('IM5000')
        await page.locator('tr', { hasText: 'Admission Temporaire Normale' }).first()
            .getByRole('button', { name: /régime et le code additionnel/i }).hover()
        const bulle = page.getByRole('tooltip')
        await expect(bulle).toContainText('Type : Suspensif')
        await expect(bulle).toContainText('Admission temporaire')
    })

    test('un régime non suspensif est refusé pour un sommier ; un suspensif passe le contrôle', async () => {
        const api = await apiAs('admin')
        const regimes = await (await api.get('regimes')).json()
        const definitif = regimes.find(r => r.CodeRegimeDeclaration === 'IM4000' && r.type_regime_code === 'DEFINITIF')
        const suspensif = regimes.find(r => r.CodeRegimeDeclaration === 'IM7000')
        const corps = (id) => ({
            IDRegimeDeclaration: id, numero_declaration: `E2E-REG-${id}-${Date.now()}`,
            date_declaration: '2026-10-01', date_echeance: '2026-12-01', articles: [{ designation: 'E2E article fictif' }],
        })

        const refuse = await api.post('sommiers', { data: corps(definitif.IDRegimeDeclaration) })
        expect(refuse.status()).toBe(400)
        expect((await refuse.json()).error).toMatch(/non éligible.*Suspensif/i)

        const passe = await api.post('sommiers', { data: corps(suspensif.IDRegimeDeclaration) })
        const message = (await passe.json().catch(() => ({}))).error || ''
        expect(message).not.toMatch(/non éligible/i)
        await api.dispose()
    })

    test('le formulaire « Nouveau sommier » ne propose que les 27 régimes suspensifs', async ({ page }) => {
        await page.goto('/sommiers')
        await page.getByRole('button', { name: /nouveau sommier/i }).first().click()
        const liste = page.locator('select').filter({ has: page.locator('option', { hasText: 'IM5000' }) }).first()
        await expect(liste).toBeVisible()
        const options = await liste.locator('option').allInnerTexts()
        expect(options.filter(o => /^(IM|EX)/.test(o.trim()))).toHaveLength(27)
        expect(options.some(o => o.startsWith('IM4000'))).toBe(false)
        expect(options.some(o => o.startsWith('EX1200'))).toBe(false)
        expect(options.some(o => o.startsWith('IM7000'))).toBe(true)
    })
})
