import React, { useState, useEffect } from 'react'
import {
    ClipboardList, Plus, Search, Trash2, Edit, ChevronLeft,
    CheckCircle2, AlertCircle, Save, ShieldCheck, Layers,
    ArrowLeft, FileText, Hash
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { etapesDossiersAPI } from '../services/api'

const ACC = '#1d4ed8'
const ACC2 = '#3b82f6'
const LIGHT = '#eff6ff'
const BORDER = '#bfdbfe'
const GRAD = 'var(--hero-gradient)'

/* ─── Tiny Toast ─────────────────────────────────────────── */
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
                    fontWeight:600, fontSize:'0.875rem',
                    animation:'slideUp 0.3s ease'
                }}>
                    {t.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                    {t.msg}
                </div>
            ))}
        </div>
    )
}

/* ─── BlockCard ───────────────────────────────────────────── */
function BlockCard({ grad, icon: Icon, title, action, children, style = {} }) {
    return (
        <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:'0 4px 24px rgba(59,130,246,0.08)', overflow:'hidden', ...style }}>
            <div style={{ background: grad || GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                    {Icon && <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Icon size={18} color="white"/></div>}
                    <span style={{ color:'white', fontWeight:700, fontSize:'0.9375rem' }}>{title}</span>
                </div>
                {action}
            </div>
            <div style={{ overflowX: 'auto' }}>{children}</div>
        </div>
    )
}

/* ─── FL Label ────────────────────────────────────────────── */
function FL({ label, required }) {
    return (
        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
            {label}{required && <span style={{ color: ACC2, marginLeft:'2px' }}>*</span>}
        </label>
    )
}

