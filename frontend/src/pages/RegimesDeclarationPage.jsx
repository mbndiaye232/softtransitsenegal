import React, { useState, useEffect } from 'react'
import {
    FileSpreadsheet, Plus, Search, Trash2, Edit, ArrowLeft,
    CheckCircle2, AlertCircle, Save, ShieldCheck, ClipboardList, Hash, Layers, Eye
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { regimesAPI } from '../services/api'

const ACC = '#9f1239'
const ACC2 = '#e11d48'
const LIGHT = '#fff1f2'
const BORDER = '#fecdd3'
const GRAD = 'linear-gradient(135deg,#881337 0%,#9f1239 45%,#e11d48 100%)'

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

// Bulle en position fixe : le tableau est dans un conteneur à défilement qui rognerait une bulle absolue
function RegimeInfo({ regime, codeAdditionnel }) {
    const [pos, setPos] = useState(null)
    const show = (e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const x = Math.min(Math.max(r.left + r.width / 2, 160), window.innerWidth - 160)
        setPos(r.top < 100 ? { x, y: r.bottom + 8, below: true } : { x, y: r.top - 8, below: false })
    }
    return (
        <>
            <button type="button" className="rd-ab" aria-label="Voir le régime et le code additionnel"
                onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)}
                style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'help', transition:'all 0.15s' }}>
                <Eye size={15}/>
            </button>
            {pos && (
                <div role="tooltip" style={{ position:'fixed', left:pos.x, top:pos.y, transform:`translate(-50%, ${pos.below ? '0' : '-100%'})`, zIndex:300, background:'#0f172a', color:'white', padding:'0.625rem 0.875rem', borderRadius:'0.625rem', fontSize:'0.78rem', lineHeight:1.55, maxWidth:320, boxShadow:'0 10px 25px -5px rgba(0,0,0,0.3)', pointerEvents:'none' }}>
                    <div><span style={{ opacity:0.65 }}>Régime : </span><strong>{regime || '—'}</strong></div>
                    <div><span style={{ opacity:0.65 }}>Code additionnel : </span>{codeAdditionnel || '—'}</div>
                </div>
            )}
        </>
    )
}

function BlockCard({ title, icon: Icon, action, children }) {
    return (
        <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(159,18,57,0.08)', overflow:'hidden' }}>
            <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                    {Icon&&<div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Icon size={18} color="white"/></div>}
                    <span style={{ color:'white', fontWeight:700, fontSize:'0.9375rem' }}>{title}</span>
                </div>
                {action}
            </div>
            <div style={{ overflowX: 'auto' }}>{children}</div>
        </div>
    )
}

