import React, { useState, useEffect } from 'react'
import {
    Activity, Plus, Save, Trash2, Edit, Search,
    CheckCircle2, AlertCircle, Building2, ArrowLeft, Layers
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { statutsAPI } from '../services/api'

const ACC = '#6d28d9'
const ACC2 = '#7c3aed'
const LIGHT = '#f5f3ff'
const BORDER = '#ddd6fe'
const GRAD = 'linear-gradient(135deg,#4c1d95 0%,#6d28d9 45%,#7c3aed 100%)'

function Toast({ toasts }) {
    return (
        <div style={{ position:'fixed', bottom:'2rem', right:'2rem', zIndex:200, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {toasts.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1.25rem', background:t.type==='success'?'#ecfdf5':'#fef2f2', border:`1px solid ${t.type==='success'?'#6ee7b7':'#fca5a5'}`, color:t.type==='success'?'#065f46':'#991b1b', borderRadius:'0.875rem', boxShadow:'0 10px 25px -5px rgba(0,0,0,0.12)', fontWeight:600, fontSize:'0.875rem', animation:'slideUp 0.3s ease' }}>
                    {t.type==='success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                    {t.msg}
                </div>
            ))}
        </div>
    )
}

export default function StatutsOrgPage() {
    const navigate = useNavigate()
    const [statuts, setStatuts] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [libelle, setLibelle] = useState('')
    const [saving, setSaving] = useState(false)
    const [toasts, setToasts] = useState([])
    const [hovRow, setHovRow] = useState(null)

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try { setLoading(true); const r = await statutsAPI.getAll(); setStatuts(r.data) }
        catch { toast('error', 'Erreur lors du chargement') }
        finally { setLoading(false) }
    }

    const toast = (type, msg) => {
        const id = Date.now(); setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    const handleSubmit = async (e) => {
        e.preventDefault(); if (!libelle.trim()) return; setSaving(true)
        try {
            if (editingId) { await statutsAPI.update(editingId, { libelle }); toast('success', 'Statut mis à jour') }
            else { await statutsAPI.create({ libelle }); toast('success', 'Statut ajouté') }
            setLibelle(''); setEditingId(null); loadData()
        } catch { toast('error', "Erreur lors de l'enregistrement") }
        finally { setSaving(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce statut ?')) return
        try { await statutsAPI.delete(id); toast('success', 'Supprimé'); loadData() }
        catch { toast('error', 'Impossible (utilisé par un tiers)') }
    }

    const filtered = statuts.filter(s => s.libelle?.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                .so-inp:focus{border-color:${ACC2}!important;background:white!important;box-shadow:0 0 0 3px ${LIGHT}!important}
                .so-row:hover td{background:${LIGHT}!important}
                .so-ab:hover{background:${LIGHT};color:${ACC}}
                .so-adel:hover{background:#fee2e2!important;color:#dc2626!important}
            `}</style>

            {/* Hero */}
            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['25%','20%',260,'rgba(124,58,237,0.35)'],['70%','55%',180,'rgba(109,40,217,0.25)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(60px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1000, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Paramètres
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.625rem' }}><Activity size={28} color="white"/></div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Statuts des Organisations</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Définissez les formes juridiques (SA, SARL, Administration…)</p>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <Layers size={18} color="rgba(255,255,255,0.8)"/>
                            <div>
                                <div style={{ color:'white', fontWeight:800, fontSize:'1.25rem', lineHeight:1 }}>{loading?'—':statuts.length}</div>
                                <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.7rem', fontWeight:600, marginTop:'0.2rem' }}>Statuts configurés</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth:1000, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative' }}>
                <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(109,40,217,0.08)', overflow:'hidden' }}>
                    {/* Card header with inline form */}
                    <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
                        <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Building2 size={18} color="white"/></div>
                        <span style={{ color:'white', fontWeight:700, fontSize:'0.9375rem', marginRight:'auto' }}>{editingId ? 'Modifier le statut' : 'Ajouter un statut'}</span>
                    </div>
                    <div style={{ padding:'1.25rem 1.5rem', borderBottom:`1px solid ${BORDER}`, background:LIGHT }}>
                        <form onSubmit={handleSubmit} style={{ display:'flex', gap:'0.75rem', alignItems:'flex-end' }}>
                            <div style={{ flex:1 }}>
                                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
                                    Libellé du statut <span style={{color:ACC2}}>*</span>
                                </label>
                                <input className="so-inp"
                                    style={{ width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'white', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }}
                                    value={libelle} onChange={e => setLibelle(e.target.value)}
                                    placeholder="ex: Société Anonyme (SA), SARL, Administration..."
                                    required autoFocus
                                />
                            </div>
                            {editingId && (
                                <button type="button" onClick={() => { setEditingId(null); setLibelle('') }}
                                    style={{ padding:'0.7rem 1rem', borderRadius:'0.625rem', border:'1px solid #e2e8f0', background:'white', color:'#64748b', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                                    Annuler
                                </button>
                            )}
                            <button type="submit" disabled={saving || !libelle.trim()}
                                style={{ padding:'0.7rem 1.25rem', borderRadius:'0.625rem', background:GRAD, color:'white', border:'none', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.5rem', opacity:saving?0.7:1, whiteSpace:'nowrap' }}>
                                {saving ? '...' : editingId ? <><Save size={14}/> Mettre à jour</> : <><Plus size={14}/> Ajouter</>}
                            </button>
                        </form>
                    </div>

                    {/* Search + table */}
                    <div style={{ padding:'1rem 1.5rem', borderBottom:`1px solid #f1f5f9`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'0.875rem', fontWeight:700, color:'#475569' }}>
                            {filtered.length} statut{filtered.length!==1?'s':''} {searchQuery?'trouvé(s)':'au total'}
                        </span>
                        <div style={{ position:'relative' }}>
                            <Search size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
                            <input className="so-inp"
                                style={{ padding:'0.5rem 0.875rem 0.5rem 2.125rem', border:'1px solid #e2e8f0', borderRadius:'2rem', fontSize:'0.8rem', background:'#f8fafc', outline:'none', width:220 }}
                                placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                            <div style={{ width:28, height:28, border:`2px solid ${LIGHT}`, borderTopColor:ACC, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }}/>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead>
                                <tr style={{ background:LIGHT }}>
                                    {['Statut / Forme juridique','Actions'].map((h,i)=>(
                                        <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign:i===1?'right':'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${BORDER}` }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((s, i) => (
                                    <tr key={s.IDStatuts} className="so-row" onMouseEnter={()=>setHovRow(i)} onMouseLeave={()=>setHovRow(null)} style={{ background:hovRow===i?LIGHT:'white', transition:'background 0.15s' }}>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                                <div style={{ width:30, height:30, borderRadius:'0.5rem', background:LIGHT, border:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                                    <Building2 size={14} color={ACC}/>
                                                </div>
                                                <span style={{ fontWeight:700, color:'#0f172a' }}>{s.libelle}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                <button className="so-ab" onClick={() => { setEditingId(s.IDStatuts); setLibelle(s.libelle); window.scrollTo({top:0,behavior:'smooth'}) }}
                                                    style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }} title="Modifier"><Edit size={15}/></button>
                                                <button className="so-adel" onClick={() => handleDelete(s.IDStatuts)}
                                                    style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }} title="Supprimer"><Trash2 size={15}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={2} style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                                        <Building2 size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 1rem' }}/>
                                        {statuts.length===0 ? 'Aucun statut configuré.' : 'Aucun résultat.'}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </div>
            <Toast toasts={toasts}/>
        </div>
    )
}
