import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Edit2, Trash2, Globe, Mail, Phone, MapPin, Briefcase, X, Save, Building2, ChevronDown } from 'lucide-react'
import { tiersAPI, statutsAPI, activitesAPI } from '../services/api'

/* ─── Palette couleur par initiale ───────────────────────────────────────── */
const ACCENT_COLORS = [
    { bg: '#f0fdf4', accent: '#16a34a', text: '#15803d' },
    { bg: '#eff6ff', accent: '#2563eb', text: '#1d4ed8' },
    { bg: '#fff7ed', accent: '#ea580c', text: '#c2410c' },
    { bg: '#f5f3ff', accent: '#7c3aed', text: '#6d28d9' },
    { bg: '#fdf2f8', accent: '#db2777', text: '#be185d' },
    { bg: '#fefce8', accent: '#ca8a04', text: '#a16207' },
    { bg: '#f0f9ff', accent: '#0284c7', text: '#0369a1' },
    { bg: '#fff1f2', accent: '#e11d48', text: '#be123c' },
]
const accentFor = (name = '') => ACCENT_COLORS[(name.charCodeAt(0) || 0) % ACCENT_COLORS.length]
const initials  = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

/* ─── StatPill ───────────────────────────────────────────────────────────── */
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

/* ─── TierCard ───────────────────────────────────────────────────────────── */
const TierCard = ({ tier, onEdit, onDelete }) => {
    const color = accentFor(tier.libtier)
    const ini   = initials(tier.libtier)
    const [hovered, setHovered] = useState(false)
    const actLabels = tier.activity_labels ? tier.activity_labels.split(',').map(s => s.trim()).filter(Boolean) : []

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: 'white', borderRadius: '16px',
                border: `1px solid ${hovered ? color.accent : '#e5e7eb'}`,
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                transition: 'all .25s cubic-bezier(.4,0,.2,1)',
                transform: hovered ? 'translateY(-4px)' : 'none',
                boxShadow: hovered
                    ? `0 16px 40px -8px ${color.accent}30, 0 4px 12px rgba(0,0,0,.08)`
                    : '0 1px 4px rgba(0,0,0,.06)',
            }}
        >
            {/* Barre accent */}
            <div style={{ height: '4px', background: color.accent }} />

            <div style={{ padding: '20px 20px 16px', flex: 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                            background: color.bg, color: color.text,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', fontWeight: 800,
                            border: `1.5px solid ${color.accent}22`,
                        }}>
                            {ini}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tier.libtier}
                            </div>
                            {tier.NINEATiers && (
                                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, marginTop: '2px' }}>
                                    NINEA: {tier.NINEATiers}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                        <button onClick={onEdit} title="Modifier" style={{
                            width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                            background: hovered ? color.bg : '#f9fafb',
                            color: hovered ? color.text : '#9ca3af',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                        }}>
                            <Edit2 size={14} />
                        </button>
                        <button onClick={onDelete} title="Supprimer" style={{
                            width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                            background: '#f9fafb', color: '#9ca3af',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background='#fff1f2'; e.currentTarget.style.color='#e11d48' }}
                            onMouseLeave={e => { e.currentTarget.style.background='#f9fafb'; e.currentTarget.style.color='#9ca3af' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Badges activités + statut */}
                {(tier.statut_label || actLabels.length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                        {tier.statut_label && (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>
                                {tier.statut_label}
                            </span>
                        )}
                        {actLabels.map((label, idx) => (
                            <span key={idx} style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: color.bg, color: color.text }}>
                                {label}
                            </span>
                        ))}
                    </div>
                )}

                {/* Infos contact */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tier.adresseTiers && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: '#6b7280' }}>
                            <MapPin size={13} style={{ color: '#d1d5db', flexShrink: 0, marginTop: '2px' }} />
                            <span>{tier.adresseTiers}</span>
                        </div>
                    )}
                    {tier.EmailTiers && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                            <Mail size={13} style={{ color: '#d1d5db', flexShrink: 0 }} />
                            <a href={`mailto:${tier.EmailTiers}`} style={{ color: color.text, fontWeight: 600, textDecoration: 'none' }}>{tier.EmailTiers}</a>
                        </div>
                    )}
                    {(tier.TelTiers || tier.CelTiers) && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#6b7280' }}>
                            <Phone size={13} style={{ color: '#d1d5db', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600 }}>{[tier.TelTiers, tier.CelTiers].filter(Boolean).join(' / ')}</span>
                        </div>
                    )}
                    {tier.SiteWeb && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                            <Globe size={13} style={{ color: '#d1d5db', flexShrink: 0 }} />
                            <a href={tier.SiteWeb} target="_blank" rel="noopener noreferrer"
                                style={{ color: '#9ca3af', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                                {tier.SiteWeb}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ─── Modal CRUD ─────────────────────────────────────────────────────────── */
const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: '10px',
    fontSize: '14px', outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .15s', background: 'white',
}
const labelStyle = { fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }

const TierModal = ({ editing, formData, statuts, activites, onChange, onActivityToggle, onSubmit, onClose }) => (
    <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}
    >
        <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: '20px', width: '100%', maxWidth: '620px',
            boxShadow: '0 24px 64px rgba(0,0,0,.18)', overflow: 'hidden',
            animation: 'modalIn .25s ease-out',
        }}>
            <style>{`@keyframes modalIn { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }`}</style>

            {/* Header modal */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Briefcase size={18} style={{ color: '#16a34a' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', color: '#111827' }}>{editing ? 'Modifier le Tiers' : 'Nouveau Tiers'}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{editing ? `Modification de ${editing.libtier}` : 'Ajout d\'un partenaire commercial'}</div>
                    </div>
                </div>
                <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} />
                </button>
            </div>

            {/* Corps */}
            <form onSubmit={onSubmit}>
                <div style={{ padding: '24px', maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div>
                        <label style={labelStyle}>Nom / Raison sociale *</label>
                        <input name="libtier" required value={formData.libtier} onChange={onChange} style={inputStyle}
                            onFocus={e => e.target.style.borderColor='#16a34a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>NINEA</label>
                            <input name="NINEATiers" value={formData.NINEATiers} onChange={onChange} style={inputStyle}
                                onFocus={e => e.target.style.borderColor='#16a34a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
                        </div>
                        <div>
                            <label style={labelStyle}>Statut</label>
                            <select name="IDStatuts" value={formData.IDStatuts} onChange={onChange}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                                onFocus={e => e.target.style.borderColor='#16a34a'} onBlur={e => e.target.style.borderColor='#e5e7eb'}>
                                <option value="">Sélectionner...</option>
                                {statuts.map(s => <option key={s.IDStatuts} value={s.IDStatuts}>{s.libelle}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Téléphone</label>
                            <input name="TelTiers" value={formData.TelTiers} onChange={onChange} style={inputStyle}
                                onFocus={e => e.target.style.borderColor='#16a34a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
                        </div>
                        <div>
                            <label style={labelStyle}>Mobile</label>
                            <input name="CelTiers" value={formData.CelTiers} onChange={onChange} style={inputStyle}
                                onFocus={e => e.target.style.borderColor='#16a34a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Email professionnel</label>
                        <input type="email" name="EmailTiers" value={formData.EmailTiers} onChange={onChange} style={inputStyle}
                            onFocus={e => e.target.style.borderColor='#16a34a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
                    </div>

                    <div>
                        <label style={labelStyle}>Adresse physique</label>
                        <input name="adresseTiers" value={formData.adresseTiers} onChange={onChange} style={inputStyle}
                            onFocus={e => e.target.style.borderColor='#16a34a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
                    </div>

                    <div>
                        <label style={labelStyle}>Site web</label>
                        <input name="SiteWeb" value={formData.SiteWeb} onChange={onChange} placeholder="https://..." style={inputStyle}
                            onFocus={e => e.target.style.borderColor='#16a34a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
                    </div>

                    <div>
                        <label style={labelStyle}>Observations</label>
                        <textarea name="Observations" value={formData.Observations} onChange={onChange} rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor='#16a34a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
                    </div>

                    <div>
                        <label style={labelStyle}>Activités</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', background: '#f9fafb', padding: '14px', borderRadius: '10px', border: '1.5px solid #e5e7eb' }}>
                            {activites.map(act => (
                                <label key={act.id_activite} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', transition: 'background .15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background='white'}
                                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                    <input type="checkbox"
                                        checked={formData.activityIds?.includes(act.id_activite)}
                                        onChange={() => onActivityToggle(act.id_activite)}
                                        style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{act.libelle}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                        Annuler
                    </button>
                    <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '10px', border: 'none', background: '#16a34a', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                        <Save size={16} /> {editing ? 'Mettre à jour' : 'Créer le tiers'}
                    </button>
                </div>
            </form>
        </div>
    </div>
)

/* ─── Page principale ────────────────────────────────────────────────────── */
const EMPTY_FORM = { libtier: '', adresseTiers: '', TelTiers: '', CelTiers: '', EmailTiers: '', NINEATiers: '', SiteWeb: '', IDStatuts: '', Observations: '', activityIds: [] }

export default function TiersPage() {
    const [tiers, setTiers]           = useState([])
    const [statuts, setStatuts]       = useState([])
    const [activites, setActivites]   = useState([])
    const [loading, setLoading]       = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedActivity, setSelectedActivity] = useState('')
    const [error, setError]           = useState('')
    const [showModal, setShowModal]   = useState(false)
    const [editingTier, setEditingTier] = useState(null)
    const [formData, setFormData]     = useState(EMPTY_FORM)

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [tiersRes, statutsRes, activitesRes] = await Promise.all([tiersAPI.getAll(), statutsAPI.getAll(), activitesAPI.getAll()])
            setTiers(tiersRes.data); setStatuts(statutsRes.data); setActivites(activitesRes.data)
        } catch { setError('Impossible de charger les données') }
        finally { setLoading(false) }
    }

    const loadTiers = async () => {
        try { const r = await tiersAPI.getAll(); setTiers(r.data) } catch {}
    }

    const handleEdit = (tier) => {
        setEditingTier(tier)
        setFormData({ libtier: tier.libtier || '', adresseTiers: tier.adresseTiers || '', TelTiers: tier.TelTiers || '', CelTiers: tier.CelTiers || '', EmailTiers: tier.EmailTiers || '', NINEATiers: tier.NINEATiers || '', SiteWeb: tier.SiteWeb || '', IDStatuts: tier.IDStatuts || '', Observations: tier.Observations || '', activityIds: tier.activity_ids ? tier.activity_ids.split(',').map(Number) : [] })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (window.confirm('Supprimer ce tiers ?')) {
            try { await tiersAPI.delete(id); loadTiers() }
            catch (err) { alert(err.response?.data?.error || 'Erreur lors de la suppression') }
        }
    }

    const handleClose = () => { setShowModal(false); setEditingTier(null); setFormData(EMPTY_FORM) }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            editingTier ? await tiersAPI.update(editingTier.IDTiers, formData) : await tiersAPI.create(formData)
            handleClose(); loadTiers()
        } catch (err) { alert(err.response?.data?.error || 'Erreur lors de l\'enregistrement') }
    }

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))

    const handleActivityToggle = (id) => setFormData(prev => ({
        ...prev,
        activityIds: prev.activityIds?.includes(id) ? prev.activityIds.filter(x => x !== id) : [...(prev.activityIds || []), id]
    }))

    const counts = useMemo(() => ({ total: tiers.length }), [tiers])

    const filteredTiers = useMemo(() => {
        const s = searchTerm.toLowerCase()
        return tiers
            .filter(t => !selectedActivity || (t.activity_ids && t.activity_ids.split(',').includes(selectedActivity.toString())))
            .filter(t => !s || t.libtier?.toLowerCase().includes(s) || t.NINEATiers?.toLowerCase().includes(s) || t.EmailTiers?.toLowerCase().includes(s))
    }, [tiers, searchTerm, selectedActivity])

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

            {/* ── HERO HEADER ── */}
            <div style={{
                background: 'linear-gradient(135deg, #14532d 0%, #166534 45%, #16a34a 100%)',
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
                                <Briefcase size={22} color="white" />
                            </div>
                            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-.03em' }}>
                                Gestion des Tiers
                            </h1>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '14px', margin: 0, marginLeft: '56px' }}>
                            Centralisez les informations de vos partenaires commerciaux
                        </p>
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 22px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: 'white', color: '#16a34a', fontSize: '14px', fontWeight: 700,
                            boxShadow: '0 4px 16px rgba(0,0,0,.2)', transition: 'all .2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.2)' }}
                    >
                        <Plus size={18} /> Nouveau Tiers
                    </button>
                </div>
            </div>

            {/* ── CONTENU ── */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2.5rem 3rem', marginTop: '-2rem' }}>

                {/* Card flottante */}
                <div style={{
                    background: 'white', borderRadius: '20px', border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 32px rgba(0,0,0,.08)', padding: '20px 24px', marginBottom: '28px',
                    display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
                }}>
                    <StatPill icon={<Building2 size={20} />} label="Total tiers" value={counts.total} color="#16a34a" />
                    <StatPill icon={<Briefcase size={20} />} label="Affichés"    value={filteredTiers.length} color="#0891b2" />

                    <div style={{ width: '1px', height: '40px', background: '#f3f4f6', flexShrink: 0 }} />

                    {/* Recherche */}
                    <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#d1d5db' }} />
                        <input
                            type="text" placeholder="Rechercher par nom, NINEA, email..."
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 36px 10px 38px', border: '1.5px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#f9fafb', transition: 'border-color .15s' }}
                            onFocus={e => e.target.style.borderColor='#16a34a'}
                            onBlur={e => e.target.style.borderColor='#e5e7eb'}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filtre activité */}
                    <div style={{ position: 'relative', minWidth: '190px' }}>
                        <select
                            value={selectedActivity}
                            onChange={e => setSelectedActivity(e.target.value)}
                            style={{ width: '100%', padding: '10px 36px 10px 12px', border: '1.5px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#f9fafb', appearance: 'none', cursor: 'pointer', fontWeight: 500, color: selectedActivity ? '#111827' : '#9ca3af', transition: 'border-color .15s' }}
                            onFocus={e => e.target.style.borderColor='#16a34a'}
                            onBlur={e => e.target.style.borderColor='#e5e7eb'}
                        >
                            <option value="">Toutes les activités</option>
                            {activites.map(act => <option key={act.id_activite} value={act.id_activite}>{act.libelle}</option>)}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                    </div>
                </div>

                {error && (
                    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '12px 18px', color: '#be123c', fontWeight: 600, marginBottom: '20px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                {/* Grille */}
                {filteredTiers.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                        {filteredTiers.map(tier => (
                            <TierCard
                                key={tier.IDTiers}
                                tier={tier}
                                onEdit={() => handleEdit(tier)}
                                onDelete={() => handleDelete(tier.IDTiers)}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', background: 'white', borderRadius: '20px', border: '2px dashed #e5e7eb', textAlign: 'center' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                            <Briefcase size={32} style={{ color: '#d1d5db' }} />
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
                            {searchTerm || selectedActivity ? 'Aucun résultat' : 'Aucun tiers enregistré'}
                        </div>
                        <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' }}>
                            {searchTerm || selectedActivity ? 'Modifiez vos critères de recherche' : 'Commencez par ajouter votre premier partenaire'}
                        </p>
                        {!searchTerm && !selectedActivity && (
                            <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#16a34a', color: 'white', fontSize: '14px', fontWeight: 700 }}>
                                <Plus size={16} /> Ajouter un tiers
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <TierModal
                    editing={editingTier}
                    formData={formData}
                    statuts={statuts}
                    activites={activites}
                    onChange={handleChange}
                    onActivityToggle={handleActivityToggle}
                    onSubmit={handleSubmit}
                    onClose={handleClose}
                />
            )}
        </div>
    )
}
