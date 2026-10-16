import React, { useState, useEffect } from 'react';
import {
    ordreTransportAPI,
    compositionAPI,
    tiersAPI,
    ordresTransitAPI,
    declarationsAPI,
    billOfLadingAPI,
} from '../../services/api';
import {
    Truck,
    CheckSquare,
    Square,
    Printer,
    Save,
    Info,
    AlertCircle,
    Plus,
    Trash2,
    Package,
    Building2,
    Calendar,
    FileText
} from 'lucide-react';

const OrdreTransportManager = ({ dossierId }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [orders, setOrders] = useState([]);
    const [items, setItems] = useState([]); // Containers or groupage items
    const [carriers, setCarriers] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [error, setError] = useState(null);

    // Form data for the transport order
    const [formData, setFormData] = useState({
        CodeOrdreTransport: '',
        DateOrdreTransport: new Date().toISOString().split('T')[0],
        AdresseDeLivraison: '',
        Numeserie: '',
        Introduction: '',
        forùulepolitesse: 'Veuillez agréer, messieurs, l\'expression de nos salutations distinguées.',
        sectionlivraison: '',
        sectioncontremaitre: ''
    });

    // Info from other modules
    const [dossierInfo, setDossierInfo] = useState(null);
    const [otInfo, setOtInfo] = useState(null);
    const [blInfo, setBlInfo] = useState(null);
    const [declarations, setDeclarations] = useState([]);

    useEffect(() => {
        if (dossierId) {
            loadInitialData();
        }
    }, [dossierId]);

    const loadInitialData = async () => {
        console.log('OrdreTransportManager: loading for dossierId:', dossierId);
        setLoading(true);
        try {
            const [
                ordersRes,
                containersRes,
                groupageRes,
                tiersRes,
                otRes,
                blRes,
                declRes
            ] = await Promise.all([
                ordreTransportAPI.getByDossier(dossierId),
                compositionAPI.getContainers(dossierId),
                compositionAPI.getGroupage(dossierId),
                tiersAPI.getAll(),
                ordresTransitAPI.getByDossier(dossierId),
                billOfLadingAPI.getByDossier(dossierId),
                declarationsAPI.getByDossier(dossierId)
            ]);

            console.log('Containers Res:', containersRes.data);
            console.log('Groupage Res:', groupageRes.data);
            console.log('Orders Res:', ordersRes.data);

            setOrders(ordersRes.data);

            // Combine items from composition
            const allItems = [
                ...containersRes.data.map(c => ({
                    id: c.IDConteneurBL,
                    type: 'TC',
                    numero: c.NumeroTC,
                    details: `${c.TypeTC}' | ${c.TareTC || 0} Kg`,
                    original: c
                })),
                ...groupageRes.data.map(g => ({
                    id: g.IDGroupage,
                    type: 'GR',
                    numero: 'Groupage',
                    details: g.NatureEtQuantiteDesMarchandises,
                    original: g
                }))
            ];

            // Mark items that are already assigned
            const assignedItemsNumbers = new Set();
            ordersRes.data.forEach(order => {
                order.contents?.forEach(content => {
                    assignedItemsNumbers.add(content.NumeroTC);
                });
            });

            setItems(allItems.map(item => ({
                ...item,
                assigned: assignedItemsNumbers.has(item.numero)
            })));

            // Filter for land transport carriers (id_activite 5)
            const landCarriers = tiersRes.data.filter(t =>
                (t.activity_ids || '').split(',').includes('5')
            );
            setCarriers(landCarriers);

            setOtInfo(otRes.data);
            setBlInfo(blRes.data);
            setDeclarations(declRes.data);

            // Set initial code — Numeserie left empty (unique per OTR, user fills manually)
            const seq = (ordersRes.data.length + 1).toString().padStart(2, '0');
            setFormData(prev => ({
                ...prev,
                CodeOrdreTransport: `OTR-${dossierId}-${seq}`,
                AdresseDeLivraison: blRes.data?.AdresseLivraisonFinale || '',
                Numeserie: '',
                Introduction: `Messieurs,\nSuite aux instructions reçues de notre client, nous vous demandons de bien vouloir livrer les conteneurs repris chi-après :`
            }));

        } catch (err) {
            console.error('Error loading OT data:', err);
            setError('Échec du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    const toggleItemSelection = (id) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSave = async (printAfter = false) => {
        if (!selectedCarrier) {
            alert('Veuillez sélectionner un transporteur.');
            return;
        }
        if (selectedItems.length === 0) {
            alert('Veuillez sélectionner au moins un conteneur ou groupage.');
            return;
        }

        setSaving(true);
        try {
            const selectedItemsData = items.filter(i => selectedItems.includes(i.id));

            const payload = {
                ...formData,
                IDDossiers: dossierId,
                TransporteuretAdresse: selectedCarrier.libtier,
                BL: blInfo?.NumeroTitreTransport || 'N/A',
                Numeserie: formData.Numeserie,
                NumDeclaration: declarations.map(d => d.NumeroDeclaration).join(', '),
                DateDeclaration: declarations.length > 0 ? declarations[0].DateDeclaration : null,
                Pregate: 'N/A', // Potentially from mise en livraison
                CodeOrdreTransit: otInfo?.NumeroOT || 'N/A',
                contents: selectedItemsData.map(item => ({
                    NumeroTC: item.numero,
                    TypeTC: item.type === 'TC' ? item.original.TypeTC : 'Groupage',
                    ObjetTC: item.type === 'TC' ? 'Conteneur' : item.details,
                    Quantite: item.type === 'TC' ? 1 : item.original.PoidsTaxation,
                    PoidsNet: item.type === 'TC' ? item.original.TareTC : item.original.PoidsTaxation,
                    Unite: item.type === 'TC' ? 'Pieds' : 'Kg'
                }))
            };

            await ordreTransportAPI.save(payload);

            if (printAfter) {
                // Trigger PDF generation
                const res = await ordreTransportAPI.generatePDF(payload.CodeOrdreTransport);
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${payload.CodeOrdreTransport}.pdf`);
                document.body.appendChild(link);
                link.click();
            }

            alert('Ordre de transport enregistré avec succès.');
            loadInitialData();
            setSelectedItems([]);
            setSelectedCarrier(null);

        } catch (err) {
            const status = err.response?.status;
            const detail = err.response?.data?.error || err.response?.data?.details || err.message;
            console.error('Error saving OT:', status, detail, err);
            alert(`Erreur lors de l'enregistrement (${status || 'réseau'}): ${detail || 'voir la console'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteOrder = async (orderId) => {
        if (!window.confirm('Voulez-vous vraiment supprimer cet ordre de transport ?')) return;
        try {
            await ordreTransportAPI.delete(orderId);
            loadInitialData();
        } catch (err) {
            alert('Erreur lors de la suppression.');
        }
    };

    if (loading) return <div>Chargement...</div>;

    if (error) return (
        <div className="alert alert-danger" role="alert">
            {error}
        </div>
    );

    return (
        <div className="ot-manager">
            <style>{`
                .ot-manager { display: flex; flex-direction: column; gap: 1.5rem; }
                .grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .panel { background: white; border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; display: flex; flex-direction: column; }
                .panel-header { padding: 1rem; background: var(--slate-50); border-bottom: 1px solid var(--border-light); font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
                .panel-body { padding: 1rem; flex: 1; }
                
                .item-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto; }
                .item-card { padding: 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: all 0.2s; }
                .item-card:hover:not(.assigned) { border-color: var(--primary); background: var(--primary-light); }
                .item-card.selected { border-color: var(--primary); background: var(--primary-light); }
                .item-card.assigned { opacity: 0.6; background: var(--slate-50); cursor: not-allowed; }
                
                .carrier-card { padding: 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; margin-bottom: 0.5rem; }
                .carrier-card:hover { border-color: var(--primary); background: var(--primary-light); }
                .carrier-card.selected { border-color: var(--primary); background: var(--primary-light); border-width: 2px; }
                
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem; }
                .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
                .form-label { font-size: 0.75rem; font-weight: 700; color: var(--slate-500); text-transform: uppercase; }
                .form-input { padding: 0.625rem; border: 1px solid var(--border); border-radius: 0.375rem; font-size: 0.875rem; }
                
                .actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-light); }
                .btn { padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; }
                .btn-primary { background: var(--primary); color: white; }
                .btn-secondary { background: var(--slate-100); color: var(--slate-700); }
                
                .existing-orders { margin-top: 2rem; }
                .order-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .order-table th { text-align: left; padding: 0.75rem; background: var(--slate-50); border-bottom: 1px solid var(--border); font-size: 0.75rem; color: var(--slate-500); }
                .order-table td { padding: 0.75rem; border-bottom: 1px solid var(--border-light); font-size: 0.875rem; }
            `}</style>

            <div className="grid-layout">
                {/* Items Selection */}
                <div className="panel">
                    <div className="panel-header">
                        <Package size={18} /> Composition du Transport
                    </div>
                    <div className="panel-body">
                        <div className="item-list">
                            {items.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucun élément dans la composition</div>
                            ) : (
                                items.map(item => (
                                    <div
                                        key={item.id}
                                        className={`item-card ${selectedItems.includes(item.id) ? 'selected' : ''} ${item.assigned ? 'assigned' : ''}`}
                                        onClick={() => !item.assigned && toggleItemSelection(item.id)}
                                    >
                                        {selectedItems.includes(item.id) ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} color="#cbd5e1" />}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.numero}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.details}</div>
                                        </div>
                                        {item.assigned && <span style={{ fontSize: '0.625rem', padding: '2px 6px', background: '#fee2e2', color: '#ef4444', borderRadius: '4px' }}>Déjà affecté</span>}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Carrier Selection */}
                <div className="panel">
                    <div className="panel-header">
                        <Truck size={18} /> Transporteurs Terrestres
                    </div>
                    <div className="panel-body">
                        <div className="item-list" style={{ maxHeight: '300px' }}>
                            {carriers.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucun transporteur terrestre trouvé</div>
                            ) : (
                                carriers.map(carrier => (
                                    <div
                                        key={carrier.IDTiers}
                                        className={`carrier-card ${selectedCarrier?.IDTiers === carrier.IDTiers ? 'selected' : ''}`}
                                        onClick={() => setSelectedCarrier(carrier)}
                                    >
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{carrier.libtier}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{carrier.adresseTiers || 'Pas d\'adresse'}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="panel">
                <div className="panel-header">
                    <FileText size={18} /> Détails de l'Ordre de Transport
                </div>
                <div className="panel-body">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Code Ordre Transport</label>
                            <input className="form-input" value={formData.CodeOrdreTransport} onChange={e => setFormData({ ...formData, CodeOrdreTransport: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date</label>
                            <input type="date" className="form-input" value={formData.DateOrdreTransport} onChange={e => setFormData({ ...formData, DateOrdreTransport: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Adresse de livraison</label>
                            <input className="form-input" value={formData.AdresseDeLivraison} onChange={e => setFormData({ ...formData, AdresseDeLivraison: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Numéro de série</label>
                            <input className="form-input" value={formData.Numeserie} onChange={e => setFormData({ ...formData, Numeserie: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="form-label">Introduction</label>
                        <textarea className="form-input" rows="3" value={formData.Introduction} onChange={e => setFormData({ ...formData, Introduction: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="form-label">Formule de politesse</label>
                        <input className="form-input" value={formData.forùulepolitesse} onChange={e => setFormData({ ...formData, forùulepolitesse: e.target.value })} />
                    </div>

                    <div className="actions">
                        <button className="btn btn-secondary" disabled={saving}>
                            Annuler
                        </button>
                        <button className="btn btn-primary" onClick={() => handleSave(true)} disabled={saving || selectedItems.length === 0 || !selectedCarrier}>
                            {saving ? 'Traitement...' : <><Printer size={18} /> Enregistrer et Imprimer</>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="existing-orders">
                <h4 style={{ display: 'flex', alignJoin: 'center', gap: '0.5rem', fontWeight: 800 }}>
                    <Calendar size={18} /> Historique des Ordres de Transport
                </h4>
                <div className="panel" style={{ marginTop: '1rem' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="order-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Date</th>
                                <th>Transporteur</th>
                                <th>Articles</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Aucun ordre enregistré</td>
                                </tr>
                            ) : (
                                orders.map(order => (
                                    <tr key={order.IDOrdresDeTransport}>
                                        <td style={{ fontWeight: 700 }}>{order.CodeOrdreTransport}</td>
                                        <td>{new Date(order.DateOrdreTransport).toLocaleDateString()}</td>
                                        <td>{order.TransporteuretAdresse}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                {order.contents?.map((c, idx) => (
                                                    <span key={idx} style={{ fontSize: '0.625rem', background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>{c.NumeroTC}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button className="btn-icon" onClick={() => handleDeleteOrder(order.IDOrdresDeTransport)} title="Supprimer">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrdreTransportManager;
