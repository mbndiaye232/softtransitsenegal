import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Building2, Users, UserSquare2, Briefcase, ClipboardList,
    BarChart3, FileText, Settings, LogOut, Key,
    Save, Layers, LayoutDashboard, ChevronRight, ShieldCheck, Folders, Lock, Anchor, Warehouse, History
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/* ── Category definitions ── */
const CATS = [
    {
        label: 'Référentiels Métier',
        color: '#6366f1',
        grad: 'linear-gradient(135deg,#4338ca,#6366f1)',
        ids: ['societe', 'agents', 'clients', 'tiers'],
    },
    {
        label: 'Dossiers & Transit',
        color: '#0369a1',
        grad: 'linear-gradient(135deg,#0c4a6e,#0369a1)',
        ids: ['dossiers', 'suivi', 'arrivees', 'cotation', 'ot', 'config-ot', 'documents', 'notes', 'traitements', 'sommiers', 'entrepots', 'historique-sommiers'],
    },
    {
        label: 'Documents & Finance',
        color: '#059669',
        grad: 'linear-gradient(135deg,#064e3b,#059669)',
        ids: ['finances', 'suivi-factures'],
    },
    {
        label: 'Outils & Administration',
        color: '#d97706',
        grad: 'linear-gradient(135deg,#92400e,#d97706)',
        ids: ['dashboard', 'parametres', 'licence', 'sauvegarder', 'quitter'],
    },
]

