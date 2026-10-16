import React, { useState, useEffect, useMemo } from 'react';
import { dashboardsAPI } from '../services/api';
import {
    FileText, Download, Search, Filter, Calendar,
    Package, CheckCircle, Clock, User, Ship, Plane,
    TrendingUp, RefreshCw, Truck, Activity, AlertTriangle,
    ChevronDown, X
} from 'lucide-react';
import * as XLSX from 'xlsx';

/* ─── StatPill ───────────────────────────────────────────────────────────── */
const StatPill = ({ icon, label, value, color, onClick, active }) => (
    <div
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: active ? color + '18' : 'white',
            border: `1.5px solid ${active ? color : '#e5e7eb'}`,
            borderRadius: 14, padding: '12px 20px',
            boxShadow: active ? `0 4px 14px ${color}28` : '0 1px 3px rgba(0,0,0,.05)',
            minWidth: 'fit-content', cursor: onClick ? 'pointer' : 'default',
            transition: 'all .15s',
        }}
    >
        <span style={{ color, display: 'flex' }}>{icon}</span>
        <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{label}</div>
        </div>
    </div>
);

/* ─── helpers ────────────────────────────────────────────────────────────── */
const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR') : '-';

const avatarColors = [
    ['#ede9fe','#6d28d9'],['#dbeafe','#1d4ed8'],['#dcfce7','#15803d'],
    ['#ffedd5','#c2410c'],['#fce7f3','#be185d'],['#e0f2fe','#0369a1'],
    ['#fef9c3','#a16207'],['#f1f5f9','#475569'],
];
const avatarColor = (name='') => avatarColors[name.charCodeAt(0) % 8];

const STATUS_STYLE = {
    'Livré':   { bg:'#dcfce7', color:'#15803d' },
    'Clôturé': { bg:'#dcfce7', color:'#15803d' },
    'Ouvert':  { bg:'#dbeafe', color:'#1d4ed8' },
};
const statusStyle = s => STATUS_STYLE[s] || { bg:'#fef3c7', color:'#b45309' };

