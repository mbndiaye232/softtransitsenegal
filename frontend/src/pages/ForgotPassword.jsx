import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import { Mail, ArrowLeft, Send, CheckCircle2, AlertCircle, Globe } from 'lucide-react'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setMessage('')
        setLoading(true)

        try {
            const response = await authAPI.forgotPassword(email)
            setMessage(response.data.message)
            setEmail('')
        } catch (err) {
            setError(err.response?.data?.error || 'Échec de l\'envoi. Vérifiez l\'adresse email.')
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
                .glow-1 { top: -100px; right: -100px; }
                .glow-2 { bottom: -100px; left: -100px; }

                .auth-card {
                    width: 100%;
                    max-width: 440px;
                    background: white;
                    padding: 3rem;
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

                .input-group { margin-bottom: 2rem; text-align: left; }
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
                }
                .submit-btn:hover { background: #4338ca; transform: translateY(-1px); }
                .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

                .alert { 
                    padding: 1rem; 
                    border-radius: 1rem; 
                    margin-bottom: 2rem; 
                    font-size: 0.875rem; 
                    font-weight: 600; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    text-align: left;
                }
                .alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
                .alert-success { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }

                .back-link { margin-top: 2rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.9375rem; color: #64748b; font-weight: 600; text-decoration: none; transition: color 0.2s; }
                .back-link:hover { color: #4f46e5; }
            `}</style>

            <div className="bg-glow glow-1"></div>
            <div className="bg-glow glow-2"></div>

            <div className="auth-card">
                <div className="icon-box">
                    <Mail size={28} />
                </div>

                <header className="auth-header">
                    <h1>Mot de passe oublié</h1>
                    <p>Récupérez l'accès à votre espace professionnel Soft Transit en quelques secondes.</p>
                </header>

                {error && <div className="alert alert-error"><AlertCircle size={18} /> {error}</div>}
                {message && <div className="alert alert-success"><CheckCircle2 size={18} /> {message}</div>}

                {!message ? (
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="input-label">Adresse Email</label>
                            <div className="input-wrapper">
                                <Mail className="input-icon" />
                                <input
                                    type="email"
                                    className="premium-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nom@exemple.com"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? 'Traitement en cours...' : 'Envoyer le lien de récupération'}
                            {!loading && <Send size={18} />}
                        </button>
                    </form>
                ) : (
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                            Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
                            Veuillez vérifier votre boîte de réception et vos courriers indésirables.
                        </p>
                    </div>
                )}

                <Link to="/login" className="back-link">
                    <ArrowLeft size={16} />
                    Retour à la connexion
                </Link>
            </div>

            <div style={{ position: 'absolute', bottom: '2rem', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                © 2026 Soft Transit • Sécurité Certifiée
            </div>
        </div>
    )
}
