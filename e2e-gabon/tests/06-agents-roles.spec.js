import { test, expect } from '@playwright/test'
import { RUN, apiAs, agentId } from './helpers'

const AGENT_LOGIN = `e2e_agent_${RUN.toLowerCase()}`
const NOUVEAU = (login, role) => ({
    NomAgent: `E2E Agent ${login}`, Email: `${login}@e2e.test`, Login: login, password: 'Aa1-E2e-Fictif-2026', role,
})

test.describe('Agents : création par l\'interface (admin)', () => {
    test.use({ storageState: '.auth/admin.json' })

    test('le formulaire ne propose pas le rôle Super administrateur', async ({ page }) => {
        await page.goto('/users/new')
        const options = await page.locator('select[name="role"] option').allInnerTexts()
        expect(options.join(' ')).not.toMatch(/super/i)
        expect(options.length).toBe(2)
    })

    test('création d\'un agent fictif puis recherche dans la liste', async ({ page }) => {
        await page.goto('/users/new')
        await page.fill('input[name="NomAgent"]', `E2E Agent Fictif ${RUN}`)
        await page.fill('input[name="Email"]', `${AGENT_LOGIN}@e2e.test`)
        await page.fill('input[name="Login"]', AGENT_LOGIN)
        await page.fill('input[name="password"]', 'Aa1-E2e-Fictif-2026')
        await page.getByRole('button', { name: /créer l'agent/i }).click()
        await page.waitForURL('**/users')
        await page.getByPlaceholder(/rechercher par nom/i).fill(AGENT_LOGIN)
        await expect(page.getByText(`E2E Agent Fictif ${RUN}`).first()).toBeVisible()
    })

    test('un mot de passe faible est refusé', async ({ page }) => {
        await page.goto('/users/new')
        await page.fill('input[name="NomAgent"]', 'E2E Faible')
        await page.fill('input[name="Email"]', 'faible@e2e.test')
        await page.fill('input[name="Login"]', `e2e_faible_${RUN.toLowerCase()}`)
        await page.fill('input[name="password"]', 'abc')
        await page.getByRole('button', { name: /créer l'agent/i }).click()
        await expect(page).toHaveURL(/\/users\/new/)
    })
})

test.describe('Rôles : un administrateur ne peut pas s\'élever ni toucher au super administrateur', () => {
    test('contrôles API en tant qu\'ADMIN', async () => {
        const api = await apiAs('admin')
        const superId = await agentId('mbndiaye')
        const adminId = await agentId('e2e_admin')

        const superAdmin = await api.post('users', { data: NOUVEAU(`e2e_sa_${RUN.toLowerCase()}`, 'SUPER_ADMIN') })
        expect(superAdmin.status()).toBe(403)

        const inconnu = await api.post('users', { data: NOUVEAU(`e2e_x_${RUN.toLowerCase()}`, 'HACKER') })
        expect(inconnu.status()).toBe(400)

        const sonRole = await api.put(`users/${adminId}`, {
            data: { NomAgent: 'E2E Administrateur', Email: 'e2e_admin@e2e.test', Login: 'e2e_admin', role: 'USER' },
        })
        expect(sonRole.status()).toBe(403)

        const modifSuper = await api.put(`users/${superId}`, {
            data: { NomAgent: 'x', Email: 'x@e2e.test', Login: 'x', role: 'SUPER_ADMIN' },
        })
        expect(modifSuper.status()).toBe(403)
        expect((await api.put(`users/${superId}/permissions`, { data: { permissions: [] } })).status()).toBe(403)
        expect((await api.delete(`users/${superId}`)).status()).toBe(403)
        expect((await api.put(`users/${superId}/super-admin`, { data: { grant: false } })).status()).toBe(403)
        await api.dispose()
    })
})

test.describe('Délégation de droits (gestionnaire sans rôle administrateur)', () => {
    test('le gestionnaire ne peut ni créer un administrateur, ni toucher à un administrateur', async () => {
        const api = await apiAs('manager')
        const adminId = await agentId('e2e_admin')

        const creerAdmin = await api.post('users', { data: NOUVEAU(`e2e_adm_${RUN.toLowerCase()}`, 'ADMIN') })
        expect(creerAdmin.status()).toBe(403)

        const modifAdmin = await api.put(`users/${adminId}`, {
            data: { NomAgent: 'Piraté', Email: 'pirate@e2e.test', Login: 'e2e_admin', password: 'Aa1-Pirate-2026', role: 'ADMIN' },
        })
        expect(modifAdmin.status()).toBe(403)
        expect((await api.delete(`users/${adminId}`)).status()).toBe(403)
        await api.dispose()
    })

    test('le gestionnaire ne peut pas modifier ses propres permissions ni son rôle', async () => {
        const api = await apiAs('manager')
        const moi = await agentId('e2e_manager')
        const catalogue = await (await api.get('users/permissions/list')).json()
        const factures = catalogue.find(p => p.code === 'FACTURES')

        const soi = await api.put(`users/${moi}/permissions`, {
            data: { permissions: [{ permission_id: factures.id, can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 }] },
        })
        expect(soi.status()).toBe(403)

        const role = await api.put(`users/${moi}`, {
            data: { NomAgent: 'E2E Gestionnaire', Email: 'e2e_manager@e2e.test', Login: 'e2e_manager', role: 'ADMIN' },
        })
        expect(role.status()).toBe(403)
        await api.dispose()
    })

    test('il ne peut accorder à un collaborateur que les droits qu\'il détient', async () => {
        const api = await apiAs('manager')
        const cible = await agentId('e2e_user')
        const catalogue = await (await api.get('users/permissions/list')).json()
        const idDe = (code) => catalogue.find(p => p.code === code).id

        // « Factures » : droit que le gestionnaire n'a pas → refusé
        const refuse = await api.put(`users/${cible}/permissions`, {
            data: { permissions: [{ permission_id: idDe('FACTURES'), can_view: 1 }] },
        })
        expect(refuse.status()).toBe(403)

        // « Cotations » en lecture : droit détenu → accepté, puis retiré
        const accorde = await api.put(`users/${cible}/permissions`, {
            data: { permissions: [{ permission_id: idDe('COTATIONS'), can_view: 1 }] },
        })
        expect(accorde.status()).toBe(200)
        const apres = (await (await api.get(`users/${cible}/permissions`)).json()).find(p => p.code === 'COTATIONS')
        expect(apres.can_view).toBe(1)
        expect(apres.can_edit).toBeFalsy()

        const retire = await api.put(`users/${cible}/permissions`, {
            data: { permissions: [{ permission_id: idDe('COTATIONS') }] },
        })
        expect(retire.status()).toBe(200)
        await api.dispose()
    })
})