const SuiviDossiers = () => {
    const [data, setData]             = useState([]);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [activeStat, setActiveStat] = useState(null);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true); else setRefreshing(true);
        try {
            const res = await dashboardsAPI.getDetailedTracking();
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const stats = useMemo(() => ({
        total:   data.length,
        encours: data.filter(d => d.status !== 'Clôturé').length,
        arrivees: data.filter(d => d.dateArrivee).length,
        retards: data.filter(d => d.dateArrivee && new Date(d.dateArrivee) < new Date() && d.status !== 'Clôturé').length,
    }), [data]);

    const uniqueStatuses = useMemo(() => [...new Set(data.map(d => d.status))].filter(Boolean), [data]);

    const filteredData = useMemo(() => data.filter(item => {
        const q = searchTerm.toLowerCase();
        const matchSearch =
            (item.clientName?.toLowerCase()||'').includes(q) ||
            (item.code?.toLowerCase()||'').includes(q) ||
            (item.docNumber?.toLowerCase()||'').includes(q) ||
            (item.otNumber?.toLowerCase()||'').includes(q);
        const matchStatus = filterStatus === 'all' || item.status === filterStatus;
        const matchStat = !activeStat
            || (activeStat === 'encours'  && item.status !== 'Clôturé')
            || (activeStat === 'arrivees' && item.dateArrivee)
            || (activeStat === 'retards'  && item.dateArrivee && new Date(item.dateArrivee) < new Date() && item.status !== 'Clôturé');
        return matchSearch && matchStatus && matchStat;
    }), [data, searchTerm, filterStatus, activeStat]);

    const handleExport = () => {
        const rows = filteredData.map(item => ({
            'Client': item.clientName || '-',
            'Code Dossier': item.code || '-',
            'Code Court': item.shortCode || '-',
            'Date Dossier': fmt(item.dateDossier),
            'Date Remise': fmt(item.dateRemiseDocs),
            'BL / LTA': item.docNumber || '-',
            'OT': item.otNumber || '-',
            'Navire / Vol': item.vesselFlight || '-',
            'Date Arrivée': fmt(item.dateArrivee),
            'N° Déclaration': item.declNumber || '-',
            'Date Déclaration': fmt(item.declDate),
            'Déclarant': item.declarantName || '-',
            'Régime': item.regime || '-',
            'Date BAE': fmt(item.dateBAE),
            'Date HL (ML)': fmt(item.dateML),
            'Date RCO': fmt(item.dateRCO),
            'Date Livraison': fmt(item.dateLiv),
            'Transporteur': item.transporteur || '-',
            'Statut': item.status || '-',
            'Colis': item.nbColis || 0,
            'Poids': item.poids || 0,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Suivi Dossiers');
        XLSX.writeFile(wb, `Suivi_Dossiers_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    /* ── Loading state ── */
    if (loading) return (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#eff6ff' }}>
            <div style={{ textAlign:'center' }}>
                <div style={{ width:44, height:44, border:'3px solid #bfdbfe', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 12px' }} />
                <div style={{ fontSize:14, color:'#1e40af', fontWeight:600 }}>Chargement du suivi…</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    return (
        <div style={{ minHeight:'100vh', background:'#eff6ff', fontFamily:'inherit' }}>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div style={{
                background: 'linear-gradient(135deg, #0f2854 0%, #1e40af 55%, #2563eb 100%)',
                padding: '32px 40px 72px', position:'relative', overflow:'hidden',
            }}>
                <div style={{ position:'absolute', top:-60, right:-60, width:240, height:240, background:'rgba(255,255,255,.05)', borderRadius:'50%' }} />
                <div style={{ position:'absolute', bottom:-40, right:200, width:140, height:140, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />
                <div style={{ position:'absolute', top:20, right:120, width:80, height:80, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:20, flexWrap:'wrap' }}>
                    <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                            <div style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(6px)', borderRadius:99, padding:'5px 14px', fontSize:12, fontWeight:700, color:'rgba(255,255,255,.9)', border:'1px solid rgba(255,255,255,.2)' }}>
                                <Activity size={11} style={{ display:'inline', marginRight:5, verticalAlign:'middle' }} />
                                Temps réel
                            </div>
                        </div>
                        <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:'white', letterSpacing:'-.02em' }}>
                            Tableau de suivi des dossiers
                        </h1>
                        <p style={{ margin:'8px 0 0', fontSize:14, color:'rgba(255,255,255,.7)', fontWeight:500 }}>
                            Suivez l'avancement de vos opérations de transit en temps réel.
                        </p>
                    </div>

                    <div style={{ display:'flex', gap:10, flexShrink:0 }}>
                        <button
                            onClick={handleExport}
                            style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 20px', borderRadius:12, border:'none', background:'#16a34a', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 4px 14px rgba(22,163,74,.4)', transition:'all .15s' }}
                            onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
                        >
                            <Download size={16}/> Exporter EXCEL
                        </button>
                        <button
                            onClick={() => fetchData(true)}
                            disabled={refreshing}
                            style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 20px', borderRadius:12, border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.15)', backdropFilter:'blur(6px)', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', transition:'all .15s' }}
                        >
                            <RefreshCw size={16} style={{ animation: refreshing ? 'spin .8s linear infinite' : 'none' }}/> Actualiser
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Floating card ────────────────────────────────────────────── */}
            <div style={{ maxWidth:1600, margin:'0 auto', padding:'0 32px 48px', marginTop:'-48px', position:'relative', zIndex:1 }}>

                {/* Stats */}
                <div style={{ background:'white', borderRadius:20, border:'1px solid #e5e7eb', boxShadow:'0 8px 32px rgba(0,0,0,.10)', padding:'20px 28px', marginBottom:20, display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                    <StatPill icon={<Package size={20}/>}      label="Dossiers Total"   value={stats.total}    color="#2563eb" />
                    <div style={{ width:1, height:36, background:'#f1f5f9', flexShrink:0 }} />
                    <StatPill icon={<CheckCircle size={20}/>}  label="En Cours"         value={stats.encours}  color="#16a34a" onClick={() => setActiveStat(activeStat==='encours'?null:'encours')}   active={activeStat==='encours'} />
                    <StatPill icon={<Ship size={20}/>}         label="Arrivées Prévues" value={stats.arrivees} color="#d97706" onClick={() => setActiveStat(activeStat==='arrivees'?null:'arrivees')} active={activeStat==='arrivees'} />
                    <StatPill icon={<AlertTriangle size={20}/>}label="Retards"          value={stats.retards}  color="#dc2626" onClick={() => setActiveStat(activeStat==='retards'?null:'retards')}   active={activeStat==='retards'} />

                    <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                        {/* Search */}
                        <div style={{ position:'relative' }}>
                            <Search size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }} />
                            <input
                                type="text"
                                placeholder="Client, dossier, BL, OT…"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ paddingLeft:36, paddingRight: searchTerm ? 32 : 14, paddingTop:9, paddingBottom:9, border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, outline:'none', width:240, background:'#f8fafc', transition:'all .15s' }}
                                onFocus={e => { e.target.style.borderColor='#2563eb'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,.12)'; e.target.style.background='white'; }}
                                onBlur={e  => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; e.target.style.background='#f8fafc'; }}
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', border:'none', background:'none', cursor:'pointer', color:'#9ca3af', display:'flex', padding:0 }}>
                                    <X size={14}/>
                                </button>
                            )}
                        </div>

                        {/* Status filter */}
                        <div style={{ position:'relative' }}>
                            <Filter size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }} />
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                style={{ paddingLeft:32, paddingRight:28, paddingTop:9, paddingBottom:9, border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, outline:'none', background:'#f8fafc', cursor:'pointer', appearance:'none', minWidth:170 }}
                            >
                                <option value="all">Tous les statuts</option>
                                {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <ChevronDown size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }} />
                        </div>

                        {/* Active filter badge */}
                        {(activeStat || filterStatus !== 'all' || searchTerm) && (
                            <div style={{ fontSize:12, color:'#6b7280', display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ fontWeight:700, color:'#111827' }}>{filteredData.length}</span> résultat{filteredData.length>1?'s':''}
                                <button onClick={() => { setActiveStat(null); setFilterStatus('all'); setSearchTerm(''); }} style={{ border:'none', background:'#f1f5f9', borderRadius:99, padding:'3px 8px', cursor:'pointer', fontSize:11, fontWeight:600, color:'#6b7280', display:'flex', alignItems:'center', gap:3 }}>
                                    <X size={10}/> Réinitialiser
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Table ──────────────────────────────────────────────────── */}
                <div style={{ background:'white', borderRadius:20, border:'1px solid #e5e7eb', boxShadow:'0 4px 16px rgba(0,0,0,.06)', overflow:'hidden' }}>
                    <div style={{ overflowX:'auto' }}>
                        {filteredData.length === 0 ? (
                            <div style={{ padding:'64px 32px', textAlign:'center', color:'#9ca3af' }}>
                                <Package size={48} style={{ margin:'0 auto 16px', opacity:.2, display:'block' }} />
                                <div style={{ fontWeight:600, fontSize:15 }}>Aucun dossier ne correspond à votre recherche.</div>
                                <div style={{ fontSize:13, marginTop:6 }}>Essayez d'élargir vos critères de filtre.</div>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:2100 }}>
                                <thead>
                                    <tr style={{ background:'#f8fafc', borderBottom:'2px solid #f1f5f9' }}>
                                        {[
                                            'Clients','Code Dossier','C. Court','Date Dossier','Date Remise',
                                            'BL / LTA / LVI','OT','Compagnie / Navire / Vol','Date Arrivée',
                                            'N° Déclaration','Date Décl.','Déclarant','Régime',
                                            'Date BAE','Date HL (ML)','Date RCO','Date Liv.','Transporteur','Statut','Colis','Poids'
                                        ].map(h => (
                                            <th key={h} style={{ padding:'12px 14px', textAlign:'left', fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.07em', whiteSpace:'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((item, idx) => (
                                        <TableRow key={idx} item={item} />
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        )}
                    </div>

                    {filteredData.length > 0 && (
                        <div style={{ padding:'12px 20px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:12, color:'#9ca3af', fontWeight:600 }}>
                                {filteredData.length} dossier{filteredData.length>1?'s':''} affiché{filteredData.length>1?'s':''}
                            </span>
                            <span style={{ fontSize:12, color:'#9ca3af' }}>
                                Exportez pour voir toutes les colonnes
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
};

/* ─── TableRow ───────────────────────────────────────────────────────────── */
const TableRow = ({ item }) => {
    const [hovered, setHovered] = useState(false);
    const [bg, initColor] = avatarColor(item.clientName || '');
    const ss = statusStyle(item.status);

    const cell = {
        padding:'11px 14px', borderBottom:'1px solid #f1f5f9', whiteSpace:'nowrap',
        color:'#374151', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis',
        background: hovered ? '#eff6ff' : 'white', transition:'background .1s',
    };

    return (
        <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            {/* Client */}
            <td style={cell}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:bg, color:initColor, fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {(item.clientName||'?').substring(0,2).toUpperCase()}
                    </div>
                    <span style={{ fontWeight:600, fontSize:13 }} title={item.clientName}>{item.clientName}</span>
                </div>
            </td>

            {/* Code dossier */}
            <td style={cell}>
                <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color: hovered?'#b45309':'#2563eb', background: hovered?'#fef3c7':'#eff6ff', border:`1px solid ${hovered?'#fde68a':'#dbeafe'}`, padding:'3px 8px', borderRadius:6, transition:'all .15s' }}>
                    {item.code}
                </span>
            </td>

            {/* Code court */}
            <td style={{ ...cell, color:'#64748b', fontWeight:600, fontSize:12 }}>{item.shortCode || '-'}</td>

            {/* Dates */}
            <td style={cell}>{fmt(item.dateDossier)}</td>
            <td style={{ ...cell, color: item.dateRemiseDocs ? '#374151' : '#d1d5db' }}>{fmt(item.dateRemiseDocs)}</td>

            {/* BL */}
            <td style={{ ...cell }}>
                <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:600, color:'#374151' }}>{item.docNumber || '-'}</span>
            </td>

            {/* OT */}
            <td style={{ ...cell, fontWeight:700, color:'#111827' }}>{item.otNumber || '-'}</td>

            {/* Navire / Vol */}
            <td style={cell}>
                {item.vesselFlight ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <Ship size={13} color="#94a3b8" />
                        <span>{item.vesselFlight}</span>
                    </div>
                ) : '-'}
            </td>

            {/* Date arrivée */}
            <td style={cell}>
                {item.dateArrivee ? (
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <Calendar size={12} color="#f59e0b" />
                        {fmt(item.dateArrivee)}
                    </span>
                ) : '-'}
            </td>

            {/* N° Déclaration */}
            <td style={{ ...cell, fontWeight:600 }}>{item.declNumber || '-'}</td>

            {/* Date décl */}
            <td style={cell}>{fmt(item.declDate)}</td>

            {/* Déclarant */}
            <td style={cell}>
                {item.declarantName ? (
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <User size={12} color="#2563eb" />
                        <span>{item.declarantName}</span>
                    </div>
                ) : '-'}
            </td>

            {/* Régime */}
            <td style={cell}>
                {item.regime ? (
                    <span style={{ background:'#f1f5f9', color:'#475569', borderRadius:6, padding:'3px 8px', fontWeight:700, fontSize:12 }}>{item.regime}</span>
                ) : '-'}
            </td>

            {/* Dates BAE / HL / RCO / Liv */}
            <td style={cell}>{fmt(item.dateBAE)}</td>
            <td style={cell}>{fmt(item.dateML)}</td>
            <td style={cell}>{fmt(item.dateRCO)}</td>
            <td style={cell}>{fmt(item.dateLiv)}</td>

            {/* Transporteur */}
            <td style={cell}>
                {item.transporteur ? (
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <Truck size={12} color="#94a3b8" />
                        <span>{item.transporteur}</span>
                    </div>
                ) : '-'}
            </td>

            {/* Statut */}
            <td style={cell}>
                {item.status ? (
                    <span style={{ background:ss.bg, color:ss.color, borderRadius:99, padding:'4px 10px', fontWeight:700, fontSize:11 }}>
                        {item.status}
                    </span>
                ) : '-'}
            </td>

            {/* Colis / Poids */}
            <td style={{ ...cell, fontWeight:700, textAlign:'right' }}>{item.nbColis ?? '-'}</td>
            <td style={{ ...cell, fontWeight:700, color:'#2563eb', textAlign:'right' }}>
                {item.poids ? `${item.poids} kg` : '-'}
            </td>
        </tr>
    );
};

export default SuiviDossiers;
