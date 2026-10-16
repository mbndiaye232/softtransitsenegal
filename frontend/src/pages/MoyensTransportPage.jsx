import React, { useState, useEffect } from 'react'
import {
    Plus, Search, Edit, Trash2, Truck, Ship, Plane,
    Train, X, Save, Box, CheckCircle2, AlertCircle, ArrowLeft
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { moyensTransportAPI, tiersAPI } from '../services/api'

/* ── Color config — Logistique & Transport ── */
const C = {
    accent: '#0891b2',
    light:  '#ecfeff',
    border: '#a5f3fc',
    grad:   'linear-gradient(135deg,#0e7490,#0891b2)',
}

/* ── Type styles ── */
const TYPE_CFG = {
    maritime: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: Ship },
    navire:   { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: Ship },
    aérien:   { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: Plane },
    avion:    { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: Plane },
    terrestre:{ color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: Truck },
    camion:   { color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: Truck },
    train:    { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: Train },
}

function getTypeCfg(libelle) {
    if (!libelle) return { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: Box }
    const key = Object.keys(TYPE_CFG).find(k => libelle.toLowerCase().includes(k))
    return key ? TYPE_CFG[key] : { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: Box }
}

const inp = {
    width: '100%', padding: '9px 13px',
    border: '1.5px solid #e2e8f0', borderRadius: '10px',
    fontSize: '14px', color: '#1e293b', background: '#f8fafc',
    outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s',
}

