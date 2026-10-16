import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Ship, RefreshCw, AlertTriangle, CheckCircle2,
    Clock, ChevronLeft, Package, FileText, Truck,
    ReceiptText, Zap, Activity, TrendingDown
} from 'lucide-react'
import { suiviTraitementsAPI } from '../services/api'

/* ─────────────────────── helpers ─────────────────────── */

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => {
        const h = Math.round(v).toString(16)
        return h.length === 1 ? '0' + h : h
    }).join('')
}

function textColor(r, g, b) {
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.55 ? '#1e293b' : '#ffffff'
}

const STAGE_ICONS = {
    1: Package,
    2: FileText,
    3: Truck,
    4: CheckCircle2,
    5: ReceiptText,
}

const URGENCY_LABELS = [
    { max: 2,  label: 'Critique',  emoji: '🔴', color: '#ef4444', bg: '#fee2e2', border: '#fecaca' },
    { max: 5,  label: 'Urgent',    emoji: '🟠', color: '#f97316', bg: '#ffedd5', border: '#fed7aa' },
    { max: 7,  label: 'Normal',    emoji: '🟡', color: '#eab308', bg: '#fefce8', border: '#fde68a' },
    { max: 10, label: 'En avance', emoji: '🟢', color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
]

function getUrgencyInfo(nbre) {
    for (const u of URGENCY_LABELS) {
        if (nbre <= u.max) return u
    }
    return URGENCY_LABELS[URGENCY_LABELS.length - 1]
}

function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    })
}

/* ─────────────────────── sub-components ─────────────────────── */

function StatPill({ value, label, icon, color, bg, border, gradient, onClick, active }) {
    return (
        <div
            onClick={onClick}
            style={{
                background: active ? gradient : 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.25)'}`,
                borderRadius: '1rem',
                padding: '1rem 1.25rem',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.2s',
                transform: active ? 'translateY(-2px)' : 'none',
                boxShadow: active ? '0 8px 24px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
                minWidth: '120px',
                userSelect: 'none',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
        >
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
                {value}
            </div>
            <div style={{
                fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)',
                marginTop: '0.35rem', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '0.3rem'
            }}>
                {icon} {label}
            </div>
        </div>
    )
}

/* ─────────────────────── component ─────────────────────── */

