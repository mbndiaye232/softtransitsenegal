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
                    background: radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, rgba(37, 99, 235, 0) 70%);
                    border-radius: 50%;
                    z-index: 0;
                }
                .glow-1 { top: -200px; right: -200px; }
                .glow-2 { bottom: -200px; left: -200px; }

                /* Left Side - Visual/Marketing */
                .login-visual {
                    flex: 1.2;
                    background: var(--hero-gradient);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: 4rem;
                    color: white;
                    position: relative;
                    overflow: hidden;
                }
                @media (max-width: 1024px) { .login-visual { display: none; } }
                
                .login-visual::before {
                    content: ''; position: absolute; inset: 0; pointer-events: none;
                    background-image: linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
                    background-size: 48px 48px;
                    -webkit-mask-image: radial-gradient(ellipse at 30% 40%, black 20%, transparent 75%);
                    mask-image: radial-gradient(ellipse at 30% 40%, black 20%, transparent 75%);
                }
                .brand-chip { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 1rem; border-radius: 999px; margin: 0.5rem 0 1.75rem;
                    background: rgba(37, 99, 235, 0.16); border: 1px solid rgba(96, 165, 250, 0.4); color: #93c5fd;
                    font-size: 0.75rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
                .visual-content { position: relative; z-index: 10; max-width: 540px; }
                .visual-content h2 { font-size: 3.25rem; font-weight: 900; line-height: 1.06; margin-bottom: 1.75rem; letter-spacing: -0.035em; }
                .visual-content h2 .accent { color: #60a5fa; }
                .visual-content p { font-size: 1.125rem; color: rgba(226, 232, 240, 0.82); line-height: 1.65; margin-bottom: 3rem; }
                
                .feature-list { display: flex; flex-direction: column; gap: 1.5rem; }
                .feature-item { display: flex; align-items: center; gap: 1rem; }
                .feature-icon { background: rgba(37, 99, 235, 0.22); border: 1px solid rgba(147, 197, 253, 0.25); color: #bfdbfe; padding: 0.75rem; border-radius: 0.875rem; backdrop-filter: blur(8px); }
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
                    background: linear-gradient(180deg, #f8fafc 0%, #eef3fb 100%);
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
                .logo-area { width: 64px; height: 64px; background: #eff6ff; border-radius: 1.25rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #2563eb; }
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
                .premium-input:focus { border-color: #2563eb; background: white; outline: none; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
                
                .eye-btn { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.25rem; }
                .eye-btn:hover { color: #2563eb; }

                .form-options { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; font-size: 0.875rem; }
                .forgot-link { color: #2563eb; font-weight: 700; text-decoration: none; transition: color 0.2s; }
                .forgot-link:hover { color: #1e40af; }

                .submit-btn {
                    width: 100%;
                    padding: 1rem;
                    background: #2563eb;
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
                    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
                }
                .submit-btn:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 15px 20px -5px rgba(37, 99, 235, 0.4); }
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
            `}</style>

            <div className="login-visual">
                <div className="bg-glow glow-1"></div>
                <div className="bg-glow glow-2"></div>

                <div className="visual-content">
                    <div className="logo-area" style={{ margin: '0 0 2rem 0', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', padding: '1rem', borderRadius: '1rem' }}>
                        <img src={logoSST} alt="Soft Transit Sénégal" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
                    </div>
                    <span className="brand-chip">Soft Services Technologiques</span>
                    <h2>Moins de paperasse, plus de <span className="accent">transit.</span></h2>
                    <p>Gérez vos dossiers de transit, vos déclarations douanières et vos cotations en temps réel.</p>

                    <div className="feature-list">
                        <div className="feature-item">
                            <div className="feature-icon"><ShieldCheck size={20} /></div>
                            <span className="feature-text">Accès sécurisé, droits par utilisateur</span>
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
                    © 2026 Soft Transit Sénégal. Tous droits réservés.
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
                                <input type="checkbox" id="remember" style={{ width: '1rem', height: '1rem', accentColor: '#2563eb' }} />
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
                        Besoin d'un accès ? Contactez votre administrateur.
                    </div>
                </div>
            </div>
        </div>
    )
}


