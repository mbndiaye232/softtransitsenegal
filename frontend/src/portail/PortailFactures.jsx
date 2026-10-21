import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import portailApi, { messageErreur, telecharger } from './portailApi'
import { MARINE, VERT, alerte, argent, boutonClair, carte, date, td, th } from './ui'

// Toutes les factures validées du client, avec les soldes
export default function PortailFactures() {
    const [data, setData] = useState(null)
    const [erreur, setErreur] = useState(null)

    useEffect(() => {
        portailApi.get('/factures').then((r) => setData(r.data)).catch((e) => setErreur(messageErreur(e)))
    }, [])

    const tuile = (valeur, texte, couleur) => (
        <div style={{ ...carte, marginBottom: 0, flex: '1 1 200px', borderTop: `4px solid ${couleur}` }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: MARINE }}>{valeur}</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{texte}</div>
        </div>
    )

    return (
        <>
            {erreur && <div style={alerte('err')}>{erreur}</div>}
            {!data && !erreur && <p>Chargement…</p>}
            {data && (
                <>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                        {tuile(argent(data.totaux.facture), 'Total facturé', '#64748b')}
                        {tuile(argent(data.totaux.regle), 'Total réglé', VERT)}
                        {tuile(argent(data.totaux.reliquat), 'Reste à payer', Number(data.totaux.reliquat) > 0 ? '#d97706' : VERT)}
                    </div>
                    <div style={carte}>
                        {data.factures.length === 0 ? <p style={{ color: '#64748b' }}>Aucune facture pour le moment.</p> : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead><tr>{['Facture', 'Dossier', 'Date', 'Échéance', 'Montant', 'Réglé', 'Reste', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {data.factures.map((f) => (
                                            <tr key={f.id}>
                                                <td style={{ ...td, fontWeight: 600 }}>{f.numero}</td>
                                                <td style={td}><Link to={`/portail/dossiers/${f.dossier_id}`} style={{ color: '#2D5A9E' }}>{f.dossier_code}</Link></td>
                                                <td style={td}>{date(f.date)}</td>
                                                <td style={td}>{date(f.echeance)}</td>
                                                <td style={td}>{argent(f.ttc)}</td>
                                                <td style={td}>{argent(f.regle)}</td>
                                                <td style={{ ...td, fontWeight: 600, color: Number(f.reliquat) > 0 ? '#b45309' : '#065f46' }}>{argent(f.reliquat)}</td>
                                                <td style={{ ...td, textAlign: 'right' }}>
                                                    <button style={boutonClair} onClick={() => telecharger(`/factures/${f.id}/pdf`, `Facture-${f.numero}.pdf`).catch((e) => setErreur(messageErreur(e, 'Le téléchargement a échoué.')))}>PDF</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    )
}
