import React, { useState, useEffect, useMemo } from 'react'
import { getReferenceSymbol } from '../utils/currency'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2, Mail, MapPin, UserCircle2, Phone, Building2, ChevronRight, Users, TrendingUp, BadgeCheck, X, Wallet } from 'lucide-react'
import { clientsAPI } from '../services/api'

/* ─── Palette couleur par initiale ──────────────────────────────────────── */
const ACCENT_COLORS = [
    { bg: '#eff6ff', accent: '#2563eb', text: '#1d4ed8' },
    { bg: '#f5f3ff', accent: '#7c3aed', text: '#6d28d9' },
    { bg: '#fdf2f8', accent: '#db2777', text: '#be185d' },
    { bg: '#fff7ed', accent: '#ea580c', text: '#c2410c' },
    { bg: '#f0fdf4', accent: '#16a34a', text: '#15803d' },
    { bg: '#fefce8', accent: '#ca8a04', text: '#a16207' },
    { bg: '#f0f9ff', accent: '#0284c7', text: '#0369a1' },
    { bg: '#fff1f2', accent: '#e11d48', text: '#be123c' },
]
const accentFor = (name = '') => ACCENT_COLORS[(name.charCodeAt(0) || 0) % ACCENT_COLORS.length]
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

/* ─── Sous-composants ────────────────────────────────────────────────────── */
const StatPill = ({ icon, label, value, color }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'white', border: '1px solid #e5e7eb',
        borderRadius: '12px', padding: '12px 18px',
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        minWidth: 'fit-content',
    }}>
        <span style={{ color, fontSize: '20px', display:'flex' }}>{icon}</span>
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

