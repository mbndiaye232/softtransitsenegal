import React, { useState, useEffect } from 'react';
import { livraisonsAPI } from '../../services/api';
import {
    Truck,
    Calendar,
    User,
    Save,
    CheckCircle,
    Info,
    AlertCircle,
    ChevronRight,
    Search,
    Printer
} from 'lucide-react';

const MiseEnLivraisonManager = ({ dossierId }) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [foremen, setForemen] = useState([]);
    const [selectedForeman, setSelectedForeman] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [form, setForm] = useState({
        DateMiseEnLivraison: '',
        DateRemiseContremaitre: '',
        DateRetourConteneur: '',
        DateEffectiveLivraison: '',
        Idcontremaitre: 0,
        observationsML: '',
        Pregate: ''
    });

    useEffect(() => {
        if (dossierId) {
            fetchData();
        }
    }, [dossierId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [dataRes, foremenRes] = await Promise.all([
                livraisonsAPI.getMiseEnLivraison(dossierId),
                livraisonsAPI.getForemen()
            ]);

            setForemen(foremenRes.data);

            if (dataRes.data) {
                const data = dataRes.data;
                setForm({
                    DateMiseEnLivraison: data.DateMiseEnLivraison ? data.DateMiseEnLivraison.split('T')[0] : '',
                    DateRemiseContremaitre: data.DateRemiseContremaitre ? data.DateRemiseContremaitre.split('T')[0] : '',
                    DateRetourConteneur: data.DateRetourConteneur ? data.DateRetourConteneur.split('T')[0] : '',
                    DateEffectiveLivraison: data.DateEffectiveLivraison ? data.DateEffectiveLivraison.split('T')[0] : '',
                    Idcontremaitre: data.Idcontremaitre || 0,
                    observationsML: data.observationsML || '',
                    Pregate: data.Pregate || ''
                });

                if (data.Idcontremaitre) {
                    const foreman = foremenRes.data.find(f => f.id === data.Idcontremaitre);
                    if (foreman) setSelectedForeman(foreman);
                }
            }
        } catch (err) {
            console.error('Error fetching delivery data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await livraisonsAPI.saveMiseEnLivraison({
                ...form,
                IDDossiers: dossierId
            });
            alert('Données enregistrées avec succès');
            fetchData();
        } catch (err) {
            const status = err.response?.status;
            const detail = err.response?.data?.error || err.response?.data?.details || err.message;
            console.error('Error saving delivery data:', status, detail, err);
            alert(`Erreur lors de l'enregistrement (${status || 'réseau'}): ${detail || 'voir la console'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrint = async () => {
        try {
            const res = await livraisonsAPI.generatePDF(dossierId);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Bordereau_Livraison_${dossierId}.pdf`);
            document.body.appendChild(link);
            link.click();
        } catch (err) {
            console.error('Error generating delivery note PDF:', err);
            alert('Erreur lors de la génération du PDF');
        }
    };

    const handleSelectForeman = (foreman) => {
        setSelectedForeman(foreman);
        setForm(prev => ({ ...prev, Idcontremaitre: foreman.id }));
    };

    const filteredForemen = foremen.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;

    return (
        <div className="delivery-manager">
            <style>{`
                .delivery-grid { display: grid; grid-template-columns: 1fr 400px; gap: 2rem; padding: 1.5rem; }
                @media (max-width: 1024px) { .delivery-grid { grid-template-columns: 1fr; } }
                
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .section-title { display: flex; align-items: center; gap: 0.75rem; color: #1e293b; }
                .section-title h3 { font-size: 1.125rem; font-weight: 700; margin: 0; }
                
                .icon-box { padding: 0.5rem; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; }
                .icon-delivery { background: #eff6ff; color: #2563eb; }
                .icon-foremen { background: #f0fdf4; color: #16a34a; }
                
                .premium-table-container { background: white; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                
                .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
                .form-group { margin-bottom: 1.25rem; }
                .form-group label { display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.025em; }
                .form-input { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.875rem; outline: none; transition: all 0.2s; background: #fff; }
                .form-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
                
                .btn-save { display: flex; align-items: center; justify-content: center; gap: 0.75rem; width: 100%; padding: 0.875rem; background: #2563eb; color: #fff; border: none; border-radius: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; margin-top: 1rem; }
                .btn-save:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                .btn-save:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
                
                .foreman-selector { border: 1px solid #e2e8f0; border-radius: 1rem; overflow: hidden; background: #fff; }
                .search-bar { padding: 1rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 0.75rem; }
                .search-input { border: none; outline: none; font-size: 0.875rem; width: 100%; color: #334155; }
                
                .foremen-list { max-height: 400px; overflow-y: auto; }
                .foreman-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; cursor: pointer; transition: all 0.2s; border-bottom: 1px solid #f8fafc; }
                .foreman-item:hover { background: #f8fafc; }
                .foreman-item.active { background: #eff6ff; border-left: 4px solid #2563eb; }
                
                .foreman-photo { width: 40px; height: 40px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #e2e8f0; }
                .foreman-photo img { width: 100%; height: 100%; object-fit: cover; }
                .foreman-name { font-weight: 600; color: #1e293b; font-size: 0.875rem; }
                .foreman-phone { font-size: 0.75rem; color: #64748b; }
                
                .selected-foreman-info { margin-top: 1.5rem; padding: 1.25rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 1rem; display: flex; align-items: center; gap: 1rem; }
                
                .btn-print { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: white; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.2s; }
                .btn-print:hover { background: #f8fafc; border-color: #94a3b8; color: #1e293b; }
            `}</style>

            <div className="delivery-grid">
                {/* Left Panel: Delivery Form */}
                <div className="form-section">
                    <div className="section-header">
                        <div className="section-title">
                            <div className="icon-box icon-delivery">
                                <Truck size={20} />
                            </div>
                            <h3>Mise en livraison</h3>
                        </div>
                        <button
                            className="btn-print"
                            onClick={handlePrint}
                            title="Imprimer le bordereau de livraison"
                        >
                            <Printer size={18} />
                            Imprimer Bordereau
                        </button>
                    </div>

                    <div className="premium-table-container">
                        <form onSubmit={handleSave}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Date mise en livraison</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={form.DateMiseEnLivraison}
                                        onChange={(e) => setForm({ ...form, DateMiseEnLivraison: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Pregat</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Référence Pregat"
                                        value={form.Pregate}
                                        onChange={(e) => setForm({ ...form, Pregate: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date remise contremaitre</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={form.DateRemiseContremaitre}
                                        onChange={(e) => setForm({ ...form, DateRemiseContremaitre: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date Retour Conteneur (RCO)</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={form.DateRetourConteneur}
                                        onChange={(e) => setForm({ ...form, DateRetourConteneur: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date Livraison Effective</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={form.DateEffectiveLivraison}
                                        onChange={(e) => setForm({ ...form, DateEffectiveLivraison: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Contremaître</label>
                                    <input
                                        type="text"
                                        className="form-input bg-slate-50 cursor-not-allowed"
                                        readOnly
                                        value={selectedForeman ? selectedForeman.name : 'Sélectionnez un contremaître à droite'}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Observations</label>
                                <textarea
                                    className="form-input"
                                    rows="4"
                                    placeholder="Notes particulières..."
                                    value={form.observationsML}
                                    onChange={(e) => setForm({ ...form, observationsML: e.target.value })}
                                ></textarea>
                            </div>

                            <button type="submit" className="btn-save" disabled={submitting || !selectedForeman}>
                                <Save size={20} />
                                {submitting ? 'Enregistrement...' : 'Valider la mise en livraison'}
                            </button>

                            {!selectedForeman && (
                                <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
                                    <AlertCircle size={14} /> Veuillez sélectionner un contremaître pour valider.
                                </p>
                            )}
                        </form>
                    </div>
                </div>

                {/* Right Panel: Foreman Selector */}
                <div className="foremen-section">
                    <div className="section-header">
                        <div className="section-title">
                            <div className="icon-box icon-foremen">
                                <User size={20} />
                            </div>
                            <h3>Liste des contremaîtres</h3>
                        </div>
                    </div>

                    <div className="foreman-selector">
                        <div className="search-bar">
                            <Search size={18} className="text-slate-400" />
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Rechercher un contremaître..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="foremen-list">
                            {filteredForemen.length > 0 ? (
                                filteredForemen.map(f => (
                                    <div
                                        key={f.id}
                                        className={`foreman-item ${selectedForeman?.id === f.id ? 'active' : ''}`}
                                        onClick={() => handleSelectForeman(f)}
                                    >
                                        <div className="foreman-photo">
                                            {f.photo ? (
                                                <img src={`http://localhost:3001/${f.photo}`} alt={f.name} />
                                            ) : (
                                                <User size={20} className="text-slate-400" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="foreman-name">{f.name}</div>
                                            <div className="foreman-phone">{f.phone || 'Pas de numéro'}</div>
                                        </div>
                                        {selectedForeman?.id === f.id && <CheckCircle size={18} className="text-blue-500" />}
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    Aucun contremaître trouvé.
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedForeman && (
                        <div className="selected-foreman-info">
                            <div className="icon-box icon-foremen" style={{ background: '#dcfce7' }}>
                                <CheckCircle size={20} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-emerald-800 uppercase tracking-tight">Assigné au dossier</div>
                                <div className="text-sm font-semibold text-emerald-950">{selectedForeman.name}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MiseEnLivraisonManager;
