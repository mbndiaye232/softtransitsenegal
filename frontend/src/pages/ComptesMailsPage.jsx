import React, { useState, useEffect } from 'react'
import {
    Mail, Plus, Save, Trash2, RefreshCcw,
    ShieldCheck, Server, Settings2, CheckCircle2,
    AlertCircle, Info, Eye, EyeOff, Send, ArrowLeft,
    AtSign
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { comptesMailsAPI } from '../services/api'

/* ── Color config ── */
const C = {
    accent: '#6366f1',
    light:  '#eef2ff',
    border: '#c7d2fe',
    grad:   'linear-gradient(135deg,#4338ca,#6366f1)',
}

/* ── BlockCard ── */
function BlockCard({ icon: Icon, title, subtitle, action, children }) {
    return (
        <div style={{
            borderRadius: '20px', overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(67,56,202,0.12)',
            border: `1px solid ${C.border}`,
        }}>
            <div style={{
                background: C.grad,
                padding: '1.1rem 1.75rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.22)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                    }}>
                        <Icon size={19} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'white', letterSpacing: '0.04em' }}>{title}</div>
                        {subtitle && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '1px' }}>{subtitle}</div>}
                    </div>
                </div>
                {action}
            </div>
            <div style={{ background: 'white', overflowX: 'auto' }}>{children}</div>
        </div>
    )
}

/* ── Section separator ── */
function SectionTitle({ icon: Icon, label, color }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
            <div style={{
                width: '28px', height: '28px', borderRadius: '8px',
                background: color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color,
            }}>
                <Icon size={14} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
            <div style={{ flex: 1, height: '1px', background: color + '25' }} />
        </div>
    )
}

/* ── Form input ── */
function FInput({ label, required, children, style = {} }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', ...style }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}{required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
            </label>
            {children}
        </div>
    )
}

const inputStyle = {
    width: '100%', padding: '9px 13px',
    border: '1.5px solid #e2e8f0', borderRadius: '10px',
    fontSize: '14px', color: '#1e293b', background: '#f8fafc',
    outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s',
}

