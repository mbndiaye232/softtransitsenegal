import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import portailApi, { messageErreur } from './portailApi'
import { MARINE, VERT, alerte, argent, carte, champ, date, td, th } from './ui'

const NATURES = { IMP: 'Import', EXP: 'Export' }
const MODES = { MA: 'Maritime', AE: 'Aérien', RO: 'Routier' }

// Liste des dossiers du client, avec son résumé financier
export default function PortailDossiers() {
    const navigate = useNavigate()
    const [dossiers, setDossiers] = useState(null)
    const [resume, setResume] = useState(null)
    const [recherche, setRecherche] = useState('')
    const [erreur, setErreur] = useState(null)

    useEffect(() => {
        Promise.all([portailApi.get('/dossiers'), portailApi.get('/resume')])
            .then(([d, r]) => { setDossiers(d.data); setResume(r.data) })
            .catch((e) => setErreur(messageErreur(e)))
    }, [])

    const visibles = (dossiers || []).filter((d) =>
        `${d.code} ${d.libelle} ${d.etape || ''}`.toLowerCase().includes(recherche.trim().toLowerCase()))

    const tuile = (valeur, texte, couleur) => (
        <div style={{ ...carte, marginBottom: 0, flex: '1 1 200px', borderTop: `4px solid ${couleur}` }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: MARINE }}>{valeur}</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{texte}</div>
        </div>
    )

    return (
        <>
            {erreur && <div style={alerte('err')}>{erreur}</div>}
            {resume && (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    {tuile(resume.dossiers, 'Dossiers', '#2D5A9E')}
                    {tuile(argent(resume.facture), 'Total facturé', '#64748b')}
                    {tuile(argent(resume.reliquat), 'Reste à payer', Number(resume.reliquat) > 0 ? '#d97706' : VERT)}
                </div>
            )}
            <div style={carte}>
                <input style={{ ...champ, maxWidth: 360, marginBottom: '1rem' }} placeholder="Rechercher un dossier…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
                {dossiers === null && !erreur && <p>Chargement…</p>}
                {dossiers && !visibles.length && <p style={{ color: '#64748b' }}>Aucun dossier à afficher.</p>}
                {visibles.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>{['Dossier', 'Libellé', 'Type', 'Étape', 'Arrivée prévue', 'Documents', 'Reste à payer'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {visibles.map((d) => (
                                    <tr key={d.id} onClick={() => navigate(`/portail/dossiers/${d.id}`)} style={{ cursor: 'pointer' }}>
                                        <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600, color: MARINE }}>{d.code}</td>
                                        <td style={td}>{d.libelle}<div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Ouvert le {date(d.date_ouverture)}</div></td>
                                        <td style={td}>{NATURES[d.nature] || d.nature} · {MODES[d.mode] || d.mode}</td>
                                        <td style={td}>{d.etape || '—'}</td>
                                        <td style={td}>{date(d.arrivee_prevue)}</td>
                                        <td style={td}>{d.nb_documents}</td>
                                        <td style={{ ...td, fontWeight: 600, color: Number(d.reliquat) > 0 ? '#b45309' : '#065f46' }}>{argent(d.reliquat)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    )
}
