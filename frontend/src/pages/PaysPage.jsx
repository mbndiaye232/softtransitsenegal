import React, { useState, useEffect } from 'react'
import { paysAPI } from '../services/api'
import {
    Globe, Plus, Search, Edit2, Trash2, X,
    CheckCircle2, AlertCircle, ArrowLeft, RefreshCw,
    Languages, Hash, MapPin, Layers, Save
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ACC = '#0e7490'
const ACC2 = '#0891b2'
const LIGHT = '#ecfeff'
const BORDER = '#a5f3fc'
const GRAD = 'var(--hero-gradient)'

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

const inputSt = { width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }

export default function PaysPage() {
    const navigate = useNavigate()
    const [countries, setCountries] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [toasts, setToasts] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({ NomPays:'', codePays3:'', CodePays2:'', CodeNumerique:'', NomPaysEng:'' })
    const [hovRow, setHovRow] = useState(null)

    useEffect(() => { loadCountries() }, [])

    const loadCountries = async () => {
        try { setLoading(true); const r = await paysAPI.getAll(); setCountries(r.data) }
        catch { toast('error', 'Erreur lors du chargement') }
        finally { setLoading(false) }
    }

    const toast = (type, msg) => {
        const id = Date.now(); setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    const handleOpenModal = (item = null) => {
        setEditingItem(item)
        setFormData(item
            ? { NomPays:item.NomPays||'', codePays3:item.codePays3||'', CodePays2:item.CodePays2||'', CodeNumerique:item.CodeNumerique||'', NomPaysEng:item.NomPaysEng||'' }
            : { NomPays:'', codePays3:'', CodePays2:'', CodeNumerique:'', NomPaysEng:'' })
        setIsModalOpen(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault(); setSaving(true)
        try {
            if (editingItem) { await paysAPI.update(editingItem.IDPays, formData); toast('success', 'Pays mis à jour') }
            else { await paysAPI.create(formData); toast('success', 'Pays ajouté') }
            setIsModalOpen(false); loadCountries()
        } catch (err) { toast('error', err.response?.data?.error || "Erreur lors de l'enregistrement") }
        finally { setSaving(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce pays ?')) return
        try { await paysAPI.delete(id); toast('success', 'Pays supprimé'); loadCountries() }
        catch (err) { toast('error', err.response?.data?.error || 'Erreur') }
    }

    const filtered = countries.filter(c =>
        (c.NomPays||'').toLowerCase().includes(search.toLowerCase()) ||
        (c.NomPaysEng||'').toLowerCase().includes(search.toLowerCase()) ||
        (c.CodePays2||'').toLowerCase().includes(search.toLowerCase()) ||
        (c.codePays3||'').toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                .py-inp:focus{border-color:${ACC2}!important;background:white!important;box-shadow:0 0 0 3px ${LIGHT}!important}
                .py-row:hover td{background:${LIGHT}!important}
                .py-ab:hover{background:${LIGHT};color:${ACC}}
                .py-adel:hover{background:#fee2e2!important;color:#dc2626!important}
            `}</style>

            {/* Hero */}
            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['20%','25%',280,'rgba(8,145,178,0.3)'],['72%','55%',200,'rgba(14,116,144,0.2)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(60px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1440, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Paramètres
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.625rem' }}><Globe size={28} color="white"/></div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Gestion des Pays</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Référentiel mondial des pays et leurs codes ISO</p>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            <div style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <Layers size={18} color="rgba(255,255,255,0.8)"/>
                                <div>
                                    <div style={{ color:'white', fontWeight:800, fontSize:'1.25rem', lineHeight:1 }}>{loading?'—':countries.length}</div>
                                    <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.7rem', fontWeight:600, marginTop:'0.2rem' }}>Pays configurés</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth:1440, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative' }}>
                <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(14,116,144,0.08)', overflow:'hidden' }}>
                    {/* Card header */}
                    <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Globe size={18} color="white"/></div>
                            <span style={{ color:'white', fontWeight:700, fontSize:'0.9375rem' }}>Pays ({filtered.length})</span>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap' }}>
                            <div style={{ position:'relative' }}>
                                <Search size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.6)' }}/>
                                <input style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'2rem', padding:'0.375rem 0.875rem 0.375rem 2.125rem', color:'white', fontSize:'0.8rem', outline:'none', width:240 }}
                                    placeholder="Nom ou code ISO..." value={search} onChange={e => setSearch(e.target.value)}/>
                            </div>
                            <button onClick={loadCountries} style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'0.625rem', padding:'0.375rem 0.75rem', cursor:'pointer' }}>
                                <RefreshCw size={14} style={loading?{animation:'spin 1s linear infinite'}:{}}/>
                            </button>
                            <button onClick={() => handleOpenModal()} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'white', borderRadius:'0.625rem', padding:'0.5rem 1rem', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer' }}>
                                <Plus size={15}/> Nouveau pays
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                            <div style={{ width:28, height:28, border:`2px solid ${LIGHT}`, borderTopColor:ACC, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }}/>
                            Chargement...
                        </div>
                    ) : filtered.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead><tr style={{ background:LIGHT }}>
                                {['#','Nom (FR)','Nom (EN)','ISO 2','ISO 3','Num.','Actions'].map((h,i)=>(
                                    <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign:i===6?'right':'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${BORDER}`, whiteSpace:'nowrap' }}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {filtered.map((c, i) => (
                                    <tr key={c.IDPays} className="py-row" onMouseEnter={()=>setHovRow(i)} onMouseLeave={()=>setHovRow(null)} style={{ background:hovRow===i?LIGHT:'white', transition:'background 0.15s' }}>
                                        <td style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid #f1f5f9', color:'#94a3b8', fontSize:'0.75rem', fontWeight:700, fontFamily:'monospace' }}>{String(i+1).padStart(3,'0')}</td>
                                        <td style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid #f1f5f9', fontWeight:700, color:'#0f172a' }}>{c.NomPays}</td>
                                        <td style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid #f1f5f9', color:'#64748b', fontSize:'0.875rem' }}>{c.NomPaysEng||<span style={{opacity:0.3}}>—</span>}</td>
                                        <td style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            {c.CodePays2&&<span style={{ background:`${ACC}15`, color:ACC, padding:'0.2rem 0.5rem', borderRadius:'0.375rem', fontFamily:'monospace', fontWeight:800, fontSize:'0.75rem', border:`1px solid ${BORDER}` }}>{c.CodePays2}</span>}
                                        </td>
                                        <td style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            {c.codePays3&&<span style={{ background:'#f1f5f9', color:'#475569', padding:'0.2rem 0.5rem', borderRadius:'0.375rem', fontFamily:'monospace', fontWeight:800, fontSize:'0.75rem', border:'1px solid #e2e8f0' }}>{c.codePays3}</span>}
                                        </td>
                                        <td style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:'0.8rem', color:'#64748b', fontWeight:600 }}>
                                            {c.CodeNumerique ? String(c.CodeNumerique).padStart(3,'0') : <span style={{opacity:0.3}}>—</span>}
                                        </td>
                                        <td style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                <button className="py-ab" onClick={() => handleOpenModal(c)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Edit2 size={14}/></button>
                                                <button className="py-adel" onClick={() => handleDelete(c.IDPays)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot><tr><td colSpan={7} style={{ padding:'0.875rem 1.25rem', fontSize:'0.75rem', color:'#94a3b8', borderTop:'1px solid #f1f5f9', textAlign:'right' }}>
                                {filtered.length} pays{filtered.length>1?'':''} {search?'trouvé(s)':'au total'}
                            </td></tr></tfoot>
                        </table>
                        </div>
                    ) : (
                        <div style={{ textAlign:'center', padding:'5rem 2rem' }}>
                            <div style={{ width:64, height:64, background:LIGHT, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
                                <Globe size={32} color={ACC}/>
                            </div>
                            <h3 style={{ fontWeight:700, color:'#0f172a', margin:'0 0 0.5rem' }}>Aucun pays trouvé</h3>
                            <p style={{ color:'#64748b', margin:0 }}>{search?`Aucun résultat pour "${search}"`:'Ajoutez votre premier pays.'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150, padding:'1rem' }}>
                    <div style={{ background:'white', borderRadius:'1.25rem', width:'100%', maxWidth:580, boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', overflow:'hidden', animation:'slideUp 0.3s ease' }}>
                        <div style={{ background:GRAD, padding:'1.25rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.5rem', padding:'0.375rem', display:'flex' }}><Globe size={16} color="white"/></div>
                                <h2 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1rem' }}>{editingItem?'Modifier le pays':'Ajouter un pays'}</h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', borderRadius:'0.5rem', padding:'0.375rem', cursor:'pointer', display:'flex' }}><X size={18}/></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding:'1.5rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                                {/* Nom FR — full width */}
                                <div style={{ gridColumn:'span 2' }}>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Nom du pays (Français) <span style={{color:ACC2}}>*</span></label>
                                    <div style={{ position:'relative' }}>
                                        <MapPin size={14} style={{ position:'absolute', left:'0.875rem', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
                                        <input className="py-inp" style={{ ...inputSt, paddingLeft:'2.5rem' }}
                                            placeholder="Ex: Sénégal, France, Canada..." value={formData.NomPays}
                                            onChange={e => setFormData({...formData, NomPays:e.target.value})} required autoFocus/>
                                    </div>
                                </div>
                                {/* Nom EN — full width */}
                                <div style={{ gridColumn:'span 2' }}>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Nom du pays (Anglais)</label>
                                    <div style={{ position:'relative' }}>
                                        <Languages size={14} style={{ position:'absolute', left:'0.875rem', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
                                        <input className="py-inp" style={{ ...inputSt, paddingLeft:'2.5rem' }}
                                            placeholder="Ex: Senegal, France, Canada..." value={formData.NomPaysEng}
                                            onChange={e => setFormData({...formData, NomPaysEng:e.target.value})}/>
                                    </div>
                                </div>
                                {/* Code Num */}
                                <div>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Code numérique</label>
                                    <div style={{ position:'relative' }}>
                                        <Hash size={14} style={{ position:'absolute', left:'0.875rem', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
                                        <input className="py-inp" type="number" style={{ ...inputSt, paddingLeft:'2.5rem', fontFamily:'monospace' }}
                                            placeholder="686" value={formData.CodeNumerique} onChange={e => setFormData({...formData, CodeNumerique:e.target.value})}/>
                                    </div>
                                </div>
                                {/* ISO 2 */}
                                <div>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Code ISO 2</label>
                                    <input className="py-inp" style={{ ...inputSt, fontFamily:'monospace', fontWeight:700, textTransform:'uppercase' }}
                                        placeholder="SN" maxLength={2} value={formData.CodePays2}
                                        onChange={e => setFormData({...formData, CodePays2:e.target.value.toUpperCase()})}/>
                                </div>
                                {/* ISO 3 */}
                                <div>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Code ISO 3</label>
                                    <input className="py-inp" style={{ ...inputSt, fontFamily:'monospace', fontWeight:700, textTransform:'uppercase' }}
                                        placeholder="SEN" maxLength={3} value={formData.codePays3}
                                        onChange={e => setFormData({...formData, codePays3:e.target.value.toUpperCase()})}/>
                                </div>
                            </div>
                            <div style={{ padding:'1rem 1.5rem', background:'#f8fafc', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'flex-end', gap:'0.75rem' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding:'0.7rem 1.25rem', borderRadius:'0.75rem', fontWeight:600, border:'1px solid #e2e8f0', background:'white', color:'#64748b', cursor:'pointer' }}>Annuler</button>
                                <button type="submit" disabled={saving} style={{ padding:'0.7rem 1.5rem', borderRadius:'0.75rem', fontWeight:700, background:GRAD, color:'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.5rem', opacity:saving?0.7:1 }}>
                                    {saving?'...':(editingItem?<><Save size={14}/> Mettre à jour</>:<><Plus size={14}/> Ajouter</>)}
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
