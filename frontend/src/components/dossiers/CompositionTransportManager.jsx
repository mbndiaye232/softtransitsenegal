import React, { useState, useEffect } from 'react';
import { compositionAPI, produitsAPI, unitesPoidsAPI, unitesVolumeAPI } from '../../services/api';
import { Plus, Trash, Save, Box, Package, ChevronRight, Search, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const CompositionTransportManager = ({ dossierId, dossierType }) => {
    const [loading, setLoading] = useState(false);
    const [hasBilloflading, setHasBilloflading] = useState(true); // Assume true initially

    // Containers State (for TC)
    const [containers, setContainers] = useState([]);
    const [selectedContainer, setSelectedContainer] = useState(null);
    const [containerContents, setContainerContents] = useState([]);
    const [addingContainer, setAddingContainer] = useState(false);

    // Groupage State (for GR/CO)
    const [groupageItems, setGroupageItems] = useState([]);
    const [addingGroupage, setAddingGroupage] = useState(false);

    // Units
    const [unitesPoids, setUnitesPoids] = useState([]);
    const [unitesVolume, setUnitesVolume] = useState([]);

    // Common Forms
    const [containerForm, setContainerForm] = useState({
        NumeroTC: '',
        TypeTC: '40',
        TareTC: '',
        DimensionTC: '',
        UnitePoids: 'Kg',
        UniteVolume: 'm³'
    });

    const [contentForm, setContentForm] = useState({
        ObjetConteneur: '',
        Quantite: '',
        PoidsTotalNet: '',
        Unite: 'Kg'
    });

    const [groupageForm, setGroupageForm] = useState({
        NatureEtQuantiteDesMarchandises: '',
        PoidsTaxation: '',
        UnitePoids: 'Kg',
        TarifMontant: '',
        Total: ''
    });

    // Determine view mode
    const isContainerMode = dossierType === 'TC';

    // Load weight and volume units once
    useEffect(() => {
        Promise.all([unitesPoidsAPI.getAll(), unitesVolumeAPI.getAll()])
            .then(([poidsRes, volRes]) => {
                const poids = poidsRes.data || [];
                const vol = volRes.data || [];
                setUnitesPoids(poids);
                setUnitesVolume(vol);
                // Set defaults to first available unit
                if (poids.length > 0) {
                    const defaultPoids = poids[0].libelle || poids[0].LibelleUnitePoids || 'Kg';
                    setContainerForm(prev => ({ ...prev, UnitePoids: defaultPoids }));
                    setContentForm(prev => ({ ...prev, Unite: defaultPoids }));
                    setGroupageForm(prev => ({ ...prev, UnitePoids: defaultPoids }));
                }
                if (vol.length > 0) {
                    const defaultVol = vol[0].libelle || vol[0].LibelleUniteVolume || 'm³';
                    setContainerForm(prev => ({ ...prev, UniteVolume: defaultVol }));
                }
            })
            .catch(err => console.error('Error loading units:', err));
    }, []);

    useEffect(() => {
        if (dossierId) {
            checkBillofladingAndLoadData();
        }
    }, [dossierId, isContainerMode]);

    useEffect(() => {
        if (selectedContainer) {
            loadContainerContent(selectedContainer.IDConteneurBL);
        } else {
            setContainerContents([]);
        }
    }, [selectedContainer]);

    const checkBillofladingAndLoadData = async () => {
        setLoading(true);
        try {
            // First check if billoflading exists
            const blCheck = await compositionAPI.checkBilloflading(dossierId);
            setHasBilloflading(blCheck.data.exists);

            if (!blCheck.data.exists) {
                setLoading(false);
                return; // Don't load containers/groupage if no billoflading
            }

            // Load containers or groupage data
            if (isContainerMode) {
                const res = await compositionAPI.getContainers(dossierId);
                setContainers(res.data);
                if (res.data.length > 0 && !selectedContainer) {
                    setSelectedContainer(res.data[0]);
                }
            } else {
                const res = await compositionAPI.getGroupage(dossierId);
                setGroupageItems(res.data);
            }
        } catch (err) {
            console.error('Error loading composition:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadContainerContent = async (containerId) => {
        try {
            const res = await compositionAPI.getContainerContent(containerId);
            setContainerContents(res.data);
        } catch (err) {
            console.error('Error loading content:', err);
        }
    };

    // --- Container Handlers ---
    const handleAddContainer = async (e) => {
        e.preventDefault();
        try {
            const res = await compositionAPI.addContainer({
                ...containerForm,
                idblltalvibooking: dossierId
            });
            setContainers([
                ...containers,
                { ...containerForm, IDConteneurBL: res.data.id }
            ]);
            setAddingContainer(false);
            setContainerForm({ NumeroTC: '', TypeTC: '40', TareTC: '', DimensionTC: '', UnitePoids: 'Kg' });

            // Auto Select if first
            if (containers.length === 0) {
                setSelectedContainer({ ...containerForm, IDConteneurBL: res.data.id });
            }
        } catch (err) {
            console.error('Error adding container:', err);
            alert('Erreur lors de l\'ajout du conteneur: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteContainer = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Supprimer ce conteneur et tout son contenu ?')) return;
        try {
            await compositionAPI.deleteContainer(id);
            const newContainers = containers.filter(c => c.IDConteneurBL !== id);
            setContainers(newContainers);
            if (selectedContainer?.IDConteneurBL === id) {
                setSelectedContainer(newContainers.length > 0 ? newContainers[0] : null);
            }
        } catch (err) {
            console.error('Error deleting container:', err);
        }
    };

    // --- Content Handlers ---
    const handleAddContent = async (e) => {
        e.preventDefault();
        if (!selectedContainer) return;
        try {
            const res = await compositionAPI.addContainerContent({
                ...contentForm,
                IDConteneurBL: selectedContainer.IDConteneurBL
            });
            setContainerContents([
                ...containerContents,
                { ...contentForm, IDContenusConteneurs: res.data.id }
            ]);
            setContentForm({ ObjetConteneur: '', Quantite: '', PoidsTotalNet: '', Unite: 'Kg' });
        } catch (err) {
            console.error('Error adding content:', err);
        }
    };

    const handleDeleteContent = async (id) => {
        if (!window.confirm('Supprimer ce contenu ?')) return;
        try {
            await compositionAPI.deleteContainerContent(id);
            setContainerContents(containerContents.filter(c => c.IDContenusConteneurs !== id));
        } catch (err) {
            console.error('Error deleting content:', err);
        }
    };

    // --- Groupage Handlers ---
    const handleAddGroupage = async (e) => {
        e.preventDefault();
        try {
            const res = await compositionAPI.addGroupage({
                ...groupageForm,
                idblltalvibooking: dossierId
            });
            setGroupageItems([
                { ...groupageForm, IDGroupage: res.data.id },
                ...groupageItems
            ]);
            setAddingGroupage(false);
            setGroupageForm({ NatureEtQuantiteDesMarchandises: '', PoidsTaxation: '', UnitePoids: 'Kg', TarifMontant: '', Total: '' });
        } catch (err) {
            console.error('Error adding groupage:', err);
        }
    };

    const handleDeleteGroupage = async (id) => {
        if (!window.confirm('Supprimer cet article ?')) return;
        try {
            await compositionAPI.deleteGroupage(id);
            setGroupageItems(groupageItems.filter(i => i.IDGroupage !== id));
        } catch (err) {
            console.error('Error deleting groupage:', err);
        }
    };

    return (
        <div className="composition-manager">
            <style>{`
                .composition-manager { display: flex; flex-direction: column; gap: 1.5rem; height: 100%; }
                .panel-container { display: flex; gap: 1.5rem; min-height: 400px; }
                .panel { flex: 1; background: white; border: 1px solid var(--border); border-radius: var(--radius-md); display: flex; flex-direction: column; }
                .panel-header { padding: 1rem; border-bottom: 1px solid var(--border-light); background: var(--bg-surface); display: flex; justify-content: space-between; align-items: center; }
                .panel-title { font-weight: 700; color: var(--slate-800); display: flex; align-items: center; gap: 0.5rem; }
                .panel-body { padding: 0.5rem; flex: 1; overflow-y: auto; max-height: 480px; }
                
                .list-item { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s; }
                .list-item:hover { background: var(--slate-50); }
                .list-item.selected { background: var(--primary-light); border-left: 3px solid var(--primary); }
                .list-item-info { display: flex; flex-direction: column; gap: 0.25rem; }
                .item-main { font-weight: 600; color: var(--slate-800); font-size: 0.875rem; }
                .item-sub { font-size: 0.75rem; color: var(--slate-500); }
                
                .mini-form { padding: 1rem; background: var(--slate-50); border-bottom: 1px solid var(--border); }
                .form-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
                .form-input { flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 0.375rem; font-size: 0.875rem; }
                .btn-icon { padding: 0.25rem; border-radius: 0.375rem; color: var(--slate-400); cursor: pointer; border: none; background: transparent; }
                .btn-icon:hover { background: #fee2e2; color: #ef4444; }
                
                .btn-add { width: 100%; padding: 0.5rem; background: var(--primary); color: white; border: none; border-radius: 0.375rem; font-weight: 600; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
                .btn-add.secondary { background: white; color: var(--slate-600); border: 1px dashed var(--border); }
                .btn-add.secondary:hover { background: var(--slate-50); border-color: var(--slate-400); }

                .empty-state { padding: 2rem; text-align: center; color: var(--slate-400); font-size: 0.875rem; font-style: italic; }
                
                /* Table for Groupage */
                .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
                .data-table th { padding: 0.75rem; text-align: left; font-weight: 700; color: var(--slate-500); background: var(--slate-50); border-bottom: 1px solid var(--border); }
                .data-table td { padding: 0.75rem; border-bottom: 1px solid var(--border-light); color: var(--slate-700); }
                .action-cell { width: 40px; text-align: center; }
            `}</style>

            {loading && <div className="empty-state">Chargement...</div>}

            {!loading && !hasBilloflading && (
                <div style={{
                    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                    border: '1px solid #f59e0b',
                    borderRadius: '0.75rem',
                    padding: '2rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <AlertTriangle size={48} style={{ color: '#d97706' }} />
                    <h3 style={{ color: '#92400e', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                        Titre de Transport Requis
                    </h3>
                    <p style={{ color: '#78350f', margin: 0, maxWidth: '500px', lineHeight: '1.6' }}>
                        Pour ajouter des conteneurs ou articles de groupage, veuillez d'abord créer un
                        <strong> Titre de Transport</strong> pour ce dossier dans l'onglet
                        <strong> "Titre de transport"</strong>.
                    </p>
                </div>
            )}

            {!loading && hasBilloflading && (
                <>
                    {isContainerMode ? (
                        <>
                            <div className="panel-headers" style={{ display: 'flex', gap: '1.5rem', marginBottom: '0' }}>
                                <div style={{ flex: 1, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', fontSize: '0.875rem' }}>
                                    Conteneurs (TC)
                                </div>
                                <div style={{ flex: 1, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', fontSize: '0.875rem' }}>
                                    Contenu du Conteneur
                                </div>
                            </div>

                            <div className="panel-container">
                                {/* LEFT PANEL: Containers List */}
                                <div className="panel">
                                    <div className="panel-header">
                                        <span className="panel-title"><Box size={18} /> Liste des TC</span>
                                        <button className="btn-icon" onClick={() => setAddingContainer(!addingContainer)} title="Ajouter un conteneur">
                                            <Plus size={18} style={{ color: 'var(--primary)' }} />
                                        </button>
                                    </div>

                                    {addingContainer && (
                                        <form className="mini-form" onSubmit={handleAddContainer}>
                                            <div className="form-row">
                                                <input
                                                    className="form-input"
                                                    placeholder="Numéro TC"
                                                    value={containerForm.NumeroTC}
                                                    onChange={e => setContainerForm({ ...containerForm, NumeroTC: e.target.value.toUpperCase() })}
                                                    required
                                                />
                                                <select
                                                    className="form-input"
                                                    style={{ width: '80px' }}
                                                    value={containerForm.TypeTC}
                                                    onChange={e => setContainerForm({ ...containerForm, TypeTC: e.target.value })}
                                                >
                                                    <option value="20">20'</option>
                                                    <option value="40">40'</option>
                                                </select>
                                            </div>
                                            <div className="form-row">
                                                <input
                                                    type="number" className="form-input" placeholder="Poids vide"
                                                    value={containerForm.TareTC}
                                                    onChange={e => setContainerForm({ ...containerForm, TareTC: e.target.value })}
                                                />
                                                <select
                                                    className="form-input" style={{ width: '80px', flexShrink: 0 }}
                                                    value={containerForm.UnitePoids}
                                                    onChange={e => setContainerForm({ ...containerForm, UnitePoids: e.target.value })}
                                                    title="Unité de poids"
                                                >
                                                    {unitesPoids.length > 0
                                                        ? unitesPoids.map(u => <option key={u.id || u.IDUnitePoids} value={u.libelle || u.LibelleUnitePoids}>{u.libelle || u.LibelleUnitePoids}</option>)
                                                        : <option value="Kg">Kg</option>
                                                    }
                                                </select>
                                            </div>
                                            <div className="form-row">
                                                <input
                                                    type="number" className="form-input" placeholder="Volume"
                                                    value={containerForm.DimensionTC}
                                                    onChange={e => setContainerForm({ ...containerForm, DimensionTC: e.target.value })}
                                                />
                                                <select
                                                    className="form-input" style={{ width: '80px', flexShrink: 0 }}
                                                    value={containerForm.UniteVolume}
                                                    onChange={e => setContainerForm({ ...containerForm, UniteVolume: e.target.value })}
                                                    title="Unité de volume"
                                                >
                                                    {unitesVolume.length > 0
                                                        ? unitesVolume.map(u => <option key={u.id || u.IDUniteVolume} value={u.libelle || u.LibelleUniteVolume}>{u.libelle || u.LibelleUniteVolume}</option>)
                                                        : <option value="m³">m³</option>
                                                    }
                                                </select>
                                            </div>
                                            <button type="submit" className="btn-add">Ajouter le TC</button>
                                        </form>
                                    )}

                                    <div className="panel-body">
                                        {containers.length === 0 ? (
                                            <div className="empty-state">Aucun conteneur</div>
                                        ) : (
                                            containers.map(tc => (
                                                <div
                                                    key={tc.IDConteneurBL}
                                                    className={`list-item ${selectedContainer?.IDConteneurBL === tc.IDConteneurBL ? 'selected' : ''}`}
                                                    onClick={() => setSelectedContainer(tc)}
                                                >
                                                    <div className="list-item-info">
                                                        <span className="item-main">{tc.NumeroTC || 'Sans Numéro'}</span>
                                                        <span className="item-sub">{tc.TypeTC}' | {tc.TareTC} {tc.UnitePoids}</span>
                                                    </div>
                                                    <button className="btn-icon" onClick={(e) => handleDeleteContainer(tc.IDConteneurBL, e)}>
                                                        <Trash size={14} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT PANEL: Content of Selected Container */}
                                <div className="panel">
                                    <div className="panel-header">
                                        <span className="panel-title">
                                            <Package size={18} />
                                            {selectedContainer ? `Contenu : ${selectedContainer.NumeroTC}` : 'Sélectionner un TC'}
                                        </span>
                                    </div>

                                    {selectedContainer ? (
                                        <>
                                            <div className="panel-body">
                                                {/* Table for content items */}
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table className="data-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Nature march.</th>
                                                            <th>Quantité</th>
                                                            <th>Poids ({contentForm.Unite || 'Kg'})</th>
                                                            <th></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {containerContents.map(item => (
                                                            <tr key={item.IDContenusConteneurs}>
                                                                <td>{item.ObjetConteneur}</td>
                                                                <td>{item.Quantite}</td>
                                                                <td>{item.PoidsTotalNet}</td>
                                                                <td className="action-cell">
                                                                    <button className="btn-icon" onClick={() => handleDeleteContent(item.IDContenusConteneurs)}>
                                                                        <Trash size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {containerContents.length === 0 && (
                                                            <tr>
                                                                <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>Vide</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                                </div>
                                            </div>

                                            <div className="mini-form" style={{ borderTop: '1px solid var(--border)' }}>
                                                <form onSubmit={handleAddContent}>
                                                    <div className="form-row">
                                                        <input
                                                            className="form-input"
                                                            style={{ flex: 2 }}
                                                            placeholder="Nature de la marchandise"
                                                            value={contentForm.ObjetConteneur}
                                                            onChange={e => setContentForm({ ...contentForm, ObjetConteneur: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="form-row">
                                                        <input
                                                            type="number" className="form-input" placeholder="Qté"
                                                            value={contentForm.Quantite}
                                                            onChange={e => setContentForm({ ...contentForm, Quantite: e.target.value })}
                                                        />
                                                        <input
                                                            type="number" className="form-input" placeholder="Poids Net"
                                                            value={contentForm.PoidsTotalNet}
                                                            onChange={e => setContentForm({ ...contentForm, PoidsTotalNet: e.target.value })}
                                                        />
                                                        <select
                                                            className="form-input" style={{ width: '80px', flexShrink: 0 }}
                                                            value={contentForm.Unite}
                                                            onChange={e => setContentForm({ ...contentForm, Unite: e.target.value })}
                                                            title="Unité de poids"
                                                        >
                                                            {unitesPoids.length > 0
                                                                ? unitesPoids.map(u => <option key={u.id || u.IDUnitePoids} value={u.libelle || u.LibelleUnitePoids}>{u.libelle || u.LibelleUnitePoids}</option>)
                                                                : <option value="Kg">Kg</option>
                                                            }
                                                        </select>
                                                    </div>
                                                    <button type="submit" className="btn-add">Valider</button>
                                                </form>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                                            <Info size={32} style={{ margin: '0 auto 1rem' }} />
                                            Veuillez sélectionner un conteneur à gauche pour voir et gérer son contenu.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* GROUPAGE / CONVENTIONNEL VIEW */
                        <div className="panel">
                            <div className="panel-header">
                                <span className="panel-title"><Package size={18} /> Liste des Colis / Marchandises (Groupage/Conventionnel)</span>
                            </div>

                            <div className="panel-body">
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Nature des marchandises</th>
                                            <th>Poids ({groupageForm.UnitePoids || 'Kg'})</th>
                                            <th>Tarif</th>
                                            <th>Total</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupageItems.map(item => (
                                            <tr key={item.IDGroupage}>
                                                <td>{item.NatureEtQuantiteDesMarchandises}</td>
                                                <td>{item.PoidsTaxation} {item.UnitePoids || ''}</td>
                                                <td>{item.TarifMontant}</td>
                                                <td>{item.Total}</td>
                                                <td className="action-cell">
                                                    <button className="btn-icon" onClick={() => handleDeleteGroupage(item.IDGroupage)}>
                                                        <Trash size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>

                            <div className="mini-form" style={{ borderTop: '1px solid var(--border)' }}>
                                <h4 style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--slate-600)' }}>Ajouter une ligne</h4>
                                <form onSubmit={handleAddGroupage}>
                                    <div className="form-row">
                                        <input
                                            className="form-input"
                                            style={{ flex: 3 }}
                                            placeholder="Nature et description des marchandises"
                                            value={groupageForm.NatureEtQuantiteDesMarchandises}
                                            onChange={e => setGroupageForm({ ...groupageForm, NatureEtQuantiteDesMarchandises: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-row">
                                        <input
                                            type="number" className="form-input" placeholder="Poids"
                                            value={groupageForm.PoidsTaxation}
                                            onChange={e => setGroupageForm({ ...groupageForm, PoidsTaxation: e.target.value })}
                                        />
                                        <select
                                            className="form-input" style={{ width: '80px', flexShrink: 0 }}
                                            value={groupageForm.UnitePoids}
                                            onChange={e => setGroupageForm({ ...groupageForm, UnitePoids: e.target.value })}
                                            title="Unité de poids"
                                        >
                                            {unitesPoids.length > 0
                                                ? unitesPoids.map(u => <option key={u.id || u.IDUnitePoids} value={u.libelle || u.LibelleUnitePoids}>{u.libelle || u.LibelleUnitePoids}</option>)
                                                : <option value="Kg">Kg</option>
                                            }
                                        </select>
                                        <input
                                            type="number" className="form-input" placeholder="Tarif/Montant"
                                            value={groupageForm.TarifMontant}
                                            onChange={e => setGroupageForm({ ...groupageForm, TarifMontant: e.target.value })}
                                        />
                                        <input
                                            type="number" className="form-input" placeholder="Total"
                                            value={groupageForm.Total}
                                            onChange={e => setGroupageForm({ ...groupageForm, Total: e.target.value })}
                                        />
                                        <button type="submit" className="btn-add" style={{ width: 'auto', marginTop: 0 }}>
                                            <Save size={16} /> Valider
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CompositionTransportManager;
