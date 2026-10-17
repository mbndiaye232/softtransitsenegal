import { test, expect } from '@playwright/test'
import { RUN, apiAs, agentId, createClientUI, createDossierUI, openDossier } from './helpers'

test.use({ storageState: '.auth/admin.json' })

const CLIENT = `E2E Import-Export Fictif ${RUN}`
const LIBELLE = `E2E Importation de véhicules ${RUN}`

let dossierId

test.describe.serial('Parcours complet : client → dossier → devis → facture → règlement', () => {
    test('création du client et du dossier', async ({ page }) => {
        await createClientUI(page, CLIENT)
        await createDossierUI(page, CLIENT, LIBELLE)
        await expect(page.getByText(LIBELLE)).toBeVisible()
        // code dossier de la forme IMP-MA-TC-AAAA-NNNNN
        await expect(page.getByText(/IMP-MA-TC-\d{4}-\d{5}/).first()).toBeVisible()
    })

    test('le dossier s\'ouvre avec tous ses onglets métier', async ({ page }) => {
        dossierId = await openDossier(page, LIBELLE)
        for (const onglet of ['Détails', 'Cotation', 'OT (Transit)', 'Transports', 'Composition', 'Notes de détail',
            'Déclaration', 'BL (Bordereau)', 'Devis', 'Factures Tiers', 'Facturation', 'Envoi Factures']) {
            await expect(page.getByRole('button', { name: onglet, exact: true }).first()).toBeVisible()
        }
    })

    test('génération d\'un devis avec une rubrique', async ({ page }) => {
        await page.goto(`/dossiers/${dossierId}`)
        await page.getByRole('button', { name: 'Devis', exact: true }).first().click()
        await expect(page.getByText('Aucun devis')).toBeVisible()

        await page.locator('tr', { hasText: '1101' }).first().locator('input[type="checkbox"]').check()
        await page.getByRole('spinbutton').first().fill('150000')
        await page.getByRole('button', { name: /générer le devis/i }).click()
        await expect(page.getByText('Aucun devis')).toHaveCount(0, { timeout: 15_000 })

        const api = await apiAs('admin')
        const devis = await (await api.get(`devis/dossier/${dossierId}`)).json()
        expect(devis).toHaveLength(1)
        await api.dispose()
    })

    test('facturation : la facture est créée et son montant est correct', async ({ page, context }) => {
        context.on('page', p => p.close().catch(() => {})) // fenêtre d'impression éventuelle
        await page.goto(`/dossiers/${dossierId}`)
        await page.getByRole('button', { name: 'Facturation', exact: true }).first().click()
        await expect(page.getByText('Aucune facture')).toBeVisible()

        await page.locator('tr', { hasText: '1101' }).first().locator('input[type="checkbox"]').check()
        await page.getByRole('spinbutton').first().fill('150000')
        await page.getByRole('button', { name: /terminer & imprimer la facture/i }).click()

        const api = await apiAs('admin')
        await expect.poll(async () => (await (await api.get(`factures/dossier/${dossierId}`)).json()).length,
            { timeout: 20_000 }).toBe(1)
        const [facture] = await (await api.get(`factures/dossier/${dossierId}`)).json()
        expect(Number(facture.MontantHTFacture)).toBe(150000)
        // l'auteur de la facture est l'utilisateur connecté (et non un idAgent fourni par le client)
        expect(Number(facture.IDAgents)).toBe(await agentId('e2e_admin'))
        expect(Number(facture.MontantTTCFacture)).toBeGreaterThanOrEqual(150000)
        expect(Number(facture.ReliquatFacture)).toBeCloseTo(Number(facture.MontantTTCFacture), 2)
        await api.dispose()
    })

    test('règlement partiel : le reliquat de la facture est mis à jour', async () => {
        const api = await apiAs('admin')
        const [facture] = await (await api.get(`factures/dossier/${dossierId}`)).json()
        const clients = await (await api.get('clients')).json()
        const client = clients.find(c => c.NomRS === CLIENT)
        const modes = await (await api.get('reglements/modes')).json()

        const paiement = await api.post('reglements', {
            data: {
                clientId: client.IDCLIENTS,
                montantReglement: 50000,
                dateReglement: new Date().toISOString().slice(0, 10),
                listFactures: [facture.IDFactures],
                idModeReglement: modes[0].IDModesReglements,
                observations: 'Règlement fictif E2E',
            },
        })
        expect(paiement.ok(), await paiement.text()).toBeTruthy()

        const [apres] = await (await api.get(`factures/dossier/${dossierId}`)).json()
        expect(Number(apres.MontantRegleFacture)).toBe(50000)
        expect(Number(apres.ReliquatFacture)).toBeCloseTo(Number(apres.MontantTTCFacture) - 50000, 2)
        await api.dispose()
    })

    test('une facture réglée en partie ne peut pas être supprimée sans précaution (contrôle API)', async () => {
        const api = await apiAs('admin')
        const [facture] = await (await api.get(`factures/dossier/${dossierId}`)).json()
        const res = await api.delete(`factures/${facture.IDFactures}`)
        expect(res.status()).toBeGreaterThanOrEqual(400)
        await api.dispose()
    })
})
