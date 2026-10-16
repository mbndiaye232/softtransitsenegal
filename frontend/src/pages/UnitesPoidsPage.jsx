import React, { useState, useEffect } from 'react'
import {
    Scale, Plus, Search, Trash2, Edit, ArrowLeft,
    CheckCircle2, AlertCircle, Save, ShieldCheck, Layers
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { unitesPoidsAPI } from '../services/api'

const ACC = '#1e40af'
const ACC2 = '#3b82f6'
const LIGHT = '#eff6ff'
const BORDER = '#bfdbfe'
const GRAD = 'linear-gradient(135deg,#1e3a8a 0%,#1e40af 45%,#3b82f6 100%)'

function Toast({ toasts }) {
    return (
        <div style={{ position:'fixed', bottom:'2rem', right:'2rem', zIndex:200, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {toasts.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1.25rem', background:t.type==='success'?'#ecfdf5':'#fef2f2', border:`1px solid ${t.type==='success'?'#6ee7b7':'#fca5a5'}`, color:t.type==='success'?'#065f46':'#991b1b', borderRadius:'0.875rem', boxShadow:'0 10px 25px -5px rgba(0,0,0,0.12)', fontWeight:600, fontSize:'0.875rem', animation:'slideUp 0.3s ease' }}>
                    {t.type==='success'?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>} {t.msg}
                </div>
            ))}
        </div>
    )
}

export default function UnitesPoidsPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [unites, setUnites] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [libelle, setLibelle] = useState('')
    const [saving, setSaving] = useState(false)
    const [toasts, setToasts] = useState([])
    const [hovRow, setHovRow] = useState(null)

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try { setLoading(true); const r = await unitesPoidsAPI.getAll(); setUnites(r.data) }
        catch { toast('error', 'Erreur lors du chargement') }
        finally { setLoading(false) }
    }

    const toast = (type, msg) => {
        const id = Date.now(); setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    const resetForm = () => { setLibelle(''); setEditingId(null) }

    const handleSubmit = async (e) => {
        e.preventDefault(); if (!libelle.trim()) return; setSaving(true)
        try {
            if (editingId) { await unitesPoidsAPI.update(editingId, { LibelleUnitePoids: libelle }); toast('success', 'Unité mise à jour') }
            else { await unitesPoidsAPI.create({ LibelleUnitePoids: libelle }); toast('success', 'Unité ajoutée') }
            resetForm(); loadData()
        } catch { toast('error', "Erreur lors de l'enregistrement") }
        finally { setSaving(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer cette unité de poids ?')) return
        try { await unitesPoidsAPI.delete(id); toast('success', 'Unité supprimée'); loadData() }
        catch { toast('error', 'Impossible (utilisée ailleurs)') }
    }

    const filtered = unites.filter(u => u.LibelleUnitePoids?.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                .up-inp:focus{border-color:${ACC2}!important;background:white!important;box-shadow:0 0 0 3px ${LIGHT}!important}
                .up-row:hover td{background:${LIGHT}!important}
                .up-ab:hover{background:${LIGHT};color:${ACC}}
                .up-adel:hover{background:#fee2e2!important;color:#dc2626!important}
            `}</style>

            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['25%','20%',260,'rgba(59,130,246,0.35)'],['70%','55%',180,'rgba(30,64,175,0.25)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(60px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1000, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Paramètres
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.625rem' }}><Scale size={28} color="white"/></div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Unités de Poids</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Kg, Gramme, Tonne — référentiel pour quantifier les marchandises</p>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <Layers size={18} color="rgba(255,255,255,0.8)"/>
                            <div>
                                <div style={{ color:'white', fontWeight:800, fontSize:'1.25rem', lineHeight:1 }}>{loading?'—':unites.length}</div>
                                <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.7rem', fontWeight:600, marginTop:'0.2rem' }}>Unités configurées</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth:1100, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative', display:'grid', gridTemplateColumns:'280px 1fr', gap:'1.75rem', alignItems:'start' }}>
                {/* Form */}
                <div style={{ position:'sticky', top:'5rem' }}>
                    <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(30,64,175,0.08)', overflow:'hidden' }}>
                        <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}>{editingId?<Edit size={18} color="white"/>:<Plus size={18} color="white"/>}</div>
                            <span style={{ color:'white', fontWeight:700 }}>{editingId?"Modifier l'unité":'Nouvelle unité'}</span>
                        </div>
                        <form onSubmit={handleSubmit} style={{ padding:'1.5rem' }}>
                            <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Libellé <span style={{color:ACC2}}>*</span></label>
                            <input className="up-inp"
                                style={{ width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box', marginBottom:'1rem' }}
                                value={libelle} onChange={e => setLibelle(e.target.value)}
                                placeholder="ex: Kg, Gramme, Tonne..." required autoFocus
                            />
                            <button type="submit" disabled={saving||!libelle.trim()}
                                style={{ width:'100%', padding:'0.75rem', background:GRAD, color:'white', border:'none', borderRadius:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', opacity:saving?0.7:1 }}>
                                {saving?'...':(editingId?<><Save size={14}/> Mettre à jour</>:<><Plus size={14}/> Ajouter</>)}
                            </button>
                            {editingId&&<button type="button" onClick={resetForm} style={{ width:'100%', padding:'0.7rem', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:'0.75rem', fontWeight:600, cursor:'pointer', marginTop:'0.5rem' }}>Annuler</button>}
                        </form>
                        <div style={{ margin:'0 1.5rem 1.5rem', padding:'0.875rem 1rem', background:LIGHT, borderRadius:'0.75rem', border:`1px dashed ${BORDER}`, display:'flex', gap:'0.625rem', alignItems:'flex-start' }}>
                            <ShieldCheck size={14} color={ACC} style={{ flexShrink:0, marginTop:1 }}/>
                            <p style={{ margin:0, fontSize:'0.75rem', color:'#475569', lineHeight:1.5 }}>Ces unités quantifient les marchandises dans les dossiers de transit.</p>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(30,64,175,0.08)', overflow:'hidden' }}>
                    <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Scale size={18} color="white"/></div>
                            <span style={{ color:'white', fontWeight:700 }}>Référentiel ({filtered.length})</span>
                        </div>
                        <div style={{ position:'relative' }}>
                            <Search size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.6)' }}/>
                            <input style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'2rem', padding:'0.375rem 0.875rem 0.375rem 2.125rem', color:'white', fontSize:'0.8rem', outline:'none', width:180 }}
                                placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
                        </div>
                    </div>
                    {loading?(
                        <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                            <div style={{ width:28, height:28, border:`2px solid ${LIGHT}`, borderTopColor:ACC, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }}/>
                        </div>
                    ):(
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead><tr style={{ background:LIGHT }}>
                                {['Unité de poids','Actions'].map((h,i)=>(
                                    <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign:i===1?'right':'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${BORDER}` }}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {filtered.map((u, i) => (
                                    <tr key={u.IDUnitePoids} className="up-row" onMouseEnter={()=>setHovRow(i)} onMouseLeave={()=>setHovRow(null)} style={{ background:hovRow===i?LIGHT:'white', transition:'background 0.15s' }}>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                                <div style={{ width:30, height:30, borderRadius:'0.5rem', background:LIGHT, border:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Scale size={14} color={ACC}/></div>
                                                <span style={{ fontWeight:700, color:'#0f172a' }}>{u.LibelleUnitePoids}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                <button className="up-ab" onClick={() => { setEditingId(u.IDUnitePoids); setLibelle(u.LibelleUnitePoids) }} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Edit size={15}/></button>
                                                <button className="up-adel" onClick={() => handleDelete(u.IDUnitePoids)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Trash2 size={15}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length===0&&<tr><td colSpan={2} style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                                    <Scale size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 1rem' }}/>
                                    {unites.length===0?'Aucune unité configurée.':'Aucun résultat.'}
                                </td></tr>}
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
