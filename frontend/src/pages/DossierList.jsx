import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { dossiersAPI } from '../services/api'
import {
    FileText, Plus, Search, Edit2, Trash2, ChevronRight,
    Ship, Plane, Truck, X, FolderOpen, ReceiptText, Clock, CheckCircle2
} from 'lucide-react'

/* ─── Helpers mode transport ─────────────────────────────────────────────── */
const MODE_CONFIG = {
    MA: { label: 'Maritime', icon: <Ship size={14} />,   bg: '#eff6ff', color: '#1d4ed8' },
    AE: { label: 'Aérien',   icon: <Plane size={14} />,  bg: '#fdf4ff', color: '#7c3aed' },
    TE: { label: 'Routier',  icon: <Truck size={14} />,  bg: '#fff7ed', color: '#c2410c' },
}
const modeConf = (m) => MODE_CONFIG[m] || { label: m || '—', icon: <FileText size={14} />, bg: '#f3f4f6', color: '#6b7280' }

/* ─── StatPill ───────────────────────────────────────────────────────────── */
const StatPill = ({ icon, label, value, color, onClick, active }) => (
    <div
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: active ? color + '12' : 'white',
            border: `1px solid ${active ? color : '#e5e7eb'}`,
            borderRadius: '12px', padding: '12px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,.06)', minWidth: 'fit-content',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'all .15s',
        }}
    >
        <span style={{ color, display: 'flex' }}>{icon}</span>
        <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: '2px' }}>{label}</div>
        </div>
    </div>
)

const FilterChip = ({ label, active, onClick, count }) => (
    <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 14px', borderRadius: '99px', border: 'none', cursor: 'pointer',
        fontSize: '13px', fontWeight: 600, transition: 'all .15s',
        background: active ? '#111827' : '#f3f4f6',
        color: active ? 'white' : '#6b7280',
    }}>
        {label}
        {count !== undefined && (
            <span style={{
                fontSize: '11px', fontWeight: 700,
                background: active ? 'rgba(255,255,255,.25)' : '#e5e7eb',
                color: active ? 'white' : '#9ca3af',
                borderRadius: '99px', padding: '1px 6px',
            }}>{count}</span>
        )}
    </button>
)

