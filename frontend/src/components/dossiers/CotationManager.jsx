import React, { useState, useEffect } from 'react';
import { cotationsAPI, usersAPI } from '../../services/api';
import {
    User,
    Calendar,
    History as HistoryIcon,
    Save,
    X,
    CheckCircle,
    AlertCircle,
    ArrowRightLeft,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

const CotationManager = ({ dossierId }) => {
    const [cotations, setCotations] = useState([]);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const [form, setForm] = useState({
        agent_id: '',
        date_effet: new Date().toISOString().split('T')[0],
        motif: ''
    });

    useEffect(() => {
        fetchData();
    }, [dossierId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [cotRes, agentsRes] = await Promise.all([
                cotationsAPI.getByDossier(dossierId),
                usersAPI.getDeclarants()
            ]);
            setCotations(cotRes.data);
            const list = Array.isArray(agentsRes.data) ? agentsRes.data : [];
            setAgents(list);
            console.log('[CotationManager] declarants loaded:', list.length, list);
        } catch (err) {
            console.error('[CotationManager] Error fetching cotation data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await cotationsAPI.create({
                dossier_id: dossierId,
                ...form
            });
            await fetchData();
            setShowForm(false);
            setForm({
                agent_id: '',
                date_effet: new Date().toISOString().split('T')[0],
                motif: ''
            });
        } catch (err) {
            console.error('Error assigning cotation:', err);
            alert('Erreur lors de l\'assignation');
        } finally {
            setSubmitting(false);
        }
    };

    const activeCotation = cotations.find(c => c.is_active === 1);
    const history = cotations.filter(c => c.is_active === 0);

    if (loading) return (
        <div className="mgr-loading">
            <div className="skeleton-title"></div>
            <div className="skeleton-card"></div>
            <style>{`
                .mgr-loading { padding: 2rem; }
                .skeleton-title { height: 1.5rem; width: 200px; background: #f1f5f9; border-radius: 99px; margin-bottom: 1rem; }
                .skeleton-card { height: 100px; background: #f8fafc; border-radius: 1rem; }
            `}</style>
        </div>
    );

    return (
        <div className="cotation-manager">
            <style>{`
                .cotation-manager { margin-top: 3rem; background: white; border-radius: 1.5rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; }
                .mgr-header { padding: 1.5rem 2rem; background: #fcfcfd; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .mgr-title { display: flex; align-items: center; gap: 0.75rem; }
                .mgr-icon { pading: 0.5rem; background: #2563eb; color: white; border-radius: 0.75rem; display: flex; }
                .mgr-title h3 { font-size: 1.125rem; font-weight: 800; color: #0f172a; margin: 0; }
                
                .mgr-content { padding: 2rem; }
                .active-agent-card { padding: 1.5rem; background: #eff6ff; border: 1px solid #dbeafe; border-radius: 1rem; display: flex; align-items: center; gap: 1.5rem; }
                .agent-info h4 { font-size: 1.25rem; font-weight: 800; color: #1e40af; margin: 0; text-transform: uppercase; }
                .agent-meta { display: flex; gap: 1rem; margin-top: 0.5rem; }
                .badge-info { background: white; padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700; color: #64748b; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 0.375rem; }
                .badge-success { background: #d1fae5; color: #065f46; padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; gap: 0.375rem; }
                
                .empty-state { padding: 1.5rem; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 1rem; color: #92400e; font-size: 0.875rem; font-weight: 600; display: flex; align-items: center; gap: 0.75rem; }
                
                .form-overlay { margin-top: 1.5rem; background: #f8fafc; border-radius: 1.25rem; padding: 2rem; border: 1px solid #f1f5f9; position: relative; }
                .close-btn { position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: #94a3b8; cursor: pointer; }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem; }
                @media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
                
                .mgr-input { width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.875rem; outline: none; background: white; }
                .mgr-btn { padding: 0.625rem 1.25rem; border-radius: 0.625rem; font-size: 0.875rem; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; }
                .mgr-btn-primary { background: #2563eb; color: white; }
                .mgr-btn-primary:hover { background: #1d4ed8; }
                .mgr-btn-outline { background: white; color: #64748b; border: 1px solid #e2e8f0; }
                
                .history-section { margin-top: 2rem; }
                .history-toggle { display: flex; align-items: center; gap: 0.5rem; background: none; border: none; color: #94a3b8; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; cursor: pointer; letter-spacing: 0.05em; }
                .history-item { margin-top: 0.75rem; padding: 1rem; background: #fafafa; border: 1px solid #f1f5f9; border-radius: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
                .history-info p { margin: 0; font-size: 0.875rem; font-weight: 700; color: #334155; }
                .history-date { font-size: 0.75rem; color: #94a3b8; display: flex; align-items: center; gap: 0.25rem; }
                .history-motif { font-size: 0.8125rem; color: #64748b; font-style: italic; background: white; padding: 0.375rem 0.75rem; border-radius: 0.5rem; border: 1px solid #f1f5f9; }
            `}</style>

            <div className="mgr-header">
                <div className="mgr-title">
                    <div className="mgr-icon" style={{ padding: '6px' }}><ArrowRightLeft size={18} /></div>
                    <div>
                        <h3>Cotation Déclarant</h3>
                    </div>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="mgr-btn mgr-btn-primary"
                    >
                        {activeCotation ? 'Réaffecter' : 'Assigner'}
                    </button>
                )}
            </div>

            <div className="mgr-content">
                {activeCotation ? (
                    <div className="active-agent-card">
                        <div style={{ background: 'white', padding: '10px', borderRadius: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                            <User size={32} color="#2563eb" />
                        </div>
                        <div className="agent-info">
                            <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Agent Actuel</span>
                            <h4>{activeCotation.agent_name}</h4>
                            <div className="agent-meta">
                                <span className="badge-info">
                                    <Calendar size={12} /> Depuis le {new Date(activeCotation.date_effet).toLocaleDateString()}
                                </span>
                                <span className="badge-success">
                                    <CheckCircle size={12} /> Actif
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    !showForm && (
                        <div className="empty-state">
                            <AlertCircle size={20} />
                            <span>Aucun agent déclarant n'est assigné à ce dossier.</span>
                        </div>
                    )
                )}

                {showForm && (
                    <div className="form-overlay">
                        <button onClick={() => setShowForm(false)} className="close-btn"><X size={20} /></button>
                        <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 800 }}>
                            {activeCotation ? 'Nouvelle Imputation' : 'Première Affectation'}
                        </h4>

                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Déclarant</label>
                                    <select
                                        required
                                        className="mgr-input"
                                        value={form.agent_id}
                                        onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
                                    >
                                        <option value="">
                                            {agents.length === 0 ? '⚠ Aucun déclarant trouvé' : 'Choisir un agent...'}
                                        </option>
                                        {agents.map(agent => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.name || agent.NomAgent}
                                                {agent.group_name ? ` (${agent.group_name})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Date d'effet</label>
                                    <input
                                        type="date"
                                        required
                                        className="mgr-input"
                                        value={form.date_effet}
                                        onChange={(e) => setForm({ ...form, date_effet: e.target.value })}
                                    />
                                </div>
                            </div>

                            {activeCotation && (
                                <div style={{ marginTop: '1.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Motif</label>
                                    <textarea
                                        required
                                        rows="2"
                                        className="mgr-input"
                                        placeholder="Raison du changement..."
                                        value={form.motif}
                                        onChange={(e) => setForm({ ...form, motif: e.target.value })}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button type="button" onClick={() => setShowForm(false)} className="mgr-btn mgr-btn-outline">Annuler</button>
                                <button type="submit" disabled={submitting} className="mgr-btn mgr-btn-primary">
                                    <Save size={16} />
                                    {submitting ? 'Validation...' : 'Valider'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {history.length > 0 && (
                    <div className="history-section">
                        <button onClick={() => setShowHistory(!showHistory)} className="history-toggle">
                            <HistoryIcon size={14} />
                            Historique ({history.length})
                            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showHistory && (
                            <div style={{ marginTop: '1rem' }}>
                                {history.map((c, idx) => (
                                    <div key={idx} className="history-item">
                                        <div className="history-info">
                                            <p>{c.agent_name}</p>
                                            <span className="history-date">
                                                <Calendar size={10} /> {new Date(c.date_effet).toLocaleDateString()} - {new Date(c.date_fin).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="history-motif">{c.motif_fin}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CotationManager;
