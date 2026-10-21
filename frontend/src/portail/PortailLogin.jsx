import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import portailApi, { TOKEN_KEY, messageErreur } from './portailApi'
import { MARINE, VERT, alerte, bouton, carte, champ, etiquette } from './ui'

// Connexion, demande d'accès (validée ensuite par l'équipe) et mot de passe oublié
export default function PortailLogin() {
    const navigate = useNavigate()
    const [mode, setMode] = useState('connexion') // connexion | inscription | oubli
    const [f, setF] = useState({ nom: '', societe: '', telephone: '', email: '', password: '' })
    const [retour, setRetour] = useState(null)
    const [envoi, setEnvoi] = useState(false)

    if (localStorage.getItem(TOKEN_KEY)) return <Navigate to="/portail/dossiers" replace />

    const maj = (e) => setF((p) => ({ ...p, [e.target.name]: e.target.value }))
    const changer = (m) => { setMode(m); setRetour(null) }

    const valider = async (e) => {
        e.preventDefault()
        setEnvoi(true)
        setRetour(null)
        try {
            if (mode === 'connexion') {
                const r = await portailApi.post('/auth/login', { email: f.email, password: f.password })
                localStorage.setItem(TOKEN_KEY, r.data.token)
                navigate('/portail/dossiers')
            } else if (mode === 'inscription') {
                const r = await portailApi.post('/auth/register', f)
                setRetour({ type: 'ok', texte: r.data.message })
                setMode('connexion')
                setF((p) => ({ ...p, password: '' }))
            } else {
                const r = await portailApi.post('/auth/forgot-password', { email: f.email })
                setRetour({ type: 'ok', texte: r.data.message })
            }
        } catch (error) {
            setRetour({ type: 'err', texte: messageErreur(error) })
        } finally {
            setEnvoi(false)
        }
    }

    const onglet = (m, texte) => (
        <button type="button" onClick={() => changer(m)} style={{
            flex: 1, padding: '0.7rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
            color: mode === m ? MARINE : '#94a3b8', borderBottom: `3px solid ${mode === m ? VERT : 'transparent'}`,
        }}>{texte}</button>
    )

    return (
        <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${MARINE}, #2D5A9E)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <div style={{ ...carte, width: '100%', maxWidth: 440, padding: '1.75rem', marginBottom: 0 }}>
                <h1 style={{ margin: '0 0 0.25rem', color: MARINE, fontSize: '1.5rem' }}>Espace client</h1>
                <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.9rem' }}>Suivez vos dossiers et retrouvez vos documents et factures.</p>
                <div style={{ display: 'flex', marginBottom: '0.5rem' }}>
                    {onglet('connexion', 'Connexion')}
                    {onglet('inscription', 'Demander un accès')}
                </div>

                {retour && <div style={alerte(retour.type)}>{retour.texte}</div>}

                <form onSubmit={valider}>
                    {mode === 'inscription' && (
                        <>
                            <label style={etiquette} htmlFor="portail-nom">Votre nom</label>
                            <input style={champ} name="nom" id="portail-nom" value={f.nom} onChange={maj} required />
                            <label style={etiquette} htmlFor="portail-societe">Votre société</label>
                            <input style={champ} name="societe" id="portail-societe" value={f.societe} onChange={maj} required />
                            <label style={etiquette} htmlFor="portail-telephone">Téléphone (facultatif)</label>
                            <input style={champ} name="telephone" id="portail-telephone" value={f.telephone} onChange={maj} />
                        </>
                    )}
                    <label style={etiquette} htmlFor="portail-email">Adresse e-mail</label>
                    <input style={champ} type="email" name="email" id="portail-email" value={f.email} onChange={maj} required autoComplete="username" />
                    {mode === 'connexion' && (
                        <>
                            <label style={etiquette} htmlFor="portail-password">Mot de passe</label>
                            <input style={champ} type="password" name="password" id="portail-password" value={f.password} onChange={maj} required
                                autoComplete="current-password" />
                        </>
                    )}
                    <button type="submit" disabled={envoi} style={{ ...bouton, width: '100%', marginTop: '1.25rem', padding: '0.8rem', opacity: envoi ? 0.7 : 1 }}>
                        {mode === 'connexion' ? 'Se connecter' : mode === 'inscription' ? 'Envoyer ma demande' : 'Envoyer le lien'}
                    </button>
                </form>
                {mode === 'inscription' && <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Vous recevrez un e-mail pour confirmer votre adresse et choisir votre mot de passe. Votre demande est ensuite examinée par notre équipe avant l'ouverture de l'accès.</p>}
                {mode === 'connexion' && (
                    <button type="button" onClick={() => changer('oubli')} style={{ background: 'none', border: 'none', color: '#2D5A9E', cursor: 'pointer', marginTop: '0.75rem', padding: 0 }}>
                        Mot de passe oublié ?
                    </button>
                )}
                {mode === 'oubli' && (
                    <button type="button" onClick={() => changer('connexion')} style={{ background: 'none', border: 'none', color: '#2D5A9E', cursor: 'pointer', marginTop: '0.75rem', padding: 0 }}>
                        Retour à la connexion
                    </button>
                )}
            </div>
        </div>
    )
}