export default function ComptesMailsPage() {
    const navigate = useNavigate()
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [testing, setTesting] = useState(false)
    const [saving, setSaving] = useState(false)
    const [testResult, setTestResult] = useState(null)
    const [showPassword, setShowPassword] = useState(false)
    const [toast, setToast] = useState(null)
    const [hovRow, setHovRow] = useState(null)

    const [selectedId, setSelectedId] = useState(null)
    const [formData, setFormData] = useState({
        AdresseMail: '', MotDePasse: '', LibelleMail: '',
        ServeurSMTP: '', PortSMTP: '587', SecureSSL: false,
        ServeurPOP: '', PortPOP: '110',
        ServeurIMAPEntrant: '', PortIMAPEntrant: '143',
        ServeurIMAPSortant: '', PortIMAPSortant: '587',
    })

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const res = await comptesMailsAPI.getAll()
            setAccounts(res.data)
            if (res.data.length > 0) {
                if (!selectedId) handleSelect(res.data[0])
            } else {
                handleNew()
            }
        } catch (err) {
            console.error('Failed to load accounts:', err)
        } finally { setLoading(false) }
    }

    const handleSelect = (acc) => {
        setSelectedId(acc.IDComptesMails)
        setFormData({
            AdresseMail:        acc.AdresseMail        || '',
            MotDePasse:         acc.MotDePasse         || '',
            LibelleMail:        acc.LibelleMail        || '',
            ServeurSMTP:        acc.ServeurSMTP        || '',
            PortSMTP:           acc.PortSMTP           || '587',
            SecureSSL:          !!(acc.SecureSSL || acc.securessl),
            ServeurPOP:         acc.ServeurPOP         || '',
            PortPOP:            acc.PortPOP            || '110',
            ServeurIMAPEntrant:  acc.ServeurIMAPEntrant  || '',
            PortIMAPEntrant:     acc.PortIMAPEntrant     || '143',
            ServeurIMAPSortant:  acc.ServeurIMAPSortant  || '',
            PortIMAPSortant:     acc.PortIMAPSortant     || '587',
        })
        setTestResult(null)
    }

    const handleNew = () => {
        setSelectedId('new')
        setFormData({
            AdresseMail: '', MotDePasse: '', LibelleMail: '',
            ServeurSMTP: '', PortSMTP: '587', SecureSSL: false,
            ServeurPOP: '', PortPOP: '110',
            ServeurIMAPEntrant: '', PortIMAPEntrant: '143',
            ServeurIMAPSortant: '', PortIMAPSortant: '587',
        })
        setTestResult(null)
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!selectedId) return
        setSaving(true)
        try {
            if (selectedId === 'new') await comptesMailsAPI.create(formData)
            else await comptesMailsAPI.update(selectedId, formData)
            showToast(selectedId === 'new' ? 'Compte créé avec succès' : 'Modifications enregistrées')
            loadData()
        } catch (err) {
            showToast('Erreur lors de l\'enregistrement', 'error')
        } finally { setSaving(false) }
    }

    const handleDelete = async () => {
        if (!selectedId || selectedId === 'new') return
        if (window.confirm('Voulez-vous vraiment supprimer ce compte email ?')) {
            try {
                await comptesMailsAPI.delete(selectedId)
                setSelectedId(null)
                showToast('Compte supprimé')
                loadData()
            } catch (err) {
                showToast('Erreur lors de la suppression', 'error')
            }
        }
    }

    const handleTestConnection = async () => {
        if (!formData.AdresseMail || !formData.ServeurSMTP || !formData.MotDePasse) {
            showToast('Renseignez l\'adresse, le serveur SMTP et le mot de passe', 'error')
            return
        }
        setTesting(true)
        setTestResult(null)
        try {
            const res = await comptesMailsAPI.test({ ...formData, SecureSSL: formData.SecureSSL })
            setTestResult({ success: true, message: res.data.message })
        } catch (err) {
            setTestResult({
                success: false,
                message: err.response?.data?.error || 'Échec de la connexion. Vérifiez vos paramètres.',
            })
        } finally { setTesting(false) }
    }

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: C.accent, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes slideUp { from{transform:translateY(10px);opacity:0} to{transform:translateY(0);opacity:1} }
                input:focus { border-color: ${C.accent} !important; background: white !important; box-shadow: 0 0 0 3px ${C.light} !important; }
            `}</style>

            {/* ── Toast ── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 2000,
                    padding: '12px 18px', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontWeight: 700, fontSize: '14px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    animation: 'slideUp 0.3s ease',
                    background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: toast.type === 'success' ? '#16a34a' : '#ef4444',
                    border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fee2e2'}`,
                }}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* ══════════ HERO ══════════ */}
            <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
                padding: '2.5rem 2rem 6rem',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Orbs */}
                <div style={{ position: 'absolute', top: '-60px', right: '5%', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.4) 0%,transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-80px', left: '15%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(6,182,212,0.25) 0%,transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                {/* Grid */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 2, maxWidth: '1300px', margin: '0 auto' }}>
                    <button onClick={() => navigate('/parameters-hub')} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px', padding: '6px 14px',
                        color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', marginBottom: '1.5rem',
                    }}>
                        <ArrowLeft size={14} /> Paramètres
                    </button>

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                                <div style={{
                                    width: '50px', height: '50px', borderRadius: '14px',
                                    background: 'rgba(255,255,255,0.18)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Mail size={26} color="white" />
                                </div>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em' }}>
                                        Comptes Mails
                                    </h1>
                                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 500 }}>
                                        Configuration des serveurs d'envoi et de réception
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* KPI pill + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <div style={{
                                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '12px', padding: '10px 18px', textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{accounts.length}</div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>compte(s)</div>
                            </div>
                            <button onClick={handleNew} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
                                borderRadius: '10px', padding: '10px 18px',
                                color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            }}>
                                <Plus size={16} /> Nouveau Compte
                            </button>
                            <button onClick={handleDelete}
                                disabled={!selectedId || selectedId === 'new'}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    background: (!selectedId || selectedId === 'new') ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.2)',
                                    border: `1px solid ${(!selectedId || selectedId === 'new') ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.4)'}`,
                                    borderRadius: '10px', padding: '10px 18px',
                                    color: (!selectedId || selectedId === 'new') ? 'rgba(255,255,255,0.35)' : '#fca5a5',
                                    fontSize: '13px', fontWeight: 700,
                                    cursor: (!selectedId || selectedId === 'new') ? 'not-allowed' : 'pointer',
                                }}>
                                <Trash2 size={16} /> Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════ FLOATING CONTENT ══════════ */}
            <div style={{ maxWidth: '1300px', margin: '-48px auto 0', padding: '0 2rem 2rem', position: 'relative', zIndex: 10 }}>

                {/* ── Accounts list ── */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <BlockCard icon={AtSign} title="Comptes configurés" subtitle={`${accounts.length} compte(s) mail`}>
                        {accounts.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#cbd5e1' }}>
                                <Mail size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>Aucun compte configuré</div>
                                <div style={{ fontSize: '12px', marginTop: '4px' }}>Cliquez sur Nouveau pour commencer</div>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: C.grad }}>
                                        {['Libellé / Nom', 'Adresse Mail', 'Serveur SMTP', 'Statut'].map((h, i) => (
                                            <th key={i} style={{ padding: '9px 18px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {accounts.map((acc, i) => {
                                        const isSelected = selectedId === acc.IDComptesMails
                                        const isHov = hovRow === i
                                        return (
                                            <tr key={acc.IDComptesMails}
                                                onClick={() => handleSelect(acc)}
                                                onMouseEnter={() => setHovRow(i)}
                                                onMouseLeave={() => setHovRow(null)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: isSelected ? C.light : isHov ? '#fafbfc' : 'white',
                                                    borderBottom: '1px solid #f1f5f9',
                                                }}
                                            >
                                                <td style={{ padding: '11px 18px', fontWeight: isSelected ? 800 : 600, fontSize: '14px', color: isSelected ? C.accent : '#1e293b' }}>
                                                    {acc.LibelleMail || acc.AdresseMail?.split('@')[0]}
                                                </td>
                                                <td style={{ padding: '11px 18px', fontSize: '13px', color: isSelected ? C.accent : '#475569' }}>{acc.AdresseMail}</td>
                                                <td style={{ padding: '11px 18px', fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>{acc.ServeurSMTP || '—'}</td>
                                                <td style={{ padding: '11px 18px' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                        fontSize: '11px', fontWeight: 700,
                                                        padding: '3px 10px', borderRadius: '99px',
                                                        background: acc.ServeurSMTP ? '#ecfdf5' : '#fef2f2',
                                                        color: acc.ServeurSMTP ? '#16a34a' : '#dc2626',
                                                        border: `1px solid ${acc.ServeurSMTP ? '#bbf7d0' : '#fecaca'}`,
                                                    }}>
                                                        <ShieldCheck size={11} />
                                                        {acc.ServeurSMTP ? 'Configuré' : 'Incomplet'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            </div>
                        )}
                    </BlockCard>
                </div>

                {/* ── Edit form ── */}
                <BlockCard
                    icon={selectedId === 'new' ? Plus : Settings2}
                    title={selectedId === 'new' ? 'Nouveau compte mail' : (formData.LibelleMail || formData.AdresseMail || 'Détails du compte')}
                    subtitle={selectedId === 'new' ? 'Configuration de la boîte mail' : formData.AdresseMail}
                    action={
                        <button onClick={handleTestConnection} disabled={testing}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '7px',
                                background: testing ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                                border: '1px solid rgba(255,255,255,0.4)',
                                borderRadius: '9px', padding: '7px 16px',
                                color: 'white', fontSize: '13px', fontWeight: 700, cursor: testing ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                            }}>
                            {testing
                                ? <RefreshCcw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                : <Send size={15} />}
                            {testing ? 'Test en cours...' : 'Tester la connexion SMTP'}
                        </button>
                    }
                >
                    <form onSubmit={handleSubmit}>
                        <div style={{ padding: '2rem' }}>

                            {/* ── Section: Identifiants ── */}
                            <SectionTitle icon={ShieldCheck} label="Identifiants & Identité" color="#6366f1" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                                <FInput label="Adresse Mail" required>
                                    <input name="AdresseMail" value={formData.AdresseMail} onChange={handleChange}
                                        placeholder="contact@entreprise.com" required style={inputStyle} />
                                </FInput>
                                <FInput label="Mot de passe" required>
                                    <div style={{ position: 'relative' }}>
                                        <input name="MotDePasse" type={showPassword ? 'text' : 'password'}
                                            value={formData.MotDePasse} onChange={handleChange} required
                                            style={{ ...inputStyle, paddingRight: '42px' }} />
                                        <button type="button" onClick={() => setShowPassword(p => !p)}
                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                        </button>
                                    </div>
                                </FInput>
                                <FInput label="Libellé d'affichage (optionnel)">
                                    <input name="LibelleMail" value={formData.LibelleMail} onChange={handleChange}
                                        placeholder="ex: SOFT TRANSIT - Facturation" style={inputStyle} />
                                </FInput>
                            </div>

                            {/* ── Section: SMTP ── */}
                            <SectionTitle icon={Send} label="Envoi — Serveur SMTP" color="#0891b2" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '1.25rem', marginBottom: '1rem' }}>
                                <FInput label="Hôte SMTP" required>
                                    <input name="ServeurSMTP" value={formData.ServeurSMTP} onChange={handleChange}
                                        placeholder="ex: ssl0.ovh.net" required style={inputStyle} />
                                </FInput>
                                <FInput label="Port SMTP" required>
                                    <input name="PortSMTP" value={formData.PortSMTP} onChange={handleChange}
                                        placeholder="587" style={inputStyle} />
                                </FInput>
                            </div>
                            {/* SSL/TLS toggle */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '10px',
                                    cursor: 'pointer', userSelect: 'none',
                                    padding: '10px 16px',
                                    background: formData.SecureSSL ? '#ecfdf5' : '#f8fafc',
                                    border: `1.5px solid ${formData.SecureSSL ? '#6ee7b7' : '#e2e8f0'}`,
                                    borderRadius: '10px', transition: 'all 0.2s',
                                }}>
                                    <div style={{ position: 'relative', width: '40px', height: '22px', flexShrink: 0 }}>
                                        <input
                                            type="checkbox"
                                            name="SecureSSL"
                                            checked={!!formData.SecureSSL}
                                            onChange={handleChange}
                                            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                        />
                                        <div style={{
                                            position: 'absolute', inset: 0, borderRadius: '99px',
                                            background: formData.SecureSSL ? '#10b981' : '#cbd5e1',
                                            transition: 'background 0.2s',
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            top: '3px',
                                            left: formData.SecureSSL ? '21px' : '3px',
                                            width: '16px', height: '16px', borderRadius: '50%',
                                            background: 'white',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                            transition: 'left 0.2s',
                                        }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 800, color: formData.SecureSSL ? '#065f46' : '#475569' }}>
                                            SSL / TLS {formData.SecureSSL ? '— Activé' : '— Désactivé'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: formData.SecureSSL ? '#059669' : '#94a3b8', marginTop: '1px' }}>
                                            {formData.SecureSSL
                                                ? 'Connexion chiffrée SSL/TLS directe (recommandé pour port 465 OVH)'
                                                : 'STARTTLS ou non chiffré — utilisez port 587 ou 25'}
                                        </div>
                                    </div>
                                </label>
                            </div>
                            {/* Test result */}
                            {testResult && (
                                <div style={{
                                    marginBottom: '1.5rem', padding: '12px 16px', borderRadius: '11px',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    fontSize: '13px', fontWeight: 700,
                                    background: testResult.success ? '#f0fdf4' : '#fef2f2',
                                    color: testResult.success ? '#16a34a' : '#dc2626',
                                    border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`,
                                    animation: 'slideUp 0.3s ease',
                                }}>
                                    {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                    {testResult.message}
                                </div>
                            )}

                            {/* ── Section: Réception POP/IMAP ── */}
                            <SectionTitle icon={Server} label="Réception — POP / IMAP" color="#7c3aed" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr 140px', gap: '1.25rem' }}>
                                <FInput label="Hôte POP">
                                    <input name="ServeurPOP" value={formData.ServeurPOP} onChange={handleChange} style={inputStyle} />
                                </FInput>
                                <FInput label="Port POP">
                                    <input name="PortPOP" value={formData.PortPOP} onChange={handleChange} style={inputStyle} />
                                </FInput>
                                <FInput label="IMAP Entrant">
                                    <input name="ServeurIMAPEntrant" value={formData.ServeurIMAPEntrant} onChange={handleChange} style={inputStyle} />
                                </FInput>
                                <FInput label="Port IMAP">
                                    <input name="PortIMAPEntrant" value={formData.PortIMAPEntrant} onChange={handleChange} style={inputStyle} />
                                </FInput>
                            </div>
                        </div>

                        {/* ── Footer ── */}
                        <div style={{
                            padding: '1.25rem 2rem',
                            background: '#f8fafc',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                <Info size={14} />
                                Les paramètres sont appliqués immédiatement aux nouveaux envois.
                            </div>
                            <button type="submit" disabled={saving || testing}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: C.grad, color: 'white',
                                    border: 'none', borderRadius: '11px',
                                    padding: '11px 28px', fontWeight: 800, fontSize: '14px',
                                    cursor: (saving || testing) ? 'not-allowed' : 'pointer',
                                    opacity: (saving || testing) ? 0.7 : 1,
                                    boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                                    transition: 'all 0.2s',
                                }}>
                                <Save size={17} />
                                {saving ? 'Enregistrement...' : selectedId === 'new' ? 'Créer le compte' : 'Enregistrer les modifications'}
                            </button>
                        </div>
                    </form>
                </BlockCard>
            </div>
        </div>
    )
}
