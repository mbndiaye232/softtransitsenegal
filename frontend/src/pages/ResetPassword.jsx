import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import { Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'

export default function ResetPassword() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')

    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: ''
    })
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!token) {
            setError('Lien de réinitialisation invalide ou expiré.')
        }
    }, [token])

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setMessage('')

        if (formData.newPassword !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas')
            return
        }

        if (formData.newPassword.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères')
            return
        }

        setLoading(true)
        try {
            const response = await authAPI.resetPassword(token, formData.newPassword)
            setMessage(response.data.message)
            setTimeout(() => {
                navigate('/login')
            }, 2500)
        } catch (err) {
            setError(err.response?.data?.error || 'Échec de la réinitialisation.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-wrapper">
            <style>{`
                .auth-wrapper { 
                    min-height: 100vh; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    background: #f8fafc; 
                    font-family: 'Inter', sans-serif;
                    position: relative;
                    overflow: hidden;
                    padding: 2rem;
                }
                
                .bg-glow {
                    position: absolute;
                    width: 500px;
                    height: 500px;
                    background: radial-gradient(circle, rgba(79, 70, 229, 0.1) 0%, rgba(79, 70, 229, 0) 70%);
                    border-radius: 50%;
                    z-index: 0;
                }
                .glow-1 { top: -100px; left: -100px; }
                .glow-2 { bottom: -100px; right: -100px; }

                .auth-card {
                    width: 100%;
                    max-width: 440px;
                    background: white;
                    padding: 3.5rem;
                    border-radius: 2rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.05);
                    border: 1px solid #e2e8f0;
                    position: relative;
                    z-index: 10;
                    text-align: center;
                }
                
                .icon-box { 
                    width: 64px; height: 64px; background: #eef2ff; border-radius: 1.25rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #4f46e5; 
                }
                
                .auth-header h1 { font-size: 1.75rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0; letter-spacing: -0.02em; }
                .auth-header p { color: #64748b; font-size: 0.9375rem; font-weight: 500; margin-bottom: 2.5rem; }

                .input-group { margin-bottom: 1.5rem; text-align: left; }
                .input-label { display: block; font-size: 0.8125rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
                
                .input-wrapper { position: relative; }
                .input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 18px; }
                .premium-input {
                    width: 100%;
                    padding: 0.875rem 1rem 0.875rem 2.75rem;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 1rem;
                    font-size: 1rem;
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

                .alert { padding: 1rem; border-radius: 1rem; margin-bottom: 2rem; font-size: 0.875rem; font-weight: 600; display: flex; align-items: center; gap: 0.75rem; text-align: left; }
                .alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
                .alert-success { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }

                .strength-msg { font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem; font-weight: 500; display: block; }
            `}</style>

            <div className="bg-glow glow-1"></div>
            <div className="bg-glow glow-2"></div>

            <div className="auth-card">
                <div className="icon-box">
                    <ShieldCheck size={28} />
                </div>

                <header className="auth-header">
                    <h1>Nouveau mot de passe</h1>
                    <p>Sécurisez votre compte avec un nouveau mot de passe robuste.</p>
                </header>

                {error && <div className="alert alert-error"><AlertCircle size={18} /> {error}</div>}
                {message && <div className="alert alert-success"><CheckCircle2 size={18} /> {message}</div>}

                {!message && (
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="input-label">Nouveau mot de passe</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" />
                                <input
                                    type="password"
                                    name="newPassword"
                                    className="premium-input"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    required
                                    autoFocus
                                    disabled={!token}
                                />
                            </div>
                            <small className="strength-msg">
                                Minimum 8 caractères, incluant des chiffres et des lettres.
                            </small>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Confirmer le mot de passe</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    className="premium-input"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    required
                                    disabled={!token}
                                />
                            </div>
                        </div>

                        <button type="submit" className="submit-btn" disabled={loading || !token}>
                            {loading ? 'Mise à jour sécurisée...' : 'Réinitialiser le mot de passe'}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>
                )}

                <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>
                    Besoin d'aide ? <a href="mailto:support@softtransit.com" style={{ color: '#4f46e5', textDecoration: 'none' }}>Contactez le support</a>
                </div>
            </div>
        </div>
    )
}
