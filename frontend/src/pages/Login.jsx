import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, Globe, Activity, Layers, Info } from 'lucide-react'
import logoSST from '../assets/icone-soft-transit.svg'

export default function Login() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [formData, setFormData] = useState({
        login: '',
        password: ''
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await login(formData)
            navigate('/dashboard')
        } catch (err) {
            setError(err.response?.data?.error || 'Identifiants invalides. Veuillez réessayer.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-wrapper">
            <style>{`
                .login-wrapper { 
                    min-height: 100vh; 
                    display: flex; 
                    background: #0f172a; 
                    font-family: 'Inter', sans-serif;
                    overflow: hidden;
                    position: relative;
                }
                
                /* Animated Background Elements */
                .bg-glow {
                    position: absolute;
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, rgba(79, 70, 229, 0) 70%);
                    border-radius: 50%;
                    z-index: 0;
                }
                .glow-1 { top: -200px; right: -200px; }
                .glow-2 { bottom: -200px; left: -200px; }

                /* Left Side - Visual/Marketing */
                .login-visual {
                    flex: 1.2;
                    background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: 4rem;
                    color: white;
                    position: relative;
                    overflow: hidden;
                }
                @media (max-width: 1024px) { .login-visual { display: none; } }
                
                .visual-content { position: relative; z-index: 10; max-width: 500px; }
                .visual-content h2 { font-size: 3rem; font-weight: 900; line-height: 1.1; margin-bottom: 2rem; letter-spacing: -0.03em; }
                .visual-content p { font-size: 1.125rem; opacity: 0.9; line-height: 1.6; margin-bottom: 3rem; }
                
                .feature-list { display: flex; flex-direction: column; gap: 1.5rem; }
                .feature-item { display: flex; align-items: center; gap: 1rem; }
                .feature-icon { background: rgba(255, 255, 255, 0.1); padding: 0.75rem; border-radius: 1rem; backdrop-filter: blur(8px); }
                .feature-text { font-weight: 600; font-size: 0.9375rem; }

                /* Right Side - Form */
                .login-form-area {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    position: relative;
                    z-index: 10;
                    background: #f8fafc;
                }
                
                .login-card {
                    width: 100%;
                    max-width: 440px;
                    background: white;
                    padding: 3rem;
                    border-radius: 2rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
                    border: 1px solid #e2e8f0;
                }
                
                .form-header { margin-bottom: 2.5rem; text-align: center; }
                .logo-area { width: 64px; height: 64px; background: #eef2ff; border-radius: 1.25rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #4f46e5; }
                .form-header h1 { font-size: 1.75rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
                .form-header p { color: #64748b; font-size: 0.9375rem; font-weight: 500; }

                .input-group { margin-bottom: 1.5rem; position: relative; }
                .input-label { display: block; font-size: 0.8125rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
                
                .input-wrapper { position: relative; }
                .input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 20px; }
                .premium-input {
                    width: 100%;
                    padding: 0.875rem 1rem 0.875rem 3rem;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 1rem;
                    font-size: 1rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    background: #fcfdfe;
                    color: #0f172a;
                }
                .premium-input:focus { border-color: #4f46e5; background: white; outline: none; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }
                
                .eye-btn { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.25rem; }
                .eye-btn:hover { color: #4f46e5; }

                .form-options { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; font-size: 0.875rem; }
                .forgot-link { color: #4f46e5; font-weight: 700; text-decoration: none; transition: color 0.2s; }
                .forgot-link:hover { color: #3730a3; }

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
                    box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
                }
                .submit-btn:hover { background: #4338ca; transform: translateY(-1px); box-shadow: 0 15px 20px -5px rgba(79, 70, 229, 0.4); }
                .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

                .alert { 
                    padding: 1rem; 
                    background: #fef2f2; 
                    color: #b91c1c; 
                    border: 1px solid #fecaca; 
                    border-radius: 1rem; 
                    margin-bottom: 2rem; 
                    font-size: 0.875rem; 
                    font-weight: 600; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                }

                .register-footer { margin-top: 2rem; text-align: center; font-size: 0.9375rem; color: #64748b; font-weight: 500; }
                .register-link { color: #4f46e5; font-weight: 700; text-decoration: none; margin-left: 0.25rem; }
            `}</style>

            <div className="login-visual">
                <div className="bg-glow glow-1"></div>
                <div className="bg-glow glow-2"></div>

                <div className="visual-content">
                    <div className="logo-area" style={{ margin: '0 0 2rem 0', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', padding: '1rem', borderRadius: '1rem' }}>
                        <img src={logoSST} alt="Soft Services Technologiques" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
                    </div>
                    <h2>Moins de paperasse, plus de transit.</h2>
                    <p>La plateforme SaaS dédiée aux transitaires pour gérer vos dossiers, déclarations douanières et cotations en temps réel.</p>

                    <div className="feature-list">
                        <div className="feature-item">
                            <div className="feature-icon"><ShieldCheck size={20} /></div>
                            <span className="feature-text">Sécurité Multi-locataire Certifiée</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon"><Activity size={20} /></div>
                            <span className="feature-text">Monitoring des Dossiers en Temps Réel</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon"><Layers size={20} /></div>
                            <span className="feature-text">Gestion des Cotations & Droits de Douane</span>
                        </div>
                    </div>
                </div>

                <div style={{ position: 'absolute', bottom: '3rem', left: '4rem', fontSize: '0.8125rem', opacity: 0.6, fontWeight: 500 }}>
                    © 2026 Soft Transit. Tous droits réservés.
                </div>
            </div>

            <div className="login-form-area">
                <div className="login-card">
                    <header className="form-header">
                        <div className="logo-area">
                            <Lock size={28} />
                        </div>
                        <h1>Bienvenue</h1>
                        <p>Accédez à votre espace professionnel</p>
                    </header>

                    {error && <div className="alert"><Info size={18} /> {error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="input-label">Identifiant ou Email</label>
                            <div className="input-wrapper">
                                <User className="input-icon" />
                                <input
                                    name="login"
                                    className="premium-input"
                                    value={formData.login}
                                    onChange={handleChange}
                                    placeholder="Ex: agent_01"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Mot de passe</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    className="premium-input"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    className="eye-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-options">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input type="checkbox" id="remember" style={{ width: '1rem', height: '1rem', accentColor: '#4f46e5' }} />
                                <label htmlFor="remember" style={{ color: '#64748b', fontWeight: 600, fontSize: '0.8125rem' }}>Se souvenir de moi</label>
                            </div>
                            <Link to="/forgot-password" size={20} className="forgot-link">Oublié ?</Link>
                        </div>

                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? 'Connexion sécurisée...' : 'Se connecter'}
                            {!loading && <ArrowRight size={20} />}
                        </button>
                    </form>

                    <div className="register-footer">
                        Nouveau sur la plateforme ?
                        <Link to="/register" className="register-link">Demander un accès</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}