const ClientCard = ({ client, onEdit, onDelete, onAccount }) => {
    const color = accentFor(client.NomRS)
    const ini = initials(client.NomRS)
    const [hovered, setHovered] = useState(false)

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: 'white',
                borderRadius: '16px',
                border: `1px solid ${hovered ? color.accent : '#e5e7eb'}`,
                overflow: 'hidden',
                transition: 'all .25s cubic-bezier(.4,0,.2,1)',
                transform: hovered ? 'translateY(-4px)' : 'none',
                boxShadow: hovered
                    ? `0 16px 40px -8px ${color.accent}30, 0 4px 12px rgba(0,0,0,.08)`
                    : '0 1px 4px rgba(0,0,0,.06)',
                display: 'flex', flexDirection: 'column',
            }}
        >
            {/* Barre accent top */}
            <div style={{ height: '4px', background: color.accent }} />

            <div style={{ padding: '20px 20px 0' }}>
                {/* Header carte */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                        {/* Avatar initiales */}
                        <div style={{
                            width: '46px', height: '46px', borderRadius: '12px',
                            background: color.bg, color: color.text,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '15px', fontWeight: 800, flexShrink: 0,
                            border: `1.5px solid ${color.accent}22`,
                        }}>
                            {ini}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {client.NomRS}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, marginTop: '2px' }}>
                                {client.CodeClient ? `#${client.CodeClient}` : <span style={{ fontStyle: 'italic' }}>sans code</span>}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                        <button onClick={onAccount} title="Consulter le compte" style={{
                            width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                            background: hovered ? color.bg : '#f9fafb',
                            color: hovered ? color.text : '#9ca3af',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all .15s',
                        }}>
                            <Wallet size={14} />
                        </button>
                        <button onClick={onEdit} title="Modifier" style={{
                            width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                            background: hovered ? color.bg : '#f9fafb',
                            color: hovered ? color.text : '#9ca3af',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all .15s',
                        }}>
                            <Edit2 size={14} />
                        </button>
                        <button onClick={onDelete} title="Supprimer" style={{
                            width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                            background: '#f9fafb', color: '#9ca3af',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all .15s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#e11d48' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#9ca3af' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {client.NINEA && (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#f3f4f6', color: '#374151' }}>
                            NINEA: {client.NINEA}
                        </span>
                    )}
                    {client.ExonereTVA
                        ? <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#f0fdf4', color: '#16a34a' }}>
                            <BadgeCheck size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />Exonéré TVA
                          </span>
                        : <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#eff6ff', color: '#2563eb' }}>
                            Assujetti TVA
                          </span>
                    }
                    {client.statut_label && (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: color.bg, color: color.text }}>
                            {client.statut_label}
                        </span>
                    )}
                </div>

                {/* Infos contact */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {client.adresseClient && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: '#6b7280' }}>
                            <MapPin size={14} style={{ color: '#d1d5db', flexShrink: 0, marginTop: '1px' }} />
                            <span>{client.adresseClient}</span>
                        </div>
                    )}
                    {client.EmailClient && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                            <Mail size={14} style={{ color: '#d1d5db', flexShrink: 0 }} />
                            <a href={`mailto:${client.EmailClient}`} style={{ color: color.text, fontWeight: 600, textDecoration: 'none' }}>
                                {client.EmailClient}
                            </a>
                        </div>
                    )}
                    {client.PersonneContact && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#6b7280' }}>
                            <UserCircle2 size={14} style={{ color: '#d1d5db', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#374151' }}>{client.PersonneContact}</span>
                            {client.TelPersonneContact && (
                                <span style={{ color: '#9ca3af', fontSize: '12px' }}> · {client.TelPersonneContact}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer financier */}
            <div style={{
                marginTop: 'auto',
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                background: hovered ? color.bg : '#f9fafb',
                borderTop: `1px solid ${hovered ? color.accent + '20' : '#f3f4f6'}`,
                transition: 'all .25s',
            }}>
                <div style={{ padding: '12px 16px', borderRight: `1px solid ${hovered ? color.accent + '20' : '#f3f4f6'}` }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '3px' }}>Encours autorisé</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: hovered ? color.text : '#374151' }}>
                        {Number(client.EncoursAutorise || 0).toLocaleString()} <span style={{ fontWeight: 500, fontSize: '11px', color: '#9ca3af' }}>{getReferenceSymbol()}</span>
                    </div>
                </div>
                <div style={{ padding: '12px 16px', borderRight: `1px solid ${hovered ? color.accent + '20' : '#f3f4f6'}` }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '3px' }}>Délai règlement</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: hovered ? color.text : '#374151' }}>
                        {client.DelaiReglement || 30} <span style={{ fontWeight: 500, fontSize: '11px', color: '#9ca3af' }}>jours</span>
                    </div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '3px' }}>Solde compte</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: Number(client.SoldeCompteClient || 0) > 0 ? '#16a34a' : (hovered ? color.text : '#374151') }}>
                        {Number(client.SoldeCompteClient || 0).toLocaleString()} <span style={{ fontWeight: 500, fontSize: '11px', color: '#9ca3af' }}>{getReferenceSymbol()}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ─── Page principale ────────────────────────────────────────────────────── */
