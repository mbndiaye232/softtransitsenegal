import { test, expect } from '@playwright/test'
import { openNav } from './helpers'

test.use({ storageState: '.auth/admin.json' })

const PAGES = [
    '/dashboard', '/clients', '/clients/new', '/tiers', '/produits', '/tarifs', '/dossiers', '/dossiers/new',
    '/users', '/users/new', '/groupes', '/statuts', '/company-settings', '/cotations', '/ordres-transit',
    '/config-transit', '/notes', '/parameters-hub', '/etats-financiers', '/reglements', '/suivi-factures',
    '/suivi-dossiers', '/documents', '/decision-dashboard', '/suivi-traitements', '/transport-arrivals',
    '/sommiers', '/entrepots', '/historique-sommiers', '/comptes-mails', '/moyens-transport', '/lieux',
    '/etapes-dossiers', '/pays', '/types-transport', '/rubriques', '/devises', '/types-documents',
    '/statuts-organisations', '/modes-reglement', '/unites-poids', '/unites-volume',
    '/regimes-declaration', '/codes-couleurs', '/backups',
]

test('toutes les pages s\'ouvrent sans erreur JavaScript ni erreur serveur (5xx)', async ({ page }) => {
    test.setTimeout(300_000)
    const problemes = []
    let courante = ''
    page.on('pageerror', e => problemes.push(`${courante} : erreur JS « ${e.message} »`))
    page.on('response', r => { if (r.status() >= 500) problemes.push(`${courante} : HTTP ${r.status()} ${r.url()}`) })

    for (const p of PAGES) {
        courante = p
        await page.goto(p)
        await page.waitForLoadState('networkidle').catch(() => {})
        if (new URL(page.url()).pathname !== p && !['/regime-suspensif'].includes(p)) {
            problemes.push(`${p} : redirigée vers ${new URL(page.url()).pathname}`)
        }
        const texte = (await page.locator('body').innerText()).trim()
        if (texte.length < 40) problemes.push(`${p} : page vide`)
    }
    expect(problemes, problemes.join('\n')).toEqual([])
})

test('le menu flottant ouvre les modules principaux', async ({ page }) => {
    await page.goto('/dashboard')
    await openNav(page)
    await page.getByRole('button', { name: /^Sommiers$/ }).first().click()
    await expect(page).toHaveURL(/\/sommiers/)
    await openNav(page)
    await page.getByRole('button', { name: /^Accueil$/ }).first().click()
    await expect(page).toHaveURL(/\/dashboard/)
})
