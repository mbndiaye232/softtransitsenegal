import { test, expect } from '@playwright/test'
import { RUN, apiAs, createClientUI, createDossierUI } from './helpers'

test.use({ storageState: '.auth/admin.json' })

const CLIENT = `E2E Entrepositaire Fictif ${RUN}`
const LIBELLE_DOSSIER = `E2E Dossier sommier ${RUN}`
const ENTREPOT = `E2E Entrepôt d'Owendo ${RUN}`
const NUM_DECL = `E2E-IM7-${RUN}`
const DESIGNATION = `E2E Riz en sacs ${RUN}`

test.describe.serial('Sommier de bout en bout (régime suspensif IM7000, données fictives)', () => {
    test('préparation : entrepôt, client et dossier fictifs', async ({ page }) => {
        const api = await apiAs('admin')
        const r = await api.post('entrepots', { data: { libelle: ENTREPOT, code: `E2E-${RUN}`, adresse: 'Port d\'Owendo, Libreville (fictif)', type_entrepot: 'REEL' } })
        expect(r.status(), await r.text()).toBe(201)
        await api.dispose()

        await createClientUI(page, CLIENT)
        await createDossierUI(page, CLIENT, LIBELLE_DOSSIER)
    })

    test('création d\'un sommier par l\'interface avec un régime suspensif', async ({ page }) => {
        await page.goto('/sommiers')
        await page.getByRole('button', { name: /nouveau sommier/i }).first().click()

        const regime = page.locator('select').filter({ has: page.locator('option', { hasText: 'IM7000' }) }).first()
        const valeurRegime = await regime.locator('option', { hasText: /^IM7000 — Mise en entrepôt de stockage suite Importation Directe/ }).getAttribute('value')
        await regime.selectOption(valeurRegime)

        await page.getByPlaceholder('ex: IM7-2026-001234').fill(NUM_DECL)
        await page.locator('input[type="date"]').nth(1).fill('2027-03-31')

        const client = page.locator('select').filter({ has: page.locator('option', { hasText: CLIENT }) }).first()
        await client.selectOption({ label: CLIENT })
        const dossier = page.locator('select').filter({ has: page.locator('option', { hasText: LIBELLE_DOSSIER }) }).first()
        await expect(dossier).toBeVisible()
        await dossier.selectOption({ index: 1 })

        const ligne = page.locator('table tbody tr').first()
        await ligne.locator('input:not([type="number"])').first().fill(DESIGNATION)
        const entrepot = ligne.locator('select').filter({ has: page.locator('option', { hasText: ENTREPOT }) }).first()
        await entrepot.selectOption({ label: ENTREPOT })
        const nombres = ligne.locator('input[type="number"]')
        await nombres.nth(0).fill('12.5')
        await nombres.nth(1).fill('250')
        await nombres.nth(2).fill('3750000')

        const [reponse] = await Promise.all([
            page.waitForResponse(r => r.request().method() === 'POST' && /\/sommiers$/.test(r.url())),
            page.getByRole('button', { name: /créer le sommier/i }).click(),
        ])
        expect(reponse.status(), await reponse.text()).toBe(201)
    })

    test('le sommier apparaît avec son régime, son échéance et son article', async ({ page }) => {
        const api = await apiAs('admin')
        const liste = await (await api.get('sommiers')).json()
        const lignes = Array.isArray(liste) ? liste : (liste.data || liste.sommiers || [])
        const sommier = lignes.find(s => s.numero_declaration === NUM_DECL)
        expect(sommier, 'sommier créé introuvable dans la liste').toBeTruthy()
        expect(sommier.regime_code).toBe('IM7000')
        expect(String(sommier.date_echeance).slice(0, 10)).toBe('2027-03-31')

        const detail = await (await api.get(`sommiers/${sommier.id}`)).json()
        const articles = detail.articles || detail.sommier?.articles || []
        expect(articles.some(a => a.designation === DESIGNATION)).toBeTruthy()
        await api.dispose()

        await page.goto('/sommiers')
        await expect(page.getByText(NUM_DECL).first()).toBeVisible()
        await page.getByText(NUM_DECL).first().click()
        await page.getByRole('button', { name: /^Articles/ }).first().click()
        await expect(page.getByText(DESIGNATION).first()).toBeVisible()
    })

    test('le même numéro de déclaration ne peut pas être réutilisé', async () => {
        const api = await apiAs('admin')
        const regimes = await (await api.get('regimes')).json()
        const im7000 = regimes.find(r => r.CodeRegimeDeclaration === 'IM7000')
        const entrepots = await (await api.get('entrepots')).json()
        const entrepot = (Array.isArray(entrepots) ? entrepots : entrepots.data).find(e => e.libelle === ENTREPOT)
        const doublon = await api.post('sommiers', { data: {
            IDRegimeDeclaration: im7000.IDRegimeDeclaration, numero_declaration: NUM_DECL,
            date_declaration: '2026-10-01', date_echeance: '2027-03-31',
            articles: [{ entrepot_id: entrepot.id, numero_ligne: 1, designation: 'doublon', poids_initial: 1, colis_initial: 1, valeur_initial: 1, unite_poids: 'KG' }],
        } })
        expect(doublon.status()).toBe(409)
        await api.dispose()
    })
})

test.describe('Menu flottant', () => {
    test("il ne recouvre pas les boutons du bas d'une fenêtre modale (écran 1280 × 720)", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 })
        await page.goto('/sommiers')
        await page.getByRole('button', { name: /nouveau sommier/i }).first().click()
        const bouton = page.getByRole('button', { name: /créer le sommier/i })
        await bouton.scrollIntoViewIfNeeded()
        const boite = await bouton.boundingBox()
        const toucheLeBouton = await page.evaluate(({ x, y }) => {
            const el = document.elementFromPoint(x, y)
            return !!el && !!el.closest('button') && /créer le sommier/i.test(el.closest('button').innerText)
        }, { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 })
        expect(toucheLeBouton).toBe(true)
    })
})
