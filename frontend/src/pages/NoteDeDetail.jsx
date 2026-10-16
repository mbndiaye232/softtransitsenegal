import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { fmt } from '../utils/format';
import { clientsAPI, dossiersAPI, notesAPI, produitsAPI, regimesAPI, devisesAPI, paysAPI, taxesAPI } from '../services/api';
import { getReferenceSymbol } from '../utils/currency';
import {
    Calculator, FileText, Search, Users, Folder, Plus, Save,
    Download, CheckCircle2, Info, RotateCcw, Database, Globe,
    Activity, ShieldCheck, Tag, Layers, ArrowRightLeft, X,
    Hash, Coins, BookOpen, Receipt, Settings2
} from 'lucide-react';

/* ─── Color config per block ─────────────────────────────────────────────── */
const COLORS = {
    clients:   { accent:'#4f46e5', light:'#eef2ff', border:'#c7d2fe', text:'#3730a3' },
    dossiers:  { accent:'#f59e0b', light:'#fffbeb', border:'#fde68a', text:'#92400e' },
    notes:     { accent:'#7c3aed', light:'#faf5ff', border:'#ddd6fe', text:'#5b21b6' },
    produits:  { accent:'#ea580c', light:'#fff7ed', border:'#fed7aa', text:'#9a3412' },
    regimes:   { accent:'#16a34a', light:'#f0fdf4', border:'#bbf7d0', text:'#14532d' },
    repartition:{ accent:'#0891b2', light:'#ecfeff', border:'#a5f3fc', text:'#164e63' },
    matrice:   { accent:'#1e293b', light:'#f8fafc', border:'#e2e8f0', text:'#0f172a' },
    taxes:     { accent:'#dc2626', light:'#fff1f2', border:'#fecdd3', text:'#991b1b' },
    actions:   { accent:'#059669', light:'#ecfdf5', border:'#a7f3d0', text:'#065f46' },
};

/* ─── Panel component ────────────────────────────────────────────────────── */
const Panel = ({ colorKey, icon, title, badge, action, children, height = 240 }) => {
    const c = COLORS[colorKey];
    return (
        <div style={{
            background: 'white', borderRadius: 16, overflow: 'hidden',
            border: `1px solid ${c.border}`,
            boxShadow: `0 2px 12px ${c.accent}14`,
            display: 'flex', flexDirection: 'column',
        }}>
            <div style={{ padding: '10px 16px', background: c.light, borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ color: c.accent, display: 'flex' }}>{icon}</div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: c.text, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</span>
                    {badge && <span style={{ fontSize: 10, fontWeight: 800, background: c.accent, color: 'white', borderRadius: 99, padding: '2px 8px' }}>{badge}</span>}
                </div>
                {action}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: height }}>{children}</div>
        </div>
    );
};