export default function DashboardMenu() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [hovered, setHovered] = useState(null)

    const handleLogout = () => { logout(); navigate('/login') }

    const isSuperAdmin = user?.role?.toUpperCase() === 'SUPER_ADMIN'
    const isAdmin      = user?.role?.toUpperCase() === 'ADMIN'
    const { canView }  = useAuth()

    // Mapping menu id → code permission (null = toujours accessible)
    // Codes dispo : STRUCTURES, AGENTS, CLIENTS, TIERS, DOSSIERS, COTATIONS,
    //               FACTURES, NOTES, CONFIG, PAYS, DEVISES, TAXES, REGIMES,
    //               STATUTS, PRODUITS, GROUPES
    const allItems = [
        { id: 'societe',     label: 'Société',           icon: Building2,       path: '/settings',           color: '#6366f1', grad: 'linear-gradient(135deg,#4338ca,#6366f1)',  perm: 'STRUCTURES' },
        { id: 'agents',      label: 'Agents',             icon: Users,           path: '/users',              color: '#8b5cf6', grad: 'linear-gradient(135deg,#7c3aed,#8b5cf6)',  perm: 'AGENTS' },
        { id: 'clients',     label: 'Clients',            icon: UserSquare2,     path: '/clients',            color: '#a855f7', grad: 'linear-gradient(135deg,#9333ea,#a855f7)',  perm: 'CLIENTS' },
        { id: 'tiers',       label: 'Tiers',              icon: Users,           path: '/tiers',              color: '#ec4899', grad: 'linear-gradient(135deg,#db2777,#ec4899)',  perm: 'TIERS' },
        { id: 'dossiers',    label: 'Dossiers',           icon: Briefcase,       path: '/dossiers',           color: '#2563eb', grad: 'linear-gradient(135deg,#1d4ed8,#2563eb)',  perm: 'DOSSIERS', multi: true },
        { id: 'suivi',       label: 'Suivi dossiers',     icon: ClipboardList,   path: '/suivi-dossiers',     color: '#0891b2', grad: 'linear-gradient(135deg,#0e7490,#0891b2)',  perm: 'DOSSIERS' },
        { id: 'arrivees',    label: 'Arrivées navires',   icon: Anchor,          path: '/transport-arrivals', color: '#0369a1', grad: 'linear-gradient(135deg,#0c4a6e,#0369a1)',  perm: 'DOSSIERS' },
        { id: 'cotation',    label: 'Cotation',           icon: Layers,          path: '/cotations',          color: '#10b981', grad: 'linear-gradient(135deg,#059669,#10b981)',  perm: 'COTATIONS' },
        { id: 'ot',          label: 'Ordre de Transit',   icon: FileText,        path: '/ordres-transit',     color: '#f97316', grad: 'linear-gradient(135deg,#ea580c,#f97316)',  perm: 'DOSSIERS' },
        { id: 'config-ot',   label: 'Configuration OT',   icon: Settings,        path: '/config-transit',     color: '#64748b', grad: 'linear-gradient(135deg,#475569,#64748b)',  perm: 'CONFIG',   multi: true },
        { id: 'documents',   label: 'Gestion documents',  icon: FileText,        path: '/documents',          color: '#06b6d4', grad: 'linear-gradient(135deg,#0891b2,#06b6d4)',  perm: 'FACTURES' },
        { id: 'notes',       label: 'Note de détail',     icon: FileText,        path: '/notes',              color: '#3b82f6', grad: 'linear-gradient(135deg,#2563eb,#3b82f6)',  perm: 'NOTES' },
        { id: 'finances',    label: 'Etats financiers',   icon: BarChart3,       path: '/etats-financiers',   color: '#6366f1', grad: 'linear-gradient(135deg,#4338ca,#6366f1)',  perm: 'FACTURES', multi: true },
        { id: 'suivi-factures', label: 'Suivi factures',  icon: FileText,        path: '/suivi-factures',     color: '#059669', grad: 'linear-gradient(135deg,#047857,#059669)',  perm: 'FACTURES' },
        { id: 'traitements', label: 'Suivi traitements',  icon: Layers,          path: '/suivi-traitements',  color: '#8b5cf6', grad: 'linear-gradient(135deg,#7c3aed,#8b5cf6)',  perm: 'DOSSIERS' },
        { id: 'sommiers',    label: 'Sommiers',           icon: ShieldCheck,     path: '/sommiers',           color: '#1d4ed8', grad: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',  perm: 'DOSSIERS' },
        { id: 'entrepots',           label: 'Entrepôts',           icon: Warehouse, path: '/entrepots',           color: '#0f766e', grad: 'linear-gradient(135deg,#134e4a,#0f766e)', perm: 'DOSSIERS' },
        { id: 'historique-sommiers', label: 'Historique Sommiers', icon: History,   path: '/historique-sommiers', color: '#6d28d9', grad: 'linear-gradient(135deg,#4c1d95,#6d28d9)', perm: 'DOSSIERS' },
        { id: 'dashboard',   label: 'Dashboard',          icon: LayoutDashboard, path: '/decision-dashboard', color: '#ec4899', grad: 'linear-gradient(135deg,#db2777,#ec4899)',  perm: null,       multi: true },
        { id: 'parametres',  label: 'Paramètres',         icon: Settings,        path: '/parameters-hub',     color: '#f59e0b', grad: 'linear-gradient(135deg,#d97706,#f59e0b)',  perm: 'CONFIG',   multi: true },
        { id: 'licence',     label: 'Licence',            icon: Key,             path: '#',                   color: '#10b981', grad: 'linear-gradient(135deg,#059669,#10b981)',  perm: null,       disabled: true },
        { id: 'sauvegarder', label: 'Sauvegarder',        icon: Save,            path: '/backups',            color: '#06b6d4', grad: 'linear-gradient(135deg,#0891b2,#06b6d4)',  perm: 'CONFIG' },
        { id: 'quitter', label: 'Quitter', icon: LogOut, path: null, color: '#ef4444', grad: 'linear-gradient(135deg,#dc2626,#ef4444)', perm: null, onClick: handleLogout },
    ]

    return (
        <div>
            {CATS.map(cat => {
                const catItems = allItems.filter(item => cat.ids.includes(item.id))
                if (!catItems.length) return null

                return (
                    <div key={cat.label} style={{ marginBottom: '2.25rem' }}>
                        {/* ── Category header ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                            <div style={{
                                width: '4px', height: '24px', borderRadius: '2px',
                                background: cat.grad, flexShrink: 0,
                            }} />
                            <span style={{
                                background: cat.color + '16',
                                border: `1px solid ${cat.color}30`,
                                borderRadius: '99px', padding: '3px 14px',
                                color: cat.color, fontSize: '11px', fontWeight: 800,
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                whiteSpace: 'nowrap',
                            }}>
                                {cat.label}
                            </span>
                            <div style={{
                                flex: 1, height: '1px',
                                background: `linear-gradient(90deg, ${cat.color}28, transparent)`,
                            }} />
                        </div>

                        {/* ── Cards grid ── */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
                            gap: '0.875rem',
                        }}>
                            {catItems.map(item => {
                                const Icon = item.icon
                                const isHov = hovered === item.id
                                // Accès refusé si permission manquante (sauf SUPER_ADMIN / ADMIN)
                                const noAccess = !isSuperAdmin && !isAdmin && !canView(item.perm)
                                const isDisabled = item.disabled || item.path === '#' || noAccess
                                const CardEl = (!item.path || isDisabled) ? 'div' : Link

                                return (
                                    <CardEl
                                        key={item.id}
                                        to={(!item.path || isDisabled) ? undefined : item.path}
                                        onClick={item.onClick}
                                        onMouseEnter={() => { if (!isDisabled) setHovered(item.id) }}
                                        onMouseLeave={() => setHovered(null)}
                                        style={{
                                            display: 'flex', flexDirection: 'column', gap: '12px',
                                            padding: '1.25rem',
                                            paddingLeft: item.multi ? '1rem' : '1.25rem',
                                            background: noAccess ? '#f8fafc' : isHov ? item.grad : 'white',
                                            borderRadius: '16px',
                                            borderTop: noAccess ? '1px solid #e2e8f0' : isHov ? `1px solid ${item.color}` : '1px solid #e2e8f0',
                                            borderRight: noAccess ? '1px solid #e2e8f0' : isHov ? `1px solid ${item.color}` : '1px solid #e2e8f0',
                                            borderBottom: noAccess ? '1px solid #e2e8f0' : isHov ? `1px solid ${item.color}` : '1px solid #e2e8f0',
                                            borderLeft: item.multi && !isHov
                                                ? `4px solid ${item.color}`
                                                : item.multi && isHov
                                                    ? `4px solid rgba(255,255,255,0.55)`
                                                    : noAccess ? '1px solid #e2e8f0' : '1px solid #e2e8f0',
                                            textDecoration: 'none',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            opacity: noAccess ? 0.45 : isDisabled ? 0.5 : 1,
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                                            transform: isHov ? 'translateY(-5px) scale(1.02)' : 'translateY(0) scale(1)',
                                            boxShadow: isHov
                                                ? `0 16px 40px ${item.color}50, 0 4px 12px ${item.color}30`
                                                : item.multi
                                                    ? `0 2px 8px ${item.color}20, 0 1px 4px rgba(0,0,0,0.06)`
                                                    : '0 1px 4px rgba(0,0,0,0.06)',
                                            filter: noAccess ? 'grayscale(60%)' : 'none',
                                        }}
                                    >
                                        {/* Decoration circle */}
                                        {!isHov && (
                                            <div style={{
                                                position: 'absolute', top: '-12px', right: '-12px',
                                                width: '56px', height: '56px', borderRadius: '50%',
                                                background: item.color + '10',
                                                pointerEvents: 'none',
                                            }} />
                                        )}
                                        {/* Shimmer line when hovered */}
                                        {isHov && (
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0,
                                                height: '1px',
                                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                                pointerEvents: 'none',
                                            }} />
                                        )}

                                        {/* Accès restreint */}
                                        {noAccess && (
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                zIndex: 3, pointerEvents: 'none',
                                            }}>
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    background: 'rgba(15,23,42,0.08)', borderRadius: '99px',
                                                    padding: '3px 10px',
                                                }}>
                                                    <Lock size={10} color="#64748b"/>
                                                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Restreint</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Alert badge */}
                                        {item.badge && (
                                            <span style={{
                                                position: 'absolute', top: '8px', right: '8px',
                                                background: item.badgeColor, color: 'white',
                                                borderRadius: '99px', fontSize: '10px', fontWeight: 900,
                                                padding: '1px 8px', zIndex: 2,
                                            }}>
                                                {item.badge}
                                            </span>
                                        )}

                                        {/* Multi badge */}
                                        {item.multi && (
                                            <div style={{
                                                position: 'absolute', bottom: '8px', right: '8px',
                                                display: 'flex', alignItems: 'center', gap: '3px',
                                                fontSize: '9px', fontWeight: 800,
                                                color: isHov ? 'rgba(255,255,255,0.55)' : item.color + 'aa',
                                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                                pointerEvents: 'none',
                                            }}>
                                                <Folders size={10} /> MULTI
                                            </div>
                                        )}

                                        {/* Icon box */}
                                        <div style={{
                                            width: '48px', height: '48px', borderRadius: '13px',
                                            background: isHov ? 'rgba(255,255,255,0.22)' : item.color + '18',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: isHov ? 'white' : item.color,
                                            transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                                            transform: isHov ? 'scale(1.12) rotate(-6deg)' : 'scale(1) rotate(0deg)',
                                            flexShrink: 0,
                                        }}>
                                            <Icon size={23} />
                                        </div>

                                        {/* Label row */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        }}>
                                            <span style={{
                                                fontWeight: 700, fontSize: '13px',
                                                color: isHov ? 'white' : '#1e293b',
                                                transition: 'color 0.2s',
                                                lineHeight: 1.3,
                                            }}>
                                                {item.label}
                                            </span>
                                            {!isDisabled && (
                                                <ChevronRight size={15} style={{
                                                    color: isHov ? 'rgba(255,255,255,0.7)' : '#cbd5e1',
                                                    transform: isHov ? 'translateX(2px)' : 'translateX(-6px)',
                                                    opacity: isHov ? 1 : 0,
                                                    transition: 'all 0.2s',
                                                    flexShrink: 0,
                                                }} />
                                            )}
                                        </div>
                                    </CardEl>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
