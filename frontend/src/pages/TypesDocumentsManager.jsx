import React, { useState, useEffect } from 'react'
import { typesDocumentsAPI } from '../services/api'
import {
    FileText, Plus, Trash2, Edit2, X, Save,
    CheckCircle2, AlertCircle, ArrowLeft, Layers, Hash
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ACC = '#1d4ed8'
const ACC2 = '#3b82f6'
const LIGHT = '#eff6ff'
const BORDER = '#bfdbfe'
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

const TypesDocumentsManager = () => {
    const navigate = useNavigate()
    const [types, setTypes] = useState([])
    const [loading, setLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({ label:'' })
    const [saving, setSaving] = useState(false)
    const [toasts, setToasts] = useState([])
    const [hovRow, setHovRow] = useState(null)
    const [search, setSearch] = useState('')

    useEffect(() => { fetchTypes() }, [])

    const fetchTypes = async () => {
        try {
            setLoading(true)
            const res = await typesDocumentsAPI.getAll()
            setTypes(Array.isArray(res.data) ? res.data : [])
        } catch { toast('error', 'Erreur lors du chargement') }
        finally { setLoading(false) }
    }

    const toast = (type, msg) => {
        const id = Date.now(); setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true)
        try {
            if (editingId) { await typesDocumentsAPI.update(editingId, formData); toast('success', 'Type mis à jour') }
            else { await typesDocumentsAPI.create(formData); toast('success', 'Type ajouté') }
            setShowModal(false); setEditingId(null); setFormData({ label:'' }); fetchTypes()
        } catch { toast('error', 'Erreur lors de la sauvegarde') }
        finally { setSaving(false) }
    }

    const handleEdit = (type) => { setEditingId(type.id); setFormData({ label:type.label }); setShowModal(true) }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce type de document ?')) return
        try { await typesDocumentsAPI.delete(id); fetchTypes(); toast('success', 'Type supprimé') }
        catch (err) {
            if (err.response?.status === 400) toast('error', 'Impossible : type utilisé par des documents.')
            else toast('error', 'Erreur lors de la suppression.')
        }
    }

    const filtered = types.filter(t => t.label?.toLowerCase().includes(search.toLowerCase()))

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                .td-inp:focus{border-color:${ACC2}!important;background:white!important;box-shadow:0 0 0 3px ${LIGHT}!important}
                .td-row:hover td{background:${LIGHT}!important}
                .td-ab:hover{background:${LIGHT};color:${ACC}}
                .td-adel:hover{background:#fee2e2!important;color:#dc2626!important}
            `}</style>

            {/* Hero */}
            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['25%','20%',260,'rgba(59,130,246,0.35)'],['70%','55%',180,'rgba(109,40,217,0.25)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(60px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1000, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Paramètres
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.625rem' }}><FileText size={28} color="white"/></div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Types de Documents</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Facture Proforma, Attestation, B/L — référentiel des catégories documentaires</p>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <Layers size={18} color="rgba(255,255,255,0.8)"/>
                            <div>
                                <div style={{ color:'white', fontWeight:800, fontSize:'1.25rem', lineHeight:1 }}>{loading?'—':types.length}</div>
                                <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.7rem', fontWeight:600, marginTop:'0.2rem' }}>Types configurés</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth:1000, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative' }}>
                <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(29,78,216,0.08)', overflow:'hidden' }}>
                    {/* Card header */}
                    <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><FileText size={18} color="white"/></div>
                            <span style={{ color:'white', fontWeight:700, fontSize:'0.9375rem' }}>Types de documents ({filtered.length})</span>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
                            <div style={{ position:'relative' }}>
                                <input style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'2rem', padding:'0.375rem 0.875rem 0.375rem 0.875rem', color:'white', fontSize:'0.8rem', outline:'none', width:200 }}
                                    placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}/>
                            </div>
                            <button onClick={() => { setEditingId(null); setFormData({ label:'' }); setShowModal(true) }}
                                style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'white', borderRadius:'0.625rem', padding:'0.5rem 1rem', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer' }}>
                                <Plus size={15}/> Nouveau type
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                            <div style={{ width:28, height:28, border:`2px solid ${LIGHT}`, borderTopColor:ACC, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }}/>
                        </div>
                    ) : filtered.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead><tr style={{ background:LIGHT }}>
                                {['ID','Libellé du type de document','Actions'].map((h,i)=>(
                                    <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign:i===2?'right':'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${BORDER}` }}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {filtered.map((type, i) => (
                                    <tr key={type.id} className="td-row" onMouseEnter={()=>setHovRow(i)} onMouseLeave={()=>setHovRow(null)} style={{ background:hovRow===i?LIGHT:'white', transition:'background 0.15s' }}>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', width:70 }}>
                                            <span style={{ background:LIGHT, color:ACC, padding:'0.2rem 0.5rem', borderRadius:'0.375rem', fontFamily:'monospace', fontWeight:800, fontSize:'0.75rem', border:`1px solid ${BORDER}` }}>#{type.id}</span>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                                <div style={{ width:30, height:30, borderRadius:'0.5rem', background:LIGHT, border:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><FileText size={14} color={ACC}/></div>
                                                <span style={{ fontWeight:700, color:'#0f172a' }}>{type.label}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                <button className="td-ab" onClick={() => handleEdit(type)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Edit2 size={14}/></button>
                                                <button className="td-adel" onClick={() => handleDelete(type.id)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot><tr><td colSpan={3} style={{ padding:'0.875rem 1.25rem', fontSize:'0.75rem', color:'#94a3b8', borderTop:'1px solid #f1f5f9', textAlign:'right' }}>
                                {filtered.length} type{filtered.length>1?'s':''} au total
                            </td></tr></tfoot>
                        </table>
                        </div>
                    ) : (
                        <div style={{ textAlign:'center', padding:'5rem 2rem' }}>
                            <div style={{ width:64, height:64, background:LIGHT, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
                                <FileText size={32} color={ACC}/>
                            </div>
                            <h3 style={{ fontWeight:700, color:'#0f172a', margin:'0 0 0.5rem' }}>Aucun type de document</h3>
                            <p style={{ color:'#64748b', margin:0 }}>{search?`Aucun résultat pour "${search}"`:'Cliquez sur "Nouveau type" pour commencer.'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150, padding:'1rem' }}>
                    <div style={{ background:'white', borderRadius:'1.25rem', width:'100%', maxWidth:460, boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', overflow:'hidden', animation:'slideUp 0.3s ease' }}>
                        <div style={{ background:GRAD, padding:'1.25rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.5rem', padding:'0.375rem', display:'flex' }}><FileText size={16} color="white"/></div>
                                <h2 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1rem' }}>{editingId?'Modifier le type':'Nouveau type de document'}</h2>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', borderRadius:'0.5rem', padding:'0.375rem', cursor:'pointer', display:'flex' }}><X size={18}/></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div style={{ padding:'1.5rem' }}>
                                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Libellé <span style={{color:ACC2}}>*</span></label>
                                <input className="td-inp"
                                    style={{ width:'100%', padding:'0.75rem 1rem', border:'1px solid #e2e8f0', borderRadius:'0.75rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }}
                                    required value={formData.label}
                                    onChange={e => setFormData({...formData, label:e.target.value})}
                                    placeholder="Ex: Facture Proforma, Attestation, B/L..."
                                    autoFocus
                                />
                            </div>
                            <div style={{ padding:'1rem 1.5rem', background:'#f8fafc', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'flex-end', gap:'0.75rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding:'0.7rem 1.25rem', borderRadius:'0.75rem', fontWeight:600, border:'1px solid #e2e8f0', background:'white', color:'#64748b', cursor:'pointer' }}>Annuler</button>
                                <button type="submit" disabled={saving||!formData.label.trim()} style={{ padding:'0.7rem 1.5rem', borderRadius:'0.75rem', fontWeight:700, background:GRAD, color:'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.5rem', opacity:saving?0.7:1 }}>
                                    {saving?'...':(editingId?<><Save size={14}/> Mettre à jour</>:<><Plus size={14}/> Ajouter</>)}
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

export default TypesDocumentsManager
