import { useEffect, useState } from 'react'
import { TrendingUp, X, ArrowRight, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, CartesianGrid
} from 'recharts'
import { dashboardsAPI } from '../services/api'

const fmt = (n) => {
    if (n == null) return '—'
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M'
    if (n >= 1_000) return (n / 1_000).toFixed(0) + ' K'
    return n.toLocaleString('fr-FR')
}

const AGING_COLORS = { '0-30j': '#10b981', '31-90j': '#f59e0b', '91-120j': '#f97316', '+120j': '#ef4444' }

export default function DirecteurModal({ onClose }) {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [topClients, setTopClients] = useState([])
    const [topEncours, setTopEncours] = useState([])
    const [aging, setAging] = useState([])
    const [trends, setTrends] = useState([])

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = ''
        }
    }, [onClose])

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const [ca, enc, ag, tr] = await Promise.all([
                    dashboardsAPI.getTopClientsCA(),
                    dashboardsAPI.getTopEncours(),
                    dashboardsAPI.getAgingBalance(),
                    dashboardsAPI.getPerformanceTrends(),
                ])
                setTopClients(ca.data.slice(0, 5))
                setTopEncours(enc.data.slice(0, 5))
                setAging(ag.data)
                setTrends(tr.data.slice(-6))
            } catch (err) {
                console.error('DirecteurModal fetch error:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const totalCA = topClients.reduce((a, c) => a + parseFloat(c.value || 0), 0)
    const totalEncours = topEncours.reduce((a, c) => a + parseFloat(c.value || 0), 0)
    const totalAging = aging.reduce((a, c) => a + parseFloat(c.amount || 0), 0)

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(5px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1.5rem', animation: 'fadeIn 0.2s ease-out',
            }}
        >
            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
            `}</style>
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#f8fafc', borderRadius: '20px',
                    width: '100%', maxWidth: '1100px', maxHeight: '90vh',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: '0 25px 60px -12px rgba(0,0,0,0.45)',
                    animation: 'slideUp 0.3s ease-out',
                }}
            >
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
                    padding: '1.25rem 1.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.18)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <TrendingUp size={22} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Bienvenue
                            </div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white' }}>
                                Tableau de bord financier
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '34px', height: '34px', borderRadius: '10px',
                            background: 'rgba(255,255,255,0.15)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        aria-label="Fermer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '10px', color: '#64748b' }}>
                            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontWeight: 600 }}>Chargement des données…</span>
                            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
                        </div>
                    ) : (
                        <>
                            {/* KPI row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                <KpiCard label="CA total (top clients)" value={fmt(totalCA)} sub="factures validées" color="#2563eb" bg="#eff6ff" />
                                <KpiCard label="Encours clients" value={fmt(totalEncours)} sub="soldes non réglés" color="#dc2626" bg="#fef2f2" />
                                <KpiCard label="Créances en retard" value={fmt(totalAging)} sub="toutes échéances" color="#d97706" bg="#fffbeb" />
                            </div>

                            {/* Charts row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {/* Top 5 CA */}
                                <ChartCard title="Top 5 clients — CA" color="#2563eb">
                                    <ResponsiveContainer width="100%" height={160}>
                                        <BarChart data={topClients} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                                            <XAxis type="number" hide />
                                            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} />
                                            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                                            <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>

                                {/* Top 5 encours */}
                                <ChartCard title="Top 5 clients — Encours" color="#dc2626">
                                    <ResponsiveContainer width="100%" height={160}>
                                        <BarChart data={topEncours} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                                            <XAxis type="number" hide />
                                            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} />
                                            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                                            <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </div>

                            {/* Trends + Aging row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                                {/* Performance trends */}
                                <ChartCard title="Tendances CA vs Encaissements (6 mois)" color="#059669">
                                    <ResponsiveContainer width="100%" height={150}>
                                        <AreaChart data={trends} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="gCA" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gPay" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                            <YAxis hide />
                                            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                                            <Area type="monotone" dataKey="ca" stroke="#2563eb" fill="url(#gCA)" strokeWidth={2} dot={false} name="CA" />
                                            <Area type="monotone" dataKey="pay" stroke="#10b981" fill="url(#gPay)" strokeWidth={2} dot={false} name="Encaissé" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </ChartCard>

                                {/* Aging */}
                                <ChartCard title="Balance âgée" color="#d97706">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                                        {aging.map((row) => {
                                            const pct = totalAging > 0 ? (parseFloat(row.amount) / totalAging) * 100 : 0
                                            const color = AGING_COLORS[row.period] || '#94a3b8'
                                            return (
                                                <div key={row.period}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                                                        <span>{row.period}</span>
                                                        <span style={{ color }}>{fmt(parseFloat(row.amount))}</span>
                                                    </div>
                                                    <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {aging.length === 0 && <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>Aucune créance en retard</div>}
                                    </div>
                                </ChartCard>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '0.875rem 1.5rem', borderTop: '1px solid #e2e8f0',
                    background: 'white', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Cette fenêtre ne s'affichera plus pendant cette session.
                    </div>
                    <button
                        onClick={() => { onClose(); navigate('/decision-dashboard') }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
                            color: 'white', border: 'none', borderRadius: '10px',
                            padding: '10px 18px', fontWeight: 700, fontSize: '13px',
                            cursor: 'pointer',
                        }}
                    >
                        Tableau de bord complet <ArrowRight size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}

function KpiCard({ label, value, sub, color, bg }) {
    return (
        <div style={{ background: bg, borderRadius: '12px', padding: '0.875rem 1rem', border: `1px solid ${color}20` }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>
        </div>
    )
}

function ChartCard({ title, color, children }) {
    return (
        <div style={{ background: 'white', borderRadius: '12px', padding: '0.875rem', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{title}</div>
            {children}
        </div>
    )
}
