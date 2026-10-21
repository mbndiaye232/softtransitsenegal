import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersAPI } from '../services/api'
import {
    Users, UserPlus, Search, Edit2, UserMinus, UserCheck,
    Shield, Key, Layers, X, CheckCircle2, Info,
    ShieldAlert, ShieldCheck, UserCog
} from 'lucide-react'

/* ─── Palette avatar par initiale ───────────────────────────────────────── */
const AVATAR_COLORS = [
    { bg: '#eff6ff', text: '#2563eb' },
    { bg: '#eff6ff', text: '#1d4ed8' },
    { bg: '#fdf2f8', text: '#db2777' },
    { bg: '#fff7ed', text: '#ea580c' },
    { bg: '#f0fdf4', text: '#16a34a' },
    { bg: '#fefce8', text: '#ca8a04' },
    { bg: '#f0f9ff', text: '#0284c7' },
    { bg: '#fff1f2', text: '#e11d48' },
]
const avatarColor = (name = '') => AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

/* ─── Config des rôles ───────────────────────────────────────────────────── */
const ROLE_CONFIG = {
    SUPER_ADMIN: { label: 'Super Admin', bg: '#fef3c7', color: '#92400e', icon: <ShieldAlert size={11} /> },
    ADMIN:       { label: 'Admin',       bg: '#fee2e2', color: '#991b1b', icon: <ShieldCheck size={11} /> },
    EDITOR:      { label: 'Éditeur',     bg: '#eff6ff', color: '#1e40af', icon: <Shield size={11} /> },
    USER:        { label: 'Utilisateur', bg: '#f1f5f9', color: '#475569', icon: <Shield size={11} /> },
}
const roleConf = (role) => ROLE_CONFIG[role] || ROLE_CONFIG.USER

/* ─── Sous-composants ────────────────────────────────────────────────────── */
const StatPill = ({ icon, label, value, color }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'white', border: '1px solid #e5e7eb',
        borderRadius: '12px', padding: '12px 18px',
        boxShadow: '0 1px 3px rgba(0,0,0,.06)', minWidth: 'fit-content',
    }}>
        <span style={{ color, display: 'flex' }}>{icon}</span>
        <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: '2px' }}>{label}</div>
        </div>
    </div>
)

const FilterChip = ({ label, active, onClick, count }) => (
    <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 14px', borderRadius: '99px', border: 'none', cursor: 'pointer',
        fontSize: '13px', fontWeight: 600, transition: 'all .15s',
        background: active ? '#111827' : '#f3f4f6',
        color: active ? 'white' : '#6b7280',
    }}>
        {label}
        {count !== undefined && (
            <span style={{
                fontSize: '11px', fontWeight: 700,
                background: active ? 'rgba(255,255,255,.25)' : '#e5e7eb',
                color: active ? 'white' : '#9ca3af',
                borderRadius: '99px', padding: '1px 6px',
            }}>{count}</span>
        )}
    </button>
)

