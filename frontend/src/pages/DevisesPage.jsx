import React, { useState, useEffect } from 'react'
import { devisesAPI } from '../services/api'
import {
    Coins, Plus, Search, Edit2, Trash2, X, CheckCircle2,
    AlertCircle, ArrowLeft, DollarSign, Euro, RefreshCw,
    TrendingUp, Save, Layers, Star
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ACC = '#047857'
const ACC2 = '#10b981'
const LIGHT = '#ecfdf5'
const BORDER = '#a7f3d0'
const GRAD = 'var(--hero-gradient)'

function Toast({ toasts }) {
    return (
        <div style={{ position:'fixed', bottom:'2rem', right:'2rem', zIndex:200, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {toasts.map(t => (
                <div key={t.id} style={{
                    display:'flex', alignItems:'center', gap:'0.75rem',
                    padding:'0.875rem 1.25rem',
                    background: t.type==='success' ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${t.type==='success' ? '#6ee7b7' : '#fca5a5'}`,
                    color: t.type==='success' ? '#065f46' : '#991b1b',
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

const SYMBOL_PALETTES = [
    { color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe' },
    { color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe' },
    { color:'#b45309', bg:'#fffbeb', border:'#fde68a' },
    { color:'#047857', bg:'#ecfdf5', border:'#a7f3d0' },
    { color:'#be123c', bg:'#fff1f2', border:'#fecdd3' },
    { color:'#0e7490', bg:'#ecfeff', border:'#a5f3fc' },
]

export default function DevisesPage() {
    const navigate = useNavigate()
    const { loadReferenceCurrency } = useAuth()
    const [devises, setDevises] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [toasts, setToasts] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [saving, setSaving] = useState(false)
    const [settingRefId, setSettingRefId] = useState(null)
    const [formData, setFormData] = useState({ libelle:'', Symbole:'', TauxChangeDeviseCFA:'' })

    const refDevise = devises.find(d => d.est_reference)

    useEffect(() => { loadDevises() }, [])

    const loadDevises = async () => {
        try {
            setLoading(true)
            const r = await devisesAPI.getAll()
            setDevises(r.data)
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
        setFormData(item
            ? { libelle:item.libelle, Symbole:item.Symbole, TauxChangeDeviseCFA:item.TauxChangeDeviseCFA }
            : { libelle:'', Symbole:'', TauxChangeDeviseCFA:'' })
        setIsModalOpen(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            if (editingItem) {
                await devisesAPI.update(editingItem.IDDevises, formData)
                toast('success', 'Devise mise à jour')
            } else {
                await devisesAPI.create(formData)
                toast('success', 'Devise ajoutée')
            }
            setIsModalOpen(false); loadDevises()
        } catch (err) {
            toast('error', err.response?.data?.error || "Erreur lors de l'enregistrement")
        } finally { setSaving(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer cette devise ?')) return
        try {
            await devisesAPI.delete(id)
            toast('success', 'Devise supprimée')
            loadDevises()
        } catch (err) { toast('error', err.response?.data?.error || 'Erreur') }
    }

    /* ── Changer la devise de référence : recalcule tous les taux, sans toucher au code ── */
    const handleSetReference = async (devise) => {
        if (!window.confirm(`Faire de "${devise.libelle}" la nouvelle devise de référence ? Le taux de toutes les autres devises sera recalculé en conséquence.`)) return
        setSettingRefId(devise.IDDevises)
        try {
            const res = await devisesAPI.setReference(devise.IDDevises)
            setDevises(res.data.devises || [])
            await loadReferenceCurrency?.() // met à jour le symbole affiché partout dans l'appli, sans recharger la page
            toast('success', `${devise.libelle} est maintenant la devise de référence`)
        } catch (err) {
            toast('error', err.response?.data?.error || 'Erreur lors du changement de référence')
        } finally { setSettingRefId(null) }
    }

    const filtered = devises.filter(d =>
        d.libelle?.toLowerCase().includes(search.toLowerCase()) ||
        d.Symbole?.toLowerCase().includes(search.toLowerCase())
    )

    const inputSt = { width:'100%', padding:'0.75rem 1rem', border:'1px solid #e2e8f0', borderRadius:'0.75rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes spin { to{transform:rotate(360deg)} }
                .dv-inp:focus { border-color:${ACC2} !important; background:white !important; box-shadow:0 0 0 3px ${LIGHT} !important; }
                .dv-card:hover { transform:translateY(-3px) !important; }
            `}</style>

            {/* Hero */}
            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['20%','25%',280,'rgba(16,185,129,0.3)'],['72%','55%',200,'rgba(4,120,87,0.25)']].map(([l,t,s,c],i)=>(
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
                                    <Coins size={28} color="white"/>
                                </div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Gestion des Devises</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Configurez les devises étrangères et leurs taux de change vers {refDevise?.libelle || 'la devise de référence'}</p>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            {[
                                { label:'Devises configurées', value: devises.length, icon: Layers },
                                { label:`Taux moy. (${refDevise?.Symbole || 'F CFA'})`, value: devises.length ? Math.round(devises.reduce((s,d)=>s+parseFloat(d.TauxChangeDeviseCFA||0),0)/devises.length).toLocaleString() : '—', icon: TrendingUp },
                            ].map(({ label, value, icon: Ic }) => (
                                <div key={label} style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                    <Ic size={18} color="rgba(255,255,255,0.8)"/>
                                    <div>
                                        <div style={{ color:'white', fontWeight:800, fontSize:'1.25rem', lineHeight:1 }}>{loading ? '—' : value}</div>
                                        <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.7rem', fontWeight:600, marginTop:'0.2rem' }}>{label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth:1440, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative' }}>
                {/* Toolbar card */}
                <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(4,120,87,0.08)', overflow:'hidden', marginBottom:'1.75rem' }}>
                    <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Coins size={18} color="white"/></div>
                            <span style={{ color:'white', fontWeight:700, fontSize:'0.9375rem' }}>Devises ({filtered.length})</span>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap' }}>
                            <div style={{ position:'relative' }}>
                                <Search size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.6)' }}/>
                                <input style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'2rem', padding:'0.375rem 0.875rem 0.375rem 2.125rem', color:'white', fontSize:'0.8rem', outline:'none', width:200 }}
                                    placeholder="Rechercher..."
                                    value={search} onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <button onClick={loadDevises} style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'0.625rem', padding:'0.375rem 0.75rem', cursor:'pointer' }}>
                                <RefreshCw size={14} style={loading ? {animation:'spin 1s linear infinite'} : {}}/>
                            </button>
                            <button onClick={() => handleOpenModal()} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'white', borderRadius:'0.625rem', padding:'0.5rem 1rem', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer' }}>
                                <Plus size={15}/> Nouvelle devise
                            </button>
                        </div>
                    </div>

                    <div style={{ padding:'2rem' }}>
                        {loading ? (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1.5rem' }}>
                                {[1,2,3].map(i => <div key={i} style={{ background:'#f8fafc', borderRadius:'1rem', height:140, opacity:0.5 }}/>)}
                            </div>
                        ) : filtered.length > 0 ? (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1.5rem' }}>
                                {filtered.map((devise, idx) => {
                                    const pal = SYMBOL_PALETTES[idx % SYMBOL_PALETTES.length]
                                    return (
                                        <div key={devise.IDDevises} className="dv-card"
                                            style={{ background:'white', border:`1px solid ${devise.est_reference ? '#fbbf24' : pal.border}`, borderRadius:'1rem', padding:'1.5rem', transition:'all 0.2s', position:'relative', overflow:'hidden', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
                                            {/* Accent stripe */}
                                            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: devise.est_reference ? '#f59e0b' : `linear-gradient(90deg,${pal.color},${pal.color}99)` }}/>
                                            {devise.est_reference && (
                                                <div style={{ position:'absolute', top:12, right:12, display:'flex', alignItems:'center', gap:4, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'99px', padding:'2px 10px', fontSize:'0.65rem', fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                                                    <Star size={11} fill="#b45309"/> Référence
                                                </div>
                                            )}
                                            <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.25rem' }}>
                                                <div style={{ width:52, height:52, background:pal.bg, border:`1px solid ${pal.border}`, borderRadius:'0.875rem', display:'flex', alignItems:'center', justifyContent:'center', fontSize:(devise.Symbole || '').length > 3 ? '0.8rem' : '1.5rem', textAlign:'center', lineHeight:1.1, fontWeight:800, color:pal.color, flexShrink:0 }}>
                                                    {devise.Symbole}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight:700, color:'#0f172a', fontSize:'1rem' }}>{devise.libelle}</div>
                                                    <div style={{ fontSize:'0.7rem', fontWeight:700, color:pal.color, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:2 }}>{devise.Symbole}</div>
                                                </div>
                                            </div>
                                            {/* Exchange rate */}
                                            <div style={{ background:pal.bg, border:`1px solid ${pal.border}`, borderRadius:'0.75rem', padding:'0.875rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
                                                <div style={{ fontSize:'0.75rem', color:'#64748b', fontWeight:600 }}>Taux de change ({refDevise?.Symbole || 'F CFA'})</div>
                                                <div style={{ fontWeight:800, color:pal.color, fontSize:'1.0625rem' }}>
                                                    {parseFloat(devise.TauxChangeDeviseCFA).toLocaleString('fr-FR', { maximumFractionDigits: 6 })}
                                                    <span style={{ fontWeight:500, color:'#94a3b8', fontSize:'0.7rem', marginLeft:'0.375rem' }}>{refDevise?.Symbole || 'F CFA'}</span>
                                                </div>
                                            </div>
                                            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', borderTop:`1px solid ${pal.border}`, paddingTop:'1rem' }}>
                                                <div style={{ display:'flex', gap:'0.5rem' }}>
                                                    <button onClick={() => handleOpenModal(devise)}
                                                        style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.375rem', padding:'0.5rem', borderRadius:'0.625rem', border:`1px solid ${pal.border}`, background:pal.bg, color:pal.color, cursor:'pointer', fontWeight:600, fontSize:'0.8125rem', transition:'all 0.15s' }}>
                                                        <Edit2 size={13}/> Modifier
                                                    </button>
                                                    <button onClick={() => handleDelete(devise.IDDevises)} disabled={devise.est_reference}
                                                        title={devise.est_reference ? 'Impossible de supprimer la devise de référence' : 'Supprimer'}
                                                        style={{ padding:'0.5rem 0.875rem', borderRadius:'0.625rem', border:'1px solid #fecaca', background:'#fef2f2', color:'#ef4444', cursor: devise.est_reference ? 'not-allowed' : 'pointer', opacity: devise.est_reference ? 0.4 : 1, display:'flex', alignItems:'center', transition:'all 0.15s' }}>
                                                        <Trash2 size={13}/>
                                                    </button>
                                                </div>
                                                {!devise.est_reference && (
                                                    <button onClick={() => handleSetReference(devise)} disabled={settingRefId === devise.IDDevises}
                                                        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.375rem', padding:'0.5rem', borderRadius:'0.625rem', border:'1px dashed #fbbf24', background:'#fffbeb', color:'#b45309', cursor:'pointer', fontWeight:600, fontSize:'0.78125rem', opacity: settingRefId === devise.IDDevises ? 0.6 : 1 }}>
                                                        <Star size={13}/> {settingRefId === devise.IDDevises ? 'Application…' : 'Définir comme référence'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign:'center', padding:'5rem 2rem', background:'#f8fafc', borderRadius:'1rem', border:'2px dashed #e2e8f0' }}>
                                <div style={{ width:64, height:64, background:LIGHT, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
                                    <Coins size={32} color={ACC}/>
                                </div>
                                <h3 style={{ fontWeight:700, color:'#0f172a', margin:'0 0 0.5rem' }}>Aucune devise trouvée</h3>
                                <p style={{ color:'#64748b', margin:0 }}>{search ? `Aucun résultat pour "${search}"` : 'Commencez par ajouter une nouvelle devise.'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150, padding:'1rem' }}>
                    <div style={{ background:'white', borderRadius:'1.25rem', width:'100%', maxWidth:480, boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', overflow:'hidden', animation:'slideUp 0.3s ease' }}>
                        <div style={{ background:GRAD, padding:'1.25rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.5rem', padding:'0.375rem', display:'flex' }}>
                                    <Coins size={16} color="white"/>
                                </div>
                                <h2 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1rem' }}>
                                    {editingItem ? 'Modifier la devise' : 'Ajouter une devise'}
                                </h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', borderRadius:'0.5rem', padding:'0.375rem', cursor:'pointer', display:'flex' }}>
                                <X size={18}/>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.1rem' }}>
                                <div>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Libellé <span style={{color:ACC2}}>*</span></label>
                                    <input className="dv-inp" style={inputSt}
                                        placeholder="Ex: Dollar US, Euro, Yuan..."
                                        value={formData.libelle} onChange={e => setFormData({...formData, libelle:e.target.value})}
                                        required autoFocus
                                    />
                                </div>
                                <div>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Symbole / Code ISO <span style={{color:ACC2}}>*</span></label>
                                    <input className="dv-inp" style={inputSt}
                                        placeholder="Ex: $, €, CNY..."
                                        value={formData.Symbole} onChange={e => setFormData({...formData, Symbole:e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
                                        Taux de change vers {editingItem?.est_reference ? 'elle-même' : (refDevise?.libelle || 'la devise de référence')} ({refDevise?.Symbole || 'F CFA'}) <span style={{color:ACC2}}>*</span>
                                    </label>
                                    <div style={{ position:'relative' }}>
                                        <input className="dv-inp" type="number" step="0.0001" style={{ ...inputSt, ...(editingItem?.est_reference ? { background:'#f1f5f9', color:'#94a3b8', cursor:'not-allowed' } : {}) }}
                                            placeholder="Ex: 655.957"
                                            value={editingItem?.est_reference ? 1 : formData.TauxChangeDeviseCFA}
                                            onChange={e => setFormData({...formData, TauxChangeDeviseCFA:e.target.value})}
                                            readOnly={!!editingItem?.est_reference}
                                            required
                                        />
                                        <span style={{ position:'absolute', right:'1rem', top:'50%', transform:'translateY(-50%)', fontWeight:700, fontSize:'0.75rem', color:'#94a3b8' }}>{refDevise?.Symbole || 'F CFA'}</span>
                                    </div>
                                    <p style={{ margin:'0.375rem 0 0', fontSize:'0.7rem', color:'#94a3b8', fontStyle:'italic' }}>
                                        {editingItem?.est_reference
                                            ? "C'est la devise de référence : son taux est toujours 1. Pour en changer, utilisez \"Définir comme référence\" sur une autre devise."
                                            : `Combien vaut 1 ${formData.libelle || 'unité de cette devise'} en ${refDevise?.libelle || 'devise de référence'} ?`}
                                    </p>
                                </div>
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
