import React, { useState, useEffect, useMemo } from 'react';
import { getReferenceSymbol } from '../../utils/currency';
import {
    Plus,
    Trash2,
    Calculator,
    FileText,
    CheckCircle,
    Info,
    Search,
    ChevronRight,
    Printer,
    Building,
    FileDigit,
    LayoutGrid,
    ShieldCheck,
    Truck,
    RefreshCw,
    Download,
    Copy,
    Unlock,
    Mail,
    X,
    UploadCloud,
    Edit2,
    Check,
    Filter, // Added
    Edit, // Added
    AlertCircle // Added
} from 'lucide-react';
import { facturesAPI, rubriquesAPI, devisesAPI, dossiersAPI, clientsAPI, facturesRecuesAPI, comptesMailsAPI, documentsAPI, notesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const FacturationManager = ({ dossierId }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [rubriques, setRubriques] = useState([]);
    const [selectedRubriques, setSelectedRubriques] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [dossier, setDossier] = useState(null);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [availableDebours, setAvailableDebours] = useState([]);
    // Config commission du client : tauxDebours/tauxDouane (%), all=sur tous les débours, ids=rubriques ciblées
    const [commissionConfig, setCommissionConfig] = useState({ tauxDebours: 0, tauxDouane: 0, all: true, ids: [] });

    // --- COPY STATES ---
    const [isCopying, setIsCopying] = useState(false);
    const [allClients, setAllClients] = useState([]);
    const [targetClientId, setTargetClientId] = useState('');
    const [clientDossiers, setClientDossiers] = useState([]);
    const [targetDossierId, setTargetDossierId] = useState('');

    // --- EMAIL & JUSTIFICATIFS STATES ---
    const [showEmailModal, setShowEmailModal] = useState(false);
    // Modal for unvalidated notes during taxes fetch
    const [unvalidatedNotes, setUnvalidatedNotes] = useState([]);
    const [showUnvalidatedModal, setShowUnvalidatedModal] = useState(false);
    const [unvalidatedActionLoading, setUnvalidatedActionLoading] = useState(null);
    const [selectedFacture, setSelectedFacture] = useState(null);
    const [justificatifs, setJustificatifs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [editedEmail, setEditedEmail] = useState('');
    // --- Mail accounts + dossier documents ---
    const [comptesMails, setComptesMails] = useState([]);
    const [selectedCompteMailId, setSelectedCompteMailId] = useState('');
    const [dossierDocs, setDossierDocs] = useState([]);
    const [selectedDocIds, setSelectedDocIds] = useState([]);
    const [emailMessage, setEmailMessage] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Core data usually succeeds
            const rubRes = await rubriquesAPI.getAll().catch(e => { console.error(e); return { data: [] }; });
            const dosRes = await dossiersAPI.getOne(dossierId).catch(e => { console.error(e); return { data: null }; });

            // Secondary data might fail due to permissions
            const invRes = await facturesAPI.getByDossier(dossierId).catch(e => { console.error(e); return { data: [] }; });
            const debRes = await facturesRecuesAPI.getDebours(dossierId).catch(e => { console.error(e); return { data: [] }; });

            setRubriques(Array.isArray(rubRes.data) ? rubRes.data : []);
            setDossier(dosRes.data);
            setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
            setAvailableDebours(Array.isArray(debRes.data) ? debRes.data : []);

            // Config commission débours du client rattaché au dossier
            const clientId = dosRes.data?.clientId || dosRes.data?.IDCLIENTS;
            if (clientId) {
                try {
                    const cRes = await clientsAPI.getOne(clientId);
                    setCommissionConfig({
                        tauxDebours: parseFloat(cRes.data?.TauxCommissionDebours) || 0,
                        tauxDouane: parseFloat(cRes.data?.TauxCommissionDDouane) || 0,
                        all: !!cRes.data?.sappliqueTousDebours,
                        ids: Array.isArray(cRes.data?.commissionRubriques) ? cRes.data.commissionRubriques : []
                    });
                } catch (e) { console.error('Erreur chargement config commission débours:', e); }
            }

            setLoading(false);
        } catch (err) {
            console.error('Error in fetchData:', err);
            setError('Erreur lors du chargement des données de facturation.');
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dossierId) {
            fetchData();
        }
    }, [dossierId]);

    useEffect(() => {
        const loadClients = async () => {
            try {
                const res = await clientsAPI.getAll();
                setAllClients(res.data);
            } catch (e) {
                console.error('Error loading all clients:', e);
            }
        };
        loadClients();
    }, []);

    useEffect(() => {
        const loadDossiers = async () => {
            if (!targetClientId) {
                setClientDossiers([]);
                return;
            }
            try {
                const res = await dossiersAPI.getByClient(targetClientId);
                const dossiers = Array.isArray(res.data) ? res.data : [];
                setClientDossiers(dossiers);

                // If we don't have a selection or the current selection is not in the new list, pick the first one
                if (dossiers.length > 0 && (!targetDossierId || !dossiers.find(d => String(d.id) === String(targetDossierId)))) {
                    setTargetDossierId(dossiers[0].id);
                }
            } catch (e) {
                console.error('Error loading client dossiers:', e);
                setClientDossiers([]);
            }
        };
        loadDossiers();
    }, [targetClientId]);

    // --- MEMOS ---
    const availableRubriquesFiltered = useMemo(() => {
        if (!Array.isArray(rubriques)) return [];
        const query = (searchQuery || '').toLowerCase();
        return rubriques.filter(r => {
            const code = (r.CodeRubrique || '').toString().toLowerCase();
            const libelle = (r.libelleRubrique || '').toString().toLowerCase();
            return code.includes(query) || libelle.includes(query);
        });
    }, [rubriques, searchQuery]);

    // Montant douane déjà facturé pour ce dossier = somme HT des factures douane (FD-…).
    // Sert de base à la commission douane d'une facture prestations (FP) séparée.
    const fdDouaneTotal = useMemo(() => {
        return (invoices || [])
            .filter(f => String(f.NumeroFacture || '').toUpperCase().startsWith('FD'))
            .reduce((s, f) => s + (Number(f.MontantHTFacture) || 0), 0);
    }, [invoices]);

    const totals = useMemo(() => {
        const cats = { douane: 0, debours: 0, prestations: 0 };
        let has10 = false;
        let hasOthers = false;
        // Type « de base » = sans les lignes de commission auto (4004/4005),
        // pour savoir si la facture est une douane pure (FD) → pas de commission.
        let baseHas10 = false;
        let baseHasOthers = false;

        selectedRubriques.forEach(r => {
            const amount = Number(r.montant) || 0;
            const code = (r.CodeRubrique || '').toString();
            const isCommissionLine = code === '4004' || code === '4005';
            if (code.startsWith('10')) {
                cats.douane += amount;
                has10 = true;
                baseHas10 = true;
            } else {
                hasOthers = true;
                if (!isCommissionLine) baseHasOthers = true;
                if (code.startsWith('11')) cats.debours += amount;
                else if (code.startsWith('40')) cats.prestations += amount;
            }
        });

        // Facture douane pure (uniquement 10xx) → aucune commission ne s'applique.
        const isFactureDouane = baseHas10 && !baseHasOthers;

        const ht = Object.values(cats).reduce((a, b) => a + b, 0);
        const tva = cats.prestations * 0.18;
        const ttc = ht + tva;

        // Bases de commission. Les lignes de commission elles-mêmes (4004/4005)
        // sont des prestations 40xx → exclues des bases 10xx/11xx (pas de double comptage).
        // Débours éligibles = tous les 11xx si « sur tous les débours », sinon
        // uniquement les rubriques ciblées dans la fiche client.
        let deboursEligible = 0;
        selectedRubriques.forEach(r => {
            const code = (r.CodeRubrique || '').toString();
            if (code.startsWith('11') && (commissionConfig.all || commissionConfig.ids.includes(r.IDRubriques))) {
                deboursEligible += Number(r.montant) || 0;
            }
        });
        // Type « de base » : douane pure (FD), prestations (FP, pas de 10xx), ou globale (FG).
        const isFacturePrestations = !baseHas10 && baseHasOthers;

        // Base de la commission douane :
        //   - FD → aucune commission
        //   - FG → douane de la facture en cours (cats.douane)
        //   - FP → montant des factures douane (FD-…) déjà établies pour le dossier
        const commissionDouaneBase = isFactureDouane ? 0 : (isFacturePrestations ? fdDouaneTotal : cats.douane);

        const commissionDebours = isFactureDouane ? 0 : deboursEligible * (commissionConfig.tauxDebours / 100);
        const commissionDouane = isFactureDouane ? 0 : commissionDouaneBase * (commissionConfig.tauxDouane / 100);

        // Avertissement : FP avec taux douane > 0 mais aucune FD établie → établir la FD d'abord.
        const needFdWarning = isFacturePrestations && commissionConfig.tauxDouane > 0 && fdDouaneTotal === 0;

        let prefix = 'FG';
        let typeName = 'GLOBALE';
        if (has10 && !hasOthers) {
            prefix = 'FD';
            typeName = 'DOUANE';
        } else if (!has10 && hasOthers) {
            prefix = 'FP';
            typeName = 'PRESTATIONS';
        }

        return { ...cats, ht, tva, ttc, prefix, typeName, deboursEligible, commissionDebours, commissionDouane, needFdWarning };
    }, [selectedRubriques, commissionConfig, fdDouaneTotal]);

    // --- ACTIONS ---
    const handleAddRubrique = (rub) => {
        if (selectedRubriques.find(r => r.IDRubriques === rub.IDRubriques)) return;
        setSelectedRubriques([...selectedRubriques, { ...rub, montant: 0, complement: '' }]);
    };

    const handleRemoveRubrique = (id) => {
        setSelectedRubriques(selectedRubriques.filter(r => r.IDRubriques !== id));
    };

    const handleUpdateAmount = (id, val) => {
        setSelectedRubriques(selectedRubriques.map(r =>
            r.IDRubriques === id ? { ...r, montant: parseFloat(val) || 0 } : r
        ));
    };

    const handleUpdateComplement = (id, val) => {
        setSelectedRubriques(selectedRubriques.map(r =>
            r.IDRubriques === id ? { ...r, complement: val } : r
        ));
    };

    // Intégration AUTOMATIQUE des commissions comme lignes facturables dès qu'un
    // taux est > 0 :
    //   - Commission débours → rubrique 4004 (base = débours éligibles 11xx)
    //   - Commission douane   → rubrique 4005 (base = droits de douane 10xx)
    // Les lignes sont créées / actualisées / supprimées selon les montants calculés.
    useEffect(() => {
        if (!rubriques.length) return;
        const rub4004 = rubriques.find(r => String(r.CodeRubrique) === '4004'); // commission débours
        const rub4005 = rubriques.find(r => String(r.CodeRubrique) === '4005'); // commission douane

        // Bases recalculées ici (hors lignes de commission), pour rester stable.
        // On suit aussi le type « de base » : une facture douane pure (uniquement
        // 10xx) ne reçoit aucune commission (uniquement FP et FG).
        let baseDebours = 0, baseDouane = 0;
        let baseHas10 = false, baseHasOthers = false;
        selectedRubriques.forEach(r => {
            const code = String(r.CodeRubrique || '');
            if (code === '4004' || code === '4005') return;
            if (code.startsWith('10')) {
                baseHas10 = true;
                baseDouane += Number(r.montant) || 0;
            } else {
                baseHasOthers = true;
                if (code.startsWith('11') && (commissionConfig.all || commissionConfig.ids.includes(r.IDRubriques))) {
                    baseDebours += Number(r.montant) || 0;
                }
            }
        });
        const isFactureDouane = baseHas10 && !baseHasOthers;
        const isFacturePrestations = !baseHas10 && baseHasOthers;
        // FP → la commission douane porte sur les FD déjà établies du dossier ;
        // FG → sur la douane de la facture en cours.
        const douaneBase = isFacturePrestations ? fdDouaneTotal : baseDouane;
        const wantDebours = (!isFactureDouane && commissionConfig.tauxDebours > 0) ? Math.round(baseDebours * commissionConfig.tauxDebours / 100) : 0;
        const wantDouane = (!isFactureDouane && commissionConfig.tauxDouane > 0) ? Math.round(douaneBase * commissionConfig.tauxDouane / 100) : 0;

        setSelectedRubriques(prev => {
            let next = prev;
            let changed = false;
            const sync = (rub, want, complement) => {
                if (!rub) return;
                const idx = next.findIndex(r => r.IDRubriques === rub.IDRubriques);
                if (want > 0) {
                    if (idx === -1) {
                        next = [...next, { ...rub, montant: want, complement }];
                        changed = true;
                    } else if ((Number(next[idx].montant) || 0) !== want) {
                        next = next.map((r, i) => i === idx ? { ...r, montant: want } : r);
                        changed = true;
                    }
                } else if (idx !== -1) {
                    next = next.filter((_, i) => i !== idx);
                    changed = true;
                }
            };
            sync(rub4004, wantDebours, 'Commission sur débours');
            sync(rub4005, wantDouane, 'Commission sur droits de douane');
            return changed ? next : prev;
        });
    }, [selectedRubriques, commissionConfig, rubriques, fdDouaneTotal]);

    const handleFetchNoteDetail = async () => {
        try {
            setLoading(true);
            const response = await dossiersAPI.getTaxesLiquidees(dossierId);
            const taxes = response.data;
            let newSelected = [];
            let abort = false;

            for (const tax of taxes) {
                const suffix = tax.CodeTaxe.toString().slice(-2).padStart(2, '0');
                const expectedCode = `10${suffix}`;
                const rubric = rubriques.find(r => (r.CodeRubrique || '').toString() === expectedCode);

                if (!rubric) {
                    if (!window.confirm(`Absence de la rubrique correspondante au code taxe ${tax.CodeTaxe} (${expectedCode}). Voulez-vous continuer (ignorer cette taxe) ou abandonner l'opération ?`)) {
                        abort = true;
                        break;
                    }
                } else {
                    newSelected.push({
                        ...rubric,
                        montant: parseFloat(tax.la_somme_MontantLiquide) || 0,
                        complement: tax.LibelleTaxeComplet || ''
                    });
                }
            }

            if (!abort) {
                setSelectedRubriques(newSelected);
            }
        } catch (err) {
            console.error('Error fetching taxes:', err);
            // Backend returns 409 with the list of unvalidated notes -> show modal
            if (err.response?.status === 409 && err.response?.data?.code === 'UNVALIDATED_NOTES') {
                setUnvalidatedNotes(err.response.data.unvalidated_notes || []);
                setShowUnvalidatedModal(true);
            } else {
                const msg = err.response?.data?.error || err.message;
                alert(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleValidateUnvalidatedNote = async (noteId) => {
        try {
            setUnvalidatedActionLoading(noteId);
            await notesAPI.validate(noteId);
            const remaining = unvalidatedNotes.filter(n => n.id !== noteId);
            setUnvalidatedNotes(remaining);
            if (remaining.length === 0) {
                // All resolved -> close modal & retry the taxes fetch
                setShowUnvalidatedModal(false);
                await handleFetchNoteDetail();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Erreur lors de la validation de la note');
        } finally {
            setUnvalidatedActionLoading(null);
        }
    };

    const handleDeleteUnvalidatedNote = async (noteId, repertoire) => {
        if (!window.confirm(`Supprimer définitivement la note ${repertoire} ? (suppression logique, les données sont conservées pour audit)`)) {
            return;
        }
        try {
            setUnvalidatedActionLoading(noteId);
            await notesAPI.delete(noteId);
            const remaining = unvalidatedNotes.filter(n => n.id !== noteId);
            setUnvalidatedNotes(remaining);
            if (remaining.length === 0) {
                setShowUnvalidatedModal(false);
                await handleFetchNoteDetail();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Erreur lors de la suppression de la note');
        } finally {
            setUnvalidatedActionLoading(null);
        }
    };

    const handleFetchDeboursTiers = async () => {
        try {
            setLoading(true);
            const res = await facturesRecuesAPI.getDebours(dossierId);
            const deboursAggreges = res.data;

            if (deboursAggreges.length === 0) {
                alert('Aucun débours de tiers trouvé pour ce dossier.');
                return;
            }

            // Create new selection: items from deboursAggreges + existing ones that are NOT in the import
            const importedRubriques = deboursAggreges.map(d => ({
                IDRubriques: d.IDRubriques,
                CodeRubrique: d.CodeRubrique,
                libelleRubrique: d.libelleRubrique,
                montant: parseFloat(d.montant) || 0,
                complement: `Débours tiers: ${d.numeros_factures || ''} (${d.tiers_concernes || ''})`
            }));

            // Merge: avoid duplicates (prefer imported ones for the same rubric code)
            const importedCodes = importedRubriques.map(ir => ir.CodeRubrique);
            const existingFiltered = selectedRubriques.filter(sr => !importedCodes.includes(sr.CodeRubrique));

            setSelectedRubriques([...existingFiltered, ...importedRubriques]);
            alert(`${deboursAggreges.length} rubriques de débours tiers importées.`);
        } catch (err) {
            console.error('Error fetching source debours:', err);
            alert('Erreur lors de la récupération des débours : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleViewInvoice = async (id) => {
        try {
            setLoading(true);
            const pdfRes = await facturesAPI.generatePDF(id);
            const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            window.open(url);
        } catch (err) {
            console.error('Error viewing invoice:', err);
            alert('Erreur lors de la visualisation de la facture : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleCopyInvoice = async (id) => {
        try {
            setLoading(true);
            const res = await facturesAPI.getOne(id);
            const inv = res.data;

            // Load rubrics
            if (inv.rubriques && Array.isArray(inv.rubriques)) {
                setSelectedRubriques(inv.rubriques.map(r => ({
                    IDRubriques: r.IDRubriques,
                    CodeRubrique: r.CodeRubrique,
                    libelleRubrique: r.libelleRubrique,
                    montant: parseFloat(r.MontantHTFactures) || 0,
                    complement: r.Complement || ''
                })));
            }

            // Set destination defaults
            setIsCopying(true);
            setTargetClientId(dossier?.clientId || dossier?.IDCLIENTS || '');
            setTargetDossierId(dossierId);

        } catch (err) {
            console.error('Error copying invoice:', err);
            alert('Erreur lors de la copie de la facture');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteInvoice = async (id, numero) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir annuler la facture ${numero} ? Cette action est irréversible.`)) {
            return;
        }

        try {
            setLoading(true);
            await facturesAPI.delete(id);
            alert('Facture annulée avec succès.');
            fetchData();
        } catch (err) {
            console.error('Error deleting invoice:', err);
            const msg = err.response?.data?.error || err.message;
            alert(`Erreur lors de l'annulation : ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleValidateInvoice = async (id, numero) => {
        if (!window.confirm(`Voulez-vous valider la facture ${numero} ? Une fois validée, elle ne pourra plus être annulée.`)) {
            return;
        }

        try {
            setLoading(true);
            await facturesAPI.validate(id);
            alert('Facture validée avec succès.');
            fetchData();
        } catch (err) {
            console.error('Error validating invoice:', err);
            const msg = err.response?.data?.error || err.message;
            alert(`Erreur lors de la validation : ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUnvalidateInvoice = async (id, numero) => {
        if (!window.confirm(`Voulez-vous dévalider la facture ${numero} ? Cela permettra de la modifier ou de l'annuler à nouveau.`)) {
            return;
        }

        try {
            setLoading(true);
            await facturesAPI.unvalidate(id);
            alert('Facture dévalidée avec succès.');
            fetchData();
        } catch (err) {
            console.error('Error unvalidating invoice:', err);
            const msg = err.response?.data?.error || err.message;
            alert(`Erreur lors de la dévalidation : ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    // --- EMAIL & JUSTIFICATIFS HANDLERS ---
    const handleOpenEmailModal = async (facture) => {
        setSelectedFacture(facture);
        setEditedEmail(facture.EmailClient || '');
        setIsEditingEmail(false);
        setSelectedDocIds([]);
        setEmailMessage('');
        setSelectedCompteMailId('');
        setShowEmailModal(true);
        fetchJustificatifs(facture.IDFactures);
        // Load mail accounts + dossier documents in parallel
        try {
            const [mailsRes, docsRes] = await Promise.all([
                comptesMailsAPI.getAll(),
                dossierId ? documentsAPI.getByDossier(dossierId) : Promise.resolve({ data: [] })
            ]);
            const mails = Array.isArray(mailsRes.data) ? mailsRes.data : [];
            setComptesMails(mails);
            if (mails.length > 0) setSelectedCompteMailId(String(mails[0].IDComptesMails));
            setDossierDocs(Array.isArray(docsRes.data) ? docsRes.data : []);
        } catch (e) {
            console.warn('Erreur chargement comptes mails / documents', e);
        }
    };

    const handleSaveEmail = async () => {
        if (!selectedFacture || !editedEmail) return;

        try {
            setLoading(true);
            const clientId = selectedFacture.IDCLIENTS || dossier?.clientId;
            if (!clientId) throw new Error('Client ID missing');

            await clientsAPI.updateEmail(clientId, editedEmail);

            // Update local state
            setSelectedFacture(prev => ({ ...prev, EmailClient: editedEmail }));
            // Also update in invoices list
            setInvoices(prev => prev.map(inv =>
                inv.IDFactures === selectedFacture.IDFactures
                    ? { ...inv, EmailClient: editedEmail }
                    : inv
            ));

            setIsEditingEmail(false);
            alert('Email du client mis à jour avec succès.');
        } catch (err) {
            console.error('Error saving email:', err);
            alert('Erreur lors de la mise à jour de l\'email');
        } finally {
            setLoading(false);
        }
    };

    const fetchJustificatifs = async (factureId) => {
        try {
            const res = await facturesAPI.getJustificatifs(factureId);
            setJustificatifs(res.data);
        } catch (err) {
            console.error('Error fetching justificatifs:', err);
        }
    };

    const handleUploadJustificatif = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedFacture) return;

        const formData = new FormData();
        formData.append('justificatif', file);

        try {
            setUploading(true);
            await facturesAPI.uploadJustificatif(selectedFacture.IDFactures, formData);
            fetchJustificatifs(selectedFacture.IDFactures);
            e.target.value = ''; // Reset input
        } catch (err) {
            console.error('Upload error:', err);
            alert('Erreur lors du téléchargement : ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteJustificatif = async (id) => {
        if (!window.confirm('Supprimer ce justificatif ?')) return;
        try {
            await facturesAPI.deleteJustificatif(id);
            fetchJustificatifs(selectedFacture.IDFactures);
        } catch (err) {
            console.error('Delete error:', err);
            alert('Erreur lors de la suppression');
        }
    };

    const handleSendEmail = async () => {
        if (!selectedFacture) return;
        try {
            setEmailLoading(true);
            const res = await facturesAPI.sendEmail(selectedFacture.IDFactures, {
                compteMailId: selectedCompteMailId || undefined,
                emailDestinataire: editedEmail,
                documentIds: selectedDocIds,
                message: emailMessage.trim() || undefined
            });
            alert(res.data.message);
            setShowEmailModal(false);
            fetchData();
        } catch (err) {
            console.error('Email error:', err);
            alert('Erreur lors de l\'envoi : ' + (err.response?.data?.error || err.message));
        } finally {
            setEmailLoading(false);
        }
    };

    const handleTerminate = async () => {
        if (selectedRubriques.length === 0) return alert('Veuillez ajouter au moins une rubrique.');

        const finalDossierId = isCopying ? targetDossierId : dossierId;
        if (!finalDossierId) return alert('Veuillez sélectionner un dossier de destination.');

        try {
            setLoading(true);
            const invoiceData = {
                idDossier: finalDossierId,
                rubriques: selectedRubriques.map(r => ({
                    idRubrique: r.IDRubriques,
                    montant: r.montant,
                    complement: r.complement,
                    code: r.CodeRubrique,
                    libelle: r.libelleRubrique
                })),
                idAgent: user?.id || 0,
                observations: isCopying
                    ? `Facture ${totals.typeName} générée par copie.`
                    : `Facture ${totals.typeName} générée via interface rapide.`
            };

            const response = await facturesAPI.create(invoiceData);
            const newInvoiceId = response.data.idFacture;

            const pdfRes = await facturesAPI.generatePDF(newInvoiceId);
            const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            window.open(url);

            setSelectedRubriques([]);
            setIsCopying(false);
            fetchData();
        } catch (err) {
            console.error('Termination error:', err);
            alert('Erreur lors de la validation : ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    if (loading && rubriques.length === 0) {
        return (
            <div className="fm-loading-container">
                <style>{`
                    .fm-loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem; min-height: 400px; background: white; border-radius: 1rem; border: 1px solid var(--border); }
                    .fm-spinner { width: 40px; height: 40px; border: 3px solid var(--slate-100); border-top-color: var(--primary); border-radius: 50%; animation: fm-spin 0.8s linear infinite; margin-bottom: 1rem; }
                    @keyframes fm-spin { to { transform: rotate(360deg); } }
                `}</style>
                <div className="fm-spinner"></div>
                <p style={{ color: 'var(--slate-500)', fontWeight: 600 }}>Chargement du module de facturation...</p>
            </div>
        );
    }

    return (
        <div className="fm-container">
            <style>{`
                .fm-container { display: flex; height: 750px; background: var(--bg); border: 1px solid var(--border); border-radius: 1rem; overflow: hidden; color: var(--slate-800); font-size: 14px; }
                
                @keyframes pulse-orange {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.4); }
                    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(234, 88, 12, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(234, 88, 12, 0); }
                }

                /* Sidebar */
                .fm-sidebar { width: 260px; background: var(--slate-900); display: flex; flex-direction: column; padding: 1.5rem; border-right: 1px solid var(--slate-800); color: white; }
                .fm-sidebar-title { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem; font-weight: 800; letter-spacing: 0.05em; color: white; }
                .fm-sidebar-icon { background: var(--primary); padding: 0.5rem; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; }
                
                .fm-sidebar-section { margin-bottom: 1.5rem; }
                .fm-section-label { font-size: 10px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; margin-bottom: 0.75rem; display: block; letter-spacing: 0.1em; }
                
                .fm-type-badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.75rem; font-weight: 700; font-size: 12px; margin-bottom: 1rem; }
                .fm-type-badge.douane { background: #d97706; color: white; }
                .fm-type-badge.prestations { background: #059669; color: white; }
                .fm-type-badge.globale { background: var(--primary); color: white; }
                
                .fm-history-list { display: flex; flex-direction: column; gap: 0.35rem; }
                .fm-history-row { display: flex; gap: 0.25rem; border-radius: 0.5rem; overflow: hidden; }
                .fm-history-row.validated { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); }
                
                .fm-history-main-btn { flex: 1; background: var(--slate-800); border: none; color: white; border-left: 3px solid var(--slate-700); padding: 0.5rem 0.75rem; font-size: 11px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; text-align: left; transition: all 0.2s; min-width: 0; }
                .fm-history-main-btn:hover { background: var(--slate-700); }
                .validated .fm-history-main-btn { background: transparent; color: #10b981; border-left-color: #10b981; font-weight: 700; }
                
                .fm-history-action { width: 32px; height: 32px; background: var(--slate-800); color: var(--slate-400); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 0.4rem; transition: all 0.2s; flex-shrink: 0; }
                .fm-history-action:hover { background: var(--slate-700); color: white; }
                .fm-history-action.red:hover { background: #ef4444; color: white; }
                .fm-history-action.green:hover { background: #10b981; color: white; }
                .fm-history-action.orange:hover { background: #f59e0b; color: white; }
                .validated .fm-history-action { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .validated .fm-history-action:hover { background: #10b981; color: white; }
                .validated .fm-history-action.orange { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
                .validated .fm-history-action.orange:hover { background: #f59e0b; color: white; }
                
                /* Main Area */
                .fm-main { flex: 1; display: flex; flex-direction: column; background: white; min-width: 0; }
                .fm-header { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: white; }
                .fm-header-box { display: flex; align-items: center; gap: 0.75rem; background: var(--slate-50); padding: 0.5rem 1rem; border-radius: 0.75rem; border: 1px solid var(--border); }
                .fm-box-label { font-size: 10px; font-weight: 700; color: var(--slate-400); text-transform: uppercase; }
                .fm-box-value { font-weight: 800; font-size: 13px; color: var(--slate-900); }
                
                /* Workspace Split */
                .fm-workspace { flex: 1; display: flex; padding: 1rem; gap: 1rem; overflow: hidden; }
                
                /* Left Table (Source) */
                .fm-source-panel { width: 40%; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 0.75rem; overflow: hidden; background: var(--slate-50); }
                .fm-panel-header { padding: 0.75rem 1rem; background: white; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
                .fm-panel-title { font-size: 11px; font-weight: 700; color: var(--slate-600); text-transform: uppercase; }
                
                .fm-search-wrap { position: relative; }
                .fm-search-input { padding: 0.4rem 0.5rem 0.4rem 2rem; border-radius: 0.5rem; border: 1px solid var(--border); font-size: 11px; outline: none; width: 140px; }
                .fm-search-icon { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: var(--slate-400); }
                
                .fm-table { width: 100%; border-collapse: collapse; }
                .fm-table th { padding: 0.5rem 1rem; background: var(--slate-100); text-align: left; font-size: 10px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; border-bottom: 1px solid var(--border); position: sticky; top: 0; }
                .fm-table td { padding: 0.6rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
                
                .fm-row-selected { background: #f8fafc; color: var(--slate-400); opacity: 0.7; }
                .fm-row-selected td { cursor: not-allowed; }
                .fm-add-btn { padding: 0.4rem; border-radius: 0.4rem; background: #eff6ff; color: #2563eb; border: none; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; }
                .fm-add-btn:hover { background: #2563eb; color: white; }
                
                /* Right Table (Content) */
                .fm-content-panel { flex: 1; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 0.75rem; overflow: hidden; background: white; box-shadow: var(--shadow-sm); }
                .fm-content-header { padding: 0.75rem 1rem; background: var(--primary); color: white; display: flex; justify-content: space-between; align-items: center; }
                
                .fm-fetch-btn {
                    background: white; color: var(--primary); border: none; padding: 0.4rem 0.8rem; border-radius: 0.4rem; font-size: 10px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: all 0.2s;
                }
                .fm-fetch-btn:hover:not(:disabled) {
                    background: var(--slate-100); transform: translateY(-1px);
                }
                .fm-fetch-btn:disabled {
                    opacity: 0.6; cursor: not-allowed;
                }
                
                .fm-input-complement { width: 100%; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 0.4rem; font-size: 11px; outline: none; }
                .fm-input-amount { width: 100px; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 0.4rem; font-size: 12px; font-weight: 700; text-align: right; outline: none; }
                
                .fm-remove-btn { padding: 0.4rem; border-radius: 0.4rem; background: transparent; color: var(--slate-300); border: none; cursor: pointer; transition: all 0.2s; }
                .fm-remove-btn:hover { color: #f43f5e; background: #fff1f2; }
                
                /* Footer / Totals */
                .fm-footer { padding: 1.5rem; background: var(--slate-900); color: white; border-top: 1px solid var(--slate-800); }
                .fm-totals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
                .fm-total-row { display: flex; justify-content: space-between; font-size: 11px; border-bottom: 1px solid var(--slate-800); padding-bottom: 0.5rem; }
                .fm-final-ttc { display: flex; justify-content: space-between; font-weight: 800; font-size: 18px; color: #10b981; margin-top: 0.5rem; }
                
                .fm-submit-btn { width: 100%; padding: 1rem; background: var(--primary); color: white; border: none; border-radius: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 0.75rem; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4); }
                .fm-submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 20px -5px rgba(37, 99, 235, 0.5); }
                .fm-submit-btn:disabled { background: var(--slate-800); color: var(--slate-600); cursor: not-allowed; box-shadow: none; }
                
                .fm-empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--slate-400); text-align: center; padding: 3rem; }

                /* Modal Email & Justificatifs */
                .fm-modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background-color: rgba(0, 0, 0, 0.6);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 2000; backdrop-filter: blur(4px);
                }
                .fm-modal-content {
                    background: white; border-radius: 12px; width: 100%; max-width: 500px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden;
                    animation: fm-modal-fade 0.3s ease-out;
                }
                @keyframes fm-modal-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                .fm-modal-header { padding: 1.25rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .fm-modal-header h3 { margin: 0; font-size: 1.1rem; color: #1e293b; font-weight: 700; display: flex; align-items: center; gap: 0.75rem; }
                .fm-modal-close { color: #64748b; cursor: pointer; padding: 0.5rem; border-radius: 0.5rem; transition: all 0.2s; }
                .fm-modal-close:hover { background: #f1f5f9; color: #ef4444; }
                
                .fm-modal-body { padding: 1.5rem; }
                .fm-justificatifs-list { margin-top: 1rem; max-height: 180px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 0.75rem; background: #f8fafc; }
                .fm-justificatif-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
                .fm-justificatif-item:last-child { border-bottom: none; }
                .fm-justificatif-name { color: #334155; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; overflow: hidden; text-overflow: ellipsis; }
                
                .fm-upload-area { border: 2px dashed #cbd5e1; border-radius: 0.75rem; padding: 1.5rem; text-align: center; background: #fff; transition: all 0.2s; cursor: pointer; position: relative; }
                .fm-upload-area:hover { border-color: var(--primary); background: #eff6ff; }
                .fm-upload-area input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
                
                .fm-modal-footer { padding: 1.25rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem; }
                .fm-btn-cancel { padding: 0.6rem 1.2rem; border-radius: 0.5rem; font-weight: 600; font-size: 13px; color: #64748b; background: transparent; border: 1px solid #e2e8f0; cursor: pointer; }
                .fm-btn-cancel:hover { background: #f1f5f9; }
                .fm-btn-send { padding: 0.6rem 1.2rem; border-radius: 0.5rem; font-weight: 600; font-size: 13px; color: white; background: #3b82f6; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
                .fm-btn-send:hover:not(:disabled) { background: #2563eb; transform: translateY(-1px); }
                .fm-btn-send:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>

            {/* Sidebar */}
            <div className="fm-sidebar">
                <div className="fm-sidebar-title">
                    <div className="fm-sidebar-icon"><Calculator size={20} /></div>
                    <span>FACTURATION</span>
                </div>

                <div className="fm-sidebar-section">
                    <span className="fm-section-label">Type Automatique</span>
                    <div className={`fm-type-badge ${totals.prefix === 'FD' ? 'douane' : totals.prefix === 'FP' ? 'prestations' : 'globale'}`}>
                        {totals.prefix === 'FD' ? <ShieldCheck size={18} /> : totals.prefix === 'FP' ? <Truck size={18} /> : <LayoutGrid size={18} />}
                        <span>FACTURE {totals.typeName}</span>
                    </div>
                </div>

                <div className="fm-sidebar-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <span className="fm-section-label">Historique</span>
                    <div className="fm-history-list" style={{ overflowY: 'auto' }}>
                        {invoices.length === 0 ? (
                            <div style={{ fontSize: '10px', color: 'var(--slate-600)', padding: '1rem', border: '1px dashed var(--slate-800)', borderRadius: '0.5rem' }}>Aucune facture</div>
                        ) : (
                            invoices.map(inv => {
                                const isValidated = Number(inv.Validee) === 1;
                                return (
                                    <div key={inv.IDFactures} className={`fm-history-row ${isValidated ? 'validated' : ''}`}>
                                        <button
                                            className="fm-history-main-btn"
                                            onClick={() => handleViewInvoice(inv.IDFactures)}
                                            title={isValidated ? `Facture ${inv.NumeroFacture} (VALIDÉE) - Voir PDF` : "Voir la facture (PDF)"}
                                        >
                                            <FileDigit size={14} />
                                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {inv.NumeroFacture}
                                            </span>
                                            {isValidated && <CheckCircle size={12} />}
                                        </button>

                                        <button
                                            className="fm-history-action"
                                            onClick={() => handleCopyInvoice(inv.IDFactures)}
                                            title="Copier les éléments"
                                        >
                                            <Copy size={13} />
                                        </button>

                                        {isValidated ? (
                                            <>
                                                <button
                                                    className="fm-history-action"
                                                    style={{ color: '#3b82f6' }}
                                                    onClick={() => handleOpenEmailModal(inv)}
                                                    title="Gérer les justificatifs et envoyer par mail"
                                                >
                                                    <Mail size={13} />
                                                </button>
                                                <button
                                                    className="fm-history-action orange"
                                                    onClick={() => handleUnvalidateInvoice(inv.IDFactures, inv.NumeroFacture)}
                                                    title="Dévalider (autoriser modifs/annulation)"
                                                >
                                                    <Unlock size={13} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    className="fm-history-action green"
                                                    onClick={() => handleValidateInvoice(inv.IDFactures, inv.NumeroFacture)}
                                                    title="Valider la facture"
                                                >
                                                    <ShieldCheck size={13} />
                                                </button>
                                                <button
                                                    className="fm-history-action red"
                                                    onClick={() => handleDeleteInvoice(inv.IDFactures, inv.NumeroFacture)}
                                                    title="Annuler cette facture"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--slate-800)', paddingTop: '1rem', opacity: 0.7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--slate-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                            {user?.name?.substring(0, 2) || 'AG'}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <p style={{ fontSize: '9px', color: 'var(--slate-500)', fontWeight: 800, margin: 0 }}>UTILISATEUR</p>
                            <p style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{user?.name || 'Agent'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Area */}
            <div className="fm-main">
                <div className="fm-header">
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div className="fm-header-box">
                            <Building size={16} />
                            <div>
                                <p className="fm-box-label">Client</p>
                                <p className="fm-box-value">{dossier?.NomClient || dossier?.clientName || 'Chargement...'}</p>
                            </div>
                        </div>
                        <div className="fm-header-box">
                            <FileText size={16} />
                            <div>
                                <p className="fm-box-label">Dossier</p>
                                <p className="fm-box-value">{dossier?.code || dossierId}</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={fetchData} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}>
                        <RefreshCw size={20} className={loading ? 'fm-spin-active' : ''} />
                    </button>
                </div>

                <div className="fm-workspace">
                    {/* Source Panel */}
                    <div className="fm-source-panel">
                        <div className="fm-panel-header">
                            <span className="fm-panel-title">Rubriques disponibles</span>
                            <div className="fm-search-wrap">
                                <Search className="fm-search-icon" size={12} />
                                <input
                                    className="fm-search-input"
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="fm-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>Sél.</th>
                                        <th style={{ width: '80px' }}>Code</th>
                                        <th>Libellé</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {availableRubriquesFiltered.map(r => {
                                        const isSelected = selectedRubriques.some(sr => sr.IDRubriques === r.IDRubriques);
                                        return (
                                            <tr key={r.IDRubriques} className={isSelected ? 'fm-row-selected' : ''}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        disabled={isSelected}
                                                        onChange={() => !isSelected && handleAddRubrique(r)}
                                                        style={{ cursor: isSelected ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                                                    />
                                                </td>
                                                <td style={{ fontFamily: 'monospace' }}>{r.CodeRubrique}</td>
                                                <td style={{ fontWeight: isSelected ? 800 : 400 }}>{r.libelleRubrique}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    </div>

                    {/* Content Panel */}
                    <div className="fm-content-panel">
                        <div className="fm-content-header" style={{ background: isCopying ? '#1d4ed8' : 'var(--primary)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                                {isCopying ? 'Copie de Facture - Nouveau Contenu' : 'Contenu de la Facture'}
                            </span>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                {isCopying && (
                                    <button
                                        onClick={() => { setIsCopying(false); setSelectedRubriques([]); }}
                                        style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '0.4rem', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        ANNULER COPIE
                                    </button>
                                )}
                                <button
                                    onClick={handleFetchNoteDetail}
                                    className="fm-fetch-btn"
                                    disabled={loading || isCopying}
                                    title="Récupérer depuis Notes de Détail validées"
                                >
                                    <Download size={14} />
                                    <span>NOTE DE DÉTAIL</span>
                                </button>
                                <button
                                    onClick={handleFetchDeboursTiers}
                                    className="fm-fetch-btn"
                                    disabled={loading || isCopying}
                                    style={{ 
                                        background: availableDebours.length > 0 ? '#ea580c' : '#0284c7',
                                        color: 'white',
                                        animation: availableDebours.length > 0 ? 'pulse-orange 2s infinite' : 'none'
                                    }}
                                    title="Récupérer les factures de tiers (débours)"
                                >
                                    <Download size={14} />
                                    <span>INTÉGRER TIERS ({availableDebours.length})</span>
                                </button>
                                <span style={{ fontSize: '12px', fontWeight: 900 }}>{selectedRubriques.length} élements</span>
                            </div>
                        </div>

                        {/* Destination Selection (Only when copying) */}
                        {isCopying && (
                            <div style={{ padding: '1rem', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '10px', fontWeight: 800, color: '#1d4ed8', display: 'block', marginBottom: '0.25rem' }}>CLIENT DE DESTINATION</label>
                                    <select
                                        style={{ width: '100%', padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #c4b5fd', fontSize: '12px' }}
                                        value={targetClientId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTargetClientId(val);
                                            setTargetDossierId(''); // Reset to trigger auto-select first dossier
                                        }}
                                    >
                                        <option value="">-- Sélectionner un client --</option>
                                        {allClients.map(c => (
                                            <option key={c.IDCLIENTS} value={c.IDCLIENTS}>{c.NomRS || c.NomClient}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '10px', fontWeight: 800, color: '#1d4ed8', display: 'block', marginBottom: '0.25rem' }}>DOSSIER DE DESTINATION</label>
                                    <select
                                        style={{ width: '100%', padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #c4b5fd', fontSize: '12px' }}
                                        value={targetDossierId}
                                        onChange={(e) => setTargetDossierId(e.target.value)}
                                        disabled={clientDossiers.length === 0}
                                    >
                                        <option value="">-- Choisir un dossier --</option>
                                        {clientDossiers.map(d => (
                                            <option key={d.id} value={d.id}>{d.code} - {d.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {selectedRubriques.length === 0 ? (
                                <div className="fm-empty-state">
                                    <Calculator size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                    <p style={{ fontWeight: 600 }}>Facture vide</p>
                                    <p style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '0.5rem' }}>Sélectionnez des rubriques à gauche pour commencer.</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="fm-table" style={{ background: 'white' }}>
                                    <thead>
                                        <tr>
                                            <th>Libellé / Code</th>
                                            <th style={{ width: '150px' }}>Complément</th>
                                            <th style={{ width: '130px', textAlign: 'right' }}>Montant HT</th>
                                            <th style={{ width: '40px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedRubriques.map(r => (
                                            <tr key={r.IDRubriques}>
                                                <td>
                                                    <div style={{ fontWeight: 800, fontSize: '12px' }}>{r.libelleRubrique}</div>
                                                    <div style={{ fontSize: '9px', color: 'var(--slate-400)', textTransform: 'uppercase' }}>CODE: {r.CodeRubrique}</div>
                                                </td>
                                                <td>
                                                    <input
                                                        className="fm-input-complement"
                                                        value={r.complement}
                                                        onChange={e => handleUpdateComplement(r.IDRubriques, e.target.value)}
                                                        placeholder="Détails..."
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <input
                                                        type="number"
                                                        className="fm-input-amount"
                                                        value={r.montant}
                                                        onChange={e => handleUpdateAmount(r.IDRubriques, e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button className="fm-remove-btn" onClick={() => handleRemoveRubrique(r.IDRubriques)}><Trash2 size={14} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            )}
                        </div>

                        {/* Totals */}
                        <div className="fm-footer">
                            <div className="fm-totals-grid">
                                <div className="fm-total-row"><span>TOTAL HT</span> <span>{totals.ht.toLocaleString()} {getReferenceSymbol()}</span></div>
                                <div className="fm-total-row"><span>TVA (18%)</span> <span>{totals.tva.toLocaleString()} {getReferenceSymbol()}</span></div>
                                {totals.needFdWarning && (
                                    <div className="fm-total-row" style={{ color: '#b91c1c', fontWeight: 700 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <AlertCircle size={14} /> Établissez d'abord la facture douane (commission douane = 0)
                                        </span>
                                    </div>
                                )}
                                {commissionConfig.tauxDouane > 0 && totals.commissionDouane > 0 && (
                                    <div className="fm-total-row" style={{ color: '#1d4ed8' }}>
                                        <span>Commission douane ({commissionConfig.tauxDouane}%) — auto</span>
                                        <span>{Math.round(totals.commissionDouane).toLocaleString()} {getReferenceSymbol()}</span>
                                    </div>
                                )}
                                {commissionConfig.tauxDebours > 0 && (
                                    <div className="fm-total-row" style={{ color: '#1d4ed8' }}>
                                        <span>
                                            Commission débours ({commissionConfig.tauxDebours}%
                                            {commissionConfig.all ? ', tous les 11xx' : ', rubriques ciblées'}) — auto
                                        </span>
                                        <span>{Math.round(totals.commissionDebours).toLocaleString()} {getReferenceSymbol()}</span>
                                    </div>
                                )}
                            </div>
                            <div className="fm-final-ttc">
                                <span>TOTAL TTC</span>
                                <span>{totals.ttc.toLocaleString()} {getReferenceSymbol()}</span>
                            </div>
                            <button
                                className="fm-submit-btn"
                                disabled={selectedRubriques.length === 0 || loading}
                                onClick={handleTerminate}
                            >
                                {loading ? <RefreshCw className="fm-spin-active" size={20} /> : (
                                    <><Printer size={20} /> TERMINER & IMPRIMER LA FACTURE</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Email & Justificatifs */}
            {showEmailModal && selectedFacture && (
                <div className="fm-modal-overlay" onClick={() => !emailLoading && !uploading && setShowEmailModal(false)}>
                    <div className="fm-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="fm-modal-header">
                            <h3><Mail size={18} /> Envoi Facture {selectedFacture.NumeroFacture}</h3>
                            <button className="fm-modal-close" onClick={() => setShowEmailModal(false)} disabled={emailLoading || uploading}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="fm-modal-body">

                            {/* ── Compte mail expéditeur ── */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label className="fm-section-label">Compte expéditeur</label>
                                {comptesMails.length === 0 ? (
                                    <div style={{ padding: '0.75rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.625rem', fontSize: '12px', color: '#c2410c', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <Info size={14}/> Aucun compte mail configuré — <a href="/settings/comptes-mails" style={{ color: '#c2410c', fontWeight: 700 }}>Configurer</a>
                                    </div>
                                ) : (
                                    <select
                                        value={selectedCompteMailId}
                                        onChange={e => setSelectedCompteMailId(e.target.value)}
                                        disabled={emailLoading}
                                        style={{ width: '100%', padding: '0.6rem 0.9rem', border: '1px solid #bfdbfe', borderRadius: '0.625rem', fontSize: '13px', background: '#f8fafc', outline: 'none' }}
                                    >
                                        {comptesMails.map(c => (
                                            <option key={c.IDComptesMails} value={c.IDComptesMails}>
                                                {[c.LibelleMail, c.adressemail || c.AdresseMail].filter(Boolean).join(' — ')}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* ── Destinataire ── */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label className="fm-section-label" style={{ margin: 0 }}>Destinataire</label>
                                    <button onClick={() => setIsEditingEmail(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                        <Edit2 size={12}/> Modifier
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="email"
                                        value={editedEmail}
                                        onChange={e => setEditedEmail(e.target.value)}
                                        style={{ flex: 1, padding: '0.6rem 0.9rem', borderRadius: '0.625rem', border: '1px solid #bfdbfe', fontSize: '13px', outline: 'none' }}
                                        placeholder="email@societe.com"
                                    />
                                </div>
                                {!editedEmail && (
                                    <div style={{ marginTop: '0.4rem', padding: '0.625rem', background: '#fff1f2', color: '#be123c', borderRadius: '0.5rem', fontSize: '11px', display: 'flex', gap: '6px' }}>
                                        <Info size={13}/> Veuillez saisir l'adresse e-mail du destinataire.
                                    </div>
                                )}
                            </div>

                            {/* ── Message personnalisé ── */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label className="fm-section-label">Message (optionnel)</label>
                                <textarea
                                    value={emailMessage}
                                    onChange={e => setEmailMessage(e.target.value)}
                                    disabled={emailLoading}
                                    rows={3}
                                    placeholder="Ajoutez un message personnalisé à inclure dans l'e-mail…"
                                    style={{ width: '100%', padding: '0.6rem 0.9rem', border: '1px solid #e2e8f0', borderRadius: '0.625rem', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* ── Documents du dossier ── */}
                            {dossierDocs.length > 0 && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label className="fm-section-label">Documents du dossier à joindre</label>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', overflow: 'hidden' }}>
                                        {dossierDocs.map((doc, i) => (
                                            <label key={doc.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '0.625rem 1rem',
                                                background: selectedDocIds.includes(doc.id) ? '#eff6ff' : (i % 2 === 0 ? '#fafafa' : 'white'),
                                                borderBottom: i < dossierDocs.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                cursor: 'pointer', transition: 'background 0.15s'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDocIds.includes(doc.id)}
                                                    onChange={e => setSelectedDocIds(prev =>
                                                        e.target.checked ? [...prev, doc.id] : prev.filter(id => id !== doc.id)
                                                    )}
                                                    disabled={emailLoading}
                                                    style={{ accentColor: '#3b82f6', width: 15, height: 15 }}
                                                />
                                                <FileText size={13} style={{ color: selectedDocIds.includes(doc.id) ? '#3b82f6' : '#94a3b8', flexShrink: 0 }}/>
                                                <span style={{ fontSize: '13px', color: '#334155', flex: 1 }}>{doc.title}</span>
                                                {doc.typeLabel && <span style={{ fontSize: '11px', color: '#94a3b8', background: '#f1f5f9', borderRadius: '4px', padding: '1px 6px' }}>{doc.typeLabel}</span>}
                                            </label>
                                        ))}
                                    </div>
                                    {selectedDocIds.length > 0 && (
                                        <div style={{ marginTop: '0.4rem', fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>
                                            {selectedDocIds.length} document(s) sélectionné(s)
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Justificatifs ── */}
                            <label className="fm-section-label">Ajouter des justificatifs (PDF/Images)</label>
                            <div className="fm-upload-area">
                                {uploading ? (
                                    <RefreshCw className="fm-spin-active" style={{ color: '#3b82f6' }} />
                                ) : (
                                    <>
                                        <UploadCloud size={32} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                                        <p style={{ fontSize: '12px', color: '#64748b' }}>Cliquez ou glissez un fichier ici</p>
                                    </>
                                )}
                                <input type="file" onChange={handleUploadJustificatif} disabled={uploading || emailLoading} />
                            </div>

                            <div className="fm-justificatifs-list">
                                <div style={{ padding: '0.75rem 1rem', background: '#f1f5f9', fontSize: '11px', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                                    FICHIERS JOINTS ({justificatifs.length + selectedDocIds.length + 1})
                                </div>
                                <div className="fm-justificatif-item" style={{ background: '#eff6ff', borderLeft: '3px solid #3b82f6' }}>
                                    <div className="fm-justificatif-name">
                                        <FileText size={14} style={{ color: '#3b82f6' }} />
                                        <span>Facture_{selectedFacture.NumeroFacture.replace(/\//g, '-')}.pdf (Principal)</span>
                                    </div>
                                </div>
                                {justificatifs.map(j => (
                                    <div key={j.IDLiaisonFactureJustificatif} className="fm-justificatif-item">
                                        <div className="fm-justificatif-name">
                                            <FileText size={14} style={{ color: '#94a3b8' }} />
                                            <span>{j.OriginalName}</span>
                                        </div>
                                        <button className="fm-remove-btn" onClick={() => handleDeleteJustificatif(j.IDLiaisonFactureJustificatif)} disabled={uploading || emailLoading}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                                {justificatifs.length === 0 && selectedDocIds.length === 0 && (
                                    <div style={{ padding: '1rem', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>Aucun justificatif supplémentaire</div>
                                )}
                            </div>
                        </div>
                        <div className="fm-modal-footer">
                            <button className="fm-btn-cancel" onClick={() => setShowEmailModal(false)} disabled={emailLoading || uploading}>
                                Annuler
                            </button>
                            <button
                                className="fm-btn-send"
                                disabled={!selectedFacture.EmailClient || emailLoading || uploading}
                                onClick={handleSendEmail}
                            >
                                {emailLoading ? <RefreshCw className="fm-spin-active" size={16} /> : <Mail size={16} />}
                                {emailLoading ? "Envoi en cours..." : "Envoyer la facture par mail"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {
                error && (
                    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: '#e11d48', color: 'white', padding: '1rem 2rem', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 1000 }}>
                        <Info size={24} />
                        <span style={{ fontWeight: 700 }}>{error}</span>
                    </div>
                )
            }

            {showUnvalidatedModal && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
                    onClick={() => !unvalidatedActionLoading && setShowUnvalidatedModal(false)}
                >
                    <div
                        style={{ background: 'white', borderRadius: 16, width: 'min(560px, 92vw)', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 30px 60px rgba(0,0,0,0.35)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Info size={20} color="#dc2626" />
                                <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>Notes de détail non validées</h3>
                            </div>
                            <button
                                onClick={() => setShowUnvalidatedModal(false)}
                                disabled={!!unvalidatedActionLoading}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#64748b', lineHeight: 1 }}
                            >×</button>
                        </div>
                        <div style={{ padding: '14px 20px', fontSize: 13, color: '#475569', background: '#fef2f2', borderBottom: '1px solid #fee2e2' }}>
                            Pour récupérer la somme des taxes du dossier, chaque note de détail doit être validée. Pour chaque note ci-dessous, choisissez de la <strong>valider</strong> (gel des montants) ou de la <strong>supprimer</strong> (suppression logique).
                        </div>
                        <div style={{ padding: '12px 20px' }}>
                            {unvalidatedNotes.length === 0 ? (
                                <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>Aucune note restante.</div>
                            ) : unvalidatedNotes.map(note => (
                                <div key={note.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{note.repertoire || `Note #${note.id}`}</span>
                                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                            {note.date_creation ? new Date(note.date_creation).toLocaleString('fr-FR') : ''}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => handleValidateUnvalidatedNote(note.id)}
                                            disabled={!!unvalidatedActionLoading}
                                            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontSize: 12, fontWeight: 700, cursor: unvalidatedActionLoading ? 'not-allowed' : 'pointer', opacity: unvalidatedActionLoading === note.id ? 0.5 : 1 }}
                                        >
                                            {unvalidatedActionLoading === note.id ? '…' : 'Valider'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUnvalidatedNote(note.id, note.repertoire)}
                                            disabled={!!unvalidatedActionLoading}
                                            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca', background: 'white', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: unvalidatedActionLoading ? 'not-allowed' : 'pointer' }}
                                        >
                                            Supprimer
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowUnvalidatedModal(false)}
                                disabled={!!unvalidatedActionLoading}
                                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default FacturationManager;
