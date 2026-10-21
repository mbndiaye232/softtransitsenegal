import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import DashboardMenu from './DashboardMenu'
import DeclarantArrivalsModal from '../components/DeclarantArrivalsModal'
import TrackingModal from '../components/TrackingModal'
import FacturierModal from '../components/FacturierModal'
import DirecteurModal from '../components/DirecteurModal'
import { statisticsAPI, dashboardsAPI } from '../services/api'
import {
    CreditCard, Briefcase, Clock, Users, LogOut,
    Building2, Mail, User, ShieldCheck, Sparkles, Zap, Anchor, ArrowRight
} from 'lucide-react'

const SESSION_FLAG = 'declarant_arrivals_seen'
const SESSION_TRACKING_FLAG = 'tracking_seen'
const SESSION_FACTURIER_FLAG = 'facturier_seen'
const SESSION_DIRECTEUR_FLAG = 'directeur_seen'

export default function Dashboard() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [stats, setStats] = useState({
        activeDossiers: 0,
        closedDossiers: 0,
        pendingNotes: 0,
        activeTeam: 0,
    })
    const [arrivals, setArrivals] = useState([])
    const [showArrivalsModal, setShowArrivalsModal] = useState(false)
    const [trackingDossiers, setTrackingDossiers] = useState([])
    const [showTrackingModal, setShowTrackingModal] = useState(false)
    const [toInvoiceDossiers, setToInvoiceDossiers] = useState([])
    const [showFacturierModal, setShowFacturierModal] = useState(false)
    const [showDirecteurModal, setShowDirecteurModal] = useState(false)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await statisticsAPI.getDashboard()
                setStats(response.data)
            } catch (err) {
                console.error('Error fetching dashboard stats:', err)
            }
        }
        const fetchArrivals = async () => {
            try {
                const response = await dashboardsAPI.getTransportArrivals()
                setArrivals(response.data)
                if (
                    user?.is_declarant &&
                    response.data.length > 0 &&
                    !sessionStorage.getItem(SESSION_FLAG)
                ) {
                    setShowArrivalsModal(true)
                }
            } catch (err) {
                console.error('Error fetching arrivals:', err)
            }
        }
        const fetchTracking = async () => {
            try {
                const response = await dashboardsAPI.getDossierTracking()
                setTrackingDossiers(response.data)
                if (
                    user?.is_responsable &&
                    response.data.length > 0 &&
                    !sessionStorage.getItem(SESSION_TRACKING_FLAG)
                ) {
                    setShowTrackingModal(true)
                }
            } catch (err) {
                console.error('Error fetching tracking:', err)
            }
        }
        const fetchToInvoice = async () => {
            try {
                const response = await dashboardsAPI.getToInvoice()
                setToInvoiceDossiers(response.data)
                if (
                    user?.is_facturier &&
                    response.data.length > 0 &&
                    !sessionStorage.getItem(SESSION_FACTURIER_FLAG)
                ) {
                    setShowFacturierModal(true)
                }
            } catch (err) {
                console.error('Error fetching to-invoice dossiers:', err)
            }
        }
        fetchStats()
        fetchArrivals()
        if (user?.is_responsable) fetchTracking()
        if (user?.is_facturier) fetchToInvoice()
        if (user?.is_directeur && !sessionStorage.getItem(SESSION_DIRECTEUR_FLAG)) {
            setShowDirecteurModal(true)
        }
    }, [user?.is_declarant, user?.is_responsable, user?.is_facturier, user?.is_directeur])

    const closeArrivalsModal = () => {
        sessionStorage.setItem(SESSION_FLAG, '1')
        setShowArrivalsModal(false)
    }

    const closeTrackingModal = () => {
        sessionStorage.setItem(SESSION_TRACKING_FLAG, '1')
        setShowTrackingModal(false)
    }

    const closeFacturierModal = () => {
        sessionStorage.setItem(SESSION_FACTURIER_FLAG, '1')
        setShowFacturierModal(false)
    }

    const closeDirecteurModal = () => {
        sessionStorage.setItem(SESSION_DIRECTEUR_FLAG, '1')
        setShowDirecteurModal(false)
    }

    const handleLogout = () => { logout(); navigate('/login') }

    const kpis = [
        {
            icon: Briefcase,
            label: 'Dossiers actifs',
            value: stats.activeDossiers,
            color: '#34d399', bg: 'rgba(52,211,153,0.18)',
        },
        {
            icon: Clock,
            label: 'Notes en attente',
            value: stats.pendingNotes,
            color: '#fbbf24', bg: 'rgba(251,191,36,0.18)',
        },
        {
            icon: Users,
            label: 'Équipe active',
            value: stats.activeTeam,
            color: '#60a5fa', bg: 'rgba(96,165,250,0.18)',
        },
    ]

    const [navHover, setNavHover] = useState(null)

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
            {showArrivalsModal && (
                <DeclarantArrivalsModal arrivals={arrivals} onClose={closeArrivalsModal} />
            )}
            {showTrackingModal && (
                <TrackingModal dossiers={trackingDossiers} onClose={closeTrackingModal} />
            )}
            {showFacturierModal && (
                <FacturierModal dossiers={toInvoiceDossiers} onClose={closeFacturierModal} />
            )}
            {showDirecteurModal && (
                <DirecteurModal onClose={closeDirecteurModal} />
            )}
            <style>{`
                @keyframes pulse-orb {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50%       { opacity: 0.85; transform: scale(1.12); }
                }
                @keyframes drift {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    33%      { transform: translateY(-12px) rotate(2deg); }
                    66%      { transform: translateY(8px) rotate(-1deg); }
                }
                @keyframes glow-pulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.4); }
                    50%      { box-shadow: 0 0 40px rgba(59,130,246,0.8); }
                }
            `}</style>

            {/* ══════════════════ NAVBAR ══════════════════ */}
            <header style={{
                background: 'var(--hero-gradient)',
                padding: '0 2rem',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
            }}>
                {/* Brand */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '38px', height: '38px', borderRadius: '11px',
                        background: 'var(--hero-gradient)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'glow-pulse 3s ease-in-out infinite',
                    }}>
                        <Zap size={20} color="white" />
                    </div>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 900, color: 'white', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                            Soft Transit
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
                            {user?.company_name}
                        </div>
                    </div>
                </div>

                {/* Right controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                    {/* User chip */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '5px 12px 5px 5px',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                        <div style={{
                            width: '34px', height: '34px', borderRadius: '50%',
                            background: 'var(--hero-gradient)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', fontWeight: 900, color: 'white',
                            flexShrink: 0,
                        }}>
                            {(user?.name || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
                                {user?.name || 'Utilisateur'}
                            </div>
                            <div style={{
                                fontSize: '10px', fontWeight: 800, color: '#60a5fa',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}>
                                {user?.role}
                            </div>
                        </div>
                    </div>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        onMouseEnter={() => setNavHover('logout')}
                        onMouseLeave={() => setNavHover(null)}
                        style={{
                            padding: '8px',
                            background: navHover === 'logout' ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            color: '#f87171',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* ══════════════════ HERO ══════════════════ */}
            <div style={{
                background: 'linear-gradient(135deg, #0b1220 0%, #0f172a 35%, #172a52 75%, #1b3464 100%)',
                padding: '4rem 2rem 7rem',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Animated aurora orbs */}
                <div style={{
                    position: 'absolute', top: '-80px', right: '3%',
                    width: '420px', height: '420px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(37,99,235,0.42) 0%, transparent 70%)',
                    filter: 'blur(50px)',
                    animation: 'pulse-orb 4s ease-in-out infinite',
                }} />
                <div style={{
                    position: 'absolute', bottom: '-100px', left: '8%',
                    width: '350px', height: '350px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 70%)',
                    filter: 'blur(50px)',
                    animation: 'pulse-orb 5.5s ease-in-out infinite 1.2s',
                }} />
                <div style={{
                    position: 'absolute', top: '20%', left: '35%',
                    width: '250px', height: '250px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(96,165,250,0.16) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                    animation: 'drift 8s ease-in-out infinite',
                }} />
                <div style={{
                    position: 'absolute', top: '60%', right: '20%',
                    width: '180px', height: '180px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(5,150,105,0.16) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                    animation: 'pulse-orb 7s ease-in-out infinite 0.5s',
                }} />

                {/* Grid texture overlay */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
                    backgroundSize: '44px 44px',
                }} />

                {/* Hero content */}
                <div style={{ position: 'relative', zIndex: 2, maxWidth: '1360px', margin: '0 auto' }}>
                    {/* Top chip */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                            background: 'rgba(59,130,246,0.18)',
                            border: '1px solid rgba(59,130,246,0.4)',
                            borderRadius: '99px', padding: '5px 16px',
                            color: '#93c5fd', fontSize: '12px', fontWeight: 800,
                            textTransform: 'uppercase', letterSpacing: '0.09em',
                        }}>
                            <Sparkles size={13} />
                            Tableau de bord principal
                        </div>
                    </div>

                    {/* Welcome title */}
                    <h1 style={{
                        fontSize: 'clamp(2rem, 4.5vw, 3.75rem)',
                        fontWeight: 900,
                        color: 'white',
                        margin: '0 0 10px',
                        lineHeight: 1.05,
                        letterSpacing: '-0.025em',
                    }}>
                        Bienvenue,{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #60a5fa 0%, #38bdf8 55%, #6ee7b7 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}>
                            {user?.name?.toUpperCase()}
                        </span>
                    </h1>
                    <p style={{
                        color: 'rgba(255,255,255,0.62)',
                        fontSize: '1.1rem', fontWeight: 500,
                        margin: '0 0 2.75rem',
                        letterSpacing: '0.01em',
                    }}>
                        Optimisez la gestion de vos dossiers de transit avec précision.
                    </p>

                    {/* KPI Pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                        {kpis.map((k, i) => {
                            const Ic = k.icon
                            return (
                                <div
                                    key={i}
                                    onClick={k.onClick}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                        background: 'rgba(255,255,255,0.06)',
                                        backdropFilter: 'blur(16px)',
                                        WebkitBackdropFilter: 'blur(16px)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '18px', padding: '14px 22px',
                                        cursor: k.onClick ? 'pointer' : 'default',
                                        minWidth: '170px',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        transition: 'all 0.25s',
                                    }}
                                >
                                    {/* Alert badge */}
                                    {k.alert && (
                                        <div style={{
                                            position: 'absolute', top: '6px', right: '8px',
                                            background: '#ef4444', color: 'white',
                                            borderRadius: '99px', fontSize: '9px', fontWeight: 900,
                                            padding: '2px 8px', letterSpacing: '0.04em',
                                        }}>
                                            CRITIQUE
                                        </div>
                                    )}
                                    {/* Icon box */}
                                    <div style={{
                                        width: '44px', height: '44px', borderRadius: '13px',
                                        background: k.bg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: k.color, flexShrink: 0,
                                    }}>
                                        <Ic size={22} />
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: '10px', color: 'rgba(255,255,255,0.45)',
                                            fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                                        }}>
                                            {k.label}
                                        </div>
                                        <div style={{
                                            fontSize: '1.75rem', fontWeight: 900, color: 'white', lineHeight: 1.1,
                                        }}>
                                            {k.value}
                                        </div>
                                        {k.sub && (
                                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>
                                                {k.sub}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* ══════════════════ FLOATING CONTENT CARD ══════════════════ */}
            <div style={{
                maxWidth: '1360px',
                margin: '-56px auto 0',
                padding: '0 2rem 2rem',
                position: 'relative',
                zIndex: 10,
            }}>
                {/* Menu card */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    boxShadow: '0 30px 70px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    marginBottom: '1.5rem',
                }}>
                    {/* Card header */}
                    <div style={{
                        background: 'var(--hero-gradient)',
                        padding: '1.5rem 2rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                                width: '6px', height: '36px', borderRadius: '3px',
                                background: 'linear-gradient(180deg, #60a5fa, #2563eb)',
                            }} />
                            <div>
                                <div style={{
                                    fontSize: '10px', color: 'rgba(255,255,255,0.4)',
                                    fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em',
                                }}>
                                    Navigation
                                </div>
                                <div style={{
                                    fontSize: '1.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.01em',
                                }}>
                                    Menu Principal
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '99px', padding: '6px 14px',
                        }}>
                            <div style={{
                                width: '7px', height: '7px', borderRadius: '50%',
                                background: '#34d399',
                                boxShadow: '0 0 8px rgba(52,211,153,0.8)',
                                animation: 'pulse-orb 2s ease-in-out infinite',
                            }} />
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>
                                Système actif
                            </span>
                        </div>
                    </div>

                    {/* Menu grid */}
                    <div style={{ padding: '2rem' }}>
                        <DashboardMenu />
                    </div>
                </div>

                {/* ── Arrivals card ── */}
                <div style={{
                    background: 'white', borderRadius: '20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
                    overflow: 'hidden', marginBottom: '1.5rem',
                }}>
                    {/* Header */}
                    <div style={{
                        background: 'var(--hero-gradient)',
                        padding: '1rem 1.5rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '34px', height: '34px', borderRadius: '9px',
                                background: 'rgba(255,255,255,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Anchor size={18} color="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    {user?.role === 'USER' ? 'Mes dossiers' : 'Vue globale'}
                                </div>
                                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'white' }}>
                                    {user?.role === 'USER' ? 'Mes prochaines arrivées' : 'Calendrier arrivées des navires'}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/transport-arrivals')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'rgba(255,255,255,0.15)',
                                border: '1px solid rgba(255,255,255,0.25)',
                                borderRadius: '8px', padding: '6px 14px',
                                color: 'white', fontSize: '12px', fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            Voir tout <ArrowRight size={13} />
                        </button>
                    </div>
                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                        {arrivals.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
                                Aucune arrivée prévue
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {['Code dossier', 'Libellé', 'Navire / Transport', 'Date arrivée', 'J. restants'].map((h, i) => (
                                            <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {arrivals.slice(0, 8).map((item, idx) => {
                                        const r = item.colorR ?? 200, g = item.colorG ?? 200, b = item.colorB ?? 200;
                                        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                        const bg = `rgb(${r},${g},${b})`;
                                        const fg = lum > 0.55 ? '#1e293b' : 'white';
                                        const days = item.daysRemaining;
                                        return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0369a1' }}>{item.code || '—'}</td>
                                                <td style={{ padding: '10px 16px', color: '#374151', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label || '—'}</td>
                                                <td style={{ padding: '10px 16px', color: '#374151' }}>{item.transportMean || '—'}</td>
                                                <td style={{ padding: '10px 16px', color: '#374151' }}>
                                                    {item.dateArrivee ? new Date(item.dateArrivee).toLocaleDateString('fr-FR') : '—'}
                                                </td>
                                                <td style={{ padding: '6px 16px' }}>
                                                    <span style={{
                                                        display: 'inline-block', background: bg, color: fg,
                                                        borderRadius: '99px', padding: '3px 12px',
                                                        fontWeight: 800, fontSize: '12px', minWidth: '44px', textAlign: 'center',
                                                    }}>
                                                        {days != null ? (days < 0 ? `+${Math.abs(days)}j` : `${days}j`) : '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Profile card */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        background: 'var(--hero-gradient)',
                        padding: '1rem 2rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <span style={{
                            fontSize: '11px', fontWeight: 800,
                            color: 'rgba(255,255,255,0.55)',
                            textTransform: 'uppercase', letterSpacing: '0.12em',
                        }}>
                            Informations Professionnelles
                        </span>
                        <ShieldCheck size={18} color="rgba(255,255,255,0.35)" />
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        padding: '1.5rem 2rem',
                    }}>
                        {[
                            { label: 'Raison Sociale',        value: user?.company_name, Icon: Building2, color: '#3b82f6' },
                            { label: 'Identifiant de connexion', value: user?.login,     Icon: User,      color: '#3b82f6' },
                            { label: 'Adresse Email',          value: user?.email,        Icon: Mail,      color: '#2563eb' },
                        ].map((item, i, arr) => (
                            <div key={i} style={{
                                display: 'flex', flexDirection: 'column', gap: '6px',
                                padding: '0 1.5rem',
                                borderRight: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
                            }}>
                                <span style={{
                                    fontSize: '10px', fontWeight: 800, color: '#94a3b8',
                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                }}>
                                    {item.label}
                                </span>
                                <span style={{
                                    fontSize: '14px', fontWeight: 700, color: '#1e293b',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                }}>
                                    <item.Icon size={15} color={item.color} />
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
