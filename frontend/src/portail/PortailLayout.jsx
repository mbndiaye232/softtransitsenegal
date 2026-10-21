import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import portailApi, { TOKEN_KEY } from './portailApi'
import { MARINE, VERT } from './ui'

// Enveloppe des pages du portail : en-tête, navigation, déconnexion. Sans jeton, retour à la connexion.
export default function PortailLayout({ children }) {
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const [profil, setProfil] = useState(null)
    const connecte = !!localStorage.getItem(TOKEN_KEY)

    useEffect(() => {
        if (connecte) portailApi.get('/auth/me').then((r) => setProfil(r.data)).catch(() => {})
    }, [connecte])

    if (!connecte) return <Navigate to="/portail" replace />

    const deconnexion = () => {
        localStorage.removeItem(TOKEN_KEY)
        navigate('/portail')
    }
    const lien = (to, texte) => {
        const actif = pathname.startsWith(to)
        return (
            <Link to={to} style={{ color: '#fff', textDecoration: 'none', padding: '0.5rem 0.9rem', borderRadius: 8, fontWeight: 600, background: actif ? 'rgba(255,255,255,0.18)' : 'transparent' }}>
                {texte}
            </Link>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <header style={{ background: MARINE, color: '#fff', borderBottom: `4px solid ${VERT}` }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>Espace client{profil?.client ? ` · ${profil.client}` : ''}</div>
                    <nav style={{ display: 'flex', gap: '0.4rem', flex: 1 }}>
                        {lien('/portail/dossiers', 'Mes dossiers')}
                        {lien('/portail/factures', 'Mes factures')}
                    </nav>
                    <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>{profil?.nom}</span>
                    <button onClick={deconnexion} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: 8, padding: '0.4rem 0.9rem', cursor: 'pointer' }}>
                        Déconnexion
                    </button>
                </div>
            </header>
            <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>{children}</main>
        </div>
    )
}
