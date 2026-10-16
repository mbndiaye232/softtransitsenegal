import React, { useState, useEffect } from 'react'
import { moyensTransportAPI } from '../services/api'
import {
    Truck, Plus, Search, Edit2, Trash2, X, CheckCircle2,
    AlertCircle, ArrowLeft, Plane, Ship, Train, PackageOpen,
    Layers, RefreshCw, Save
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ACC = '#0e7490'
const ACC2 = '#0891b2'
const LIGHT = '#ecfeff'
const BORDER = '#a5f3fc'
const GRAD = 'linear-gradient(135deg,#0c4a6e 0%,#0e7490 45%,#0891b2 100%)'

const TYPE_CFG = {
    maritime: { color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe', icon: Ship },
    navire:   { color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe', icon: Ship },
    mer:      { color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe', icon: Ship },
    aérien:   { color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', icon: Plane },
    avion:    { color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', icon: Plane },
    terrestre:{ color:'#b45309', bg:'#fffbeb', border:'#fde68a', icon: Truck },
    camion:   { color:'#b45309', bg:'#fffbeb', border:'#fde68a', icon: Truck },
    route:    { color:'#b45309', bg:'#fffbeb', border:'#fde68a', icon: Truck },
    train:    { color:'#059669', bg:'#ecfdf5', border:'#a7f3d0', icon: Train },
    ferrov:   { color:'#059669', bg:'#ecfdf5', border:'#a7f3d0', icon: Train },
}

function getTypeCfg(libelle = '') {
    const l = libelle.toLowerCase()
    for (const [k, v] of Object.entries(TYPE_CFG)) {
        if (l.includes(k)) return v
    }
    return { color:'#0e7490', bg:'#ecfeff', border:'#a5f3fc', icon: PackageOpen }
}

/* ─── Toast ───────────────────────────────────────────────── */
function Toast({ toasts }) {
    return (
        <div style={{ position:'fixed', bottom:'2rem', right:'2rem', zIndex:200, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {toasts.map(t => (
                <div key={t.id} style={{
                    display:'flex', alignItems:'center', gap:'0.75rem',
                    padding:'0.875rem 1.25rem',
                    background: t.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${t.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
                    color: t.type === 'success' ? '#065f46' : '#991b1b',
                    borderRadius:'0.875rem', boxShadow:'0 10px 25px -5px rgba(0,0,0,0.12)',
                    fontWeight:600, fontSize:'0.875rem', animation:'slideUp 0.3s ease'
                }}>
                    {t.type==='success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                    {t.msg}
                </div>
            ))}
        </div>
    )
}

export default function TypesTransportPage() {
    const navigate = useNavigate()
    const [types, setTypes] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [toasts, setToasts] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [libelle, setLibelle] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => { loadTypes() }, [])

    const loadTypes = async () => {
        try {
            setLoading(true)
            const r = await moyensTransportAPI.getTypes()
            setTypes(r.data)
        } catch { toast('error', 'Erreur lors du chargement') }
        finally { setLoading(false) }
    }

    const toast = (type, msg) => {
        const id = Date.now()
        setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    const handleOpenModal = (item = null) => {
        setEditingItem(item)
        setLibelle(item ? item.LibelleTypeMoyenTransport : '')
        setIsModalOpen(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            if (editingItem) {
                await moyensTransportAPI.updateType(editingItem.IDTypesMoyensTransport, { LibelleTypeMoyenTransport: libelle })
                toast('success', 'Type mis à jour')
            } else {
                await moyensTransportAPI.createType({ LibelleTypeMoyenTransport: libelle })
                toast('success', 'Type ajouté')
            }
            setIsModalOpen(false)
            loadTypes()
        } catch (err) {
            toast('error', err.response?.data?.error || "Erreur lors de l'enregistrement")
        } finally { setSaving(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce type de transport ?')) return
        try {
            await moyensTransportAPI.deleteType(id)
            toast('success', 'Type supprimé')
            loadTypes()
        } catch (err) {
            toast('error', err.response?.data?.error || 'Erreur lors de la suppression')
        }
    }

    const filtered = types.filter(t =>
        (t.LibelleTypeMoyenTransport || '').toLowerCase().includes(search.toLowerCase())
    )

    // Compute distribution
    const distrib = [
        { key:'maritime', label:'Maritime', icon: Ship, color:'#1d4ed8' },
        { key:'aérien',   label:'Aérien',   icon: Plane, color:'#7c3aed' },
        { key:'terrestre',label:'Terrestre',icon: Truck, color:'#b45309' },
        { key:'train',    label:'Ferroviaire',icon:Train,color:'#059669' },
        { key:'',         label:'Autres',   icon:PackageOpen,color:'#0e7490' },
    ].map(d => ({
        ...d,
        count: d.key ? types.filter(t => t.LibelleTypeMoyenTransport?.toLowerCase().includes(d.key)).length : 0
    })).filter(d => d.key ? d.count > 0 : types.filter(t => !Object.keys(TYPE_CFG).some(k => t.LibelleTypeMoyenTransport?.toLowerCase().includes(k))).length > 0)

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes spin { to{transform:rotate(360deg)} }
                .tc-card:hover { transform:translateY(-3px) !important; box-shadow:0 12px 30px -8px rgba(14,116,144,0.2) !important; }
                .tc-inp:focus { border-color:${ACC2} !important; background:white !important; box-shadow:0 0 0 3px ${LIGHT} !important; }
            `}</style>

            {/* ── Hero ── */}
            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['20%','30%',280,'rgba(8,145,178,0.35)'],['75%','50%',200,'rgba(14,116,144,0.25)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(60px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1440, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Paramètres
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.625rem' }}>
                                    <Truck size={28} color="white"/>
                                </div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Types de Transport</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Gérez les catégories : Navire, Avion, Camion, Train…</p>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            <div style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <Layers size={18} color="rgba(255,255,255,0.8)"/>
                                <div>
                                    <div style={{ color:'white', fontWeight:800, fontSize:'1.25rem', lineHeight:1 }}>{loading ? '—' : types.length}</div>
                                    <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.7rem', fontWeight:600, marginTop:'0.2rem' }}>Types configurés</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <div style={{ maxWidth:1440, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative' }}>
                <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(14,116,144,0.08)', overflow:'hidden' }}>
                    {/* Card header */}
                    <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Truck size={18} color="white"/></div>
                            <span style={{ color:'white', fontWeight:700, fontSize:'0.9375rem' }}>Liste des types ({filtered.length})</span>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap' }}>
                            <div style={{ position:'relative' }}>
                                <Search size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.6)' }}/>
                                <input className="tc-inp" style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'2rem', padding:'0.375rem 0.875rem 0.375rem 2.125rem', color:'white', fontSize:'0.8rem', outline:'none', width:200 }}
                                    placeholder="Rechercher..."
                                    value={search} onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <button onClick={() => loadTypes()} style={{ display:'flex', alignItems:'center', gap:'0.375rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'0.625rem', padding:'0.375rem 0.75rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
                                <RefreshCw size={13} style={loading ? {animation:'spin 1s linear infinite'} : {}}/>
                            </button>
                            <button onClick={() => handleOpenModal()} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'white', borderRadius:'0.625rem', padding:'0.5rem 1rem', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer' }}>
                                <Plus size={15}/> Nouveau type
                            </button>
                        </div>
                    </div>

                    <div style={{ padding:'2rem' }}>
                        {loading ? (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'1.25rem' }}>
                                {[1,2,3,4].map(i => (
                                    <div key={i} style={{ background:'#f8fafc', borderRadius:'1rem', padding:'1.5rem', height:100, opacity:0.5 }}/>
                                ))}
                            </div>
                        ) : filtered.length > 0 ? (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'1.25rem' }}>
                                {filtered.map(type => {
                                    const cfg = getTypeCfg(type.LibelleTypeMoyenTransport)
                                    const Ic = cfg.icon
                                    return (
                                        <div key={type.IDTypesMoyensTransport} className="tc-card"
                                            style={{ background:'white', border:`1px solid ${cfg.border}`, borderRadius:'1rem', padding:'1.5rem', transition:'all 0.2s', position:'relative', overflow:'hidden', cursor:'default' }}>
                                            {/* Top accent bar */}
                                            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${cfg.color},${cfg.color}99)` }}/>
                                            <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem' }}>
                                                <div style={{ width:44, height:44, borderRadius:'0.75rem', background:cfg.bg, border:`1px solid ${cfg.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                                    <Ic size={22} color={cfg.color}/>
                                                </div>
                                                <span style={{ flex:1, fontWeight:700, color:'#0f172a', fontSize:'0.9375rem' }}>{type.LibelleTypeMoyenTransport}</span>
                                            </div>
                                            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
                                                <button onClick={() => handleOpenModal(type)}
                                                    style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'0.5rem', border:`1px solid ${cfg.border}`, background:cfg.bg, color:cfg.color, cursor:'pointer', transition:'all 0.15s' }}
                                                    title="Modifier">
                                                    <Edit2 size={14}/>
                                                </button>
                                                <button onClick={() => handleDelete(type.IDTypesMoyensTransport)}
                                                    style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'0.5rem', border:'1px solid #fecaca', background:'#fef2f2', color:'#ef4444', cursor:'pointer', transition:'all 0.15s' }}
                                                    title="Supprimer">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign:'center', padding:'5rem 2rem', background:'#f8fafc', borderRadius:'1rem', border:'2px dashed #e2e8f0' }}>
                                <div style={{ width:64, height:64, background:LIGHT, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
                                    <Truck size={32} color={ACC}/>
                                </div>
                                <h3 style={{ fontWeight:700, color:'#0f172a', margin:'0 0 0.5rem' }}>Aucun type trouvé</h3>
                                <p style={{ color:'#64748b', margin:0 }}>{search ? `Aucun résultat pour "${search}"` : 'Ajoutez votre premier type de transport.'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Modal ── */}
            {isModalOpen && (
                <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150, padding:'1rem' }}>
                    <div style={{ background:'white', borderRadius:'1.25rem', width:'100%', maxWidth:440, boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', overflow:'hidden', animation:'slideUp 0.3s ease' }}>
                        <div style={{ background:GRAD, padding:'1.25rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.5rem', padding:'0.375rem', display:'flex' }}>
                                    <Truck size={16} color="white"/>
                                </div>
                                <h2 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1rem' }}>
                                    {editingItem ? 'Modifier le type' : 'Nouveau type de transport'}
                                </h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', borderRadius:'0.5rem', padding:'0.375rem', cursor:'pointer', display:'flex' }}>
                                <X size={18}/>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding:'1.5rem' }}>
                                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.5rem' }}>
                                    Libellé du type <span style={{ color:ACC2 }}>*</span>
                                </label>
                                <input className="tc-inp"
                                    style={{ width:'100%', padding:'0.75rem 1rem', border:'1px solid #e2e8f0', borderRadius:'0.75rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }}
                                    placeholder="Ex: Navire, Avion, Camion, Train..."
                                    value={libelle} onChange={e => setLibelle(e.target.value)}
                                    required autoFocus
                                />
                            </div>
                            <div style={{ padding:'1rem 1.5rem', background:'#f8fafc', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'flex-end', gap:'0.75rem' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    style={{ padding:'0.7rem 1.25rem', borderRadius:'0.75rem', fontWeight:600, border:'1px solid #e2e8f0', background:'white', color:'#64748b', cursor:'pointer' }}>
                                    Annuler
                                </button>
                                <button type="submit" disabled={saving}
                                    style={{ padding:'0.7rem 1.5rem', borderRadius:'0.75rem', fontWeight:700, background:GRAD, color:'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.5rem', opacity:saving?0.7:1 }}>
                                    {saving ? '...' : editingItem ? <><Save size={14}/> Mettre à jour</> : <><Plus size={14}/> Ajouter</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Toast toasts={toasts}/>
        </div>
    )
}
