import React, { useState, useEffect, useMemo } from 'react';
import { getReferenceSymbol } from '../../utils/currency';
import {
    Plus, Trash2, Calculator, FileText, CheckCircle, Info, Search,
    ChevronRight, Printer, Building, FileDigit, ShieldCheck, Truck,
    RefreshCw, X, Edit2, Check, AlertCircle, ArrowRightCircle,
    FileCheck2, XCircle, Clock, LayoutGrid
} from 'lucide-react';
import { devisClientAPI, facturesAPI, rubriquesAPI, dossiersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Acceptee: 0 = brouillon, 1 = accepté, -1 = refusé
const STATUT_CONFIG = {
    0: { label: 'BROUILLON', color: '#64748b', bg: 'rgba(100,116,139,0.15)', icon: <Clock size={12} /> },
    1: { label: 'ACCEPTÉ', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: <CheckCircle size={12} /> },
    '-1': { label: 'REFUSÉ', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: <XCircle size={12} /> }
};

const DevisManager = ({ dossierId }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [rubriques, setRubriques] = useState([]);
    const [selectedRubriques, setSelectedRubriques] = useState([]);
    const [devisList, setDevisList] = useState([]);
    const [dossier, setDossier] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Conversion mode
    const [isConverting, setIsConverting] = useState(false);
    const [selectedDevisForConversion, setSelectedDevisForConversion] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [rubRes, dosRes, devisRes] = await Promise.all([
                rubriquesAPI.getAll().catch(() => ({ data: [] })),
                dossiersAPI.getOne(dossierId).catch(() => ({ data: null })),
                devisClientAPI.getByDossier(dossierId).catch(() => ({ data: [] }))
            ]);
            setRubriques(Array.isArray(rubRes.data) ? rubRes.data : []);
            setDossier(dosRes.data);
            setDevisList(Array.isArray(devisRes.data) ? devisRes.data : []);
        } catch (err) {
            console.error('Erreur chargement devis:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dossierId) fetchData();
    }, [dossierId]);

    // ─── Filtrage rubriques ───────────────────────────────────────────────────
    const availableRubriques = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return rubriques.filter(r =>
            (r.CodeRubrique || '').toString().toLowerCase().includes(q) ||
            (r.libelleRubrique || '').toLowerCase().includes(q)
        );
    }, [rubriques, searchQuery]);

    // ─── Calcul totaux ────────────────────────────────────────────────────────
    const totals = useMemo(() => {
        let douane = 0, debours = 0, prestations = 0, tva = 0;
        selectedRubriques.forEach(r => {
            const amount = Number(r.montant) || 0;
            const code = String(r.CodeRubrique || '');
            if (code.startsWith('10')) douane += amount;
            else if (code.startsWith('11')) debours += amount;
            else if (code.startsWith('40')) { prestations += amount; tva += amount * 0.18; }
        });
        const ht = douane + debours + prestations;
        return { douane, debours, prestations, tva, ht, ttc: ht + tva };
    }, [selectedRubriques]);

    // ─── ACTIONS ──────────────────────────────────────────────────────────────
    const handleAddRubrique = (rub) => {
        if (selectedRubriques.find(r => r.IDRubriques === rub.IDRubriques)) return;
        setSelectedRubriques(prev => [...prev, { ...rub, montant: 0, complement: '' }]);
    };

    const handleRemoveRubrique = (id) => {
        setSelectedRubriques(prev => prev.filter(r => r.IDRubriques !== id));
    };

    const handleUpdateAmount = (id, val) => {
        setSelectedRubriques(prev => prev.map(r =>
            r.IDRubriques === id ? { ...r, montant: parseFloat(val) || 0 } : r
        ));
    };

    const handleUpdateComplement = (id, val) => {
        setSelectedRubriques(prev => prev.map(r =>
            r.IDRubriques === id ? { ...r, complement: val } : r
        ));
    };

    const handleCreateDevis = async () => {
        if (selectedRubriques.length === 0) return alert('Veuillez ajouter au moins une rubrique.');

        try {
            setLoading(true);
            const data = {
                idDossier: dossierId,
                rubriques: selectedRubriques.map(r => ({
                    idRubrique: r.IDRubriques,
                    code: r.CodeRubrique,
                    libelle: r.libelleRubrique,
                    montant: r.montant,
                    complement: r.complement
                })),
                idAgent: user?.id || 0,
                observations: `Devis généré via interface.`
            };

            const res = await devisClientAPI.create(data);
            const idCotation = res.data.idCotation;

            // Ouvrir le PDF du devis
            const pdfRes = await devisClientAPI.generatePDF(idCotation);
            const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
            window.open(URL.createObjectURL(blob));

            setSelectedRubriques([]);
            fetchData();
        } catch (err) {
            console.error('Erreur création devis:', err);
            alert('Erreur : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleViewPDF = async (id) => {
        try {
            setLoading(true);
            const res = await devisClientAPI.generatePDF(id);
            const blob = new Blob([res.data], { type: 'application/pdf' });
            window.open(URL.createObjectURL(blob));
        } catch (err) {
            alert('Erreur PDF : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDevis = async (id, numero) => {
        if (!window.confirm(`Supprimer le devis ${numero} ?`)) return;
        try {
            setLoading(true);
            await devisClientAPI.delete(id);
            fetchData();
        } catch (err) {
            alert('Erreur : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleChangeStatut = async (id, acceptee) => {
        try {
            setLoading(true);
            await devisClientAPI.accepter(id, acceptee);
            fetchData();
        } catch (err) {
            alert('Erreur : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Charger les rubriques du devis pour conversion
    const handlePrepareConversion = async (devis) => {
        try {
            setLoading(true);
            const res = await devisClientAPI.getOne(devis.IDCotations);
            const data = res.data;
            if (data.rubriques && Array.isArray(data.rubriques)) {
                setSelectedRubriques(data.rubriques.map(r => ({
                    IDRubriques: r.IDRubriques,
                    CodeRubrique: r.CodeRubrique,
                    libelleRubrique: r.libelleRubrique,
                    montant: parseFloat(r.MontantHTCotation) || 0,
                    complement: r.Complement || ''
                })));
            }
            setSelectedDevisForConversion(devis);
            setIsConverting(true);
        } catch (err) {
            alert('Erreur chargement devis : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleConvertir = async () => {
        if (!selectedDevisForConversion) return;
        if (selectedRubriques.length === 0) return alert('Veuillez ajouter au moins une rubrique.');

        try {
            setLoading(true);
            const data = {
                idAgent: user?.id || 0,
                observations: `Facture issue du devis ${selectedDevisForConversion.NumeroCotation}`,
                rubriques: selectedRubriques.map(r => ({
                    idRubrique: r.IDRubriques,
                    code: r.CodeRubrique,
                    libelle: r.libelleRubrique,
                    montant: r.montant,
                    complement: r.complement
                }))
            };

            const res = await devisClientAPI.convertir(selectedDevisForConversion.IDCotations, data);
            const idFacture = res.data.idFacture;

            // Ouvrir le PDF de la facture créée
            const pdfRes = await facturesAPI.generatePDF(idFacture);
            const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
            window.open(URL.createObjectURL(blob));

            setIsConverting(false);
            setSelectedDevisForConversion(null);
            setSelectedRubriques([]);
            fetchData();
            alert(`Facture ${res.data.numeroFacture} créée avec succès !`);
        } catch (err) {
            alert('Erreur conversion : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleCancelConversion = () => {
        setIsConverting(false);
        setSelectedDevisForConversion(null);
        setSelectedRubriques([]);
    };

    if (loading && rubriques.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <div className="fm-spinner"></div>
            </div>
        );
    }

    const mainHeaderBg = isConverting ? '#1d4ed8' : '#0f4c81';

    return (
        <div className="dm-container">
            <style>{`
                .dm-container { display: flex; height: 750px; background: var(--bg); border: 1px solid var(--border); border-radius: 1rem; overflow: hidden; color: var(--slate-800); font-size: 14px; }

                /* Sidebar */
                .dm-sidebar { width: 260px; background: #0a2540; display: flex; flex-direction: column; padding: 1.5rem; border-right: 1px solid #1e3a5f; color: white; }
                .dm-sidebar-title { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem; font-weight: 800; letter-spacing: 0.05em; color: white; }
                .dm-sidebar-icon { background: #0f6cbd; padding: 0.5rem; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; }

                .dm-section-label { font-size: 10px; font-weight: 700; color: #4a6080; text-transform: uppercase; margin-bottom: 0.75rem; display: block; letter-spacing: 0.1em; }
                .dm-history-list { display: flex; flex-direction: column; gap: 0.35rem; overflow-y: auto; flex: 1; }
                .dm-history-row { border-radius: 0.5rem; overflow: hidden; border: 1px solid #1e3a5f; transition: all 0.2s; }
                .dm-history-main { background: #0d2137; padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.3rem; }
                .dm-history-numero { font-size: 12px; font-weight: 800; color: white; display: flex; align-items: center; gap: 0.4rem; }
                .dm-history-date { font-size: 10px; color: #4a6080; }
                .dm-statut-badge { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.5rem; border-radius: 999px; font-size: 10px; font-weight: 700; }
                .dm-history-actions { display: flex; gap: 0.25rem; padding: 0.4rem 0.5rem; background: #071929; border-top: 1px solid #1e3a5f; }
                .dm-action-btn { flex: 1; padding: 0.3rem; border: none; border-radius: 0.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; transition: all 0.15s; gap: 0.25rem; }
                .dm-btn-pdf { background: #1e3a5f; color: #60a5fa; }
                .dm-btn-pdf:hover { background: #2563eb; color: white; }
                .dm-btn-accept { background: rgba(16,185,129,0.1); color: #10b981; }
                .dm-btn-accept:hover { background: #10b981; color: white; }
                .dm-btn-refuse { background: rgba(239,68,68,0.1); color: #ef4444; }
                .dm-btn-refuse:hover { background: #ef4444; color: white; }
                .dm-btn-convert { background: rgba(59,130,246,0.15); color: #60a5fa; }
                .dm-btn-convert:hover { background: #1d4ed8; color: white; }
                .dm-btn-delete { background: rgba(239,68,68,0.1); color: #ef4444; }
                .dm-btn-delete:hover { background: #ef4444; color: white; }
                .dm-btn-reset { background: rgba(100,116,139,0.15); color: #94a3b8; }
                .dm-btn-reset:hover { background: #475569; color: white; }

                /* Main */
                .dm-main { flex: 1; display: flex; flex-direction: column; background: white; min-width: 0; }
                .dm-header { padding: 0.85rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: white; }
                .dm-header-info { display: flex; align-items: center; gap: 0.75rem; background: var(--slate-50); padding: 0.5rem 1rem; border-radius: 0.75rem; border: 1px solid var(--border); }
                .dm-box-label { font-size: 10px; font-weight: 700; color: var(--slate-400); text-transform: uppercase; }
                .dm-box-value { font-weight: 800; font-size: 13px; color: var(--slate-900); }

                .dm-workspace { flex: 1; display: flex; padding: 1rem; gap: 1rem; overflow: hidden; }

                /* Panneau gauche (rubriques) */
                .dm-source-panel { width: 40%; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 0.75rem; overflow: hidden; background: var(--slate-50); }
                .dm-panel-header { padding: 0.75rem 1rem; background: white; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
                .dm-panel-title { font-size: 11px; font-weight: 700; color: var(--slate-600); text-transform: uppercase; }
                .dm-search-wrap { position: relative; }
                .dm-search-input { padding: 0.4rem 0.5rem 0.4rem 2rem; border-radius: 0.5rem; border: 1px solid var(--border); font-size: 11px; outline: none; width: 140px; }
                .dm-search-icon { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: var(--slate-400); }
                .dm-table { width: 100%; border-collapse: collapse; }
                .dm-table th { padding: 0.5rem 1rem; background: var(--slate-100); text-align: left; font-size: 10px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; border-bottom: 1px solid var(--border); position: sticky; top: 0; }
                .dm-table td { padding: 0.6rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
                .dm-row-selected { background: #f8fafc; opacity: 0.6; }
                .dm-add-btn { padding: 0.4rem; border-radius: 0.4rem; background: #e0f2fe; color: #0284c7; border: none; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; }
                .dm-add-btn:hover { background: #0284c7; color: white; }

                /* Panneau droit (contenu) */
                .dm-content-panel { flex: 1; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 0.75rem; overflow: hidden; background: white; }
                .dm-content-header { padding: 0.75rem 1rem; color: white; display: flex; justify-content: space-between; align-items: center; }
                .dm-content-table { flex: 1; overflow-y: auto; }
                .dm-input-amount { width: 100px; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 0.4rem; font-size: 12px; font-weight: 700; text-align: right; outline: none; }
                .dm-input-complement { width: 100%; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 0.4rem; font-size: 11px; outline: none; }
                .dm-remove-btn { padding: 0.4rem; border-radius: 0.4rem; background: transparent; color: var(--slate-300); border: none; cursor: pointer; transition: all 0.2s; }
                .dm-remove-btn:hover { color: #f43f5e; background: #fff1f2; }

                /* Footer */
                .dm-footer { padding: 1.25rem 1.5rem; background: #0a2540; color: white; border-top: 1px solid #1e3a5f; }
                .dm-totals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1rem; margin-bottom: 1rem; }
                .dm-total-row { display: flex; justify-content: space-between; font-size: 11px; border-bottom: 1px solid #1e3a5f; padding-bottom: 0.4rem; }
                .dm-final-ttc { display: flex; justify-content: space-between; font-weight: 800; font-size: 17px; color: #38bdf8; margin-top: 0.5rem; }
                .dm-submit-btn { width: 100%; padding: 0.875rem; border: none; border-radius: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 0.75rem; font-size: 13px; }
                .dm-submit-btn.create { background: #0f6cbd; color: white; box-shadow: 0 8px 20px rgba(15,108,189,0.4); }
                .dm-submit-btn.create:hover:not(:disabled) { background: #0d5ba3; transform: translateY(-2px); }
                .dm-submit-btn.convert { background: #1d4ed8; color: white; box-shadow: 0 8px 20px rgba(29,78,216,0.4); }
                .dm-submit-btn.convert:hover:not(:disabled) { background: #1e40af; transform: translateY(-2px); }
                .dm-submit-btn:disabled { background: #1e3a5f; color: #4a6080; cursor: not-allowed; box-shadow: none; }

                .dm-empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--slate-400); text-align: center; padding: 3rem; }
                .dm-convert-banner { background: rgba(29,78,216,0.1); border: 1px solid rgba(29,78,216,0.3); border-radius: 0.5rem; padding: 0.6rem 1rem; margin-bottom: 0.75rem; font-size: 11px; color: #60a5fa; display: flex; align-items: center; gap: 0.5rem; font-weight: 700; }
            `}</style>

            {/* ── SIDEBAR ── */}
            <div className="dm-sidebar">
                <div className="dm-sidebar-title">
                    <div className="dm-sidebar-icon"><FileCheck2 size={20} /></div>
                    <span>DEVIS</span>
                </div>

                <span className="dm-section-label">Historique des devis</span>
                <div className="dm-history-list">
                    {devisList.length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#4a6080', padding: '1rem', border: '1px dashed #1e3a5f', borderRadius: '0.5rem', textAlign: 'center' }}>
                            Aucun devis
                        </div>
                    ) : (
                        devisList.map(d => {
                            const statut = STATUT_CONFIG[d.Acceptee] || STATUT_CONFIG[0];
                            const dateStr = d.DateCotation ? new Date(d.DateCotation).toLocaleDateString('fr-FR') : '';
                            const isAccepted = Number(d.Acceptee) === 1;
                            const isRefused = Number(d.Acceptee) === -1;
                            const isDraft = Number(d.Acceptee) === 0;
                            return (
                                <div key={d.IDCotations} className="dm-history-row">
                                    <div className="dm-history-main">
                                        <div className="dm-history-numero">
                                            <FileDigit size={14} />
                                            {d.NumeroCotation}
                                        </div>
                                        <div className="dm-history-date">{dateStr}</div>
                                        <span
                                            className="dm-statut-badge"
                                            style={{ color: statut.color, background: statut.bg }}
                                        >
                                            {statut.icon} {statut.label}
                                        </span>
                                    </div>
                                    <div className="dm-history-actions">
                                        <button className="dm-action-btn dm-btn-pdf" onClick={() => handleViewPDF(d.IDCotations)} title="Voir PDF">
                                            <Printer size={11} />
                                        </button>
                                        {!isAccepted && !isRefused && (
                                            <button className="dm-action-btn dm-btn-accept" onClick={() => handleChangeStatut(d.IDCotations, 1)} title="Marquer Accepté">
                                                <Check size={11} />
                                            </button>
                                        )}
                                        {!isRefused && (
                                            <button className="dm-action-btn dm-btn-refuse" onClick={() => handleChangeStatut(d.IDCotations, -1)} title="Marquer Refusé">
                                                <X size={11} />
                                            </button>
                                        )}
                                        {isRefused && (
                                            <button className="dm-action-btn dm-btn-reset" onClick={() => handleChangeStatut(d.IDCotations, 0)} title="Remettre en brouillon">
                                                <RefreshCw size={11} />
                                            </button>
                                        )}
                                        {isAccepted && (
                                            <button className="dm-action-btn dm-btn-convert" onClick={() => handlePrepareConversion(d)} title="Convertir en Facture">
                                                <ArrowRightCircle size={11} />
                                            </button>
                                        )}
                                        {isDraft && (
                                            <button className="dm-action-btn dm-btn-delete" onClick={() => handleDeleteDevis(d.IDCotations, d.NumeroCotation)} title="Supprimer">
                                                <Trash2 size={11} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #1e3a5f', paddingTop: '1rem', opacity: 0.7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 10 }}>
                            {user?.name?.substring(0, 2) || 'AG'}
                        </div>
                        <div>
                            <p style={{ fontSize: 9, color: '#4a6080', fontWeight: 800, margin: 0 }}>UTILISATEUR</p>
                            <p style={{ fontSize: 12, margin: 0 }}>{user?.name || 'Agent'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── MAIN ── */}
            <div className="dm-main">
                <div className="dm-header">
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div className="dm-header-info">
                            <Building size={16} />
                            <div>
                                <p className="dm-box-label">Client</p>
                                <p className="dm-box-value">{dossier?.NomClient || dossier?.clientName || '...'}</p>
                            </div>
                        </div>
                        <div className="dm-header-info">
                            <FileText size={16} />
                            <div>
                                <p className="dm-box-label">Dossier</p>
                                <p className="dm-box-value">{dossier?.code || dossierId}</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={fetchData} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}>
                        <RefreshCw size={20} />
                    </button>
                </div>

                <div className="dm-workspace">
                    {/* Panneau gauche : rubriques */}
                    <div className="dm-source-panel">
                        <div className="dm-panel-header">
                            <span className="dm-panel-title">Rubriques disponibles</span>
                            <div className="dm-search-wrap">
                                <Search className="dm-search-icon" size={12} />
                                <input
                                    className="dm-search-input"
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="dm-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, textAlign: 'center' }}>Sél.</th>
                                        <th style={{ width: 80 }}>Code</th>
                                        <th>Libellé</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {availableRubriques.map(r => {
                                        const isSelected = selectedRubriques.some(sr => sr.IDRubriques === r.IDRubriques);
                                        return (
                                            <tr key={r.IDRubriques} className={isSelected ? 'dm-row-selected' : ''}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        disabled={isSelected}
                                                        onChange={() => !isSelected && handleAddRubrique(r)}
                                                        style={{ cursor: isSelected ? 'not-allowed' : 'pointer', width: 16, height: 16 }}
                                                    />
                                                </td>
                                                <td style={{ fontFamily: 'monospace' }}>{r.CodeRubrique}</td>
                                                <td style={{ fontWeight: isSelected ? 700 : 400 }}>{r.libelleRubrique}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    </div>

                    {/* Panneau droit : contenu du devis */}
                    <div className="dm-content-panel">
                        <div className="dm-content-header" style={{ background: mainHeaderBg }}>
                            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                                {isConverting
                                    ? `Conversion du devis ${selectedDevisForConversion?.NumeroCotation} en Facture`
                                    : 'Contenu du Devis'}
                            </span>
                            {isConverting && (
                                <button
                                    onClick={handleCancelConversion}
                                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '0.35rem 0.7rem', borderRadius: '0.4rem', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
                                >
                                    ANNULER
                                </button>
                            )}
                        </div>
                        <div className="dm-content-table">
                            {selectedRubriques.length === 0 ? (
                                <div className="dm-empty-state">
                                    <FileText size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                    <p style={{ fontWeight: 600, margin: 0 }}>Sélectionnez des rubriques</p>
                                    <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: '0.25rem' }}>Cochez des rubriques dans le panneau de gauche</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="dm-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 30 }}></th>
                                            <th style={{ width: 70 }}>Code</th>
                                            <th>Libellé</th>
                                            <th style={{ width: 150 }}>Complément</th>
                                            <th style={{ width: 120, textAlign: 'right' }}>Montant HT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedRubriques.map(r => (
                                            <tr key={r.IDRubriques}>
                                                <td>
                                                    <button className="dm-remove-btn" onClick={() => handleRemoveRubrique(r.IDRubriques)}>
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.CodeRubrique}</td>
                                                <td style={{ fontWeight: 600, fontSize: 12 }}>{r.libelleRubrique}</td>
                                                <td>
                                                    <input
                                                        className="dm-input-complement"
                                                        value={r.complement || ''}
                                                        onChange={e => handleUpdateComplement(r.IDRubriques, e.target.value)}
                                                        placeholder="Complément..."
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <input
                                                        className="dm-input-amount"
                                                        type="number"
                                                        value={r.montant || ''}
                                                        onChange={e => handleUpdateAmount(r.IDRubriques, e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            )}
                        </div>

                        {/* Footer avec totaux et bouton */}
                        <div className="dm-footer">
                            {isConverting && (
                                <div className="dm-convert-banner">
                                    <ArrowRightCircle size={14} />
                                    Modifiez les montants si nécessaire, puis confirmez pour créer la facture.
                                </div>
                            )}
                            <div className="dm-totals-grid">
                                <div>
                                    <div className="dm-total-row"><span>Douane (10xx)</span><span>{totals.douane.toLocaleString('fr-FR')} {getReferenceSymbol()}</span></div>
                                    <div className="dm-total-row"><span>Débours (11xx)</span><span>{totals.debours.toLocaleString('fr-FR')} {getReferenceSymbol()}</span></div>
                                </div>
                                <div>
                                    <div className="dm-total-row"><span>Prestations (40xx)</span><span>{totals.prestations.toLocaleString('fr-FR')} {getReferenceSymbol()}</span></div>
                                    <div className="dm-total-row"><span>TVA (18%)</span><span>{totals.tva.toLocaleString('fr-FR')} {getReferenceSymbol()}</span></div>
                                </div>
                            </div>
                            <div className="dm-final-ttc">
                                <span>TOTAL TTC</span>
                                <span>{totals.ttc.toLocaleString('fr-FR')} {getReferenceSymbol()}</span>
                            </div>
                            <div style={{ marginTop: '1rem' }}>
                                {isConverting ? (
                                    <button
                                        className="dm-submit-btn convert"
                                        disabled={selectedRubriques.length === 0 || loading}
                                        onClick={handleConvertir}
                                    >
                                        <ArrowRightCircle size={18} />
                                        {loading ? 'Création de la facture...' : 'Confirmer et Créer la Facture'}
                                    </button>
                                ) : (
                                    <button
                                        className="dm-submit-btn create"
                                        disabled={selectedRubriques.length === 0 || loading}
                                        onClick={handleCreateDevis}
                                    >
                                        <FileCheck2 size={18} />
                                        {loading ? 'Génération...' : 'Générer le Devis CT'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DevisManager;
