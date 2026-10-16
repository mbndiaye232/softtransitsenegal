import React, { useState, useEffect } from 'react';
import { declarationsAPI } from '../../services/api';
import {
    Shield,
    Trash2,
    Calendar,
    FileText,
    Plus,
    X,
    User,
    Save,
    AlertCircle,
    CheckCircle,
    Info
} from 'lucide-react';

const DeclarationManager = ({ dossierId }) => {
    const [declarations, setDeclarations] = useState([]);
    const [activeCotation, setActiveCotation] = useState(null);
    const [regimes, setRegimes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [showDeclForm, setShowDeclForm] = useState(false);

    const [declForm, setDeclForm] = useState({
        NumeroDeclaration: '',
        DateDeclaration: new Date().toISOString().split('T')[0],
        DateBAE: '',
        RegimeDeclaration: '',
        NumeroBureau: '',
        IdAgent: '',
        Observations: ''
    });

    useEffect(() => {
        if (dossierId) {
            fetchData();
        }
    }, [dossierId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [declRes, regimeRes, cotationRes] = await Promise.all([
                declarationsAPI.getByDossier(dossierId),
                declarationsAPI.getRegimes(),
                declarationsAPI.getActiveCotation(dossierId)
            ]);

            setDeclarations(declRes.data);
            setRegimes(regimeRes.data);
            setActiveCotation(cotationRes.data);

            // Auto-populate agent if active cotation exists
            if (cotationRes.data) {
                setDeclForm(prev => ({ ...prev, IdAgent: cotationRes.data.agent_id }));
            }
        } catch (err) {
            console.error('Error fetching declaration data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDeclaration = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await declarationsAPI.create({
                ...declForm,
                IDDossiers: dossierId
            });
            await fetchData();
            setShowDeclForm(false);
            setDeclForm({
                NumeroDeclaration: '',
                DateDeclaration: new Date().toISOString().split('T')[0],
                DateBAE: '',
                RegimeDeclaration: '',
                NumeroBureau: '',
                IdAgent: activeCotation ? activeCotation.agent_id : '',
                Observations: ''
            });
        } catch (err) {
            console.error('Error adding declaration:', err);
            alert('Erreur lors de l’ajout de la déclaration');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteDeclaration = async (id) => {
        if (!window.confirm('Supprimer cette déclaration ?')) return;
        try {
            await declarationsAPI.delete(id);
            await fetchData();
        } catch (err) {
            console.error('Error deleting declaration:', err);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;

    return (
        <div className="declaration-manager">
            <style>{`
                .declaration-grid { display: grid; grid-template-columns: 1fr 350px; gap: 2rem; padding: 1.5rem; }
                @media (max-width: 1024px) { .declaration-grid { grid-template-columns: 1fr; } }
                
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .section-title { display: flex; align-items: center; gap: 0.75rem; color: #1e293b; }
                .section-title h3 { font-size: 1.125rem; font-weight: 700; margin: 0; }
                
                .icon-box { padding: 0.5rem; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; }
                .icon-declarations { background: #eff6ff; color: #2563eb; }
                .icon-assignments { background: #f0fdf4; color: #16a34a; }
                
                .premium-table-container { background: white; border: 1px solid #e2e8f0; border-radius: 1rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .premium-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
                .premium-table th { background: #f8fafc; padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; }
                .premium-table td { padding: 1rem; border-bottom: 1px solid #f1f5f9; color: #334155; }
                .premium-table tr:last-child td { border-bottom: none; }
                .premium-table tr:hover { background: #fcfcfd; }
                
                .btn-add { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 600; transition: all 0.2s; border: none; cursor: pointer; }
                .btn-primary { background: #2563eb; color: white; }
                .btn-primary:hover { background: #1d4ed8; }
                .btn-ghost { background: transparent; color: #94a3b8; }
                .btn-ghost:hover { background: #f1f5f9; color: #ef4444; }
                
                .agent-card { padding: 1.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 1rem; }
                .agent-profile { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
                .agent-photo { width: 48px; height: 48px; border-radius: 50%; background: #fff; border: 2px solid #2563eb; display: flex; align-items: center; justify-content: center; overflow: hidden; }
                .agent-photo img { width: 100%; height: 100%; object-fit: cover; }
                .agent-name { font-weight: 700; color: #1e293b; font-size: 1rem; }
                .agent-meta { font-size: 0.75rem; color: #64748b; display: flex; flex-direction: column; gap: 0.25rem; }
                
                .form-overlay { padding: 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; animation: slideDown 0.3s ease-out; }
                @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                
                .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
                .form-group { margin-bottom: 1rem; }
                .form-group label { display: block; font-size: 0.75rem; font-weight: 600; color: #64748b; margin-bottom: 0.375rem; }
                .form-input { width: 100%; padding: 0.625rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
                .form-input:focus { border-color: #2563eb; ring: 2px solid #bfdbfe; }
                
                .empty-state { padding: 3rem 1.5rem; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
                .badge { padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; background: #f1f5f9; color: #475569; }
                .badge-regime { background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; }
            `}</style>

            <div className="declaration-grid">
                {/* Left Panel: Declarations */}
                <div className="declarations-section">
                    <div className="section-header">
                        <div className="section-title">
                            <div className="icon-box icon-declarations">
                                <Shield size={20} />
                            </div>
                            <h3>Déclarations du dossier</h3>
                        </div>
                        {!showDeclForm && (
                            <button onClick={() => setShowDeclForm(true)} className="btn-add btn-primary">
                                <Plus size={16} /> Ajouter une déclaration
                            </button>
                        )}
                    </div>

                    {showDeclForm && (
                        <div className="form-overlay premium-table-container mb-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-slate-700">Nouvelle Déclaration</h4>
                                <button onClick={() => setShowDeclForm(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleAddDeclaration}>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Numéro Déclaration</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            required
                                            placeholder="Ex: 44455"
                                            value={declForm.NumeroDeclaration}
                                            onChange={(e) => setDeclForm({ ...declForm, NumeroDeclaration: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Régime</label>
                                        <select
                                            className="form-input"
                                            required
                                            value={declForm.RegimeDeclaration}
                                            onChange={(e) => setDeclForm({ ...declForm, RegimeDeclaration: e.target.value })}
                                        >
                                            <option value="">Sélectionner...</option>
                                            {regimes.map(r => (
                                                <option key={r.IDRegimeDeclaration} value={r.CodeRegimeDeclaration}>
                                                    {r.CodeRegimeDeclaration} - {r.LibelleRegimeDeclaration}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Date Déclaration</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            required
                                            value={declForm.DateDeclaration}
                                            onChange={(e) => setDeclForm({ ...declForm, DateDeclaration: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Date BAE</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={declForm.DateBAE}
                                            onChange={(e) => setDeclForm({ ...declForm, DateBAE: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Numéro Bureau</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Ex: 4"
                                            value={declForm.NumeroBureau}
                                            onChange={(e) => setDeclForm({ ...declForm, NumeroBureau: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Déclarant Responsable</label>
                                        <input
                                            type="text"
                                            className="form-input bg-slate-50 cursor-not-allowed"
                                            readOnly
                                            value={activeCotation ? activeCotation.name : 'Aucun déclarant assigné'}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Observations</label>
                                    <textarea
                                        className="form-input"
                                        rows="2"
                                        value={declForm.Observations}
                                        onChange={(e) => setDeclForm({ ...declForm, Observations: e.target.value })}
                                    ></textarea>
                                </div>
                                <div className="flex justify-end gap-3 mt-2">
                                    <button type="button" onClick={() => setShowDeclForm(false)} className="btn-add btn-ghost">Annuler</button>
                                    <button type="submit" disabled={submitting || !activeCotation} title={!activeCotation ? "Assignez un déclarant dans l'onglet Cotation" : ""} className="btn-add btn-primary">
                                        <Save size={16} /> {submitting ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="premium-table-container">
                        <div style={{ overflowX: 'auto' }}>
                            <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Déclaration</th>
                                    <th>Dates</th>
                                    <th>Régime & Bureau</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {declarations.length > 0 ? (
                                    declarations.map((d) => (
                                        <tr key={d.IDDeclarations}>
                                            <td>
                                                <div className="font-bold text-slate-800">#{d.NumeroDeclaration}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    Par: <span className="text-slate-600 font-medium">{d.agent_name || 'Non spécifié'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-col gap-1">
                                                    <span className="flex items-center gap-1.5 text-xs text-slate-600">
                                                        <Calendar size={12} className="text-slate-400" /> Decl: {new Date(d.DateDeclaration).toLocaleDateString()}
                                                    </span>
                                                    {d.DateBAE ? (
                                                        <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                                                            <CheckCircle size={12} /> BAE: {new Date(d.DateBAE).toLocaleDateString()}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-xs text-amber-500">
                                                            <AlertCircle size={12} /> BAE en attente
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <span className="badge badge-regime">{d.RegimeDeclaration}</span>
                                                    <span className="text-xs font-medium text-slate-500">Bur: {d.NumeroBureau}</span>
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                <button
                                                    onClick={() => handleDeleteDeclaration(d.IDDeclarations)}
                                                    className="btn-ghost p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4">
                                            <div className="empty-state">
                                                <FileText size={40} className="text-slate-200" />
                                                <p>Aucune déclaration pour ce dossier.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Active Declarant Info */}
                <div className="declarant-section">
                    <div className="section-header">
                        <div className="section-title">
                            <div className="icon-box icon-assignments">
                                <User size={20} />
                            </div>
                            <h3>Déclarant assigné</h3>
                        </div>
                    </div>

                    {activeCotation ? (
                        <div className="agent-card">
                            <div className="agent-profile">
                                <div className="agent-photo">
                                    {activeCotation.photo ? (
                                        <img src={`http://localhost:3001/${activeCotation.photo}`} alt={activeCotation.name} />
                                    ) : (
                                        <User size={24} className="text-slate-400" />
                                    )}
                                </div>
                                <div>
                                    <div className="agent-name">{activeCotation.name}</div>
                                    <div className="badge badge-regime">Actif sur le dossier</div>
                                </div>
                            </div>
                            <div className="agent-meta">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Calendar size={14} className="text-slate-400" />
                                    Affecté le {new Date(activeCotation.date_effet).toLocaleDateString()}
                                </div>
                                {activeCotation.phone && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Info size={14} className="text-slate-400" />
                                        {activeCotation.phone}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-slate-600 italic">
                                    <Info size={14} className="text-slate-400" />
                                    {activeCotation.email}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex gap-3">
                            <AlertCircle size={20} className="shrink-0" />
                            <div>
                                <p className="font-bold">Aucun déclarant assigné !</p>
                                <p className="mt-1">Veuillez d'abord assigner un déclarant dans l'onglet <strong>Cotation / Agent</strong> pour pouvoir enregistrer des déclarations.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeclarationManager;