/* ─── Page principale ────────────────────────────────────────────────────── */
export default function DossierList() {
    const navigate = useNavigate()
    const [dossiers, setDossiers] = useState([])
    const [loading, setLoading]   = useState(true)
    const [error, setError]       = useState(null)
    const [searchTerm, setSearchTerm]   = useState('')
    const [filterBilled, setFilterBilled] = useState('all')
    const [filterMode, setFilterMode]   = useState('all')
    const [hoveredRow, setHoveredRow]   = useState(null)

    useEffect(() => { fetchDossiers() }, [])

    const fetchDossiers = async () => {
        try {
            setLoading(true)
            const r = await dossiersAPI.getAll()
            setDossiers(r.data)
            setError(null)
        } catch {
            setError('Impossible de charger les dossiers.')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (e, id) => {
        e.stopPropagation()
        if (window.confirm('Supprimer ce dossier ?')) {
            try { await dossiersAPI.delete(id); setDossiers(d => d.filter(x => x.id !== id)) }
            catch { alert('Erreur lors de la suppression') }
        }
    }

    const counts = useMemo(() => ({
        all:      dossiers.length,
        enCours:  dossiers.filter(d => d.status !== 'CLOSED').length,
        factures: dossiers.filter(d => d.isBilled).length,
        nonFact:  dossiers.filter(d => !d.isBilled).length,
    }), [dossiers])

    const filteredDossiers = useMemo(() => {
        const s = searchTerm.toLowerCase()
        return dossiers
            .filter(d => filterBilled === 'all' || (filterBilled === 'billed' ? d.isBilled : !d.isBilled))
            .filter(d => filterMode === 'all' || d.mode === filterMode)
            .filter(d => !s || d.code?.toLowerCase().includes(s) || d.label?.toLowerCase().includes(s) || d.clientName?.toLowerCase().includes(s))
    }, [dossiers, searchTerm, filterBilled, filterMode])

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

            {/* ── HERO HEADER ── */}
            <div style={{
                background: 'linear-gradient(135deg, #78350f 0%, #b45309 45%, #f59e0b 100%)',
                padding: '2.5rem 2.5rem 4rem',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
                <div style={{ position: 'absolute', bottom: '-60px', right: '15%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />
                <div style={{ position: 'absolute', top: '20px', left: '40%', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />

                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FolderOpen size={22} color="white" />
                            </div>
                            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-.03em' }}>
                                Gestion des Dossiers
                            </h1>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '14px', margin: 0, marginLeft: '56px' }}>
                            Visualisez et gérez l'ensemble de vos opérations de transit
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/dossiers/new')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 22px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: 'white', color: '#b45309', fontSize: '14px', fontWeight: 700,
                            boxShadow: '0 4px 16px rgba(0,0,0,.2)', transition: 'all .2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.2)' }}
                    >
                        <Plus size={18} /> Nouveau Dossier
                    </button>
                </div>
            </div>

            {/* ── CONTENU ── */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2.5rem 3rem', marginTop: '-2rem' }}>

                {/* Card flottante stats + recherche */}
                <div style={{
                    background: 'white', borderRadius: '20px', border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 32px rgba(0,0,0,.08)', padding: '20px 24px', marginBottom: '28px',
                    display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                }}>
                    <StatPill icon={<FolderOpen size={20} />} label="Total" value={counts.all} color="#f59e0b"
                        active={filterBilled === 'all'} onClick={() => setFilterBilled('all')} />
                    <StatPill icon={<Clock size={20} />} label="En cours" value={counts.enCours} color="#2563eb"
                        active={false} />
                    <StatPill icon={<ReceiptText size={20} />} label="Facturés" value={counts.factures} color="#16a34a"
                        active={filterBilled === 'billed'} onClick={() => setFilterBilled('billed')} />
                    <StatPill icon={<CheckCircle2 size={20} />} label="Non facturés" value={counts.nonFact} color="#ea580c"
                        active={filterBilled === 'unbilled'} onClick={() => setFilterBilled('unbilled')} />

                    <div style={{ width: '1px', height: '40px', background: '#f3f4f6', flexShrink: 0 }} />

                    {/* Recherche */}
                    <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#d1d5db' }} />
                        <input
                            type="text" placeholder="Rechercher code, libellé, client..."
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 36px 10px 38px', border: '1.5px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#f9fafb', transition: 'border-color .15s' }}
                            onFocus={e => e.target.style.borderColor='#f59e0b'}
                            onBlur={e => e.target.style.borderColor='#e5e7eb'}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filtres mode transport */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <FilterChip label="Tous modes" active={filterMode === 'all'} onClick={() => setFilterMode('all')} count={dossiers.length} />
                    {Object.entries(MODE_CONFIG).map(([k, v]) => (
                        <FilterChip key={k} label={v.label} active={filterMode === k}
                            onClick={() => setFilterMode(filterMode === k ? 'all' : k)}
                            count={dossiers.filter(d => d.mode === k).length} />
                    ))}
                    {filteredDossiers.length !== dossiers.length && (
                        <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#9ca3af', fontWeight: 600 }}>
                            {filteredDossiers.length} résultat{filteredDossiers.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {error && (
                    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '12px 18px', color: '#be123c', fontWeight: 600, marginBottom: '20px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                {/* Table */}
                <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,.06)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                                {['Identifiant', 'Détails du dossier', 'Client', 'Mode', 'État', 'Actions'].map((h, i) => (
                                    <th key={h} style={{
                                        padding: '14px 20px', textAlign: i === 5 ? 'right' : 'left',
                                        fontSize: '11px', fontWeight: 700, color: '#94a3b8',
                                        textTransform: 'uppercase', letterSpacing: '.06em',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDossiers.length > 0 ? filteredDossiers.map(dossier => {
                                const mc  = modeConf(dossier.mode)
                                const isH = hoveredRow === dossier.id

                                return (
                                    <tr
                                        key={dossier.id}
                                        onClick={() => navigate(`/dossiers/${dossier.id}`)}
                                        onMouseEnter={() => setHoveredRow(dossier.id)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                        style={{ borderBottom: '1px solid #f1f5f9', background: isH ? '#fffbeb' : 'white', cursor: 'pointer', transition: 'background .15s' }}
                                    >
                                        {/* Code */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{
                                                fontFamily: 'monospace', fontWeight: 700, fontSize: '12px',
                                                color: isH ? '#b45309' : '#4f46e5',
                                                background: isH ? '#fef3c7' : '#eff6ff',
                                                padding: '4px 10px', borderRadius: '7px',
                                                border: `1px solid ${isH ? '#fde68a' : '#dbeafe'}`,
                                                whiteSpace: 'nowrap', display: 'inline-block',
                                                transition: 'all .15s',
                                            }}>
                                                {dossier.code}
                                            </span>
                                        </td>

                                        {/* Détails */}
                                        <td style={{ padding: '16px 20px', maxWidth: '280px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {dossier.label}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                                                {dossier.nature === 'IMP' ? '↓ Importation' : '↑ Exportation'}
                                            </div>
                                        </td>

                                        {/* Client */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                                                {dossier.clientName || <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>Non défini</span>}
                                            </div>
                                            {dossier.clientId && (
                                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>ID: {dossier.clientId}</div>
                                            )}
                                        </td>

                                        {/* Mode */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                padding: '5px 10px', borderRadius: '8px',
                                                fontSize: '12px', fontWeight: 700,
                                                background: mc.bg, color: mc.color,
                                            }}>
                                                {mc.icon} {mc.label}
                                            </span>
                                        </td>

                                        {/* État */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                                                    background: dossier.status === 'CLOSED' ? '#fef3c7' : '#f0fdf4',
                                                    color:      dossier.status === 'CLOSED' ? '#92400e'  : '#15803d',
                                                }}>
                                                    {dossier.status === 'CLOSED' ? 'Clôturé' : 'En cours'}
                                                </span>
                                                <span style={{
                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                                                    background: dossier.isBilled ? '#f0fdf4' : '#fff7ed',
                                                    color:      dossier.isBilled ? '#15803d' : '#c2410c',
                                                }}>
                                                    {dossier.isBilled ? 'Facturé' : 'Non facturé'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                                <button
                                                    onClick={e => { e.stopPropagation(); navigate(`/dossiers/${dossier.id}`) }}
                                                    title="Modifier"
                                                    style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #e5e7eb', background: isH ? '#fef3c7' : 'white', color: isH ? '#b45309' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background='#eff6ff'; e.currentTarget.style.color='#2563eb'; e.currentTarget.style.borderColor='#bfdbfe' }}
                                                    onMouseLeave={e => { e.currentTarget.style.background=isH?'#fef3c7':'white'; e.currentTarget.style.color=isH?'#b45309':'#9ca3af'; e.currentTarget.style.borderColor='#e5e7eb' }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={e => handleDelete(e, dossier.id)}
                                                    title="Supprimer"
                                                    style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #e5e7eb', background: 'white', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background='#fff1f2'; e.currentTarget.style.color='#e11d48'; e.currentTarget.style.borderColor='#fecdd3' }}
                                                    onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.color='#9ca3af'; e.currentTarget.style.borderColor='#e5e7eb' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); navigate(`/dossiers/${dossier.id}`) }}
                                                    style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #e5e7eb', background: isH ? '#f59e0b' : 'white', color: isH ? 'white' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                                                >
                                                    <ChevronRight size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan={6} style={{ padding: '64px 40px', textAlign: 'center' }}>
                                        <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <FolderOpen size={28} style={{ color: '#d1d5db' }} />
                                        </div>
                                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                                            {searchTerm ? 'Aucun résultat' : 'Aucun dossier'}
                                        </div>
                                        <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 20px' }}>
                                            {searchTerm ? `Aucun dossier ne correspond à "${searchTerm}"` : 'Créez votre premier dossier de transit'}
                                        </p>
                                        {!searchTerm && (
                                            <button onClick={() => navigate('/dossiers/new')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#f59e0b', color: 'white', fontSize: '14px', fontWeight: 700 }}>
                                                <Plus size={16} /> Nouveau dossier
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
