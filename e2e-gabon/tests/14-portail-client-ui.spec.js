import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { RUN, apiAs, createClientUI, createDossierUI, sql } from './helpers'

// Portail client par l'interface : demande d'accès, validation par l'équipe, consultation et téléchargement.
// Le client et l'équipe utilisent deux contextes de navigateur distincts.
const CLIENT = `E2E Portail UI ${RUN}`
const DOSSIER = `E2E Portail UI dossier ${RUN}`
const MAIL = `ui.${RUN.toLowerCase()}@portail-e2e.test`
const MDP = 'Portail-E2E-2026'
const CONTENU = `document confidentiel ${RUN}`

test.describe.serial('Portail client (interface)', () => {
    test.use({ storageState: '.auth/admin.json' })

    test('préparation : un client, son dossier et un document', async ({ page }) => {
        await createClientUI(page, CLIENT, { email: MAIL })
        await createDossierUI(page, CLIENT, DOSSIER)
        const admin = await apiAs('admin')
        const [{ iddossiers }] = await sql('SELECT iddossiers FROM dossiers WHERE libelle = $1', [DOSSIER])
        const r = await admin.post('documents', {
            multipart: { dossierId: String(iddossiers), title: `E2E Bordereau UI ${RUN}`, description: 'e2e', number: RUN,
                document: { name: 'bordereau.txt', mimeType: 'text/plain', buffer: Buffer.from(CONTENU) } },
        })
        expect(r.status(), await r.text()).toBe(201)
        await admin.dispose()
        await sql(`INSERT INTO transports (datedepart, idlieudepart, idlieuarrive, idagent, idmoyenstransport, numerotitretransport, libelletransport,
                                           datearriveeprevue, heurearriveeprevue, numeroescale, idbl)
                   VALUES ('2026-09-28', (SELECT MIN(idlieux) FROM lieux), (SELECT MAX(idlieux) FROM lieux), (SELECT MIN(idagents) FROM agents),
                           (SELECT MIN(idmoyenstransport) FROM moyenstransport), $1, $2, '2026-10-24', '08:00', 'ESC-UI', $3)`,
            [`BL-UI-${RUN}`, `NAVIRE-UI-${RUN}`, iddossiers])
    })

    test("le client demande un accès (sans mot de passe), l'équipe ne peut pas valider avant confirmation de l'adresse", async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })  // aucune session du personnel
        const page = await ctx.newPage()
        await page.goto('/portail')
        await page.getByRole('button', { name: 'Demander un accès' }).click()
        await expect(page.getByLabel('Mot de passe')).toHaveCount(0) // aucun mot de passe à l'inscription
        await page.getByLabel('Votre nom').fill('Cliente Fictive')
        await page.getByLabel('Votre société').fill(CLIENT)
        await page.getByLabel('Adresse e-mail').fill(MAIL)
        await page.getByRole('button', { name: 'Envoyer ma demande' }).click()
        await expect(page.getByText(/votre demande est enregistrée/i)).toBeVisible()

        // l'équipe ne peut pas valider tant que l'adresse n'est pas confirmée
        const equipe = await browser.newContext({ storageState: '.auth/admin.json' })
        const admin = await equipe.newPage()
        await admin.goto('/portail-admin')
        const ligne = admin.locator('tr', { hasText: MAIL })
        await expect(ligne.getByText(/adresse e-mail non confirmée/i)).toBeVisible()
        await expect(ligne.getByRole('button', { name: 'Valider' })).toBeDisabled()
        await equipe.close()

        // le titulaire de l'adresse clique sur le lien reçu par e-mail
        const jeton = `jeton-ui-${RUN}`
        await sql(`UPDATE client_users SET verify_token_hash = $1, verify_expires = NOW() + interval '10 minutes' WHERE lower(email) = $2`,
            [crypto.createHash('sha256').update(jeton).digest('hex'), MAIL])
        await page.goto(`/portail/confirmer?token=${jeton}`)
        await page.getByLabel('Mot de passe').fill(MDP)
        await page.getByRole('button', { name: 'Confirmer et enregistrer' }).click()
        await expect(page.getByText(/adresse confirmée/i)).toBeVisible()
        await page.goto('/portail')
        await page.getByLabel('Adresse e-mail').fill(MAIL)
        await page.getByLabel('Mot de passe').fill(MDP)
        await page.getByRole('button', { name: 'Se connecter' }).click()
        await expect(page.getByText(/en attente de validation/i)).toBeVisible()
        await ctx.close()
    })

    test('l\'équipe valide la demande (client suggéré d\'après l\'e-mail)', async ({ page }) => {
        await page.goto('/portail-admin')
        const ligne = page.locator('tr', { hasText: MAIL })
        await expect(ligne).toBeVisible()
        await expect(ligne.getByText(new RegExp(`Adresse confirmée. Elle correspond à la fiche « ${CLIENT}`))).toBeVisible()
        await ligne.getByRole('button', { name: 'Valider' }).click()
        await expect(page.getByText(/accès activé pour/i)).toBeVisible()
    })

    test('le client consulte son dossier et télécharge son document', async ({ browser }) => {
        const ctx = await browser.newContext({ acceptDownloads: true, storageState: { cookies: [], origins: [] } })
        const page = await ctx.newPage()
        await page.goto('/portail')
        await page.getByLabel('Adresse e-mail').fill(MAIL)
        await page.getByLabel('Mot de passe').fill(MDP)
        await page.getByRole('button', { name: 'Se connecter' }).click()
        await page.waitForURL('**/portail/dossiers')

        await expect(page.getByText(`Espace client · ${CLIENT}`)).toBeVisible()
        await page.getByText(DOSSIER).click()
        await expect(page.getByRole('heading', { name: DOSSIER })).toBeVisible()
        await expect(page.getByText(`E2E Bordereau UI ${RUN}`)).toBeVisible()
        await expect(page.getByText('Arrivée prévue', { exact: true })).toBeVisible()
        await expect(page.getByText('24/10/2026 à 08:00')).toBeVisible()
        await expect(page.getByText(`BL-UI-${RUN}`)).toBeVisible()

        const [telechargement] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: 'Télécharger', exact: true }).click(),
        ])
        expect(telechargement.suggestedFilename()).toMatch(/^E2E Bordereau UI .*\.txt$/)
        expect(fs.readFileSync(await telechargement.path(), 'utf8')).toBe(CONTENU)

        const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /tout télécharger/i }).click()])
        expect(zip.suggestedFilename()).toMatch(/-documents\.zip$/)

        // la session du portail ne donne aucun accès au personnel
        await page.goto('/dashboard')
        await expect(page).toHaveURL(/\/login/)

        await page.goto('/portail/factures')
        await expect(page.getByText('Total facturé')).toBeVisible()
        await page.getByRole('button', { name: 'Déconnexion' }).click()
        await expect(page).toHaveURL(/\/portail$/)
        await page.goto('/portail/dossiers')
        await expect(page).toHaveURL(/\/portail$/)
        await ctx.close()
    })

    test('nettoyage', async () => {
        const admin = await apiAs('admin')
        const docs = await sql('SELECT d.iddocuments FROM documents d JOIN dossiers x ON x.iddossiers = d.iddossiers WHERE x.libelle = $1', [DOSSIER])
        for (const d of docs) await admin.delete(`documents/${d.iddocuments}`)
        await admin.dispose()
    })
})
