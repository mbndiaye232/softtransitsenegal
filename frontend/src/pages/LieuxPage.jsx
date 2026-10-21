import React, { useState, useEffect } from 'react'
import {
    MapPin, Globe, Plus, Search, Trash2, Edit,
    Anchor, Plane, Building2, Train, CheckCircle2,
    AlertCircle, Save, X, ArrowLeft
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { lieuxAPI, paysAPI } from '../services/api'

/* ── Color config — Logistique & Transport ── */
const C = {
    accent: '#0891b2', light: '#ecfeff', border: '#a5f3fc',
    grad: 'var(--hero-gradient)',
}

/* ── Type config ── */
const TYPE_CFG = {
    'Port':             { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: Anchor },
    'Aéroport':         { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: Plane },
    'Bureau de Douane': { color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: Building2 },
    'Gare':             { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: Train },
    'Autre':            { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: MapPin },
}
const getTypeCfg = (t) => TYPE_CFG[t] || TYPE_CFG['Autre']

/* ── shared input style ── */
const inp = {
    width: '100%', padding: '9px 13px', border: '1.5px solid #e2e8f0',
    borderRadius: '10px', fontSize: '14px', color: '#1e293b',
    background: '#f8fafc', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s',
}

/* ── Form label ── */
const FL = ({ children, req }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
        {children}{req && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
    </label>
)

export default function LieuxPage() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('lieux')
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)
    const [hovRow, setHovRow] = useState(null)

    const [lieux, setLieux] = useState([])
    const [pays, setPays] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [filterPays, setFilterPays] = useState('')
    const [filterType, setFilterType] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        NomLieu: '', TypeLieu: 'Port', IDPays: '', Observations: '',
        NomPays: '', codePays3: '', CodePays2: '',
    })

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [lRes, pRes] = await Promise.all([lieuxAPI.getAll(), paysAPI.getAll()])
            setLieux(lRes.data)
            setPays(pRes.data)
        } catch { showToast('Erreur lors du chargement', 'error') }
        finally { setLoading(false) }
    }

    const resetForm = () => {
        setFormData({ NomLieu: '', TypeLieu: 'Port', IDPays: '', Observations: '', NomPays: '', codePays3: '', CodePays2: '' })
        setEditingId(null)
    }

    const handleSubmitLieu = async (e) => {
        e.preventDefault(); setSaving(true)
        try {
            if (editingId) await lieuxAPI.update(editingId, formData)
            else await lieuxAPI.create(formData)
            showToast(editingId ? 'Lieu mis à jour' : 'Nouveau lieu ajouté')
            resetForm(); loadData()
        } catch { showToast("Erreur lors de l'enregistrement", 'error') }
        finally { setSaving(false) }
    }

    const handleSubmitPays = async (e) => {
        e.preventDefault(); setSaving(true)
        try {
            if (editingId) await paysAPI.update(editingId, formData)
            else await paysAPI.create(formData)
            showToast(editingId ? 'Pays mis à jour' : 'Nouveau pays ajouté')
            resetForm(); loadData()
        } catch { showToast("Erreur lors de l'enregistrement", 'error') }
        finally { setSaving(false) }
    }

    const handleDelete = async (type, id) => {
        if (!window.confirm('Supprimer cet élément ?')) return
        try {
            if (type === 'lieu') await lieuxAPI.delete(id)
            else await paysAPI.delete(id)
            showToast('Suppression réussie')
            loadData()
        } catch { showToast('Impossible de supprimer (utilisé ailleurs)', 'error') }
    }

    const filteredLieux = lieux.filter(l =>
        l.NomLieu.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (filterPays === '' || l.IDPays == filterPays) &&
        (filterType === '' || l.TypeLieu === filterType)
    )
    const filteredPays = pays.filter(p =>
        p.NomPays.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.codePays3?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    const activeList = activeTab === 'lieux' ? filteredLieux : filteredPays

    /* summary counts */
    const typeSummary = Object.keys(TYPE_CFG).map(t => ({
        type: t, count: lieux.filter(l => l.TypeLieu === t).length, cfg: TYPE_CFG[t],
    })).filter(x => x.count > 0)

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: C.accent, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
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
                    padding: '12px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px',
                    fontWeight: 700, fontSize: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
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
                background: 'var(--hero-gradient)',
                padding: '2.5rem 2rem 6rem', position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '-60px', right: '5%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(6,182,212,0.35) 0%,transparent 70%)', filter: 'blur(45px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-80px', left: '10%', width: '240px', height: '240px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 2, maxWidth: '1400px', margin: '0 auto' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px', padding: '6px 14px', color: 'rgba(255,255,255,0.8)',
                        fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: '1.5rem',
                    }}>
                        <ArrowLeft size={14} /> Paramètres
                    </button>

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {activeTab === 'lieux' ? <MapPin size={26} color="white" /> : <Globe size={26} color="white" />}
                                </div>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em' }}>
                                        {activeTab === 'lieux' ? 'Lieux & Ports' : 'Gestion des Pays'}
                                    </h1>
                                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 500 }}>
                                        {activeTab === 'lieux' ? 'Villes, ports et bureaux de douane' : 'Référentiel mondial des pays et codes ISO'}
                                    </p>
                                </div>
                            </div>
                            {/* Type summary pills */}
                            {activeTab === 'lieux' && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {typeSummary.map(ts => {
                                        const Ic = ts.cfg.icon
                                        return (
                                            <div key={ts.type} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                                                borderRadius: '99px', padding: '5px 14px', color: 'white', fontSize: '12px', fontWeight: 700,
                                            }}>
                                                <Ic size={13} />{ts.type}
                                                <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '99px', padding: '1px 7px', fontSize: '11px', fontWeight: 800 }}>{ts.count}</span>
                                            </div>
                                        )
                                    })}
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '99px', padding: '5px 14px', color: 'white', fontSize: '12px', fontWeight: 800 }}>
                                        Total : {lieux.length}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'pays' && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '99px', padding: '5px 14px', color: 'white', fontSize: '12px', fontWeight: 800 }}>
                                    <Globe size={13} /> {pays.length} pays référencés
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════ FLOATING CONTENT ══════════ */}
            <div style={{ maxWidth: '1400px', margin: '-48px auto 0', padding: '0 2rem 2rem', position: 'relative', zIndex: 10 }}>

                {/* ── Premium Tab bar ── */}
                <div style={{
                    background: 'white', borderRadius: '16px', padding: '6px',
                    display: 'inline-flex', gap: '4px', marginBottom: '1.25rem',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: `1px solid ${C.border}`,
                }}>
                    {[
                        { key: 'lieux', icon: Anchor, label: 'Lieux, Ports & Bureaux' },
                        { key: 'pays',  icon: Globe,  label: 'Liste des Pays' },
                    ].map(tab => {
                        const Ic = tab.icon
                        const isActive = activeTab === tab.key
                        return (
                            <button key={tab.key}
                                onClick={() => { setActiveTab(tab.key); resetForm(); setSearchQuery('') }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '9px 22px', borderRadius: '11px', border: 'none',
                                    fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: isActive ? C.grad : 'transparent',
                                    color: isActive ? 'white' : '#64748b',
                                    boxShadow: isActive ? `0 4px 12px ${C.accent}40` : 'none',
                                }}>
                                <Ic size={15} />{tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* ── Split layout ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr', gap: '1.25rem', alignItems: 'start' }}>

                    {/* ── LEFT: Form card ── */}
                    <div style={{ position: 'sticky', top: '20px' }}>
                        <div style={{ borderRadius: '18px', overflow: 'hidden', boxShadow: `0 8px 32px ${C.accent}18`, border: `1px solid ${C.border}` }}>
                            {/* Form header */}
                            <div style={{ background: C.grad, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    {editingId ? <Edit size={17} /> : <Plus size={17} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {editingId ? 'Modifier' : 'Ajouter'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                        {activeTab === 'lieux' ? 'Lieu, port ou bureau' : 'Pays'}
                                    </div>
                                </div>
                                {editingId && (
                                    <button onClick={resetForm} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '7px', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Form body */}
                            <div style={{ background: 'white', padding: '1.5rem' }}>
                                {activeTab === 'lieux' ? (
                                    <form onSubmit={handleSubmitLieu}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <FL req>Nom du lieu</FL>
                                            <input value={formData.NomLieu} onChange={e => setFormData({ ...formData, NomLieu: e.target.value })} placeholder="ex: Port de Dakar" required style={inp} />
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <FL>Type de lieu</FL>
                                            <select value={formData.TypeLieu} onChange={e => setFormData({ ...formData, TypeLieu: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                                                <option value="Port">⚓ Port</option>
                                                <option value="Aéroport">✈️ Aéroport</option>
                                                <option value="Bureau de Douane">🏢 Bureau de Douane</option>
                                                <option value="Gare">🚂 Gare</option>
                                                <option value="Autre">📍 Autre</option>
                                            </select>
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <FL>Pays</FL>
                                            <select value={formData.IDPays} onChange={e => setFormData({ ...formData, IDPays: e.target.value })} required style={{ ...inp, cursor: 'pointer' }}>
                                                <option value="">Sélectionner un pays</option>
                                                {pays.map(p => <option key={p.IDPays} value={p.IDPays}>{p.NomPays}</option>)}
                                            </select>
                                        </div>
                                        <div style={{ marginBottom: '1.25rem' }}>
                                            <FL>Observations</FL>
                                            <textarea value={formData.Observations} onChange={e => setFormData({ ...formData, Observations: e.target.value })} rows={2} placeholder="Détails optionnels..." style={{ ...inp, resize: 'vertical' }} />
                                        </div>
                                        <button type="submit" disabled={saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: C.grad, color: 'white', border: 'none', borderRadius: '11px', padding: '11px', fontWeight: 800, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: `0 4px 14px ${C.accent}40` }}>
                                            {editingId ? <Save size={16} /> : <Plus size={16} />}
                                            {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Enregistrer'}
                                        </button>
                                        {editingId && (
                                            <button type="button" onClick={resetForm} style={{ width: '100%', marginTop: '8px', padding: '9px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                                Annuler
                                            </button>
                                        )}
                                    </form>
                                ) : (
                                    <form onSubmit={handleSubmitPays}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <FL req>Nom complet du pays</FL>
                                            <input value={formData.NomPays} onChange={e => setFormData({ ...formData, NomPays: e.target.value })} placeholder="ex: Sénégal" required style={inp} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
                                            <div>
                                                <FL>Code ISO (3)</FL>
                                                <input value={formData.codePays3} onChange={e => setFormData({ ...formData, codePays3: e.target.value.toUpperCase() })} maxLength="3" placeholder="SEN" style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }} />
                                            </div>
                                            <div>
                                                <FL>Code ISO (2)</FL>
                                                <input value={formData.CodePays2} onChange={e => setFormData({ ...formData, CodePays2: e.target.value.toUpperCase() })} maxLength="2" placeholder="SN" style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }} />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: C.grad, color: 'white', border: 'none', borderRadius: '11px', padding: '11px', fontWeight: 800, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: `0 4px 14px ${C.accent}40` }}>
                                            {editingId ? <Save size={16} /> : <Plus size={16} />}
                                            {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Enregistrer'}
                                        </button>
                                        {editingId && (
                                            <button type="button" onClick={resetForm} style={{ width: '100%', marginTop: '8px', padding: '9px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                                Annuler
                                            </button>
                                        )}
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: List card ── */}
                    <div style={{ borderRadius: '18px', overflow: 'hidden', boxShadow: `0 8px 32px ${C.accent}12`, border: `1px solid ${C.border}` }}>
                        {/* List header */}
                        <div style={{ background: C.grad, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    {activeTab === 'lieux' ? <MapPin size={17} /> : <Globe size={17} />}
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                    <span style={{ fontWeight: 800, fontSize: '13px', color: 'white', display: 'block' }}>
                                        {activeTab === 'lieux' ? `${filteredLieux.length} lieu(x)` : `${filteredPays.length} pays`}
                                    </span>
                                    sur {activeTab === 'lieux' ? lieux.length : pays.length} au total
                                </div>
                            </div>
                            {/* Filters */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {activeTab === 'lieux' && (
                                    <>
                                        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ height: '34px', padding: '0 10px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none', cursor: 'pointer' }}>
                                            <option value="" style={{ color: '#1e293b' }}>Tous les types</option>
                                            <option value="Port" style={{ color: '#1e293b' }}>Ports</option>
                                            <option value="Aéroport" style={{ color: '#1e293b' }}>Aéroports</option>
                                            <option value="Bureau de Douane" style={{ color: '#1e293b' }}>Bureaux</option>
                                            <option value="Gare" style={{ color: '#1e293b' }}>Gares</option>
                                        </select>
                                        <select value={filterPays} onChange={e => setFilterPays(e.target.value)} style={{ height: '34px', padding: '0 10px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none', cursor: 'pointer' }}>
                                            <option value="" style={{ color: '#1e293b' }}>Tous les pays</option>
                                            {pays.map(p => <option key={p.IDPays} value={p.IDPays} style={{ color: '#1e293b' }}>{p.NomPays}</option>)}
                                        </select>
                                    </>
                                )}
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher..."
                                        style={{ paddingLeft: '28px', paddingRight: '10px', height: '34px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', width: '160px' }} />
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ background: 'white' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: C.grad }}>
                                        {activeTab === 'lieux'
                                            ? ['Nom du lieu', 'Type', 'Pays', ''].map((h, i) => <th key={i} style={{ padding: '9px 18px', textAlign: i === 3 ? 'right' : 'left', fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>)
                                            : ['Nom du Pays', 'Code ISO (3)', 'Code ISO (2)', ''].map((h, i) => <th key={i} style={{ padding: '9px 18px', textAlign: i === 3 ? 'right' : 'left', fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>)
                                        }
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeList.length === 0 ? (
                                        <tr><td colSpan={4} style={{ padding: '4rem', textAlign: 'center', color: '#cbd5e1' }}>
                                            <MapPin size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
                                            <div style={{ fontWeight: 700, fontSize: '14px' }}>Aucun résultat trouvé</div>
                                        </td></tr>
                                    ) : activeTab === 'lieux' ? (
                                        filteredLieux.map((l, i) => {
                                            const cfg = getTypeCfg(l.TypeLieu)
                                            const Ic = cfg.icon
                                            const isHov = hovRow === `l${i}`
                                            const paysName = pays.find(p => p.IDPays == l.IDPays)?.NomPays || 'N/A'
                                            return (
                                                <tr key={l.IDLieux} onMouseEnter={() => setHovRow(`l${i}`)} onMouseLeave={() => setHovRow(null)}
                                                    style={{ background: isHov ? C.light : i % 2 === 0 ? 'white' : '#fafbfc', transition: 'background 0.15s' }}>
                                                    <td style={{ padding: '11px 18px', fontWeight: 700, fontSize: '14px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>{l.NomLieu}</td>
                                                    <td style={{ padding: '11px 18px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 11px', borderRadius: '99px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: '12px', fontWeight: 700 }}>
                                                            <Ic size={12} />{l.TypeLieu}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '11px 18px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <span style={{ background: C.light, color: C.accent, padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>{paysName}</span>
                                                    </td>
                                                    <td style={{ padding: '11px 18px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                            <button onClick={() => { setEditingId(l.IDLieux); setFormData({ ...l }) }} style={{ padding: '6px', borderRadius: '7px', border: 'none', background: isHov ? C.light : '#f8fafc', color: C.accent, cursor: 'pointer' }}><Edit size={14} /></button>
                                                            <button onClick={() => handleDelete('lieu', l.IDLieux)} style={{ padding: '6px', borderRadius: '7px', border: 'none', background: isHov ? '#fef2f2' : '#f8fafc', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        filteredPays.map((p, i) => {
                                            const isHov = hovRow === `p${i}`
                                            return (
                                                <tr key={p.IDPays} onMouseEnter={() => setHovRow(`p${i}`)} onMouseLeave={() => setHovRow(null)}
                                                    style={{ background: isHov ? C.light : i % 2 === 0 ? 'white' : '#fafbfc', transition: 'background 0.15s' }}>
                                                    <td style={{ padding: '11px 18px', fontWeight: 700, fontSize: '14px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>{p.NomPays}</td>
                                                    <td style={{ padding: '11px 18px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <code style={{ background: '#f1f5f9', padding: '3px 9px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, color: '#475569' }}>{p.codePays3}</code>
                                                    </td>
                                                    <td style={{ padding: '11px 18px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <code style={{ background: C.light, padding: '3px 9px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, color: C.accent }}>{p.CodePays2}</code>
                                                    </td>
                                                    <td style={{ padding: '11px 18px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                            <button onClick={() => { setEditingId(p.IDPays); setFormData({ ...p }) }} style={{ padding: '6px', borderRadius: '7px', border: 'none', background: isHov ? C.light : '#f8fafc', color: C.accent, cursor: 'pointer' }}><Edit size={14} /></button>
                                                            <button onClick={() => handleDelete('pays', p.IDPays)} style={{ padding: '6px', borderRadius: '7px', border: 'none', background: isHov ? '#fef2f2' : '#f8fafc', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
