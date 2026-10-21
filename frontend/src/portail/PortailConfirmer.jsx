import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import portailApi, { messageErreur } from './portailApi'
import { MARINE, alerte, bouton, carte, champ, etiquette } from './ui'

// Page ouverte depuis le lien reçu par e-mail : le titulaire de l'adresse confirme son e-mail ET choisit son mot de passe.
// Le mot de passe n'est jamais demandé à l'inscription : un tiers qui saisirait l'adresse d'autrui ne peut pas en imposer un.
export default function PortailConfirmer() {
    const [params] = useSearchParams()
    const [mdp, setMdp] = useState('')
    const [retour, setRetour] = useState(null)

    const valider = async (e) => {
        e.preventDefault()
        try {
            const r = await portailApi.post('/auth/verify-email', { token: params.get('token'), password: mdp })
            setRetour({ type: 'ok', texte: r.data.message })
        } catch (error) {
            setRetour({ type: 'err', texte: messageErreur(error) })
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <div style={{ ...carte, width: '100%', maxWidth: 440 }}>
                <h1 style={{ margin: 0, color: MARINE, fontSize: '1.3rem' }}>Confirmer mon adresse e-mail</h1>
                {retour && <div style={alerte(retour.type)}>{retour.texte}</div>}
                {retour?.type === 'ok' ? (
                    <Link to="/portail" style={{ ...bouton, display: 'inline-block', textDecoration: 'none', marginTop: 8 }}>Espace client</Link>
                ) : (
                    <form onSubmit={valider}>
                        <p style={{ color: '#475569', fontSize: '0.9rem' }}>Choisissez votre mot de passe pour terminer la confirmation de votre adresse.</p>
                        <label style={etiquette} htmlFor="portail-mdp">Mot de passe</label>
                        <input id="portail-mdp" style={champ} type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required autoComplete="new-password" />
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>8 caractères minimum, avec une majuscule, une minuscule et un chiffre.</div>
                        <button type="submit" style={{ ...bouton, width: '100%', marginTop: '1.25rem' }}>Confirmer et enregistrer</button>
                    </form>
                )}
            </div>
        </div>
    )
}
