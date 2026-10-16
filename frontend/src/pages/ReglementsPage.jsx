import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    CreditCard, Users, FileText, CheckCircle2, AlertCircle, X, Search, DollarSign, ListChecks
} from 'lucide-react';
import { clientsAPI, reglementsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getReferenceSymbol } from '../utils/currency';

export default function ReglementsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    // Data states
    const [clients, setClients] = useState([]);
    const [factures, setFactures] = useState([]);
    const [modes, setModes] = useState([]);
    const [compteClient, setCompteClient] = useState(null);

    // Filter/Selection states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedFactures, setSelectedFactures] = useState([]); // Array of checked facture IDs

    // Form states
    const [montantReglement, setMontantReglement] = useState('');
    const [dateReglement, setDateReglement] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMode, setSelectedMode] = useState('');
    const [observations, setObservations] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // UI State
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        loadInitialData();
    }, []);

    // Auto-sélectionner le client si on vient d'un dossier
    useEffect(() => {
        const preselectedClientId = location.state?.preselectedClientId;
        if (preselectedClientId && clients.length > 0 && !selectedClient) {
            const client = clients.find(c => c.IDCLIENTS === preselectedClientId || String(c.IDCLIENTS) === String(preselectedClientId));
            if (client) handleClientSelect(client);
        }
    }, [clients, location.state]);

    const loadInitialData = async () => {
        try {
            console.log('Loading initial data...');
            const [clientsRes, modesRes] = await Promise.all([
                clientsAPI.getAll(),
                reglementsAPI.getModes()
            ]);
            console.log('Clients received:', clientsRes.data);
            setClients(clientsRes.data);
            setModes(modesRes.data);
            if (modesRes.data.length > 0) {
                setSelectedMode(modesRes.data[0].IDModesReglements);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showMessage('Erreur de chargement des données', 'error');
        }
    };

    const handleClientSelect = async (client) => {
        setSelectedClient(client);
        setSelectedFactures([]);
        setMontantReglement('');
        setCompteClient(null);

        try {
            // Load unpaid invoices for this client
            const res = await reglementsAPI.getFacturesImpayees(client.IDCLIENTS);
            setFactures(res.data);

            // Also fetch client account balance (optional feature, handle gracefully if missing)
            try {
                // If backend added GET /api/clients/:id/compte later, you can call it here
            } catch (e) { }

        } catch (error) {
            console.error('Error fetching factures:', error);
            showMessage('Erreur lors du chargement des factures impayées', 'error');
        }
    };

    const toggleFactureSelection = (factureId) => {
        setSelectedFactures(prev => {
            if (prev.includes(factureId)) {
                return prev.filter(id => id !== factureId);
            } else {
                return [...prev, factureId];
            }
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedFactures(factures.map(f => f.IDFactures));
        } else {
            setSelectedFactures([]);
        }
    };

    // Calculate total amount to pay based on selection
    const totalARegler = factures
        .filter(f => selectedFactures.includes(f.IDFactures))
        .reduce((sum, f) => sum + parseFloat(f.ReliquatFacture || 0), 0);

    const handleAutoFillMnt = () => {
        if (totalARegler > 0) {
            setMontantReglement(totalARegler);
        }
    };

    const processPayment = async () => {
        if (!selectedClient) {
            return showMessage('Veuillez sélectionner un client', 'warning');
        }
        if (selectedFactures.length === 0) {
            return showMessage('Veuillez sélectionner au moins une facture à régler', 'warning');
        }
        if (!montantReglement || isNaN(montantReglement) || parseFloat(montantReglement) <= 0) {
            return showMessage('Veuillez saisir un montant valide', 'warning');
        }
        if (!selectedMode) {
            return showMessage('Veuillez choisir un mode de règlement', 'warning');
        }

        setIsProcessing(true);
        try {
            const data = {
                clientId: selectedClient.IDCLIENTS,
                montantReglement: parseFloat(montantReglement),
                dateReglement,
                listFactures: selectedFactures,
                idModeReglement: selectedMode,
                observations
            };

            const response = await reglementsAPI.processPayment(data);

            if (response.data.remainingAmount > 0) {
                showMessage(`Règlement effectué. Un trop-perçu de ${response.data.remainingAmount.toLocaleString()} FC a été crédité au compte du client.`, 'success');
            } else {
                showMessage('Règlement traité avec succès', 'success');
            }

            // Refresh invoices
            handleClientSelect(selectedClient);
            setMontantReglement('');
            setObservations('');
        } catch (error) {
            console.error('Payment error:', error);
            showMessage(error.response?.data?.error || 'Erreur lors du traitement du règlement', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    };

    const filteredClients = Array.isArray(clients) ? clients.filter(c => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase().trim();
        const target = `${c.NomRS || ''} ${c.NomClient || ''} ${c.NINEA || ''}`.toLowerCase();
        return target.includes(search);
    }) : [];

    console.log('REGL_DEBUG: clients.length:', clients?.length);
    console.log('REGL_DEBUG: searchTerm:', `"${searchTerm}"`);
    console.log('REGL_DEBUG: filtered.length:', filteredClients.length);

    return (
        <div className="layout-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', overflow: 'hidden' }}>
            <style>{`
                * { box-sizing: border-box; }
                .layout-container { font-family: 'Inter', system-ui, sans-serif; }
                .app-header { background: #1e293b; color: white; padding: 0.75rem 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 10; flex-shrink: 0; }
                .app-header h1 { font-size: 1.125rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 0.75rem; color: #f8fafc; }
                
                .main-layout { display: flex; flex: 1; overflow: hidden; }
                
                /* Left Sidebar: Clients */
                .sidebar { width: 320px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; flex-shrink: 0; }
                .sidebar-header { padding: 1rem; border-bottom: 1px solid #e2e8f0; background: #f1f5f9; }
                .sidebar-title { font-size: 0.8125rem; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
                
                .search-box { display: flex; align-items: center; background: white; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.35rem 0.75rem; }
                .search-box input { border: none; outline: none; width: 100%; font-size: 0.8125rem; margin-left: 0.5rem; color: #334155; }
                
                .client-list { flex: 1; overflow-y: auto; }
                .client-item { padding: 0.85rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s; }
                .client-item:hover { background: #f8fafc; }
                .client-item.selected { background: #eff6ff; border-left: 3px solid #3b82f6; }
                .client-name { font-size: 0.875rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem; }
                .client-ninea { font-size: 0.6875rem; font-weight: 600; color: #64748b; }

                /* Center Content: Invoices */
                .content-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f8fafc; padding: 1.5rem; gap: 1.5rem; }
                
                .card { background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
                .card-header { padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; background: #fdfdfd; display: flex; justify-content: space-between; align-items: center; }
                .card-title { font-size: 0.9375rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.5rem; }
                
                .table-container { flex: 1; overflow: auto; }
                table { width: 100%; border-collapse: collapse; }
                th { position: sticky; top: 0; background: #f1f5f9; color: #475569; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; padding: 0.75rem 1rem; text-align: left; border-bottom: 2px solid #e2e8f0; }
                td { padding: 0.875rem 1rem; font-size: 0.8125rem; color: #334155; border-bottom: 1px solid #f1f5f9; font-weight: 500; }
                tr:hover td { background: #f8fafc; }
                tr.checked td { background: #f0fdf4; }
                
                .amount { font-family: monospace; font-size: 0.9rem; font-weight: 700; text-align: right; }
                .amount.due { color: #dc2626; } /* Red for reliquat */
                
                /* Checkbox styling */
                .custom-checkbox { width: 1.1rem; height: 1.1rem; accent-color: #3b82f6; cursor: pointer; }

                /* Right Sidebar: Payment Form */
                .payment-sidebar { width: 380px; background: white; border-left: 1px solid #e2e8f0; display: flex; flex-direction: column; flex-shrink: 0; }
                .payment-header { padding: 1.25rem 1.5rem; background: #0f172a; color: white; }
                .payment-header h2 { margin: 0; font-size: 1rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; }
                
                .payment-body { padding: 1.5rem; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1.25rem; }
                
                .summary-box { background: #f8efed; border: 1px solid #fed7d7; border-radius: 0.5rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; }
                .summary-label { font-size: 0.75rem; font-weight: 800; color: #c53030; text-transform: uppercase; }
                .summary-value { font-size: 1.25rem; font-weight: 900; color: #9b2c2c; }

                .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
                .form-group label { font-size: 0.75rem; font-weight: 800; color: #475569; display: flex; justify-content: space-between; }
                .form-group input, .form-group select, .form-group textarea { padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; color: #0f172a; background: #f8fafc; transition: all 0.2s; }
                .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #3b82f6; background: white; outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
                
                .btn { padding: 0.875rem 1.5rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.875rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; border: none; }
                .btn-primary { background: #3b82f6; color: white; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3); }
                .btn-primary:hover:not(:disabled) { background: #2563eb; transform: translateY(-1px); }
                .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
                
                .btn-outline { background: white; border: 2px solid #e2e8f0; color: #475569; }
                .btn-outline:hover { border-color: #cbd5e1; background: #f8fafc; }

                /* Toaster */
                .alert-toast { position: fixed; bottom: 2rem; right: 2rem; padding: 1rem 1.5rem; border-radius: 0.5rem; background: white; border-left: 4px solid #3b82f6; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 0.75rem; z-index: 1000; animation: slideUp 0.3s ease-out; }
                .alert-toast.error { border-left-color: #ef4444; }
                .alert-toast.success { border-left-color: #10b981; }
                .alert-toast.warning { border-left-color: #f59e0b; }
                @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>

            <header className="app-header">
                <h1><DollarSign size={20} /> Saisie des Règlements</h1>
                <div>
                    <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white', marginRight: '0.5rem' }} onClick={() => navigate('/reglements/cancellation')}>
                        Historique & Annulations
                    </button>
                    <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={() => navigate('/dashboard')}>
                        Retour Tableau de bord
                    </button>
                </div>
            </header>

            <main className="main-layout">
                {/* 1. Clients Sidebar */}
                <aside className="sidebar">
                    <div className="sidebar-header">
                        <div className="sidebar-title">
                            <Users size={14} />
                            Sélection du Client ({clients?.length || 0})
                        </div>
                        <div className="search-box">
                            <Search size={14} color="#94a3b8" />
                            <input
                                placeholder="Rechercher un client..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="client-list" style={{ flex: 1, overflowY: 'auto' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f1f5f9' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#475569', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase' }}>Nom ou raison sociale</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.length > 0 ? filteredClients.map(client => {
                                    const isSelected = selectedClient?.IDCLIENTS === client.IDCLIENTS;
                                    return (
                                        <tr
                                            key={client.IDCLIENTS}
                                            onClick={() => handleClientSelect(client)}
                                            style={{
                                                cursor: 'pointer',
                                                background: isSelected ? '#eff6ff' : 'white',
                                                borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                                                borderBottom: '1px solid #f1f5f9'
                                            }}
                                        >
                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{client.NomRS || client.NomClient}</div>
                                                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b' }}>{client.NINEA ? `NINEA: ${client.NINEA}` : 'N/A'}</div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8125rem' }}>
                                            {searchTerm ? 'Aucun client trouvé pour cette recherche' : 'Aucun client disponible'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </aside>

                {/* 2. Invoices List (Center) */}
                <section className="content-area">
                    <div className="card" style={{ flex: 1 }}>
                        <div className="card-header">
                            <h2 className="card-title">
                                <ListChecks size={18} color="#3b82f6" />
                                Factures Impayées {selectedClient ? ` - ${selectedClient.NomRS}` : ''}
                            </h2>
                            {selectedClient && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#eff6ff', color: '#1e40af', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>
                                    {factures.length} facture(s) en attente
                                </span>
                            )}
                        </div>
                        <div className="table-container">
                            {selectedClient ? (
                                factures.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        className="custom-checkbox"
                                                        onChange={handleSelectAll}
                                                        checked={selectedFactures.length === factures.length && factures.length > 0}
                                                    />
                                                </th>
                                                <th>Code Dossier</th>
                                                <th>Numéro Facture</th>
                                                <th>Date Facture</th>
                                                <th style={{ textAlign: 'right' }}>Montant TTC</th>
                                                <th style={{ textAlign: 'right' }}>Déjà Réglé</th>
                                                <th style={{ textAlign: 'right' }}>Reliquat à Payer</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {factures.map(f => {
                                                const isChecked = selectedFactures.includes(f.IDFactures);
                                                return (
                                                    <tr key={f.IDFactures} className={isChecked ? 'checked' : ''}>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <input
                                                                type="checkbox"
                                                                className="custom-checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleFactureSelection(f.IDFactures)}
                                                            />
                                                        </td>
                                                        <td style={{ fontWeight: 700, color: '#475569' }}>{f.CodeDossier || 'N/A'}</td>
                                                        <td style={{ fontWeight: 800 }}>{f.NumeroFacture}</td>
                                                        <td>{new Date(f.Datefacture).toLocaleDateString()}</td>
                                                        <td className="amount">{parseFloat(f.MontantTTCFacture).toLocaleString()} F</td>
                                                        <td className="amount" style={{ color: '#059669' }}>{parseFloat(f.MontantRegleFacture).toLocaleString()} F</td>
                                                        <td className="amount due">{parseFloat(f.ReliquatFacture).toLocaleString()} F</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    </div>
                                ) : (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                                        <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Aucune facture impayée</h3>
                                        <p style={{ margin: 0, fontSize: '0.875rem' }}>Ce client est à jour dans ses paiements de factures validées.</p>
                                    </div>
                                )
                            ) : (
                                <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Users size={64} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                                    <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>Sélectionnez un client dans la liste pour voir ses factures</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 3. Payment Sidebar (Right) */}
                <aside className="payment-sidebar">
                    <div className="payment-header">
                        <h2><CreditCard size={18} /> Panneau d'Enregistrement</h2>
                    </div>

                    <div className="payment-body" style={{ opacity: selectedClient ? 1 : 0.5, pointerEvents: selectedClient ? 'auto' : 'none' }}>

                        <div className="summary-box">
                            <div>
                                <div className="summary-label">Montant à Régler (Sélection)</div>
                                <div style={{ fontSize: '0.6875rem', color: '#7f1d1d', marginTop: '4px' }}>{selectedFactures.length} facture(s) cochée(s)</div>
                            </div>
                            <div className="summary-value">{totalARegler.toLocaleString()} <span style={{ fontSize: '0.875rem' }}>{getReferenceSymbol()}</span></div>
                        </div>

                        <div className="form-group">
                            <label>
                                Montant du règlement reçu
                                {totalARegler > 0 && (
                                    <span
                                        style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={handleAutoFillMnt}
                                    >
                                        Mettre le total
                                    </span>
                                )}
                            </label>
                            <input
                                type="number"
                                placeholder="0"
                                value={montantReglement}
                                onChange={(e) => setMontantReglement(e.target.value)}
                                style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}
                            />
                            {montantReglement && parseFloat(montantReglement) > totalARegler && totalARegler > 0 && (
                                <div style={{ fontSize: '0.7rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                    <CheckCircle2 size={12} /> Un crédit de {(parseFloat(montantReglement) - totalARegler).toLocaleString()} F sera généré
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Date du règlement</label>
                            <input
                                type="date"
                                value={dateReglement}
                                onChange={(e) => setDateReglement(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Mode de règlement</label>
                            <select
                                value={selectedMode}
                                onChange={(e) => setSelectedMode(e.target.value)}
                            >
                                <option value="" disabled>Sélectionner un mode</option>
                                {modes.map(mode => (
                                    <option key={mode.IDModesReglements} value={mode.IDModesReglements}>
                                        {mode.libelle}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Observations (N° Chèque, Référence Virement...)</label>
                            <textarea
                                rows="3"
                                placeholder="Numéro de pièce, informations complémentaires..."
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                            />
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                onClick={processPayment}
                                disabled={isProcessing || !selectedClient || selectedFactures.length === 0 || !montantReglement}
                            >
                                {isProcessing ? 'Traitement en cours...' : 'Enregistrer le Règlement'}
                            </button>

                            <button className="btn btn-outline" style={{ width: '100%', borderStyle: 'dashed' }}>
                                Imputer depuis Compte Tampon
                            </button>
                        </div>
                    </div>
                </aside>
            </main>

            {message.text && (
                <div className={`alert-toast ${message.type}`}>
                    {message.type === 'error' ? <AlertCircle size={20} color="#ef4444" /> :
                        message.type === 'warning' ? <AlertCircle size={20} color="#f59e0b" /> :
                            <CheckCircle2 size={20} color="#10b981" />}
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{message.text}</span>
                    <button onClick={() => setMessage({ text: '', type: '' })} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
