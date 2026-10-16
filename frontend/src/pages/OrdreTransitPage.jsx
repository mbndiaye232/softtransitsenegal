import React, { useState, useEffect, useMemo } from 'react'
import {
    Plus, Search, ChevronRight, X, FileText, Globe,
    Package, Hash, Calendar, MapPin, Check, ClipboardList,
    Layers, CheckSquare, Square
} from 'lucide-react'
import {
    ordresTransitAPI, dossiersAPI, incotermsAPI,
    regimesOTAPI, typesDocumentsOTAPI
} from '../services/api'

/* ─── StatPill ───────────────────────────────────────────────────────────── */
const StatPill = ({ icon, label, value, color }) => (
    <div style={{
        display:'flex', alignItems:'center', gap:10,
        background:'white', border:`1.5px solid #e5e7eb`,
        borderRadius:14, padding:'12px 20px',
        boxShadow:'0 1px 3px rgba(0,0,0,.05)', minWidth:'fit-content',
    }}>
        <span style={{ color, display:'flex' }}>{icon}</span>
        <div>
            <div style={{ fontSize:20, fontWeight:800, color:'#111827', lineHeight:1 }}>{value}</div>
            <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>{label}</div>
        </div>
    </div>
)

/* ─── shared input style ─────────────────────────────────────────────────── */
const iBase = { width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, background:'#f8fafc', outline:'none', boxSizing:'border-box', fontFamily:'inherit', transition:'border-color .15s, box-shadow .15s' }
const onFoc = e => { e.target.style.borderColor='#334155'; e.target.style.boxShadow='0 0 0 3px rgba(51,65,85,.12)'; e.target.style.background='white' }
const onBlr = e => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none';  e.target.style.background='#f8fafc' }

