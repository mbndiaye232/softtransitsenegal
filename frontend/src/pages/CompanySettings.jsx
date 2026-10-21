import React, { useState, useEffect } from 'react'
import { structureAPI } from '../services/api'
import { useNavigate } from 'react-router-dom'
import {
    Settings,
    Building2,
    Globe,
    Mail,
    Phone,
    Smartphone,
    MapPin,
    Briefcase,
    CreditCard,
    FileText,
    ShieldCheck,
    Upload,
    Camera,
    ChevronLeft,
    Save,
    Image as ImageIcon,
    Info,
    CheckCircle2
} from 'lucide-react'

export default function CompanySettings() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [countries, setCountries] = useState([])
    const [selectedCountry, setSelectedCountry] = useState('')

    const [formData, setFormData] = useState({
        NomSociete: '',
        SigleNomCourt: '',
        adrSociete: '',
        Emailstructur: '',
        telSociete: '',
        celSociete: '',
        FormeJuridique: '',
        Capital: '',
        ActivitesPrincipales: '',
        CNumeroCompteBancaire: '',
        NINEASociete: '',
        RegistreCommerce: '',
        NumeroOrbus: '',
        IDPays: ''
    })

    const [files, setFiles] = useState({
        logo: null,
        cachet_facture: null,
        cachet_livraison: null,
        cachet_autre: null
    })

    const [previews, setPreviews] = useState({
        logo: null,
        cachet_facture: null,
        cachet_livraison: null,
        cachet_autre: null
    })

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [countriesRes, companyRes] = await Promise.all([
                structureAPI.getCountries(),
                structureAPI.getMe()
            ])

            setCountries(countriesRes.data)
            const data = companyRes.data

            setFormData({
                NomSociete: data.NomSociete || '',
                SigleNomCourt: data.SigleNomCourt || '',
                adrSociete: data.adrSociete || '',
                Emailstructur: data.Emailstructur || '',
                telSociete: data.telSociete || '',
                celSociete: data.celSociete || '',
                FormeJuridique: data.FormeJuridique || '',
                Capital: data.Capital || '',
                ActivitesPrincipales: data.ActivitesPrincipales || '',
                CNumeroCompteBancaire: data.CNumeroCompteBancaire || '',
                NINEASociete: data.NINEASociete || '',
                RegistreCommerce: data.RegistreCommerce || '',
                NumeroOrbus: data.NumeroOrbus || '',
                IDPays: data.IDPays || ''
            })

            if (data.IDPays) {
                const country = countriesRes.data.find(c => c.IDPays === data.IDPays)
                if (country) {
                    setSelectedCountry(country.NomPays)
                }
            }

            const baseUrl = import.meta.env.VITE_API_URL.replace('/api', '')
            setPreviews({
                logo: data.cheminlogo ? `${baseUrl}/${data.cheminlogo}` : null,
                cachet_facture: data.chemin_cachet_facture ? `${baseUrl}/${data.chemin_cachet_facture}` : null,
                cachet_livraison: data.chemin_cachet_livraison ? `${baseUrl}/${data.chemin_cachet_livraison}` : null,
                cachet_autre: data.chemin_cachet_autre ? `${baseUrl}/${data.chemin_cachet_autre}` : null
            })

        } catch (err) {
            setError('Impossible de charger les informations')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleCountryChange = (e) => {
        const value = e.target.value
        setSelectedCountry(value)
        const country = countries.find(c => c.NomPays === value)
        setFormData(prev => ({ ...prev, IDPays: country ? country.IDPays : '' }))
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        const name = e.target.name
        if (file) {
            setFiles({ ...files, [name]: file })
            const reader = new FileReader()
            reader.onloadend = () => {
                setPreviews({ ...previews, [name]: reader.result })
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')

        try {
            const data = new FormData()
            Object.keys(formData).forEach(key => data.append(key, formData[key]))
            Object.keys(files).forEach(key => {
                if (files[key]) data.append(key, files[key])
            })

            await structureAPI.updateMe(data)
            setSuccess('Configuration de la société mise à jour avec succès')
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors de la mise à jour des paramètres')
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
        <div className="settings-wrapper">
            <style>{`
                .settings-wrapper { min-height: 100vh; background: var(--bg); padding: 2.5rem; }
                .settings-container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; }
                
                .view-header { display: flex; justify-content: space-between; align-items: flex-end; }
                .title-area h1 { font-size: 1.75rem; font-weight: 800; color: var(--slate-900); display: flex; align-items: center; gap: 0.75rem; margin: 0; letter-spacing: -0.02em; }
                .title-area p { font-size: 0.875rem; color: var(--slate-500); margin: 0.25rem 0 0 0; font-weight: 500; }
                
                .back-btn { display: flex; align-items: center; gap: 0.5rem; color: var(--slate-500); text-decoration: none; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; background: none; margin-bottom: 0.5rem; transition: color 0.2s; }
                .back-btn:hover { color: var(--primary); }

                .form-main { display: grid; grid-template-columns: 350px 1fr; gap: 2rem; align-items: start; }
                @media (max-width: 1024px) { .form-main { grid-template-columns: 1fr; } }
                
                .sticky-sidebar { position: sticky; top: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
                
                .card { background: white; border-radius: var(--radius-xl); border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; }
                .card-header { padding: 1.25rem 1.5rem; background: var(--slate-50); border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 0.75rem; }
                .card-header h2 { font-size: 0.75rem; font-weight: 800; color: var(--slate-400); text-transform: uppercase; letter-spacing: 0.1em; margin: 0; }
                
                .card-body { padding: 1.5rem; }
                
                .upload-zone { text-align: center; margin-bottom: 2rem; }
                .logo-preview-box { width: 100%; aspect-ratio: 3/2; background: var(--slate-50); border: 2px dashed var(--border); border-radius: var(--radius-lg); display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; transition: all 0.2s; cursor: pointer; }
                .logo-preview-box:hover { border-color: var(--primary); background: var(--primary-light); }
                .logo-preview-box img { max-width: 100%; max-height: 100%; object-fit: contain; padding: 1rem; }
                .upload-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15, 23, 42, 0.7); color: white; padding: 0.5rem; font-weight: 700; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.375rem; transform: translateY(100%); transition: transform 0.2s; }
                .logo-preview-box:hover .upload-overlay { transform: translateY(0); }
                
                .stamp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .stamp-box { aspect-ratio: 1; border: 1px solid var(--border); border-radius: var(--radius-md); background: white; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; }
                .stamp-box:hover { border-color: var(--primary); }
                .stamp-box img { width: 80%; height: 80%; object-fit: contain; }
                .stamp-box .mini-plus { position: absolute; right: 0.5rem; bottom: 0.5rem; background: var(--primary); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

                .form-section { margin-bottom: 3rem; }
                .section-title { font-size: 0.75rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--slate-100); }
                
                .grid-form { display: grid; grid-template-columns: repeat(12, 1fr); gap: 1.25rem; }
                .col-12 { grid-column: span 12; }
                .col-6 { grid-column: span 6; }
                .col-4 { grid-column: span 4; }
                .col-8 { grid-column: span 8; }
                
                .input-group { display: flex; flex-direction: column; gap: 0.375rem; }
                .input-label { font-size: 0.75rem; font-weight: 700; color: var(--slate-600); }
                .premium-input, .premium-select { 
                    width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.875rem; outline: none; background: var(--slate-50); transition: all 0.2s; 
                }
                .premium-input:focus, .premium-select:focus { border-color: var(--primary); background: white; box-shadow: 0 0 0 4px var(--primary-light); }
                
                .save-bar { margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem; padding: 2rem; background: var(--slate-50); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); }
                .btn { padding: 0.75rem 2rem; border-radius: var(--radius-md); font-weight: 700; font-size: 0.875rem; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
                .btn-primary { background: var(--primary); color: white; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
                .btn-primary:hover { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 6px 12px -2px rgba(37, 99, 235, 0.3); }

                .alert { padding: 1rem 1.5rem; border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 600; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; }
                .alert-error { background: #fef2f2; color: var(--danger); border: 1px solid #fee2e2; }
                .alert-success { background: #ecfdf5; color: var(--success); border: 1px solid #d1fae5; }
            `}</style>

            <div className="settings-container">
                <header className="view-header">
                    <div className="title-area">
                        <button className="back-btn" onClick={() => navigate('/dashboard')}>
                            <ChevronLeft size={14} /> Tableau de bord
                        </button>
                        <h1>
                            <Settings size={32} color="var(--primary)" />
                            Configuration Système
                        </h1>
                        <p>Gérez l'identité visuelle et les informations légales de votre structure.</p>
                    </div>
                </header>

                {error && <div className="alert alert-error"><Info size={16} />{error}</div>}
                {success && <div className="alert alert-success"><CheckCircle2 size={16} />{success}</div>}

                <form onSubmit={handleSubmit} className="form-main">
                    <aside className="sticky-sidebar">
                        <div className="card">
                            <div className="card-header">
                                <ImageIcon size={14} />
                                <h2>Identité Visuelle</h2>
                            </div>
                            <div className="card-body">
                                <div className="upload-zone">
                                    <label className="input-label" style={{ marginBottom: '1rem', display: 'block' }}>LOGO CORPORATE</label>
                                    <div className="logo-preview-box" onClick={() => document.getElementById('logo-upload').click()}>
                                        {previews.logo ? <img src={previews.logo} alt="Logo" /> : <Building2 size={48} opacity={0.1} />}
                                        <div className="upload-overlay">
                                            <Camera size={14} /> Remplacer le logo
                                        </div>
                                    </div>
                                    <input id="logo-upload" type="file" name="logo" hidden onChange={handleFileChange} accept="image/*" />
                                </div>

                                <label className="input-label" style={{ marginBottom: '1rem', display: 'block' }}>CACHETS OFFICIELS</label>
                                <div className="stamp-grid">
                                    <div className="stamp-box" onClick={() => document.getElementById('facture-upload').click()}>
                                        {previews.cachet_facture ? <img src={previews.cachet_facture} alt="Facture" /> : <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', fontWeight: 800 }}>FACTURE</div>}
                                        <div className="mini-plus"><Upload size={10} /></div>
                                    </div>
                                    <div className="stamp-box" onClick={() => document.getElementById('exploitation-upload').click()}>
                                        {previews.cachet_livraison ? <img src={previews.cachet_livraison} alt="Exploitation" /> : <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', fontWeight: 800 }}>EXP.</div>}
                                        <div className="mini-plus"><Upload size={10} /></div>
                                    </div>
                                </div>
                                <input id="facture-upload" type="file" name="cachet_facture" hidden onChange={handleFileChange} accept="image/*" />
                                <input id="exploitation-upload" type="file" name="cachet_livraison" hidden onChange={handleFileChange} accept="image/*" />

                                <p style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '1.5rem', fontStyle: 'italic' }}>
                                    * Formats recommandés : PNG ou SVG transparent. Max 2Mo.
                                </p>
                            </div>
                        </div>

                        <div className="card" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
                            <div className="card-body" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <ShieldCheck size={24} />
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.8125rem' }}>Environnement Sécurisé</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Toutes vos données sont chiffrées en transit.</div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <div className="main-content">
                        <div className="card">
                            <div className="card-header">
                                <FileText size={14} />
                                <h2>Fiche Signalétique du Titulaire</h2>
                            </div>
                            <div className="card-body">
                                <div className="form-section">
                                    <div className="section-title">Informations Publiques</div>
                                    <div className="grid-form">
                                        <div className="input-group col-8">
                                            <label className="input-label">Raison Sociale Complète *</label>
                                            <input name="NomSociete" className="premium-input" value={formData.NomSociete} onChange={handleChange} required />
                                        </div>
                                        <div className="input-group col-4">
                                            <label className="input-label">Acronyme / Sigle</label>
                                            <input name="SigleNomCourt" className="premium-input" value={formData.SigleNomCourt} onChange={handleChange} placeholder="Ex: STS Ltd" />
                                        </div>
                                        <div className="input-group col-12">
                                            <label className="input-label">Siège Social (Adresse physique)</label>
                                            <div style={{ position: 'relative' }}>
                                                <MapPin size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                                                <input name="adrSociete" className="premium-input" style={{ paddingLeft: '2.75rem' }} value={formData.adrSociete} onChange={handleChange} />
                                            </div>
                                        </div>
                                        <div className="input-group col-4">
                                            <label className="input-label">Pays de Récidence</label>
                                            <select className="premium-select" value={selectedCountry} onChange={handleCountryChange}>
                                                <option value="">Sélectionner...</option>
                                                {countries.map(c => <option key={c.IDPays} value={c.NomPays}>{c.NomPays}</option>)}
                                            </select>
                                        </div>
                                        <div className="input-group col-8">
                                            <label className="input-label">Email Professionnel Cloud</label>
                                            <div style={{ position: 'relative' }}>
                                                <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                                                <input type="email" name="Emailstructur" className="premium-input" style={{ paddingLeft: '2.75rem' }} value={formData.Emailstructur} onChange={handleChange} />
                                            </div>
                                        </div>
                                        <div className="input-group col-6">
                                            <label className="input-label">Standard Téléphonique</label>
                                            <div style={{ position: 'relative' }}>
                                                <Phone size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                                                <input name="telSociete" className="premium-input" style={{ paddingLeft: '2.75rem' }} value={formData.telSociete} onChange={handleChange} />
                                            </div>
                                        </div>
                                        <div className="input-group col-6">
                                            <label className="input-label">Ligne Directe Manager</label>
                                            <div style={{ position: 'relative' }}>
                                                <Smartphone size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                                                <input name="celSociete" className="premium-input" style={{ paddingLeft: '2.75rem' }} value={formData.celSociete} onChange={handleChange} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <div className="section-title">Données Juridiques & Fiscales</div>
                                    <div className="grid-form">
                                        <div className="input-group col-6">
                                            <label className="input-label">Forme Juridique</label>
                                            <input name="FormeJuridique" className="premium-input" value={formData.FormeJuridique} onChange={handleChange} placeholder="Ex: SARL, SA..." />
                                        </div>
                                        <div className="input-group col-6">
                                            <label className="input-label">Capital Social (Devise incluse)</label>
                                            <input name="Capital" className="premium-input" value={formData.Capital} onChange={handleChange} placeholder="Ex: 10 000 000 F CFA" />
                                        </div>
                                        <div className="input-group col-12">
                                            <label className="input-label">Activités Principales</label>
                                            <input name="ActivitesPrincipales" className="premium-input" value={formData.ActivitesPrincipales} onChange={handleChange} placeholder="Transit, Logistique, Transport..." />
                                        </div>
                                        <div className="input-group col-4">
                                            <label className="input-label">NINEA / ID Fiscal</label>
                                            <input name="NINEASociete" className="premium-input" value={formData.NINEASociete} onChange={handleChange} />
                                        </div>
                                        <div className="input-group col-4">
                                            <label className="input-label">Registre de Commerce</label>
                                            <input name="RegistreCommerce" className="premium-input" value={formData.RegistreCommerce} onChange={handleChange} />
                                        </div>
                                        <div className="input-group col-4">
                                            <label className="input-label">Numéro Orbus / GAINDE</label>
                                            <input name="NumeroOrbus" className="premium-input" value={formData.NumeroOrbus} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section" style={{ marginBottom: 0 }}>
                                    <div className="section-title">Coordonnées Bancaires</div>
                                    <div className="grid-form">
                                        <div className="input-group col-12">
                                            <label className="input-label">IBAN / Numéro de Compte Unique</label>
                                            <div style={{ position: 'relative' }}>
                                                <CreditCard size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                                                <input name="CNumeroCompteBancaire" className="premium-input" style={{ paddingLeft: '2.75rem' }} value={formData.CNumeroCompteBancaire} onChange={handleChange} placeholder="RIB ou IBAN pour les factures" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="save-bar">
                            <button type="button" onClick={() => navigate('/dashboard')} className="btn" style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--slate-600)' }}>
                                Annuler
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <Save size={18} />
                                {saving ? 'Traitement...' : 'Sauvegarder les Paramètres'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
