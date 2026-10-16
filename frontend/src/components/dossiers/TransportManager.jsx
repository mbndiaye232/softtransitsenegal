import React, { useState, useEffect, useRef, useMemo } from 'react';
import { transportsAPI, structureAPI, lieuxAPI, tiersAPI, moyensTransportAPI } from '../../services/api';
import { Save, Truck, Calendar, MapPin, Anchor, Clock, FileText, Search, ChevronDown, Building2 } from 'lucide-react';

const SearchableSelect = ({ label, icon: Icon, options, value, onChange, placeholder, disabled, displayKey = 'label', valueKey = 'value', uniqueKey }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    const filteredOptions = options.filter(opt =>
        String(opt[displayKey]).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="form-group" ref={containerRef} style={{ position: 'relative' }}>
            <label><Icon size={14} style={{ marginRight: '4px' }} /> {label}</label>
            <div
                className={`premium-select-custom ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className="current-value">
                    {selectedOption ? selectedOption[displayKey] : placeholder}
                </span>
                <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
            </div>

            {isOpen && (
                <div className="search-dropdown">
                    <div className="search-input-wrapper">
                        <Search size={14} className="search-icon" />
                        <input
                            autoFocus
                            className="search-input"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="options-list">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div
                                    key={uniqueKey ? opt[uniqueKey] : opt[valueKey]}
                                    className={`option-item ${String(opt[valueKey]) === String(value) ? 'selected' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onChange(opt[valueKey]);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                >
                                    {opt[displayKey]}
                                </div>
                            ))
                        ) : (
                            <div className="no-options">Aucun résultat</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const TransportManager = ({ dossierId }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [countries, setCountries] = useState([]);
    const [departLieux, setDepartLieux] = useState([]);
    const [arriveLieux, setArriveLieux] = useState([]);
    const [tiers, setTiers] = useState([]);
    const [allMoyens, setAllMoyens] = useState([]);
    const [filteredMoyens, setFilteredMoyens] = useState([]);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [form, setForm] = useState({
        DateDepart: '',
        IdLieuDepart: '',
        IdCountryDepart: '',
        IdLieuArrive: '',
        IdCountryArrive: '193',
        IDMoyensTransport: null, // The specific vehicle ID (foreign key)
        transportType: 1, // UI helper: 1=Maritime, 2=Aerial, 3=Land
        NumeroTitreTransport: '',
        libelleTransport: '',
        IDCompagnie: '',
        Observations: '',
        DateArriveePrevue: '',
        HeureArriveePrevue: '',
        NumeroEscale: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [transportRes, countriesRes, tiersRes, moyensRes] = await Promise.all([
                    transportsAPI.getByDossier(dossierId),
                    structureAPI.getCountries(),
                    tiersAPI.getAll(),
                    moyensTransportAPI.getAll()
                ]);

                setCountries(countriesRes.data);
                setTiers(tiersRes.data);
                setAllMoyens(moyensRes.data);

                if (transportRes.data) {
                    const data = transportRes.data;

                    // Determine transport type from the saved vehicle ID
                    let derivedType = 1;
                    if (data.IDMoyensTransport) {
                        const foundMoyen = moyensRes.data.find(m => m.IDMoyensTransport === data.IDMoyensTransport);
                        if (foundMoyen) {
                            derivedType = foundMoyen.idtypeMoyensTransport;
                        }
                    }

                    setForm({
                        DateDepart: data.DateDepart ? data.DateDepart.split('T')[0] : '',
                        IdLieuDepart: data.IdLieuDepart || '',
                        IdCountryDepart: data.IdLieuDepart ? '' : '',
                        IdLieuArrive: data.IdLieuArrive || '',
                        IdCountryArrive: '193',
                        IDMoyensTransport: data.IDMoyensTransport || null,
                        transportType: derivedType,
                        NumeroTitreTransport: data.NumeroTitreTransport || '',
                        libelleTransport: data.libelleTransport || '',
                        IDCompagnie: data.IDCompagnie || '',
                        Observations: data.Observations || '',
                        DateArriveePrevue: data.DateArriveePrevue ? data.DateArriveePrevue.split('T')[0] : '',
                        HeureArriveePrevue: data.HeureArriveePrevue || '',
                        NumeroEscale: data.NumeroEscale || ''
                    });
                }
            } catch (err) {
                console.error('Error fetching transport data:', err);
                showMsg('Erreur lors du chargement des données', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [dossierId]);

    // Filter Localtion Departure
    useEffect(() => {
        if (form.IdCountryDepart) {
            const type = form.transportType === 1 ? 'maritime' : form.transportType === 2 ? 'aérien' : 'terrestre';
            lieuxAPI.getAll({ idpays: form.IdCountryDepart, type }).then(res => {
                setDepartLieux(res.data);
            });
        }
    }, [form.IdCountryDepart, form.transportType]);

    // Filter Location Arrival
    useEffect(() => {
        if (form.IdCountryArrive) {
            lieuxAPI.getAll({ idpays: form.IdCountryArrive }).then(res => {
                setArriveLieux(res.data);
                if (form.IdCountryArrive === '193' && !form.IdLieuArrive) {
                    setForm(prev => ({ ...prev, IdLieuArrive: 219 }));
                }
            });
        }
    }, [form.IdCountryArrive]);

    // Filter Moyens based on Compagnie + Type
    useEffect(() => {
        let filtered = allMoyens;

        // Filter by Type (Navire, Avion, Camion)
        if (form.transportType) {
            filtered = filtered.filter(m => m.idtypeMoyensTransport == form.transportType);
        }

        // Filter by Compagnie (Tier)
        if (form.IDCompagnie) {
            filtered = filtered.filter(m => m.IDTiers == form.IDCompagnie);
        }

        setFilteredMoyens(filtered);

    }, [form.transportType, form.IDCompagnie, allMoyens]);

    // Filter companies (tiers) by transport type using activity_labels
    const filteredTiers = useMemo(() => {
        if (!tiers.length) return tiers;
        const keywords = {
            1: ['maritime', 'mari'],
            2: ['aérien', 'aerien', 'aer'],
            3: ['terrestre', 'terr', 'route', 'routier']
        }[form.transportType] || [];

        const filtered = tiers.filter(t => {
            const labels = (t.activity_labels || '').toLowerCase();
            return keywords.some(kw => labels.includes(kw));
        });

        // Fallback: show all tiers if none match (e.g. activities not configured)
        return filtered.length > 0 ? filtered : tiers;
    }, [tiers, form.transportType]);

    const showMsg = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setForm(prev => ({ ...prev, [name]: value }));
    };

    // Special handler for transport means selection to sync ID and Label
    const handleMoyenSelect = (moyenId) => {
        const selected = allMoyens.find(m => m.IDMoyensTransport === moyenId);
        if (selected) {
            setForm(prev => ({
                ...prev,
                IDMoyensTransport: selected.IDMoyensTransport,
                libelleTransport: selected.LibelleMoyensTransport
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await transportsAPI.save({ ...form, idbl: dossierId });
            showMsg('Informations de transport enregistrées avec succès', 'success');
        } catch (err) {
            console.error('Error saving transport data:', err);
            showMsg('Erreur lors de l\'enregistrement', 'error');
        } finally {
            setSaving(false);
        }
    };

    const getModeLabel = () => {
        if (form.transportType === 1) return 'Port';
        if (form.transportType === 2) return 'Aéroport';
        return 'Lieu';
    };

    const getMoyenLabel = () => {
        if (form.transportType === 1) return 'Navire';
        if (form.transportType === 2) return 'Vol';
        return 'Camion';
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;

    return (
        <div className="transport-manager">
            <style>{`
                .transport-manager { padding: 1.5rem; }
                .transport-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 1.5rem; }
                .col-3 { grid-column: span 3; }
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
                
                .premium-select-custom {
                    padding: 0.75rem 1rem;
                    border: 1px solid var(--border);
                    border-radius: 0.75rem;
                    background: var(--slate-50);
                    font-size: 0.875rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .premium-select-custom:hover { background: white; border-color: var(--primary); }
                .premium-select-custom.active { border-color: var(--primary); background: white; box-shadow: 0 0 0 4px var(--primary-light); }
                .premium-select-custom.disabled { opacity: 0.6; cursor: not-allowed; }
                
                .search-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid var(--border);
                    border-radius: 0.75rem;
                    margin-top: 0.5rem;
                    box-shadow: var(--shadow-xl);
                    z-index: 1000;
                    max-height: 300px;
                    display: flex;
                    flex-direction: column;
                }
                
                .search-input-wrapper {
                    padding: 0.75rem;
                    border-bottom: 1px solid var(--border-light);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .search-input {
                    border: none;
                    outline: none;
                    flex: 1;
                    font-size: 0.875rem;
                }
                
                .options-list {
                    overflow-y: auto;
                    flex: 1;
                }
                .option-item {
                    padding: 0.75rem 1rem;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .option-item:hover { background: var(--slate-50); color: var(--primary); }
                .option-item.selected { background: var(--primary-light); color: var(--primary); font-weight: 600; }
                .no-options { padding: 1rem; text-align: center; color: var(--slate-400); font-size: 0.875rem; }
                
                .save-bar { margin-top: 2rem; display: flex; justify-content: flex-end; padding-top: 1.5rem; border-top: 1px solid var(--border-light); }
                .btn-save { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 2rem; background: var(--primary); color: white; border: none; border-radius: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
                .alert { padding: 1rem; border-radius: 0.75rem; margin-bottom: 1.5rem; font-weight: 600; font-size: 0.875rem; }
                .alert-success { background: #ecfdf5; color: #10b981; border: 1px solid #10b98133; }
                .alert-error { background: #fef2f2; color: #ef4444; border: 1px solid #ef444433; }
                
                .chevron { transition: transform 0.2s; color: var(--slate-400); }
                .chevron.open { transform: rotate(180deg); }
                
                .section-label { grid-column: span 12; font-size: 0.875rem; font-weight: 800; color: var(--slate-900); margin-top: 0.5rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
                .section-line { flex: 1; height: 1px; background: var(--border-light); }
            `}</style>

            {message.text && (<div className={`alert alert-${message.type}`}>{message.text}</div>)}

            <form onSubmit={handleSubmit}>
                <div className="transport-grid">

                    <div className="section-label">
                        <Truck size={16} />
                        Moyen & Compagnie
                        <div className="section-line"></div>
                    </div>

                    <div className="form-group col-4">
                        <label>Type de Transport</label>
                        <select
                            name="transportType"
                            className="premium-input"
                            style={{ height: '45px' }}
                            value={form.transportType}
                            onChange={(e) => {
                                handleChange(e);
                                setForm(prev => ({
                                    ...prev,
                                    IDCompagnie: '',
                                    libelleTransport: '',
                                    IDMoyensTransport: null
                                }));
                            }}
                        >
                            <option value={1}>Maritime (Navire)</option>
                            <option value={2}>Aérien (Avion)</option>
                            <option value={3}>Terrestre (Camion)</option>
                        </select>
                    </div>

                    <SearchableSelect
                        label={`Compagnie de Transport${filteredTiers.length < tiers.length ? ` (${filteredTiers.length} ${form.transportType === 1 ? 'maritime' : form.transportType === 2 ? 'aérienne' : 'terrestre'}s)` : ''}`}
                        icon={Building2}
                        options={filteredTiers}
                        value={form.IDCompagnie}
                        onChange={(val) => handleSelectChange('IDCompagnie', val)}
                        displayKey="libtier"
                        valueKey="IDTiers"
                        placeholder="Sélectionner une compagnie..."
                    />

                    <SearchableSelect
                        label={`Nom ${getMoyenLabel()}`}
                        icon={Anchor}
                        options={filteredMoyens}
                        value={form.IDMoyensTransport}
                        onChange={(val) => handleMoyenSelect(val)}
                        displayKey="LibelleMoyensTransport"
                        valueKey="IDMoyensTransport"
                        uniqueKey="IDMoyensTransport"
                        placeholder={`Sélectionner un ${getMoyenLabel().toLowerCase()}...`}
                        disabled={!form.IDCompagnie && filteredMoyens.length > 0}
                    />


                    <div className="section-label">
                        <FileText size={16} />
                        Documents & Trajet
                        <div className="section-line"></div>
                    </div>

                    <div className="form-group col-4">
                        <label>Numéro {form.transportType === 1 ? 'BL' : form.transportType === 2 ? 'LTA' : 'LVI'}</label>
                        <input name="NumeroTitreTransport" className="premium-input" value={form.NumeroTitreTransport} onChange={handleChange} placeholder="N° du document..." />
                    </div>

                    <SearchableSelect
                        label="Pays de Départ"
                        icon={MapPin}
                        options={countries}
                        value={form.IdCountryDepart}
                        onChange={(val) => handleSelectChange('IdCountryDepart', val)}
                        displayKey="NomPays"
                        valueKey="IDPays"
                        placeholder="Sélectionner un pays"
                    />

                    <SearchableSelect
                        label={`${getModeLabel()} de Départ`}
                        icon={MapPin}
                        options={departLieux}
                        value={form.IdLieuDepart}
                        onChange={(val) => handleSelectChange('IdLieuDepart', val)}
                        displayKey="NomLieu"
                        valueKey="IDLieux"
                        placeholder="Sélectionner un lieu"
                        disabled={!form.IdCountryDepart}
                    />

                    <div className="form-group col-4">
                        {/* Empty Spacer or Date Depart moved here? Layout choice. */}
                        <label><Calendar size={14} style={{ marginRight: '4px' }} /> Date Départ</label>
                        <input type="date" name="DateDepart" className="premium-input" value={form.DateDepart} onChange={handleChange} />
                    </div>


                    <SearchableSelect
                        label="Pays d'Arrivée"
                        icon={MapPin}
                        options={countries}
                        value={form.IdCountryArrive}
                        onChange={(val) => handleSelectChange('IdCountryArrive', val)}
                        displayKey="NomPays"
                        valueKey="IDPays"
                        placeholder="Sélectionner un pays"
                    />

                    <SearchableSelect
                        label="Lieu d'Arrivée"
                        icon={MapPin}
                        options={arriveLieux}
                        value={form.IdLieuArrive}
                        onChange={(val) => handleSelectChange('IdLieuArrive', val)}
                        displayKey="NomLieu"
                        valueKey="IDLieux"
                        placeholder="Sélectionner un lieu"
                    />

                    <div className="form-group col-4">
                        <label><Calendar size={14} style={{ marginRight: '4px' }} /> Date Arrivée (ETA)</label>
                        <input type="date" name="DateArriveePrevue" className="premium-input" value={form.DateArriveePrevue} onChange={handleChange} />
                    </div>

                    <div className="form-group col-3">
                        <label>N° Escale / Vol</label>
                        <input name="NumeroEscale" className="premium-input" value={form.NumeroEscale} onChange={handleChange} />
                    </div>

                    <div className="form-group col-3">
                        <label><Clock size={14} style={{ marginRight: '4px' }} /> Heure Arrivée</label>
                        <input type="time" name="HeureArriveePrevue" className="premium-input" value={form.HeureArriveePrevue} onChange={handleChange} />
                    </div>

                    <div className="form-group col-12">
                        <label>Observations</label>
                        <textarea name="Observations" rows="2" className="premium-textarea" value={form.Observations} onChange={handleChange} placeholder="Notes..." />
                    </div>
                </div>

                <div className="save-bar">
                    <button type="submit" className="btn-save" disabled={saving}>
                        <Save size={18} />
                        {saving ? 'Enregistrement...' : 'Enregistrer les informations'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TransportManager;
