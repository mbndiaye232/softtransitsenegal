import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import portailApi, { messageErreur, telecharger } from './portailApi'
import { MARINE, VERT, alerte, argent, boutonClair, boutonVert, carte, date, td, th, titre } from './ui'

// Détail d'un dossier en lecture seule : avancement, documents à télécharger, factures
export default function PortailDossier() {
    const { id } = useParams()
    const [d, setD] = useState(null)
    const [erreur, setErreur] = useState(null)

    useEffect(() => {
        portailApi.get(`/dossiers/${id}`).then((r) => setD(r.data)).catch((e) => setErreur(messageErreur(e, 'Dossier introuvable.')))
    }, [id])

    const telecharge = (chemin, nom) => telecharger(chemin, nom).catch((e) => setErreur(messageErreur(e, 'Le téléchargement a échoué.')))

    if (erreur && !d) return <div style={alerte('err')}>{erreur} <Link to="/portail/dossiers">Retour aux dossiers</Link></div>
    if (!d) return <p>Chargement…</p>

    const bloc = (principal, secondaire, etiquette, accent) => (
        <div style={{ flex: '1 1 220px', padding: '0.75rem 1rem', borderRadius: 10, background: accent ? '#ecfdf5' : '#f8fafc', border: `1px solid ${accent ? '#a7f3d0' : '#e2e8f0'}` }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>{etiquette}</div>
            <div style={{ fontWeight: 700, color: MARINE, margin: '0.2rem 0' }}>{principal}</div>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>{secondaire}</div>
        </div>
    )
    const indexEtape = d.etapes.findIndex((e) => String(e.id) === String(d.etape_id))

    return (
        <>
            <Link to="/portail/dossiers" style={{ color: '#2D5A9E', textDecoration: 'none', fontWeight: 600 }}>← Mes dossiers</Link>
            <div style={{ ...carte, marginTop: '0.75rem' }}>
                <div style={{ fontFamily: 'monospace', color: '#64748b' }}>{d.code}</div>
                <h1 style={{ margin: '0.2rem 0 0.75rem', color: MARINE, fontSize: '1.4rem' }}>{d.libelle}</h1>
                <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Ouvert le {date(d.date_ouverture)}</div>
                {erreur && <div style={alerte('err')}>{erreur}</div>}
                {d.etapes.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '1rem' }}>
                        {d.etapes.map((e, i) => (
                            <span key={e.id} style={{
                                padding: '0.35rem 0.8rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600,
                                background: i === indexEtape ? VERT : i < indexEtape ? '#d1fae5' : '#e2e8f0',
                                color: i === indexEtape ? '#fff' : i < indexEtape ? '#065f46' : '#64748b',
                            }}>{e.libelle}</span>
                        ))}
                    </div>
                )}
            </div>

            {d.transport && (
                <div style={carte}>
                    <h2 style={titre}>{{ MA: 'Navire', AE: 'Vol' }[d.mode] || 'Transport'}</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                        {bloc(d.transport.moyen || '—', [d.transport.compagnie, d.transport.escale && `Escale ${d.transport.escale}`].filter(Boolean).join(' · '), 'Moyen de transport')}
                        {bloc(d.transport.lieu_depart || '—', [d.transport.pays_depart, d.transport.date_depart && `départ le ${date(d.transport.date_depart)}`].filter(Boolean).join(' · '), 'Départ')}
                        {bloc(d.transport.lieu_arrivee || '—', [d.transport.pays_arrivee, d.transport.arrivee_prevue && `le ${date(d.transport.arrivee_prevue)}${d.transport.heure_arrivee ? ` à ${String(d.transport.heure_arrivee).slice(0, 5)}` : ''}`].filter(Boolean).join(' · '), 'Arrivée prévue', true)}
                    </div>
                    {d.transport.titre && <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.85rem' }}>Titre de transport : <strong>{d.transport.titre}</strong></div>}
                </div>
            )}

            <div style={carte}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h2 style={{ ...titre, margin: 0 }}>Documents ({d.documents.length})</h2>
                    {d.documents.length > 0 && (
                        <button style={boutonVert} onClick={() => telecharge(`/dossiers/${d.id}/documents.zip`, `${d.code}-documents.zip`)}>
                            Tout télécharger (ZIP)
                        </button>
                    )}
                </div>
                {d.documents.length === 0 ? <p style={{ color: '#64748b' }}>Aucun document disponible pour le moment.</p> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
                            <thead><tr>{['Document', 'Type', 'Date', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                            <tbody>
                                {d.documents.map((doc) => (
                                    <tr key={doc.id}>
                                        <td style={td}>{doc.libelle}</td>
                                        <td style={td}>{doc.type || '—'}</td>
                                        <td style={td}>{date(doc.date)}</td>
                                        <td style={{ ...td, textAlign: 'right' }}>
                                            <button style={boutonClair} onClick={() => telecharge(`/documents/${doc.id}/download`, doc.libelle)}>Télécharger</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div style={carte}>
                <h2 style={titre}>Factures</h2>
                {d.factures.length === 0 ? <p style={{ color: '#64748b' }}>Aucune facture pour ce dossier.</p> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr>{['Facture', 'Date', 'Échéance', 'Montant', 'Réglé', 'Reste', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                            <tbody>
                                {d.factures.map((f) => (
                                    <tr key={f.id}>
                                        <td style={{ ...td, fontWeight: 600 }}>{f.numero}</td>
                                        <td style={td}>{date(f.date)}</td>
                                        <td style={td}>{date(f.echeance)}</td>
                                        <td style={td}>{argent(f.ttc)}</td>
                                        <td style={td}>{argent(f.regle)}</td>
                                        <td style={{ ...td, fontWeight: 600, color: Number(f.reliquat) > 0 ? '#b45309' : '#065f46' }}>{argent(f.reliquat)}</td>
                                        <td style={{ ...td, textAlign: 'right' }}>
                                            <button style={boutonClair} onClick={() => telecharge(`/factures/${f.id}/pdf`, `Facture-${f.numero}.pdf`)}>PDF</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ textAlign: 'right', marginTop: '0.75rem', fontWeight: 700, color: MARINE }}>Reste à payer : {argent(d.totaux.reliquat)}</div>
                    </div>
                )}
            </div>
        </>
    )
}
