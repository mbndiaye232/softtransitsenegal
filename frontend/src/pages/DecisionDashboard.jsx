import React, { useState, useEffect } from 'react';
import { getReferenceSymbol } from '../utils/currency';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
    TrendingUp, Users, DollarSign, Wallet, Calendar, ArrowUpRight,
    ArrowDownRight, PieChart as PieIcon, BarChart2, Briefcase,
    RefreshCw, Download, Activity, AlertCircle
} from 'lucide-react';
import { dashboardsAPI } from '../services/api';

/* ── couleurs par bloc ── */
const BLOCK = {
    ca:       { accent: '#2563eb', light: '#eff6ff', border: '#bfdbfe', grad: 'var(--hero-gradient)', header: '#1e3a8a' },
    encours:  { accent: '#dc2626', light: '#fef2f2', border: '#fecaca', grad: 'var(--hero-gradient)', header: '#7f1d1d' },
    flux:     { accent: '#059669', light: '#ecfdf5', border: '#a7f3d0', grad: 'var(--hero-gradient)', header: '#064e3b' },
    dossiers: { accent: '#1d4ed8', light: '#faf5ff', border: '#bfdbfe', grad: 'var(--hero-gradient)', header: '#2e1065' },
    perf:     { accent: '#0369a1', light: '#eff6ff', border: '#bae6fd', grad: 'var(--hero-gradient)', header: '#0c4a6e' },
    aging:    { accent: '#d97706', light: '#fffbeb', border: '#fde68a', grad: 'var(--hero-gradient)', header: '#78350f' },
    trends:   { accent: '#1d4ed8', light: '#faf5ff', border: '#bfdbfe', grad: 'var(--hero-gradient)', header: '#2e1065' },
    topca:    { accent: '#2563eb', light: '#eff6ff', border: '#bfdbfe', grad: 'var(--hero-gradient)', header: '#1e3a8a' },
    topenc:   { accent: '#dc2626', light: '#fef2f2', border: '#fecaca', grad: 'var(--hero-gradient)', header: '#7f1d1d' },
};

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#3b82f6', '#06b6d4'];

/* ── sous-composants ── */
function BlockCard({ colorKey, icon, title, children, style = {} }) {
    const c = BLOCK[colorKey];
    return (
        <div style={{
            background: 'white', borderRadius: '1.15rem',
            border: `1px solid ${c.border}`,
            boxShadow: `0 4px 24px rgba(0,0,0,0.07)`,
            overflow: 'hidden', ...style
        }}>
            <div style={{
                background: c.grad, padding: '0.9rem 1.25rem',
                display: 'flex', alignItems: 'center', gap: '0.6rem'
            }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {icon}
                </div>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>{title}</span>
            </div>
            <div style={{ padding: '1.25rem' }}>
                {children}
            </div>
        </div>
    );
}

function KpiCard({ colorKey, icon, label, value, trend, trendUp, sub }) {
    const c = BLOCK[colorKey];
    return (
        <div style={{
            background: 'white', borderRadius: '1.15rem',
            border: `1px solid ${c.border}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
            overflow: 'hidden',
        }}>
            <div style={{ height: '4px', background: c.grad }} />
            <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                    <div style={{
                        width: '42px', height: '42px', borderRadius: '10px',
                        background: c.light, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {icon}
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.2rem',
                        fontSize: '0.78rem', fontWeight: 700,
                        color: trendUp ? '#16a34a' : '#dc2626',
                        background: trendUp ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${trendUp ? '#bbf7d0' : '#fecaca'}`,
                        borderRadius: '99px', padding: '0.2rem 0.55rem'
                    }}>
                        {trendUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {trend}
                    </div>
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '0.3rem' }}>{label}</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>{sub}</div>
            </div>
        </div>
    );
}

const CustomTooltip = ({ active, payload, label, formatter }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'rgba(15,23,42,0.93)', border: '1px solid #334155',
            borderRadius: '0.6rem', padding: '0.75rem 1rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)', color: 'white', minWidth: '160px'
        }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {label}
            </div>
            {payload.map((p, i) => (
                <div key={i} style={{ fontSize: '0.83rem', fontWeight: 700, color: p.color, marginBottom: '0.2rem' }}>
                    {p.name} : {formatter ? formatter(p.value) : p.value}
                </div>
            ))}
        </div>
    );
};

