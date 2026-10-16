import React, { useState, useEffect } from 'react';
import {
    ordresTransitAPI, incotermsAPI, regimesOTAPI, typesDocumentsOTAPI, paysAPI
} from '../../services/api';
import {
    FileText, Save, CheckCircle, AlertCircle, Info, Plus, X, Globe, Package, ListTodo
} from 'lucide-react';

const OrdreTransitManager = ({ dossierId }) => {
    const [ot, setOt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Reference Data
    const [incoterms, setIncoterms] = useState([]);
    const [regimes, setRegimes] = useState([]);
    const [typesDocs, setTypesDocs] = useState([]);
    const [countries, setCountries] = useState([]);
    const [countrySearch, setCountrySearch] = useState('');
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);

    const [formData, setFormData] = useState({
        NumeroOT: '',
        DateOT: new Date().toISOString().split('T')[0],
        DateReceptionOT: '',
        IDDossiers: dossierId,
        NumeroSerie: '',
        Idincoterms: '',
        BSCExiste: false,
        AssuranceExiste: false,
        Observations: '',
        DateExpedition: '',
        AdresseDeLivraison: '',
        PROVENANCE: '',
        NatureProduits: '',
        Nbredecolis: '',
        PoidsNet: '',
        ValeurMarchandise: '',
        regimeIds: [],
        documents: []
    });

    useEffect(() => {
        fetchData();
    }, [dossierId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [otRes, incRes, regRes, typRes, paysRes] = await Promise.all([
                ordresTransitAPI.getByDossier(dossierId),
                incotermsAPI.getAll(),
                regimesOTAPI.getAll(),
                typesDocumentsOTAPI.getAll(),
                paysAPI.getAll()
            ]);

            setIncoterms(incRes.data);
            setRegimes(regRes.data);
            setTypesDocs(typRes.data);
            setCountries(paysRes.data);

            if (otRes.data) {
                const data = otRes.data;
                setOt(data);
                setFormData({
                    ...data,
                    DateOT: data.DateOT ? new Date(data.DateOT).toISOString().split('T')[0] : '',
                    DateReceptionOT: data.DateReceptionOT ? new Date(data.DateReceptionOT).toISOString().split('T')[0] : '',
                    regimeIds: data.regimes ? data.regimes.map(r => r.IDRegimeOT) : [],
                    documents: data.documents || []
                });
                setCountrySearch(data.PROVENANCE || '');
            } else {
                // Initialize documents for new OT
                setFormData(prev => ({
                    ...prev,
                    documents: typRes.data.map(t => ({
                        idtypesDocumentot: t.IDTypesDocumentsOT,
                        LibelleTypeDocumentsOT: t.LibelleTypeDocumentsOT,
                        Observations: '',
                        Recu: 0,
                        Aremettre: 1
                    }))
                }));
            }
        } catch (err) {
            console.error('Error fetching OT data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRegimeToggle = (id) => {
        setFormData(prev => {
            const current = prev.regimeIds || [];
            if (current.includes(id)) {
                return { ...prev, regimeIds: current.filter(rid => rid !== id) };
            } else {
                return { ...prev, regimeIds: [...current, id] };
            }
        });
    };

    const handleDocToggle = (index, field) => {
        setFormData(prev => {
            const docs = [...prev.documents];
            const currentDoc = { ...docs[index] };

            if (field === 'Recu') {
                currentDoc.Recu = currentDoc.Recu ? 0 : 1;
                if (currentDoc.Recu) {
                    currentDoc.Aremettre = 0; // Decocher "À remettre"
                    // Initialiser avec la date et l'heure système (format MySQL)
                    currentDoc.DateReceptionDocument = new Date().toISOString().replace('T', ' ').slice(0, 19);
                } else {
                    currentDoc.Aremettre = 1; // Recocher "À remettre"
                    currentDoc.DateReceptionDocument = null; // Réinitialiser la date
                }
            } else if (field === 'Aremettre') {
                currentDoc.Aremettre = currentDoc.Aremettre ? 0 : 1;
                if (currentDoc.Aremettre) {
                    currentDoc.Recu = 0; // Decocher "Reçu"
                    currentDoc.DateReceptionDocument = null;
                }
            }

            docs[index] = currentDoc;
            return { ...prev, documents: docs };
        });
    };

    const handleDocDateChange = (index, value) => {
        setFormData(prev => {
            const docs = [...prev.documents];
            docs[index] = { ...docs[index], DateReceptionDocument: value };
            return { ...prev, documents: docs };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            if (ot) {
                await ordresTransitAPI.update(ot.IDOrdresTransit, formData);
            } else {
                await ordresTransitAPI.create(formData);
            }
            await fetchData();
            setShowForm(false);
        } catch (err) {
            const status = err.response?.status;
            const detail = err.response?.data?.error || err.response?.data?.details || err.message;
            console.error('Error saving OT:', status, detail, err);
            alert(`Erreur lors de l'enregistrement de l'OT (${status || 'réseau'}): ${detail || 'voir la console'}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div>Chargement de l'Ordre de Transit...</div>;

    return (
        <div className="ot-manager-container">
            <style>{`
                .ot-manager-container { background: white; border-radius: 1.5rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; margin-top: 2rem; }
                .ot-header { padding: 1.5rem 2rem; background: #fcfcfd; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .ot-title { display: flex; align-items: center; gap: 0.75rem; }
                .ot-icon { padding: 0.5rem; background: #6366f1; color: white; border-radius: 0.75rem; display: flex; }
                .ot-title h3 { font-size: 1.125rem; font-weight: 800; color: #0f172a; margin: 0; }
                .ot-content { padding: 2rem; }
                .ot-active-card { padding: 1.5rem; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 1rem; }
                .ot-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
                .form-group { display: flex; flexDirection: column; gap: 0.5rem; }
                .form-label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
                .form-input { padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; outline: none; }
                .form-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px #e0e7ff; }
                .badge-info { background: white; padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700; color: #64748b; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 0.375rem; }
                .btn-primary { background: #6366f1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
                .btn-primary:hover { background: #4f46e5; }
                .btn-outline { background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 700; cursor: pointer; }
                .regime-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem; }
                .doc-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .doc-table th { text-align: left; font-size: 0.75rem; color: #64748b; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; }
                .doc-table td { padding: 0.75rem 0; border-bottom: 1px solid #f8fafc; font-size: 0.875rem; }

                .search-select-container { position: relative; }
                .search-results { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; max-height: 200px; overflow-y: auto; z-index: 50; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                .search-item { padding: 0.75rem; cursor: pointer; font-size: 0.875rem; }
                .search-item:hover { background: #f1f5f9; }
            `}</style>

            <div className="ot-header">
                <div className="ot-title">
                    <div className="ot-icon"><FileText size={18} /></div>
                    <h3>Ordre de Transit</h3>
                </div>
                {!showForm && (
                    <button className="btn-primary" onClick={() => setShowForm(true)}>
                        {ot ? 'Modifier OT' : 'Créer OT'}
                    </button>
                )}
            </div>

            <div className="ot-content">
                {!showForm && ot && (
                    <div className="ot-active-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <div>
                                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>Numéro OT</span>
                                <h4 style={{ margin: 0, fontSize: '1.25rem' }}>{ot.NumeroOT}</h4>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Date</span>
                                <div>{new Date(ot.DateOT).toLocaleDateString()}</div>
                            </div>
                        </div>
                        <div className="ot-grid">
                            <div>
                                <span className="form-label">Incoterm</span>
                                <div style={{ fontWeight: 600 }}>{incoterms.find(i => i.IDIncoterm === ot.Idincoterms)?.CodeIncoterm || 'N/A'}</div>
                            </div>
                            <div>
                                <span className="form-label">Provenance</span>
                                <div style={{ fontWeight: 600 }}>{ot.PROVENANCE || 'N/A'}</div>
                            </div>
                            <div>
                                <span className="form-label">Numéro de série</span>
                                <div style={{ fontWeight: 600 }}>{ot.NumeroSerie || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                )}

                {!showForm && !ot && (
                    <div style={{ textAlign: 'center', padding: '2rem', background: '#fffbeb', borderRadius: '1rem', border: '1px solid #fef3c7' }}>
                        <Info size={32} color="#d97706" style={{ marginBottom: '1rem' }} />
                        <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>Aucun Ordre de Transit n'est associé à ce dossier.</p>
                    </div>
                )}

                {showForm && (
                    <form onSubmit={handleSubmit}>
                        <div className="ot-grid">
                            <div className="form-group">
                                <label className="form-label">Numéro OT</label>
                                <input className="form-input" value={formData.NumeroOT} onChange={e => setFormData({ ...formData, NumeroOT: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date OT</label>
                                <input type="date" className="form-input" value={formData.DateOT} onChange={e => setFormData({ ...formData, DateOT: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Incoterm</label>
                                <select className="form-input" value={formData.Idincoterms} onChange={e => setFormData({ ...formData, Idincoterms: e.target.value })}>
                                    <option value="">Sélectionner</option>
                                    {incoterms.map(i => <option key={i.IDIncoterm} value={i.IDIncoterm}>{i.CodeIncoterm}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Provenance</label>
                                <div className="search-select-container">
                                    <input
                                        className="form-input"
                                        style={{ width: '100%' }}
                                        placeholder="Chercher un pays..."
                                        value={countrySearch}
                                        onFocus={() => setShowCountryDropdown(true)}
                                        onChange={e => {
                                            setCountrySearch(e.target.value);
                                            setFormData({ ...formData, PROVENANCE: e.target.value });
                                            setShowCountryDropdown(true);
                                        }}
                                    />
                                    {showCountryDropdown && countrySearch && countries.filter(p =>
                                        p.NomPays.toLowerCase().includes(countrySearch.toLowerCase()) &&
                                        p.NomPays.toLowerCase() !== countrySearch.toLowerCase()
                                    ).length > 0 && (
                                            <div className="search-results">
                                                {countries.filter(p =>
                                                    p.NomPays.toLowerCase().includes(countrySearch.toLowerCase())
                                                ).slice(0, 10).map(p => (
                                                    <div
                                                        key={p.IDPays}
                                                        className="search-item"
                                                        onClick={() => {
                                                            setCountrySearch(p.NomPays);
                                                            setFormData({ ...formData, PROVENANCE: p.NomPays });
                                                            setShowCountryDropdown(false);
                                                        }}
                                                    >
                                                        {p.NomPays}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Numéro de série</label>
                                <input className="form-input" value={formData.NumeroSerie} onChange={e => setFormData({ ...formData, NumeroSerie: e.target.value })} />
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <label className="form-label">Régimes OT</label>
                            <div className="regime-grid">
                                {regimes.map(r => (
                                    <label key={r.IDRegimeOT} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.regimeIds.includes(r.IDRegimeOT)} onChange={() => handleRegimeToggle(r.IDRegimeOT)} />
                                        {r.CodeRegimeOT}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <label className="form-label">Documents à remettre</label>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="doc-table">
                                <thead>
                                    <tr>
                                        <th>Document</th>
                                        <th style={{ width: '80px', textAlign: 'center' }}>Reçu</th>
                                        <th style={{ width: '100px', textAlign: 'center' }}>À remettre</th>
                                        <th style={{ width: '180px' }}>Date de remise</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.documents.map((doc, idx) => (
                                        <tr key={idx}>
                                            <td>{doc.LibelleTypeDocumentsOT}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="checkbox" checked={doc.Recu === 1} onChange={() => handleDocToggle(idx, 'Recu')} />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="checkbox" checked={doc.Aremettre === 1} onChange={() => handleDocToggle(idx, 'Aremettre')} />
                                            </td>
                                            <td>
                                                {doc.Recu === 1 && (
                                                    <input
                                                        type="datetime-local"
                                                        className="form-input"
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                        value={doc.DateReceptionDocument ? doc.DateReceptionDocument.slice(0, 16) : ''}
                                                        onChange={e => handleDocDateChange(idx, e.target.value)}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                            <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
                            <button type="submit" className="btn-primary" disabled={submitting}>
                                <Save size={18} />
                                {submitting ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default OrdreTransitManager;
