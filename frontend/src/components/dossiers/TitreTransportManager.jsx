import React, { useState, useEffect } from 'react';
import { billOfLadingAPI } from '../../services/api';
import { Save, FileText, MapPin, Truck, Building2, User, Calendar } from 'lucide-react';

const TitreTransportManager = ({ dossierId }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [form, setForm] = useState({
        NumeroTitreTransport: '',
        Consignee: '',
        Notify: '',
        LieuReception: '',
        LieuPaiementFret: '',
        NbreBLOriginaux: 0,
        NombreConteneurs: 0,
        Fournisseur: '',
        DureeFranchise: 0,
        TypeTitreTransport: '',
        AdresseLivraisonFinale: '',
        Expediteur: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await billOfLadingAPI.getByDossier(dossierId);
                if (res.data) {
                    setForm(res.data);
                }
            } catch (err) {
                console.error('Error fetching bill of lading:', err);
                showMsg('Erreur lors du chargement des données', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [dossierId]);

    const showMsg = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'number' ? parseInt(value) || 0 : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await billOfLadingAPI.save({ ...form, idbl: dossierId });
            showMsg('Titre de transport enregistré avec succès', 'success');
        } catch (err) {
            console.error('Error saving bill of lading:', err);
            showMsg('Erreur lors de l\'enregistrement', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;

    return (
        <div className="titre-transport-manager">
            <style>{`
                .titre-transport-manager { padding: 1.5rem; }
                .grid-form { display: grid; grid-template-columns: repeat(12, 1fr); gap: 1.5rem; }
                .col-4 { grid-column: span 4; }
                .col-6 { grid-column: span 6; }
                .col-12 { grid-column: span 12; }
                
                .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .form-group label { font-size: 0.75rem; font-weight: 700; color: var(--slate-500); text-transform: uppercase; }
                
                .premium-input, .premium-textarea {
                    padding: 0.75rem 1rem;
                    border: 1px solid var(--border);
                    border-radius: 0.75rem;
                    background: var(--slate-50);
                    font-size: 0.875rem;
                    outline: none;
                    transition: all 0.2s;
                }
                .premium-input:focus { border-color: var(--primary); background: white; box-shadow: 0 0 0 4px var(--primary-light); }
                
                .section-header { display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-light); }
                .section-title { font-size: 0.875rem; font-weight: 800; color: var(--primary); text-transform: uppercase; }

                .save-bar { margin-top: 2rem; display: flex; justify-content: flex-end; padding-top: 1.5rem; border-top: 1px solid var(--border-light); }
                .btn-save { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 2rem; background: var(--primary); color: white; border: none; border-radius: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
                
                .alert { padding: 1rem; border-radius: 0.75rem; margin-bottom: 1.5rem; font-weight: 600; font-size: 0.875rem; }
                .alert-success { background: #ecfdf5; color: #10b981; border: 1px solid #10b98133; }
                .alert-error { background: #fef2f2; color: #ef4444; border: 1px solid #ef444433; }
            `}</style>

            {message.text && (<div className={`alert alert-${message.type}`}>{message.text}</div>)}

            <form onSubmit={handleSubmit}>

                <div className="section-header" style={{ marginTop: 0 }}>
                    <FileText size={18} />
                    <span className="section-title">Informations Principales</span>
                </div>

                <div className="grid-form">
                    <div className="form-group col-4">
                        <label>Numéro Titre Transport</label>
                        <input name="NumeroTitreTransport" className="premium-input" value={form.NumeroTitreTransport} onChange={handleChange} />
                    </div>
                    <div className="form-group col-4">
                        <label>Type Titre Transport</label>
                        <input name="TypeTitreTransport" className="premium-input" value={form.TypeTitreTransport} onChange={handleChange} placeholder="ex: N, BL..." />
                    </div>
                    <div className="form-group col-4">
                        <label>Fournisseur</label>
                        <input name="Fournisseur" className="premium-input" value={form.Fournisseur} onChange={handleChange} />
                    </div>

                    <div className="form-group col-6">
                        <label>Consignee</label>
                        <input name="Consignee" className="premium-input" value={form.Consignee} onChange={handleChange} />
                    </div>
                    <div className="form-group col-6">
                        <label>Notify Client</label>
                        <input name="Notify" className="premium-input" value={form.Notify} onChange={handleChange} />
                    </div>

                    <div className="form-group col-6">
                        <label>Expéditeur</label>
                        <input name="Expediteur" className="premium-input" value={form.Expediteur} onChange={handleChange} />
                    </div>

                    <div className="form-group col-12">
                        <label>Adresse de Livraison Finale</label>
                        <input name="AdresseLivraisonFinale" className="premium-input" value={form.AdresseLivraisonFinale} onChange={handleChange} />
                    </div>
                </div>

                <div className="section-header">
                    <MapPin size={18} />
                    <span className="section-title">Logistique & Lieux</span>
                </div>

                <div className="grid-form">
                    <div className="form-group col-6">
                        <label>Lieu de Réception</label>
                        <input name="LieuReception" className="premium-input" value={form.LieuReception} onChange={handleChange} />
                    </div>
                    <div className="form-group col-6">
                        <label>Lieu de Paiement Fret</label>
                        <input name="LieuPaiementFret" className="premium-input" value={form.LieuPaiementFret} onChange={handleChange} />
                    </div>

                    <div className="form-group col-4">
                        <label>Nbre BL Originaux</label>
                        <input type="number" name="NbreBLOriginaux" className="premium-input" value={form.NbreBLOriginaux} onChange={handleChange} />
                    </div>
                    <div className="form-group col-4">
                        <label>Nombre Conteneurs</label>
                        <input type="number" name="NombreConteneurs" className="premium-input" value={form.NombreConteneurs} onChange={handleChange} />
                    </div>
                    <div className="form-group col-4">
                        <label>Durée Franchise (Jours)</label>
                        <input type="number" name="DureeFranchise" className="premium-input" value={form.DureeFranchise} onChange={handleChange} />
                    </div>
                </div>

                <div className="save-bar">
                    <button type="submit" className="btn-save" disabled={saving}>
                        <Save size={18} />
                        {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>

            </form>
        </div>
    );
};

export default TitreTransportManager;