/* ── composant principal ── */
const DecisionDashboard = () => {
    const [loading, setLoading]               = useState(true);
    const [spinning, setSpinning]             = useState(false);
    const [topClients, setTopClients]         = useState([]);
    const [topEncours, setTopEncours]         = useState([]);
    const [agingBalance, setAgingBalance]     = useState([]);
    const [performanceTrends, setPerformanceTrends] = useState([]);
    const [dossierTrends, setDossierTrends]   = useState([]);

    useEffect(() => { fetchAllData(); }, []);

    const fetchAllData = async () => {
        setLoading(true); setSpinning(true);
        // Promise.allSettled so that if one endpoint errors (e.g. aging-balance
        // 500), the others still populate the dashboard.
        const settle = (p) => p.then(r => ({ ok: true, data: r.data }))
                              .catch(e => { console.error('Dashboard endpoint failed:', e); return { ok: false, data: [] }; });
        try {
            const [clientsRes, encoursRes, agingRes, perfRes, dossierRes] = await Promise.all([
                settle(dashboardsAPI.getTopClientsCA()),
                settle(dashboardsAPI.getTopEncours()),
                settle(dashboardsAPI.getAgingBalance()),
                settle(dashboardsAPI.getPerformanceTrends()),
                settle(dashboardsAPI.getDossierTrends()),
            ]);
            setTopClients(clientsRes.data || []);
            setTopEncours(encoursRes.data || []);
            setAgingBalance(agingRes.data || []);
            setPerformanceTrends(perfRes.data || []);
            setDossierTrends(dossierRes.data || []);
        } finally {
            setLoading(false);
            setTimeout(() => setSpinning(false), 700);
        }
    };

    const formatCurrency = (val) =>
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val);

    /* ── Export rapport CSV ──
       Produit un fichier .csv multi-sections ouvrable par Excel / LibreOffice.
       BOM UTF-8 + séparateur ';' pour compatibilité Excel français. */
    const handleExportReport = () => {
        const esc = (v) => {
            if (v === null || v === undefined) return '';
            const s = String(v).replace(/"/g, '""');
            return /[";\n]/.test(s) ? `"${s}"` : s;
        };
        const row = (...cells) => cells.map(esc).join(';');
        const blank = '';
        const today = new Date();
        const dateStr = today.toLocaleDateString('fr-FR');
        const fileDate = today.toISOString().slice(0, 10);

        const lines = [];
        lines.push(row('Tableau de Bord Directionnel - Soft Transit'));
        lines.push(row('Date d\'export', dateStr));
        lines.push(blank);

        lines.push(row('=== INDICATEURS CLES ==='));
        lines.push(row('Indicateur', `Valeur (${getReferenceSymbol()})`));
        lines.push(row('Chiffre d\'Affaires (H.T)', Math.round(totalCA)));
        lines.push(row('Total Encours Client', Math.round(totalEncours)));
        lines.push(row('Flux Financiers (12 mois)', Math.round(totalFlux)));
        lines.push(row('Ouvertures Dossiers (12 mois)', totalDoss));
        lines.push(blank);

        lines.push(row('=== TOP 10 CLIENTS PAR CHIFFRE D\'AFFAIRES ==='));
        lines.push(row('Client', `Montant CA (${getReferenceSymbol()})`));
        topClients.forEach(c => lines.push(row(c.name, Math.round(parseFloat(c.value || 0)))));
        lines.push(blank);

        lines.push(row('=== TOP 10 CLIENTS PAR ENCOURS ==='));
        lines.push(row('Client', `Encours (${getReferenceSymbol()})`));
        topEncours.forEach(c => lines.push(row(c.name, Math.round(parseFloat(c.value || 0)))));
        lines.push(blank);

        lines.push(row('=== BALANCE AGEE (factures non reglees) ==='));
        lines.push(row('Tranche', `Montant (${getReferenceSymbol()})`));
        agingBalance.forEach(a => lines.push(row(a.period, Math.round(parseFloat(a.amount || 0)))));
        lines.push(blank);

        lines.push(row('=== EVOLUTION CA vs REGLEMENTS (12 mois) ==='));
        lines.push(row('Mois', `CA facture (${getReferenceSymbol()})`, `Reglements (${getReferenceSymbol()})`));
        performanceTrends.forEach(p => lines.push(row(p.month, Math.round(p.ca || 0), Math.round(p.pay || 0))));
        lines.push(blank);

        lines.push(row('=== EVOLUTION OUVERTURES DOSSIERS (12 mois) ==='));
        lines.push(row('Mois', 'Nombre de dossiers'));
        dossierTrends.forEach(d => lines.push(row(d.month, d.count || 0)));

        // BOM UTF-8 pour qu Excel affiche correctement les accents
        const csv = '﻿' + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `soft-transit-rapport-${fileDate}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const totalCA      = topClients.reduce((a, c) => a + parseFloat(c.value || 0), 0);
    const totalEncours = topEncours.reduce((a, c) => a + parseFloat(c.value || 0), 0);
    const totalFlux    = performanceTrends.reduce((a, c) => a + (c.pay || 0), 0);
    const totalDoss    = dossierTrends.reduce((a, c) => a + (c.count || 0), 0);

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>

            {/* ── Hero ── */}
            <div style={{
                background: 'var(--hero-gradient)',
                padding: '2rem 2rem 5.5rem',
                position: 'relative', overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', top: '-80px', right: '-80px',
                    width: '320px', height: '320px', borderRadius: '50%',
                    background: 'rgba(59,130,246,0.08)', pointerEvents: 'none'
                }} />
                <div style={{
                    position: 'absolute', bottom: '-50px', left: '25%',
                    width: '200px', height: '200px', borderRadius: '50%',
                    background: 'rgba(14,165,233,0.06)', pointerEvents: 'none'
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '14px',
                            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                            <Activity size={24} color="white" />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
                                Tableau de Bord Directionnel
                            </h1>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                                Synthèse de l'activité, performance financière et analyse des risques.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={fetchAllData} disabled={loading} style={{
                            display: 'flex', alignItems: 'center', gap: '0.45rem',
                            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.25)', borderRadius: '0.6rem',
                            padding: '0.55rem 1rem', color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem', fontWeight: 600, opacity: loading ? 0.7 : 1
                        }}>
                            <RefreshCw size={15} style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }} />
                            Actualiser
                        </button>
                        <button onClick={handleExportReport} disabled={loading} style={{
                            display: 'flex', alignItems: 'center', gap: '0.45rem',
                            background: 'white', border: 'none', borderRadius: '0.6rem',
                            padding: '0.55rem 1.1rem', color: '#0f172a',
                            cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', opacity: loading ? 0.6 : 1
                        }}>
                            <Download size={15} />
                            Exporter Rapport
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Contenu flottant ── */}
            <div style={{ maxWidth: '1500px', margin: '-48px auto 0', padding: '0 2rem 3rem', position: 'relative', zIndex: 10 }}>

                {loading ? (
                    <div style={{
                        background: 'white', borderRadius: '1.25rem',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
                        padding: '5rem 2rem', textAlign: 'center',
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '50%',
                            background: 'var(--hero-gradient)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.25rem',
                            animation: 'spin 1s linear infinite',
                            boxShadow: '0 4px 20px rgba(37,99,235,0.35)'
                        }}>
                            <RefreshCw size={24} color="white" />
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Calcul des indicateurs stratégiques…</p>
                    </div>
                ) : (
                    <>
                        {/* ── KPI Cards ── */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
                            gap: '1.25rem', marginBottom: '1.5rem'
                        }}>
                            <KpiCard colorKey="ca" icon={<TrendingUp size={20} color={BLOCK.ca.accent} />}
                                label="Chiffre d'Affaires (H.T)" value={formatCurrency(totalCA)}
                                trend="+12%" trendUp={true} sub="Cumul Top 10 clients validés" />
                            <KpiCard colorKey="encours" icon={<Wallet size={20} color={BLOCK.encours.accent} />}
                                label="Total Encours Client" value={formatCurrency(totalEncours)}
                                trend="-5%" trendUp={false} sub="Cumul des factures non réglées" />
                            <KpiCard colorKey="flux" icon={<DollarSign size={20} color={BLOCK.flux.accent} />}
                                label="Flux Financiers" value={formatCurrency(totalFlux)}
                                trend="+8.4%" trendUp={true} sub="Encaissements sur 12 mois" />
                            <KpiCard colorKey="dossiers" icon={<Briefcase size={20} color={BLOCK.dossiers.accent} />}
                                label="Ouvertures Dossiers" value={totalDoss}
                                trend="+15%" trendUp={true} sub="Nouveaux dossiers (12 mois)" />
                        </div>

                        {/* ── CA vs Règlements + Balance Âgée ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>

                            <BlockCard colorKey="perf" title="Évolution comparée CA vs Règlements"
                                icon={<BarChart2 size={17} color="white" />}>
                                <div style={{ width: '100%', height: 320 }}>
                                    <ResponsiveContainer>
                                        <AreaChart data={performanceTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gradPay" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={55} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                                            <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                                            <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '12px' }} />
                                            <Area type="monotone" dataKey="ca" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#gradCA)" name="CA Facturé" dot={false} activeDot={{ r: 5, fill: '#2563eb' }} />
                                            <Area type="monotone" dataKey="pay" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#gradPay)" name="Règlements" dot={false} activeDot={{ r: 5, fill: '#059669' }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </BlockCard>

                            <BlockCard colorKey="aging" title="Répartition de la Balance Âgée"
                                icon={<PieIcon size={17} color="white" />}>
                                <div style={{ width: '100%', height: 190 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={agingBalance} innerRadius={55} outerRadius={80}
                                                paddingAngle={4} dataKey="amount" nameKey="period">
                                                {agingBalance.map((_, i) => (
                                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => formatCurrency(v)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ marginTop: '0.5rem' }}>
                                    {agingBalance.map((item, i) => (
                                        <div key={i} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '0.55rem 0',
                                            borderBottom: i < agingBalance.length - 1 ? '1px solid #f8fafc' : 'none'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#475569' }}>
                                                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                                                {item.period}
                                            </div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                                                {formatCurrency(item.amount)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </BlockCard>
                        </div>

                        {/* ── Évolution Dossiers ── */}
                        <BlockCard colorKey="trends" title="Évolution des Ouvertures de Dossiers (12 mois)"
                            icon={<Calendar size={17} color="white" />} style={{ marginBottom: '1.5rem' }}>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={dossierTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line
                                            type="monotone" dataKey="count" stroke="#1d4ed8" strokeWidth={3}
                                            name="Dossiers"
                                            dot={{ r: 5, fill: '#1d4ed8', stroke: 'white', strokeWidth: 2 }}
                                            activeDot={{ r: 7 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </BlockCard>

                        {/* ── Top Clients ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '1.25rem' }}>

                            <BlockCard colorKey="topca" title="Top 10 Clients — Chiffre d'Affaires"
                                icon={<Users size={17} color="white" />}>
                                <div style={{ width: '100%', height: 360 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={topClients} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                                                tick={{ fill: '#475569', fontSize: 11 }} width={130} />
                                            <Tooltip formatter={(v) => formatCurrency(v)} content={<CustomTooltip formatter={formatCurrency} />} />
                                            <Bar dataKey="value" name="CA" radius={[0, 5, 5, 0]} barSize={18}>
                                                {topClients.map((_, i) => (
                                                    <Cell key={i} fill={`rgba(37,99,235,${1 - i * 0.07})`} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </BlockCard>

                            <BlockCard colorKey="topenc" title="Top 10 Clients — Encours"
                                icon={<Wallet size={17} color="white" />}>
                                <div style={{ width: '100%', height: 360 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={topEncours} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                                                tick={{ fill: '#475569', fontSize: 11 }} width={130} />
                                            <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                                            <Bar dataKey="value" name="Encours" radius={[0, 5, 5, 0]} barSize={18}>
                                                {topEncours.map((_, i) => (
                                                    <Cell key={i} fill={`rgba(220,38,38,${1 - i * 0.07})`} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </BlockCard>
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default DecisionDashboard;