export default function OrdreTransitPage() {
    const [ordres,    setOrdres]    = useState([])
    const [dossiers,  setDossiers]  = useState([])
    const [incoterms, setIncoterms] = useState([])
    const [regimes,   setRegimes]   = useState([])
    const [typesDocs, setTypesDocs] = useState([])
    const [loading,   setLoading]   = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [showModal,  setShowModal]  = useState(false)
    const [error,      setError]      = useState('')
    const [saving,     setSaving]     = useState(false)
    const [hoveredRow, setHoveredRow] = useState(null)

    const [formData, setFormData] = useState({
        NumeroOT: '', DateOT: new Date().toISOString().split('T')[0],
        DateReceptionOT: '', IDDossiers: '', NumeroSerie: '',
        Idincoterms: '', BSCExiste: false, AssuranceExiste: false,
        Observations: '', DateExpedition: '', AdresseDeLivraison: '',
        PROVENANCE: '', NatureProduits: '', Nbredecolis: '',
        PoidsNet: '', ValeurMarchandise: '', regimeIds: [], documents: []
    })

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [otRes, dosRes, incRes, regRes, typRes] = await Promise.all([
                ordresTransitAPI.getAll(), dossiersAPI.getAll(),
                incotermsAPI.getAll(), regimesOTAPI.getAll(), typesDocumentsOTAPI.getAll()
            ])
            setOrdres(otRes.data)
            setDossiers(dosRes.data)
            setIncoterms(incRes.data)
            setRegimes(regRes.data)
            setTypesDocs(typRes.data)
            setFormData(prev => ({
                ...prev,
                documents: typRes.data.map(t => ({
                    idtypesDocumentot: t.IDTypesDocumentsOT,
                    LibelleTypeDocumentsOT: t.LibelleTypeDocumentsOT,
                    Observations: '', Recu: 0, Aremettre: 1
                }))
            }))
        } catch (err) {
            console.error(err)
            setError('Impossible de charger les données')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            setSaving(true)
            await ordresTransitAPI.create(formData)
            setShowModal(false)
            loadData()
        } catch (err) {
            console.error(err)
            setError("Erreur lors de l'enregistrement")
        } finally {
            setSaving(false)
        }
    }

    const handleRegimeToggle = (id) => {
        setFormData(prev => {
            const cur = prev.regimeIds || []
            return { ...prev, regimeIds: cur.includes(id) ? cur.filter(r => r !== id) : [...cur, id] }
        })
    }

    const handleDocToggle = (index, field) => {
        setFormData(prev => {
            const docs = [...prev.documents]
            docs[index] = { ...docs[index], [field]: docs[index][field] ? 0 : 1 }
            if (field === 'Recu' && docs[index].Recu)
                docs[index].DateReceptionDocument = new Date().toISOString()
            return { ...prev, documents: docs }
        })
    }

    const filtered = useMemo(() => ordres.filter(o =>
        o.NumeroOT?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.dossier_code?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [ordres, searchTerm])

    /* ── Loading ── */
    if (loading) return (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#f1f5f9' }}>
            <div style={{ textAlign:'center' }}>
                <div style={{ width:44, height:44, border:'3px solid #e2e8f0', borderTopColor:'#334155', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 12px' }} />
                <div style={{ fontSize:14, color:'#475569', fontWeight:600 }}>Chargement des ordres…</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    return (
        <div style={{ minHeight:'100vh', background:'#f1f5f9', fontFamily:'inherit' }}>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
                padding: '32px 40px 72px', position:'relative', overflow:'hidden',
            }}>
                <div style={{ position:'absolute', top:-70, right:-70, width:250, height:250, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />
                <div style={{ position:'absolute', bottom:-30, right:200, width:130, height:130, background:'rgba(255,255,255,.03)', borderRadius:'50%' }} />
                <div style={{ position:'absolute', top:30, right:130, width:70, height:70, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:20, flexWrap:'wrap' }}>
                    <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                            <div style={{ background:'rgba(255,255,255,.12)', backdropFilter:'blur(6px)', borderRadius:99, padding:'5px 14px', border:'1px solid rgba(255,255,255,.18)', fontSize:12, fontWeight:700, color:'rgba(255,255,255,.9)', display:'flex', alignItems:'center', gap:6 }}>
                                <ClipboardList size={12}/> Transit
                            </div>
                        </div>
                        <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:'white', letterSpacing:'-.02em' }}>
                            Ordres de Transit
                        </h1>
                        <p style={{ margin:'8px 0 0', fontSize:14, color:'rgba(255,255,255,.65)', fontWeight:500 }}>
                            Gérez les ordres de transit et le suivi des documents.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 22px', borderRadius:14, border:'none', background:'white', color:'#0f172a', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 4px 14px rgba(0,0,0,.25)', transition:'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 20px rgba(0,0,0,.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(0,0,0,.25)'; }}
                    >
                        <Plus size={17}/> Nouveau OT
                    </button>
                </div>
            </div>

            {/* ── Floating content ─────────────────────────────────────────── */}
            <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 32px 48px', marginTop:'-48px', position:'relative', zIndex:1 }}>

                {/* Stats + search bar */}
                <div style={{ background:'white', borderRadius:20, border:'1px solid #e5e7eb', boxShadow:'0 8px 28px rgba(0,0,0,.10)', padding:'20px 28px', marginBottom:20, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
                    <StatPill icon={<ClipboardList size={20}/>} label="Total OT" value={ordres.length} color="#334155" />
                    <StatPill icon={<Globe size={20}/>}          label="Dossiers"  value={[...new Set(ordres.map(o=>o.IDDossiers))].length} color="#0284c7" />
                    <StatPill icon={<MapPin size={20}/>}         label="Provenances" value={[...new Set(ordres.map(o=>o.PROVENANCE).filter(Boolean))].length} color="#059669" />

                    <div style={{ marginLeft:'auto', position:'relative' }}>
                        <Search size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }} />
                        <input
                            type="text"
                            placeholder="Rechercher OT, Dossier…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ paddingLeft:36, paddingRight:14, paddingTop:9, paddingBottom:9, border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, outline:'none', width:260, background:'#f8fafc', transition:'all .15s' }}
                            onFocus={e => { e.target.style.borderColor='#334155'; e.target.style.boxShadow='0 0 0 3px rgba(51,65,85,.12)'; e.target.style.background='white'; }}
                            onBlur={e  => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; e.target.style.background='#f8fafc'; }}
                        />
                    </div>

                    {searchTerm && (
                        <span style={{ fontSize:12, color:'#6b7280', fontWeight:600 }}>
                            {filtered.length} résultat{filtered.length>1?'s':''}
                        </span>
                    )}
                </div>

                {/* Table */}
                <div style={{ background:'white', borderRadius:20, border:'1px solid #e5e7eb', boxShadow:'0 4px 16px rgba(0,0,0,.06)', overflow:'hidden' }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding:'64px 32px', textAlign:'center', color:'#9ca3af' }}>
                            <ClipboardList size={48} style={{ margin:'0 auto 14px', opacity:.15, display:'block' }} />
                            <div style={{ fontWeight:600, fontSize:15, color:'#6b7280' }}>Aucun ordre de transit trouvé</div>
                            <div style={{ fontSize:13, marginTop:6 }}>Créez votre premier OT en cliquant sur « Nouveau OT ».</div>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead>
                                <tr style={{ background:'#f8fafc', borderBottom:'2px solid #f1f5f9' }}>
                                    {['Numéro OT','Dossier','Date','Provenance','Incoterm',''].map((h,i) => (
                                        <th key={i} style={{ padding:'13px 22px', textAlign: i===5?'right':'left', fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.07em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(o => {
                                    const hov = hoveredRow === o.IDOrdresTransit
                                    return (
                                        <tr
                                            key={o.IDOrdresTransit}
                                            onMouseEnter={() => setHoveredRow(o.IDOrdresTransit)}
                                            onMouseLeave={() => setHoveredRow(null)}
                                            style={{ borderBottom:'1px solid #f8fafc', cursor:'pointer', background: hov ? '#f8fafc' : 'white', transition:'background .1s' }}
                                        >
                                            {/* N° OT */}
                                            <td style={{ padding:'14px 22px' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                                    <div style={{ width:36, height:36, borderRadius:10, background: hov ? '#0f172a' : '#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background .15s' }}>
                                                        <Hash size={15} color={ hov ? 'white' : '#94a3b8'} />
                                                    </div>
                                                    <span style={{ fontWeight:800, fontSize:14, color:'#111827', fontFamily:'monospace' }}>{o.NumeroOT}</span>
                                                </div>
                                            </td>

                                            {/* Dossier */}
                                            <td style={{ padding:'14px 22px' }}>
                                                <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color: hov?'#334155':'#2563eb', background: hov?'#e2e8f0':'#eff6ff', border:`1px solid ${hov?'#cbd5e1':'#dbeafe'}`, padding:'4px 9px', borderRadius:6, transition:'all .15s' }}>
                                                    {o.dossier_code}
                                                </span>
                                            </td>

                                            {/* Date */}
                                            <td style={{ padding:'14px 22px' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:6, color:'#374151', fontSize:13 }}>
                                                    <Calendar size={13} color="#9ca3af"/>
                                                    {new Date(o.DateOT).toLocaleDateString('fr-FR')}
                                                </div>
                                            </td>

                                            {/* Provenance */}
                                            <td style={{ padding:'14px 22px' }}>
                                                {o.PROVENANCE ? (
                                                    <div style={{ display:'flex', alignItems:'center', gap:6, color:'#374151', fontSize:13 }}>
                                                        <MapPin size={13} color="#9ca3af"/>
                                                        {o.PROVENANCE}
                                                    </div>
                                                ) : <span style={{ color:'#d1d5db', fontSize:13 }}>—</span>}
                                            </td>

                                            {/* Incoterm */}
                                            <td style={{ padding:'14px 22px' }}>
                                                {o.CodeIncoterm ? (
                                                    <span style={{ background:'#f1f5f9', color:'#475569', borderRadius:8, padding:'5px 11px', fontWeight:800, fontSize:12 }}>{o.CodeIncoterm}</span>
                                                ) : <span style={{ color:'#d1d5db', fontSize:13 }}>—</span>}
                                            </td>

                                            {/* Arrow */}
                                            <td style={{ padding:'14px 22px', textAlign:'right' }}>
                                                <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:8, background: hov?'#0f172a':'#f8fafc', transition:'all .15s' }}>
                                                    <ChevronRight size={15} color={hov?'white':'#d1d5db'} />
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        </div>
                    )}

                    {filtered.length > 0 && (
                        <div style={{ padding:'10px 22px', borderTop:'1px solid #f8fafc', fontSize:12, color:'#9ca3af', fontWeight:600 }}>
                            {filtered.length} ordre{filtered.length>1?'s':''} de transit
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal Nouveau OT ─────────────────────────────────────────── */}
            {showModal && (
                <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px' }}>
                    <div style={{ background:'white', width:'100%', maxWidth:960, maxHeight:'92vh', borderRadius:24, display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,.25)' }}>

                        {/* Modal header */}
                        <div style={{ padding:'20px 28px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                <div style={{ width:40, height:40, borderRadius:12, background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    <ClipboardList size={18} color="white"/>
                                </div>
                                <div>
                                    <div style={{ fontSize:16, fontWeight:800, color:'#111827' }}>Nouvel Ordre de Transit</div>
                                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:1 }}>Remplissez les informations de l'OT</div>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ width:34, height:34, borderRadius:10, border:'none', background:'#f1f5f9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}>
                                <X size={16}/>
                            </button>
                        </div>

                        {/* Modal body */}
                        <form onSubmit={handleSubmit} style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
                            {error && (
                                <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:10, padding:'10px 16px', color:'#be123c', fontWeight:600, fontSize:13, marginBottom:18 }}>{error}</div>
                            )}

                            {/* Grid: base fields */}
                            <ModalSection icon={<FileText size={14}/>} title="Identification">
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>
                                    <MField label="Numéro OT" required>
                                        <input value={formData.NumeroOT} onChange={e => setFormData({...formData, NumeroOT:e.target.value})} style={iBase} onFocus={onFoc} onBlur={onBlr} required placeholder="Ex: 87666" />
                                    </MField>
                                    <MField label="Dossier" required>
                                        <select value={formData.IDDossiers} onChange={e => setFormData({...formData, IDDossiers:e.target.value})} style={{...iBase, cursor:'pointer'}} onFocus={onFoc} onBlur={onBlr} required>
                                            <option value="">Sélectionner un dossier</option>
                                            {dossiers.map(d => <option key={d.id} value={d.id}>{d.code} — {d.label}</option>)}
                                        </select>
                                    </MField>
                                    <MField label="Provenance">
                                        <input value={formData.PROVENANCE} onChange={e => setFormData({...formData, PROVENANCE:e.target.value})} style={iBase} onFocus={onFoc} onBlur={onBlr} placeholder="Pays ou ville d'origine" />
                                    </MField>
                                    <MField label="Incoterm">
                                        <select value={formData.Idincoterms} onChange={e => setFormData({...formData, Idincoterms:e.target.value})} style={{...iBase, cursor:'pointer'}} onFocus={onFoc} onBlur={onBlr}>
                                            <option value="">Sélectionner incoterm</option>
                                            {incoterms.map(i => <option key={i.IDIncoterm} value={i.IDIncoterm}>{i.CodeIncoterm}</option>)}
                                        </select>
                                    </MField>
                                    <MField label="Date OT">
                                        <input type="date" value={formData.DateOT} onChange={e => setFormData({...formData, DateOT:e.target.value})} style={iBase} onFocus={onFoc} onBlur={onBlr} />
                                    </MField>
                                    <MField label="Date Réception OT">
                                        <input type="date" value={formData.DateReceptionOT} onChange={e => setFormData({...formData, DateReceptionOT:e.target.value})} style={iBase} onFocus={onFoc} onBlur={onBlr} />
                                    </MField>
                                </div>
                            </ModalSection>

                            {/* Régimes */}
                            {regimes.length > 0 && (
                                <ModalSection icon={<Layers size={14}/>} title="Régimes OT">
                                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                                        {regimes.map(r => {
                                            const checked = formData.regimeIds.includes(r.IDRegimeOT)
                                            return (
                                                <div
                                                    key={r.IDRegimeOT}
                                                    onClick={() => handleRegimeToggle(r.IDRegimeOT)}
                                                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${checked?'#334155':'#e5e7eb'}`, background: checked?'#f8fafc':'#fafafa', cursor:'pointer', transition:'all .15s' }}
                                                >
                                                    <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${checked?'#334155':'#d1d5db'}`, background: checked?'#0f172a':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>
                                                        {checked && <Check size={12} color="white"/>}
                                                    </div>
                                                    <span style={{ fontSize:13, fontWeight:checked?700:500, color: checked?'#111827':'#6b7280' }}>
                                                        {r.CodeRegimeOT} — {r.LibelleRegimeOT}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </ModalSection>
                            )}

                            {/* Documents */}
                            {formData.documents.length > 0 && (
                                <ModalSection icon={<FileText size={14}/>} title="Documents à remettre">
                                    <div style={{ border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                            <thead>
                                                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                                                    {['Document','Reçu','À remettre'].map((h,i) => (
                                                        <th key={i} style={{ padding:'10px 16px', textAlign: i===0?'left':'center', fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {formData.documents.map((doc, idx) => (
                                                    <tr key={idx} style={{ borderBottom:'1px solid #f8fafc' }}>
                                                        <td style={{ padding:'10px 16px', fontSize:13, color:'#374151', fontWeight:500 }}>{doc.LibelleTypeDocumentsOT}</td>
                                                        {['Recu','Aremettre'].map(field => (
                                                            <td key={field} style={{ padding:'10px 16px', textAlign:'center' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDocToggle(idx, field)}
                                                                    style={{ border:'none', background:'none', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', padding:4 }}
                                                                >
                                                                    {doc[field] === 1
                                                                        ? <CheckSquare size={18} color="#0f172a"/>
                                                                        : <Square size={18} color="#d1d5db"/>
                                                                    }
                                                                </button>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        </div>
                                    </div>
                                </ModalSection>
                            )}

                            {/* Footer */}
                            <div style={{ display:'flex', justifyContent:'flex-end', gap:12, paddingTop:8 }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 22px', borderRadius:12, border:'1px solid #e5e7eb', background:'white', color:'#374151', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                                    <X size={15}/> Annuler
                                </button>
                                <button type="submit" disabled={saving} style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 26px', borderRadius:12, border:'none', background: saving?'#94a3b8':'linear-gradient(135deg,#1e293b,#334155)', color:'white', fontWeight:700, fontSize:13, cursor: saving?'not-allowed':'pointer', boxShadow:'0 4px 14px rgba(15,23,42,.35)', transition:'all .15s' }}>
                                    {saving ? 'Enregistrement…' : <><Check size={15}/> Enregistrer</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )
}

/* ─── Modal helpers ──────────────────────────────────────────────────────── */
const ModalSection = ({ icon, title, children }) => (
    <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, paddingBottom:10, borderBottom:'1px solid #f1f5f9' }}>
            <div style={{ color:'#475569', display:'flex' }}>{icon}</div>
            <span style={{ fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em' }}>{title}</span>
        </div>
        {children}
    </div>
)

const MField = ({ label, required, children }) => (
    <div>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#475569', marginBottom:6 }}>
            {label}{required && <span style={{ color:'#ef4444', marginLeft:3 }}>*</span>}
        </label>
        {children}
    </div>
)
