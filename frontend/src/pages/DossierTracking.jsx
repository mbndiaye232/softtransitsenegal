import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardsAPI } from '../services/api';
import { ClipboardList, AlertCircle, RefreshCw, ChevronLeft } from 'lucide-react';

const DossierTracking = () => {
    const navigate = useNavigate();
    const [dossiers, setDossiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTrackingData();
    }, []);

    const fetchTrackingData = async () => {
        try {
            setLoading(true);
            const response = await dashboardsAPI.getDossierTracking();
            setDossiers(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching tracking data:', err);
            setError('Impossible de charger le tableau de suivi.');
        } finally {
            setLoading(false);
        }
    };

    const getRowStyle = (item) => {
        // If no color data was matched (e.g. ndjours was empty), return default style
        if (item.colorR == null) return {};

        const rgb = `${item.colorR}, ${item.colorG}, ${item.colorB}`;
        
        // Calculate relative luminance to decide text color (black or white)
        const luminance = (0.299 * item.colorR + 0.587 * item.colorG + 0.114 * item.colorB) / 255;
        const textColor = luminance > 0.5 ? '#1e293b' : '#ffffff';

        return {
            backgroundColor: `rgb(${rgb})`,
            color: textColor,
            fontWeight: 600
        };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '---';
        return new Date(dateString).toLocaleDateString('fr-FR');
    };

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
        <div className="page-wrapper">
            <style>{`
                .page-wrapper { min-height: 100vh; background: var(--bg); padding: 2.5rem; }
                .page-container { max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; }
                
                .view-header { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1rem; }
                .back-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: white; border: 1px solid var(--border); color: var(--slate-600); cursor: pointer; transition: all 0.2s; }
                .back-btn:hover { background: var(--slate-50); color: var(--primary); border-color: var(--primary-light); transform: translateX(-2px); }
                
                .title-area h1 { font-size: 1.5rem; font-weight: 800; color: var(--slate-900); display: flex; align-items: center; gap: 0.75rem; margin: 0; }
                .title-area p { font-size: 0.875rem; color: var(--slate-500); margin: 0.25rem 0 0 0; }
                
                .dashboard-banner {
                    background: #f59e0b;
                    color: white;
                    text-align: center;
                    padding: 1rem;
                    border-radius: var(--radius-lg);
                    font-size: 1.1rem;
                    font-weight: 800;
                    letter-spacing: 0.02em;
                    box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.4);
                }

                .list-card { background: white; border-radius: var(--radius-xl); border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; }
                
                .table-scroll { overflow-x: auto; }
                table { width: 100%; border-collapse: collapse; }
                th { 
                    text-align: left; 
                    padding: 1rem 1.5rem; 
                    background: #0f172a; 
                    font-size: 0.75rem; 
                    font-weight: 700; 
                    color: white; 
                    text-transform: uppercase; 
                    letter-spacing: 0.05em; 
                    border-right: 1px solid rgba(255,255,255,0.1);
                }
                th:last-child { border-right: none; }
                td { padding: 1rem 1.5rem; font-size: 0.875rem; border-bottom: 1px solid var(--slate-100); border-right: 1px solid rgba(0,0,0,0.05); }
                td:last-child { border-right: none; }
                
                .tr-row { transition: all 0.2s; }
                .tr-row:hover { opacity: 0.95; }
                
                .empty-view { padding: 6rem 2rem; text-align: center; color: var(--slate-400); }
            `}</style>

            <div className="page-container">
                <header className="view-header">
                    <button className="back-btn" onClick={() => navigate('/dashboard')} title="Retour au tableau de bord">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="title-area">
                        <h1>
                            <ClipboardList size={28} color="var(--primary)" />
                            Suivi du traitement des dossiers
                        </h1>
                        <p>Tableau de bord de suivi avec code couleur selon l'échéance.</p>
                    </div>
                </header>

                <div className="dashboard-banner">
                    Tableau de suivi du traitement des dossiers
                </div>

                {error && (
                    <div className="premium-card" style={{ padding: '1rem', color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={20} />
                        {error}
                        <button onClick={fetchTrackingData} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <RefreshCw size={14} /> Réessayer
                        </button>
                    </div>
                )}

                <div className="list-card">
                    <div className="table-scroll">
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                            <thead>
                                <tr>
                                    <th>Client</th>
                                    <th>Tel client</th>
                                    <th>Code dossier</th>
                                    <th>Libellé dossier</th>
                                    <th>Etape</th>
                                    <th>N° BL/LTA/LVI</th>
                                    <th>Deadline</th>
                                    <th style={{ textAlign: 'center' }}>Nbre jours restants</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dossiers.length > 0 ? (
                                    dossiers.map((item, idx) => (
                                        <tr key={idx} className="tr-row" style={getRowStyle(item)}>
                                            <td>{item.clientName || '---'}</td>
                                            <td>{item.clientPhone || '---'}</td>
                                            <td>{item.code || '---'}</td>
                                            <td>{item.label || '---'}</td>
                                            <td>{item.step || 'Ouvert'}</td>
                                            <td>{item.docNumber || '---'}</td>
                                            <td>{formatDate(item.deadline)}</td>
                                            <td style={{ textAlign: 'center' }}>{item.daysRemaining != null ? item.daysRemaining : '---'}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="8">
                                            <div className="empty-view">
                                                <ClipboardList size={48} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
                                                <p style={{ fontWeight: 600, fontSize: '1.125rem' }}>Aucun dossier en cours de traitement suivi</p>
                                                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Les dossiers avec une deadline (date d'arrivée) apparaîtront ici.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DossierTracking;