/* ─── MiniTable ──────────────────────────────────────────────────────────── */
const MiniTable = ({ cols, rows, selectedId, onSelect, getKey, getCells, emptyMsg, onDelete }) => (
    <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
            <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                {cols.map((c, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #f1f5f9' }}>{c}</th>
                ))}
                {onDelete && <th style={{ width: 32, borderBottom: '1px solid #f1f5f9' }} />}
            </tr>
        </thead>
        <tbody>
            {rows.length === 0 ? (
                <tr><td colSpan={cols.length + (onDelete ? 1 : 0)} style={{ padding: '24px', textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>{emptyMsg}</td></tr>
            ) : rows.map(row => {
                const key = getKey(row);
                const sel = selectedId === key;
                return (
                    <tr key={key} onClick={() => onSelect(row)} style={{ cursor: 'pointer', background: sel ? '#ede9fe' : 'white', borderBottom: '1px solid #f8fafc', transition: 'background .1s' }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#f8fafc' }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'white' }}
                    >
                        {getCells(row, sel).map((cell, i) => (
                            <td key={i} style={{ padding: '8px 12px', color: sel ? '#5b21b6' : '#374151', fontWeight: i === 0 ? 700 : 400 }}>{cell}</td>
                        ))}
                        {onDelete && (
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                <button
                                    onClick={e => { e.stopPropagation(); onDelete(row); }}
                                    title="Supprimer"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 4px', borderRadius: 4, lineHeight: 1, fontSize: 14 }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >✕</button>
                            </td>
                        )}
                    </tr>
                );
            })}
        </tbody>
    </table>
    </div>
);

export default function NoteDeDetail() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [dossiers, setDossiers] = useState([]);
    const [selectedDossier, setSelectedDossier] = useState(null);
    const [notes, setNotes] = useState([]);
    const [selectedNote, setSelectedNote] = useState(null);
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [regimes, setRegimes] = useState([]);
    const [devises, setDevises] = useState([]);
    const [pays, setPays] = useState([]);
    const [activeColumnIndex, setActiveColumnIndex] = useState(0);
    const [matrixArticles, setMatrixArticles] = useState(Array(11).fill(null).map((_, i) => ({
        NumeroArticle: i + 1, NTS: '', Libelle: '', CodeRegimeDeclaration: '',
        Origine: '', Provenance: '', FOB: 0, Fret: 0, Assurances: 0,
        IDDEVISEFOB: 1, IDDEVISEFRET: 1, IDDEVISEASS: 1,
        DPI: '', TitreExo: '', NBCOLIS: '', BRUT: 0, NET: 0, QC: 0, QM: 0, CommissionFournisseur: 0
    })));
    const [globalValues, setGlobalValues] = useState({ globalFret: 0, globalAssurance: 0, globalWeight: 0 });
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [calculatedTaxes, setCalculatedTaxes] = useState([]);
    const [selectedRegime, setSelectedRegime] = useState(null);
    const [allTaxes, setAllTaxes] = useState([]);
    const [excludedTaxes, setExcludedTaxes] = useState([]);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isValidated, setIsValidated] = useState(false);
    const [pdfGenerated, setPdfGenerated] = useState(false);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([loadClients(), loadRegimes(), loadDevises(), loadPays(), loadTaxes()]);
            setLoading(false);
        };
        init();
    }, []);

    const loadClients  = async () => {
        try {
            const data = (await clientsAPI.getAll()).data;
            setClients(data);
            // Auto-sélection depuis un dossier
            const { preselectedClientId, preselectedDossierId } = location.state || {};
            if (preselectedClientId) {
                const client = data.find(c => String(c.IDCLIENTS) === String(preselectedClientId));
                if (client) {
                    setSelectedClient(client);
                    if (preselectedDossierId) {
                        // On stocke l'id à sélectionner après chargement des dossiers
                        sessionStorage.setItem('nd_preselect_dossier', preselectedDossierId);
                    }
                }
            }
        } catch(e) { showMessage('Erreur clients','error'); }
    };
    const loadRegimes  = async () => { try { setRegimes((await regimesAPI.getAll()).data); } catch(e) {} };
    const loadDevises  = async () => { try { setDevises((await devisesAPI.getAll()).data); } catch(e) {} };
    const loadPays     = async () => { try { setPays((await paysAPI.getAll()).data); } catch(e) {} };
    const loadTaxes    = async () => { try { setAllTaxes((await taxesAPI.getAll()).data); } catch(e) {} };

    useEffect(() => {
        if (selectedClient) { loadDossiers(selectedClient.IDCLIENTS); }
        else { setDossiers([]); setSelectedDossier(null); }
    }, [selectedClient]);

    const loadDossiers = async (clientId) => {
        try {
            const r = await dossiersAPI.getAll();
            const filtered = r.data.filter(d => (d.clientId == clientId || d.IDClient == clientId) && (d.status !== 'CLOSED' && !d.Cloture));
            setDossiers(filtered);
            // Auto-sélection du dossier si demandé
            const preId = sessionStorage.getItem('nd_preselect_dossier');
            if (preId) {
                sessionStorage.removeItem('nd_preselect_dossier');
                const dossier = filtered.find(d => String(d.id || d.IDDossiers) === String(preId));
                if (dossier) setSelectedDossier(dossier);
            }
        } catch(e) { showMessage('Erreur dossiers','error'); }
    };

    useEffect(() => {
        if (selectedDossier) { loadNotes(selectedDossier.id || selectedDossier.IDDossiers); }
        else { setNotes([]); setSelectedNote(null); }
    }, [selectedDossier]);

    const loadNotes = async (dossierId) => {
        try { setNotes((await notesAPI.getAll(dossierId)).data); }
        catch(e) { showMessage('Erreur notes','error'); }
    };

    useEffect(() => {
        if (selectedNote) {
            loadArticles(selectedNote.IDNotesDeDetails);
            checkValidationStatus(selectedNote.IDNotesDeDetails);
            setPdfGenerated(false);
        } else {
            resetMatrix(); setIsValidated(false); setPdfGenerated(false);
        }
    }, [selectedNote]);

    const resetMatrix = () => setMatrixArticles(Array(11).fill(null).map((_, i) => ({
        NumeroArticle: i+1, NTS:'', Libelle:'', CodeRegimeDeclaration:'',
        Origine:'', Provenance:'', FOB:0, Fret:0, Assurances:0,
        IDDEVISEFOB:1, IDDEVISEFRET:1, IDDEVISEASS:1,
        DPI:'', TitreExo:'', NBCOLIS:'', BRUT:0, NET:0, QC:0, QM:0, CommissionFournisseur:0
    })));

    const loadArticles = async (noteId) => {
        try {
            const db = (await notesAPI.getArticles(noteId)).data;
            setMatrixArticles(Array(11).fill(null).map((_, i) => {
                if (i < db.length) {
                    const d = db[i];
                    return { ...d, NumeroArticle:i+1, IDArticles: d.IDArticles||d.idarticles||d.IDARTICLES, Fret: d.FRET||d.Fret||0, Assurances: d.ASSURANCES||d.Assurances||0 };
                }
                return { NumeroArticle:i+1, NTS:'', Libelle:'', CodeRegimeDeclaration:'', Origine:'', Provenance:'', FOB:0, Fret:0, Assurances:0, IDDEVISEFOB:1, IDDEVISEFRET:1, IDDEVISEASS:1, DPI:'', TitreExo:'', NBCOLIS:'', BRUT:0, NET:0, QC:0, QM:0, CommissionFournisseur:0 };
            }));
            setCalculatedTaxes([]); setSelectedArticle(null); setExcludedTaxes([]);
        } catch(e) { showMessage('Erreur articles','error'); }
    };

    useEffect(() => {
        const t = setTimeout(() => loadProducts(), 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const loadProducts = async () => {
        setIsLoadingProducts(true);
        try { setProducts(((await produitsAPI.getAll({ page:1, limit:50, search:searchTerm })).data.products)||[]); }
        catch(e) { console.error(e); } finally { setIsLoadingProducts(false); }
    };

    const handleSelectProduct = (p) => {
        setSelectedProduct(p.IDProduits);
        if (activeColumnIndex !== null) {
            const u = [...matrixArticles];
            u[activeColumnIndex] = { ...u[activeColumnIndex], NTS: p.NTS, Libelle: p.Libelle };
            setMatrixArticles(u);
            showMessage(`Article ${activeColumnIndex+1} : ${p.NTS}`, 'success');
        } else showMessage("Sélectionnez d'abord une colonne", 'warning');
    };

    const handleSelectRegime = (r) => {
        setSelectedRegime(r.IDRegimeDeclaration);
        if (activeColumnIndex !== null) {
            const u = [...matrixArticles];
            u[activeColumnIndex] = { ...u[activeColumnIndex], CodeRegimeDeclaration: r.CodeRegimeDeclaration };
            setMatrixArticles(u);
            showMessage(`Article ${activeColumnIndex+1} régime: ${r.CodeRegimeDeclaration}`, 'success');
        } else showMessage("Sélectionnez d'abord une colonne", 'info');
    };

    const handleCreateNote = async () => {
        if (!selectedDossier) { showMessage('Sélectionnez un dossier','warning'); return; }
        try {
            const res = await notesAPI.create({ IDDossiers: selectedDossier.id||selectedDossier.IDDossiers, Repertoire:'', NINEA: selectedClient?.NINEA||'', Provenance:'', IdAgent: user?.id||1 });
            showMessage('Note créée — vous pouvez saisir les articles','success');
            const dossierId = selectedDossier.id || selectedDossier.IDDossiers;
            const updated = (await notesAPI.getAll(dossierId)).data;
            setNotes(updated);
            // Auto-sélectionner la note fraîchement créée et réinitialiser la matrice
            const newNote = updated.find(n => n.IDNotesDeDetails === res.data.id);
            if (newNote) { setSelectedNote(newNote); resetMatrix(); }
        } catch(e) { showMessage('Erreur création note','error'); }
    };

    const handleDeleteNote = async (note) => {
        if (!window.confirm(`Supprimer la référence ${note.REPERTOIRE || 'EN ATTENTE'} ?`)) return;
        try {
            await notesAPI.delete(note.IDNotesDeDetails);
            if (selectedNote?.IDNotesDeDetails === note.IDNotesDeDetails) {
                setSelectedNote(null);
            }
            showMessage('Référence supprimée','success');
            loadNotes(selectedDossier.id||selectedDossier.IDDossiers);
        } catch(e) { showMessage('Erreur suppression','error'); }
    };

    const handleSaveAllArticles = async () => {
        if (!selectedNote) { showMessage('Sélectionnez une note','warning'); return; }
        const valid = matrixArticles.filter(a => a.NTS && a.NTS.trim()!=='');
        if (!valid.length) { showMessage('Aucun article valide (NTS requis)','warning'); return; }
        let saved=0, updated=0;
        try {
            for (const a of valid) {
                if (a.IDArticles) { await notesAPI.updateArticle(a.IDArticles, a); updated++; }
                else { await notesAPI.addArticle(selectedNote.IDNotesDeDetails, { ...a, IdAgent: user?.id||1 }); saved++; }
            }
            showMessage(`${saved} créé(s), ${updated} mis à jour`, 'success');
            loadArticles(selectedNote.IDNotesDeDetails);
        } catch(e) { showMessage('Erreur enregistrement','error'); }
    };

    const handleDistribute = async () => {
        const totalFOB = matrixArticles.reduce((s,a) => s + parseFloat(a.FOB||0), 0);
        if (!totalFOB) { showMessage('FOB total = 0','warning'); return; }
        if (!selectedNote) { showMessage('Sélectionnez une note','warning'); return; }
        const { globalFret, globalAssurance, globalWeight } = globalValues;

        // 1. Mise à jour optimiste de la matrice (affichage immédiat)
        const distributed = matrixArticles.map(a => {
            const fob = parseFloat(a.FOB||0);
            if (!fob) return a;
            const ratio = fob/totalFOB;
            const u={};
            if (globalFret>0)      u.Fret=       (ratio*parseFloat(globalFret)).toFixed(0);
            if (globalAssurance>0) u.Assurances= (ratio*parseFloat(globalAssurance)).toFixed(0);
            if (globalWeight>0)    u.BRUT=       (ratio*parseFloat(globalWeight)).toFixed(2);
            return { ...a, ...u };
        });
        setMatrixArticles(distributed);

        // 2. Persistance : il faut d'abord que tous les articles existent en BD
        // avec leur FOB à jour, puis on appelle /distribute (recalcule FRET,
        // ASSURANCES, BRUT côté backend) suivi de /convert-to-fcfa (recalcule
        // FOBCFA, FRETCFA, ASSURANCESCFA, CAF). Sans cela, les colonnes non
        // « Lancées » gardent 0 en BD et le PDF affiche un montant d'assurance
        // erroné (ex : 0 CFA col 1 alors que la répartition a calculé 3 333).
        try {
            const valid = distributed.filter(a => a.NTS && a.NTS.trim() !== '');
            for (const a of valid) {
                if (a.IDArticles) await notesAPI.updateArticle(a.IDArticles, a);
                else              await notesAPI.addArticle(selectedNote.IDNotesDeDetails, { ...a, IdAgent: user?.id||1 });
            }
            await notesAPI.distribute(selectedNote.IDNotesDeDetails, { globalFret, globalAssurance, globalWeight });
            await notesAPI.convertToFCFA(selectedNote.IDNotesDeDetails);
            await loadArticles(selectedNote.IDNotesDeDetails);
            showMessage('Répartition appliquée et sauvegardée','success');
        } catch (e) {
            console.error('distribute error:', e);
            showMessage('Erreur lors de la sauvegarde de la répartition','error');
        }
    };

    const handleConvertToFCFA = async () => {
        if (!selectedNote) { showMessage('Sélectionnez une note','warning'); return; }
        try { await notesAPI.convertToFCFA(selectedNote.IDNotesDeDetails); showMessage('Conversion en FC effectuée','success'); loadArticles(selectedNote.IDNotesDeDetails); }
        catch(e) { showMessage('Erreur conversion','error'); }
    };

    const handleCalculateTaxes = async (articleId) => {
        try {
            const r = await notesAPI.calculateTaxes(articleId, { excludedTaxCodes: excludedTaxes });
            setCalculatedTaxes(r.data.taxes); setSelectedArticle(articleId);
            showMessage(`Calcul: ${r.data.total.toLocaleString()} ${getReferenceSymbol()}`, 'success');
        } catch(e) {
            console.error('calculateTaxes error:', e?.response?.data || e?.message || e);
            throw e;
        }
    };

    const handleLancer = async () => {
        const art = matrixArticles[activeColumnIndex];
        if (!art?.NTS?.trim()) { showMessage('L\'article actif n\'a pas de code NTS', 'warning'); return; }
        if (!selectedNote) { showMessage('Sélectionnez une note d\'abord', 'warning'); return; }
        const fob = parseFloat(art.FOB || 0);
        const fret = parseFloat(art.Fret ?? art.FRET ?? 0);
        const ass = parseFloat(art.Assurances ?? art.ASSURANCES ?? 0);
        if (fob === 0 && fret === 0 && ass === 0) {
            showMessage('FOB, FRET et ASSURANCES sont tous à 0 — saisissez le FOB puis cliquez "Répartir" avant de lancer', 'warning');
            return;
        }
        try {
            let articleId = art.IDArticles;
            if (articleId) {
                await notesAPI.updateArticle(articleId, { ...art, Fret: art.Fret ?? art.FRET ?? 0, Assurances: art.Assurances ?? art.ASSURANCES ?? 0 });
            } else {
                const valid = matrixArticles.filter(a => a.NTS && a.NTS.trim() !== '');
                for (const a of valid) {
                    const normalized = { ...a, Fret: a.Fret ?? a.FRET ?? 0, Assurances: a.Assurances ?? a.ASSURANCES ?? 0 };
                    if (a.IDArticles) await notesAPI.updateArticle(a.IDArticles, normalized);
                    else await notesAPI.addArticle(selectedNote.IDNotesDeDetails, { ...normalized, IdAgent: user?.id || 1 });
                }
                const db = (await notesAPI.getArticles(selectedNote.IDNotesDeDetails)).data;
                const targetNum = activeColumnIndex + 1;
                const saved = db.find(d => Number(d.NumeroArticle) === targetNum);
                articleId = saved?.IDArticles || saved?.idarticles || saved?.IDARTICLES;
                if (!articleId) { showMessage('Impossible d\'obtenir l\'ID article après sauvegarde', 'error'); return; }
                setMatrixArticles(prev => prev.map((col, i) => {
                    const match = db.find(d => Number(d.NumeroArticle) === i + 1);
                    if (match) return { ...match, NumeroArticle: i + 1, IDArticles: match.IDArticles || match.idarticles || match.IDARTICLES, Fret: match.FRET || match.Fret || 0, Assurances: match.ASSURANCES || match.Assurances || 0 };
                    return col;
                }));
                showMessage('Matrice sauvegardée — calcul en cours…', 'info');
            }
            await handleCalculateTaxes(articleId);
        } catch(e) {
            const detail = e?.response?.data?.error || e?.response?.data?.message || e?.message || e;
            console.error('handleLancer error:', detail, e?.response?.status, e?.response?.data);
            showMessage(`Erreur calcul: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`, 'error');
        }
    };

    const handleToggleTaxExclusion = (code) => {
        const next = excludedTaxes.includes(code) ? excludedTaxes.filter(t=>t!==code) : [...excludedTaxes, code];
        setExcludedTaxes(next);
        if (selectedArticle) recalcExclude(selectedArticle, next);
    };

    const recalcExclude = async (id, excl) => {
        try { const r = await notesAPI.calculateTaxes(id, { excludedTaxCodes: excl }); setCalculatedTaxes(r.data.taxes); setSelectedArticle(id); }
        catch(e) { console.error(e); }
    };

    const handleCancelLiquidation = async () => {
        const cur = matrixArticles[activeColumnIndex];
        if (cur?.IDArticles) { try { await notesAPI.clearLiquidations(cur.IDArticles); showMessage('Liquidation annulée','success'); } catch(e){} }
        setCalculatedTaxes([]); setExcludedTaxes([]); setSelectedArticle(null);
    };

    const showMessage = (text, type='info') => { setMessage({text,type}); setTimeout(()=>setMessage({text:'',type:''}),4000); };
    const handleLogout = () => { logout(); navigate('/login'); };

    const handleGeneratePDF = async () => {
        if (!selectedNote) { showMessage('Sélectionnez une note','warning'); return; }
        setIsGeneratingPDF(true);
        try {
            const r = await notesAPI.generatePDF(selectedNote.IDNotesDeDetails);
            const url = window.URL.createObjectURL(new Blob([r.data], {type:'application/pdf'}));
            const a = document.createElement('a'); a.href=url; a.download=`note_detail_${selectedNote.IDNotesDeDetails}.pdf`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
            setPdfGenerated(true); showMessage('PDF généré','success');
        } catch(e) {
            if (e.response?.data instanceof Blob) {
                const t = await e.response.data.text();
                try { showMessage(`Erreur: ${JSON.parse(t).error||'PDF'}`, 'error'); } catch { showMessage('Erreur PDF','error'); }
            } else showMessage(`Erreur: ${e.response?.data?.error||e.message||'Erreur PDF'}`, 'error');
        } finally { setIsGeneratingPDF(false); }
    };

    const handleValidateNote = async () => {
        if (!selectedNote) return;
        try { await notesAPI.validate(selectedNote.IDNotesDeDetails); setIsValidated(true); showMessage('Note validée','success'); }
        catch(e) { showMessage('Erreur validation','error'); }
    };

    const handleUnvalidateNote = async () => {
        if (!selectedNote) return;
        if (!window.confirm('Dévalider cette note ? Les modifications redeviendront possibles.')) return;
        try { await notesAPI.unvalidate(selectedNote.IDNotesDeDetails); setIsValidated(false); setPdfGenerated(false); showMessage('Note dévalidée','success'); }
        catch(e) { showMessage('Erreur dévalidation','error'); }
    };

    const handleToggleValidation = () => {
        if (isValidated) handleUnvalidateNote();
        else if (pdfGenerated) handleValidateNote();
        else showMessage('Générez le PDF avant de valider','error');
    };

    const checkValidationStatus = async (id) => {
        try { setIsValidated((await notesAPI.getPdfStatus(id)).data.validated); } catch { setIsValidated(false); }
    };

    const calculateCAF = (a) => {
        const r = (id) => { const d=devises.find(d=>d.IDDevises==id); return d?parseFloat(d.TauxChangeDeviseCFA||1):1; };
        const total = parseFloat(a.FOB||0)*r(a.IDDEVISEFOB) + parseFloat(a.Fret||0)*r(a.IDDEVISEFRET) + parseFloat(a.Assurances||0)*r(a.IDDEVISEASS);
        return fmt(total, 0);
    };

    const saveSingleArticle = async (a, idx) => {
        if (!selectedNote?.IDNotesDeDetails || (!a.NTS && !a.Libelle && !a.FOB)) return null;
        try {
            if (a.IDArticles) { await notesAPI.updateArticle(a.IDArticles, a); return a.IDArticles; }
            else {
                const res = await notesAPI.addArticle(selectedNote.IDNotesDeDetails, a);
                const u=[...matrixArticles]; u[idx]={...a, IDArticles:res.data.id, IDNotesDeDetails:selectedNote.IDNotesDeDetails};
                setMatrixArticles(u); return res.data.id;
            }
        } catch { return null; }
    };

    const handleColumnChange = async (newIdx) => {
        if (activeColumnIndex !== null && activeColumnIndex !== newIdx)
            await saveSingleArticle(matrixArticles[activeColumnIndex], activeColumnIndex);
        setActiveColumnIndex(newIdx);
        const art = matrixArticles[newIdx];
        if (art?.NTS) {
            try {
                const r = await taxesAPI.getAll(art.NTS);
                // N'afficher que les taxes avec un taux > 0 pour ce NTS
                setCalculatedTaxes(r.data.filter(t => parseFloat(t.Taux) > 0).map(t=>({...t, Taux:t.Taux||0, Montant:0, IsApplicable:true})));
                setSelectedArticle(art.IDArticles||'temp');
                if (art.IDArticles) await handleCalculateTaxes(art.IDArticles);
            } catch(e) { console.error(e); }
        } else { setSelectedArticle(null); setCalculatedTaxes([]); }
    };

    const updateMatrixArticle = (idx, field, val) => {
        const u=[...matrixArticles]; u[idx]={...u[idx],[field]:val}; setMatrixArticles(u);
        if (activeColumnIndex===idx && calculatedTaxes.length) setCalculatedTaxes(prev=>prev.map(t=>({...t,Montant:0})));
    };

    const totalFOB = matrixArticles.reduce((s,a)=>s+parseFloat(a.FOB||0),0);
    const totalTaxes = calculatedTaxes.reduce((s,t)=>s+parseFloat(t.Montant||0),0);

    if (loading && !clients.length) return (
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'#f1f5f9'}}>
            <div style={{textAlign:'center'}}>
                <div style={{width:44,height:44,border:'3px solid #ddd6fe',borderTopColor:'#7c3aed',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 12px'}}/>
                <div style={{fontSize:14,color:'#5b21b6',fontWeight:600}}>Chargement…</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    /* ─── Label rows for matrix ─────────────────────────────────────────── */
    const MATRIX_LABELS = ['INDEX','CODE NTS (*)','RÉGIME ACC.','DPI / B.E.','TITRE EXO','ORIGINE','PROVENANCE','VALEUR FOB','DEVISE FOB','VALEUR FRET','DEVISE FRET','VALEUR ASSUR.','DEVISE ASSUR.','NB COLIS','POIDS BRUT','POIDS NET','QTE COMPL.','QTE MERCH.','COMMISSION','VALEUR CAF (XOF)'];

    const TOAST_COLORS = { success:'#059669', error:'#dc2626', warning:'#d97706', info:'#4f46e5' };

    return (
        <div style={{ minHeight:'100vh', background:'#f1f5f9', display:'flex', flexDirection:'column', gap:14, padding:14, fontFamily:'inherit' }}>

            {/* ── Page header ────────────────────────────────────────────── */}
            <header style={{
                background: 'linear-gradient(135deg,#1e1b4b,#4f46e5,#6d28d9)',
                borderRadius: 16, padding: '14px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 4px 20px rgba(79,70,229,.35)',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,background:'rgba(255,255,255,.05)',borderRadius:'50%'}}/>
                <div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <BookOpen size={20} color="rgba(255,255,255,.85)"/>
                        <h1 style={{margin:0,fontSize:18,fontWeight:900,color:'white',letterSpacing:'-.01em'}}>Note de Détail Dynamique</h1>
                    </div>
                    <p style={{margin:'4px 0 0',fontSize:11,color:'rgba(255,255,255,.6)',fontWeight:600}}>Système de liquidation & codification douanière Matrix-v4</p>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <div style={{textAlign:'right'}}>
                        <div style={{fontSize:13,fontWeight:800,color:'white'}}>{user?.name}</div>
                        <div style={{fontSize:11,color:'rgba(255,255,255,.6)',fontWeight:600}}>{user?.role} · {user?.company_name}</div>
                    </div>
                    <button onClick={handleLogout} style={{padding:'7px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.12)',color:'white',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                        Déconnexion
                    </button>
                </div>
            </header>

            {/* ── Row 1: Clients / Dossiers / Notes ──────────────────────── */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {/* Clients */}
                <Panel colorKey="clients" icon={<Users size={13}/>} title="Portefeuille Clients" height={220}>
                    <MiniTable
                        cols={['Désignation','NINEA']} rows={clients}
                        selectedId={selectedClient?.IDCLIENTS}
                        onSelect={setSelectedClient}
                        getKey={c=>c.IDCLIENTS}
                        getCells={(c,sel)=>[c.NomClient,c.NINEA]}
                        emptyMsg="Aucun client"
                    />
                </Panel>

                {/* Dossiers */}
                <Panel colorKey="dossiers" icon={<Folder size={13}/>} title="Dossiers Actifs"
                    badge={selectedClient?.NomClient?.substring(0,12)}
                    height={220}
                >
                    <MiniTable
                        cols={['Code Dossier','Référence']} rows={dossiers}
                        selectedId={selectedDossier?.id||selectedDossier?.IDDossiers}
                        onSelect={setSelectedDossier}
                        getKey={d=>d.id||d.IDDossiers}
                        getCells={(d)=>[d.code||d.CodeDossier, d.label||d.LibelleDossier]}
                        emptyMsg={selectedClient?'Aucun dossier actif':'← Sélectionnez un client'}
                    />
                </Panel>

                {/* Notes */}
                <Panel colorKey="notes" icon={<FileText size={13}/>} title="Notes de Détail"
                    action={
                        <button onClick={handleCreateNote} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:8,border:'none',background:COLORS.notes.accent,color:'white',fontWeight:700,fontSize:11,cursor:'pointer'}}>
                            <Plus size={11}/> Nouveau
                        </button>
                    }
                    height={220}
                >
                    <MiniTable
                        cols={['Répertoire N°','Agent']} rows={notes}
                        selectedId={selectedNote?.IDNotesDeDetails}
                        onSelect={setSelectedNote}
                        getKey={n=>n.IDNotesDeDetails}
                        getCells={(n)=>[n.REPERTOIRE||'EN ATTENTE', n.agent_name||'—']}
                        emptyMsg={selectedDossier?'Aucune note':'← Sélectionnez un dossier'}
                        onDelete={handleDeleteNote}
                    />
                </Panel>
            </div>

            {/* ── Row 2: NTS / Régimes / Répartition ─────────────────────── */}
            <div style={{display:'grid',gridTemplateColumns:'0.65fr 0.65fr 440px',gap:12}}>
                {/* NTS & Produits */}
                <Panel colorKey="produits" icon={<Search size={13}/>} title="Recherche NTS & Produits" height={260}>
                    <div style={{padding:'10px 12px 0'}}>
                        <div style={{position:'relative',marginBottom:8}}>
                            <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}/>
                            <input
                                placeholder="Code NTS ou Libellé commercial…"
                                value={searchTerm}
                                onChange={e=>setSearchTerm(e.target.value)}
                                style={{width:'100%',paddingLeft:30,paddingRight:12,paddingTop:8,paddingBottom:8,border:`1px solid ${COLORS.produits.border}`,borderRadius:8,fontSize:12,outline:'none',background:'#fff7ed',boxSizing:'border-box'}}
                                onFocus={e=>{e.target.style.borderColor=COLORS.produits.accent;e.target.style.boxShadow=`0 0 0 3px ${COLORS.produits.accent}20`}}
                                onBlur={e=>{e.target.style.borderColor=COLORS.produits.border;e.target.style.boxShadow='none'}}
                            />
                        </div>
                    </div>
                    <MiniTable
                        cols={['Code','Article']} rows={products}
                        selectedId={selectedProduct}
                        onSelect={handleSelectProduct}
                        getKey={p=>p.IDProduits}
                        getCells={(p,sel)=>[p.NTS, p.Libelle]}
                        emptyMsg={isLoadingProducts?'Recherche…':'Saisissez un NTS ou libellé'}
                    />
                </Panel>

                {/* Régimes */}
                <Panel colorKey="regimes" icon={<Layers size={13}/>} title="Régimes de Déclaration" height={260}>
                    <MiniTable
                        cols={['Code','Libellé Régime']} rows={regimes}
                        selectedId={selectedRegime}
                        onSelect={handleSelectRegime}
                        getKey={r=>r.IDRegimeDeclaration}
                        getCells={(r)=>[r.CodeRegimeDeclaration, r.LibelleRegimeDeclaration]}
                        emptyMsg="Aucun régime"
                    />
                </Panel>

                {/* Répartition & Devise */}
                <div style={{background:'white',borderRadius:16,border:`1px solid ${COLORS.repartition.border}`,boxShadow:`0 2px 12px ${COLORS.repartition.accent}14`,overflow:'hidden'}}>
                    <div style={{padding:'10px 16px',background:COLORS.repartition.light,borderBottom:`1px solid ${COLORS.repartition.border}`,display:'flex',alignItems:'center',gap:8}}>
                        <Calculator size={13} color={COLORS.repartition.accent}/>
                        <span style={{fontSize:10,fontWeight:800,color:COLORS.repartition.text,textTransform:'uppercase',letterSpacing:'.08em'}}>Répartition & Devise</span>
                    </div>
                    <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
                        <FInput label="TOTAL FOB CUMULÉ (VALEUR STAT.)" readOnly value={totalFOB.toFixed(2)} color={COLORS.repartition} />
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                            <FInput label="FRET GLOBAL" type="number" value={globalValues.globalFret} onChange={v=>setGlobalValues({...globalValues,globalFret:v})} color={COLORS.repartition}/>
                            <FInput label="ASSURANCE GLOBAL" type="number" value={globalValues.globalAssurance} onChange={v=>setGlobalValues({...globalValues,globalAssurance:v})} color={COLORS.repartition}/>
                        </div>
                        <FInput label="POIDS BRUT TOTAL (KG)" type="number" value={globalValues.globalWeight} onChange={v=>setGlobalValues({...globalValues,globalWeight:v})} color={COLORS.repartition}/>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
                            <button onClick={handleDistribute} style={{padding:'9px',borderRadius:8,border:'none',background:COLORS.repartition.accent,color:'white',fontWeight:700,fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                                <ArrowRightLeft size={13}/> Répartir
                            </button>
                            <button onClick={handleConvertToFCFA} style={{padding:'9px',borderRadius:8,border:`1px solid ${COLORS.repartition.border}`,background:COLORS.repartition.light,color:COLORS.repartition.text,fontWeight:700,fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                                <Coins size={13}/> En FC
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Datalist partagé pour Origine et Provenance */}
            <datalist id="pays-datalist">
                {pays.map(p => (
                    <option key={p.IDPays} value={p.codePays3 || p.CodePays2 || ''}>
                        {p.codePays3 ? `${p.codePays3} – ${p.NomPays}` : p.NomPays}
                    </option>
                ))}
            </datalist>

            {/* ── Matrice de Liquidation + Taxes côte à côte ─────────────── */}
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12,alignItems:'start'}}>

                {/* ── Matrice de Liquidation ── */}
                <div style={{background:'white',borderRadius:16,border:`1px solid ${COLORS.matrice.border}`,boxShadow:`0 4px 20px rgba(15,23,42,.10)`,overflow:'hidden'}}>
                    <div style={{padding:'10px 14px',background:`linear-gradient(135deg,${COLORS.matrice.accent},#334155)`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <Database size={14} color="white"/>
                            <span style={{fontSize:12,fontWeight:900,color:'white'}}>Matrice de Liquidation</span>
                            <span style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,.55)'}}>6 visibles · ← →</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:9,fontWeight:800,color:'rgba(255,255,255,.45)',textTransform:'uppercase',letterSpacing:'.06em'}}>Col. active</span>
                            <div style={{width:24,height:24,background:'white',color:COLORS.matrice.accent,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:12}}>
                                {activeColumnIndex+1}
                            </div>
                        </div>
                    </div>

                    {/* scroll toujours visible */}
                    <div style={{display:'flex',overflowX:'scroll',background:'#f8fafc',
                        scrollbarWidth:'thin', scrollbarColor:`${COLORS.matrice.accent} #e2e8f0`}}>
                        {/* Labels column */}
                        <div style={{width:106,flexShrink:0,background:'#1e293b',borderRight:'2px solid #0f172a',position:'sticky',left:0,zIndex:20}}>
                            {MATRIX_LABELS.map((l,i)=>(
                                <div key={i} style={{
                                    height: i===0||i===MATRIX_LABELS.length-1 ? 36 : 34,
                                    padding:'0 8px', display:'flex', alignItems:'center',
                                    fontSize:10, fontWeight:800, color: i===MATRIX_LABELS.length-1?'#4ade80':'rgba(255,255,255,.80)',
                                    textTransform:'uppercase', letterSpacing:'.02em',
                                    background: i===0?'rgba(0,0,0,.2)' : i===MATRIX_LABELS.length-1?'rgba(16,185,129,.15)':'transparent',
                                    borderBottom:'1px solid rgba(255,255,255,.06)',
                                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                                }}>{l}</div>
                            ))}
                        </div>

                        {/* Article columns — 6 visibles (~86px chacune), scroll pour les suivantes */}
                        <div style={{display:'flex'}}>
                            {matrixArticles.map((art,idx)=>{
                                const isActive = activeColumnIndex===idx;
                                const hasData = art.NTS && art.NTS.trim()!=='';
                                return (
                                    <div key={idx} onClick={()=>handleColumnChange(idx)} style={{
                                        width: isActive?104:86, flexShrink:0, cursor:'pointer',
                                        borderRight:'1px solid #e5e7eb', transition:'width .15s',
                                        background: isActive?'white':'transparent',
                                        outline: isActive?`2px solid ${COLORS.matrice.accent}`:'none',
                                        zIndex: isActive?10:1, position:'relative',
                                    }}>
                                        {/* Col header */}
                                        <div style={{
                                            height:36, display:'flex', alignItems:'center', justifyContent:'center',
                                            fontWeight:900, fontSize:12, borderBottom:'1px solid #e5e7eb',
                                            background: isActive?COLORS.matrice.accent : hasData?'#f0fdf4':'#f8fafc',
                                            color: isActive?'white' : hasData?'#15803d':'#94a3b8',
                                        }}>{idx+1}{hasData&&!isActive&&<span style={{width:5,height:5,borderRadius:'50%',background:'#16a34a',marginLeft:3,display:'inline-block'}}/>}</div>

                                        {/* Cells */}
                                        {[
                                            {field:'NTS',ph:'0000.00.00'},{field:'CodeRegimeDeclaration',ph:'C 000'},{field:'DPI',ph:''},{field:'TitreExo',ph:''},
                                            {field:'Origine',type:'pays'},{field:'Provenance',type:'pays'},
                                            {field:'FOB',type:'number'},{field:'IDDEVISEFOB',type:'select'},
                                            {field:'Fret',type:'number'},{field:'IDDEVISEFRET',type:'select'},
                                            {field:'Assurances',type:'number'},{field:'IDDEVISEASS',type:'select'},
                                            {field:'NBCOLIS',type:'number'},{field:'BRUT',type:'number'},{field:'NET',type:'number'},
                                            {field:'QC',type:'number'},{field:'QM',type:'number'},{field:'CommissionFournisseur',type:'number'},
                                        ].map(({field,type,ph,max},ci)=>(
                                            <div key={ci} style={{height:34,borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center'}}>
                                                {type==='pays' ? (
                                                    <>
                                                        <input
                                                            list="pays-datalist"
                                                            value={art[field]||''}
                                                            onChange={e=>updateMatrixArticle(idx,field,e.target.value.toUpperCase())}
                                                            placeholder="Code / Pays…"
                                                            style={{width:'100%',height:'100%',border:'none',background:'transparent',padding:'0 5px',fontSize:12,color:isActive?COLORS.matrice.accent:'#374151',fontWeight:isActive?700:400,outline:'none'}}
                                                        />
                                                    </>
                                                ) : type==='select' ? (
                                                    <select value={art[field]} onChange={e=>updateMatrixArticle(idx,field,e.target.value)}
                                                        style={{width:'100%',height:'100%',border:'none',background:'transparent',padding:'0 3px',fontSize:11,color:isActive?'#1e293b':'#374151',outline:'none'}}>
                                                        {devises.map(d=>(<option key={d.IDDevises} value={d.IDDevises}>{d.Symbole}</option>))}
                                                    </select>
                                                ) : (
                                                    <input type={type||'text'} value={art[field]||''} placeholder={ph||''}
                                                        maxLength={max} onChange={e=>updateMatrixArticle(idx,field,e.target.value)}
                                                        style={{width:'100%',height:'100%',border:'none',background:'transparent',padding:'0 5px',fontSize:12,color:isActive?COLORS.matrice.accent:'#374151',fontWeight:isActive?700:400,outline:'none'}}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        {/* CAF row */}
                                        <div style={{height:36,background:isActive?'#ecfdf5':'#f0fdf4',display:'flex',alignItems:'center'}}>
                                            <input readOnly value={calculateCAF(art)}
                                                style={{width:'100%',height:'100%',border:'none',background:'transparent',padding:'0 5px',fontSize:12,color:'#15803d',fontWeight:800,outline:'none'}}/>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Colonne droite : Taxes + Actions ── */}
                <div style={{display:'flex',flexDirection:'column',gap:12}}>

                    {/* Liquidation des taxes */}
                    <div style={{background:'white',borderRadius:16,border:`1px solid ${COLORS.taxes.border}`,boxShadow:`0 2px 12px ${COLORS.taxes.accent}14`,overflow:'hidden'}}>
                        <div style={{padding:'10px 14px',background:`linear-gradient(135deg,${COLORS.taxes.accent},#b91c1c)`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <Tag size={13} color="white"/>
                                <span style={{fontSize:11,fontWeight:800,color:'white'}}>Liquidation des Taxes</span>
                                <span style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,.6)'}}>Art. {activeColumnIndex+1}</span>
                            </div>
                            <div style={{display:'flex',gap:6}}>
                                <button onClick={handleLancer}
                                    style={{padding:'4px 9px',borderRadius:6,border:'none',background:'rgba(255,255,255,.2)',color:'white',fontWeight:700,fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                                    <Activity size={11}/> Lancer
                                </button>
                                <button onClick={handleCancelLiquidation}
                                    style={{padding:'4px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,.3)',background:'transparent',color:'white',fontWeight:700,fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                                    <RotateCcw size={11}/> Reset
                                </button>
                            </div>
                        </div>

                        <div style={{maxHeight:320,overflowY:'auto'}}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                                <thead>
                                    <tr style={{background:'#f8fafc',position:'sticky',top:0,zIndex:1}}>
                                        {['','NPL','Code','Taxe','Taux',`Mnt (${getReferenceSymbol()})`].map((h,i)=>(
                                            <th key={i} style={{padding:'7px 7px',textAlign:i>=4?'right':'left',fontSize:9,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(selectedArticle?calculatedTaxes.filter(t=>t.IsApplicable&&(parseFloat(t.Taux)>0||excludedTaxes.includes(t.CodeTaxe))):allTaxes.map(t=>({...t,Montant:0,IsApplicable:true}))).map((tax,i)=>{
                                        const excl = excludedTaxes.includes(tax.CodeTaxe);
                                        return (
                                            <tr key={i} style={{borderBottom:'1px solid #f8fafc',opacity:excl?.45:1,background:tax.Montant>0?'#fff1f2':'white',transition:'background .1s'}}>
                                                <td style={{padding:'6px 6px',width:26}}>
                                                    <input type="checkbox" checked={excl} onChange={()=>handleToggleTaxExclusion(tax.CodeTaxe)}
                                                        style={{accentColor:COLORS.taxes.accent,cursor:'pointer'}}/>
                                                </td>
                                                <td style={{padding:'6px 7px',fontWeight:600,color:'#64748b',fontSize:10}}>{i+1}</td>
                                                <td style={{padding:'6px 7px'}}>
                                                    <span style={{background:'#fee2e2',color:'#991b1b',borderRadius:5,padding:'2px 5px',fontWeight:800,fontSize:10}}>{tax.CodeTaxe}</span>
                                                </td>
                                                <td style={{padding:'6px 7px',color:'#374151',fontSize:10,maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={tax.LibelleTaxe}>{tax.LibelleTaxe}</td>
                                                <td style={{padding:'6px 7px',textAlign:'right',color:'#9ca3af',fontSize:10}}>{tax.Taux?tax.Taux+'%':'-'}</td>
                                                <td style={{padding:'6px 7px',textAlign:'right',fontWeight:800,fontSize:10,color:tax.Montant>0?COLORS.taxes.accent:'#d1d5db'}}>{tax.Montant?fmt(tax.Montant):'-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </div>

                        {totalTaxes>0 && (
                            <div style={{padding:'10px 14px',background:`linear-gradient(135deg,${COLORS.taxes.accent},#b91c1c)`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <span style={{fontSize:9,fontWeight:800,color:'rgba(255,255,255,.6)',textTransform:'uppercase',letterSpacing:'.05em'}}>Cumul liquidé</span>
                                <span style={{fontSize:15,fontWeight:900,color:'white'}}>{fmt(totalTaxes)} <small style={{fontSize:10,opacity:.7}}>XOF</small></span>
                            </div>
                        )}
                    </div>

                    {/* Actions / Publication */}
                    <div style={{background:'white',borderRadius:16,border:`1px solid ${COLORS.actions.border}`,boxShadow:`0 2px 12px ${COLORS.actions.accent}14`,overflow:'hidden'}}>
                        <div style={{padding:'10px 14px',background:COLORS.actions.light,borderBottom:`1px solid ${COLORS.actions.border}`,display:'flex',alignItems:'center',gap:7}}>
                            <Settings2 size={12} color={COLORS.actions.accent}/>
                            <span style={{fontSize:9,fontWeight:800,color:COLORS.actions.text,textTransform:'uppercase',letterSpacing:'.08em'}}>Opérations de Publication</span>
                        </div>
                        <div style={{padding:'14px 12px',display:'flex',flexDirection:'column',gap:9}}>
                            <ActionBtn icon={<Database size={14}/>} label="Sauvegarder la Matrice" color={COLORS.matrice.accent} onClick={handleSaveAllArticles} disabled={isValidated}/>
                            <ActionBtn icon={<Download size={14}/>} label={isGeneratingPDF?'Impression…':'Générer Note de Détail (PDF)'} color="#059669" onClick={handleGeneratePDF} disabled={!selectedNote||isGeneratingPDF}/>

                            {/* Toggle validation */}
                            {selectedNote && (
                                <div
                                    onClick={handleToggleValidation}
                                    style={{
                                        display:'flex', alignItems:'center', justifyContent:'space-between',
                                        padding:'10px 12px',
                                        background: isValidated ? '#ecfdf5' : (!pdfGenerated ? '#f8fafc' : '#fffbeb'),
                                        border: `1px solid ${isValidated ? '#a7f3d0' : (!pdfGenerated ? '#e5e7eb' : '#fde68a')}`,
                                        borderRadius:9, cursor: pdfGenerated||isValidated ? 'pointer' : 'not-allowed',
                                        transition:'all .2s', gap:10,
                                        opacity: !pdfGenerated && !isValidated ? 0.5 : 1,
                                    }}
                                    title={isValidated ? 'Cliquer pour dévalider la note' : (!pdfGenerated ? 'Générez le PDF avant de valider' : 'Cliquer pour valider la note')}
                                >
                                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                                        <ShieldCheck size={14} color={isValidated ? '#059669' : (!pdfGenerated ? '#9ca3af' : '#d97706')}/>
                                        <span style={{fontSize:11,fontWeight:800,color: isValidated ? '#059669' : (!pdfGenerated ? '#9ca3af' : '#92400e')}}>
                                            {isValidated ? 'NOTE VALIDÉE' : 'VALIDER LA NOTE'}
                                        </span>
                                    </div>
                                    {/* Switch visuel */}
                                    <div style={{
                                        width:36, height:20, borderRadius:10, position:'relative',
                                        background: isValidated ? '#059669' : '#d1d5db',
                                        transition:'background .25s', flexShrink:0,
                                    }}>
                                        <div style={{
                                            position:'absolute', top:3,
                                            left: isValidated ? 18 : 3,
                                            width:14, height:14, borderRadius:'50%',
                                            background:'white',
                                            boxShadow:'0 1px 3px rgba(0,0,0,.3)',
                                            transition:'left .25s',
                                        }}/>
                                    </div>
                                </div>
                            )}
                            {selectedNote&&(
                                <div style={{marginTop:2,padding:'10px 11px',background:'#f8fafc',borderRadius:9,border:'1px solid #e5e7eb'}}>
                                    <div style={{fontSize:9,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5}}>Note sélectionnée</div>
                                    <div style={{fontSize:12,fontWeight:700,color:'#5b21b6'}}>{selectedNote.REPERTOIRE||'EN ATTENTE'}</div>
                                    <div style={{fontSize:10,color:'#9ca3af',marginTop:2}}>ID: {selectedNote.IDNotesDeDetails}</div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>{/* end right col */}
            </div>{/* end main grid */}

            {/* ── Toast ────────────────────────────────────────────────────── */}
            {message.text && (
                <div style={{
                    position:'fixed',bottom:24,right:24,
                    padding:'12px 18px',borderRadius:12,background:'white',
                    borderLeft:`4px solid ${TOAST_COLORS[message.type]||TOAST_COLORS.info}`,
                    boxShadow:'0 8px 24px rgba(0,0,0,.15)',
                    display:'flex',alignItems:'center',gap:10,zIndex:1000,
                    animation:'slideUp .25s ease-out', maxWidth:360,
                }}>
                    <Info size={16} color={TOAST_COLORS[message.type]||TOAST_COLORS.info}/>
                    <span style={{fontSize:13,fontWeight:700,color:'#374151',flex:1}}>{message.text}</span>
                    <button onClick={()=>setMessage({text:'',type:''})} style={{border:'none',background:'none',cursor:'pointer',color:'#9ca3af',display:'flex',padding:0}}>
                        <X size={13}/>
                    </button>
                </div>
            )}

            <style>{`
                @keyframes spin{to{transform:rotate(360deg)}}
                @keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
                ::-webkit-scrollbar{height:6px;width:6px}
                ::-webkit-scrollbar-track{background:#e2e8f0;border-radius:99px}
                ::-webkit-scrollbar-thumb{background:#334155;border-radius:99px}
                ::-webkit-scrollbar-thumb:hover{background:#1e293b}
            `}</style>
        </div>
    );
}

/* ─── Micro helpers ──────────────────────────────────────────────────────── */
const FInput = ({label, readOnly, value, onChange, type='text', color}) => (
    <div>
        <label style={{display:'block',fontSize:9,fontWeight:800,color:color.text,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>{label}</label>
        <input type={type} readOnly={readOnly} value={value} onChange={onChange?e=>onChange(e.target.value):undefined}
            style={{width:'100%',padding:'8px 10px',border:`1px solid ${color.border}`,borderRadius:8,fontSize:12,fontWeight:700,
                background:readOnly?color.light:'white',color:color.text,outline:'none',boxSizing:'border-box'}}
            onFocus={readOnly?undefined:e=>{e.target.style.borderColor=color.accent;e.target.style.boxShadow=`0 0 0 3px ${color.accent}20`}}
            onBlur={readOnly?undefined:e=>{e.target.style.borderColor=color.border;e.target.style.boxShadow='none'}}
        />
    </div>
);

const ActionBtn = ({icon, label, color, onClick, disabled}) => (
    <button onClick={onClick} disabled={disabled} style={{
        display:'flex',alignItems:'center',justifyContent:'center',gap:8,
        padding:'11px',borderRadius:10,border:'none',width:'100%',
        background:disabled?'#f1f5f9':color,
        color:disabled?'#9ca3af':'white',
        fontWeight:700,fontSize:13,cursor:disabled?'not-allowed':'pointer',
        boxShadow:disabled?'none':`0 4px 12px ${color}40`,transition:'all .15s',
    }}
        onMouseEnter={e=>{if(!disabled){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 6px 16px ${color}50`}}}
        onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=disabled?'none':`0 4px 12px ${color}40`}}
    >
        {icon}{label}
    </button>
);
