import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Settings, LogOut, ChevronLeft, Menu, X, CreditCard, FileText, ShieldCheck, Warehouse } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoSST from '../assets/icone-soft-transit.svg';

export default function FloatingNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, user } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Auto-collapse when route changes
    useEffect(() => {
        setIsExpanded(false);
    }, [location.pathname]);

    // Do not render on auth pages or if not logged in
    const authRoutes = ['/login', '/forgot-password', '/reset-password'];
    if (!user || authRoutes.includes(location.pathname)) {
        return null;
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleBack = () => {
        // If we're at a deep route and want to go up
        navigate(-1);
    };

    // If we're already on the main dashboard, maybe we don't need the back button to show prominently
    const isDashboard = location.pathname === '/dashboard';

    return (
        <div className={`floating-nav-wrapper ${isExpanded ? 'expanded' : ''}`}>
            <style>{`
                .floating-nav-wrapper {
                    position: fixed;
                    bottom: 2rem;
                    left: 2rem;
                    z-index: 9999;
                    display: flex;
                    align-items: flex-end;
                    gap: 0.75rem;
                    /* Le conteneur couvre une large bande même replié : il ne doit pas intercepter les clics
                       destinés à la page (ex. boutons en bas d'une fenêtre modale) ; seuls ses boutons le font. */
                    pointer-events: none;
                }

                .floating-nav-wrapper > * {
                    pointer-events: auto;
                }

                .floating-nav-core {
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 0.5rem;
                    border-radius: 999px;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    transform-origin: left bottom;
                }

                .floating-nav-wrapper:not(.expanded) .floating-nav-core {
                    transform: scale(0.9);
                    opacity: 0;
                    pointer-events: none;
                    margin-left: -20px;
                }

                .floating-nav-wrapper.expanded .floating-nav-core {
                    transform: scale(1);
                    opacity: 1;
                    pointer-events: auto;
                    margin-left: 0;
                }

                .fnav-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    padding: 0.625rem 1rem;
                    border-radius: 999px;
                    font-weight: 600;
                    font-size: 0.8125rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }

                .fnav-btn:hover {
                    color: white;
                    background: rgba(255, 255, 255, 0.1);
                }
                
                .fnav-btn.primary {
                    color: white;
                    background: var(--primary);
                }
                .fnav-btn.primary:hover {
                    background: var(--primary-hover);
                }

                .fnav-btn.danger:hover {
                    color: #fca5a5;
                    background: rgba(239, 68, 68, 0.2);
                }

                .fnav-divider {
                    width: 1px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.1);
                }

                .fnav-trigger {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: var(--primary);
                    color: white;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5);
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    z-index: 2;
                }

                .fnav-trigger:hover {
                    transform: scale(1.05);
                    background: var(--primary-hover);
                }

                .fnav-trigger.active {
                    background: var(--slate-800);
                    transform: rotate(90deg);
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
                }

                /* Show quick back button even when collapsed, if not on dashboard */
                .quick-back {
                    position: absolute;
                    bottom: 0px;
                    left: 70px;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: white;
                    color: var(--slate-700);
                    border: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: var(--shadow-md);
                    transition: all 0.3s;
                    opacity: ${(!isExpanded && !isDashboard) ? 1 : 0};
                    pointer-events: ${(!isExpanded && !isDashboard) ? 'auto' : 'none'};
                    transform: ${(!isExpanded && !isDashboard) ? 'translateX(0)' : 'translateX(-20px)'};
                }
                .quick-back:hover {
                    background: var(--slate-50);
                    color: var(--primary);
                    transform: scale(1.05);
                }

            `}</style>
            
            <button
                className={`fnav-trigger ${isExpanded ? 'active' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
                title="Menu de navigation rapide"
            >
                {isExpanded ? <X size={24} /> : <img src={logoSST} alt="SST" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '50%' }} />}
            </button>

            {/* Quick Back isolated button for fast access */}
            <button className="quick-back" onClick={handleBack} title="Retour à la page précédente">
                <ChevronLeft size={24} style={{ marginLeft: '-2px' }} />
            </button>

            <div className="floating-nav-core">
                {!isDashboard && (
                    <>
                        <button className="fnav-btn primary" onClick={handleBack}>
                            <ChevronLeft size={16} /> Retour
                        </button>
                        <div className="fnav-divider"></div>
                    </>
                )}
                
                <button className="fnav-btn" onClick={() => navigate('/dashboard')}>
                    <Home size={16} /> Accueil
                </button>
                <button className="fnav-btn" onClick={() => navigate('/reglements')}>
                    <CreditCard size={16} /> Règlements
                </button>
                <button className="fnav-btn" onClick={() => navigate('/suivi-factures')}>
                    <FileText size={16} /> Suivi factures
                </button>
                <button className="fnav-btn" onClick={() => navigate('/sommiers')}>
                    <ShieldCheck size={16} /> Sommiers
                </button>
                <button className="fnav-btn" onClick={() => navigate('/entrepots')}>
                    <Warehouse size={16} /> Entrepôts
                </button>
                <button className="fnav-btn" onClick={() => navigate('/parameters-hub')}>
                    <Settings size={16} /> Paramètres
                </button>
                
                <div className="fnav-divider"></div>
                
                <button className="fnav-btn danger" onClick={handleLogout}>
                    <LogOut size={16} /> Quitter
                </button>
            </div>
        </div>
    );
}
