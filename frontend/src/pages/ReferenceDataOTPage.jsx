import React, { useState, useEffect } from 'react'
import {
    Globe, Layers, FileText, Plus, Search, Trash2, Edit,
    ArrowLeft, CheckCircle2, AlertCircle, Save, ShieldCheck,
    Hash, AlignLeft, Settings2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { incotermsAPI, regimesOTAPI, typesDocumentsOTAPI } from '../services/api'

/* ─── Per-tab theme config ────────────────────────────────────────────────── */
const TABS = [
    {
        id: 'incoterms',
        label: 'Incoterms',
        icon: Globe,
        grad: 'var(--hero-gradient)',
        acc: '#1d4ed8', acc2: '#3b82f6',
        light: '#eff6ff', border: '#bfdbfe',
    },
    {
        id: 'regimes',
        label: 'Régimes OT',
        icon: Layers,
        grad: 'var(--hero-gradient)',
        acc: '#b45309', acc2: '#d97706',
        light: '#fffbeb', border: '#fde68a',
    },
    {
        id: 'typesDocs',
        label: 'Types Documents OT',
        icon: FileText,
        grad: 'var(--hero-gradient)',
        acc: '#1e40af', acc2: '#1d4ed8',
        light: '#eff6ff', border: '#bfdbfe',
    },
]

const HERO_GRAD = 'var(--hero-gradient)'

/* ─── Toast ───────────────────────────────────────────────────────────────── */
function Toast({ toasts }) {
    return (
        <div style={{ position:'fixed', bottom:'2rem', right:'2rem', zIndex:300, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {toasts.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1.25rem', background:t.type==='success'?'#ecfdf5':'#fef2f2', border:`1px solid ${t.type==='success'?'#6ee7b7':'#fca5a5'}`, color:t.type==='success'?'#065f46':'#991b1b', borderRadius:'0.875rem', boxShadow:'0 10px 25px -5px rgba(0,0,0,0.12)', fontWeight:600, fontSize:'0.875rem', animation:'slideUp 0.3s ease' }}>
                    {t.type==='success'?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>} {t.msg}
                </div>
            ))}
        </div>
    )
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function ReferenceDataOTPage() {
    const navigate = useNavigate()
    const [incoterms, setIncoterms] = useState([])
    const [regimes,   setRegimes]   = useState([])
    const [typesDocs, setTypesDocs] = useState([])
    const [loading,   setLoading]   = useState(true)
    const [activeTab, setActiveTab] = useState('incoterms')
    const [toasts,    setToasts]    = useState([])
    const [search,    setSearch]    = useState('')

    /* Incoterm form */
    const [incCode,  setIncCode]  = useState('')
    const [incObs,   setIncObs]   = useState('')
    const [incEdit,  setIncEdit]  = useState(null)
    const [incSave,  setIncSave]  = useState(false)

    /* Régime OT form */
    const [regCode,  setRegCode]  = useState('')
    const [regLib,   setRegLib]   = useState('')
    const [regObs,   setRegObs]   = useState('')
    const [regEdit,  setRegEdit]  = useState(null)
    const [regSave,  setRegSave]  = useState(false)

    /* Types Docs OT form */
    const [tdLib,    setTdLib]    = useState('')
    const [tdObs,    setTdObs]    = useState('')
    const [tdEdit,   setTdEdit]   = useState(null)
    const [tdSave,   setTdSave]   = useState(false)

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [incRes, regRes, typRes] = await Promise.all([
                incotermsAPI.getAll(), regimesOTAPI.getAll(), typesDocumentsOTAPI.getAll()
            ])
            setIncoterms(incRes.data)
            setRegimes(regRes.data)
            setTypesDocs(typRes.data)
        } catch (err) {
            toast('error', 'Erreur lors du chargement des données')
        } finally {
            setLoading(false)
        }
    }

    const toast = (type, msg) => {
        const id = Date.now()
        setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    /* ── Incoterm handlers ── */
    const handleIncSubmit = async (e) => {
        e.preventDefault(); if (!incCode.trim()) return; setIncSave(true)
        try {
            if (incEdit) {
                await incotermsAPI.update(incEdit, { CodeIncoterm: incCode, Observations: incObs })
                toast('success', 'Incoterm mis à jour')
            } else {
                await incotermsAPI.create({ CodeIncoterm: incCode, Observations: incObs })
                toast('success', 'Incoterm ajouté')
            }
            setIncCode(''); setIncObs(''); setIncEdit(null); loadData()
        } catch { toast('error', "Erreur lors de l'enregistrement") }
        finally { setIncSave(false) }
    }
    const handleIncDelete = async (id) => {
        if (!window.confirm('Supprimer cet incoterm ?')) return
        try { await incotermsAPI.delete(id); toast('success', 'Incoterm supprimé'); loadData() }
        catch { toast('error', 'Impossible de supprimer') }
    }

    /* ── Régime OT handlers ── */
    const handleRegSubmit = async (e) => {
        e.preventDefault(); if (!regCode.trim() || !regLib.trim()) return; setRegSave(true)
        try {
            if (regEdit) {
                await regimesOTAPI.update(regEdit, { CodeRegimeOT: regCode, LibelleRegimeOT: regLib, Observations: regObs })
                toast('success', 'Régime OT mis à jour')
            } else {
                await regimesOTAPI.create({ CodeRegimeOT: regCode, LibelleRegimeOT: regLib, Observations: regObs })
                toast('success', 'Régime OT ajouté')
            }
            setRegCode(''); setRegLib(''); setRegObs(''); setRegEdit(null); loadData()
        } catch { toast('error', "Erreur lors de l'enregistrement") }
        finally { setRegSave(false) }
    }
    const handleRegDelete = async (id) => {
        if (!window.confirm('Supprimer ce régime OT ?')) return
        try { await regimesOTAPI.delete(id); toast('success', 'Régime supprimé'); loadData() }
        catch { toast('error', 'Impossible de supprimer') }
    }

    /* ── Types Docs OT handlers ── */
    const handleTdSubmit = async (e) => {
        e.preventDefault(); if (!tdLib.trim()) return; setTdSave(true)
        try {
            if (tdEdit) {
                await typesDocumentsOTAPI.update(tdEdit, { LibelleTypeDocumentsOT: tdLib, Observations: tdObs })
                toast('success', 'Type de document mis à jour')
            } else {
                await typesDocumentsOTAPI.create({ LibelleTypeDocumentsOT: tdLib, Observations: tdObs })
                toast('success', 'Type de document ajouté')
            }
            setTdLib(''); setTdObs(''); setTdEdit(null); loadData()
        } catch { toast('error', "Erreur lors de l'enregistrement") }
        finally { setTdSave(false) }
    }
    const handleTdDelete = async (id) => {
        if (!window.confirm('Supprimer ce type de document ?')) return
        try { await typesDocumentsOTAPI.delete(id); toast('success', 'Type supprimé'); loadData() }
        catch { toast('error', 'Impossible de supprimer') }
    }

    const tabCfg = TABS.find(t => t.id === activeTab)

    /* ── filtered data ── */
    const q = search.toLowerCase()
    const filteredInc = incoterms.filter(i => i.CodeIncoterm?.toLowerCase().includes(q) || i.Observations?.toLowerCase().includes(q))
    const filteredReg = regimes.filter(r => r.CodeRegimeOT?.toLowerCase().includes(q) || r.LibelleRegimeOT?.toLowerCase().includes(q) || r.Observations?.toLowerCase().includes(q))
    const filteredTd  = typesDocs.filter(t => t.LibelleTypeDocumentsOT?.toLowerCase().includes(q) || t.Observations?.toLowerCase().includes(q))

    const currentFiltered = activeTab === 'incoterms' ? filteredInc : activeTab === 'regimes' ? filteredReg : filteredTd

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                .ot-inp:focus{border-color:var(--acc2)!important;background:white!important;box-shadow:0 0 0 3px var(--light)!important}
                .ot-row:hover td{background:var(--light)!important}
                .ot-btn-edit:hover{background:var(--light)!important;color:var(--acc)!important}
                .ot-btn-del:hover{background:#fee2e2!important;color:#dc2626!important}
                .ot-tab:hover{background:#f1f5f9}
            `}</style>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div style={{ background:HERO_GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['15%','20%',300,'rgba(59,130,246,0.3)'],['72%','50%',200,'rgba(30,64,175,0.25)'],['45%','60%',150,'rgba(59,130,246,0.2)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(70px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1200, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Paramètres
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.625rem' }}><Settings2 size={28} color="white"/></div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Configuration Transit</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Incoterms, régimes OT et types de documents — référentiels des ordres de transit</p>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            {TABS.map(tab => (
                                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch('') }}
                                    style={{ background: activeTab===tab.id ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)', backdropFilter:'blur(12px)', border:`1px solid ${activeTab===tab.id?'rgba(255,255,255,0.45)':'rgba(255,255,255,0.18)'}`, borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem', cursor:'pointer', transition:'all 0.2s' }}>
                                    <tab.icon size={16} color="rgba(255,255,255,0.85)"/>
                                    <div style={{ textAlign:'left' }}>
                                        <div style={{ color:'white', fontWeight:800, fontSize:'1.1rem', lineHeight:1 }}>{loading?'—':(tab.id==='incoterms'?incoterms.length:tab.id==='regimes'?regimes.length:typesDocs.length)}</div>
                                        <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.68rem', fontWeight:600, marginTop:'0.2rem', whiteSpace:'nowrap' }}>{tab.label}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Content ───────────────────────────────────────────────────── */}
            <div style={{ maxWidth:1200, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative', zIndex:1 }}>

                {/* ── Tab bar ── */}
                <div style={{ background:'white', borderRadius:'1.25rem', border:'1px solid #e2e8f0', boxShadow:'0 8px 28px rgba(0,0,0,0.08)', padding:'0.5rem', marginBottom:'1.75rem', display:'inline-flex', gap:'0.375rem' }}>
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id
                        return (
                            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch('') }}
                                className={!isActive ? 'ot-tab' : ''}
                                style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.625rem 1.25rem', borderRadius:'0.875rem', border:'none', cursor:'pointer', fontSize:'0.8rem', fontWeight:700, transition:'all 0.15s', background:isActive?tab.grad:'transparent', color:isActive?'white':'#64748b', boxShadow:isActive?`0 4px 14px ${tab.acc}40`:'none' }}>
                                <tab.icon size={14}/>
                                {tab.label}
                                <span style={{ fontSize:'0.7rem', fontWeight:800, padding:'0.125rem 0.5rem', borderRadius:'99px', background:isActive?'rgba(255,255,255,0.2)':'#f1f5f9', color:isActive?'white':'#94a3b8' }}>
                                    {tab.id==='incoterms'?incoterms.length:tab.id==='regimes'?regimes.length:typesDocs.length}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* ── Tab content (split layout) ── */}
                <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'1.75rem', alignItems:'start',
                    '--acc': tabCfg.acc, '--acc2': tabCfg.acc2, '--light': tabCfg.light }}>

                    {/* Form panel */}
                    <div style={{ position:'sticky', top:'5rem' }}>
                        <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${tabCfg.border}`, boxShadow:`0 4px 24px ${tabCfg.acc}14`, overflow:'hidden' }}>
                            <div style={{ background:tabCfg.grad, padding:'1rem 1.5rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}>
                                    {activeTab==='incoterms' && (activeTab && TABS[0].icon) ? <Globe size={18} color="white"/> : activeTab==='regimes' ? <Layers size={18} color="white"/> : <FileText size={18} color="white"/>}
                                </div>
                                <span style={{ color:'white', fontWeight:700 }}>
                                    {(activeTab==='incoterms' ? incEdit : activeTab==='regimes' ? regEdit : tdEdit) ? 'Modifier' : 'Ajouter'} — {tabCfg.label}
                                </span>
                            </div>

                            {/* ── Incoterm form ── */}
                            {activeTab === 'incoterms' && (
                                <form onSubmit={handleIncSubmit} style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
                                    <div>
                                        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Code <span style={{color:tabCfg.acc2}}>*</span></label>
                                        <input className="ot-inp" style={{ width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }}
                                            value={incCode} onChange={e => setIncCode(e.target.value)} placeholder="ex: CIF, FOB, EXW…" required/>
                                    </div>
                                    <div>
                                        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Observations</label>
                                        <textarea className="ot-inp" style={{ width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box', resize:'vertical', minHeight:80, fontFamily:'inherit' }}
                                            value={incObs} onChange={e => setIncObs(e.target.value)} placeholder="Description, notes…"/>
                                    </div>
                                    <button type="submit" disabled={incSave||!incCode.trim()}
                                        style={{ width:'100%', padding:'0.75rem', background:tabCfg.grad, color:'white', border:'none', borderRadius:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', opacity:incSave?0.7:1 }}>
                                        {incSave?'…':(incEdit?<><Save size={14}/> Mettre à jour</>:<><Plus size={14}/> Ajouter</>)}
                                    </button>
                                    {incEdit && <button type="button" onClick={() => { setIncCode(''); setIncObs(''); setIncEdit(null) }} style={{ width:'100%', padding:'0.7rem', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:'0.75rem', fontWeight:600, cursor:'pointer' }}>Annuler</button>}
                                </form>
                            )}

                            {/* ── Régime OT form ── */}
                            {activeTab === 'regimes' && (
                                <form onSubmit={handleRegSubmit} style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
                                    <div>
                                        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Code <span style={{color:tabCfg.acc2}}>*</span></label>
                                        <input className="ot-inp" style={{ width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }}
                                            value={regCode} onChange={e => setRegCode(e.target.value)} placeholder="ex: C100, D300…" required/>
                                    </div>
                                    <div>
                                        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Libellé <span style={{color:tabCfg.acc2}}>*</span></label>
                                        <input className="ot-inp" style={{ width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }}
                                            value={regLib} onChange={e => setRegLib(e.target.value)} placeholder="Libellé du régime…" required/>
                                    </div>
                                    <div>
                                        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Observations</label>
                                        <textarea className="ot-inp" style={{ width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box', resize:'vertical', minHeight:72, fontFamily:'inherit' }}
                                            value={regObs} onChange={e => setRegObs(e.target.value)} placeholder="Notes optionnelles…"/>
                                    </div>
                                    <button type="submit" disabled={regSave||!regCode.trim()||!regLib.trim()}
                                        style={{ width:'100%', padding:'0.75rem', background:tabCfg.grad, color:'white', border:'none', borderRadius:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', opacity:regSave?0.7:1 }}>
                                        {regSave?'…':(regEdit?<><Save size={14}/> Mettre à jour</>:<><Plus size={14}/> Ajouter</>)}
                                    </button>
                                    {regEdit && <button type="button" onClick={() => { setRegCode(''); setRegLib(''); setRegObs(''); setRegEdit(null) }} style={{ width:'100%', padding:'0.7rem', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:'0.75rem', fontWeight:600, cursor:'pointer' }}>Annuler</button>}
                                </form>
                            )}

                            {/* ── Types Docs OT form ── */}
                            {activeTab === 'typesDocs' && (
                                <form onSubmit={handleTdSubmit} style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
                                    <div>
                                        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Libellé <span style={{color:tabCfg.acc2}}>*</span></label>
                                        <input className="ot-inp" style={{ width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box' }}
                                            value={tdLib} onChange={e => setTdLib(e.target.value)} placeholder="Nom du type de document…" required/>
                                    </div>
                                    <div>
                                        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Observations</label>
                                        <textarea className="ot-inp" style={{ width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', transition:'all 0.2s', boxSizing:'border-box', resize:'vertical', minHeight:80, fontFamily:'inherit' }}
                                            value={tdObs} onChange={e => setTdObs(e.target.value)} placeholder="Description, notes…"/>
                                    </div>
                                    <button type="submit" disabled={tdSave||!tdLib.trim()}
                                        style={{ width:'100%', padding:'0.75rem', background:tabCfg.grad, color:'white', border:'none', borderRadius:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', opacity:tdSave?0.7:1 }}>
                                        {tdSave?'…':(tdEdit?<><Save size={14}/> Mettre à jour</>:<><Plus size={14}/> Ajouter</>)}
                                    </button>
                                    {tdEdit && <button type="button" onClick={() => { setTdLib(''); setTdObs(''); setTdEdit(null) }} style={{ width:'100%', padding:'0.7rem', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:'0.75rem', fontWeight:600, cursor:'pointer' }}>Annuler</button>}
                                </form>
                            )}

                            <div style={{ margin:'0 1.5rem 1.5rem', padding:'0.875rem 1rem', background:tabCfg.light, borderRadius:'0.75rem', border:`1px dashed ${tabCfg.border}`, display:'flex', gap:'0.625rem', alignItems:'flex-start' }}>
                                <ShieldCheck size={14} color={tabCfg.acc} style={{ flexShrink:0, marginTop:1 }}/>
                                <p style={{ margin:0, fontSize:'0.75rem', color:'#475569', lineHeight:1.5 }}>
                                    {activeTab==='incoterms' && 'Les incoterms définissent les conditions de livraison et transfert de risques.'}
                                    {activeTab==='regimes' && 'Les régimes OT catégorisent les traitements douaniers des ordres de transit.'}
                                    {activeTab==='typesDocs' && 'Ces types classifient les documents requis dans les opérations de transit.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* List panel */}
                    <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${tabCfg.border}`, boxShadow:`0 4px 24px ${tabCfg.acc}14`, overflow:'hidden' }}>
                        {/* Panel header */}
                        <div style={{ background:tabCfg.grad, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}>
                                    {activeTab==='incoterms'?<Globe size={18} color="white"/>:activeTab==='regimes'?<Layers size={18} color="white"/>:<FileText size={18} color="white"/>}
                                </div>
                                <span style={{ color:'white', fontWeight:700 }}>
                                    {tabCfg.label} ({currentFiltered.length})
                                </span>
                            </div>
                            <div style={{ position:'relative' }}>
                                <Search size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.6)' }}/>
                                <input style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'2rem', padding:'0.375rem 0.875rem 0.375rem 2.125rem', color:'white', fontSize:'0.8rem', outline:'none', width:180 }}
                                    placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}/>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                                <div style={{ width:28, height:28, border:`2px solid ${tabCfg.light}`, borderTopColor:tabCfg.acc, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }}/>
                            </div>
                        ) : (
                            <>
                                {/* ── Incoterms table ── */}
                                {activeTab === 'incoterms' && (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                        <thead><tr style={{ background:tabCfg.light }}>
                                            {['Code Incoterm','Observations','Actions'].map((h,i) => (
                                                <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign:i===2?'right':'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${tabCfg.border}` }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {filteredInc.map((inc, idx) => (
                                                <tr key={inc.IDIncoterm} className="ot-row" style={{ transition:'background 0.15s', '--light':tabCfg.light }}>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                        <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:'0.8rem', background:tabCfg.light, color:tabCfg.acc, border:`1px solid ${tabCfg.border}`, borderRadius:'0.5rem', padding:'0.25rem 0.625rem' }}>{inc.CodeIncoterm}</span>
                                                    </td>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', fontSize:'0.875rem', color:'#475569' }}>{inc.Observations||<span style={{color:'#d1d5db'}}>—</span>}</td>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                        <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                            <button className="ot-btn-edit" onClick={() => { setIncEdit(inc.IDIncoterm); setIncCode(inc.CodeIncoterm); setIncObs(inc.Observations||'') }} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s', '--light':tabCfg.light, '--acc':tabCfg.acc }}><Edit size={15}/></button>
                                                            <button className="ot-btn-del" onClick={() => handleIncDelete(inc.IDIncoterm)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Trash2 size={15}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredInc.length===0 && <tr><td colSpan={3} style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                                                <Globe size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 1rem' }}/>
                                                {incoterms.length===0?'Aucun incoterm configuré.':'Aucun résultat.'}
                                            </td></tr>}
                                        </tbody>
                                    </table>
                                    </div>
                                )}

                                {/* ── Régimes OT table ── */}
                                {activeTab === 'regimes' && (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                        <thead><tr style={{ background:tabCfg.light }}>
                                            {['Code','Libellé','Observations','Actions'].map((h,i) => (
                                                <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign:i===3?'right':'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${tabCfg.border}` }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {filteredReg.map((reg) => (
                                                <tr key={reg.IDRegimeOT} className="ot-row" style={{ transition:'background 0.15s', '--light':tabCfg.light }}>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                        <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:'0.8rem', background:tabCfg.light, color:tabCfg.acc, border:`1px solid ${tabCfg.border}`, borderRadius:'0.5rem', padding:'0.25rem 0.625rem' }}>{reg.CodeRegimeOT}</span>
                                                    </td>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', fontWeight:700, color:'#0f172a', fontSize:'0.875rem' }}>{reg.LibelleRegimeOT}</td>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', fontSize:'0.875rem', color:'#475569', maxWidth:220 }}>{reg.Observations||<span style={{color:'#d1d5db'}}>—</span>}</td>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                        <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                            <button className="ot-btn-edit" onClick={() => { setRegEdit(reg.IDRegimeOT); setRegCode(reg.CodeRegimeOT); setRegLib(reg.LibelleRegimeOT); setRegObs(reg.Observations||'') }} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s', '--light':tabCfg.light, '--acc':tabCfg.acc }}><Edit size={15}/></button>
                                                            <button className="ot-btn-del" onClick={() => handleRegDelete(reg.IDRegimeOT)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Trash2 size={15}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredReg.length===0 && <tr><td colSpan={4} style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                                                <Layers size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 1rem' }}/>
                                                {regimes.length===0?'Aucun régime OT configuré.':'Aucun résultat.'}
                                            </td></tr>}
                                        </tbody>
                                    </table>
                                    </div>
                                )}

                                {/* ── Types Docs OT table ── */}
                                {activeTab === 'typesDocs' && (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                        <thead><tr style={{ background:tabCfg.light }}>
                                            {['#','Libellé','Observations','Actions'].map((h,i) => (
                                                <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign:i===3?'right':'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${tabCfg.border}`, width:i===0?'3rem':i===3?'6rem':'' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {filteredTd.map((td, i) => (
                                                <tr key={td.IDTypesDocumentsOT} className="ot-row" style={{ transition:'background 0.15s', '--light':tabCfg.light }}>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                        <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:'0.75rem', color:'#94a3b8' }}>{String(i+1).padStart(2,'0')}</span>
                                                    </td>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                        <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                                            <div style={{ width:30, height:30, borderRadius:'0.5rem', background:tabCfg.light, border:`1px solid ${tabCfg.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><FileText size={13} color={tabCfg.acc}/></div>
                                                            <span style={{ fontWeight:700, color:'#0f172a', fontSize:'0.875rem' }}>{td.LibelleTypeDocumentsOT}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', fontSize:'0.875rem', color:'#475569' }}>{td.Observations||<span style={{color:'#d1d5db'}}>—</span>}</td>
                                                    <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                        <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                            <button className="ot-btn-edit" onClick={() => { setTdEdit(td.IDTypesDocumentsOT); setTdLib(td.LibelleTypeDocumentsOT); setTdObs(td.Observations||'') }} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s', '--light':tabCfg.light, '--acc':tabCfg.acc }}><Edit size={15}/></button>
                                                            <button className="ot-btn-del" onClick={() => handleTdDelete(td.IDTypesDocumentsOT)} style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}><Trash2 size={15}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredTd.length===0 && <tr><td colSpan={4} style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                                                <FileText size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 1rem' }}/>
                                                {typesDocs.length===0?'Aucun type de document configuré.':'Aucun résultat.'}
                                            </td></tr>}
                                        </tbody>
                                    </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <Toast toasts={toasts}/>
        </div>
    )
}