export default function ClientList() {
    const navigate = useNavigate()
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState('tous')
    const [error, setError] = useState('')

    useEffect(() => { loadClients() }, [])

    const loadClients = async () => {
        try {
            setLoading(true)
            const response = await clientsAPI.getAll()
            setClients(response.data)
            setError('')
        } catch (err) {
            setError('Impossible de charger la liste des clients')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id, name) => {
        if (window.confirm(`Supprimer le client "${name}" ?`)) {
            try { await clientsAPI.delete(id); loadClients() }
            catch (err) { alert(err.response?.data?.error || 'Erreur lors de la suppression') }
        }
    }

    const counts = useMemo(() => ({
        tous: clients.length,
        exoneres: clients.filter(c => c.ExonereTVA).length,
        assujettis: clients.filter(c => !c.ExonereTVA).length,
    }), [clients])

    const filteredClients = useMemo(() => {
        const s = searchTerm.toLowerCase()
        return clients
            .filter(c => filter === 'tous' || (filter === 'exoneres' ? c.ExonereTVA : !c.ExonereTVA))
            .filter(c => !s || c.NomRS?.toLowerCase().includes(s) || c.NINEA?.toLowerCase().includes(s) || c.EmailClient?.toLowerCase().includes(s) || c.CodeClient?.toLowerCase().includes(s) || c.PersonneContact?.toLowerCase().includes(s))
    }, [clients, searchTerm, filter])

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

            {/* ── HERO HEADER ── */}
            <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4f46e5 100%)',
                padding: '2.5rem 2.5rem 4rem',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Cercles décoratifs */}
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
                <div style={{ position: 'absolute', bottom: '-60px', right: '15%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />
                <div style={{ position: 'absolute', top: '20px', left: '40%', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />

                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Users size={22} color="white" />
                            </div>
                            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-.03em' }}>
                                Sociétés Clientes
                            </h1>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '14px', margin: 0, marginLeft: '56px' }}>
                            Gérez vos partenaires d'affaires et leurs conditions commerciales
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/clients/new')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 22px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: 'white', color: '#4f46e5',
                            fontSize: '14px', fontWeight: 700,
                            boxShadow: '0 4px 16px rgba(0,0,0,.2)',
                            transition: 'all .2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.2)' }}
                    >
                        <Plus size={18} />
                        Nouveau Client
                    </button>
                </div>
            </div>

            {/* ── CONTENU ── */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2.5rem 3rem', marginTop: '-2rem' }}>

                {/* Stats + Search card flottante */}
                <div style={{
                    background: 'white', borderRadius: '20px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 32px rgba(0,0,0,.08)',
                    padding: '20px 24px',
                    marginBottom: '28px',
                    display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
                }}>
                    {/* Stats pills */}
                    <StatPill icon={<Building2 size={20} />} label="Total clients" value={counts.tous} color="#4f46e5" />
                    <StatPill icon={<BadgeCheck size={20} />} label="Exonérés TVA" value={counts.exoneres} color="#16a34a" />
                    <StatPill icon={<TrendingUp size={20} />} label="Assujettis" value={counts.assujettis} color="#2563eb" />

                    {/* Séparateur */}
                    <div style={{ width: '1px', height: '40px', background: '#f3f4f6', flexShrink: 0 }} />

                    {/* Recherche */}
                    <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#d1d5db' }} />
                        <input
                            type="text"
                            placeholder="Rechercher par nom, NINEA, email, code..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                padding: '10px 36px 10px 38px',
                                border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                fontSize: '14px', outline: 'none',
                                transition: 'border-color .15s',
                                background: '#f9fafb',
                            }}
                            onFocus={e => e.target.style.borderColor = '#6366f1'}
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
                    <FilterChip label="Tous" active={filter === 'tous'} onClick={() => setFilter('tous')} count={counts.tous} />
                    <FilterChip label="Exonérés TVA" active={filter === 'exoneres'} onClick={() => setFilter('exoneres')} count={counts.exoneres} />
                    <FilterChip label="Assujettis TVA" active={filter === 'assujettis'} onClick={() => setFilter('assujettis')} count={counts.assujettis} />

                    {filteredClients.length !== clients.length && (
                        <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#9ca3af', fontWeight: 600 }}>
                            {filteredClients.length} résultat{filteredClients.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {error && (
                    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '14px 18px', color: '#be123c', fontWeight: 600, marginBottom: '20px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                {/* Grille cartes */}
                {filteredClients.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                        {filteredClients.map(client => (
                            <ClientCard
                                key={client.IDCLIENTS}
                                client={client}
                                onEdit={() => navigate(`/clients/${client.IDCLIENTS}`)}
                                onDelete={() => handleDelete(client.IDCLIENTS, client.NomRS)}
                                onAccount={() => navigate(`/reglements/cancellation?clientId=${client.IDCLIENTS}&tab=movements`)}
                            />
                        ))}
                    </div>
                ) : (
                    /* État vide */
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '80px 40px', background: 'white', borderRadius: '20px',
                        border: '2px dashed #e5e7eb', textAlign: 'center',
                    }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                            <Users size={32} style={{ color: '#d1d5db' }} />
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
                            {searchTerm ? 'Aucun résultat trouvé' : 'Aucun client enregistré'}
                        </div>
                        <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' }}>
                            {searchTerm ? `Aucun client ne correspond à "${searchTerm}"` : 'Commencez par ajouter votre premier client'}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={() => navigate('/clients/new')}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#4f46e5', color: 'white', fontSize: '14px', fontWeight: 700 }}
                            >
                                <Plus size={16} /> Ajouter un client
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
