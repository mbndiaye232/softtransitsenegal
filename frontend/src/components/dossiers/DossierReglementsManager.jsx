import React, { useState, useEffect } from 'react';
import { getReferenceSymbol } from '../../utils/currency';
import { useNavigate } from 'react-router-dom';
import { CreditCard, RefreshCw, CheckCircle, Clock, AlertCircle, Plus, X, ExternalLink } from 'lucide-react';
import { facturesAPI, reglementsAPI, dossiersAPI } from '../../services/api';

export default function DossierReglementsManager({ dossierId }) {
    const navigate = useNavigate();
    const [factures, setFactures]       = useState([]);
    const [reglements, setReglements]   = useState([]);
    const [modes, setModes]             = useState([]);
    const [clientId, setClientId]       = useState(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState(null);
    const [showForm, setShowForm]       = useState(false);
    const [selectedFacture, setSelectedFacture] = useState(null);
    const [montant, setMontant]         = useState('');
    const [date, setDate]               = useState(new Date().toISOString().split('T')[0]);
    const [mode, setMode]               = useState('');
    const [observations, setObservations] = useState('');
    const [saving, setSaving]           = useState(false);
    const [msg, setMsg]                 = useState(null);
    const [validating, setValidating]   = useState({});

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [dosRes, modesRes] = await Promise.all([
                dossiersAPI.getOne(dossierId),
                reglementsAPI.getModes(),
            ]);
            const dossier = dosRes.data;
            const cid = dossier?.IDCLIENTS || dossier?.clientId;
            setClientId(cid);
            if (modes.length === 0 && modesRes.data?.length > 0) {
                setModes(modesRes.data);
                setMode(modesRes.data[0].IDModesReglements);
            }
            const [factRes, reglRes] = await Promise.all([
                facturesAPI.getByDossier(dossierId),
                cid ? reglementsAPI.getClientHistory(cid) : Promise.resolve({ data: [] }),
            ]);
            const factureIds = new Set((factRes.data || []).map(f => f.IDFactures));
            setFactures(factRes.data || []);
            setReglements((reglRes.data || []).filter(r => factureIds.has(r.IDFactures)));
        } catch (e) {
            setError('Erreur lors du chargement des règlements.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [dossierId]);

    // Compute Réglé per facture from the reglements table (source of truth)
    // rather than relying on the cached factures.MontantRegleFacture column,
    // which can drift after manual edits, imports, or partial updates.
    const regleByFacture = reglements.reduce((acc, r) => {
        acc[r.IDFactures] = (acc[r.IDFactures] || 0) + Number(r.MontantReglement || 0);
        return acc;
    }, {});
    const getRegle = (f) => regleByFacture[f.IDFactures] ?? Number(f.MontantRegleFacture || 0);
    const getReliquat = (f) => Math.max(0, Number(f.MontantTTCFacture || 0) - getRegle(f));

    const unpaidFactures = factures.filter(f => getReliquat(f) > 0 && Number(f.Validee) === 1);
    const selectedFactureObj = unpaidFactures.find(f => f.IDFactures === selectedFacture);
    const totalSelected = selectedFactureObj ? getReliquat(selectedFactureObj) : 0;

    const showMsg = (text, type = 'info') => {
        setMsg({ text, type });
        setTimeout(() => setMsg(null), 5000);
    };

    const handleToggleValidation = async (f) => {
        const id = f.IDFactures;
        setValidating(v => ({ ...v, [id]: true }));
        try {
            if (Number(f.Validee) === 1) {
                await facturesAPI.unvalidate(id);
            } else {
                await facturesAPI.validate(id);
            }
            await load();
        } catch (e) {
            showMsg(e.response?.data?.error || 'Erreur lors de la validation.', 'error');
        } finally {
            setValidating(v => ({ ...v, [id]: false }));
        }
    };

    const handleSubmit = async () => {
        if (!selectedFacture) return showMsg('Sélectionnez une facture.', 'error');
        const m = parseFloat(montant);
        if (!m || m <= 0) return showMsg('Montant invalide.', 'error');
        if (!mode) return showMsg('Choisissez un mode de règlement.', 'error');
        setSaving(true);
        try {
            await reglementsAPI.processPayment({
                clientId,
                montantReglement: m,
                dateReglement: date,
                listFactures: [selectedFacture],
                idModeReglement: mode,
                observations,
            });
            showMsg('Règlement enregistré avec succès.', 'success');
            setShowForm(false);
            setSelectedFacture(null);
            setMontant('');
            setObservations('');
            await load();
        } catch (e) {
            showMsg(e.response?.data?.error || 'Erreur lors du règlement.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' ' + getReferenceSymbol();

    const totalFacture = factures.reduce((s, f) => s + Number(f.MontantTTCFacture || 0), 0);
    const totalRegle   = factures.reduce((s, f) => s + getRegle(f), 0);
    const reliquat     = Math.max(0, totalFacture - totalRegle);
    const statusColor  = reliquat <= 0 ? '#16a34a' : reliquat < totalFacture ? '#d97706' : '#dc2626';
    const statusLabel  = reliquat <= 0 ? 'Soldé' : reliquat < totalFacture ? 'Partiel' : 'Impayé';
    const StatusIcon   = reliquat <= 0 ? CheckCircle : reliquat < totalFacture ? Clock : AlertCircle;

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#b45309' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error) return (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: 20, color: '#be123c', fontWeight: 600 }}>{error}</div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

            {msg && (
                <div style={{ padding: '12px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13,
                    background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: msg.type === 'success' ? '#16a34a' : '#dc2626',
                    border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
                    {msg.text}
                </div>
            )}

            {/* Récapitulatif */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                    { label: 'Total facturé', value: fmt(totalFacture), color: '#1e40af', bg: '#dbeafe' },
                    { label: 'Total réglé',   value: fmt(totalRegle),   color: '#16a34a', bg: '#dcfce7' },
                    { label: 'Reliquat',      value: fmt(reliquat),     color: statusColor, bg: reliquat <= 0 ? '#dcfce7' : '#fef9c3' },
                ].map(c => (
                    <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</div>
                    </div>
                ))}
            </div>

            {/* Formulaire de saisie */}
            {showForm ? (
                <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Plus size={15} color="#b45309" />
                        <span style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>Saisir un règlement</span>
                        <button onClick={() => setShowForm(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
                    </div>
                    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase' }}>Facture à régler *</div>
                            {unpaidFactures.length === 0 ? (
                                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, color: '#94a3b8', fontSize: 13 }}>Toutes les factures sont soldées.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {unpaidFactures.map(f => (
                                        <label key={f.IDFactures} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `2px solid ${selectedFacture === f.IDFactures ? '#b45309' : '#e5e7eb'}`, cursor: 'pointer', background: selectedFacture === f.IDFactures ? '#fff7ed' : 'white' }}>
                                            <input type="radio" name="facture-a-regler" checked={selectedFacture === f.IDFactures} onChange={() => setSelectedFacture(f.IDFactures)} style={{ accentColor: '#b45309', width: 16, height: 16 }} />
                                            <span style={{ fontWeight: 700, color: '#1e293b', flex: 1 }}>{f.NumeroFacture}</span>
                                            <span style={{ fontSize: 12, color: '#64748b' }}>Reliquat :</span>
                                            <span style={{ fontWeight: 800, color: '#dc2626' }}>{fmt(getReliquat(f))}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            {totalSelected > 0 && (
                                <div style={{ marginTop: 8, fontSize: 12, color: '#b45309', fontWeight: 700 }}>
                                    Reliquat sélectionné : {fmt(totalSelected)}
                                    <button onClick={() => setMontant(totalSelected)} style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, background: '#fff7ed', border: '1px solid #fed7aa', color: '#b45309', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                                        Remplir auto
                                    </button>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Montant ({getReferenceSymbol()}) *</label>
                                <input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0"
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 700, outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Date *</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Mode de règlement *</label>
                                <select value={mode} onChange={e => setMode(e.target.value)}
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white' }}>
                                    {modes.map(m => <option key={m.IDModesReglements} value={m.IDModesReglements}>{m.libelle}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Observations</label>
                                <input type="text" value={observations} onChange={e => setObservations(e.target.value)} placeholder="Facultatif…"
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                            </div>
                        </div>
                        <button onClick={handleSubmit} disabled={saving}
                            style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 14, color: 'white', background: saving ? '#9ca3af' : 'var(--hero-gradient)', boxShadow: '0 4px 12px rgba(245,158,11,.35)' }}>
                            {saving ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={16} />}
                            {saving ? 'Enregistrement…' : 'Valider le règlement'}
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => navigate('/reglements', { state: { preselectedClientId: clientId } })}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#374151', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                        <ExternalLink size={14} /> Saisie complète des règlements
                    </button>
                    <button onClick={() => setShowForm(true)} disabled={unpaidFactures.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', cursor: unpaidFactures.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, color: 'white', background: unpaidFactures.length === 0 ? '#9ca3af' : 'var(--hero-gradient)', boxShadow: unpaidFactures.length === 0 ? 'none' : '0 4px 12px rgba(245,158,11,.35)' }}>
                        <Plus size={15} /> Saisir un règlement
                    </button>
                </div>
            )}

            {/* Factures du dossier */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CreditCard size={15} color="#b45309" />
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>Factures du dossier</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: statusColor, background: reliquat <= 0 ? '#dcfce7' : '#fef3c7', padding: '2px 10px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <StatusIcon size={12} /> {statusLabel}
                    </span>
                    <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><RefreshCw size={14} /></button>
                </div>
                {factures.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Aucune facture émise pour ce dossier</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                {['N° Facture', 'Type', 'Montant TTC', 'Réglé', 'Reliquat', 'Valider', 'Statut'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {factures.map(f => {
                                const ttc   = Number(f.MontantTTCFacture || 0);
                                const regle = getRegle(f);
                                const rel   = getReliquat(f);
                                const sc = rel <= 0 ? '#16a34a' : regle > 0 ? '#d97706' : '#dc2626';
                                const sl = rel <= 0 ? 'Soldé' : regle > 0 ? 'Partiel' : 'Impayé';
                                const isValidated = Number(f.Validee) === 1;
                                return (
                                    <tr key={f.IDFactures} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>{f.NumeroFacture}</td>
                                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{f.TypeFacture || '—'}</td>
                                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{fmt(ttc)}</td>
                                        <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 600 }}>{fmt(regle)}</td>
                                        <td style={{ padding: '12px 16px', color: sc, fontWeight: 700 }}>{fmt(rel)}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: validating[f.IDFactures] ? 'wait' : 'pointer' }} title={isValidated ? 'Dévalider la facture' : 'Valider pour pouvoir régler'}>
                                                {validating[f.IDFactures]
                                                    ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite', color: '#b45309' }} />
                                                    : <input type="checkbox" checked={isValidated} onChange={() => handleToggleValidation(f)} style={{ accentColor: '#16a34a', width: 16, height: 16, cursor: 'pointer' }} />
                                                }
                                                <span style={{ fontSize: 11, color: isValidated ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                                                    {isValidated ? 'Validée' : 'Non validée'}
                                                </span>
                                            </label>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: sc, background: rel <= 0 ? '#dcfce7' : regle > 0 ? '#fef3c7' : '#fee2e2', padding: '2px 10px', borderRadius: 99 }}>{sl}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>

            {/* Historique des règlements */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>Historique des règlements</span>
                </div>
                {reglements.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Aucun règlement enregistré</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                {['Date', 'N° Facture', 'Montant', 'Mode', 'Observations'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {reglements.map(r => (
                                <tr key={r.IDReglements} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{r.Datereglement ? new Date(r.Datereglement).toLocaleDateString('fr-FR') : '—'}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>{r.NumeroFacture || '—'}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#16a34a' }}>{fmt(r.MontantReglement)}</td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{r.modeLibelle || '—'}</td>
                                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12 }}>{r.Observations || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        </div>
    );
}
