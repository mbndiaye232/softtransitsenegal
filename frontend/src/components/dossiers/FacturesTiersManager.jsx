import React, { useState, useEffect, useMemo } from 'react';
import { getReferenceSymbol } from '../../utils/currency';
import {
    Plus, Trash2, Edit2, Check, X, Search, RefreshCw,
    Building2, FileText, DollarSign, Info, Receipt, Save,
    ChevronDown, AlertCircle
} from 'lucide-react';
import { facturesRecuesAPI, tiersAPI, rubriquesAPI, dossiersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const FacturesTiersManager = ({ dossierId }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [lignes, setLignes] = useState([]);        // lignes existantes
    const [tiers, setTiers] = useState([]);          // liste des tiers
    const [rubriques, setRubriques] = useState([]);  // rubriques 11xx uniquement
    const [dossier, setDossier] = useState(null);
    const [editingId, setEditingId] = useState(null); // id en cours d'édition

    // Formulaire
    const EMPTY_FORM = {
        idTiers: '',
        idRubrique: '',
        codeRubrique: '',
        libelleRubrique: '',
        montantTTC: '',
        numeroFacture: '',
        observations: ''
    };
    const [form, setForm] = useState(EMPTY_FORM);
    const [rubriqueSearch, setRubriqueSearch] = useState('');
    const [showRubriqueDropdown, setShowRubriqueDropdown] = useState(false);

    // ── fetch ───────────────────────────────────────────────
    const fetchData = async () => {
        try {
            setLoading(true);
            const [lignesRes, tiersRes, rubRes, dosRes] = await Promise.all([
                facturesRecuesAPI.getByDossier(dossierId).catch(() => ({ data: [] })),
                tiersAPI.getAll().catch(() => ({ data: [] })),
                rubriquesAPI.getAll().catch(() => ({ data: [] })),
                dossiersAPI.getOne(dossierId).catch(() => ({ data: null }))
            ]);
            setLignes(Array.isArray(lignesRes.data) ? lignesRes.data : []);
            setTiers(Array.isArray(tiersRes.data) ? tiersRes.data : []);
            // filtrer uniquement rubriques code 11xx
            const all = Array.isArray(rubRes.data) ? rubRes.data : [];
            setRubriques(all.filter(r => String(r.CodeRubrique || '').startsWith('11')));
            setDossier(dosRes.data);
        } catch (err) {
            console.error('Erreur fetchData FacturesTiersManager:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (dossierId) fetchData(); }, [dossierId]);

    // ── rubriques filtrées ───────────────────────────────────
    const rubriquesFiltered = useMemo(() => {
        const q = rubriqueSearch.toLowerCase();
        return rubriques.filter(r =>
            String(r.CodeRubrique || '').toLowerCase().includes(q) ||
            String(r.libelleRubrique || '').toLowerCase().includes(q)
        );
    }, [rubriques, rubriqueSearch]);

    // ── handlers formulaire ───────────────────────────────────
    const handleChange = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    const handleSelectRubrique = (r) => {
        setForm(prev => ({
            ...prev,
            idRubrique: r.IDRubriques,
            codeRubrique: r.CodeRubrique,
            libelleRubrique: r.libelleRubrique
        }));
        setRubriqueSearch(`${r.CodeRubrique} – ${r.libelleRubrique}`);
        setShowRubriqueDropdown(false);
    };

    const handleEditLine = (ligne) => {
        setEditingId(ligne.IDFacturesRecues);
        setForm({
            idTiers: ligne.IDTiers || '',
            idRubrique: ligne.IDRubriques || '',
            codeRubrique: ligne.CodeRubrique || '',
            libelleRubrique: ligne.libelleRubrique || '',
            montantTTC: ligne.MontantTTC || '',
            numeroFacture: ligne.NumeroFacture || '',
            observations: ligne.Observations || ''
        });
        setRubriqueSearch(`${ligne.CodeRubrique} – ${ligne.libelleRubrique}`);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setRubriqueSearch('');
    };

    const handleSave = async () => {
        if (!form.idRubrique || !form.montantTTC) {
            alert('La rubrique et le montant TTC sont requis.');
            return;
        }

        const payload = {
            idDossier: dossierId,
            idTiers: form.idTiers || null,
            idRubrique: form.idRubrique,
            codeRubrique: form.codeRubrique,
            libelleRubrique: form.libelleRubrique,
            montantTTC: parseFloat(form.montantTTC),
            numeroFacture: form.numeroFacture || null,
            observations: form.observations || null
        };

        try {
            setLoading(true);
            if (editingId) {
                await facturesRecuesAPI.update(editingId, payload);
            } else {
                await facturesRecuesAPI.create(payload);
            }
            handleCancelEdit();
            await fetchData();
        } catch (err) {
            alert('Erreur : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, numFact) => {
        if (!window.confirm(`Supprimer la facture ${numFact || '#' + id} ?`)) return;
        try {
            setLoading(true);
            await facturesRecuesAPI.delete(id);
            await fetchData();
        } catch (err) {
            alert('Erreur : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    // ── Totaux par rubrique ─────────────────────────────────
    const totalParRubrique = useMemo(() => {
        const map = {};
        lignes.forEach(l => {
            const key = l.CodeRubrique;
            if (!map[key]) map[key] = { code: key, libelle: l.libelleRubrique, total: 0, nb: 0 };
            map[key].total += parseFloat(l.MontantTTC || 0);
            map[key].nb++;
        });
        return Object.values(map).sort((a, b) => a.code.localeCompare(b.code));
    }, [lignes]);

    const grandTotal = lignes.reduce((s, l) => s + parseFloat(l.MontantTTC || 0), 0);

    const fmt = (n) => Number(n).toLocaleString('fr-FR') + ' ' + getReferenceSymbol();

    return (
        <div className="ftm-container">
            <style>{`
                .ftm-container { display: flex; gap: 1.5rem; min-height: 700px; font-size: 14px; font-family: 'Inter', sans-serif; }

                /* ── FORMULAIRE (gauche) ── */
                .ftm-form-panel { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; gap: 1rem; }
                .ftm-card { background: white; border: 1px solid var(--border); border-radius: 1rem; padding: 1.25rem; box-shadow: var(--shadow-sm); }
                .ftm-card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--slate-500); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
                .ftm-field { margin-bottom: 0.9rem; }
                .ftm-label { display: block; font-size: 11px; font-weight: 700; color: var(--slate-600); margin-bottom: 0.35rem; }
                .ftm-input, .ftm-select { width: 100%; padding: 0.65rem 0.85rem; border: 1px solid var(--border); border-radius: 0.5rem; font-size: 13px; outline: none; background: #fafafa; transition: border-color 0.2s; box-sizing: border-box; }
                .ftm-input:focus, .ftm-select:focus { border-color: var(--primary); background: white; }
                .ftm-rubrique-wrap { position: relative; }
                .ftm-rubrique-dropdown { position: absolute; z-index: 100; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--border); border-radius: 0.5rem; box-shadow: 0 8px 24px rgba(0,0,0,0.1); max-height: 220px; overflow-y: auto; margin-top: 4px; }
                .ftm-rubrique-item { padding: 0.6rem 0.85rem; font-size: 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; gap: 0.75rem; align-items: center; }
                .ftm-rubrique-item:hover { background: #eff6ff; }
                .ftm-rubrique-code { font-family: monospace; font-weight: 800; color: #6366f1; min-width: 50px; }
                .ftm-rubrique-lib { color: var(--slate-700); }

                .ftm-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
                .ftm-btn { flex: 1; padding: 0.75rem; border: none; border-radius: 0.5rem; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
                .ftm-btn-primary { background: #2563eb; color: white; }
                .ftm-btn-primary:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); }
                .ftm-btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
                .ftm-btn-secondary { background: #f1f5f9; color: #475569; }
                .ftm-btn-secondary:hover { background: #e2e8f0; }

                /* Récap totaux */
                .ftm-recap { background: #0f172a; color: white; border-radius: 1rem; padding: 1.25rem; }
                .ftm-recap-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.08em; margin-bottom: 0.75rem; }
                .ftm-recap-row { display: flex; justify-content: space-between; font-size: 12px; padding: 0.4rem 0; border-bottom: 1px solid #1e293b; }
                .ftm-recap-total { display: flex; justify-content: space-between; font-weight: 800; font-size: 16px; color: #38bdf8; margin-top: 0.75rem; }

                /* ── TABLEAU (droite) ── */
                .ftm-table-panel { flex: 1; display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
                .ftm-table-header { display: flex; justify-content: space-between; align-items: center; }
                .ftm-table-title { font-size: 14px; font-weight: 800; color: var(--slate-800); display: flex; align-items: center; gap: 0.5rem; }
                .ftm-dossier-badge { font-size: 11px; background: #eff6ff; color: #2563eb; padding: 0.3rem 0.75rem; border-radius: 999px; font-weight: 700; }

                .ftm-table-wrap { background: white; border: 1px solid var(--border); border-radius: 1rem; overflow: hidden; flex: 1; }
                .ftm-table { width: 100%; border-collapse: collapse; }
                .ftm-table th { padding: 0.75rem 1rem; background: #f8fafc; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
                .ftm-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
                .ftm-table tr:last-child td { border-bottom: none; }
                .ftm-table tr:hover td { background: #f8fafc; }
                .ftm-table tr.editing td { background: #eff6ff; }

                .ftm-rubr-badge { display: inline-flex; align-items: center; gap: 0.35rem; background: #f5f3ff; color: #7c3aed; padding: 0.2rem 0.5rem; border-radius: 0.35rem; font-family: monospace; font-size: 11px; font-weight: 800; }
                .ftm-amount { font-weight: 800; color: #0f172a; font-size: 13px; }
                .ftm-tiers-name { font-weight: 600; color: #334155; }
                .ftm-no-fact { color: #94a3b8; font-size: 11px; }
                .ftm-obs { font-size: 11px; color: #64748b; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

                .ftm-icon-btn { padding: 0.4rem; border: none; border-radius: 0.4rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
                .ftm-icon-btn.edit { background: #eff6ff; color: #2563eb; }
                .ftm-icon-btn.edit:hover { background: #2563eb; color: white; }
                .ftm-icon-btn.del { background: #fff1f2; color: #f43f5e; }
                .ftm-icon-btn.del:hover { background: #f43f5e; color: white; }

                .ftm-empty { padding: 4rem; text-align: center; color: #94a3b8; }
                .ftm-loading-overlay { opacity: 0.5; pointer-events: none; }
            `}</style>

            {/* ── PANNEAU GAUCHE : formulaire ── */}
            <div className="ftm-form-panel">
                <div className="ftm-card">
                    <div className="ftm-card-title">
                        <Receipt size={14} />
                        {editingId ? 'Modifier la facture tiers' : 'Ajouter une facture tiers'}
                    </div>

                    {/* Tiers */}
                    <div className="ftm-field">
                        <label className="ftm-label">Tiers (prestataire)</label>
                        <select
                            className="ftm-select"
                            value={form.idTiers}
                            onChange={e => handleChange('idTiers', e.target.value)}
                        >
                            <option value="">-- Sélectionner un tiers --</option>
                            {tiers.map(t => (
                                <option key={t.IDTiers} value={t.IDTiers}>
                                    {t.libtier}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Rubrique débouss (11xx) */}
                    <div className="ftm-field">
                        <label className="ftm-label">Rubrique débours (11xx) *</label>
                        <div className="ftm-rubrique-wrap">
                            <input
                                className="ftm-input"
                                placeholder="Rechercher : 1108, Débours..."
                                value={rubriqueSearch}
                                onChange={e => { setRubriqueSearch(e.target.value); setShowRubriqueDropdown(true); setForm(prev => ({ ...prev, idRubrique: '', codeRubrique: '', libelleRubrique: '' })); }}
                                onFocus={() => setShowRubriqueDropdown(true)}
                                onBlur={() => setTimeout(() => setShowRubriqueDropdown(false), 200)}
                            />
                            {showRubriqueDropdown && rubriquesFiltered.length > 0 && (
                                <div className="ftm-rubrique-dropdown">
                                    {rubriquesFiltered.map(r => (
                                        <div
                                            key={r.IDRubriques}
                                            className="ftm-rubrique-item"
                                            onMouseDown={() => handleSelectRubrique(r)}
                                        >
                                            <span className="ftm-rubrique-code">{r.CodeRubrique}</span>
                                            <span className="ftm-rubrique-lib">{r.libelleRubrique}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {form.codeRubrique && (
                            <div style={{ fontSize: 11, color: '#6366f1', marginTop: 4, fontWeight: 700 }}>
                                ✓ {form.codeRubrique} — {form.libelleRubrique}
                            </div>
                        )}
                    </div>

                    {/* N° Facture */}
                    <div className="ftm-field">
                        <label className="ftm-label">Numéro de facture</label>
                        <input
                            className="ftm-input"
                            placeholder="Ex: FACT-2026-0042"
                            value={form.numeroFacture}
                            onChange={e => handleChange('numeroFacture', e.target.value)}
                        />
                    </div>

                    {/* Montant TTC */}
                    <div className="ftm-field">
                        <label className="ftm-label">Montant TTC * ({getReferenceSymbol()})</label>
                        <input
                            className="ftm-input"
                            type="number"
                            placeholder="0"
                            value={form.montantTTC}
                            onChange={e => handleChange('montantTTC', e.target.value)}
                            style={{ fontWeight: 700, fontSize: 16 }}
                        />
                    </div>

                    {/* Observations */}
                    <div className="ftm-field">
                        <label className="ftm-label">Observations</label>
                        <textarea
                            className="ftm-input"
                            rows={2}
                            placeholder="Détail facultatif..."
                            value={form.observations}
                            onChange={e => handleChange('observations', e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    <div className="ftm-actions">
                        {editingId && (
                            <button className="ftm-btn ftm-btn-secondary" onClick={handleCancelEdit}>
                                <X size={16} /> Annuler
                            </button>
                        )}
                        <button
                            className="ftm-btn ftm-btn-primary"
                            disabled={!form.idRubrique || !form.montantTTC || loading}
                            onClick={handleSave}
                        >
                            <Save size={16} />
                            {loading ? 'En cours...' : (editingId ? 'Enregistrer' : 'Ajouter')}
                        </button>
                    </div>
                </div>

                {/* Recap par rubrique */}
                {totalParRubrique.length > 0 && (
                    <div className="ftm-recap">
                        <div className="ftm-recap-title">Récap. par rubrique</div>
                        {totalParRubrique.map(r => (
                            <div key={r.code} className="ftm-recap-row">
                                <span style={{ fontFamily: 'monospace', color: '#a78bfa', fontWeight: 700 }}>{r.code}</span>
                                <span style={{ color: '#94a3b8', fontSize: 11 }}>×{r.nb}</span>
                                <span style={{ color: 'white', fontWeight: 700 }}>{fmt(r.total)}</span>
                            </div>
                        ))}
                        <div className="ftm-recap-total">
                            <span>TOTAL DÉBOURS</span>
                            <span>{fmt(grandTotal)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── PANNEAU DROIT : tableau des lignes ── */}
            <div className={`ftm-table-panel ${loading ? 'ftm-loading-overlay' : ''}`}>
                <div className="ftm-table-header">
                    <div className="ftm-table-title">
                        <Building2 size={18} color="#6366f1" />
                        Factures tiers saisies
                        {dossier && <span className="ftm-dossier-badge">{dossier.code || dossierId}</span>}
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{lignes.length} ligne(s)</span>
                    </div>
                    <button
                        onClick={fetchData}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                        title="Rafraîchir"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div className="ftm-table-wrap">
                    {lignes.length === 0 ? (
                        <div className="ftm-empty">
                            <Receipt size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p style={{ fontWeight: 600, margin: 0 }}>Aucune facture tiers</p>
                            <p style={{ fontSize: 12, marginTop: '0.25rem' }}>Utilisez le formulaire pour ajouter des factures de tiers (débours).</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ftm-table">
                            <thead>
                                <tr>
                                    <th>Tiers</th>
                                    <th>Rubrique</th>
                                    <th>N° Facture</th>
                                    <th style={{ textAlign: 'right' }}>Montant TTC</th>
                                    <th>Observations</th>
                                    <th style={{ textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lignes.map(l => (
                                    <tr key={l.IDFacturesRecues} className={editingId === l.IDFacturesRecues ? 'editing' : ''}>
                                        <td>
                                            <div className="ftm-tiers-name">
                                                {l.NomTiers || l.TiersNom || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Non défini</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="ftm-rubr-badge">{l.CodeRubrique}</span>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{l.libelleRubrique}</div>
                                        </td>
                                        <td>
                                            {l.NumeroFacture
                                                ? <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{l.NumeroFacture}</span>
                                                : <span className="ftm-no-fact">—</span>}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="ftm-amount">
                                                {fmt(l.MontantTTC)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="ftm-obs" title={l.Observations}>
                                                {l.Observations || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                <button
                                                    className="ftm-icon-btn edit"
                                                    onClick={() => handleEditLine(l)}
                                                    title="Modifier"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    className="ftm-icon-btn del"
                                                    onClick={() => handleDelete(l.IDFacturesRecues, l.NumeroFacture)}
                                                    title="Supprimer"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>

                {/* Bandeau info intégration facture */}
                {lignes.length > 0 && (
                    <div style={{
                        background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.75rem',
                        padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem'
                    }}>
                        <Info size={18} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 12 }}>
                            <strong style={{ color: '#0c4a6e' }}>Intégration automatique dans la facture :</strong>
                            <span style={{ color: '#0369a1', marginLeft: 6 }}>
                                Lors de la création de la facture client, cliquez sur le bouton
                                <strong> « Importer Débours Tiers »</strong> dans l'onglet Facturation.
                                Les {totalParRubrique.length} rubrique(s) seront agrégées et insérées automatiquement.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FacturesTiersManager;
