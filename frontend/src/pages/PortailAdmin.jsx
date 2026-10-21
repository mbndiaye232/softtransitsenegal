import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

// Administration du portail client (option) : demandes d'accès, comptes, documents visibles, journal.
const MARINE = '#1B3464', BLEU = '#2D5A9E', VERT = '#059669'
const carte = { background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(27,52,100,0.08)', padding: '1.25rem', marginBottom: '1.25rem' }
const th = { textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }
const td = { padding: '0.65rem 0.75rem', borderBottom: '1px solid #eef2f7', fontSize: '0.9rem', verticalAlign: 'top' }
const btn = (c = BLEU) => ({ background: c, color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 0.9rem', fontWeight: 600, cursor: 'pointer', marginRight: 6 })
const fmt = (v) => (v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const ACTIONS = { CONNEXION: 'Connexion', TELECHARGE_DOCUMENT: 'Document téléchargé', TELECHARGE_ZIP: 'Dossier téléchargé (ZIP)', TELECHARGE_FACTURE: 'Facture téléchargée' }

export default function PortailAdmin() {
    const navigate = useNavigate()
    const [onglet, setOnglet] = useState('demandes')
    const [comptes, setComptes] = useState([])
    const [clients, setClients] = useState([])
    const [types, setTypes] = useState([])
    const [journal, setJournal] = useState([])
    const [choix, setChoix] = useState({}) // id du compte -> id du client choisi
    const [message, setMessage] = useState(null)

    const erreur = (e) => setMessage({ type: 'err', texte: e.response?.data?.error || 'Une erreur est survenue.' })
    const charger = () => {
        api.get('/portail-admin/comptes').then((r) => setComptes(r.data)).catch(erreur)
        api.get('/portail-admin/types-documents').then((r) => setTypes(r.data)).catch(erreur)
        api.get('/portail-admin/journal').then((r) => setJournal(r.data)).catch(erreur)
    }
    useEffect(() => {
        charger()
        api.get('/clients').then((r) => setClients(r.data)).catch(() => {})
    }, [])

    const agir = async (requete, ok) => {
        try {
            const r = await requete()
            setMessage({ type: 'ok', texte: r.data?.message || ok })
            charger()
        } catch (e) { erreur(e) }
    }
    const valider = (c) => {
        const id = choix[c.id] || c.client_suggere_id
        if (!id) return setMessage({ type: 'err', texte: 'Choisissez d\'abord le client à rattacher.' })
        agir(() => api.post(`/portail-admin/comptes/${c.id}/valider`, { idclients: Number(id) }))
    }

    const demandes = comptes.filter((c) => c.statut === 'EN_ATTENTE')
    const autres = comptes.filter((c) => c.statut !== 'EN_ATTENTE')
    const onglets = [['demandes', `Demandes (${demandes.length})`], ['comptes', 'Comptes'], ['documents', 'Documents visibles'], ['journal', 'Journal']]

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '1.5rem', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                <button onClick={() => navigate('/dashboard')} style={{ ...btn('#64748b'), marginBottom: '1rem' }}>← Tableau de bord</button>
                <h1 style={{ margin: '0 0 0.25rem', color: MARINE }}>Portail client</h1>
                <p style={{ color: '#64748b', marginTop: 0 }}>Adresse du portail : <strong>{window.location.origin}/portail</strong></p>
                {message && (
                    <div style={{ padding: '0.75rem 1rem', borderRadius: 8, margin: '0.75rem 0', background: message.type === 'ok' ? '#ecfdf5' : '#fef2f2', color: message.type === 'ok' ? '#065f46' : '#991b1b' }}>
                        {message.texte}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {onglets.map(([id, texte]) => (
                        <button key={id} onClick={() => setOnglet(id)} style={{ ...btn(onglet === id ? MARINE : '#94a3b8'), padding: '0.55rem 1.1rem' }}>{texte}</button>
                    ))}
                </div>

                {onglet === 'demandes' && (
                    <div style={carte}>
                        {demandes.length === 0 ? <p style={{ color: '#64748b' }}>Aucune demande en attente.</p> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr>{['Demandeur', 'Société déclarée', 'Reçue le', 'Client à rattacher', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {demandes.map((c) => (
                                        <tr key={c.id}>
                                            <td style={td}><strong>{c.nom}</strong><div style={{ color: '#64748b' }}>{c.email}</div><div style={{ color: '#64748b' }}>{c.telephone}</div></td>
                                            <td style={td}>{c.societe_declaree}</td>
                                            <td style={td}>{fmt(c.created_at)}</td>
                                            <td style={td}>
                                                <select disabled={!c.email_confirme} value={choix[c.id] ?? c.client_suggere_id ?? ''} onChange={(e) => setChoix((p) => ({ ...p, [c.id]: e.target.value }))}
                                                    style={{ padding: '0.45rem', borderRadius: 8, border: '1px solid #cbd5e1', maxWidth: 240 }}>
                                                    <option value="">— Choisir un client —</option>
                                                    {clients.map((cl) => <option key={cl.IDCLIENTS} value={cl.IDCLIENTS}>{cl.NomRS}</option>)}
                                                </select>
                                                {!c.email_confirme
                                                    ? <div style={{ color: '#b45309', fontSize: '0.8rem', marginTop: 4 }}>Adresse e-mail non confirmée : le demandeur n'a pas encore cliqué sur le lien reçu.</div>
                                                    : c.client_suggere
                                                        ? <div style={{ color: VERT, fontSize: '0.8rem', marginTop: 4 }}>Adresse confirmée. Elle correspond à la fiche « {c.client_suggere} ».</div>
                                                        : <div style={{ color: '#b45309', fontSize: '0.8rem', marginTop: 4 }}>Adresse confirmée, mais elle ne correspond à aucune fiche client : vérifiez l'identité du demandeur.</div>}
                                            </td>
                                            <td style={td}>
                                                <button style={{ ...btn(VERT), opacity: c.email_confirme ? 1 : 0.45, cursor: c.email_confirme ? 'pointer' : 'not-allowed' }}
                                                    disabled={!c.email_confirme} onClick={() => valider(c)}>Valider</button>
                                                {!c.email_confirme && <button style={btn('#64748b')} onClick={() => agir(() => api.post(`/portail-admin/comptes/${c.id}/renvoyer-confirmation`))}>Renvoyer l'e-mail</button>}
                                                <button style={btn('#dc2626')} onClick={() => agir(() => api.post(`/portail-admin/comptes/${c.id}/refuser`))}>Refuser</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {onglet === 'comptes' && (
                    <div style={carte}>
                        {autres.length === 0 ? <p style={{ color: '#64748b' }}>Aucun compte.</p> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr>{['Utilisateur', 'Client', 'État', 'Dernière connexion', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {autres.map((c) => (
                                        <tr key={c.id}>
                                            <td style={td}><strong>{c.nom}</strong><div style={{ color: '#64748b' }}>{c.email}</div></td>
                                            <td style={td}>{c.client || '—'}</td>
                                            <td style={td}>{{ ACTIF: 'Actif', SUSPENDU: 'Suspendu', REFUSE: 'Refusé' }[c.statut]}</td>
                                            <td style={td}>{fmt(c.last_login)}</td>
                                            <td style={td}>
                                                {c.statut === 'ACTIF' && <button style={btn('#d97706')} onClick={() => agir(() => api.post(`/portail-admin/comptes/${c.id}/suspendre`))}>Suspendre</button>}
                                                {c.statut === 'SUSPENDU' && c.idclients && <button style={btn(VERT)} onClick={() => agir(() => api.post(`/portail-admin/comptes/${c.id}/valider`, { idclients: c.idclients }))}>Réactiver</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {onglet === 'documents' && (
                    <div style={carte}>
                        <p style={{ marginTop: 0, color: '#475569' }}>
                            Par défaut, un client voit tous les documents de ses dossiers. Décochez un type pour le cacher aux clients
                            (il n'apparaît plus et ne peut plus être téléchargé).
                        </p>
                        {types.map((t) => (
                            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0', borderBottom: '1px solid #eef2f7', cursor: 'pointer' }}>
                                <input type="checkbox" checked={t.visible}
                                    onChange={(e) => agir(() => api.put(`/portail-admin/types-documents/${t.id}`, { visible: e.target.checked }), 'Réglage enregistré.')} />
                                {t.libelle}
                            </label>
                        ))}
                    </div>
                )}

                {onglet === 'journal' && (
                    <div style={carte}>
                        {journal.length === 0 ? <p style={{ color: '#64748b' }}>Aucune activité pour le moment.</p> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr>{['Date', 'Utilisateur', 'Client', 'Action', 'Référence'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {journal.map((j) => (
                                        <tr key={j.id}>
                                            <td style={td}>{fmt(j.created_at)}</td><td style={td}>{j.nom}</td><td style={td}>{j.client || '—'}</td>
                                            <td style={td}>{ACTIONS[j.action] || j.action}</td><td style={td}>{j.reference || ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