export default function SuiviTraitements() {
    const navigate = useNavigate()
    const [dossiers, setDossiers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [filter, setFilter] = useState('all')
    const [hoveredRow, setHoveredRow] = useState(null)
    const [spinning, setSpinning] = useState(false)

    const load = useCallback(async () => {
        setSpinning(true)
        setLoading(true)
        setError(null)
        try {
            const res = await suiviTraitementsAPI.getAll()
            setDossiers(res.data)
        } catch (err) {
            console.error(err)
            setError('Impossible de charger les données de suivi.')
        } finally {
            setLoading(false)
            setTimeout(() => setSpinning(false), 600)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const filtered = filter === 'all'
        ? dossiers
        : dossiers.filter(d => d.computed_stage === Number(filter))

    const stats = {
        critique: dossiers.filter(d => d.nbre <= 2).length,
        urgent:   dossiers.filter(d => d.nbre > 2 && d.nbre <= 5).length,
        normal:   dossiers.filter(d => d.nbre > 5 && d.nbre <= 7).length,
        enAvance: dossiers.filter(d => d.nbre > 7).length,
    }

    const FILTERS = [
        { val: 'all', label: 'Tous' },
        { val: 1,     label: 'Ouvert' },
        { val: 2,     label: 'Déclaré' },
        { val: 3,     label: 'Mis en livraison' },
        { val: 4,     label: 'Livré' },
        { val: 5,     label: 'Facturé' },
    ]

    const TH_COLS = [
        'Urgence', 'Dossier', 'Client', 'Navire / BL',
        'Date arrivée', 'J. ouvrés écoulés', 'Restants', 'Étape'
    ]

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>

            {/* ── Hero Banner ── */}
            <div style={{
                background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0ea5e9 100%)',
                padding: '2rem 2rem 5rem',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Decorative circles */}
                <div style={{
                    position: 'absolute', top: '-60px', right: '-60px',
                    width: '280px', height: '280px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)', pointerEvents: 'none'
                }} />
                <div style={{
                    position: 'absolute', bottom: '-40px', left: '30%',
                    width: '180px', height: '180px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)', pointerEvents: 'none'
                }} />

                {/* Top bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', position: 'relative' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '0.6rem', padding: '0.5rem 0.85rem',
                            cursor: 'pointer', color: 'white', fontSize: '0.875rem', fontWeight: 500
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                    >
                        <ChevronLeft size={16} /> Retour
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.3)'
                        }}>
                            <Ship size={22} color="white" />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>
                                Suivi des traitements
                            </h1>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.83rem' }}>
                                Dossiers maritimes en cours — urgence calculée sur 10 jours ouvrables
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={load}
                        disabled={loading}
                        style={{
                            marginLeft: 'auto',
                            display: 'flex', alignItems: 'center', gap: '0.45rem',
                            background: 'white', color: '#0369a1',
                            border: 'none', borderRadius: '0.6rem',
                            padding: '0.55rem 1.1rem', cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem', fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            transition: 'all 0.2s', opacity: loading ? 0.7 : 1
                        }}
                        onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
                    >
                        <RefreshCw size={15} style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }} />
                        Actualiser
                    </button>
                </div>

                {/* Stat pills */}
                <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', position: 'relative' }}>
                    <StatPill
                        value={stats.critique} label="Critique" icon="🔴"
                        gradient="linear-gradient(135deg,#dc2626,#ef4444)"
                        active={false}
                    />
                    <StatPill
                        value={stats.urgent} label="Urgent" icon="🟠"
                        gradient="linear-gradient(135deg,#ea580c,#f97316)"
                        active={false}
                    />
                    <StatPill
                        value={stats.normal} label="Normal" icon="🟡"
                        gradient="linear-gradient(135deg,#ca8a04,#eab308)"
                        active={false}
                    />
                    <StatPill
                        value={stats.enAvance} label="En avance" icon="🟢"
                        gradient="linear-gradient(135deg,#16a34a,#22c55e)"
                        active={false}
                    />
                    <StatPill
                        value={dossiers.length} label="Total en cours" icon="⚡"
                        gradient="linear-gradient(135deg,#0369a1,#0ea5e9)"
                        active={true}
                    />
                </div>
            </div>

            {/* ── Floating Content Card ── */}
            <div style={{
                maxWidth: '1400px', margin: '-48px auto 0',
                padding: '0 2rem 2rem',
                position: 'relative', zIndex: 10,
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '1.25rem',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                }}>

                    {/* Stage filter bar */}
                    <div style={{
                        padding: '1.1rem 1.5rem',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
                        alignItems: 'center', background: '#fafbfc'
                    }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginRight: '0.25rem' }}>
                            ÉTAPE :
                        </span>
                        {FILTERS.map(f => {
                            const active = filter === f.val
                            return (
                                <button
                                    key={f.val}
                                    onClick={() => setFilter(f.val)}
                                    style={{
                                        padding: '0.38rem 0.9rem',
                                        borderRadius: '99px',
                                        border: `2px solid ${active ? '#0369a1' : '#e2e8f0'}`,
                                        background: active
                                            ? 'linear-gradient(135deg, #0369a1, #0ea5e9)'
                                            : 'white',
                                        color: active ? 'white' : '#64748b',
                                        fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: active ? '0 4px 12px rgba(3,105,161,0.35)' : 'none',
                                    }}
                                >
                                    {f.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            margin: '1rem 1.5rem',
                            background: '#fef2f2', border: '1px solid #fecaca',
                            borderRadius: '0.75rem', padding: '0.875rem 1rem',
                            display: 'flex', gap: '0.75rem', alignItems: 'center',
                            color: '#dc2626', fontSize: '0.875rem'
                        }}>
                            <AlertTriangle size={17} />
                            {error}
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                            <div style={{
                                width: '52px', height: '52px', borderRadius: '50%',
                                background: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1rem',
                                animation: 'spin 1s linear infinite',
                                boxShadow: '0 4px 16px rgba(3,105,161,0.3)'
                            }}>
                                <RefreshCw size={22} color="white" />
                            </div>
                            <p style={{ margin: 0, fontSize: '0.9rem' }}>Chargement des dossiers…</p>
                        </div>
                    )}

                    {/* Empty */}
                    {!loading && !error && filtered.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <div style={{
                                width: '72px', height: '72px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1.25rem',
                            }}>
                                <Ship size={32} color="#0369a1" style={{ opacity: 0.5 }} />
                            </div>
                            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#475569' }}>
                                Aucun dossier maritime en cours à afficher.
                            </p>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                                Tous les dossiers maritimes sont soit facturés, soit sans date d'arrivée.
                            </p>
                        </div>
                    )}

                    {/* Table */}
                    {!loading && filtered.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{
                                        background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                                        borderBottom: '2px solid #e2e8f0'
                                    }}>
                                        {TH_COLS.map(h => (
                                            <th key={h} style={{
                                                padding: '0.85rem 1rem', textAlign: 'left',
                                                fontWeight: 700, color: '#475569',
                                                fontSize: '0.72rem', textTransform: 'uppercase',
                                                letterSpacing: '0.06em', whiteSpace: 'nowrap'
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((d, idx) => {
                                        const bg  = rgbToHex(d.colorR, d.colorG, d.colorB)
                                        const fg  = textColor(d.colorR, d.colorG, d.colorB)
                                        const urgency   = getUrgencyInfo(d.nbre)
                                        const StageIcon = STAGE_ICONS[d.computed_stage] || Package
                                        const hovered   = hoveredRow === d.id

                                        return (
                                            <tr
                                                key={d.id}
                                                style={{
                                                    borderBottom: '1px solid #f1f5f9',
                                                    background: hovered ? '#f0f9ff' : (idx % 2 === 0 ? 'white' : '#fafcff'),
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={() => setHoveredRow(d.id)}
                                                onMouseLeave={() => setHoveredRow(null)}
                                            >
                                                {/* Urgence badge */}
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                                                        background: bg, color: fg,
                                                        borderRadius: '0.6rem', padding: '0.35rem 0.7rem',
                                                        fontWeight: 700, fontSize: '0.83rem',
                                                        boxShadow: `0 3px 10px ${bg}66`,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{d.nbre}</span>
                                                        <span style={{ fontSize: '0.68rem', opacity: 0.9 }}>
                                                            {urgency.emoji} {urgency.label}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Code dossier */}
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <div style={{
                                                        fontWeight: 700,
                                                        color: hovered ? '#0369a1' : '#1e293b',
                                                        transition: 'color 0.15s'
                                                    }}>
                                                        {d.shortCode || d.code}
                                                    </div>
                                                    {d.label && (
                                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                                            {d.label}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Client */}
                                                <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: 500 }}>
                                                    {d.clientName}
                                                </td>

                                                {/* Navire / BL */}
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <div style={{ color: '#334155', fontWeight: 500 }}>{d.vessel || '—'}</div>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                                        BL : {d.blNumber || '—'}
                                                    </div>
                                                </td>

                                                {/* Date arrivée */}
                                                <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', color: '#334155' }}>
                                                    {formatDate(d.dateArrivee)}
                                                </td>

                                                {/* Jours écoulés */}
                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        background: '#f1f5f9', borderRadius: '0.5rem',
                                                        padding: '0.25rem 0.65rem',
                                                        fontWeight: 700, color: '#475569',
                                                        fontSize: '0.83rem'
                                                    }}>
                                                        {d.elapsed_days} j
                                                    </span>
                                                </td>

                                                {/* Restants */}
                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        background: d.remaining_days <= 0 ? '#fee2e2' : '#f0fdf4',
                                                        border: `1px solid ${d.remaining_days <= 0 ? '#fecaca' : '#bbf7d0'}`,
                                                        borderRadius: '0.5rem',
                                                        padding: '0.25rem 0.65rem',
                                                        fontWeight: 700, fontSize: '0.83rem',
                                                        color: d.remaining_days <= 0 ? '#dc2626' : '#16a34a',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {d.remaining_days <= 0
                                                            ? `${Math.abs(d.remaining_days)} j dépassés`
                                                            : `${d.remaining_days} j`}
                                                    </span>
                                                </td>

                                                {/* Étape */}
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                                        background: hovered ? '#e0f2fe' : '#f0f9ff',
                                                        color: '#0369a1',
                                                        borderRadius: '0.5rem', padding: '0.28rem 0.65rem',
                                                        fontSize: '0.8rem', fontWeight: 600,
                                                        border: '1px solid #bae6fd',
                                                        transition: 'background 0.15s',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        <StageIcon size={13} />
                                                        {d.stageLabel}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer */}
                    {!loading && filtered.length > 0 && (
                        <div style={{
                            padding: '0.85rem 1.5rem',
                            borderTop: '2px solid #f1f5f9',
                            background: '#fafbfc',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                <strong style={{ color: '#1e293b' }}>{filtered.length}</strong>{' '}
                                dossier{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
                                {filter !== 'all' && (
                                    <span style={{
                                        marginLeft: '0.5rem',
                                        background: '#e0f2fe', color: '#0369a1',
                                        borderRadius: '0.4rem', padding: '0.1rem 0.5rem',
                                        fontSize: '0.75rem', fontWeight: 600
                                    }}>
                                        filtre : {FILTERS.find(f => f.val === filter)?.label}
                                    </span>
                                )}
                            </span>
                            <span style={{
                                color: '#94a3b8', fontSize: '0.78rem',
                                display: 'flex', alignItems: 'center', gap: '0.35rem'
                            }}>
                                <Activity size={13} /> trié par urgence croissante
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