const inputSt = { width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', color:'#0f172a', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }

export default function RegimesDeclarationPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [regimes, setRegimes] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({ CodeRegimeDeclaration:'', LibelleRegimeDeclaration:'', Observations:'' })
    const [saving, setSaving] = useState(false)
    const [toasts, setToasts] = useState([])
    const [hovRow, setHovRow] = useState(null)

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try { setLoading(true); const r = await regimesAPI.getAll(); setRegimes(r.data) }
        catch { toast('error', 'Erreur lors du chargement') }
        finally { setLoading(false) }
    }

    const toast = (type, msg) => {
        const id = Date.now(); setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    const resetForm = () => { setFormData({ CodeRegimeDeclaration:'', LibelleRegimeDeclaration:'', Observations:'' }); setEditingId(null) }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.CodeRegimeDeclaration.trim() || !formData.LibelleRegimeDeclaration.trim()) return
        setSaving(true)
        try {
            if (editingId) { await regimesAPI.update(editingId, formData); toast('success', 'Régime mis à jour') }
            else { await regimesAPI.create(formData); toast('success', 'Régime ajouté') }
            resetForm(); loadData()
        } catch { toast('error', "Erreur lors de l'enregistrement") }
        finally { setSaving(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce régime ?')) return
        try { await regimesAPI.delete(id); toast('success', 'Régime supprimé'); loadData() }
        catch { toast('error', 'Impossible (utilisé ailleurs)') }
    }

    const filtered = regimes.filter(r =>
        r.CodeRegimeDeclaration?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.LibelleRegimeDeclaration?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                .rd-inp:focus{border-color:${ACC2}!important;background:white!important;box-shadow:0 0 0 3px ${LIGHT}!important}
                .rd-row:hover td{background:${LIGHT}!important}
                .rd-ab:hover{background:${LIGHT};color:${ACC}}
                .rd-adel:hover{background:#fee2e2!important;color:#dc2626!important}
            `}</style>

            {/* Hero */}
            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['25%','20%',260,'rgba(225,29,72,0.35)'],['70%','55%',180,'rgba(159,18,57,0.25)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(60px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1440, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Paramètres
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.625rem' }}><ClipboardList size={28} color="white"/></div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Régimes de Déclaration</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Codes douaniers utilisés lors de la création des dossiers de transit</p>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            {[
                                { label:'Total régimes', value:regimes.length, icon:Layers },
                                { label:'Avec observations', value:regimes.filter(r=>r.Observations).length, icon:ClipboardList },
                            ].map(({ label, value, icon:Ic }) => (
                                <div key={label} style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                    <Ic size={18} color="rgba(255,255,255,0.8)"/>
                                    <div>
                                        <div style={{ color:'white', fontWeight:800, fontSize:'1.25rem', lineHeight:1 }}>{loading?'—':value}</div>
                                        <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.7rem', fontWeight:600, marginTop:'0.2rem' }}>{label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth:1440, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative', display:'grid', gridTemplateColumns:'340px 1fr', gap:'1.75rem', alignItems:'start' }}>
                {/* Form */}
                <div style={{ position:'sticky', top:'5rem' }}>
                    <BlockCard title={editingId?'Modifier le régime':'Nouveau régime'} icon={editingId?Edit:Plus}>
                        <form onSubmit={handleSubmit} style={{ padding:'1.5rem' }}>
                            <div style={{ marginBottom:'1rem' }}>
                                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Code déclaration <span style={{color:ACC2}}>*</span></label>
                                <input className="rd-inp" style={inputSt}
                                    value={formData.CodeRegimeDeclaration}
                                    onChange={e => setFormData({...formData, CodeRegimeDeclaration:e.target.value})}
                                    placeholder="ex: 5403" required autoFocus
                                />
                            </div>
                            <div style={{ marginBottom:'1rem' }}>
                                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Libellé complet <span style={{color:ACC2}}>*</span></label>
                                <textarea className="rd-inp" rows={3}
                                    style={{ ...inputSt, minHeight:80, resize:'vertical' }}
                                    value={formData.LibelleRegimeDeclaration}
                                    onChange={e => setFormData({...formData, LibelleRegimeDeclaration:e.target.value})}
                                    placeholder="ex: ENTREE EN ENTREPOT FICTIF..." required
                                />
                            </div>
                            <div style={{ marginBottom:'1.25rem' }}>
                                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Observations</label>
                                <textarea className="rd-inp" rows={2}
                                    style={{ ...inputSt, minHeight:60, resize:'vertical' }}
                                    value={formData.Observations}
                                    onChange={e => setFormData({...formData, Observations:e.target.value})}
                                    placeholder="Note additionnelle..."
                                />
                            </div>
                            <button type="submit" disabled={saving||!formData.CodeRegimeDeclaration.trim()||!formData.LibelleRegimeDeclaration.trim()}
                                style={{ width:'100%', padding:'0.8rem', background:GRAD, color:'white', border:'none', borderRadius:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', opacity:saving?0.7:1 }}>
                                {saving?'...':(editingId?<><Save size={14}/> Mettre à jour</>:<><Plus size={14}/> Ajouter</>)}
                            </button>
                            {editingId&&<button type="button" onClick={resetForm} style={{ width:'100%', padding:'0.7rem', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:'0.75rem', fontWeight:600, cursor:'pointer', marginTop:'0.5rem' }}>Annuler</button>}
                        </form>
                        <div style={{ margin:'0 1.5rem 1.5rem', padding:'0.875rem 1rem', background:LIGHT, borderRadius:'0.75rem', border:`1px dashed ${BORDER}`, display:'flex', gap:'0.625rem' }}>
                            <ShieldCheck size={14} color={ACC} style={{ flexShrink:0, marginTop:1 }}/>
                            <p style={{ margin:0, fontSize:'0.75rem', color:'#475569', lineHeight:1.5 }}>Ces codes sont utilisés lors de la création des dossiers de transit (OT).</p>
                        </div>
                    </BlockCard>
                </div>

                {/* List */}
                <BlockCard title={`Référentiel régimes (${filtered.length})`} icon={ClipboardList}
                    action={
                        <div style={{ position:'relative' }}>
                            <Search size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.6)' }}/>
                            <input style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'2rem', padding:'0.375rem 0.875rem 0.375rem 2.125rem', color:'white', fontSize:'0.8rem', outline:'none', width:220 }}
                                placeholder="Code ou libellé..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
                        </div>
                    }>
                    {loading?(
                        <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                            <div style={{ width:28, height:28, border:`2px solid ${LIGHT}`, borderTopColor:ACC, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }}/>
                        </div>
                    ):(
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead><tr style={{ background:LIGHT }}>
                                {['Code','Libellé','Observations','Actions'].map((h,i)=>(
                                    <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign:i===3?'right':'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${BORDER}` }}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {filtered.map((r, i) => (
                                    <tr key={r.IDRegimeDeclaration} className="rd-row" onMouseEnter={()=>setHovRow(i)} onMouseLeave={()=>setHovRow(null)} style={{ background:hovRow===i?LIGHT:'white', transition:'background 0.15s' }}>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <span style={{ background:LIGHT, color:ACC, padding:'0.25rem 0.625rem', borderRadius:'0.375rem', fontFamily:'monospace', fontWeight:800, fontSize:'0.8rem', border:`1px solid ${BORDER}` }}>{r.CodeRegimeDeclaration}</span>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', fontWeight:600, color:'#0f172a', fontSize:'0.875rem', maxWidth:280 }}>
                                            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.LibelleRegimeDeclaration}>{r.LibelleRegimeDeclaration}</div>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', fontSize:'0.8125rem', color:'#64748b', maxWidth:200 }}>
                                            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.Observations}>{r.Observations||<span style={{opacity:0.3}}>—</span>}</div>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                <RegimeInfo regime={r.regime} codeAdditionnel={r.code_additionnel} />
                                                <button className="rd-ab" onClick={() => { setEditingId(r.IDRegimeDeclaration); setFormData({ CodeRegimeDeclaration:r.CodeRegimeDeclaration, LibelleRegimeDeclaration:r.LibelleRegimeDeclaration, Observations:r.Observations||'' }) }} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Edit size={15}/></button>
                                                <button className="rd-adel" onClick={() => handleDelete(r.IDRegimeDeclaration)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Trash2 size={15}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length===0&&<tr><td colSpan={4} style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                                    <ClipboardList size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 1rem' }}/>
                                    {regimes.length===0?'Aucun régime configuré.':'Aucun résultat.'}
                                </td></tr>}
                            </tbody>
                            {filtered.length>0&&<tfoot><tr><td colSpan={4} style={{ padding:'0.875rem 1.25rem', fontSize:'0.75rem', color:'#94a3b8', borderTop:'1px solid #f1f5f9', textAlign:'right' }}>{filtered.length} régime{filtered.length>1?'s':''} au total</td></tr></tfoot>}
                        </table>
                        </div>
                    )}
                </BlockCard>
            </div>
            <Toast toasts={toasts}/>
        </div>
    )
}