/* ─── Page principale ────────────────────────────────────────────────────── */
export default function UserList() {
    const navigate = useNavigate()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [filter, setFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [hoveredRow, setHoveredRow] = useState(null)

    useEffect(() => { loadUsers() }, [])

    const loadUsers = async () => {
        try {
            const response = await usersAPI.getAll()
            setUsers(response.data)
        } catch (err) {
            setError('Impossible de charger les agents')
        } finally {
            setLoading(false)
        }
    }

    const flash = (msg, isError = false) => {
        if (isError) { setError(msg); setTimeout(() => setError(''), 4000) }
        else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    }

    const handleDeactivate = async (id) => {
        if (!window.confirm('Désactiver cet agent ?')) return
        try { await usersAPI.delete(id); flash('Agent désactivé'); loadUsers() }
        catch (err) { flash(err.response?.data?.error || 'Erreur', true) }
    }

    const handleReactivate = async (id) => {
        if (!window.confirm('Réactiver cet agent ?')) return
        try { await usersAPI.reactivate(id); flash('Agent réactivé'); loadUsers() }
        catch (err) { flash(err.response?.data?.error || 'Erreur', true) }
    }

    const counts = useMemo(() => ({
        all:      users.length,
        active:   users.filter(u => u.is_active === 1).length,
        inactive: users.filter(u => u.is_active === 0).length,
        admins:   users.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length,
    }), [users])

    const filteredUsers = useMemo(() => {
        const s = searchTerm.toLowerCase()
        return users
            .filter(u => filter === 'all' || (filter === 'active' ? u.is_active === 1 : u.is_active === 0))
            .filter(u => !s || u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.login?.toLowerCase().includes(s))
    }, [users, searchTerm, filter])

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#0891b2', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

            {/* ── HERO HEADER ── */}
            <div style={{
                background: 'var(--hero-gradient)',
                padding: '2.5rem 2.5rem 4rem',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
                <div style={{ position: 'absolute', bottom: '-60px', right: '15%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />
                <div style={{ position: 'absolute', top: '20px', left: '40%', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />

                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UserCog size={22} color="white" />
                            </div>
                            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-.03em' }}>
                                Gestion des Agents
                            </h1>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '14px', margin: 0, marginLeft: '56px' }}>
                            Contrôlez les accès et les rôles de votre équipe
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/users/new')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 22px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: 'white', color: '#0891b2',
                            fontSize: '14px', fontWeight: 700,
                            boxShadow: '0 4px 16px rgba(0,0,0,.2)',
                            transition: 'all .2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.2)' }}
                    >
                        <UserPlus size={18} />
                        Créer un Agent
                    </button>
                </div>
            </div>

            {/* ── CONTENU ── */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2.5rem 3rem', marginTop: '-2rem' }}>

                {/* Card flottante stats + recherche */}
                <div style={{
                    background: 'white', borderRadius: '20px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 32px rgba(0,0,0,.08)',
                    padding: '20px 24px', marginBottom: '28px',
                    display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
                }}>
                    <StatPill icon={<Users size={20} />}      label="Total agents"  value={counts.all}     color="#0891b2" />
                    <StatPill icon={<CheckCircle2 size={20} />} label="Actifs"       value={counts.active}  color="#16a34a" />
                    <StatPill icon={<ShieldAlert size={20} />}  label="Admins"       value={counts.admins}  color="#d97706" />

                    <div style={{ width: '1px', height: '40px', background: '#f3f4f6', flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#d1d5db' }} />
                        <input
                            type="text"
                            placeholder="Rechercher par nom, login, email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                padding: '10px 36px 10px 38px',
                                border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                fontSize: '14px', outline: 'none',
                                background: '#f9fafb', transition: 'border-color .15s',
                            }}
                            onFocus={e => e.target.style.borderColor = '#0891b2'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filtres */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <FilterChip label="Tous"     active={filter === 'all'}      onClick={() => setFilter('all')}      count={counts.all} />
                    <FilterChip label="Actifs"   active={filter === 'active'}   onClick={() => setFilter('active')}   count={counts.active} />
                    <FilterChip label="Inactifs" active={filter === 'inactive'} onClick={() => setFilter('inactive')} count={counts.inactive} />

                    {filteredUsers.length !== users.length && (
                        <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#9ca3af', fontWeight: 600 }}>
                            {filteredUsers.length} résultat{filteredUsers.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Alertes */}
                {error && (
                    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '12px 18px', color: '#be123c', fontWeight: 600, marginBottom: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Info size={15} /> {error}
                    </div>
                )}
                {success && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 18px', color: '#15803d', fontWeight: 600, marginBottom: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={15} /> {success}
                    </div>
                )}

                {/* Table */}
                <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,.06)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                                {['Agent / Identité', 'Login / CP', 'Service / Groupe', "Niveau d'accès", 'Statut', 'Options'].map((h, i) => (
                                    <th key={h} style={{
                                        padding: '14px 20px', textAlign: i === 5 ? 'right' : 'left',
                                        fontSize: '11px', fontWeight: 700, color: '#94a3b8',
                                        textTransform: 'uppercase', letterSpacing: '.06em',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => {
                                const av = avatarColor(user.name || '')
                                const rc = roleConf(user.role)
                                const isHov = hoveredRow === user.id
                                const inactive = !user.is_active

                                return (
                                    <tr
                                        key={user.id}
                                        onMouseEnter={() => setHoveredRow(user.id)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                        style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            background: isHov ? '#f8fafc' : 'white',
                                            opacity: inactive ? 0.6 : 1,
                                            transition: 'background .15s',
                                        }}
                                    >
                                        {/* Agent / Identité */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '40px', height: '40px', borderRadius: '10px',
                                                    background: av.bg, color: av.text,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '14px', fontWeight: 800, flexShrink: 0,
                                                    border: `1.5px solid ${av.text}22`,
                                                }}>
                                                    {initials(user.name || '')}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{user.name}</div>
                                                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '1px' }}>{user.email}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Login / CP */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                                <Key size={13} style={{ color: '#d1d5db', flexShrink: 0 }} />
                                                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: '#374151' }}>{user.login}</span>
                                            </div>
                                        </td>

                                        {/* Service / Groupe */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                                <Layers size={13} style={{ color: '#d1d5db', flexShrink: 0 }} />
                                                <span style={{ fontSize: '13px', color: user.group_name ? '#374151' : '#9ca3af', fontStyle: user.group_name ? 'normal' : 'italic' }}>
                                                    {user.group_name || 'Non affecté'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Niveau d'accès */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                padding: '4px 10px', borderRadius: '99px',
                                                fontSize: '11px', fontWeight: 700,
                                                background: rc.bg, color: rc.color,
                                            }}>
                                                {rc.icon} {rc.label}
                                            </span>
                                        </td>

                                        {/* Statut */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                                <div style={{
                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                    background: user.is_active ? '#22c55e' : '#ef4444',
                                                    boxShadow: user.is_active ? '0 0 0 3px #dcfce7' : '0 0 0 3px #fee2e2',
                                                }} />
                                                <span style={{ fontSize: '13px', fontWeight: 700, color: user.is_active ? '#16a34a' : '#dc2626' }}>
                                                    {user.is_active ? 'Actif' : 'Désactivé'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Options */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                <button
                                                    onClick={() => navigate(`/users/${user.id}`)}
                                                    title="Modifier"
                                                    style={{
                                                        width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #e5e7eb',
                                                        background: isHov ? '#eff6ff' : 'white', color: isHov ? '#2563eb' : '#9ca3af',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all .15s',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background='#eff6ff'; e.currentTarget.style.color='#2563eb'; e.currentTarget.style.borderColor='#bfdbfe' }}
                                                    onMouseLeave={e => { e.currentTarget.style.background= isHov?'#eff6ff':'white'; e.currentTarget.style.color= isHov?'#2563eb':'#9ca3af'; e.currentTarget.style.borderColor='#e5e7eb' }}
                                                >
                                                    <Edit2 size={15} />
                                                </button>

                                                {user.is_active ? (
                                                    <button
                                                        onClick={() => handleDeactivate(user.id)}
                                                        title="Désactiver"
                                                        style={{
                                                            width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #e5e7eb',
                                                            background: 'white', color: '#9ca3af', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background='#fff1f2'; e.currentTarget.style.color='#e11d48'; e.currentTarget.style.borderColor='#fecdd3' }}
                                                        onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.color='#9ca3af'; e.currentTarget.style.borderColor='#e5e7eb' }}
                                                    >
                                                        <UserMinus size={15} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleReactivate(user.id)}
                                                        title="Réactiver"
                                                        style={{
                                                            width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #e5e7eb',
                                                            background: 'white', color: '#9ca3af', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background='#f0fdf4'; e.currentTarget.style.color='#16a34a'; e.currentTarget.style.borderColor='#bbf7d0' }}
                                                        onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.color='#9ca3af'; e.currentTarget.style.borderColor='#e5e7eb' }}
                                                    >
                                                        <UserCheck size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}

                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: '64px 40px', textAlign: 'center' }}>
                                        <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <Users size={28} style={{ color: '#d1d5db' }} />
                                        </div>
                                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                                            {searchTerm ? 'Aucun résultat' : 'Aucun agent'}
                                        </div>
                                        <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
                                            {searchTerm ? `Aucun agent ne correspond à "${searchTerm}"` : 'Commencez par créer votre premier agent'}
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
