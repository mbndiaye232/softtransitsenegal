import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart3, Calendar, Filter, Eye, Printer, ArrowLeft, FileText,
    AlertCircle, CheckCircle2, X, TrendingUp, Loader2, Users, FileSignature, BookOpen, Briefcase, FileSpreadsheet, Download
} from 'lucide-react';
import { etatsFinanciersAPI, clientsAPI } from '../services/api';
import * as XLSX from 'xlsx';

export default function EtatsFinanciers() {
    const navigate = useNavigate();

    // Tab management
    const [activeTab, setActiveTab] = useState('factures-clients');

    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // ----------- TAB 1: Factures Clients -----------
    const [fcDateDebut, setFcDateDebut] = useState('');
    const [fcDateFin, setFcDateFin] = useState('');
    const [exonereTVA, setExonereTVA] = useState('1'); // '1' = exonérés, '0' = non exonérés
    const [fcFactures, setFcFactures] = useState([]);
    const [fcTotals, setFcTotals] = useState(null);
    const [fcReportTitle, setFcReportTitle] = useState('');

    // ----------- TAB 2: Relevé Client -----------
    const [rcClients, setRcClients] = useState([]);
    const [rcClientId, setRcClientId] = useState('');
    const [rcClientData, setRcClientData] = useState(null);
    const [rcDateDebut, setRcDateDebut] = useState('');
    const [rcDateFin, setRcDateFin] = useState('');
    const [rcTypeFacture, setRcTypeFacture] = useState('T'); // T/D/P
    const [rcEtatFacture, setRcEtatFacture] = useState('T'); // T/N/S
    const [rcFactures, setRcFactures] = useState([]);
    const [rcTotals, setRcTotals] = useState(null);
    const [rcReportTitle, setRcReportTitle] = useState('');

    // ----------- TAB 3: Grand Livre -----------
    const [glAnnee, setGlAnnee] = useState(new Date().getFullYear().toString());
    const [glData, setGlData] = useState([]);
    const [glTotals, setGlTotals] = useState(null);
    const [glReportTitle, setGlReportTitle] = useState('');

    // ----------- TAB 4: CA Clients -----------
    const [caData, setCaData] = useState([]);
    const [caTotals, setCaTotals] = useState(null);
    const [caReportTitle, setCaReportTitle] = useState('');

    // ----------- TAB 5: Journal SAARI -----------
    const [jsAnnee, setJsAnnee] = useState(new Date().getFullYear().toString());
    const [jsMois, setJsMois] = useState((new Date().getMonth() + 1).toString());
    const [jsData, setJsData] = useState([]);
    const [jsReportTitle, setJsReportTitle] = useState('');

    useEffect(() => {
        // Load clients for Relevé Client tab
        clientsAPI.getAll().then(res => {
            setRcClients(res.data || []);
        }).catch(err => console.error("Could not load clients", err));
    }, []);

    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatMoney = (val) => {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // ----- Handlers Tab 1 -----
    const handleAfficherFacturesClients = async () => {
        if (!fcDateDebut) return showMessage('Veuillez saisir la date de début SVP', 'warning');
        if (!fcDateFin) return showMessage('Veuillez saisir la date de fin SVP', 'warning');
        if (new Date(fcDateFin) < new Date(fcDateDebut)) {
            return showMessage('La date de début ne peut pas être postérieure à la date de fin. Veuillez corriger SVP.', 'warning');
        }

        setLoading(true);
        setHasSearched(true);

        try {
            const res = await etatsFinanciersAPI.getFacturesClients({
                dateDebut: fcDateDebut, dateFin: fcDateFin, exonereTVA
            });

            if (res.data.count === 0) {
                const statutLabel = exonereTVA === '1' ? 'O' : 'N';
                showMessage(`Aucune facture n'est disponible pour la période ${formatDate(fcDateDebut)} et ${formatDate(fcDateFin)} pour les clients avec un statut exonéré=${statutLabel}`, 'warning');
                setFcFactures([]); setFcTotals(null); setFcReportTitle('');
                return;
            }

            setFcFactures(res.data.factures);
            setFcTotals(res.data.totals);
            setFcReportTitle(`État des factures des clients ${exonereTVA === '1' ? 'exonérés' : 'non exonérés'} entre ${formatDate(fcDateDebut)} et ${formatDate(fcDateFin)}`);
        } catch (error) {
            console.error('Error:', error);
            showMessage(error.response?.data?.error || 'Erreur lors du chargement du rapport', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ----- Handlers Tab 2 -----
    const handleAfficherReleveClient = async () => {
        if (!rcClientId) return showMessage('Veuillez sélectionner le client SVP', 'warning');
        if (!rcDateDebut) return showMessage('Veuillez saisir la date de début SVP', 'warning');
        if (!rcDateFin) return showMessage('Veuillez saisir la date de fin SVP', 'warning');
        if (new Date(rcDateFin) < new Date(rcDateDebut)) {
            return showMessage('La date de début ne peut pas être postérieure à la date de fin. Veuillez corriger SVP.', 'warning');
        }

        setLoading(true);
        setHasSearched(true);

        try {
            const res = await etatsFinanciersAPI.getReleveClient({
                clientId: rcClientId,
                dateDebut: rcDateDebut,
                dateFin: rcDateFin,
                typeFacture: rcTypeFacture,
                etatFacture: rcEtatFacture
            });

            if (res.data.count === 0) {
                showMessage(`Aucune facture n'a été trouvée pour ce client pour la période indiquée. Veuillez changer vos critères SVP.`, 'warning');
                setRcFactures([]); setRcTotals(null); setRcClientData(null); setRcReportTitle('');
                return;
            }

            setRcFactures(res.data.factures);
            setRcTotals(res.data.totals);
            setRcClientData(res.data.client);
            
            let title = "Etat des factures";
            if (rcTypeFacture === 'D') title = "Etat factures douane";
            if (rcTypeFacture === 'P') title = "Etat factures globales/prestations";
            setRcReportTitle(`${title} – ${res.data.client.NomRS} (du ${formatDate(rcDateDebut)} au ${formatDate(rcDateFin)})`);
        } catch (error) {
            console.error('Error:', error);
            showMessage(error.response?.data?.error || 'Erreur lors du chargement du relevé', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAfficherGrandLivre = async () => {
        if (!glAnnee || glAnnee.length !== 4) return showMessage('Veuillez saisir l\'année avec 4 chiffres SVP', 'warning');

        setLoading(true);
        setHasSearched(true);

        try {
            const res = await etatsFinanciersAPI.getGrandLivre({ annee: glAnnee });

            if (res.data.count === 0) {
                showMessage(`Aucune donnée trouvée pour l'année ${glAnnee}`, 'warning');
                setGlData([]); setGlTotals(null); setGlReportTitle('');
                return;
            }

            setGlData(res.data.data);
            setGlTotals(res.data.totals);
            setGlReportTitle(`Grand livre ${glAnnee}`);
        } catch (error) {
            console.error('Error:', error);
            showMessage(error.response?.data?.error || 'Erreur lors du chargement du grand livre', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAfficherCAClients = async () => {
        setLoading(true);
        setHasSearched(true);

        try {
            const res = await etatsFinanciersAPI.getCA_Clients();

            if (res.data.count === 0) {
                showMessage(`Aucun client facturé trouvé`, 'warning');
                setCaData([]); setCaTotals(null); setCaReportTitle('');
                return;
            }

            setCaData(res.data.data);
            setCaTotals(res.data.totals);
            setCaReportTitle(`Etat des chiffres d'affaires des clients`);
        } catch (error) {
            console.error('Error:', error);
            showMessage(error.response?.data?.error || 'Erreur lors du chargement des CA', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImprimer = () => {
        window.print();
    };

    const handleImprimerRelevePDF = async () => {
        if (!rcClientId) return showMessage('Veuillez sélectionner un client', 'warning');
        if (!rcDateDebut || !rcDateFin) return showMessage('Veuillez sélectionner la période', 'warning');

        setLoading(true);
        try {
            const res = await etatsFinanciersAPI.getReleveClientPDF({
                clientId: rcClientId,
                dateDebut: rcDateDebut,
                dateFin: rcDateFin,
                typeFacture: rcTypeFacture,
                etatFacture: rcEtatFacture
            });

            // Create a Blob from the PDF Stream
            const file = new Blob([res.data], { type: 'application/pdf' });
            
            // Or download it:
            const fileURL = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = fileURL;
            link.download = `ReleveCompte_${new Date().getTime()}.pdf`;
            link.click();
            URL.revokeObjectURL(fileURL);
            
            showMessage('Le relevé PDF a été généré avec succès', 'success');

        } catch (error) {
            console.error('Error generating PDF:', error);
            showMessage('Erreur lors de la génération du PDF du relevé', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImprimerEtatFacturesPDF = async () => {
        if (!rcClientId) return showMessage('Veuillez sélectionner un client', 'warning');
        if (!rcDateDebut || !rcDateFin) return showMessage('Veuillez sélectionner la période', 'warning');

        setLoading(true);
        try {
            const res = await etatsFinanciersAPI.getEtatFacturesPDF({
                clientId: rcClientId,
                dateDebut: rcDateDebut,
                dateFin: rcDateFin,
                typeFacture: rcTypeFacture,
                etatFacture: rcEtatFacture
            });

            // Create a Blob from the PDF Stream
            const file = new Blob([res.data], { type: 'application/pdf' });
            
            // Or download it:
            const fileURL = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = fileURL;
            link.download = `EtatFactures_${new Date().getTime()}.pdf`;
            link.click();
            URL.revokeObjectURL(fileURL);
            
            showMessage('L\'état PDF a été généré avec succès', 'success');

        } catch (error) {
            console.error('Error generating Etat PDF:', error);
            showMessage('Erreur lors de la génération de l\'état PDF', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAfficherJournalSAARI = async () => {
        if (!jsAnnee || jsAnnee.length !== 4) return showMessage('Veuillez saisir l\'année avec 4 chiffres SVP', 'warning');
        if (!jsMois) return showMessage('Veuillez sélectionner le mois SVP', 'warning');

        setLoading(true);
        setHasSearched(true);

        try {
            const res = await etatsFinanciersAPI.getJournalSAARI({ annee: jsAnnee, mois: jsMois });

            if (res.data.count === 0) {
                showMessage(`Aucune donnée pour ce mois`, 'warning');
                setJsData([]); setJsReportTitle('');
                return;
            }

            setJsData(res.data.data);
            const numMois = parseInt(jsMois, 10);
            const nomMois = new Date(jsAnnee, numMois - 1, 1).toLocaleString('fr-FR', { month: 'long' });
            setJsReportTitle(`Journal du ${nomMois} ${jsAnnee}`);
            showMessage(`Traitement terminé avec succès. Vous pouvez maintenant exporter.`, 'success');
        } catch (error) {
            console.error('Error:', error);
            showMessage(error.response?.data?.error || 'Erreur lors du chargement du journal', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        if (jsData.length === 0) return showMessage('La table est vide, veuillez effectuer le traitement', 'warning');

        const ws = XLSX.utils.json_to_sheet(jsData.map(r => ({
            "CodeJournal": r.CodeJournal,
            "Date facture": formatDate(r.DateFacture),
            "Numéro pièce": r.NumeroPiece,
            "Numéro Facture": r.NumeroFacture,
            "Code dossier": r.CodeDossier || '',
            "Code dossier court": r.CodeDossierCourt || 'Néant',
            "Code Compte client SAARI": r.CodeCompteSAARI || '',
            "Code Client": r.CodeClient || '',
            "Libellé": r.Libelle,
            "Date échéance": formatDate(r.DateEcheance),
            "Débit": r.Debit || '',
            "Crédit": r.Credit || '',
            "N° Compte SAARI": r.CompteSAARI || r.CodeCompteSAARI || ''
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Journal");
        const fileName = `RecapFactures_${Date.now()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const tabs = [
        { id: 'factures-clients', label: 'Factures Clients', icon: FileText },
        { id: 'releve-client', label: 'Relevé de compte client', icon: FileSignature },
        { id: 'grand-livre', label: 'Grand Livre', icon: BookOpen },
        { id: 'ca-clients', label: 'Chiffre d\'affaires', icon: Briefcase },
        { id: 'journal-saari', label: 'Journal (SAARI)', icon: FileSpreadsheet }
    ];

    // ----- Render Helpers -----
    const renderFacturesClientsTab = () => (
        <div className="ef-main">
            <div className="ef-table-area">
                {fcReportTitle && (
                    <div className="ef-report-title">
                        <TrendingUp size={18} color="#4f46e5" />
                        {fcReportTitle}
                        <span className="ef-count-pill">{fcFactures.length} facture(s)</span>
                    </div>
                )}

                <div className="ef-table-card">
                    {loading ? (
                        <div className="ef-empty"><Loader2 size={40} className="ef-spinner" color="#6366f1" /></div>
                    ) : fcFactures.length > 0 ? (
                        <div className="ef-table-scroll">
                            <div style={{ overflowX: 'auto' }}>
                                <table className="ef-table">
                                <thead>
                                    <tr>
                                        <th>Nom ou Raison Sociale</th>
                                        <th>NINEA</th>
                                        <th>Exonéré</th>
                                        <th>N° Cotation</th>
                                        <th>Date Facture</th>
                                        <th>N° Facture</th>
                                        <th style={{ textAlign: 'right' }}>Montant HT</th>
                                        <th style={{ textAlign: 'right' }}>Montant TVA</th>
                                        <th style={{ textAlign: 'right' }}>Montant TTC</th>
                                        <th>Code Dossier</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fcFactures.map((f, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 700, color: '#0f172a' }}>{f.NomRS}</td>
                                            <td style={{ color: '#64748b' }}>{f.NINEA || '—'}</td>
                                            <td>
                                                <span className={`ef-exo-badge ${f.ExonereTVA ? 'oui' : 'non'}`}>
                                                    {f.ExonereTVA ? 'Oui' : 'Non'}
                                                </span>
                                            </td>
                                            <td style={{ color: '#64748b' }}>{f.RefCotation || '—'}</td>
                                            <td>{formatDate(f.Datefacture)}</td>
                                            <td style={{ fontWeight: 800 }}>{f.NumeroFacture}</td>
                                            <td className="amount">{formatMoney(f.MontantHTFacture)}</td>
                                            <td className="amount" style={{ color: '#dc2626' }}>{formatMoney(f.MontantTVAFacture)}</td>
                                            <td className="amount" style={{ color: '#059669', fontWeight: 800 }}>{formatMoney(f.MontantTTCFacture)}</td>
                                            <td style={{ fontWeight: 600 }}>{f.CodeDossier || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {fcTotals && (
                                    <tfoot>
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 900 }}>TOTAUX</td>
                                            <td className="amount">{formatMoney(fcTotals.totalHT)}</td>
                                            <td className="amount" style={{ color: '#dc2626' }}>{formatMoney(fcTotals.totalTVA)}</td>
                                            <td className="amount" style={{ color: '#059669' }}>{formatMoney(fcTotals.totalTTC)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                            </div>
                        </div>
                    ) : (
                        <div className="ef-empty">
                            <div className="ef-empty-icon"><FileText size={36} color="#94a3b8" /></div>
                            <h3>{hasSearched ? 'Aucune facture trouvée' : 'Factures de la période'}</h3>
                        </div>
                    )}
                </div>
            </div>

            <aside className="ef-controls no-print">
                <div className="ef-controls-header">
                    <h3><Filter size={16} /> Paramètres du rapport</h3>
                </div>
                <div className="ef-controls-body">
                    <div className="ef-radio-group">
                        <div className="ef-radio-group-title">Statut clients</div>
                        <div className="ef-radio-option">
                            <input type="radio" id="exo-oui" value="1" checked={exonereTVA === '1'} onChange={(e) => setExonereTVA(e.target.value)} />
                            <label htmlFor="exo-oui">Clients exonérés</label>
                        </div>
                        <div className="ef-radio-option">
                            <input type="radio" id="exo-non" value="0" checked={exonereTVA === '0'} onChange={(e) => setExonereTVA(e.target.value)} />
                            <label htmlFor="exo-non">Clients non exonérés</label>
                        </div>
                    </div>
                    <div className="ef-field">
                        <label><Calendar size={12} style={{ display: 'inline' }} /> Date début</label>
                        <input type="date" value={fcDateDebut} onChange={(e) => setFcDateDebut(e.target.value)} />
                    </div>
                    <div className="ef-field">
                        <label><Calendar size={12} style={{ display: 'inline' }} /> Date fin</label>
                        <input type="date" value={fcDateFin} onChange={(e) => setFcDateFin(e.target.value)} />
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />
                    <button className="ef-btn ef-btn-primary" onClick={handleAfficherFacturesClients} disabled={loading}>
                        {loading ? <><Loader2 size={16} className="ef-spinner" /> Chargement...</> : <><Eye size={16} /> Afficher</>}
                    </button>
                    <button className="ef-btn ef-btn-success" onClick={handleImprimer} disabled={fcFactures.length === 0}>
                        <Printer size={16} /> Imprimer
                    </button>
                </div>
            </aside>
        </div>
    );

    const renderReleveClientTab = () => (
        <div className="ef-main">
            <div className="ef-table-area">
                {rcReportTitle && rcClientData && (
                    <div className="ef-report-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', borderColor: '#99f6e4' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileSignature size={18} color="#0d9488" />
                                {rcReportTitle}
                            </div>
                            <span className="ef-count-pill" style={{ background: '#ccfbf1', color: '#115e59' }}>{rcFactures.length} facture(s)</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 600 }}>
                            Client: {rcClientData.NomRS} | Email: {rcClientData.EmailClient || 'N/A'} | Encours: {formatMoney(rcClientData.EncoursAutorise)} F
                        </div>
                    </div>
                )}

                <div className="ef-table-card">
                    {loading ? (
                        <div className="ef-empty"><Loader2 size={40} className="ef-spinner" color="#0d9488" /></div>
                    ) : rcFactures.length > 0 ? (
                        <div className="ef-table-scroll">
                            <div style={{ overflowX: 'auto' }}>
                                <table className="ef-table">
                                <thead>
                                    <tr>
                                        <th>N° Facture</th>
                                        <th>Date Facture</th>
                                        <th>Code Dossier</th>
                                        <th style={{ textAlign: 'right' }}>Montant TTC (Sortie)</th>
                                        <th style={{ textAlign: 'right' }}>Déjà Réglé (Entrée)</th>
                                        <th style={{ textAlign: 'right' }}>Reste à Payer</th>
                                        <th>Date Échéance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rcFactures.map((f, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 800, color: '#1e293b' }}>{f.NumeroFacture}</td>
                                            <td>{formatDate(f.Datefacture)}</td>
                                            <td style={{ color: '#64748b' }}>{f.CodeDossier || '—'}</td>
                                            <td className="amount" style={{ color: '#dc2626' }}>{formatMoney(f.MontantTTCFacture)}</td>
                                            <td className="amount" style={{ color: '#059669' }}>{formatMoney(f.MontantRegleFacture)}</td>
                                            <td className="amount" style={{ color: f.ReliquatFacture > 0 ? '#b91c1c' : '#475569', fontWeight: 800 }}>{formatMoney(f.ReliquatFacture)}</td>
                                            <td>{formatDate(f.DateEcheance) || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {rcTotals && (
                                    <tfoot>
                                        <tr>
                                            <td colSpan={3} style={{ textAlign: 'right', fontWeight: 900 }}>TOTAUX</td>
                                            <td className="amount" style={{ color: '#dc2626' }}>{formatMoney(rcTotals.totalSortie)}</td>
                                            <td className="amount" style={{ color: '#059669' }}>{formatMoney(rcTotals.totalEntree)}</td>
                                            <td className="amount" style={{ color: '#b91c1c', fontSize: '1rem' }}>{formatMoney(rcTotals.reliquatClient)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                            </div>
                        </div>
                    ) : (
                        <div className="ef-empty">
                            <div className="ef-empty-icon"><FileSignature size={36} color="#94a3b8" /></div>
                            <h3>{hasSearched ? 'Aucune facture trouvée' : 'Relevé de compte client'}</h3>
                        </div>
                    )}
                </div>
            </div>

            <aside className="ef-controls no-print">
                <div className="ef-controls-header" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)' }}>
                    <h3><Filter size={16} /> Configuration du relevé</h3>
                </div>
                <div className="ef-controls-body">
                    <div className="ef-field">
                        <label><Users size={12} style={{ display: 'inline' }} /> Client *</label>
                        <select value={rcClientId} onChange={(e) => setRcClientId(e.target.value)}>
                            <option value="" disabled>Sélectionner un client...</option>
                            {rcClients.map(c => (
                                <option key={c.IDCLIENTS} value={c.IDCLIENTS}>{c.NomRS || c.NomClient}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div className="ef-field" style={{ flex: 1 }}>
                            <label><Calendar size={12} style={{ display: 'inline' }} /> Date début *</label>
                            <input type="date" value={rcDateDebut} onChange={(e) => setRcDateDebut(e.target.value)} />
                        </div>
                        <div className="ef-field" style={{ flex: 1 }}>
                            <label><Calendar size={12} style={{ display: 'inline' }} /> Date fin *</label>
                            <input type="date" value={rcDateFin} onChange={(e) => setRcDateFin(e.target.value)} />
                        </div>
                    </div>

                    <div className="ef-radio-group">
                        <div className="ef-radio-group-title">Type de Factures</div>
                        <div className="ef-radio-option">
                            <input type="radio" id="tf-T" value="T" checked={rcTypeFacture === 'T'} onChange={(e) => setRcTypeFacture(e.target.value)} />
                            <label htmlFor="tf-T">Toutes</label>
                        </div>
                        <div className="ef-radio-option">
                            <input type="radio" id="tf-D" value="D" checked={rcTypeFacture === 'D'} onChange={(e) => setRcTypeFacture(e.target.value)} />
                            <label htmlFor="tf-D">Douane (FD)</label>
                        </div>
                        <div className="ef-radio-option">
                            <input type="radio" id="tf-P" value="P" checked={rcTypeFacture === 'P'} onChange={(e) => setRcTypeFacture(e.target.value)} />
                            <label htmlFor="tf-P">Prestations / Globales</label>
                        </div>
                    </div>

                    <div className="ef-radio-group">
                        <div className="ef-radio-group-title">État des Factures</div>
                        <div className="ef-radio-option">
                            <input type="radio" id="ef-T" value="T" checked={rcEtatFacture === 'T'} onChange={(e) => setRcEtatFacture(e.target.value)} />
                            <label htmlFor="ef-T">Toutes</label>
                        </div>
                        <div className="ef-radio-option">
                            <input type="radio" id="ef-N" value="N" checked={rcEtatFacture === 'N'} onChange={(e) => setRcEtatFacture(e.target.value)} />
                            <label htmlFor="ef-N">Non Soldées</label>
                        </div>
                        <div className="ef-radio-option">
                            <input type="radio" id="ef-S" value="S" checked={rcEtatFacture === 'S'} onChange={(e) => setRcEtatFacture(e.target.value)} />
                            <label htmlFor="ef-S">Soldées</label>
                        </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />
                    <button className="ef-btn ef-btn-primary" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)' }} onClick={handleAfficherReleveClient} disabled={loading}>
                        {loading ? <><Loader2 size={16} className="ef-spinner" /> Chargement...</> : <><Eye size={16} /> Afficher</>}
                    </button>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="ef-btn ef-btn-success" style={{ flex: 1, padding: '0.5rem' }} onClick={handleImprimerRelevePDF} disabled={rcFactures.length === 0 || loading}>
                            {loading ? <Loader2 size={16} className="ef-spinner" /> : <Printer size={16} />} Imprimer Relevé
                        </button>
                        <button className="ef-btn ef-btn-success" style={{ flex: 1, padding: '0.5rem', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }} onClick={handleImprimerEtatFacturesPDF} disabled={rcFactures.length === 0 || loading}>
                            {loading ? <Loader2 size={16} className="ef-spinner" /> : <Printer size={16} />} Imprimer État
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );

    const renderGrandLivreTab = () => {
        let runningSolde = 0; // Local counter for running balance display
        let transactionCount = glData.reduce((acc, curr) => acc + 1 + (curr.reglements?.length || 0), 0);
        return (
            <div className="ef-main">
                <div className="ef-table-area">
                    {glReportTitle && (
                        <div className="ef-report-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', borderColor: '#fde68a' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309' }}>
                                    <BookOpen size={18} />
                                    {glReportTitle}
                                </div>
                                <span className="ef-count-pill" style={{ background: '#fef3c7', color: '#92400e' }}>{transactionCount} transaction(s)</span>
                            </div>
                        </div>
                    )}

                    <div className="ef-table-card">
                        {loading ? (
                            <div className="ef-empty"><Loader2 size={40} className="ef-spinner" color="#d97706" /></div>
                        ) : glData.length > 0 ? (
                            <div className="ef-table-scroll">
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="ef-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Libellé</th>
                                            <th>Numéro</th>
                                            <th style={{ textAlign: 'right' }}>Débit</th>
                                            <th style={{ textAlign: 'right' }}>Crédit</th>
                                            <th style={{ textAlign: 'right' }}>Solde</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {glData.map((factureObj, fIdx) => {
                                            // Facture line -> Debit
                                            runningSolde += factureObj.Debit || 0;
                                            
                                            // Reglements lines -> Credit
                                            const renderedLines = [
                                                <tr key={`f-${fIdx}`} style={{ background: '#f8fafc' }}>
                                                    <td>{formatDate(factureObj.Dates)}</td>
                                                    <td style={{ fontWeight: 600, color: '#1e293b' }}>{factureObj.Observations}</td>
                                                    <td style={{ fontWeight: 800, color: '#0f172a' }}>{factureObj.Numero}</td>
                                                    <td className="amount" style={{ color: '#059669', fontWeight: 800 }}>{formatMoney(factureObj.Debit)}</td>
                                                    <td className="amount"></td>
                                                    <td className="amount" style={{ color: '#0f172a', fontWeight: 800 }}>{formatMoney(runningSolde)}</td>
                                                </tr>
                                            ];

                                            factureObj.reglements.forEach((reg, rIdx) => {
                                                runningSolde -= reg.Credit || 0;
                                                renderedLines.push(
                                                    <tr key={`r-${fIdx}-${rIdx}`}>
                                                        <td>{formatDate(reg.Dates)}</td>
                                                        <td style={{ color: '#475569', paddingLeft: '2rem' }}>{reg.Observations}</td>
                                                        <td style={{ color: '#64748b' }}>{reg.Numero}</td>
                                                        <td className="amount"></td>
                                                        <td className="amount" style={{ color: '#dc2626', fontWeight: 800 }}>{formatMoney(reg.Credit)}</td>
                                                        <td className="amount" style={{ color: '#0f172a', fontWeight: 800 }}>{formatMoney(runningSolde)}</td>
                                                    </tr>
                                                );
                                            });
                                            
                                            return renderedLines;
                                        })}
                                    </tbody>
                                    {glTotals && (
                                        <tfoot>
                                            <tr>
                                                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 900 }}>TOTAUX</td>
                                                <td className="amount" style={{ color: '#059669' }}>{formatMoney(glTotals.totalDebit)}</td>
                                                <td className="amount" style={{ color: '#dc2626' }}>{formatMoney(glTotals.totalCredit)}</td>
                                                <td className="amount" style={{ color: '#0f172a', fontSize: '1rem' }}>{formatMoney(glTotals.soldeTotal)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                                </div>
                            </div>
                        ) : (
                            <div className="ef-empty">
                                <div className="ef-empty-icon"><BookOpen size={36} color="#94a3b8" /></div>
                                <h3>{hasSearched ? 'Aucune donnée pour cette année' : 'Grand livre'}</h3>
                            </div>
                        )}
                    </div>
                </div>

                <aside className="ef-controls no-print">
                    <div className="ef-controls-header" style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}>
                        <h3><Filter size={16} /> Configuration</h3>
                    </div>
                    <div className="ef-controls-body">
                        <div className="ef-field">
                            <label><Calendar size={12} style={{ display: 'inline' }} /> Année *</label>
                            <input 
                                type="text" 
                                value={glAnnee} 
                                onChange={(e) => setGlAnnee(e.target.value)} 
                                placeholder="YYYY"
                                maxLength={4}
                            />
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />
                        <button className="ef-btn ef-btn-primary" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)' }} onClick={handleAfficherGrandLivre} disabled={loading}>
                            {loading ? <><Loader2 size={16} className="ef-spinner" /> Chargement...</> : <><Eye size={16} /> Afficher</>}
                        </button>
                        <button className="ef-btn ef-btn-success" onClick={handleImprimer} disabled={glData.length === 0}>
                            <Printer size={16} /> Générer état
                        </button>
                    </div>
                </aside>
            </div>
        );
    };

    const renderCAClientsTab = () => {
        return (
            <div className="ef-main">
                <div className="ef-table-area">
                    {caReportTitle && (
                        <div className="ef-report-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', borderColor: '#cbd5e1' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                                    <Briefcase size={18} />
                                    {caReportTitle}
                                </div>
                                <span className="ef-count-pill" style={{ background: '#e2e8f0', color: '#334155' }}>{caData.length} client(s)</span>
                            </div>
                        </div>
                    )}

                    <div className="ef-table-card">
                        {loading ? (
                            <div className="ef-empty"><Loader2 size={40} className="ef-spinner" color="#0369a1" /></div>
                        ) : caData.length > 0 ? (
                            <div className="ef-table-scroll">
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="ef-table">
                                    <thead>
                                        <tr style={{ background: '#0284c7', color: 'white' }}>
                                            <th style={{ color: 'white' }}>Nom ou raison sociale</th>
                                            <th style={{ color: 'white' }}>NINEA</th>
                                            <th style={{ color: 'white' }}>Adresse</th>
                                            <th style={{ color: 'white' }}>Téléphone</th>
                                            <th style={{ textAlign: 'right', color: 'white' }}>Chiffres d'affaires</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {caData.map((c, idx) => (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: 800, color: '#0f172a' }}>{c.NomRS}</td>
                                                <td style={{ color: '#475569' }}>{c.NINEA || '—'}</td>
                                                <td style={{ color: '#64748b' }}>{c.adresseClient || '—'}</td>
                                                <td style={{ color: '#475569' }}>{c.TelClient || '—'}</td>
                                                <td className="amount" style={{ color: '#0284c7', fontWeight: 800 }}>{formatMoney(c.caTTC)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {caTotals && (
                                        <tfoot>
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 900 }}>CA GLOBAL (TTC)</td>
                                                <td className="amount" style={{ color: '#0f172a', fontSize: '1rem', background: '#f1f5f9' }}>{formatMoney(caTotals.totalCA_TTC)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                                </div>
                            </div>
                        ) : (
                            <div className="ef-empty">
                                <div className="ef-empty-icon"><Briefcase size={36} color="#94a3b8" /></div>
                                <h3>{hasSearched ? 'Aucun CA trouvé' : 'Chiffres d\'affaires clients'}</h3>
                            </div>
                        )}
                    </div>
                </div>

                <aside className="ef-controls no-print">
                    <div className="ef-controls-header" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
                        <h3><Filter size={16} /> Actions</h3>
                    </div>
                    <div className="ef-controls-body">
                        <button className="ef-btn ef-btn-primary" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }} onClick={handleAfficherCAClients} disabled={loading}>
                            {loading ? <><Loader2 size={16} className="ef-spinner" /> Traitement...</> : <><Eye size={16} /> Traiter</>}
                        </button>
                        <button className="ef-btn ef-btn-success" onClick={handleImprimer} disabled={caData.length === 0}>
                            <Printer size={16} /> Générer état
                        </button>
                    </div>
                </aside>
            </div>
        );
    };

    const renderJournalSAARITab = () => {
        return (
            <div className="ef-main">
                <div className="ef-table-area">
                    {jsReportTitle && (
                        <div className="ef-report-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', borderColor: '#99f6e4' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#115e59' }}>
                                    <FileSpreadsheet size={18} />
                                    {jsReportTitle}
                                </div>
                                <span className="ef-count-pill" style={{ background: '#ccfbf1', color: '#0f766e' }}>{jsData.length} ligne(s)</span>
                            </div>
                        </div>
                    )}

                    <div className="ef-table-card">
                        {loading ? (
                            <div className="ef-empty"><Loader2 size={40} className="ef-spinner" color="#14b8a6" /></div>
                        ) : jsData.length > 0 ? (
                            <div className="ef-table-scroll">
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="ef-table">
                                    <thead>
                                        <tr style={{ background: '#0f766e', color: 'white' }}>
                                            <th style={{ color: 'white' }}>CodeJournal</th>
                                            <th style={{ color: 'white' }}>Date facture</th>
                                            <th style={{ color: 'white' }}>N° pièce</th>
                                            <th style={{ color: 'white' }}>N° Facture</th>
                                            <th style={{ color: 'white' }}>Code dossier</th>
                                            <th style={{ color: 'white' }}>Code dossier court</th>
                                            <th style={{ color: 'white' }}>Code Compte client SAARI</th>
                                            <th style={{ color: 'white' }}>Code Client</th>
                                            <th style={{ color: 'white' }}>Libellé</th>
                                            <th style={{ color: 'white' }}>Date échéance</th>
                                            <th style={{ textAlign: 'right', color: 'white' }}>Débit</th>
                                            <th style={{ textAlign: 'right', color: 'white' }}>Crédit</th>
                                            <th style={{ color: 'white' }}>N° Compte SAARI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jsData.map((d, idx) => (
                                            <tr key={idx}>
                                                <td>{d.CodeJournal}</td>
                                                <td>{formatDate(d.DateFacture)}</td>
                                                <td>{d.NumeroPiece}</td>
                                                <td style={{ fontWeight: 800 }}>{d.NumeroFacture}</td>
                                                <td>{d.CodeDossier}</td>
                                                <td>{d.CodeDossierCourt}</td>
                                                <td>{d.CodeCompteSAARI}</td>
                                                <td>{d.CodeClient}</td>
                                                <td style={{ fontWeight: 800 }}>{d.Libelle}</td>
                                                <td>{formatDate(d.DateEcheance)}</td>
                                                <td className="amount" style={{ color: d.Debit > 0 ? '#059669' : 'inherit' }}>{d.Debit > 0 ? formatMoney(d.Debit) : ''}</td>
                                                <td className="amount" style={{ color: d.Credit > 0 ? '#dc2626' : 'inherit' }}>{d.Credit > 0 ? formatMoney(d.Credit) : ''}</td>
                                                <td style={{ fontWeight: 800, color: '#0f172a' }}>{d.CompteSAARI || d.CodeCompteSAARI}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        ) : (
                            <div className="ef-empty">
                                <div className="ef-empty-icon"><FileSpreadsheet size={36} color="#94a3b8" /></div>
                                <h3>{hasSearched ? 'Aucune donnée trouvée' : 'Export Journal SAARI'}</h3>
                            </div>
                        )}
                    </div>
                </div>

                <aside className="ef-controls no-print">
                    <div className="ef-controls-header" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' }}>
                        <h3><Filter size={16} /> Configuration</h3>
                    </div>
                    <div className="ef-controls-body">
                        <div className="ef-field">
                            <label><Calendar size={12} style={{ display: 'inline' }} /> Année *</label>
                            <input 
                                type="text" 
                                value={jsAnnee} 
                                onChange={(e) => setJsAnnee(e.target.value)} 
                                placeholder="YYYY"
                                maxLength={4}
                            />
                        </div>
                        <div className="ef-field">
                            <label><Calendar size={12} style={{ display: 'inline' }} /> Mois *</label>
                            <select value={jsMois} onChange={(e) => setJsMois(e.target.value)}>
                                <option value="1">Janvier</option>
                                <option value="2">Février</option>
                                <option value="3">Mars</option>
                                <option value="4">Avril</option>
                                <option value="5">Mai</option>
                                <option value="6">Juin</option>
                                <option value="7">Juillet</option>
                                <option value="8">Août</option>
                                <option value="9">Septembre</option>
                                <option value="10">Octobre</option>
                                <option value="11">Novembre</option>
                                <option value="12">Décembre</option>
                            </select>
                        </div>
                        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />
                        <button className="ef-btn ef-btn-primary" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)' }} onClick={handleAfficherJournalSAARI} disabled={loading}>
                            {loading ? <><Loader2 size={16} className="ef-spinner" /> Traitement...</> : <><Eye size={16} /> Traiter</>}
                        </button>
                        <button className="ef-btn ef-btn-success" onClick={handleExportExcel} disabled={jsData.length === 0}>
                            <Download size={16} /> Export EXCEL
                        </button>
                    </div>
                </aside>
            </div>
        );
    };

    /* ── Tab color config ── */
    const TAB_COLORS = {
        'factures-clients': { accent:'#4f46e5', light:'#eef2ff', grad:'linear-gradient(135deg,#4338ca,#6366f1)', label:'Factures Clients' },
        'releve-client':    { accent:'#0d9488', light:'#f0fdfa', grad:'linear-gradient(135deg,#0f766e,#14b8a6)', label:'Relevé Client' },
        'grand-livre':      { accent:'#d97706', light:'#fffbeb', grad:'linear-gradient(135deg,#b45309,#f59e0b)', label:'Grand Livre' },
        'ca-clients':       { accent:'#0284c7', light:'#eff6ff', grad:'linear-gradient(135deg,#0369a1,#0ea5e9)', label:"Chiffre d'affaires" },
        'journal-saari':    { accent:'#059669', light:'#ecfdf5', grad:'linear-gradient(135deg,#047857,#10b981)', label:'Journal SAARI' },
    };
    const tc = TAB_COLORS[activeTab];

    return (
        <div className="ef-container">
            <style>{`
                @media print {
                    .ef-header, .ef-controls, .ef-tabs, .no-print { display: none !important; }
                    .ef-container { background: white !important; }
                    .ef-main { padding: 0 !important; }
                    .ef-table-card { box-shadow: none !important; border: none !important; }
                    .ef-report-title { font-size: 14pt !important; background: none !important; border: none !important; padding: 0 !important; margin-bottom: 20px !important; }
                    table { font-size: 9pt !important; }
                    th { border-bottom: 2px solid #000 !important; color: #000 !important; background: transparent !important; }
                    td { border-bottom: 1px solid #000 !important; color: #000 !important; }
                    tfoot td { background: transparent !important; border-top: 2px solid #000 !important; font-weight: bold !important; }
                }

                .ef-container { min-height: 100vh; background: #f1f5f9; font-family: 'Inter', system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; }

                /* ── Hero header ── */
                .ef-header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%); color: white; padding: 20px 32px 56px; position: relative; overflow: hidden; flex-shrink: 0; }
                .ef-header::before { content:''; position:absolute; top:-60px; right:-60px; width:220px; height:220px; background:rgba(255,255,255,.04); border-radius:50%; }
                .ef-header::after  { content:''; position:absolute; bottom:-30px; right:180px; width:110px; height:110px; background:rgba(255,255,255,.03); border-radius:50%; }
                .ef-header-left { display: flex; align-items: center; gap: 1rem; }
                .ef-header-left h1 { font-size: 1.375rem; font-weight: 900; margin: 0; display: flex; align-items: center; gap: 0.625rem; color: white; letter-spacing:-.02em; }
                .ef-header-left .ef-badge { font-size: 0.65rem; font-weight: 800; background: rgba(99,102,241,.25); color: #a5b4fc; padding: 0.25rem 0.75rem; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.06em; border:1px solid rgba(99,102,241,.3); }
                .ef-back-btn { background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.22); color: rgba(255,255,255,.85); padding: 0.5rem 1.1rem; border-radius: 99px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: all 0.2s; backdrop-filter:blur(6px); }
                .ef-back-btn:hover { background: rgba(255,255,255,.22); color: white; }

                /* ── Floating tab bar ── */
                .ef-tabs-wrapper { padding: 0 32px; margin-top: -36px; position: relative; z-index: 10; flex-shrink:0; }
                .ef-tabs { background: white; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 8px 28px rgba(0,0,0,.10); padding: 6px; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; width: fit-content; }
                .ef-tabs::-webkit-scrollbar { display: none; }
                .ef-tab { padding: 0.55rem 1.1rem; border-radius: 10px; font-size: 0.8rem; font-weight: 700; color: #6b7280; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: all 0.15s; background: transparent; border: none; white-space: nowrap; }
                .ef-tab:hover { color: #374151; background: #f3f4f6; }
                .ef-tab.active { color: white; box-shadow: 0 4px 12px rgba(0,0,0,.2); }

                .ef-content-area { flex: 1; display: flex; overflow: hidden; padding: 16px 32px 32px; gap: 16px; }
                .ef-main { flex: 1; display: flex; overflow: hidden; gap: 16px; }
                .ef-table-area { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
                .ef-report-title { font-size: 0.9rem; font-weight: 800; color: #0f172a; margin: 0; padding: 0.875rem 1.25rem; background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border-radius: 12px; border: 1px solid #c7d2fe; display: flex; align-items: center; gap: 0.75rem; }
                .ef-table-card { background: white; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); border: 1px solid #e5e7eb; overflow: hidden; flex: 1; display: flex; flex-direction: column; }
                .ef-table-scroll { flex: 1; overflow: auto; }
                .ef-table { width: 100%; border-collapse: collapse; white-space: nowrap; }
                .ef-table th { position: sticky; top: 0; background: #f8fafc; color: #94a3b8; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; padding: 0.75rem 1rem; text-align: left; border-bottom: 2px solid #f1f5f9; z-index: 1; }
                .ef-table td { padding: 0.75rem 1rem; font-size: 0.8125rem; color: #334155; border-bottom: 1px solid #f8fafc; font-weight: 500; }
                .ef-table tbody tr:hover td { background: #f8fafc; }
                .ef-table .amount { text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 0.8125rem; }
                .ef-table tfoot td { padding: 0.875rem 1rem; font-weight: 900; font-size: 0.875rem; color: #0f172a; background: #f1f5f9; border-top: 2px solid #e2e8f0; }

                /* ── Config sidebar ── */
                .ef-controls { width: 300px; background: white; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 2px 8px rgba(0,0,0,.06); display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
                .ef-controls-header { padding: 1rem 1.25rem; color: white; flex-shrink: 0; }
                .ef-controls-header h3 { margin: 0; font-size: 0.8rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; }
                .ef-controls-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 1.25rem; overflow-y: auto; flex: 1; }

                .ef-radio-group { background: #f8fafc; border-radius: 10px; border: 1px solid #e5e7eb; padding: 0.875rem; }
                .ef-radio-group-title { font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.625rem; }
                .ef-radio-option { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; cursor: pointer; }
                .ef-radio-option + .ef-radio-option { border-top: 1px solid #f1f5f9; }
                .ef-radio-option input[type="radio"] { width: 1rem; height: 1rem; cursor: pointer; }
                .ef-radio-option label { font-size: 0.8rem; font-weight: 600; color: #374151; cursor: pointer; }

                .ef-field { display: flex; flex-direction: column; gap: 0.3rem; }
                .ef-field label { font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; display:flex; align-items:center; gap:4px; }
                .ef-field input, .ef-field select { padding: 0.6rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #0f172a; background: #f8fafc; transition: all 0.15s; width: 100%; box-sizing: border-box; }
                .ef-field input:focus, .ef-field select:focus { border-color: #6366f1; background: white; outline: none; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }

                .ef-btn { padding: 0.7rem 1rem; border-radius: 10px; font-weight: 800; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.15s; border: none; width: 100%; }
                .ef-btn-primary { color: white; }
                .ef-btn-primary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 6px 16px rgba(0,0,0,.25); }
                .ef-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }
                .ef-btn-success { background: linear-gradient(135deg, #059669, #10b981); color: white; box-shadow: 0 4px 12px rgba(16,185,129,.3); }
                .ef-btn-success:hover:not(:disabled) { transform: translateY(-1px); }
                .ef-btn-success:disabled { opacity: 0.55; cursor: not-allowed; }

                .ef-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; color: #9ca3af; }
                .ef-empty-icon { width: 72px; height: 72px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; }
                .ef-empty h3 { margin: 0 0 0.4rem 0; font-size: 1rem; color: #374151; font-weight: 700; }

                .ef-count-pill { font-size: 0.65rem; font-weight: 800; padding: 0.2rem 0.65rem; border-radius: 99px; margin-left: auto; }
                .ef-divider { border: none; border-top: 1px solid #f1f5f9; margin: 0; }

                .ef-toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.875rem 1.25rem; border-radius: 12px; background: white; border-left: 4px solid #3b82f6; box-shadow: 0 10px 25px rgba(0,0,0,.12); display: flex; align-items: center; gap: 0.75rem; z-index: 1000; animation: efSlideUp 0.25s ease-out; max-width: 460px; }
                .ef-toast.error { border-left-color: #ef4444; }
                .ef-toast.success { border-left-color: #10b981; }
                .ef-toast.warning { border-left-color: #f59e0b; }
                @keyframes efSlideUp { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                .ef-exo-badge { font-size: 0.65rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 6px; display: inline-block; }
                .ef-exo-badge.oui { background: #dcfce7; color: #166534; }
                .ef-exo-badge.non { background: #fee2e2; color: #991b1b; }

                .ef-spinner { animation: efSpin 1s linear infinite; }
                @keyframes efSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            {/* ── Hero Header ── */}
            <header className="ef-header no-print">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative', zIndex:1 }}>
                    <div className="ef-header-left">
                        <h1><BarChart3 size={22} /> États Financiers</h1>
                        <span className="ef-badge">Module Reporting</span>
                    </div>
                    <button className="ef-back-btn" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={14} /> Retour au Tableau de bord
                    </button>
                </div>
            </header>

            {/* ── Floating Tab bar ── */}
            <div className="ef-tabs-wrapper no-print">
                <div className="ef-tabs">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const c = TAB_COLORS[tab.id];
                        return (
                            <button key={tab.id}
                                className={`ef-tab ${isActive ? 'active' : ''}`}
                                style={ isActive ? { background: c.grad, boxShadow:`0 4px 12px ${c.accent}40` } : {} }
                                onClick={() => { setActiveTab(tab.id); setHasSearched(false); setMessage({text:'',type:''}); }}
                            >
                                <Icon size={13} /> {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area switched by active tab */}
            {activeTab === 'factures-clients' && renderFacturesClientsTab()}
            {activeTab === 'releve-client' && renderReleveClientTab()}
            {activeTab === 'grand-livre' && renderGrandLivreTab()}
            {activeTab === 'ca-clients' && renderCAClientsTab()}
            {activeTab === 'journal-saari' && renderJournalSAARITab()}

            {/* Toast Messages */}
            {message.text && (
                <div className={`ef-toast ${message.type}`}>
                    {message.type === 'error' ? <AlertCircle size={20} color="#ef4444" /> :
                        message.type === 'warning' ? <AlertCircle size={20} color="#f59e0b" /> :
                            <CheckCircle2 size={20} color="#10b981" />}
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{message.text}</span>
                    <button onClick={() => setMessage({ text: '', type: '' })} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