export default function MoyensTransportPage() {
    const navigate = useNavigate()
    const [moyens, setMoyens] = useState([])
    const [types, setTypes] = useState([])
    const [tiers, setTiers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedType, setSelectedType] = useState('')
    const [error, setError] = useState('')
    const [toast, setToast] = useState(null)
    const [hovRow, setHovRow] = useState(null)

    const [showModal, setShowModal] = useState(false)
    const [editingMoyen, setEditingMoyen] = useState(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        LibelleMoyensTransport: '', idtypeMoyensTransport: '', Observations: '', IDTiers: ''
    })

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [moyensRes, typesRes, tiersRes] = await Promise.all([
                moyensTransportAPI.getAll(),
                moyensTransportAPI.getTypes(),
                tiersAPI.getAll(),
            ])
            setMoyens(moyensRes.data)
            setTypes(typesRes.data)
            setTiers(tiersRes.data)
            setError('')
        } catch (err) {
            setError('Impossible de charger les données')
        } finally { setLoading(false) }
    }

    const loadMoyens = async () => {
        try {
            const res = await moyensTransportAPI.getAll()
            setMoyens(res.data)
        } catch (err) { console.error(err) }
    }

    const filteredMoyens = moyens.filter(m => {
        const s = searchTerm.toLowerCase()
        const matchSearch = !s ||
            m.LibelleMoyensTransport?.toLowerCase().includes(s) ||
            m.NomTier?.toLowerCase().includes(s) ||
            m.Observations?.toLowerCase().includes(s)
        const matchType = !selectedType || m.idtypeMoyensTransport?.toString() === selectedType
        return matchSearch && matchType
    })

    const handleEdit = (moyen) => {
        setEditingMoyen(moyen)
        setFormData({
            LibelleMoyensTransport: moyen.LibelleMoyensTransport || '',
            idtypeMoyensTransport:  moyen.idtypeMoyensTransport  || '',
            Observations:           moyen.Observations           || '',
            IDTiers:                moyen.IDTiers                || '',
        })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (window.confirm('Supprimer ce moyen de transport ?')) {
            try {
                await moyensTransportAPI.delete(id)
                showToast('Moyen supprimé')
                loadMoyens()
            } catch (err) {
                showToast(err.response?.data?.error || 'Erreur lors de la suppression', 'error')
            }
        }
    }

    const handleCloseModal = () => {
        setShowModal(false)
        setEditingMoyen(null)
        setFormData({ LibelleMoyensTransport: '', idtypeMoyensTransport: '', Observations: '', IDTiers: '' })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            if (editingMoyen) await moyensTransportAPI.update(editingMoyen.IDMoyensTransport, formData)
            else await moyensTransportAPI.create(formData)
            showToast(editingMoyen ? 'Moyen mis à jour' : 'Moyen ajouté')
            handleCloseModal()
            loadMoyens()
        } catch (err) {
            showToast(err.response?.data?.error || 'Erreur lors de l\'enregistrement', 'error')
        } finally { setSaving(false) }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    /* ── transport type summary for hero pills ── */
    const typeCounts = types.map(t => ({
        ...t,
        count: moyens.filter(m => m.idtypeMoyensTransport?.toString() === t.IDTypesMoyensTransport?.toString()).length,
        cfg: getTypeCfg(t.LibelleTypeMoyenTransport),
    })).filter(t => t.count > 0)

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: C.accent, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
            <style>{`
                @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes slideUp { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
                input:focus, select:focus, textarea:focus {
                    border-color: ${C.accent} !important;
                    background: white !important;
                    box-shadow: 0 0 0 3px ${C.light} !important;
                }
                ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:#f1f5f9} ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
            `}</style>

            {/* ── Toast ── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 2000,
                    padding: '12px 18px', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontWeight: 700, fontSize: '14px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    animation: 'slideUp 0.3s ease',
                    background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: toast.type === 'success' ? '#16a34a' : '#ef4444',
                    border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fee2e2'}`,
                }}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* ══════════ HERO ══════════ */}
            <div style={{
                background: 'linear-gradient(135deg,#0c4a6e 0%,#0e7490 45%,#0891b2 100%)',
                padding: '2.5rem 2rem 6rem',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '-60px', right: '5%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(6,182,212,0.35) 0%,transparent 70%)', filter: 'blur(45px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-80px', left: '10%', width: '240px', height: '240px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.2) 0%,transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 2, maxWidth: '1300px', margin: '0 auto' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px', padding: '6px 14px',
                        color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', marginBottom: '1.5rem',
                    }}>
                        <ArrowLeft size={14} /> Paramètres
                    </button>

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Truck size={26} color="white" />
                                </div>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em' }}>
                                        Moyens de Transport
                                    </h1>
                                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 500 }}>
                                        Référentiel des navires, avions et camions utilisés
                                    </p>
                                </div>
                            </div>
                            {/* Type pills */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                {typeCounts.map(t => {
                                    const Ic = t.cfg.icon
                                    return (
                                        <div key={t.IDTypesMoyensTransport} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                                            background: 'rgba(255,255,255,0.12)',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            borderRadius: '99px', padding: '5px 14px',
                                            color: 'white', fontSize: '12px', fontWeight: 700,
                                        }}>
                                            <Ic size={13} />
                                            {t.LibelleTypeMoyenTransport}
                                            <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '99px', padding: '1px 7px', fontSize: '11px', fontWeight: 800 }}>{t.count}</span>
                                        </div>
                                    )
                                })}
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                    background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
                                    borderRadius: '99px', padding: '5px 14px',
                                    color: 'white', fontSize: '12px', fontWeight: 800,
                                }}>
                                    Total : {moyens.length}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => { setEditingMoyen(null); setShowModal(true) }} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)',
                            borderRadius: '12px', padding: '12px 22px',
                            color: 'white', fontSize: '14px', fontWeight: 800, cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.15)', flexShrink: 0,
                        }}>
                            <Plus size={18} /> Ajouter un moyen
                        </button>
                    </div>
                </div>
            </div>

            {/* ══════════ FLOATING CONTENT ══════════ */}
            <div style={{ maxWidth: '1300px', margin: '-48px auto 0', padding: '0 2rem 2rem', position: 'relative', zIndex: 10 }}>
                <div style={{
                    borderRadius: '20px', overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(8,145,178,0.12)',
                    border: `1px solid ${C.border}`,
                }}>
                    {/* Card header */}
                    <div style={{
                        background: C.grad, padding: '1.1rem 1.75rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                <Truck size={19} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '14px', color: 'white', letterSpacing: '0.04em' }}>Référentiel des moyens</div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{filteredMoyens.length} moyen(s) affiché(s)</div>
                            </div>
                        </div>
                        {/* Filter bar in header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Libellé, transporteur..."
                                    style={{ paddingLeft: '32px', paddingRight: '12px', height: '36px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '9px', fontSize: '13px', outline: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', width: '200px' }}
                                />
                            </div>
                            <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                                style={{ height: '36px', padding: '0 10px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '9px', fontSize: '13px', fontWeight: 600, background: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none', cursor: 'pointer' }}>
                                <option value="" style={{ color: '#1e293b' }}>Tous les types</option>
                                {types.map(t => <option key={t.IDTypesMoyensTransport} value={t.IDTypesMoyensTransport} style={{ color: '#1e293b' }}>{t.LibelleTypeMoyenTransport}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ padding: '12px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '13px', fontWeight: 700 }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {/* Table */}
                    <div style={{ background: 'white' }}>
                        {filteredMoyens.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: C.grad }}>
                                        {['Libellé / Désignation', 'Type de Transport', 'Transporteur / Tiers', 'Observations', ''].map((h, i) => (
                                            <th key={i} style={{ padding: '9px 18px', textAlign: i === 4 ? 'right' : 'left', fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMoyens.map((m, i) => {
                                        const cfg = getTypeCfg(m.LibelleTypeMoyenTransport)
                                        const TypeIcon = cfg.icon
                                        const isHov = hovRow === i
                                        return (
                                            <tr key={m.IDMoyensTransport}
                                                onMouseEnter={() => setHovRow(i)}
                                                onMouseLeave={() => setHovRow(null)}
                                                style={{ background: isHov ? C.light : i % 2 === 0 ? 'white' : '#fafbfc', transition: 'background 0.15s' }}
                                            >
                                                <td style={{ padding: '12px 18px', fontWeight: 700, fontSize: '14px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>
                                                    {m.LibelleMoyensTransport}
                                                </td>
                                                <td style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                        padding: '4px 12px', borderRadius: '99px',
                                                        background: cfg.bg, color: cfg.color,
                                                        border: `1px solid ${cfg.border}`,
                                                        fontSize: '12px', fontWeight: 700,
                                                    }}>
                                                        <TypeIcon size={13} />
                                                        {m.LibelleTypeMoyenTransport || '—'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9' }}>
                                                    {m.NomTier ? (
                                                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                                                            {m.NomTier}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#cbd5e1', fontSize: '12px', fontStyle: 'italic' }}>Non spécifié</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 18px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid #f1f5f9' }}>
                                                    {m.Observations || '—'}
                                                </td>
                                                <td style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                        <button onClick={() => handleEdit(m)}
                                                            style={{ padding: '7px', borderRadius: '8px', border: 'none', background: isHov ? C.light : '#f8fafc', color: C.accent, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center' }}>
                                                            <Edit size={15} />
                                                        </button>
                                                        <button onClick={() => handleDelete(m.IDMoyensTransport)}
                                                            style={{ padding: '7px', borderRadius: '8px', border: 'none', background: isHov ? '#fef2f2' : '#f8fafc', color: '#ef4444', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center' }}>
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            </div>
                        ) : (
                            <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                                <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: C.accent }}>
                                    <Box size={36} />
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>Aucun enregistrement</div>
                                <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '1.25rem' }}>
                                    Aucun moyen de transport ne correspond à vos critères.
                                </div>
                                <button onClick={() => { setSearchTerm(''); setSelectedType('') }}
                                    style={{ background: C.grad, color: 'white', border: 'none', borderRadius: '9px', padding: '9px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                                    Effacer les filtres
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer count */}
                    {filteredMoyens.length > 0 && (
                        <div style={{ padding: '10px 18px', background: '#fafbfc', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                            {filteredMoyens.length} moyen(s) sur {moyens.length} au total
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════ MODAL ══════════ */}
            {showModal && (
                <div onClick={handleCloseModal} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(4px)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: 'white', borderRadius: '20px', width: '100%', maxWidth: '540px',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
                        animation: 'slideUp 0.25s ease', overflow: 'hidden',
                    }}>
                        {/* Modal header */}
                        <div style={{ background: C.grad, padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    {editingMoyen ? <Edit size={19} /> : <Plus size={19} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 900, fontSize: '16px', color: 'white' }}>{editingMoyen ? 'Modifier le moyen' : 'Nouveau moyen de transport'}</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Référentiel des opérations de transit</div>
                                </div>
                            </div>
                            <button onClick={handleCloseModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Libellé */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
                                        Libellé du moyen <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input name="LibelleMoyensTransport" value={formData.LibelleMoyensTransport} onChange={handleChange}
                                        required autoFocus placeholder="Ex: CMA CGM MARCO POLO / CAMION SN 1234..."
                                        style={inp} />
                                </div>
                                {/* Type + Tiers */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
                                            Type de transport <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select name="idtypeMoyensTransport" value={formData.idtypeMoyensTransport} onChange={handleChange} required style={{ ...inp, cursor: 'pointer' }}>
                                            <option value="">Sélectionner...</option>
                                            {types.map(t => <option key={t.IDTypesMoyensTransport} value={t.IDTypesMoyensTransport}>{t.LibelleTypeMoyenTransport}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
                                            Tiers / Transporteur
                                        </label>
                                        <select name="IDTiers" value={formData.IDTiers} onChange={handleChange} style={{ ...inp, cursor: 'pointer' }}>
                                            <option value="">Aucun tiers lié</option>
                                            {tiers.map(t => <option key={t.IDTiers} value={t.IDTiers}>{t.libtier}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {/* Observations */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
                                        Observations
                                    </label>
                                    <textarea name="Observations" value={formData.Observations} onChange={handleChange} rows={3}
                                        placeholder="Immatriculation, notes spécifiques..."
                                        style={{ ...inp, resize: 'vertical', minHeight: '80px' }} />
                                </div>
                            </div>

                            {/* Modal footer */}
                            <div style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" onClick={handleCloseModal}
                                    style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                    Annuler
                                </button>
                                <button type="submit" disabled={saving}
                                    style={{ display: 'flex', alignItems: 'center', gap: '7px', background: C.grad, color: 'white', border: 'none', borderRadius: '10px', padding: '9px 24px', fontWeight: 800, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: `0 4px 14px ${C.accent}50` }}>
                                    <Save size={16} />
                                    {saving ? 'Enregistrement...' : editingMoyen ? 'Mettre à jour' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
