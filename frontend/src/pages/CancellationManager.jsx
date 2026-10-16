import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    History, Search, Users, FileText, Trash2, XCircle, AlertTriangle, ArrowLeft, RefreshCcw, DollarSign
} from 'lucide-react';
import { clientsAPI, reglementsAPI, facturesAPI } from '../services/api';

export default function CancellationManager() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Data states
    const [clients, setClients] = useState([]);
    const [reglements, setReglements] = useState([]);
    const [movements, setMovements] = useState([]);
    const [factures, setFactures] = useState([]);

    // Selection states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [activeTab, setActiveTab] = useState('reglements'); // 'reglements', 'movements', 'factures'

    // UI States
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        loadClients();
    }, []);

    // Pré-sélection du client (et de l'onglet) depuis l'URL, ex: ?clientId=12&tab=movements
    useEffect(() => {
        const clientId = searchParams.get('clientId');
        if (!clientId || clients.length === 0) return;
        const client = clients.find(c => String(c.IDCLIENTS) === String(clientId));
        if (client) {
            handleClientSelect(client);
            const tab = searchParams.get('tab');
            if (tab) setActiveTab(tab);
        }
    }, [clients, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadClients = async () => {
        try {
            const res = await clientsAPI.getAll();
            setClients(res.data);
        } catch (error) {
            console.error('Error loading clients:', error);
            showMessage('Erreur lors du chargement des clients', 'error');
        }
    };

    const handleClientSelect = async (client) => {
        setSelectedClient(client);
        setIsLoading(true);
        try {
            const [regRes, movRes, facRes] = await Promise.all([
                reglementsAPI.getClientHistory(client.IDCLIENTS),
                reglementsAPI.getMovements(client.IDCLIENTS),
                facturesAPI.getByClient(client.IDCLIENTS)
            ]);
            setReglements(regRes.data);
            setMovements(movRes.data);
            setFactures(facRes.data);
        } catch (error) {
            console.error('Error loading client data:', error);
            showMessage('Erreur lors du chargement des données du client', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelReglement = async (id) => {
        if (!window.confirm('Êtes-vous sûr de vouloir annuler ce règlement ? Cette action remettra la facture à son état initial.')) return;

        try {
            await reglementsAPI.cancel(id);
            showMessage('Règlement annulé avec succès', 'success');
            handleClientSelect(selectedClient); // Refresh
        } catch (error) {
            console.error('Error cancelling reglement:', error);
            showMessage(error.response?.data?.error || 'Erreur lors de l\'annulation', 'error');
        }
    };

    const handleCancelMovement = async (id) => {
        if (!window.confirm('Êtes-vous sûr de vouloir annuler ce mouvement ? Le solde du compte client sera recalculé.')) return;

        try {
            await reglementsAPI.cancelMovement(id);
            showMessage('Mouvement annulé avec succès', 'success');
            handleClientSelect(selectedClient); // Refresh
        } catch (error) {
            console.error('Error cancelling movement:', error);
            showMessage(error.response?.data?.error || 'Erreur lors de l\'annulation', 'error');
        }
    };

    const handleDeleteFacture = async (id) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) return;

        try {
            await facturesAPI.delete(id);
            showMessage('Facture supprimée avec succès', 'success');
            handleClientSelect(selectedClient); // Refresh
        } catch (error) {
            console.error('Error deleting facture:', error);
            showMessage(error.response?.data?.error || 'Erreur lors de la suppression. Vérifiez que la facture n\'a pas de règlements.', 'error');
        }
    };

    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    };

    const filteredClients = clients.filter(c =>
        `${c.NomRS} ${c.NomClient} ${c.NINEA}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const styles = {
        container: { display: 'flex', height: '100vh', background: '#f1f5f9', fontFamily: 'Inter, sans-serif' },
        sidebar: { width: '300px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' },
        main: { flex: 1, overflowY: 'auto', padding: '2rem' },
        header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
        card: { background: 'white', borderRadius: '0.75rem', shadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' },
        tabBar: { display: 'flex', borderBottom: '1px solid #e2e8f0' },
        tab: (active) => ({
            padding: '1rem 1.5rem',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.875rem',
            borderBottom: active ? '3px solid #3b82f6' : '3px solid transparent',
            color: active ? '#1e40af' : '#64748b',
            background: active ? '#eff6ff' : 'transparent'
        }),
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { textAlign: 'left', padding: '1rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #e2e8f0' },
        td: { padding: '1rem', fontSize: '0.8125rem', borderBottom: '1px solid #f1f5f9' },
        btnDelete: { color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.375rem', transition: 'all 0.2s' },
        toast: (type) => ({
            position: 'fixed', bottom: '2rem', right: '2rem', padding: '1rem 1.5rem', borderRadius: '0.5rem',
            background: 'white', borderLeft: `4px solid ${type === 'error' ? '#ef4444' : '#10b981'}`,
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 1000
        })
    };

    return (
        <div style={styles.container}>
            {/* Clients Sidebar */}
            <aside style={styles.sidebar}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#1e293b' }}>
                        <Users size={18} />
                        <span style={{ fontWeight: 800, fontSize: '0.875rem' }}>Annulation Règlements</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem' }}
                            placeholder="Rechercher un client..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredClients.map(c => (
                        <div
                            key={c.IDCLIENTS}
                            onClick={() => handleClientSelect(c)}
                            style={{
                                padding: '1rem 1.5rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                                background: selectedClient?.IDCLIENTS === c.IDCLIENTS ? '#eff6ff' : 'transparent',
                                borderLeft: selectedClient?.IDCLIENTS === c.IDCLIENTS ? '4px solid #3b82f6' : '4px solid transparent'
                            }}
                        >
                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{c.NomRS}</div>
                            <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>NINEA: {c.NINEA || 'N/A'}</div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Area */}
            <main style={styles.main}>
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => navigate('/reglements')} style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex' }}>
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Historique & Annulations</h1>
                            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>Gérez les erreurs de saisie et de facturation</p>
                        </div>
                    </div>
                    {selectedClient && (
                        <div style={{ background: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                            <span style={{ fontWeight: 800, color: '#1e40af' }}>{selectedClient.NomRS}</span>
                        </div>
                    )}
                </div>

                {selectedClient ? (
                    <div style={styles.card}>
                        <div style={styles.tabBar}>
                            <div style={styles.tab(activeTab === 'reglements')} onClick={() => setActiveTab('reglements')}>Règlements Factures ({reglements.length})</div>
                            <div style={styles.tab(activeTab === 'movements')} onClick={() => setActiveTab('movements')}>Mouvements Compte ({movements.length})</div>
                            <div style={styles.tab(activeTab === 'factures')} onClick={() => setActiveTab('factures')}>Factures ({factures.length})</div>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            {isLoading ? (
                                <div style={{ padding: '4rem', textAlign: 'center' }}><RefreshCcw className="animate-spin" /></div>
                            ) : activeTab === 'reglements' ? (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>Date</th>
                                            <th style={styles.th}>Facture</th>
                                            <th style={styles.th}>Dossier</th>
                                            <th style={styles.th}>Mode</th>
                                            <th style={styles.th}>Montant</th>
                                            <th style={styles.th}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reglements.map(r => (
                                            <tr key={r.IDReglements}>
                                                <td style={styles.td}>{new Date(r.Datereglement).toLocaleDateString()}</td>
                                                <td style={styles.td}>{r.NumeroFacture}</td>
                                                <td style={styles.td}>{r.CodeDossier}</td>
                                                <td style={styles.td}>{r.modeLibelle}</td>
                                                <td style={{ ...styles.td, fontWeight: 700 }}>{parseFloat(r.MontantReglement).toLocaleString()} F</td>
                                                <td style={styles.td}>
                                                    <button onClick={() => handleCancelReglement(r.IDReglements)} style={styles.btnDelete} title="Annuler ce règlement">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            ) : activeTab === 'movements' ? (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>Date</th>
                                            <th style={styles.th}>Libellé</th>
                                            <th style={styles.th}>Sens</th>
                                            <th style={styles.th}>Montant</th>
                                            <th style={styles.th}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {movements.map(m => (
                                            <tr key={m.IDMouvementsComptesClients}>
                                                <td style={styles.td}>{new Date(m.DateMouvement).toLocaleDateString()}</td>
                                                <td style={styles.td}>{m.libelle}</td>
                                                <td style={styles.td}>
                                                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 800, background: m.Sens === 'C' ? '#ecfdf5' : '#fef2f2', color: m.Sens === 'C' ? '#059669' : '#dc2626' }}>
                                                        {m.Sens === 'C' ? 'CRÉDIT' : 'DÉBIT'}
                                                    </span>
                                                </td>
                                                <td style={{ ...styles.td, fontWeight: 700 }}>{parseFloat(m.MontantMouvement).toLocaleString()} F</td>
                                                <td style={styles.td}>
                                                    <button onClick={() => handleCancelMovement(m.IDMouvementsComptesClients)} style={styles.btnDelete} title="Annuler ce mouvement">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>Date</th>
                                            <th style={styles.th}>Numéro</th>
                                            <th style={styles.th}>Dossier</th>
                                            <th style={styles.th}>Total TTC</th>
                                            <th style={styles.th}>Réglé</th>
                                            <th style={styles.th}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {factures.map(f => (
                                            <tr key={f.IDFactures}>
                                                <td style={styles.td}>{new Date(f.DateFacture).toLocaleDateString()}</td>
                                                <td style={styles.td}>{f.NumeroFacture}</td>
                                                <td style={styles.td}>{f.CodeDossier}</td>
                                                <td style={{ ...styles.td, fontWeight: 700 }}>{parseFloat(f.MontantTTCFacture).toLocaleString()} F</td>
                                                <td style={styles.td}>{parseFloat(f.MontantRegleFacture).toLocaleString()} F</td>
                                                <td style={styles.td}>
                                                    <button
                                                        onClick={() => handleDeleteFacture(f.IDFactures)}
                                                        style={{ ...styles.btnDelete, opacity: parseFloat(f.MontantRegleFacture) > 0 ? 0.3 : 1 }}
                                                        disabled={parseFloat(f.MontantRegleFacture) > 0}
                                                        title={parseFloat(f.MontantRegleFacture) > 0 ? "Impossible de supprimer: règlement existant" : "Supprimer cette facture"}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '8rem', textAlign: 'center', color: '#94a3b8' }}>
                        <History size={64} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <h3 style={{ margin: 0 }}>Sélectionnez un client</h3>
                        <p style={{ margin: 0, fontSize: '0.875rem' }}>Pour gérer son historique et ses annulations</p>
                    </div>
                )}
            </main>

            {/* Toast */}
            {message.text && (
                <div style={styles.toast(message.type)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {message.type === 'error' ? <XCircle size={20} color="#ef4444" /> : <RefreshCcw size={20} color="#10b981" />}
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>{message.text}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
