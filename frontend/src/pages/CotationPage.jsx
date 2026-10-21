import React, { useState, useEffect } from 'react';
import { cotationsAPI, usersAPI } from '../services/api';
import {
    Search, User, Calendar, Check, ChevronRight,
    ArrowRightLeft, Layers, History, Info, Package,
    X, CheckCircle2, UserCheck, FileText
} from 'lucide-react';

/* ─── avatar palette ─────────────────────────────────────────────────────── */
const AVATAR_COLORS = [
    ['#dbeafe','#1e40af'],['#dbeafe','#1d4ed8'],['#dcfce7','#15803d'],
    ['#ffedd5','#c2410c'],['#fce7f3','#be185d'],['#e0f2fe','#0369a1'],
    ['#fef9c3','#a16207'],['#f1f5f9','#475569'],
];
const avatarColor = name => AVATAR_COLORS[(name||'').charCodeAt(0) % 8];

const CotationPage = () => {
    const [dossiers, setDossiers]           = useState([]);
    const [agents, setAgents]               = useState([]);
    const [loading, setLoading]             = useState(true);
    const [searchTerm, setSearchTerm]       = useState('');
    const [viewMode, setViewMode]           = useState('pending');
    const [selectedDossier, setSelectedDossier] = useState(null);
    const [selectedAgent, setSelectedAgent]     = useState(null);
    const [assignmentDate, setAssignmentDate]   = useState(new Date().toISOString().split('T')[0]);
    const [reassignMotif, setReassignMotif]     = useState('');
    const [isSubmitting, setIsSubmitting]       = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [dashRes, agentsRes] = await Promise.all([
                cotationsAPI.getDashboard(),
                usersAPI.getAll()
            ]);
            setDossiers(dashRes.data);
            const declarants = agentsRes.data.filter(a => a.id_groupe === 10 || a.IDGroupes === 10);
            setAgents(declarants);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!selectedDossier || !selectedAgent) return;
        if (viewMode === 'assigned' && !reassignMotif) {
            alert('Veuillez saisir un motif pour la réaffectation.');
            return;
        }
        try {
            setIsSubmitting(true);
            await cotationsAPI.create({
                dossier_id: selectedDossier.id,
                agent_id:   selectedAgent.id,
                date_effet: assignmentDate,
                motif:      reassignMotif,
            });
            await fetchData();
            setSelectedDossier(null);
            setSelectedAgent(null);
            setReassignMotif('');
        } catch (err) {
            console.error(err);
            alert("Erreur lors de l'affectation.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredDossiers = dossiers.filter(d => {
        const q = searchTerm.toLowerCase();
        const matchSearch =
            d.code?.toLowerCase().includes(q) ||
            d.label?.toLowerCase().includes(q) ||
            d.clientName?.toLowerCase().includes(q);
        const isAssigned = d.active_cotation_id !== null;
        return viewMode === 'pending'
            ? matchSearch && !isAssigned
            : matchSearch && isAssigned;
    });

    /* counts */
    const pendingCount  = dossiers.filter(d => d.active_cotation_id === null).length;
    const assignedCount = dossiers.filter(d => d.active_cotation_id !== null).length;

    /* ── Loading ── */
    if (loading) return (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#eff6ff' }}>
            <div style={{ textAlign:'center' }}>
                <div style={{ width:44, height:44, border:'3px solid #bfdbfe', borderTopColor:'#1d4ed8', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 12px' }} />
                <div style={{ fontSize:14, color:'#1e3a8a', fontWeight:600 }}>Chargement de l'affectation…</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    const canApply = !!selectedDossier && !!selectedAgent && !isSubmitting;

    return (
        <div style={{ minHeight:'100vh', background:'#eff6ff', fontFamily:'inherit' }}>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div style={{
                background: 'var(--hero-gradient)',
                padding: '32px 40px 72px', position:'relative', overflow:'hidden',
            }}>
                <div style={{ position:'absolute', top:-70, right:-70, width:240, height:240, background:'rgba(255,255,255,.05)', borderRadius:'50%' }} />
                <div style={{ position:'absolute', bottom:-30, right:180, width:120, height:120, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:20, flexWrap:'wrap' }}>
                    <div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                            <div style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(6px)', borderRadius:99, padding:'5px 14px', border:'1px solid rgba(255,255,255,.2)', display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:'rgba(255,255,255,.9)' }}>
                                <ArrowRightLeft size={12}/> Affectation
                            </div>
                        </div>
                        <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:'white', letterSpacing:'-.02em' }}>
                            Affectation des Déclarants
                        </h1>
                        <p style={{ margin:'8px 0 0', fontSize:14, color:'rgba(255,255,255,.7)', fontWeight:500 }}>
                            Imputation et suivi des dossiers par agent.
                        </p>
                    </div>

                    {/* Stats pills */}
                    <div style={{ display:'flex', gap:10 }}>
                        <div style={{ background:'rgba(255,255,255,.12)', backdropFilter:'blur(6px)', border:'1px solid rgba(255,255,255,.2)', borderRadius:14, padding:'10px 18px', textAlign:'center' }}>
                            <div style={{ fontSize:22, fontWeight:900, color:'white' }}>{pendingCount}</div>
                            <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.65)', textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>À imputer</div>
                        </div>
                        <div style={{ background:'rgba(255,255,255,.12)', backdropFilter:'blur(6px)', border:'1px solid rgba(255,255,255,.2)', borderRadius:14, padding:'10px 18px', textAlign:'center' }}>
                            <div style={{ fontSize:22, fontWeight:900, color:'white' }}>{assignedCount}</div>
                            <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.65)', textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>Imputés</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Main content ─────────────────────────────────────────────── */}
            <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 32px 48px', marginTop:'-48px', position:'relative', zIndex:1 }}>

                {/* ── Toggle bar ── */}
                <div style={{ background:'white', borderRadius:20, border:'1px solid #e5e7eb', boxShadow:'0 8px 28px rgba(0,0,0,.10)', padding:'8px', marginBottom:20, display:'flex', gap:6, width:'fit-content' }}>
                    {[
                        { id:'pending',  icon:<Layers size={14}/>,  label:'À Imputer',    count:pendingCount  },
                        { id:'assigned', icon:<History size={14}/>, label:'Réaffectation', count:assignedCount },
                    ].map(tab => {
                        const isActive = viewMode === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => { setViewMode(tab.id); setSelectedDossier(null); }}
                                style={{
                                    display:'flex', alignItems:'center', gap:8,
                                    padding:'9px 20px', borderRadius:12, border:'none', cursor:'pointer',
                                    fontSize:13, fontWeight:700, transition:'all .15s',
                                    background: isActive ? 'var(--hero-gradient)' : 'transparent',
                                    color: isActive ? 'white' : '#6b7280',
                                    boxShadow: isActive ? '0 4px 12px rgba(29,78,216,.35)' : 'none',
                                }}
                            >
                                {tab.icon} {tab.label}
                                <span style={{
                                    fontSize:11, fontWeight:800, padding:'2px 7px', borderRadius:99,
                                    background: isActive ? 'rgba(255,255,255,.25)' : '#f3f4f6',
                                    color: isActive ? 'white' : '#6b7280',
                                }}>{tab.count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ── 2-col layout ── */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20 }}>

                    {/* ── Left: Dossier list ── */}
                    <div style={{ background:'white', borderRadius:20, border:'1px solid #e5e7eb', boxShadow:'0 4px 16px rgba(0,0,0,.06)', overflow:'hidden', display:'flex', flexDirection:'column' }}>

                        {/* card header */}
                        <div style={{ padding:'18px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fafafa' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <span style={{ fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em' }}>
                                    {viewMode === 'pending' ? 'Dossiers Non Affectés' : 'Dossiers En Cours'}
                                </span>
                                <span style={{ background:'#dbeafe', color:'#1e40af', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:800 }}>
                                    {filteredDossiers.length}
                                </span>
                            </div>

                            <div style={{ position:'relative' }}>
                                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }} />
                                <input
                                    type="text"
                                    placeholder="Rechercher un dossier…"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft:32, paddingRight: searchTerm ? 30 : 12, paddingTop:8, paddingBottom:8, border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, outline:'none', width:240, background:'#f8fafc' }}
                                    onFocus={e => { e.target.style.borderColor='#1d4ed8'; e.target.style.boxShadow='0 0 0 3px rgba(29,78,216,.12)'; }}
                                    onBlur={e  => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; }}
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', border:'none', background:'none', cursor:'pointer', color:'#9ca3af', display:'flex', padding:0 }}>
                                        <X size={13}/>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* table */}
                        <div style={{ overflowY:'auto', maxHeight:520, flex:1 }}>
                            {filteredDossiers.length === 0 ? (
                                <div style={{ padding:'64px 32px', textAlign:'center', color:'#9ca3af' }}>
                                    <Info size={40} style={{ margin:'0 auto 12px', opacity:.2, display:'block' }} />
                                    <div style={{ fontWeight:600, fontSize:14 }}>Aucun dossier trouvé</div>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                    <thead>
                                        <tr style={{ background:'#f8fafc', borderBottom:'2px solid #f1f5f9' }}>
                                            {['Code', 'Libellé / Client', 'Volume', ...(viewMode === 'assigned' ? ['Déclarant'] : []), ''].map((h, i) => (
                                                <th key={i} style={{ padding:'12px 20px', textAlign: i===2 ? 'center' : 'left', fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.07em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDossiers.map(d => (
                                            <DossierRow
                                                key={d.id}
                                                d={d}
                                                selected={selectedDossier?.id === d.id}
                                                showDeclarant={viewMode === 'assigned'}
                                                onClick={() => setSelectedDossier(selectedDossier?.id === d.id ? null : d)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Agent picker + form ── */}
                    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                        <div style={{ background:'white', borderRadius:20, border:'1px solid #e5e7eb', boxShadow:'0 4px 16px rgba(0,0,0,.06)', overflow:'hidden' }}>

                            {/* header */}
                            <div style={{ padding:'18px 24px', borderBottom:'1px solid #f1f5f9', background:'#fafafa' }}>
                                <span style={{ fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em' }}>
                                    Choisir le Déclarant
                                </span>
                            </div>

                            {/* agent list */}
                            <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto' }}>
                                {agents.length === 0 ? (
                                    <div style={{ padding:'24px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>Aucun déclarant disponible</div>
                                ) : agents.map(agent => {
                                    const isSelected = selectedAgent?.id === agent.id;
                                    const name = agent.NomAgent || agent.name || '';
                                    const [bg, color] = avatarColor(name);
                                    return (
                                        <div
                                            key={agent.id}
                                            onClick={() => setSelectedAgent(isSelected ? null : agent)}
                                            style={{
                                                display:'flex', alignItems:'center', gap:12,
                                                padding:'12px 14px', borderRadius:12, cursor:'pointer',
                                                border:`1.5px solid ${isSelected ? '#1d4ed8' : '#f1f5f9'}`,
                                                background: isSelected ? '#faf5ff' : '#fafafa',
                                                transition:'all .15s',
                                            }}
                                            onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor='#bfdbfe'; e.currentTarget.style.background='#eff6ff'; } }}
                                            onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor='#f1f5f9'; e.currentTarget.style.background='#fafafa'; } }}
                                        >
                                            <div style={{ width:38, height:38, borderRadius:10, background: isSelected ? '#1d4ed8' : bg, color: isSelected ? 'white' : color, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0, transition:'all .15s' }}>
                                                {name.charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ flex:1, minWidth:0 }}>
                                                <div style={{ fontWeight:700, fontSize:14, color:'#111827' }}>{name}</div>
                                                <div style={{ fontSize:12, color:'#9ca3af', marginTop:1 }}>{agent.login}</div>
                                            </div>
                                            {isSelected && <Check size={16} color="#1d4ed8" />}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* form */}
                            <div style={{ padding:'18px 20px', borderTop:'1px solid #f1f5f9', background:'#fafafa' }}>
                                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>
                                    Date d'Imputation
                                </label>
                                <input
                                    type="date"
                                    value={assignmentDate}
                                    onChange={e => setAssignmentDate(e.target.value)}
                                    style={{ width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, outline:'none', background:'white', boxSizing:'border-box' }}
                                    onFocus={e => { e.target.style.borderColor='#1d4ed8'; e.target.style.boxShadow='0 0 0 3px rgba(29,78,216,.12)'; }}
                                    onBlur={e  => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; }}
                                />

                                {viewMode === 'assigned' && (
                                    <div style={{ marginTop:14 }}>
                                        <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>
                                            Motif du changement
                                        </label>
                                        <textarea
                                            rows={3}
                                            placeholder="Ex: Maladie, Congé, Rééquilibrage…"
                                            value={reassignMotif}
                                            onChange={e => setReassignMotif(e.target.value)}
                                            style={{ width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, outline:'none', background:'white', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }}
                                            onFocus={e => { e.target.style.borderColor='#1d4ed8'; e.target.style.boxShadow='0 0 0 3px rgba(29,78,216,.12)'; }}
                                            onBlur={e  => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; }}
                                        />
                                    </div>
                                )}

                                {/* Selection summary */}
                                {selectedDossier && selectedAgent && (
                                    <div style={{ marginTop:14, background:'var(--hero-gradient)', borderRadius:12, padding:'14px 16px', position:'relative', overflow:'hidden' }}>
                                        <div style={{ position:'absolute', right:-15, bottom:-15, width:80, height:80, background:'rgba(255,255,255,.06)', borderRadius:'50%' }} />
                                        <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                                            <FileText size={12} color="rgba(255,255,255,.6)" />
                                            <span style={{ fontSize:10, color:'rgba(255,255,255,.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>Dossier</span>
                                            <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color:'white' }}>{selectedDossier.code}</span>
                                        </div>
                                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                                            <UserCheck size={12} color="rgba(255,255,255,.6)" />
                                            <span style={{ fontSize:10, color:'rgba(255,255,255,.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>Agent</span>
                                            <span style={{ fontSize:12, fontWeight:700, color:'white' }}>{selectedAgent.NomAgent || selectedAgent.name}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Buttons */}
                                <div style={{ display:'flex', gap:10, marginTop:14 }}>
                                    <button
                                        onClick={() => window.history.back()}
                                        style={{ flex:1, padding:'11px', borderRadius:12, border:'1px solid #e5e7eb', background:'white', color:'#374151', fontWeight:700, fontSize:13, cursor:'pointer', transition:'all .15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background='#f8fafc'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background='white'; }}
                                    >
                                        Fermer
                                    </button>
                                    <button
                                        onClick={handleApply}
                                        disabled={!canApply}
                                        style={{
                                            flex:1, padding:'11px', borderRadius:12, border:'none',
                                            background: canApply ? 'var(--hero-gradient)' : '#e5e7eb',
                                            color: canApply ? 'white' : '#9ca3af',
                                            fontWeight:700, fontSize:13, cursor: canApply ? 'pointer' : 'not-allowed',
                                            boxShadow: canApply ? '0 4px 14px rgba(29,78,216,.4)' : 'none',
                                            transition:'all .15s',
                                        }}
                                    >
                                        {isSubmitting ? 'Traitement…' : 'Appliquer'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
};

/* ─── DossierRow ─────────────────────────────────────────────────────────── */
const DossierRow = ({ d, selected, showDeclarant, onClick }) => {
    const [hovered, setHovered] = useState(false);
    const highlight = selected || hovered;

    const cellStyle = {
        padding:'13px 20px', borderBottom:'1px solid #f8fafc',
        background: selected ? '#faf5ff' : hovered ? '#eff6ff' : 'white',
        transition:'background .1s',
    };

    return (
        <tr
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ cursor:'pointer' }}
        >
            <td style={cellStyle}>
                <div style={{ fontWeight:700, color:'#111827', fontSize:13, fontFamily:'monospace' }}>{d.code}</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:2, fontFamily:'monospace' }}>{d.shortCode}</div>
            </td>
            <td style={cellStyle}>
                <div style={{ fontWeight:600, color:'#374151', fontSize:13 }}>{d.label}</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                    <User size={10}/> {d.clientName}
                    {d.clientNinea && <><span style={{ color:'#e5e7eb' }}>•</span> {d.clientNinea}</>}
                </div>
            </td>
            <td style={{ ...cellStyle, textAlign:'center' }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#111827' }}>{d.total_colis || 0} Colis</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{Number(d.total_poids||0).toFixed(0)} kg</div>
            </td>
            {showDeclarant && (
                <td style={cellStyle}>
                    <span style={{ background:'#dbeafe', color:'#1e3a8a', borderRadius:99, padding:'4px 10px', fontSize:11, fontWeight:700 }}>
                        {d.active_agent_name}
                    </span>
                </td>
            )}
            <td style={{ ...cellStyle, width:36 }}>
                <ChevronRight size={16} color={highlight ? '#1d4ed8' : '#d1d5db'} style={{ transition:'color .15s' }} />
            </td>
        </tr>
    );
};

export default CotationPage;
