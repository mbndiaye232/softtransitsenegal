import React, { useState, useEffect } from 'react'
import {
    Plus, Pencil, Trash2, X, Save, ArrowLeft, Palette,
    CheckCircle2, AlertCircle, Layers, Eye
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const ACC = '#86198f'
const ACC2 = '#d946ef'
const LIGHT = '#fdf4ff'
const BORDER = '#f0abfc'
const GRAD = 'linear-gradient(135deg,#4a044e 0%,#86198f 45%,#d946ef 100%)'

const rgbToHex = (r, g, b) => '#' + (1<<24|r<<16|g<<8|b).toString(16).slice(1)
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? { r:parseInt(result[1],16), g:parseInt(result[2],16), b:parseInt(result[3],16) } : null
}

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

export default function CouleursPage() {
    const navigate = useNavigate()
    const [couleurs, setCouleurs] = useState([])
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [currentCouleur, setCurrentCouleur] = useState(null)
    const [formData, setFormData] = useState({ ndjours:0, Rouge:0, Vert:0, Bleu:0, hexColor:'#000000' })
    const [isLoading, setIsLoading] = useState(true)
    const [toasts, setToasts] = useState([])
    const [formError, setFormError] = useState('')
    const [hovRow, setHovRow] = useState(null)

    useEffect(() => { fetchCouleurs() }, [])

    const fetchCouleurs = async () => {
        try { setIsLoading(true); const r = await api.get('/couleurs'); setCouleurs(r.data) }
        catch { toast('error', 'Impossible de charger les codes couleurs') }
        finally { setIsLoading(false) }
    }

    const toast = (type, msg) => {
        const id = Date.now(); setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    const handleOpenForm = (couleur = null) => {
        setFormError('')
        if (couleur) {
            setCurrentCouleur(couleur)
            setFormData({ ndjours:couleur.ndjours, Rouge:couleur.Rouge, Vert:couleur.Vert, Bleu:couleur.Bleu, hexColor:rgbToHex(couleur.Rouge, couleur.Vert, couleur.Bleu) })
        } else {
            setCurrentCouleur(null)
            setFormData({ ndjours:0, Rouge:0, Vert:0, Bleu:0, hexColor:'#000000' })
        }
        setIsFormOpen(true)
    }

    const handleCloseForm = () => { setIsFormOpen(false); setCurrentCouleur(null); setFormError('') }

    const handleColorChange = (e) => {
        const hex = e.target.value; const rgb = hexToRgb(hex)
        if (rgb) setFormData(p => ({ ...p, hexColor:hex, Rouge:rgb.r, Vert:rgb.g, Bleu:rgb.b }))
        else setFormData(p => ({ ...p, hexColor:hex }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault(); setFormError('')
        const payload = { ndjours:parseInt(formData.ndjours,10), Rouge:parseInt(formData.Rouge,10), Vert:parseInt(formData.Vert,10), Bleu:parseInt(formData.Bleu,10) }
        try {
            if (currentCouleur) await api.put(`/couleurs/${currentCouleur.ndjours}`, payload)
            else await api.post('/couleurs', payload)
            await fetchCouleurs()
            handleCloseForm()
            toast('success', currentCouleur ? 'Code couleur mis à jour' : 'Code couleur ajouté')
        } catch (err) {
            setFormError(err.response?.data?.error || 'Erreur lors de la sauvegarde')
        }
    }

    const handleDelete = async (ndjours) => {
        if (!window.confirm('Supprimer ce code couleur ?')) return
        try { await api.delete(`/couleurs/${ndjours}`); await fetchCouleurs(); toast('success', 'Code couleur supprimé') }
        catch { toast('error', 'Impossible de supprimer ce code couleur') }
    }

    const numInputSt = { width:'100%', padding:'0.625rem 0.75rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                .cl-inp:focus{border-color:${ACC2}!important;background:white!important;box-shadow:0 0 0 3px ${LIGHT}!important}
                .cl-row:hover td{background:${LIGHT}!important}
                .cl-ab:hover{background:${LIGHT};color:${ACC}}
                .cl-adel:hover{background:#fee2e2!important;color:#dc2626!important}
            `}</style>

            {/* Hero */}
            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['22%','20%',280,'rgba(217,70,239,0.35)'],['68%','55%',200,'rgba(134,25,143,0.25)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(60px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1000, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Paramètres
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.625rem' }}><Palette size={28} color="white"/></div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Codes Couleurs</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Gérez les alertes visuelles selon le nombre de jours restants (ndjours)</p>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            <div style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <Layers size={18} color="rgba(255,255,255,0.8)"/>
                                <div>
                                    <div style={{ color:'white', fontWeight:800, fontSize:'1.25rem', lineHeight:1 }}>{isLoading?'—':couleurs.length}</div>
                                    <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.7rem', fontWeight:600, marginTop:'0.2rem' }}>Codes configurés</div>
                                </div>
                            </div>
                            {/* Mini palette preview */}
                            {!isLoading && couleurs.length > 0 && (
                                <div style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                                    <Eye size={16} color="rgba(255,255,255,0.7)"/>
                                    <div style={{ display:'flex', gap:'0.375rem' }}>
                                        {couleurs.slice(0,6).map(c => (
                                            <div key={c.ndjours} style={{ width:20, height:20, borderRadius:'50%', background:`rgb(${c.Rouge},${c.Vert},${c.Bleu})`, border:'2px solid rgba(255,255,255,0.4)' }} title={`${c.ndjours} j`}/>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth:1000, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative' }}>
                <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(134,25,143,0.08)', overflow:'hidden' }}>
                    {/* Card header */}
                    <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Palette size={18} color="white"/></div>
                            <span style={{ color:'white', fontWeight:700, fontSize:'0.9375rem' }}>Référentiel couleurs ({couleurs.length})</span>
                        </div>
                        <button onClick={() => handleOpenForm()} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'white', borderRadius:'0.625rem', padding:'0.5rem 1rem', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer' }}>
                            <Plus size={15}/> Ajouter
                        </button>
                    </div>

                    {isLoading ? (
                        <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                            <div style={{ width:28, height:28, border:`2px solid ${LIGHT}`, borderTopColor:ACC, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }}/>
                            Chargement...
                        </div>
                    ) : couleurs.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'5rem 2rem' }}>
                            <div style={{ width:64, height:64, background:LIGHT, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
                                <Palette size={32} color={ACC}/>
                            </div>
                            <h3 style={{ fontWeight:700, color:'#0f172a', margin:'0 0 0.5rem' }}>Aucun code couleur défini</h3>
                            <p style={{ color:'#64748b', margin:0 }}>Cliquez sur "Ajouter" pour créer le premier code.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead><tr style={{ background:LIGHT }}>
                                {['Réf. Jours','Aperçu','Valeurs RGB','Actions'].map((h,i)=>(
                                    <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign:i===3?'right':'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${BORDER}` }}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {couleurs.map((c, i) => {
                                    const hex = rgbToHex(c.Rouge, c.Vert, c.Bleu)
                                    return (
                                        <tr key={c.ndjours} className="cl-row" onMouseEnter={()=>setHovRow(i)} onMouseLeave={()=>setHovRow(null)} style={{ background:hovRow===i?LIGHT:'white', transition:'background 0.15s' }}>
                                            <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                                    <div style={{ width:30, height:30, borderRadius:'0.5rem', background:LIGHT, border:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', color:ACC, fontWeight:800, fontSize:'0.8rem', flexShrink:0 }}>{c.ndjours<0?'!':`${c.ndjours}`}</div>
                                                    <span style={{ fontWeight:700, color:'#0f172a' }}>
                                                        {c.ndjours===(-1)?'Retard':`${c.ndjours} jour${c.ndjours>1?'s':''}`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                                    <div style={{ width:36, height:36, borderRadius:'0.5rem', background:`rgb(${c.Rouge},${c.Vert},${c.Bleu})`, border:'2px solid rgba(0,0,0,0.08)', boxShadow:'0 2px 6px rgba(0,0,0,0.15)' }}/>
                                                    <span style={{ fontFamily:'monospace', fontSize:'0.8125rem', color:'#64748b', fontWeight:600 }}>{hex}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                <div style={{ display:'flex', gap:'0.5rem' }}>
                                                    {[['R',c.Rouge,'#ef4444'],['V',c.Vert,'#22c55e'],['B',c.Bleu,'#3b82f6']].map(([label,val,color])=>(
                                                        <span key={label} style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'0.5rem', padding:'0.25rem 0.625rem', fontSize:'0.75rem', fontFamily:'monospace', fontWeight:700 }}>
                                                            <span style={{ color, fontSize:'0.65rem' }}>{label}</span>{val}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                    <button className="cl-ab" onClick={() => handleOpenForm(c)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Pencil size={15}/></button>
                                                    <button className="cl-adel" onClick={() => handleDelete(c.ndjours)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Trash2 size={15}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isFormOpen && (
                <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150, padding:'1rem' }} onClick={handleCloseForm}>
                    <div style={{ background:'white', borderRadius:'1.25rem', width:'100%', maxWidth:500, boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', overflow:'hidden', animation:'slideUp 0.3s ease' }} onClick={e => e.stopPropagation()}>
                        <div style={{ background:GRAD, padding:'1.25rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.5rem', padding:'0.375rem', display:'flex' }}><Palette size={16} color="white"/></div>
                                <h2 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1rem' }}>{currentCouleur?'Modifier le code':'Nouveau code couleur'}</h2>
                            </div>
                            <button onClick={handleCloseForm} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', borderRadius:'0.5rem', padding:'0.375rem', cursor:'pointer', display:'flex' }}><X size={18}/></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                                {formError && (
                                    <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'0.625rem', padding:'0.75rem 1rem', color:'#991b1b', fontSize:'0.875rem', fontWeight:500 }}>{formError}</div>
                                )}
                                <div>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Nombre de jours (ndjours) <span style={{color:ACC2}}>*</span></label>
                                    <input className="cl-inp" type="number" style={numInputSt}
                                        value={formData.ndjours}
                                        onChange={e => setFormData(p => ({...p, ndjours:e.target.value}))}
                                        disabled={!!currentCouleur} required
                                        placeholder="ex: 0, 1, 3, 10 ou -1 pour retard"
                                    />
                                    {!!currentCouleur && <p style={{ margin:'0.375rem 0 0', fontSize:'0.7rem', color:'#94a3b8', fontStyle:'italic' }}>La clé ndjours ne peut pas être modifiée. Supprimez et recréez si nécessaire.</p>}
                                </div>
                                <div>
                                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.5rem' }}>Couleur</label>
                                    <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
                                        <input type="color" value={formData.hexColor} onChange={handleColorChange}
                                            style={{ width:56, height:56, padding:0, border:'none', borderRadius:'0.75rem', cursor:'pointer', overflow:'hidden', flexShrink:0 }}
                                        />
                                        <div style={{ display:'flex', gap:'0.625rem', flex:1 }}>
                                            {[['Rouge','Rouge',255,'#ef4444'],['Vert','Vert',255,'#22c55e'],['Bleu','Bleu',255,'#3b82f6']].map(([label, key, max, color]) => (
                                                <div key={key} style={{ flex:1 }}>
                                                    <label style={{ display:'block', fontSize:'0.65rem', fontWeight:800, color, textAlign:'center', marginBottom:'0.3rem' }}>{label}</label>
                                                    <input className="cl-inp" type="number" min="0" max={max}
                                                        style={{ ...numInputSt, textAlign:'center', fontFamily:'monospace', fontWeight:700 }}
                                                        value={formData[key]}
                                                        onChange={e => {
                                                            const v = e.target.value
                                                            setFormData(p => {
                                                                const updated = { ...p, [key]: v }
                                                                updated.hexColor = rgbToHex(updated.Rouge||0, updated.Vert||0, updated.Bleu||0)
                                                                return updated
                                                            })
                                                        }}
                                                        required
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <p style={{ margin:'0.5rem 0 0', fontSize:'0.7rem', color:'#94a3b8' }}>Utilisez la palette ou saisissez manuellement les composantes RGB (0–255).</p>
                                </div>
                                {/* Preview */}
                                <div style={{ background:LIGHT, border:`1px solid ${BORDER}`, borderRadius:'0.75rem', padding:'0.875rem 1rem', display:'flex', alignItems:'center', gap:'0.875rem' }}>
                                    <div style={{ width:40, height:40, borderRadius:'0.5rem', background:`rgb(${formData.Rouge||0},${formData.Vert||0},${formData.Bleu||0})`, border:'2px solid rgba(0,0,0,0.1)', flexShrink:0 }}/>
                                    <div>
                                        <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#475569' }}>Aperçu</div>
                                        <div style={{ fontFamily:'monospace', fontSize:'0.8rem', color:'#64748b' }}>{formData.hexColor} — RGB({formData.Rouge},{formData.Vert},{formData.Bleu})</div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding:'1rem 1.5rem', background:'#f8fafc', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'flex-end', gap:'0.75rem' }}>
                                <button type="button" onClick={handleCloseForm} style={{ padding:'0.7rem 1.25rem', borderRadius:'0.75rem', fontWeight:600, border:'1px solid #e2e8f0', background:'white', color:'#64748b', cursor:'pointer' }}>Annuler</button>
                                <button type="submit" style={{ padding:'0.7rem 1.5rem', borderRadius:'0.75rem', fontWeight:700, background:GRAD, color:'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                                    <Save size={14}/> {currentCouleur?'Mettre à jour':'Enregistrer'}
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
