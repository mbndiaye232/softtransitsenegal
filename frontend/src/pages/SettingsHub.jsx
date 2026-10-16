import React from 'react'
import {
    Mail,
    Truck,
    Link2,
    Settings,
    FileText,
    MapPin,
    ChevronRight,
    ArrowLeft,
    Globe,
    Layers,
    BarChart3,
    CreditCard,
    ClipboardList,
    Scale,
    Coins,
    Palette,
    HardDrive,
    MessageSquare,
    ShieldCheck,
    Cog
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

/* ── couleur par catégorie ── */
const CAT_COLORS = {
    'Communications':         { accent: '#6366f1', light: '#eef2ff', border: '#c7d2fe', grad: 'linear-gradient(135deg,#4338ca,#6366f1)', dot: '#818cf8' },
    'Logistique & Transport': { accent: '#0891b2', light: '#ecfeff', border: '#a5f3fc', grad: 'linear-gradient(135deg,#0e7490,#06b6d4)', dot: '#22d3ee' },
    'Facturation & Douane':   { accent: '#d97706', light: '#fffbeb', border: '#fde68a', grad: 'linear-gradient(135deg,#b45309,#f59e0b)', dot: '#fbbf24' },
    'Référentiels Métier':    { accent: '#7c3aed', light: '#faf5ff', border: '#ddd6fe', grad: 'linear-gradient(135deg,#5b21b6,#8b5cf6)', dot: '#a78bfa' },
    'Sécurité & Maintenance': { accent: '#0f172a', light: '#f8fafc', border: '#e2e8f0', grad: 'linear-gradient(135deg,#0f172a,#334155)', dot: '#64748b' },
}

const categories = [
    {
        title: 'Communications',
        items: [
            { id: 'mails', label: 'Comptes Mails', icon: Mail, path: '/comptes-mails', description: 'Serveurs SMTP pour l\'envoi de documents.' },
        ]
    },
    {
        title: 'Logistique & Transport',
        items: [
            { id: 'moyens',          label: 'Moyens de Transport', icon: Truck,         path: '/moyens-transport',    description: 'Référentiel des navires, avions et camions.' },
            { id: 'lieux',           label: 'Lieux & Ports',       icon: MapPin,         path: '/lieux',               description: 'Villes, ports et bureaux de douane.' },
            { id: 'etapes',          label: 'Étapes Dossiers',     icon: ClipboardList,  path: '/etapes-dossiers',     description: 'Différentes étapes des traitements de dossiers.' },
            { id: 'pays',            label: 'Gestion des Pays',    icon: Globe,          path: '/pays',                description: 'Référentiel mondial des pays et codes ISO.' },
            { id: 'types-transport', label: 'Types de Transport',  icon: Truck,          path: '/types-transport',     description: 'Avion, Navire, Camion, Train, etc.' },
        ]
    },
    {
        title: 'Facturation & Douane',
        items: [
            { id: 'tarifs',    label: 'Tarifs & Taxes',      icon: Link2,    path: '/tarifs',          description: 'Grilles tarifaires, taxes et taux en vigueur.' },
            { id: 'rubriques', label: 'Rubriques',            icon: Link2,    path: '/rubriques',       description: 'Codes de facturation et numéros de comptes.' },
            { id: 'devises',   label: 'Gestion des Devises', icon: Coins,    path: '/devises',         description: 'Taux de change et monnaies étrangères.' },
            { id: 'doc-types', label: 'Types de documents',  icon: FileText, path: '/types-documents', description: 'Modèles de dossiers et pièces jointes.' },
        ]
    },
    {
        title: 'Référentiels Métier',
        items: [
            { id: 'statuts-org',        label: 'Statuts Organisations',   icon: BarChart3,     path: '/statuts-organisations', description: 'Formes juridiques (SA, SARL, ONG...).' },
            { id: 'modes-reglement',    label: 'Modes de règlement',      icon: CreditCard,    path: '/modes-reglement',       description: 'Virement, Espèces, Chèque, etc.' },
            { id: 'unites-poids',       label: 'Unités de poids',         icon: Scale,         path: '/unites-poids',          description: 'Référentiel des mesures (Kg, Tonne...).' },
            { id: 'unites-volume',      label: 'Unités de volume',        icon: Layers,        path: '/unites-volume',         description: 'Référentiel des mesures (m3, Litre...).' },
            { id: 'regimes-declaration',label: 'Régimes de déclaration',  icon: ClipboardList, path: '/regimes-declaration',   description: 'Référentiel des codes douaniers.' },
            { id: 'config-transit',     label: 'Configuration Transit',   icon: Settings,      path: '/config-transit',        description: 'Incoterms, Régimes OT et Types de documents.' },
            { id: 'codes-couleurs',     label: 'Codes Couleurs',          icon: Palette,       path: '/codes-couleurs',        description: 'Gérez les couleurs des alertes (Délais).' },
        ]
    },
    {
        title: 'Sécurité & Maintenance',
        items: [
            { id: 'backups', label: 'Sauvegardes du Système', icon: HardDrive, path: '/backups', description: 'Gérez les backups automatiques (Base + Documents).' },
        ]
    }
]

/* ── card ── */
function SettingCard({ item, catColor }) {
    const Icon = item.icon
    return (
        <Link
            to={item.disabled ? '#' : item.path}
            style={{ textDecoration: 'none' }}
            className={`setting-card cat-${catColor.replace('#', '')}`}
        >
            <div className="sc-inner" style={{ '--accent': catColor }}>
                <div className="sc-icon">
                    <Icon size={22} />
                </div>
                <div className="sc-body">
                    <div className="sc-label">{item.label}</div>
                    <div className="sc-desc">{item.description}</div>
                </div>
                <ChevronRight size={18} className="sc-arrow" />
            </div>
        </Link>
    )
}

export default function SettingsHub() {
    const navigate = useNavigate()
    const totalItems = categories.reduce((a, c) => a + c.items.length, 0)

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>

            {/* ── Hero ── */}
            <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
                padding: '2rem 2rem 5.5rem',
                position: 'relative', overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', top: '-70px', right: '-70px',
                    width: '300px', height: '300px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)', pointerEvents: 'none'
                }} />
                <div style={{
                    position: 'absolute', bottom: '-50px', left: '35%',
                    width: '200px', height: '200px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)', pointerEvents: 'none'
                }} />
                <div style={{
                    position: 'absolute', top: '20px', left: '40%',
                    width: '120px', height: '120px', borderRadius: '50%',
                    background: 'rgba(99,102,241,0.15)', pointerEvents: 'none'
                }} />

                <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.45rem',
                        background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.25)', borderRadius: '0.6rem',
                        padding: '0.45rem 0.9rem', color: 'rgba(255,255,255,0.85)',
                        cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        marginBottom: '1.75rem', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                >
                    <ArrowLeft size={14} /> Retour au Dashboard
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                    <div style={{
                        width: '52px', height: '52px', borderRadius: '14px',
                        background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0
                    }}>
                        <Cog size={26} color="white" />
                    </div>
                    <div>
                        <h1 style={{
                            margin: 0, fontSize: '1.75rem', fontWeight: 900,
                            color: 'white', letterSpacing: '-0.025em'
                        }}>
                            Paramètres Système
                        </h1>
                        <p style={{ margin: '0.3rem 0 0', color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem' }}>
                            Configurez les référentiels techniques et les services de l'application.
                        </p>
                    </div>

                    {/* Compteur */}
                    <div style={{
                        marginLeft: 'auto',
                        background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.2)', borderRadius: '1rem',
                        padding: '0.75rem 1.25rem', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{totalItems}</div>
                        <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.2rem' }}>modules</div>
                    </div>
                </div>
            </div>

            {/* ── Contenu flottant ── */}
            <div style={{ maxWidth: '1300px', margin: '-48px auto 0', padding: '0 2rem 3rem', position: 'relative', zIndex: 10 }}>

                {categories.map((cat, idx) => {
                    const cc = CAT_COLORS[cat.title] || CAT_COLORS['Communications']
                    return (
                        <div key={idx} style={{ marginBottom: '2rem' }}>

                            {/* Section header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                marginBottom: '1rem',
                                paddingTop: idx === 0 ? '0' : '0.5rem'
                            }}>
                                <div style={{
                                    height: '28px', width: '4px', borderRadius: '99px',
                                    background: cc.grad, flexShrink: 0
                                }} />
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    background: cc.light, border: `1px solid ${cc.border}`,
                                    borderRadius: '99px', padding: '0.3rem 0.9rem'
                                }}>
                                    <div style={{
                                        width: '7px', height: '7px', borderRadius: '50%',
                                        background: cc.accent
                                    }} />
                                    <span style={{
                                        fontSize: '0.78rem', fontWeight: 800,
                                        color: cc.accent, textTransform: 'uppercase',
                                        letterSpacing: '0.07em'
                                    }}>
                                        {cat.title}
                                    </span>
                                    <span style={{
                                        fontSize: '0.72rem', fontWeight: 700,
                                        color: 'white', background: cc.accent,
                                        borderRadius: '99px', padding: '0.05rem 0.45rem'
                                    }}>
                                        {cat.items.length}
                                    </span>
                                </div>
                                <div style={{ flex: 1, height: '1px', background: cc.border }} />
                            </div>

                            {/* Cards grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                gap: '1rem'
                            }}>
                                {cat.items.map(item => {
                                    const Icon = item.icon
                                    return (
                                        <Link
                                            key={item.id}
                                            to={item.disabled ? '#' : item.path}
                                            style={{ textDecoration: 'none' }}
                                        >
                                            <div
                                                className={`sh-card-${idx}`}
                                                style={{
                                                    background: 'white',
                                                    borderRadius: '1rem',
                                                    border: `1px solid ${cc.border}`,
                                                    padding: '1.15rem 1.25rem',
                                                    display: 'flex', alignItems: 'center', gap: '1rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                                    position: 'relative', overflow: 'hidden',
                                                    '--cat-accent': cc.accent,
                                                    '--cat-light': cc.light,
                                                    '--cat-grad': cc.grad,
                                                }}
                                                onMouseEnter={e => {
                                                    const el = e.currentTarget
                                                    el.style.transform = 'translateY(-3px)'
                                                    el.style.boxShadow = `0 12px 32px ${cc.accent}22`
                                                    el.style.borderColor = cc.accent
                                                    el.querySelector('.sh-icon').style.background = cc.grad
                                                    el.querySelector('.sh-icon').style.color = 'white'
                                                    el.querySelector('.sh-icon').style.transform = 'scale(1.1) rotate(-5deg)'
                                                    el.querySelector('.sh-arrow').style.opacity = '1'
                                                    el.querySelector('.sh-arrow').style.transform = 'translateX(0)'
                                                    el.querySelector('.sh-stripe').style.opacity = '1'
                                                }}
                                                onMouseLeave={e => {
                                                    const el = e.currentTarget
                                                    el.style.transform = 'none'
                                                    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'
                                                    el.style.borderColor = cc.border
                                                    el.querySelector('.sh-icon').style.background = cc.light
                                                    el.querySelector('.sh-icon').style.color = cc.accent
                                                    el.querySelector('.sh-icon').style.transform = 'none'
                                                    el.querySelector('.sh-arrow').style.opacity = '0'
                                                    el.querySelector('.sh-arrow').style.transform = 'translateX(-6px)'
                                                    el.querySelector('.sh-stripe').style.opacity = '0'
                                                }}
                                            >
                                                {/* Left stripe on hover */}
                                                <div className="sh-stripe" style={{
                                                    position: 'absolute', left: 0, top: 0, bottom: 0,
                                                    width: '3px', background: cc.grad,
                                                    opacity: 0, transition: 'opacity 0.2s'
                                                }} />

                                                {/* Icon */}
                                                <div className="sh-icon" style={{
                                                    width: '48px', height: '48px', borderRadius: '12px',
                                                    background: cc.light, color: cc.accent,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0, transition: 'all 0.22s'
                                                }}>
                                                    <Icon size={22} />
                                                </div>

                                                {/* Content */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontWeight: 700, fontSize: '0.95rem',
                                                        color: '#1e293b', marginBottom: '0.2rem',
                                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                    }}>
                                                        {item.label}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.8rem', color: '#64748b',
                                                        lineHeight: 1.45
                                                    }}>
                                                        {item.description}
                                                    </div>
                                                </div>

                                                {/* Arrow */}
                                                <div className="sh-arrow" style={{
                                                    color: cc.accent, opacity: 0,
                                                    transform: 'translateX(-6px)',
                                                    transition: 'all 0.2s', flexShrink: 0
                                                }}>
                                                    <ChevronRight size={20} />
                                                </div>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
