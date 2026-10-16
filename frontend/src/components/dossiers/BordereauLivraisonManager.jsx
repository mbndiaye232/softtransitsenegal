import React, { useState, useEffect } from 'react';
import { ordreTransportAPI } from '../../services/api';
import { FileText, Printer, CheckCircle, AlertCircle, Info, Truck, Calendar, ArrowRight } from 'lucide-react';

const BordereauLivraisonManager = ({ dossierId }) => {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(null); // Now stores IDOrdresDeTransport
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (dossierId) {
            fetchOrders();
        }
    }, [dossierId]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await ordreTransportAPI.getByDossier(dossierId);
            setOrders(res.data);
            if (res.data.length > 0) {
                setSelectedOrderId(res.data[0].IDOrdresDeTransport);
            }
        } catch (err) {
            console.error('Error fetching OTRs:', err);
            setError('Échec du chargement des ordres de transport');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateBL = async () => {
        if (!selectedOrderId) return;
        setGenerating(true);
        try {
            // We pass the ID now
            const res = await ordreTransportAPI.generateBLPDF(selectedOrderId);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const blCode = `BL-${String(selectedOrderId).padStart(5, '0')}`;
            link.setAttribute('download', `${blCode}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error generating BL PDF:', err);
            alert('Erreur lors de la génération du bordereau de livraison.');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement des ordres de transport...</div>;

    return (
        <div className="bl-manager">
            <style>{`
                .bl-manager { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
                .bl-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
                .bl-icon { padding: 0.5rem; background: var(--primary); color: white; border-radius: 0.75rem; display: flex; }
                .bl-title { font-size: 1.125rem; font-weight: 800; color: #0f172a; }
                
                .otr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
                .otr-card { 
                    padding: 1.25rem; 
                    border: 1px solid var(--border); 
                    border-radius: 1rem; 
                    cursor: pointer; 
                    transition: all 0.2s;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .otr-card:hover { border-color: var(--primary); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .otr-card.selected { border-color: var(--primary); background: var(--primary-light); border-width: 2px; }
                
                .otr-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
                .otr-card-code { font-weight: 800; color: #0f172a; font-size: 0.9375rem; }
                .otr-card-date { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem; }
                
                .otr-card-info { font-size: 0.8125rem; color: #475569; display: flex; align-items: center; gap: 0.5rem; }
                
                .generate-action { 
                    margin-top: 2rem; 
                    padding: 2rem; 
                    background: #f8fafc; 
                    border: 2px dashed #e2e8f0; 
                    border-radius: 1.25rem; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    gap: 1.5rem; 
                    text-align: center;
                }
                
                .btn-generate { 
                    padding: 1rem 2.5rem; 
                    background: var(--primary); 
                    color: white; 
                    border: none; 
                    border-radius: 0.75rem; 
                    font-weight: 800; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    font-size: 1rem;
                    transition: all 0.2s;
                    box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.39);
                }
                .btn-generate:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.23); }
                .btn-generate:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>

            <div className="bl-header">
                <div className="bl-icon"><FileText size={20} /></div>
                <h3 className="bl-title">Établir un Bordereau de Livraison</h3>
            </div>

            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                Sélectionnez l'ordre de transport pour lequel vous souhaitez générer un bordereau de livraison.
            </p>

            {orders.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#fef2f2', borderRadius: '1rem', border: '1px solid #fee2e2' }}>
                    <Info size={32} color="#ef4444" style={{ marginBottom: '1rem' }} />
                    <p style={{ margin: 0, fontWeight: 700, color: '#991b1b' }}>Aucun ordre de transport trouvé pour ce dossier.</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#b91c1c' }}>Vous devez d'abord créer un ordre de transport.</p>
                </div>
            ) : (
                <>
                    <div className="otr-grid">
                        {orders.map(order => (
                            <div
                                key={order.IDOrdresDeTransport}
                                className={`otr-card ${selectedOrderId === order.IDOrdresDeTransport ? 'selected' : ''}`}
                                onClick={() => setSelectedOrderId(order.IDOrdresDeTransport)}
                            >
                                <div className="otr-card-header">
                                    <span className="otr-card-code">{order.CodeOrdreTransport}</span>
                                    <span className="otr-card-date"><Calendar size={12} /> {new Date(order.DateOrdreTransport).toLocaleDateString()}</span>
                                </div>
                                <div className="otr-card-info">
                                    <Truck size={14} color="#6366f1" />
                                    <span>{order.TransporteuretAdresse}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 'auto' }}>
                                    {order.contents?.length || 0} article(s) inclus
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="generate-action">
                        {selectedOrderId ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ padding: '1rem', background: 'white', borderRadius: '1rem', border: '1px solid var(--border)', fontWeight: 700 }}>
                                        {orders.find(o => o.IDOrdresDeTransport === selectedOrderId)?.CodeOrdreTransport}
                                    </div>
                                    <ArrowRight size={24} color="#94a3b8" />
                                    <div style={{ padding: '1rem', background: 'white', borderRadius: '1rem', border: '1px solid var(--border)', color: 'var(--primary)', fontWeight: 700 }}>
                                        {`BL-${String(selectedOrderId).padStart(5, '0')}`}
                                    </div>
                                </div>
                                <button
                                    className="btn-generate"
                                    onClick={handleGenerateBL}
                                    disabled={generating}
                                >
                                    {generating ? 'Génération...' : <><Printer size={20} /> Générer le Bordereau de Livraison</>}
                                </button>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                    L'avertissement réglementaire et la zone de signature client seront ajoutés automatiquement au bas du document.
                                </p>
                            </>
                        ) : (
                            <p style={{ color: '#64748b' }}>Veuillez sélectionner un ordre de transport ci-dessus.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default BordereauLivraisonManager;
