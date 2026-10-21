import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import portailApi, { messageErreur } from './portailApi'
import { MARINE, alerte, bouton, carte, champ, etiquette } from './ui'

// Page ouverte depuis le lien reçu par e-mail
export default function PortailReset() {
    const [params] = useSearchParams()
    const [mdp, setMdp] = useState('')
    const [retour, setRetour] = useState(null)

    const valider = async (e) => {
        e.preventDefault()
        try {
            const r = await portailApi.post('/auth/reset-password', { token: params.get('token'), newPassword: mdp })
            setRetour({ type: 'ok', texte: r.data.message })
        } catch (error) {
            setRetour({ type: 'err', texte: messageErreur(error) })
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <div style={{ ...carte, width: '100%', maxWidth: 420 }}>
                <h1 style={{ margin: 0, color: MARINE, fontSize: '1.3rem' }}>Nouveau mot de passe</h1>
                {retour && <div style={alerte(retour.type)}>{retour.texte}</div>}
                {retour?.type === 'ok' ? (
                    <Link to="/portail" style={{ ...bouton, display: 'inline-block', textDecoration: 'none', marginTop: 8 }}>Se connecter</Link>
                ) : (
                    <form onSubmit={valider}>
                        <label style={etiquette} htmlFor="portail-nouveau">Nouveau mot de passe</label>
                        <input id="portail-nouveau" style={champ} type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required autoComplete="new-password" />
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>8 caractères minimum, avec une majuscule, une minuscule et un chiffre.</div>
                        <button type="submit" style={{ ...bouton, width: '100%', marginTop: '1.25rem' }}>Enregistrer</button>
                    </form>
                )}
            </div>
        </div>
    )
}
