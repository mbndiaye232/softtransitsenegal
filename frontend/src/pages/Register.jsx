import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    User,
    Mail,
    Lock,
    Building2,
    MapPin,
    Phone,
    ArrowRight,
    Globe,
    Info,
    ShieldCheck,
    Briefcase
} from 'lucide-react'

export default function Register() {
    const navigate = useNavigate()
    const { register } = useAuth()
    const [formData, setFormData] = useState({
        companyName: '',
        companyEmail: '',
        companyAddress: '',
        companyPhone: '',
        countryId: '',
        adminName: '',
        adminEmail: '',
        adminLogin: '',
        adminPassword: '',
        confirmPassword: ''
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (formData.adminPassword !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas')
            return
        }

        if (formData.adminPassword.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères')
            return
        }

        setLoading(true)
        try {
            const { confirmPassword, ...registerData } = formData
            await register(registerData)
            navigate('/dashboard')
        } catch (err) {
            setError(err.response?.data?.error || 'Échec de l\'inscription. Veuillez vérifier les informations.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="register-wrapper">
            <style>{`
                .register-wrapper { 
                    min-height: 100vh; 
                    display: flex; 
                    background: #f8fafc; 
                    font-family: 'Inter', sans-serif;
                    position: relative;
                }
                
                .reg-visual {
                    flex: 1;
                    background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: 4rem;
                    color: white;
                    position: sticky;
                    top: 0;
                    height: 100vh;
                }
                @media (max-width: 1024px) { .reg-visual { display: none; } }
                
                .visual-content { position: relative; z-index: 10; max-width: 480px; }
                .visual-content h2 { font-size: 2.75rem; font-weight: 900; line-height: 1.1; margin-bottom: 2rem; letter-spacing: -0.03em; }
                
                .steps-list { display: flex; flex-direction: column; gap: 2rem; }
                .step-item { display: flex; gap: 1.25rem; }
                .step-icon { width: 44px; height: 44px; background: rgba(255, 255, 255, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); flex-shrink: 0; }
                .step-text h4 { font-size: 1rem; font-weight: 700; margin: 0 0 0.25rem 0; }
                .step-text p { font-size: 0.875rem; opacity: 0.7; margin: 0; line-height: 1.5; }

                .reg-form-area {
                    flex: 1.2;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 4rem 2rem;
                }
                
                .reg-card {
                    width: 100%;
                    max-width: 680px;
                    background: white;
                    padding: 3.5rem;
                    border-radius: 2rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.05);
                    border: 1px solid #e2e8f0;
                }
                
                .form-header { margin-bottom: 3rem; }
                .form-header h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 0.75rem; letter-spacing: -0.02em; }
                .form-header p { color: #64748b; font-size: 1rem; font-weight: 500; }

                .section-tag { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.75rem; background: #eef2ff; color: #4f46e5; border-radius: 999px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; }
                
                .input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 2.5rem; }
                @media (max-width: 640px) { .input-grid { grid-template-columns: 1fr; } }
                
                .input-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .input-label { font-size: 0.8125rem; font-weight: 700; color: #475569; }
                
                .input-wrapper { position: relative; }
                .input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 18px; }
                .premium-input {
                    width: 100%;
                    padding: 0.75rem 1rem 0.75rem 2.75rem;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 0.875rem;
                    font-size: 0.9375rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    background: #fcfdfe;
                }
                .premium-input:focus { border-color: #4f46e5; background: white; outline: none; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }
                
                .submit-btn {
                    width: 100%;
                    padding: 1rem;
                    background: #4f46e5;
                    color: white;
                    border: none;
                    border-radius: 1rem;
                    font-size: 1rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    transition: all 0.2s;
                    box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.2);
                    margin-top: 1rem;
                }
                .submit-btn:hover { background: #4338ca; transform: translateY(-1px); }
                .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

                .alert { padding: 1rem 1.25rem; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 1rem; margin-bottom: 2.5rem; font-size: 0.875rem; font-weight: 600; display: flex; align-items: center; gap: 0.75rem; }
            `}</style>

            <div className="reg-visual">
                <div className="visual-content">
                    <div style={{ background: 'rgba(255,255,255,0.15)', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2.5rem', backdropFilter: 'blur(10px)' }}>
                        <Globe size={28} />
                    </div>
                    <h2>Rejoignez l'élite du Transit International.</h2>

                    <div className="steps-list">
                        <div className="step-item">
                            <div className="step-icon"><Building2 size={20} /></div>
                            <div className="step-text">
                                <h4>Identité de l'agence</h4>
                                <p>Configurez votre structure légale pour la facturation et les douanes.</p>
                            </div>
                        </div>
                        <div className="step-item">
                            <div className="step-icon"><ShieldCheck size={20} /></div>
                            <div className="step-text">
                                <h4>Contrôle d'accès</h4>
                                <p>Créez votre compte administrateur sécurisé et certifié.</p>
                            </div>
                        </div>
                        <div className="step-item">
                            <div className="step-icon"><Briefcase size={20} /></div>
                            <div className="step-text">
                                <h4>Prêt à l'emploi</h4>
                                <p>Accédez instantanément à vos outils de cotation et de gestion.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="reg-form-area">
                <div className="reg-card">
                    <header className="form-header">
                        <h1>Création de compte</h1>
                        <p>Configurez votre bureau de transit cloud en 2 minutes.</p>
                    </header>

                    {error && <div className="alert"><Info size={18} /> {error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="section-tag"><Building2 size={12} /> Structure Corporate</div>
                        <div className="input-grid">
                            <div className="input-group">
                                <label className="input-label">Raison Sociale *</label>
                                <div className="input-wrapper">
                                    <Building2 className="input-icon" />
                                    <input name="companyName" className="premium-input" value={formData.companyName} onChange={handleChange} placeholder="Nom de l'entreprise" required />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Email de contact *</label>
                                <div className="input-wrapper">
                                    <Mail className="input-icon" />
                                    <input type="email" name="companyEmail" className="premium-input" value={formData.companyEmail} onChange={handleChange} placeholder="contact@agence.com" required />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Adresse Siège</label>
                                <div className="input-wrapper">
                                    <MapPin className="input-icon" />
                                    <input name="companyAddress" className="premium-input" value={formData.companyAddress} onChange={handleChange} placeholder="Rue, Ville, Pays" />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Téléphone Fixe</label>
                                <div className="input-wrapper">
                                    <Phone className="input-icon" />
                                    <input name="companyPhone" className="premium-input" value={formData.companyPhone} onChange={handleChange} placeholder="+221 ..." />
                                </div>
                            </div>
                        </div>

                        <div className="section-tag"><Lock size={12} /> Administrateur Racine</div>
                        <div className="input-grid">
                            <div className="input-group">
                                <label className="input-label">Nom du gestionnaire *</label>
                                <div className="input-wrapper">
                                    <User className="input-icon" />
                                    <input name="adminName" className="premium-input" value={formData.adminName} onChange={handleChange} placeholder="Nom complet" required />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Identifiant de connexion *</label>
                                <div className="input-wrapper">
                                    <ShieldCheck className="input-icon" />
                                    <input name="adminLogin" className="premium-input" value={formData.adminLogin} onChange={handleChange} placeholder="Login unique" required />
                                </div>
                            </div>
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <label className="input-label">Email admin *</label>
                                <div className="input-wrapper">
                                    <Mail className="input-icon" />
                                    <input type="email" name="adminEmail" className="premium-input" value={formData.adminEmail} onChange={handleChange} placeholder="votre.email@pro.com" required />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Mot de passe *</label>
                                <div className="input-wrapper">
                                    <Lock className="input-icon" />
                                    <input type="password" name="adminPassword" className="premium-input" value={formData.adminPassword} onChange={handleChange} required />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Confirmation *</label>
                                <div className="input-wrapper">
                                    <Lock className="input-icon" />
                                    <input type="password" name="confirmPassword" className="premium-input" value={formData.confirmPassword} onChange={handleChange} required />
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? 'Initialisation de l\'environnement...' : 'Démarrer avec Soft Transit'}
                            {!loading && <ArrowRight size={20} />}
                        </button>
                    </form>

                    <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.9375rem', color: '#64748b', fontWeight: 500 }}>
                        Déjà inscrit ?
                        <Link to="/login" style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none', marginLeft: '0.5rem' }}>Se connecter</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
