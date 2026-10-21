import React, { useState, useEffect } from 'react'
import { getReferenceSymbol } from '../utils/currency'
import { useNavigate, useParams } from 'react-router-dom'
import { clientsAPI, statutsAPI, rubriquesAPI } from '../services/api'
import {
    Save,
    X,
    Building2,
    Mail,
    Phone,
    MapPin,
    User,
    Shield,
    CreditCard,
    Percent,
    Calendar,
    FileText,
    CheckCircle,
    Building,
    UserCircle,
    Info,
    ChevronLeft,
    DollarSign,
    Zap,
    Wallet
} from 'lucide-react'

export default function ClientForm() {
    const navigate = useNavigate()
    const { id } = useParams()
    const isEdit = !!id

    const [loading, setLoading] = useState(isEdit)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [statuts, setStatuts] = useState([])
    const [deboursRubriques, setDeboursRubriques] = useState([]) // rubriques 11xx
    const [commissionRubriques, setCommissionRubriques] = useState([]) // IDRubriques cochées
    const [rubriqueSearch, setRubriqueSearch] = useState('')

    // Form Data
    const [formData, setFormData] = useState({
        NomRS: '',
        NINEA: '',
        adresseClient: '',
        TelClient: '',
        EmailClient: '',
        CelClient: '', // Tel 2
        faxClient: '',
        IDStatuts: '',
        EncoursAutorise: '0',
        DelaiReglement: '30',
        DelaiReglementDouane: '15',
        TauxRemise: '0.00',
        AssuranceCredit: '0',
        ExonereTVA: false,
        NumExoneration: '', // Lettre Exo
        CodeClient: '',
        NumCompteSAARI: '',
        PersonneContact: '',
        TelPersonneContact: '',
        EmailPersonneContact: '',
        FactureDouaneAvecCommissionEtTVA: false,
        Observations: '',
        TauxCommissionDDouane: '0.00',
        TauxCommissionDebours: '0.00',
        sappliqueTousDebours: true, // par défaut, la commission porte sur l'ensemble des débours (11xx)
        Alerte_Suspension: false
    })

    const [file, setFile] = useState(null)
    const [filePreview, setFilePreview] = useState(null)
    const [compte, setCompte] = useState(null) // { solde, credit, debit } — null si compte pas encore créé

    useEffect(() => {
        if (isEdit) {
            loadClient()
        }
        loadStatuts()
        loadDeboursRubriques()
    }, [id])

    const loadStatuts = async () => {
        try {
            const response = await statutsAPI.getAll()
            setStatuts(response.data)
        } catch (err) {
            console.error('Erreur chargement statuts:', err)
        }
    }

    const loadDeboursRubriques = async () => {
        try {
            const response = await rubriquesAPI.getAll()
            const debours = (response.data || []).filter(r => String(r.CodeRubrique || '').startsWith('11'))
            setDeboursRubriques(debours)
        } catch (err) {
            console.error('Erreur chargement rubriques débours:', err)
        }
    }

    const toggleCommissionRubrique = (idRubrique) => {
        setCommissionRubriques(prev =>
            prev.includes(idRubrique) ? prev.filter(x => x !== idRubrique) : [...prev, idRubrique]
        )
    }

    const loadClient = async () => {
        try {
            const response = await clientsAPI.getOne(id)
            const data = response.data

            setFormData({
                NomRS: data.NomRS || '',
                NINEA: data.NINEA || '',
                adresseClient: data.adresseClient || '',
                TelClient: data.TelClient || '',
                EmailClient: data.EmailClient || '',
                CelClient: data.CelClient || '',
                faxClient: data.faxClient || '',
                IDStatuts: data.IDStatuts || '',
                EncoursAutorise: data.EncoursAutorise || '0',
                DelaiReglement: data.DelaiReglement != null ? String(data.DelaiReglement) : '30',
                DelaiReglementDouane: data.DelaiReglementDouane != null ? String(data.DelaiReglementDouane) : '15',
                TauxRemise: data.TauxRemise || '0.00',
                AssuranceCredit: data.AssuranceCredit || '0',
                ExonereTVA: !!data.ExonereTVA,
                NumExoneration: data.NumExoneration || '',
                CodeClient: data.CodeClient || '',
                NumCompteSAARI: data.NumCompteSAARI || '',
                PersonneContact: data.PersonneContact || '',
                TelPersonneContact: data.TelPersonneContact || '',
                EmailPersonneContact: data.EmailPersonneContact || '',
                FactureDouaneAvecCommissionEtTVA: !!data.FactureDouaneAvecCommissionEtTVA,
                Observations: data.Observations || '',
                TauxCommissionDDouane: data.TauxCommissionDDouane || '0.00',
                TauxCommissionDebours: data.TauxCommissionDebours || '0.00',
                sappliqueTousDebours: !!data.sappliqueTousDebours,
                Alerte_Suspension: !!data.Alerte_Suspension
            })

            setCommissionRubriques(Array.isArray(data.commissionRubriques) ? data.commissionRubriques : [])

            if (data.CheminLettreEXO) {
                const baseUrl = import.meta.env.VITE_API_URL.replace('/api', '')
                setFilePreview(`${baseUrl}/${data.CheminLettreEXO}`)
            }

            if (data.IDComptesClients) {
                setCompte({
                    solde: parseFloat(data.SoldeCompteClient) || 0,
                    credit: parseFloat(data.TotalCredit) || 0,
                    debit: parseFloat(data.TotalDebit) || 0
                })
            }

        } catch (err) {
            setError('Impossible de charger le client')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0]
        if (selectedFile) {
            setFile(selectedFile)
            setFilePreview(URL.createObjectURL(selectedFile))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        let dataToSend = { ...formData }
        if (formData.ExonereTVA && !file && !filePreview) {
            if (!window.confirm("Si vous n'associez pas de lettre d'exonération au client, le système va considérer qu'il ne bénéficie pas d'exonération.\nVoulez-vous continuer ?")) {
                return
            }
            dataToSend.ExonereTVA = false
        }

        setSaving(true)

        try {
            const formDataObj = new FormData()
            Object.keys(dataToSend).forEach(key => {
                formDataObj.append(key, dataToSend[key])
            })

            if (file) {
                formDataObj.append('CheminLettreEXO', file)
            }

            // Rubriques sur lesquelles s'applique la commission débours
            // (ignoré côté backend si « Sur tous les débours » est coché)
            formDataObj.append('commissionRubriques', JSON.stringify(formData.sappliqueTousDebours ? [] : commissionRubriques))

            if (isEdit) {
                await clientsAPI.update(id, formDataObj)
                setSuccess('Client modifié avec succès')
                setTimeout(() => navigate('/clients'), 1500)
            } else {
                await clientsAPI.create(formDataObj)
                setSuccess('Client créé avec succès')
                setTimeout(() => navigate('/clients'), 1500)
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors de l\'enregistrement')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <div className="view-loading">
            <div className="spinner"></div>
            <style>{`
                .view-loading { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: var(--bg); }
                .spinner { width: 40px; height: 40px; border: 3px solid var(--slate-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <style>{`
                .form-main { background: white; border-radius: 20px; border: 1px solid #e5e7eb; box-shadow: 0 8px 32px rgba(0,0,0,.08); overflow: hidden; }
                .form-strip { padding: 1rem 2.5rem; background: #f8fafc; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
                .form-strip h2 { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin: 0; }

                .form-body { padding: 2.5rem; }
                .form-section { margin-bottom: 3rem; }
                .form-section:last-child { margin-bottom: 0; }
                .section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 2px solid #f1f5f9; }
                .section-title { font-size: 0.7rem; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.1em; }

                .grid-form { display: grid; grid-template-columns: repeat(12, 1fr); gap: 1.5rem; }
                .col-3 { grid-column: span 3; }
                .col-4 { grid-column: span 4; }
                .col-6 { grid-column: span 6; }
                .col-8 { grid-column: span 8; }
                .col-12 { grid-column: span 12; }
                @media (max-width: 768px) { .col-3, .col-4, .col-6, .col-8 { grid-column: span 12; } }

                .input-group { display: flex; flex-direction: column; gap: 0.4rem; }
                .input-label { font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .04em; }
                .premium-input, .premium-select, .premium-textarea {
                    width: 100%; box-sizing: border-box;
                    padding: 0.7rem 0.9rem;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 0.875rem;
                    outline: none;
                    background: #f9fafb;
                    transition: all 0.2s;
                    color: #1e293b;
                }
                .premium-input:focus, .premium-select:focus, .premium-textarea:focus { border-color: #6366f1; background: white; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }

                .checkbox-group { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.65rem 0.875rem; border-radius: 10px; transition: all 0.2s; }
                .checkbox-group:hover { background: #f1f5f9; }
                .checkbox-group input { width: 1.1rem; height: 1.1rem; accent-color: #4f46e5; }
                .checkbox-label { font-size: 0.875rem; font-weight: 600; color: #334155; }

                .form-footer { padding: 1.25rem 2.5rem; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 1rem; }
                .btn { padding: 0.7rem 1.75rem; border-radius: 10px; font-weight: 700; font-size: 0.875rem; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
                .btn-secondary { background: white; color: #475569; border: 1.5px solid #e2e8f0; }
                .btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
                .btn-primary { background: linear-gradient(135deg,#4338ca,#6366f1); color: white; box-shadow: 0 4px 12px rgba(99,102,241,.3); }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99,102,241,.35); }
                .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

                .alert { padding: 1rem 1.5rem; border-radius: 12px; font-size: 0.875rem; font-weight: 600; margin-bottom: 0; display: flex; align-items: center; gap: 0.75rem; }
                .alert-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
                .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
            `}</style>

            {/* ── HERO HEADER ── */}
            <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4f46e5 100%)',
                padding: '2rem 2.5rem 3.5rem',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
                <div style={{ position: 'absolute', bottom: '-50px', right: '20%', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />

                <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative' }}>
                    <button onClick={() => navigate('/clients')} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.25)',
                        background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.8)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16,
                    }}>
                        <ChevronLeft size={14} /> Clients
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '13px', background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building2 size={24} color="white" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-.03em' }}>
                                {isEdit ? 'Modifier le Client' : 'Nouveau Client Partenaire'}
                            </h1>
                            <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '13px', margin: '4px 0 0' }}>
                                {isEdit ? 'Modification de la fiche client' : 'Création d\'une nouvelle fiche client'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2.5rem 3rem', marginTop: '-1.5rem' }}>

                {isEdit && compte && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                        background: 'white', border: '1px solid #e5e7eb', borderRadius: 14,
                        padding: '16px 20px', marginBottom: 16,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: compte.solde > 0 ? '#f0fdf4' : '#f9fafb',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <Wallet size={20} color={compte.solde > 0 ? '#16a34a' : '#9ca3af'} />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Solde du compte client</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: compte.solde > 0 ? '#16a34a' : '#111827' }}>
                                    {compte.solde.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af' }}>{getReferenceSymbol()}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate(`/reglements/cancellation?clientId=${id}&tab=movements`)}
                            style={{
                                padding: '8px 16px', borderRadius: 10, border: '1px solid #e5e7eb',
                                background: '#f9fafb', color: '#374151', fontSize: 13, fontWeight: 700,
                                cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                        >
                            Voir les mouvements du compte
                        </button>
                    </div>
                )}

                {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><Info size={16} />{error}</div>}
                {success && <div className="alert alert-success" style={{ marginBottom: 16 }}><CheckCircle size={16} />{success}</div>}

                <form className="form-main" onSubmit={handleSubmit}>
                    <div className="form-strip">
                        <h2>Fiche d'identification client</h2>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--slate-200)' }}></div>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--slate-200)' }}></div>
                        </div>
                    </div>

                    <div className="form-body">
                        {/* Identité */}
                        <div className="form-section">
                            <div className="section-header">
                                <Building2 size={14} />
                                <span className="section-title">Informations Générales</span>
                            </div>
                            <div className="grid-form">
                                <div className="input-group col-8">
                                    <label className="input-label">Raison Sociale / Nom *</label>
                                    <input name="NomRS" className="premium-input" value={formData.NomRS} onChange={handleChange} required placeholder="Ex: IMPORT-EXPORT SARL" />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">NINEA</label>
                                    <input name="NINEA" className="premium-input" value={formData.NINEA} onChange={handleChange} placeholder="Numéro d'identification fiscale" />
                                </div>
                                <div className="input-group col-8">
                                    <label className="input-label">Adresse Physique</label>
                                    <input name="adresseClient" className="premium-input" value={formData.adresseClient} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Statut Client *</label>
                                    <select name="IDStatuts" className="premium-select" value={formData.IDStatuts} onChange={handleChange} required>
                                        <option value="">Sélectionner un statut</option>
                                        {statuts.map(s => <option key={s.IDStatuts} value={s.IDStatuts}>{s.libelle}</option>)}
                                    </select>
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Téléphone 1</label>
                                    <input name="TelClient" className="premium-input" value={formData.TelClient} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Téléphone 2 (Mobile)</label>
                                    <input name="CelClient" className="premium-input" value={formData.CelClient} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Email de l'entreprise</label>
                                    <input type="email" name="EmailClient" className="premium-input" value={formData.EmailClient} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        {/* Financier */}
                        <div className="form-section">
                            <div className="section-header">
                                <DollarSign size={14} />
                                <span className="section-title">Paramètres Financiers</span>
                            </div>
                            <div className="grid-form">
                                <div className="input-group col-4">
                                    <label className="input-label">Encours Autorisé ({getReferenceSymbol()})</label>
                                    <input type="number" name="EncoursAutorise" className="premium-input" value={formData.EncoursAutorise} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Délai Règlement (Jours) <span style={{color:'#ef4444'}}>*</span></label>
                                    <input type="number" name="DelaiReglement" className="premium-input" value={formData.DelaiReglement} onChange={handleChange} required min="0" placeholder="30" />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Délai Douane (Jours) <span style={{color:'#ef4444'}}>*</span></label>
                                    <input type="number" name="DelaiReglementDouane" className="premium-input" value={formData.DelaiReglementDouane} onChange={handleChange} required min="0" placeholder="15" />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Taux Remise (%)</label>
                                    <input type="number" step="0.01" name="TauxRemise" className="premium-input" value={formData.TauxRemise} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Commission Douane (%)</label>
                                    <input type="number" step="0.01" name="TauxCommissionDDouane" className="premium-input" value={formData.TauxCommissionDDouane} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Commission Débours (%)</label>
                                    <input type="number" step="0.01" name="TauxCommissionDebours" className="premium-input" value={formData.TauxCommissionDebours} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="checkbox-group">
                                        <input type="checkbox" name="FactureDouaneAvecCommissionEtTVA" checked={formData.FactureDouaneAvecCommissionEtTVA} onChange={handleChange} />
                                        <span className="checkbox-label">Douane avec Comm. & TVA</span>
                                    </label>
                                </div>
                                <div className="input-group col-4">
                                    <label className="checkbox-group">
                                        <input type="checkbox" name="sappliqueTousDebours" checked={formData.sappliqueTousDebours} onChange={handleChange} />
                                        <span className="checkbox-label">Sur tous les débours</span>
                                    </label>
                                </div>
                                <div className="input-group col-4">
                                    <label className="checkbox-group" style={{ border: '1px solid #e0e7ff', borderRadius: 8, padding: '0.6rem 0.875rem', background: formData.Alerte_Suspension ? '#eef2ff' : 'transparent' }}>
                                        <input type="checkbox" name="Alerte_Suspension" checked={formData.Alerte_Suspension} onChange={handleChange} />
                                        <span className="checkbox-label" style={{ color: '#4338ca' }}>🔔 Alertes échéances suspensifs</span>
                                    </label>
                                </div>

                                {/* Sélection des rubriques de débours — visible si « Sur tous les débours » est décochée */}
                                {!formData.sappliqueTousDebours && (
                                    <div className="col-12" style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.25rem', background: '#f9fafb' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                                                Rubriques débours (commission appliquée) — {commissionRubriques.length} sélectionnée(s)
                                            </span>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                                    onClick={() => setCommissionRubriques(deboursRubriques.map(r => r.IDRubriques))}>Tout cocher</button>
                                                <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                                    onClick={() => setCommissionRubriques([])}>Tout décocher</button>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            className="premium-input"
                                            placeholder="🔍 Rechercher une rubrique (code ou libellé)…"
                                            value={rubriqueSearch}
                                            onChange={(e) => setRubriqueSearch(e.target.value)}
                                            style={{ marginBottom: '0.75rem' }}
                                        />
                                        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.25rem' }}>
                                            {deboursRubriques
                                                .filter(r => {
                                                    const q = rubriqueSearch.toLowerCase()
                                                    return !q || String(r.CodeRubrique).toLowerCase().includes(q) || String(r.libelleRubrique || '').toLowerCase().includes(q)
                                                })
                                                .map(r => (
                                                    <label key={r.IDRubriques} className="checkbox-group" style={{ padding: '0.4rem 0.6rem' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={commissionRubriques.includes(r.IDRubriques)}
                                                            onChange={() => toggleCommissionRubrique(r.IDRubriques)}
                                                        />
                                                        <span className="checkbox-label" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                                                            <strong>{r.CodeRubrique}</strong> — {r.libelleRubrique}
                                                        </span>
                                                    </label>
                                                ))}
                                            {deboursRubriques.length === 0 && (
                                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Aucune rubrique de débours (11xx) trouvée.</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Exonération & Codes */}
                        <div className="form-section">
                            <div className="section-header">
                                <Shield size={14} />
                                <span className="section-title">Exonération & Comptabilité</span>
                            </div>
                            <div className="grid-form">
                                <div className="input-group col-4">
                                    <label className="input-label">Exonéré de TVA ?</label>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                        <label className="checkbox-group" style={{ padding: '0.4rem 0.8rem', border: `1px solid ${formData.ExonereTVA ? 'var(--primary)' : 'var(--border)'}`, background: formData.ExonereTVA ? 'var(--primary-light)' : 'transparent' }}>
                                            <input type="radio" name="ExonereTVA" checked={formData.ExonereTVA === true} onChange={() => setFormData(prev => ({ ...prev, ExonereTVA: true }))} />
                                            <span className="checkbox-label">Oui</span>
                                        </label>
                                        <label className="checkbox-group" style={{ padding: '0.4rem 0.8rem', border: `1px solid ${!formData.ExonereTVA ? 'var(--slate-400)' : 'var(--border)'}`, background: !formData.ExonereTVA ? 'var(--slate-50)' : 'transparent' }}>
                                            <input type="radio" name="ExonereTVA" checked={formData.ExonereTVA === false} onChange={() => setFormData(prev => ({ ...prev, ExonereTVA: false }))} />
                                            <span className="checkbox-label">Non</span>
                                        </label>
                                    </div>
                                </div>
                                {formData.ExonereTVA && (
                                    <div className="input-group col-8">
                                        <label className="input-label">Lettre d'Exonération (Pièce Jointe)</label>
                                        <input type="file" onChange={handleFileChange} className="premium-input" style={{ padding: '0.5rem' }} />
                                        {filePreview && (
                                            <a href={filePreview} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                                                <FileText size={12} /> Voir le document actuel
                                            </a>
                                        )}
                                    </div>
                                )}
                                <div className="input-group col-4">
                                    <label className="input-label">Numéro Lettre Exo</label>
                                    <input name="NumExoneration" className="premium-input" value={formData.NumExoneration} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Code Client (Interne)</label>
                                    <input name="CodeClient" className="premium-input" value={formData.CodeClient} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">N° Compte SAARI</label>
                                    <input name="NumCompteSAARI" className="premium-input" value={formData.NumCompteSAARI} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="form-section">
                            <div className="section-header">
                                <UserCircle size={14} />
                                <span className="section-title">Point Focal de Contact</span>
                            </div>
                            <div className="grid-form">
                                <div className="input-group col-4">
                                    <label className="input-label">Nom Complet</label>
                                    <input name="PersonneContact" className="premium-input" value={formData.PersonneContact} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Téléphone Direct</label>
                                    <input name="TelPersonneContact" className="premium-input" value={formData.TelPersonneContact} onChange={handleChange} />
                                </div>
                                <div className="input-group col-4">
                                    <label className="input-label">Email Direct</label>
                                    <input type="email" name="EmailPersonneContact" className="premium-input" value={formData.EmailPersonneContact} onChange={handleChange} />
                                </div>
                                <div className="input-group col-12">
                                    <label className="input-label">Observations / Notes Particulières</label>
                                    <textarea name="Observations" className="premium-textarea" rows="4" value={formData.Observations} onChange={handleChange} placeholder="Spécificités client, instructions de livraison, etc." />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-footer">
                        <button type="button" onClick={() => navigate('/clients')} className="btn btn-secondary">Annuler</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={18} />
                            {saving ? 'Enregistrement...' : 'Valider le dossier client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

