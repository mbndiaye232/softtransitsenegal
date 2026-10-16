import React, { useState, useEffect } from 'react'
import {
    FileText, Plus, Eye, Trash2, FolderDown, X, Upload,
    CheckCircle2, AlertCircle, ArrowLeft, Search, File,
    Users, Briefcase, Calendar, Hash, AlignLeft, ShieldCheck
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clientsAPI, dossiersAPI, documentsAPI, typesDocumentsAPI } from '../services/api'

const GRAD  = 'linear-gradient(135deg,#0c4a6e 0%,#0e7490 50%,#06b6d4 100%)'
const ACC   = '#0e7490'
const ACC2  = '#06b6d4'
const LIGHT = '#ecfeff'
const BORDER= '#a5f3fc'

/* ── Toast ── */
function Toast({ toasts }) {
    return (
        <div style={{ position:'fixed', bottom:'2rem', right:'2rem', zIndex:300, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {toasts.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1.25rem', background:t.type==='success'?'#ecfdf5':'#fef2f2', border:`1px solid ${t.type==='success'?'#6ee7b7':'#fca5a5'}`, color:t.type==='success'?'#065f46':'#991b1b', borderRadius:'0.875rem', boxShadow:'0 10px 25px rgba(0,0,0,.12)', fontWeight:600, fontSize:'0.875rem', animation:'slideUp .3s ease' }}>
                    {t.type==='success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>} {t.msg}
                </div>
            ))}
        </div>
    )
}

/* ── Field label ── */
const FLabel = ({ children, required }) => (
    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
        {children}{required && <span style={{ color:ACC2, marginLeft:3 }}>*</span>}
    </label>
)

/* ── Input style ── */
const inp = { width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc', outline:'none', boxSizing:'border-box', fontFamily:'inherit', transition:'all 0.2s' }

export default function DocumentManager() {
    const navigate = useNavigate()
    const [clients, setClients]               = useState([])
    const [dossiers, setDossiers]             = useState([])
    const [documents, setDocuments]           = useState([])
    const [types, setTypes]                   = useState([])
    const [selectedClient, setSelectedClient] = useState('')
    const [selectedDossier, setSelectedDossier] = useState('')
    const [loading, setLoading]               = useState(false)
    const [showModal, setShowModal]           = useState(false)
    const [search, setSearch]                 = useState('')
    const [toasts, setToasts]                 = useState([])
    const [hovRow, setHovRow]                 = useState(null)

    const [formData, setFormData] = useState({
        title:'', description:'', number:'', typeId:'',
        date: new Date().toISOString().split('T')[0], observations:''
    })
    const [file, setFile] = useState(null)

    useEffect(() => {
        const init = async () => {
            try {
                const [cRes, tRes] = await Promise.all([clientsAPI.getAll(), typesDocumentsAPI.getAll()])
                setClients(Array.isArray(cRes.data) ? cRes.data : [])
                setTypes(Array.isArray(tRes.data) ? tRes.data : [])
            } catch {}
        }
        init()
    }, [])

    useEffect(() => {
        if (selectedClient) {
            dossiersAPI.getByClient(selectedClient).then(res => {
                setDossiers(Array.isArray(res.data) ? res.data : [])
                setSelectedDossier('')
                setDocuments([])
            }).catch(() => {})
        } else {
            setDossiers([]); setSelectedDossier(''); setDocuments([])
        }
    }, [selectedClient])

    useEffect(() => {
        if (selectedDossier) fetchDocuments()
        else setDocuments([])
    }, [selectedDossier])

    const fetchDocuments = async () => {
        try {
            setLoading(true)
            const res = await documentsAPI.getByDossier(selectedDossier)
            setDocuments(res.data)
        } catch { toast('error', 'Erreur chargement documents') }
        finally { setLoading(false) }
    }

    const toast = (type, msg) => {
        const id = Date.now()
        setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }

    const handleUpload = async (e) => {
        e.preventDefault()
        if (!file || !selectedDossier) return
        const data = new FormData()
        data.append('document', file)
        data.append('dossierId', selectedDossier)
        data.append('title', formData.title)
        data.append('description', formData.description)
        data.append('number', formData.number)
        data.append('typeId', formData.typeId)
        data.append('date', formData.date)
        data.append('observations', formData.observations)
        try {
            setLoading(true)
            await documentsAPI.create(data)
            setShowModal(false)
            setFile(null)
            setFormData({ title:'', description:'', number:'', typeId:'', date: new Date().toISOString().split('T')[0], observations:'' })
            fetchDocuments()
            toast('success', 'Document ajouté avec succès')
        } catch { toast('error', "Erreur lors de l'upload") }
        finally { setLoading(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce document ?')) return
        try {
            await documentsAPI.delete(id)
            fetchDocuments()
            toast('success', 'Document supprimé')
        } catch { toast('error', 'Impossible de supprimer') }
    }

    const handleOpen = async (id) => {
        try {
            const res = await documentsAPI.view(id)
            const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' })
            const url = window.URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch (e) {
            toast('error', 'Impossible d\'ouvrir le document')
        }
    }

    const handleExtract = async () => {
        if (!selectedDossier) return
        try {
            setLoading(true)
            const res = await documentsAPI.extract(selectedDossier)
            const blob = new Blob([res.data], { type: 'application/zip' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            const dossierCode = dossiers.find(d => String(d.id) === String(selectedDossier))?.code || selectedDossier
            a.href = url
            a.download = `${dossierCode}.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
            toast('success', 'Archive téléchargée avec succès')
        } catch (e) {
            toast('error', 'Erreur lors de la création de l\'archive')
        } finally {
            setLoading(false)
        }
    }

    const clientName  = clients.find(c => String(c.IDCLIENTS) === String(selectedClient))?.NomRS || ''
    const dossierName = dossiers.find(d => String(d.id) === String(selectedDossier))
    const filtered    = documents.filter(d =>
        d.title?.toLowerCase().includes(search.toLowerCase()) ||
        d.typeLabel?.toLowerCase().includes(search.toLowerCase()) ||
        d.number?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                @keyframes fadeIn{from{opacity:0}to{opacity:1}}
                .dm-inp:focus{border-color:${ACC2}!important;background:white!important;box-shadow:0 0 0 3px ${LIGHT}!important}
                .dm-row:hover td{background:${LIGHT}!important}
                .dm-del:hover{background:#fee2e2!important;color:#dc2626!important}
                .dm-eye:hover{background:${LIGHT}!important;color:${ACC}!important}
                .dm-sel:focus{border-color:${ACC2}!important;outline:none!important;box-shadow:0 0 0 3px ${LIGHT}!important}
            `}</style>

            {/* ── Hero ── */}
            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['18%','20%',280,'rgba(6,182,212,.3)'],['70%','50%',200,'rgba(14,116,144,.25)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(65px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1100, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate(-1)} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Retour
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,.2)', borderRadius:'0.875rem', padding:'0.625rem' }}><FileText size={28} color="white"/></div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-.02em' }}>Gestion des Documents</h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,.75)', fontSize:'0.9rem' }}>Archivage et gestion des documents par dossier client</p>
                        </div>
                        {/* KPIs */}
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            {[
                                { icon: Users,    val: clients.length,   label:'Clients' },
                                { icon: Briefcase,val: dossiers.length,  label:'Dossiers' },
                                { icon: FileText, val: documents.length, label:'Documents' },
                            ].map(({ icon: Icon, val, label }) => (
                                <div key={label} style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                    <Icon size={16} color="rgba(255,255,255,.8)"/>
                                    <div>
                                        <div style={{ color:'white', fontWeight:800, fontSize:'1.1rem', lineHeight:1 }}>{val}</div>
                                        <div style={{ color:'rgba(255,255,255,.6)', fontSize:'0.68rem', fontWeight:600, marginTop:'0.2rem' }}>{label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <div style={{ maxWidth:1100, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative', zIndex:1 }}>

                {/* ── Filtres ── */}
                <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:`0 4px 24px ${ACC}14`, overflow:'hidden', marginBottom:'1.5rem' }}>
                    <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                        <div style={{ background:'rgba(255,255,255,.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Search size={16} color="white"/></div>
                        <span style={{ color:'white', fontWeight:700 }}>Sélection</span>
                    </div>
                    <div style={{ padding:'1.5rem', display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'1rem', alignItems:'end' }}>
                        {/* Client */}
                        <div>
                            <FLabel>Client</FLabel>
                            <div style={{ position:'relative' }}>
                                <Users size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
                                <select className="dm-sel"
                                    value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                                    style={{ ...inp, paddingLeft:'2.2rem', appearance:'auto', cursor:'pointer' }}>
                                    <option value="">Sélectionner un client…</option>
                                    {clients.map(c => <option key={c.IDCLIENTS} value={c.IDCLIENTS}>{c.NomRS || c.NomClient}</option>)}
                                </select>
                            </div>
                        </div>
                        {/* Dossier */}
                        <div>
                            <FLabel>Dossier</FLabel>
                            <div style={{ position:'relative' }}>
                                <Briefcase size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
                                <select className="dm-sel"
                                    value={selectedDossier} onChange={e => setSelectedDossier(e.target.value)}
                                    disabled={!selectedClient}
                                    style={{ ...inp, paddingLeft:'2.2rem', appearance:'auto', cursor: selectedClient ? 'pointer' : 'not-allowed', opacity: selectedClient ? 1 : 0.6 }}>
                                    <option value="">Sélectionner un dossier…</option>
                                    {dossiers.map(d => <option key={d.id} value={d.id}>{d.code} — {d.label}</option>)}
                                </select>
                            </div>
                        </div>
                        {/* Actions */}
                        <div style={{ display:'flex', gap:'0.625rem' }}>
                            <button onClick={handleExtract} disabled={!selectedDossier || loading}
                                style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.7rem 1.1rem', background: selectedDossier ? 'linear-gradient(135deg,#0c4a6e,#0e7490)' : '#e2e8f0', color: selectedDossier ? 'white' : '#94a3b8', border:'none', borderRadius:'0.75rem', fontWeight:700, fontSize:'0.8rem', cursor: selectedDossier ? 'pointer' : 'not-allowed', whiteSpace:'nowrap', transition:'all .2s' }}>
                                <FolderDown size={15}/> Récupérer tout
                            </button>
                            <button onClick={() => setShowModal(true)} disabled={!selectedDossier || loading}
                                style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.7rem 1.1rem', background: selectedDossier ? GRAD : '#e2e8f0', color: selectedDossier ? 'white' : '#94a3b8', border:'none', borderRadius:'0.75rem', fontWeight:700, fontSize:'0.8rem', cursor: selectedDossier ? 'pointer' : 'not-allowed', whiteSpace:'nowrap', transition:'all .2s' }}>
                                <Plus size={15}/> Nouveau
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Table ── */}
                <div style={{ background:'white', borderRadius:'1.25rem', border:`1px solid ${BORDER}`, boxShadow:`0 4px 24px ${ACC}14`, overflow:'hidden' }}>
                    <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <div style={{ background:'rgba(255,255,255,.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><FileText size={16} color="white"/></div>
                            <div>
                                <span style={{ color:'white', fontWeight:700 }}>
                                    Documents {selectedDossier ? `— ${dossierName?.code || ''}` : ''}
                                </span>
                                <span style={{ color:'rgba(255,255,255,.6)', fontSize:'0.8rem', marginLeft:'0.5rem' }}>
                                    ({filtered.length})
                                </span>
                            </div>
                        </div>
                        {selectedDossier && (
                            <div style={{ position:'relative' }}>
                                <Search size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.6)' }}/>
                                <input style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', borderRadius:'2rem', padding:'0.375rem 0.875rem 0.375rem 2.125rem', color:'white', fontSize:'0.8rem', outline:'none', width:180 }}
                                    placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}/>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
                            <div style={{ width:28, height:28, border:`2px solid ${LIGHT}`, borderTopColor:ACC, borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 1rem' }}/>
                            <div style={{ fontSize:'0.875rem', fontWeight:600 }}>Chargement…</div>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead>
                                <tr style={{ background:LIGHT }}>
                                    {['Titre','Type','Numéro','Description','Actions'].map((h,i) => (
                                        <th key={h} style={{ padding:'0.875rem 1.25rem', textAlign: i===4 ? 'right' : 'left', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${BORDER}` }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length > 0 ? filtered.map((doc, i) => (
                                    <tr key={doc.id} className="dm-row"
                                        onMouseEnter={() => setHovRow(i)} onMouseLeave={() => setHovRow(null)}
                                        style={{ background: hovRow===i ? LIGHT : 'white', transition:'background .15s' }}>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                                <div style={{ width:32, height:32, borderRadius:'0.5rem', background:LIGHT, border:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                                    <File size={14} color={ACC}/>
                                                </div>
                                                <span style={{ fontWeight:700, color:'#0f172a', fontSize:'0.875rem' }}>{doc.title}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <span style={{ background:LIGHT, color:ACC, border:`1px solid ${BORDER}`, borderRadius:'0.5rem', padding:'0.25rem 0.625rem', fontSize:'0.75rem', fontWeight:700 }}>
                                                {doc.typeLabel || 'Autre'}
                                            </span>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <span style={{ fontFamily:'monospace', fontSize:'0.8rem', color:'#64748b', fontWeight:600 }}>{doc.number || '—'}</span>
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', color:'#475569', fontSize:'0.875rem', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                            {doc.description || <span style={{ color:'#d1d5db' }}>—</span>}
                                        </td>
                                        <td style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9' }}>
                                            <div style={{ display:'flex', gap:'0.375rem', justifyContent:'flex-end' }}>
                                                <button className="dm-eye" onClick={() => handleOpen(doc.id)} title="Ouvrir"
                                                    style={{ padding:'0.375rem 0.625rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.75rem', fontWeight:600, transition:'all .15s' }}>
                                                    <Eye size={14}/> Voir
                                                </button>
                                                <button className="dm-del" onClick={() => handleDelete(doc.id)} title="Supprimer"
                                                    style={{ padding:'0.375rem', borderRadius:'0.5rem', border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', transition:'all .15s' }}>
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} style={{ textAlign:'center', padding:'5rem', color:'#94a3b8' }}>
                                        <FileText size={48} style={{ opacity:.12, display:'block', margin:'0 auto 1rem' }}/>
                                        <div style={{ fontWeight:600, fontSize:'0.9rem' }}>
                                            {selectedDossier ? 'Aucun document attaché à ce dossier.' : 'Sélectionnez un client puis un dossier.'}
                                        </div>
                                        {!selectedDossier && (
                                            <div style={{ fontSize:'0.8rem', marginTop:'0.5rem', color:'#cbd5e1' }}>
                                                Les documents s'afficheront ici une fois le dossier sélectionné.
                                            </div>
                                        )}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal Nouveau Document ── */}
            {showModal && (
                <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem', backdropFilter:'blur(4px)', animation:'fadeIn .2s' }}>
                    <div style={{ background:'white', borderRadius:'1.25rem', width:'100%', maxWidth:580, maxHeight:'90vh', overflow:'hidden', boxShadow:'0 25px 60px rgba(0,0,0,.25)', display:'flex', flexDirection:'column' }}>
                        {/* Modal header */}
                        <div style={{ background:GRAD, padding:'1.25rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <div style={{ background:'rgba(255,255,255,.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}><Upload size={16} color="white"/></div>
                                <span style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>Nouveau Document</span>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', borderRadius:'0.5rem', padding:'0.375rem', color:'white', cursor:'pointer', display:'flex' }}>
                                <X size={16}/>
                            </button>
                        </div>

                        {/* Modal body */}
                        <form onSubmit={handleUpload} style={{ flex:1, overflowY:'auto' }}>
                            <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
                                {/* Titre */}
                                <div>
                                    <FLabel required>Titre du document</FLabel>
                                    <input className="dm-inp" style={inp} required
                                        placeholder="ex: Facture commerciale, Certificat d'origine…"
                                        value={formData.title} onChange={e => setFormData({...formData, title:e.target.value})}/>
                                </div>

                                {/* Type + Numéro */}
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                                    <div>
                                        <FLabel required>Type de document</FLabel>
                                        <select className="dm-inp" style={{ ...inp, appearance:'auto', cursor:'pointer' }} required
                                            value={formData.typeId} onChange={e => setFormData({...formData, typeId:e.target.value})}>
                                            <option value="">Choisir un type…</option>
                                            {types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <FLabel>Numéro</FLabel>
                                        <div style={{ position:'relative' }}>
                                            <Hash size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
                                            <input className="dm-inp" style={{ ...inp, paddingLeft:'2.2rem' }}
                                                placeholder="ex: FAC-2024-001"
                                                value={formData.number} onChange={e => setFormData({...formData, number:e.target.value})}/>
                                        </div>
                                    </div>
                                </div>

                                {/* Date + Description */}
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                                    <div>
                                        <FLabel>Date du document</FLabel>
                                        <div style={{ position:'relative' }}>
                                            <Calendar size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
                                            <input type="date" className="dm-inp" style={{ ...inp, paddingLeft:'2.2rem' }}
                                                value={formData.date} onChange={e => setFormData({...formData, date:e.target.value})}/>
                                        </div>
                                    </div>
                                    <div>
                                        <FLabel>Description</FLabel>
                                        <input className="dm-inp" style={inp}
                                            placeholder="Résumé court…"
                                            value={formData.description} onChange={e => setFormData({...formData, description:e.target.value})}/>
                                    </div>
                                </div>

                                {/* Fichier */}
                                <div>
                                    <FLabel required>Fichier</FLabel>
                                    <input type="file" id="doc-file" style={{ display:'none' }} required
                                        onChange={e => setFile(e.target.files[0])}/>
                                    <label htmlFor="doc-file" style={{
                                        display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1rem',
                                        border: file ? `2px solid ${ACC2}` : '2px dashed #e2e8f0',
                                        borderRadius:'0.75rem', background: file ? LIGHT : '#f8fafc',
                                        cursor:'pointer', transition:'all .2s',
                                    }}>
                                        <div style={{ width:36, height:36, borderRadius:'0.625rem', background: file ? `${ACC}20` : '#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                            <Upload size={16} color={ file ? ACC : '#94a3b8'}/>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight:700, fontSize:'0.875rem', color: file ? ACC : '#64748b' }}>
                                                {file ? file.name : 'Cliquez pour sélectionner un fichier'}
                                            </div>
                                            <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'0.15rem' }}>
                                                {file ? `${(file.size/1024).toFixed(0)} Ko` : 'PDF, Word, Excel, image…'}
                                            </div>
                                        </div>
                                        {file && <CheckCircle2 size={16} color={ACC} style={{ marginLeft:'auto', flexShrink:0 }}/>}
                                    </label>
                                </div>

                                {/* Info */}
                                <div style={{ padding:'0.875rem 1rem', background:LIGHT, borderRadius:'0.75rem', border:`1px dashed ${BORDER}`, display:'flex', gap:'0.625rem', alignItems:'flex-start' }}>
                                    <ShieldCheck size={14} color={ACC} style={{ flexShrink:0, marginTop:1 }}/>
                                    <p style={{ margin:0, fontSize:'0.75rem', color:'#475569', lineHeight:1.5 }}>
                                        Le document sera archivé et associé au dossier sélectionné. Il sera accessible depuis cet écran.
                                    </p>
                                </div>
                            </div>

                            {/* Modal footer */}
                            <div style={{ padding:'1.25rem 1.5rem', borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'flex-end', gap:'0.75rem', background:LIGHT }}>
                                <button type="button" onClick={() => setShowModal(false)}
                                    style={{ padding:'0.7rem 1.25rem', background:'white', border:'1px solid #e2e8f0', borderRadius:'0.75rem', fontWeight:600, color:'#64748b', cursor:'pointer', fontSize:'0.875rem' }}>
                                    Annuler
                                </button>
                                <button type="submit" disabled={loading || !file}
                                    style={{ padding:'0.7rem 1.5rem', background: file ? GRAD : '#e2e8f0', color: file ? 'white' : '#94a3b8', border:'none', borderRadius:'0.75rem', fontWeight:700, cursor: file ? 'pointer' : 'not-allowed', fontSize:'0.875rem', display:'flex', alignItems:'center', gap:'0.5rem', opacity: loading ? 0.7 : 1 }}>
                                    <Upload size={14}/> {loading ? 'Envoi…' : 'Enregistrer'}
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