export default function EtapesDossiersPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [toasts, setToasts] = useState([])
    const [etapes, setEtapes] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({ libelleEtapesDossiers: '', Observations: '' })
    const [saving, setSaving] = useState(false)
    const [hovRow, setHovRow] = useState(null)

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const r = await etapesDossiersAPI.getAll()
            setEtapes(r.data)
        } catch (err) {
            toast('error', 'Erreur lors du chargement')
        } finally {
            setLoading(false)
        }
    }

    const toast = (type, msg) => {
        const id = Date.now()
        setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    const resetForm = () => {
        setFormData({ libelleEtapesDossiers: '', Observations: '' })
        setEditingId(null)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.libelleEtapesDossiers.trim()) return
        setSaving(true)
        try {
            if (editingId) {
                await etapesDossiersAPI.update(editingId, formData)
                toast('success', 'Étape mise à jour')
            } else {
                await etapesDossiersAPI.create(formData)
                toast('success', 'Étape ajoutée')
            }
            resetForm()
            loadData()
        } catch { toast('error', "Erreur lors de l'enregistrement") }
        finally { setSaving(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer cette étape ?')) return
        try {
            await etapesDossiersAPI.delete(id)
            toast('success', 'Étape supprimée')
            loadData()
        } catch { toast('error', 'Impossible de supprimer') }
    }

    const filtered = etapes.filter(e =>
        e.libelleEtapesDossiers?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.Observations && e.Observations.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const inputSt = {
        width:'100%', padding:'0.7rem 0.9rem',
        border:`1px solid #e2e8f0`, borderRadius:'0.625rem',
        fontSize:'0.9rem', color:'#0f172a', background:'#f8fafc',
        outline:'none', transition:'all 0.2s', boxSizing:'border-box'
    }
    const textSt = { ...inputSt, minHeight:'90px', resize:'vertical' }

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes spin { to{transform:rotate(360deg)} }
                .ew-inp:focus { border-color:${ACC2} !important; background:white !important; box-shadow:0 0 0 3px ${LIGHT} !important; }
                .ew-row:hover td { background:${LIGHT} !important; }
                .ew-abtn:hover { background:${LIGHT}; color:${ACC}; }
                .ew-adel:hover { background:#fee2e2 !important; color:#dc2626 !important; }
            `}</style>

            {/* ── Hero ── */}
            <div style={{ background: GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {/* orbs */}
                {[['30%','20%',300,'rgba(59,130,246,0.3)'],['70%','60%',200,'rgba(167,139,250,0.2)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(60px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1440, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Paramètres
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'0.875rem', padding:'0.625rem', backdropFilter:'blur(8px)' }}>
                                    <ClipboardList size={28} color="white"/>
                                </div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-0.02em' }}>Étapes des Dossiers</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.9rem' }}>Définissez le cycle de vie des dossiers de transit</p>
                        </div>
                        {/* KPI pills */}
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            {[
                                { label:'Total étapes', value: etapes.length, icon: Layers },
                                { label:'Avec observations', value: etapes.filter(e=>e.Observations).length, icon: FileText },
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

            {/* ── Content ── */}
            <div style={{ maxWidth:1440, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative' }}>
                <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:'1.75rem', alignItems:'start' }}>

                    {/* Form Panel */}
                    <div style={{ position:'sticky', top:'5rem' }}>
                        <BlockCard grad={GRAD} icon={editingId ? Edit : Plus} title={editingId ? "Modifier l'étape" : 'Nouvelle étape'}>
                            <form onSubmit={handleSubmit} style={{ padding:'1.5rem' }}>
                                <div style={{ marginBottom:'1.1rem' }}>
                                    <FL label="Libellé de l'étape" required/>
                                    <input className="ew-inp" style={inputSt}
                                        value={formData.libelleEtapesDossiers}
                                        onChange={e => setFormData({...formData, libelleEtapesDossiers: e.target.value})}
                                        placeholder="ex: Ouvert, Déclaré, Clôturé..."
                                        required autoFocus
                                    />
                                </div>
                                <div style={{ marginBottom:'1.25rem' }}>
                                    <FL label="Observations"/>
                                    <textarea className="ew-inp" style={textSt}
                                        value={formData.Observations || ''}
                                        onChange={e => setFormData({...formData, Observations: e.target.value})}
                                        placeholder="Notes ou détails sur cette étape..."
                                    />
                                </div>
                                <button type="submit" disabled={saving || !formData.libelleEtapesDossiers.trim()}
                                    style={{ width:'100%', padding:'0.8rem', background: GRAD, color:'white', border:'none', borderRadius:'0.75rem', fontWeight:700, fontSize:'0.9375rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', opacity: saving ? 0.7 : 1 }}>
                                    {saving ? '...' : editingId ? <Save size={16}/> : <Plus size={16}/>}
                                    {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                                {editingId && (
                                    <button type="button" onClick={resetForm}
                                        style={{ width:'100%', padding:'0.7rem', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:'0.75rem', fontWeight:600, cursor:'pointer', marginTop:'0.5rem' }}>
                                        Annuler
                                    </button>
                                )}
                            </form>
                            {/* Info box */}
                            <div style={{ margin:'0 1.5rem 1.5rem', padding:'0.875rem 1rem', background:LIGHT, borderRadius:'0.75rem', border:`1px dashed ${BORDER}`, display:'flex', gap:'0.625rem', alignItems:'flex-start' }}>
                                <ShieldCheck size={15} color={ACC} style={{ flexShrink:0, marginTop:1 }}/>
                                <p style={{ margin:0, fontSize:'0.75rem', color:'#475569', lineHeight:1.5 }}>
                                    Ces étapes définissent le cycle de vie d'un dossier et sont utilisées pour le suivi.
                                </p>
                            </div>
                        </BlockCard>
                    </div>

                    {/* List Panel */}
                    <BlockCard
                        grad={GRAD} icon={ClipboardList} title={`Liste des étapes (${filtered.length})`}
                        action={
                            <div style={{ position:'relative' }}>
                                <Search size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.6)' }}/>
                                <input style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'2rem', padding:'0.375rem 0.875rem 0.375rem 2.125rem', color:'white', fontSize:'0.8rem', outline:'none', width:220 }}
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        }
                    >
                        {loading ? (
                            <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                                <div style={{ width:28, height:28, border:`2px solid ${LIGHT}`, borderTopColor:ACC, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }}/>
                                Chargement...
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                <thead>
                                    <tr style={{ background: LIGHT }}>
                                        {['#','Étape','Observations','Actions'].map((h, i) => (
                                            <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign: i===3 ? 'right' : 'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${BORDER}`, whiteSpace:'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((et, i) => (
                                        <tr key={et.IDEtapesDossiers} className="ew-row"
                                            onMouseEnter={() => setHovRow(i)} onMouseLeave={() => setHovRow(null)}
                                            style={{ background: hovRow===i ? LIGHT : 'white', transition:'background 0.15s' }}>
                                            <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', color:'#94a3b8', fontSize:'0.75rem', fontWeight:700, fontFamily:'monospace' }}>
                                                {String(i+1).padStart(2,'0')}
                                            </td>
                                            <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                                    <div style={{ width:30, height:30, borderRadius:'0.5rem', background:LIGHT, border:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                                        <ClipboardList size={14} color={ACC}/>
                                                    </div>
                                                    <span style={{ fontWeight:700, color:'#0f172a', fontSize:'0.9rem' }}>{et.libelleEtapesDossiers}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', fontSize:'0.8125rem', color:'#64748b', maxWidth:350 }}>
                                                <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={et.Observations}>
                                                    {et.Observations || <span style={{ opacity:0.3 }}>—</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                                <div style={{ display:'flex', gap:'0.3rem', justifyContent:'flex-end' }}>
                                                    <button className="ew-abtn" onClick={() => { setEditingId(et.IDEtapesDossiers); setFormData({ libelleEtapesDossiers: et.libelleEtapesDossiers, Observations: et.Observations || '' }) }}
                                                        style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}
                                                        title="Modifier">
                                                        <Edit size={15}/>
                                                    </button>
                                                    <button className="ew-adel" onClick={() => handleDelete(et.IDEtapesDossiers)}
                                                        style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}
                                                        title="Supprimer">
                                                        <Trash2 size={15}/>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                                                <ClipboardList size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 1rem' }}/>
                                                {etapes.length === 0 ? 'Aucune étape configurée.' : 'Aucun résultat.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {filtered.length > 0 && (
                                    <tfoot>
                                        <tr>
                                            <td colSpan={4} style={{ padding:'0.875rem 1.25rem', fontSize:'0.75rem', color:'#94a3b8', borderTop:'1px solid #f1f5f9', textAlign:'right' }}>
                                                {filtered.length} étape{filtered.length > 1 ? 's' : ''} {searchQuery ? 'trouvée(s)' : 'au total'}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                            </div>
                        )}
                    </BlockCard>
                </div>
            </div>

            <Toast toasts={toasts}/>
        </div>
    )
}
