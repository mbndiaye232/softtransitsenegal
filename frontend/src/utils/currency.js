/**
 * Devise de référence de l'application (celle dont le taux vaut toujours 1).
 * Chargée une fois au démarrage (voir AuthContext) depuis GET /api/devises,
 * puis mise à jour immédiatement si l'utilisateur en change depuis la page
 * Devises (voir DevisesPage.jsx). Permet à tout composant d'afficher le bon
 * suffixe monétaire sans jamais écrire le symbole en dur dans le code.
 */
import { fmt } from './format'

let refSymbol = 'F XAF' // repli avant le premier chargement

export function setReferenceCurrency(devises = []) {
    const ref = devises.find(d => d.est_reference)
    if (ref?.Symbole) refSymbol = ref.Symbole
}

export function getReferenceSymbol() {
    return refSymbol
}

/** Formate un montant suivi du symbole de la devise de référence courante. */
export function fmtRef(n, decimals = 0) {
    return `${fmt(n, decimals)} ${refSymbol}`
}
