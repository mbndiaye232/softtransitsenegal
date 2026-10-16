import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { produitsAPI, taxesAPI, tauxAPI, tarifsAPI, taxesComplementsAPI } from '../services/api';
import {
    Plus, X, ArrowLeft, AlertCircle, CheckCircle, Package,
    Percent, Tag, Hash, Link2, Trash2, Search, ChevronLeft, ChevronRight,
    RefreshCw, Layers, Pencil, GitMerge
} from 'lucide-react';

const INITIAL_MODAL = { type: null, data: {} };

/* ── Color config per block ── */
const C = {
    produits: { accent: '#2563eb', light: '#eff6ff', border: '#bfdbfe', grad: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' },
    taxes:    { accent: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe', grad: 'linear-gradient(135deg,#6d28d9,#8b5cf6)' },
    taux:     { accent: '#059669', light: '#ecfdf5', border: '#a7f3d0', grad: 'linear-gradient(135deg,#047857,#10b981)' },
    bulk:     { accent: '#d97706', light: '#fffbeb', border: '#fde68a', grad: 'linear-gradient(135deg,#b45309,#f59e0b)' },
    tarifs:   { accent: '#4f46e5', light: '#eef2ff', border: '#c7d2fe', grad: 'linear-gradient(135deg,#4338ca,#6366f1)' },
};

/* ── Reusable BlockCard ── */
function BlockCard({ cfg, icon: Icon, title, count, countLabel, action, children }) {
    return (
        <div style={{
            borderRadius: '18px', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
            border: `1px solid ${cfg.border}`,
        }}>
            <div style={{
                background: cfg.grad, padding: '1rem 1.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '34px', height: '34px', borderRadius: '9px',
                        background: 'rgba(255,255,255,0.22)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                    }}>
                        <Icon size={18} />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
                        {count !== undefined && (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                                {count} {countLabel}
                            </div>
                        )}
                    </div>
                </div>
                {action && <div>{action}</div>}
            </div>
            <div style={{ background: 'white', overflowX: 'auto' }}>{children}</div>
        </div>
    );
}

/* ── Small add button ── */
function AddBtn({ color, grad, onClick, label = 'Ajouter' }) {
    const [hov, setHov] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: hov ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '8px', padding: '5px 12px',
                color: 'white', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s',
                whiteSpace: 'nowrap',
            }}
        >
            <Plus size={13} /> {label}
        </button>
    );
}

/* ── Filter input ── */
function FilterInput({ value, onChange, color }) {
    return (
        <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
                value={value}
                onChange={onChange}
                placeholder="Filtrer..."
                style={{
                    paddingLeft: '28px', paddingRight: '10px', height: '32px',
                    border: `1.5px solid #e2e8f0`, borderRadius: '8px',
                    fontSize: '12px', outline: 'none', width: '130px',
                    transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = color}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
        </div>
    );
}

/* ── Data table ── */
function DataTable({ headers, rows, loading, error, emptyMsg, grad, color, maxHeight = '300px' }) {
    const [hovRow, setHovRow] = useState(null);
    return (
        <div style={{ maxHeight, overflowY: 'auto' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: grad }}>
                        {headers.map((h, i) => (
                            <th key={i} style={{
                                padding: '9px 14px', textAlign: 'left',
                                fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.85)',
                                textTransform: 'uppercase', letterSpacing: '0.07em',
                                position: 'sticky', top: 0, zIndex: 1,
                                whiteSpace: 'nowrap',
                            }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '13px' }}>
                            <RefreshCw size={16} style={{ display: 'inline', marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                            Chargement...
                        </td></tr>
                    ) : error ? (
                        <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: '1.5rem', color: '#ef4444', fontSize: '12px' }}>
                            <AlertCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />{error}
                        </td></tr>
                    ) : rows.length === 0 ? (
                        <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: '2.5rem', color: '#cbd5e1', fontSize: '13px', fontWeight: 600 }}>
                            {emptyMsg}
                        </td></tr>
                    ) : rows.map((row, i) => (
                        <tr key={i}
                            onMouseEnter={() => setHovRow(i)}
                            onMouseLeave={() => setHovRow(null)}
                            style={{ background: hovRow === i ? color + '08' : i % 2 === 0 ? 'white' : '#fafbfc' }}
                        >
                            {row}
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
    );
}

/* ── Code badge ── */
function Badge({ value, color, bg }) {
    return (
        <span style={{
            fontFamily: 'monospace', fontSize: '12px', fontWeight: 800,
            background: bg, color: color,
            padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap',
        }}>{value}</span>
    );
}

const TD = ({ children, style = {} }) => (
    <td style={{ padding: '8px 14px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #f1f5f9', ...style }}>
        {children}
    </td>
);

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function TarifsManager() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [produits, setProduits] = useState([]);
    const [taxes, setTaxes] = useState([]);
    const [taux, setTaux] = useState([]);
    const [tarifs, setTarifs] = useState([]);
    const [loadingProduits, setLoadingProduits] = useState(false);
    const [loadingTaxes, setLoadingTaxes] = useState(true);
    const [loadingTaux, setLoadingTaux] = useState(true);
    const [loadingTarifs, setLoadingTarifs] = useState(true);
    const [errors, setErrors] = useState({});
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState(INITIAL_MODAL);
    const [saving, setSaving] = useState(false);
    const [totalProduits, setTotalProduits] = useState(0);
    const [totalTarifs, setTotalTarifs] = useState(0);
    const [tarifsPage, setTarifsPage] = useState(1);

    const [formNTS, setFormNTS] = useState({ NTS: '', Libelle: '' });
    const [formTaxe, setFormTaxe] = useState({ CodeTaxe: '', LibelleTaxe: '', LibelleTaxeComplet: '', Base: '', Niveau: '1' });
    const [formTaux, setFormTaux] = useState({ CodeTaux: '', Taux: '' });
    const [formTarif, setFormTarif] = useState({ NTS: '', CodeTaxe: '', CodeTaux: '' });
    const [formBulk, setFormBulk] = useState({ mode: 'individual', ntsPrefix: '', CodeTaxe: '', CodeTaux: '', selectedNTS: [] });

    const [prodFilter, setProdFilter] = useState('');
    const [taxeFilter, setTaxeFilter] = useState('');
    const [tauxFilter, setTauxFilter] = useState('');
    const [tarifFilter, setTarifFilter] = useState('');

    const [selectedTaxe, setSelectedTaxe] = useState(null);
    const [complementCodes, setComplementCodes] = useState([]);
    const [savingComplements, setSavingComplements] = useState(false);

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const loadProduits = useCallback(async (search = '') => {
        setLoadingProduits(true);
        try {
            const res = await produitsAPI.getAll({ limit: 50, page: 1, search });
            setProduits(res.data.products || res.data || []);
            setTotalProduits(res.data.total || (res.data.products ? res.data.products.length : 0));
            setErrors(e => ({ ...e, produits: null }));
        } catch (err) {
            setErrors(e => ({ ...e, produits: err.response?.data?.error || err.message }));
            setProduits([]);
        } finally { setLoadingProduits(false); }
    }, []);

    const loadTaxes = useCallback(async () => {
        setLoadingTaxes(true);
        try {
            const res = await taxesAPI.getAll();
            setTaxes(Array.isArray(res.data) ? res.data : []);
            setErrors(e => ({ ...e, taxes: null }));
        } catch (err) {
            setErrors(e => ({ ...e, taxes: err.response?.data?.error || err.message }));
            setTaxes([]);
        } finally { setLoadingTaxes(false); }
    }, []);

    const loadTaux = useCallback(async () => {
        setLoadingTaux(true);
        try {
            const res = await tauxAPI.getAll();
            setTaux(Array.isArray(res.data) ? res.data : []);
            setErrors(e => ({ ...e, taux: null }));
        } catch (err) {
            setErrors(e => ({ ...e, taux: err.response?.data?.error || err.message }));
            setTaux([]);
        } finally { setLoadingTaux(false); }
    }, []);

    const loadTarifs = useCallback(async (search = '', page = 1) => {
        setLoadingTarifs(true);
        try {
            const res = await tarifsAPI.getAll({ search, page, limit: 50 });
            if (res.data.data) {
                setTarifs(res.data.data);
                setTotalTarifs(res.data.total);
                setTarifsPage(res.data.page);
            } else {
                setTarifs(Array.isArray(res.data) ? res.data : []);
                setTotalTarifs(Array.isArray(res.data) ? res.data.length : 0);
            }
            setErrors(e => ({ ...e, tarifs: null }));
        } catch (err) {
            setErrors(e => ({ ...e, tarifs: err.response?.data?.error || err.message }));
            setTarifs([]);
        } finally { setLoadingTarifs(false); }
    }, []);

    const loadAll = useCallback(() => {
        loadTaxes(); loadTaux(); loadTarifs(); loadProduits();
    }, [loadTaxes, loadTaux, loadTarifs, loadProduits]);

    useEffect(() => { loadAll(); }, [loadAll]);

    useEffect(() => {
        const t = setTimeout(() => { loadProduits(prodFilter); }, 500);
        return () => clearTimeout(t);
    }, [prodFilter, loadProduits]);

    useEffect(() => {
        const t = setTimeout(() => { loadTarifs(tarifFilter, 1); }, 500);
        return () => clearTimeout(t);
    }, [tarifFilter, loadTarifs]);

    const openModal = (type) => {
        setFormNTS({ NTS: '', Libelle: '' });
        setFormTaxe({ CodeTaxe: '', LibelleTaxe: '', LibelleTaxeComplet: '', Base: '', Niveau: '1' });
        setFormTaux({ CodeTaux: '', Taux: '' });
        setFormTarif({ NTS: '', CodeTaxe: '', CodeTaux: '' });
        setModal({ type });
    };

    const openEditModal = (type, item) => {
        if (type === 'nts') setFormNTS({ NTS: item.NTS, Libelle: item.Libelle });
        if (type === 'taxe') setFormTaxe({ CodeTaxe: item.CodeTaxe, LibelleTaxe: item.LibelleTaxe, LibelleTaxeComplet: item.LibelleTaxeComplet || '', Base: item.Base || '', Niveau: item.Niveau || '1' });
        if (type === 'taux') setFormTaux({ CodeTaux: item.CodeTaux, Taux: item.Taux, IDTaux: item.IDTaux });
        setModal({ type: `edit-${type}`, data: item });
    };

    const closeModal = () => setModal(INITIAL_MODAL);

    const handleAddNTS = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            await produitsAPI.create(formNTS);
            showToast(`Produit NTS "${formNTS.NTS}" ajouté`);
            closeModal(); loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
        finally { setSaving(false); }
    };

    const handleEditNTS = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            await produitsAPI.update(formNTS.NTS, { Libelle: formNTS.Libelle });
            showToast(`Produit "${formNTS.NTS}" mis à jour`);
            closeModal(); loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
        finally { setSaving(false); }
    };

    const handleAddTaxe = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            await taxesAPI.create(formTaxe);
            showToast(`Taxe "${formTaxe.CodeTaxe}" ajoutée`);
            closeModal(); loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
        finally { setSaving(false); }
    };

    const handleEditTaxe = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            await taxesAPI.update(modal.data.IDTaxes, { LibelleTaxe: formTaxe.LibelleTaxe, LibelleTaxeComplet: formTaxe.LibelleTaxeComplet, Base: formTaxe.Base, Niveau: formTaxe.Niveau });
            showToast(`Taxe "${formTaxe.CodeTaxe}" mise à jour`);
            closeModal(); loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
        finally { setSaving(false); }
    };

    const handleAddTaux = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            await tauxAPI.create(formTaux);
            showToast(`Taux "${formTaux.CodeTaux}" ajouté`);
            closeModal(); loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
        finally { setSaving(false); }
    };

    const handleEditTaux = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            await tauxAPI.update(modal.data.IDTaux, { Taux: formTaux.Taux });
            showToast(`Taux "${formTaux.CodeTaux}" mis à jour`);
            closeModal(); loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
        finally { setSaving(false); }
    };

    const handleAddTarif = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            await tarifsAPI.create(formTarif);
            showToast('Tarif ajouté avec succès');
            closeModal(); loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
        finally { setSaving(false); }
    };

    const handleBulkUpdate = async (e) => {
        e.preventDefault();
        if (!formBulk.CodeTaxe || !formBulk.CodeTaux) { showToast('Sélectionnez une taxe et un code taux', 'error'); return; }
        if (formBulk.mode === 'individual' && formBulk.selectedNTS.length === 0) { showToast('Sélectionnez au moins un produit', 'error'); return; }
        if (formBulk.mode === 'category' && !formBulk.ntsPrefix) { showToast('Veuillez saisir le préfixe NTS', 'error'); return; }
        const payload = { ...formBulk, ntsPrefix: formBulk.mode === 'individual' ? formBulk.selectedNTS : formBulk.ntsPrefix };
        const msg = formBulk.mode === 'integral'
            ? 'Ceci va appliquer ce tarif à TOUS les produits. Continuer ?'
            : formBulk.mode === 'category'
                ? `Ceci va appliquer ce tarif à tous les produits commençant par "${formBulk.ntsPrefix}". Continuer ?`
                : 'Appliquer ce tarif ?';
        if (!window.confirm(msg)) return;
        setSaving(true);
        try {
            const res = await tarifsAPI.bulkUpdate(payload);
            const { created, updated, total } = res.data;
            if (total === 0) showToast('Aucun produit correspondant trouvé.', 'warning');
            else showToast(`${created} créés, ${updated} mis à jour sur ${total} produits.`);
            setFormBulk(prev => ({ ...prev, ntsPrefix: '', selectedNTS: [] }));
            loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
        finally { setSaving(false); }
    };

    const getAffectedCount = () => {
        if (formBulk.mode === 'integral') return totalProduits || 'Tous les';
        if (formBulk.mode === 'category' && formBulk.ntsPrefix) return `Produits commençant par ${formBulk.ntsPrefix}`;
        if (formBulk.mode === 'individual') return formBulk.selectedNTS.length;
        return 0;
    };

    const handleSelectTaxe = async (taxe) => {
        setSelectedTaxe(taxe);
        try {
            const res = await taxesComplementsAPI.getByTaxe(taxe.CodeTaxe);
            setComplementCodes((res.data || []).map(c => c.CodeTaxeComplement));
        } catch { setComplementCodes([]); }
    };

    const toggleComplement = (code) => {
        setComplementCodes(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    const handleSaveComplements = async () => {
        if (!selectedTaxe) return;
        setSavingComplements(true);
        try {
            await taxesComplementsAPI.update(selectedTaxe.CodeTaxe, complementCodes);
            showToast(`Compléments de la taxe ${selectedTaxe.CodeTaxe} enregistrés`);
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
        finally { setSavingComplements(false); }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm('Confirmer la suppression ?')) return;
        try {
            if (type === 'produit') await produitsAPI.delete(id);
            else if (type === 'taxe') await taxesAPI.delete(id);
            else if (type === 'taux') await tauxAPI.delete(id);
            else if (type === 'tarif') await tarifsAPI.delete(id);
            showToast('Suppression effectuée');
            loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Erreur', 'error'); }
    };

    const filteredTaxes = taxes.filter(t => !taxeFilter || t.CodeTaxe?.includes(taxeFilter) || t.LibelleTaxe?.toLowerCase().includes(taxeFilter.toLowerCase()));
    const filteredTaux = taux.filter(t => !tauxFilter || t.CodeTaux?.includes(tauxFilter) || t.Taux?.toString().includes(tauxFilter));

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.is_provider;
    const totalPages = Math.ceil(totalTarifs / 50) || 1;

    /* ── inline form helpers ── */
    const fLabel = (txt) => (
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>{txt}</label>
    );
    const fInput = (props) => (
        <input {...props} style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '9px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', ...props.style }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
    );
    const fSelect = (props, children) => (
        <select {...props} style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '9px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box', ...props.style }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        >{children}</select>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-track { background: #f1f5f9; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
            `}</style>

            {/* ── Toast ── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 2000,
                    padding: '12px 18px', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontWeight: 700, fontSize: '14px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    animation: 'slideUp 0.3s ease',
                    background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: toast.type === 'success' ? '#16a34a' : '#ef4444',
                    border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fee2e2'}`,
                }}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* ══════════ HERO ══════════ */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 45%, #1e40af 100%)',
                padding: '2.5rem 2rem 6rem',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Decorative orbs */}
                <div style={{ position: 'absolute', top: '-60px', right: '5%', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.35) 0%,transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-80px', left: '10%', width: '240px', height: '240px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(6,182,212,0.25) 0%,transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '30%', left: '45%', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,0.2) 0%,transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
                {/* Grid texture */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 2, maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Back button */}
                    <button onClick={() => navigate(-1)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px', padding: '6px 14px',
                        color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', marginBottom: '1.5rem',
                    }}>
                        <ArrowLeft size={15} /> Retour
                    </button>

                    <h1 style={{ fontSize: 'clamp(1.6rem,3vw,2.5rem)', fontWeight: 900, color: 'white', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                        Tarifs &amp;{' '}
                        <span style={{ background: 'linear-gradient(135deg,#60a5fa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                            Taxes Douanières
                        </span>
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 500, margin: '0 0 2rem' }}>
                        Gérez la codification NTS, les taxes douanières, les taux et les associations tarifaires
                    </p>

                    {/* KPI pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {[
                            { label: 'Produits NTS', value: totalProduits || produits.length, icon: Package, color: '#93c5fd', bg: 'rgba(147,197,253,0.15)' },
                            { label: 'Taxes', value: taxes.length, icon: Tag, color: '#c4b5fd', bg: 'rgba(196,181,253,0.15)' },
                            { label: 'Codes Taux', value: taux.length, icon: Percent, color: '#6ee7b7', bg: 'rgba(110,231,183,0.15)' },
                            { label: 'Associations', value: totalTarifs, icon: Link2, color: '#a5b4fc', bg: 'rgba(165,180,252,0.15)' },
                        ].map((k, i) => {
                            const Ic = k.icon;
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    background: k.bg, backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '13px', padding: '10px 18px',
                                }}>
                                    <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>
                                        <Ic size={18} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', lineHeight: 1.1 }}>{k.value}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ══════════ FLOATING CONTENT ══════════ */}
            <div style={{ maxWidth: '1400px', margin: '-48px auto 0', padding: '0 2rem 2rem', position: 'relative', zIndex: 10 }}>

                {/* ── TOP 3 PANELS ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>

                    {/* PRODUITS */}
                    <BlockCard
                        cfg={C.produits} icon={Package} title="Produits (NTS)"
                        count={produits.length} countLabel="produit(s)"
                        action={isAdmin && <AddBtn onClick={() => openModal('nts')} />}
                    >
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                            <FilterInput value={prodFilter} onChange={e => setProdFilter(e.target.value)} color={C.produits.accent} />
                        </div>
                        <DataTable
                            maxHeight="280px"
                            grad={C.produits.grad} color={C.produits.accent}
                            headers={['NTS', 'Libellé', ...(isAdmin ? ['', ''] : [])]}
                            loading={loadingProduits} error={errors.produits} emptyMsg="Aucun produit"
                            rows={produits.map(p => [
                                <TD key="nts"><Badge value={p.NTS} color={C.produits.accent} bg={C.produits.light} /></TD>,
                                <TD key="lib" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b', fontSize: '12px' }}>{p.Libelle}</TD>,
                                ...(isAdmin ? [
                                    <TD key="edit"><button onClick={() => openEditModal('nts', p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', borderRadius: '4px', transition: 'color 0.2s' }}
                                        onMouseEnter={e => e.target.style.color = C.produits.accent} onMouseLeave={e => e.target.style.color = '#cbd5e1'}><Pencil size={13} /></button></TD>,
                                    <TD key="del"><button onClick={() => handleDelete('produit', p.NTS)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', borderRadius: '4px', transition: 'color 0.2s' }}
                                        onMouseEnter={e => e.target.style.color = '#ef4444'} onMouseLeave={e => e.target.style.color = '#cbd5e1'}><Trash2 size={13} /></button></TD>,
                                ] : [])
                            ])}
                        />
                    </BlockCard>

                    {/* TAXES */}
                    <BlockCard
                        cfg={C.taxes} icon={Tag} title="Taxes Douanières"
                        count={filteredTaxes.length} countLabel="taxe(s)"
                        action={isAdmin && <AddBtn onClick={() => openModal('taxe')} />}
                    >
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                            <FilterInput value={taxeFilter} onChange={e => setTaxeFilter(e.target.value)} color={C.taxes.accent} />
                        </div>
                        <DataTable
                            maxHeight="280px"
                            grad={C.taxes.grad} color={C.taxes.accent}
                            headers={['Code', 'Libellé', 'Libellé long', 'Niv.', ...(isAdmin ? ['', ''] : [])]}
                            loading={loadingTaxes} error={errors.taxes} emptyMsg="Aucune taxe"
                            rows={filteredTaxes.map(t => [
                                <TD key="code"><Badge value={t.CodeTaxe} color={C.taxes.accent} bg={C.taxes.light} /></TD>,
                                <TD key="lib" style={{ fontSize: '12px', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.LibelleTaxe}</TD>,
                                <TD key="libl" style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.LibelleTaxeComplet}</TD>,
                                <TD key="niv" style={{ fontSize: '12px', fontWeight: 700 }}>{t.Niveau}</TD>,
                                ...(isAdmin ? [
                                    <TD key="edit"><button onClick={() => openEditModal('taxe', t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', borderRadius: '4px', transition: 'color 0.2s' }}
                                        onMouseEnter={e => e.target.style.color = C.taxes.accent} onMouseLeave={e => e.target.style.color = '#cbd5e1'}><Pencil size={13} /></button></TD>,
                                    <TD key="del"><button onClick={() => handleDelete('taxe', t.IDTaxes)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', borderRadius: '4px', transition: 'color 0.2s' }}
                                        onMouseEnter={e => e.target.style.color = '#ef4444'} onMouseLeave={e => e.target.style.color = '#cbd5e1'}><Trash2 size={13} /></button></TD>,
                                ] : [])
                            ])}
                        />
                    </BlockCard>

                    {/* TAUX */}
                    <BlockCard
                        cfg={C.taux} icon={Percent} title="Codes Taux"
                        count={filteredTaux.length} countLabel="code(s)"
                        action={isAdmin && <AddBtn onClick={() => openModal('taux')} />}
                    >
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                            <FilterInput value={tauxFilter} onChange={e => setTauxFilter(e.target.value)} color={C.taux.accent} />
                        </div>
                        <DataTable
                            maxHeight="280px"
                            grad={C.taux.grad} color={C.taux.accent}
                            headers={['Code Taux', 'Valeur', ...(isAdmin ? ['', ''] : [])]}
                            loading={loadingTaux} error={errors.taux} emptyMsg="Aucun taux"
                            rows={filteredTaux.map(t => [
                                <TD key="code"><Badge value={t.CodeTaux} color={C.taux.accent} bg={C.taux.light} /></TD>,
                                <TD key="val"><span style={{ fontFamily: 'monospace', fontWeight: 800, color: C.taux.accent, fontSize: '14px' }}>{t.Taux}</span></TD>,
                                ...(isAdmin ? [
                                    <TD key="edit"><button onClick={() => openEditModal('taux', t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', borderRadius: '4px', transition: 'color 0.2s' }}
                                        onMouseEnter={e => e.target.style.color = C.taux.accent} onMouseLeave={e => e.target.style.color = '#cbd5e1'}><Pencil size={13} /></button></TD>,
                                    <TD key="del"><button onClick={() => handleDelete('taux', t.IDTaux)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', borderRadius: '4px', transition: 'color 0.2s' }}
                                        onMouseEnter={e => e.target.style.color = '#ef4444'} onMouseLeave={e => e.target.style.color = '#cbd5e1'}><Trash2 size={13} /></button></TD>,
                                ] : [])
                            ])}
                        />
                    </BlockCard>
                </div>

                {/* ── COMPLÉMENTS TAXES ── */}
                {isAdmin && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{
                            borderRadius: '18px', overflow: 'hidden',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
                            border: '1px solid #ddd6fe',
                        }}>
                            {/* Header */}
                            <div style={{
                                background: 'linear-gradient(135deg,#6d28d9,#8b5cf6)',
                                padding: '1rem 1.5rem',
                                display: 'flex', alignItems: 'center', gap: '10px',
                            }}>
                                <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <GitMerge size={18} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Compléments de taxes</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                                        {selectedTaxe ? `Taxe sélectionnée : ${selectedTaxe.CodeTaxe} – ${selectedTaxe.LibelleTaxe}` : 'Cliquez sur une taxe pour gérer ses compléments'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'white', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                {/* Left: tax selector */}
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
                                        1. Sélectionner la taxe principale
                                    </div>
                                    <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: '10px' }}>
                                        {taxes.map(t => {
                                            const isSel = selectedTaxe?.CodeTaxe === t.CodeTaxe;
                                            return (
                                                <div key={t.IDTaxes}
                                                    onClick={() => handleSelectTaxe(t)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '9px 14px', cursor: 'pointer',
                                                        borderBottom: '1px solid #f1f5f9',
                                                        background: isSel ? '#f5f3ff' : 'transparent',
                                                        borderLeft: isSel ? '3px solid #7c3aed' : '3px solid transparent',
                                                        transition: 'all 0.15s',
                                                    }}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 800, background: '#f5f3ff', color: '#7c3aed', padding: '2px 7px', borderRadius: '5px', minWidth: '28px', textAlign: 'center' }}>
                                                        {t.CodeTaxe}
                                                    </span>
                                                    <span style={{ fontSize: '12px', color: '#334155', fontWeight: isSel ? 700 : 400 }}>{t.LibelleTaxe}</span>
                                                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Niv.{t.Niveau}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Right: complement checkboxes */}
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
                                        2. Taxes dont les montants s'ajoutent au CAF
                                    </div>
                                    {!selectedTaxe ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, border: '1.5px dashed #e2e8f0', borderRadius: '10px' }}>
                                            ← Sélectionnez d'abord une taxe
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: '10px', marginBottom: '12px' }}>
                                                {taxes.filter(t => t.CodeTaxe !== selectedTaxe.CodeTaxe).map(t => {
                                                    const isChecked = complementCodes.includes(t.CodeTaxe);
                                                    return (
                                                        <label key={t.IDTaxes}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                                padding: '8px 14px', cursor: 'pointer',
                                                                borderBottom: '1px solid #f1f5f9',
                                                                background: isChecked ? '#f0fdf4' : 'transparent',
                                                                transition: 'background 0.15s',
                                                            }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleComplement(t.CodeTaxe)}
                                                                style={{ accentColor: '#7c3aed', width: '15px', height: '15px' }}
                                                            />
                                                            <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 800, background: '#f5f3ff', color: '#7c3aed', padding: '2px 7px', borderRadius: '5px', minWidth: '28px', textAlign: 'center' }}>
                                                                {t.CodeTaxe}
                                                            </span>
                                                            <span style={{ fontSize: '12px', color: '#334155' }}>{t.LibelleTaxe}</span>
                                                            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Niv.{t.Niveau}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                                    {complementCodes.length} complément(s) sélectionné(s)
                                                </span>
                                                <button
                                                    onClick={handleSaveComplements}
                                                    disabled={savingComplements}
                                                    style={{
                                                        background: 'linear-gradient(135deg,#6d28d9,#8b5cf6)',
                                                        color: 'white', border: 'none', borderRadius: '9px',
                                                        padding: '9px 22px', fontWeight: 800, fontSize: '13px',
                                                        cursor: savingComplements ? 'not-allowed' : 'pointer',
                                                        opacity: savingComplements ? 0.7 : 1,
                                                        boxShadow: '0 4px 12px rgba(109,40,217,0.3)',
                                                    }}>
                                                    {savingComplements ? 'Enregistrement...' : '✓ Enregistrer les compléments'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── BULK UPDATE BLOCK ── */}
                {isAdmin && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <BlockCard cfg={C.bulk} icon={Hash} title="Mise à jour en masse des tarifs">
                            <div style={{ padding: '1.5rem' }}>
                                {/* Mode tabs */}
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '1.25rem', background: '#fef3c7', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
                                    {[
                                        { v: 'individual', l: 'Un par un' },
                                        { v: 'category', l: 'Par catégorie' },
                                        { v: 'integral', l: 'Intégrale' },
                                    ].map(m => (
                                        <button key={m.v}
                                            onClick={() => setFormBulk(f => ({ ...f, mode: m.v }))}
                                            style={{
                                                border: 'none', padding: '7px 18px', borderRadius: '7px',
                                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                background: formBulk.mode === m.v ? C.bulk.grad : 'transparent',
                                                color: formBulk.mode === m.v ? 'white' : '#b45309',
                                                boxShadow: formBulk.mode === m.v ? '0 2px 8px rgba(217,119,6,0.3)' : 'none',
                                            }}
                                        >{m.l}</button>
                                    ))}
                                </div>

                                <form onSubmit={handleBulkUpdate}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'start' }}>
                                        {/* Taxe */}
                                        <div>
                                            {fLabel('1. Taxe')}
                                            {fSelect({
                                                value: formBulk.CodeTaxe,
                                                onChange: e => setFormBulk(f => ({ ...f, CodeTaxe: e.target.value })),
                                                required: true,
                                                style: formBulk.CodeTaxe ? { borderColor: C.taxes.accent, background: C.taxes.light, color: C.taxes.accent, fontWeight: 700 } : {},
                                            },
                                                <>
                                                    <option value="">Sélectionner une taxe...</option>
                                                    {taxes.map(t => <option key={t.IDTaxes} value={t.CodeTaxe}>{t.CodeTaxe} – {t.LibelleTaxe}</option>)}
                                                </>
                                            )}
                                        </div>

                                        {/* Taux */}
                                        <div>
                                            {fLabel('2. Code Taux')}
                                            {fSelect({
                                                value: formBulk.CodeTaux,
                                                onChange: e => setFormBulk(f => ({ ...f, CodeTaux: e.target.value })),
                                                required: true,
                                                style: formBulk.CodeTaux ? { borderColor: C.taux.accent, background: C.taux.light, color: C.taux.accent, fontWeight: 700 } : {},
                                            },
                                                <>
                                                    <option value="">Sélectionner un code taux...</option>
                                                    {taux.map(t => <option key={t.IDTaux} value={t.CodeTaux}>{t.CodeTaux} ({t.Taux})</option>)}
                                                </>
                                            )}
                                        </div>

                                        {/* Périmètre */}
                                        <div>
                                            {fLabel('3. ' + (formBulk.mode === 'individual' ? 'Produits' : formBulk.mode === 'category' ? 'Préfixe NTS' : 'Périmètre'))}
                                            {formBulk.mode === 'individual' && (
                                                <div>
                                                    <div style={{ position: 'relative', marginBottom: '6px' }}>
                                                        <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                        <input value={prodFilter} onChange={e => setProdFilter(e.target.value)}
                                                            placeholder="Rechercher NTS..."
                                                            style={{ width: '100%', paddingLeft: '28px', paddingRight: '10px', height: '36px', border: '1.5px solid #e2e8f0', borderRadius: '9px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                                                    </div>
                                                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: '9px', background: 'white' }}>
                                                        {produits.slice(0, 100).map(p => {
                                                            const isSelected = formBulk.selectedNTS.includes(p.NTS);
                                                            return (
                                                                <div key={p.IDProduits}
                                                                    onClick={() => setFormBulk(f => ({
                                                                        ...f,
                                                                        selectedNTS: isSelected ? f.selectedNTS.filter(n => n !== p.NTS) : [...f.selectedNTS, p.NTS]
                                                                    }))}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                                        padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
                                                                        borderBottom: '1px solid #f1f5f9',
                                                                        background: isSelected ? C.produits.light : 'transparent',
                                                                        color: isSelected ? C.produits.accent : '#475569',
                                                                        fontWeight: isSelected ? 700 : 400,
                                                                    }}
                                                                >
                                                                    <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ accentColor: C.produits.accent }} />
                                                                    <Badge value={p.NTS} color={C.produits.accent} bg={C.produits.light} />
                                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.Libelle}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{formBulk.selectedNTS.length} sélectionné(s)</span>
                                                        {formBulk.selectedNTS.length > 0 && (
                                                            <button type="button" onClick={() => setFormBulk(f => ({ ...f, selectedNTS: [] }))}
                                                                style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
                                                                Tout désélectionner
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {formBulk.mode === 'category' && fInput({ placeholder: 'Préfixe NTS...', value: formBulk.ntsPrefix, onChange: e => setFormBulk(f => ({ ...f, ntsPrefix: e.target.value })), required: true })}
                                            {formBulk.mode === 'integral' && (
                                                <div style={{ padding: '10px 14px', background: '#fef9c3', border: '1.5px dashed #fbbf24', borderRadius: '9px', fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
                                                    Tous les produits ({totalProduits || '...'})
                                                </div>
                                            )}
                                        </div>

                                        {/* Submit */}
                                        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '0' }}>
                                            <button type="submit" disabled={saving || (formBulk.mode === 'individual' && formBulk.selectedNTS.length === 0)}
                                                style={{
                                                    background: C.bulk.grad, color: 'white',
                                                    border: 'none', borderRadius: '10px',
                                                    padding: '10px 22px', fontWeight: 800, fontSize: '13px',
                                                    cursor: saving ? 'not-allowed' : 'pointer',
                                                    opacity: saving || (formBulk.mode === 'individual' && formBulk.selectedNTS.length === 0) ? 0.6 : 1,
                                                    whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(217,119,6,0.3)',
                                                    height: '40px',
                                                }}>
                                                {saving ? 'Traitement...' : '✓ Appliquer'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Info bar */}
                                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
                                        <AlertCircle size={12} />
                                        {formBulk.mode === 'individual'
                                            ? `${formBulk.selectedNTS.length} produit(s) sélectionnés seront mis à jour.`
                                            : `${getAffectedCount()} seront impactés.`}
                                    </div>
                                </form>
                            </div>
                        </BlockCard>
                    </div>
                )}

                {/* ── TARIFS FULL WIDTH ── */}
                <BlockCard
                    cfg={C.tarifs} icon={Layers} title="Associations Tarifaires"
                    count={totalTarifs} countLabel="association(s) NTS ↔ Taxe ↔ Taux"
                    action={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                                <input value={tarifFilter} onChange={e => setTarifFilter(e.target.value)}
                                    placeholder="NTS ou taxe..."
                                    style={{ paddingLeft: '28px', paddingRight: '10px', height: '32px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', width: '150px' }} />
                            </div>
                        </div>
                    }
                >
                    <DataTable
                        maxHeight="420px"
                        grad={C.tarifs.grad} color={C.tarifs.accent}
                        headers={['NTS', 'Libellé Produit', 'Code Taxe', 'Libellé Taxe', 'Libellé Long', 'Niv.', 'Base', 'Code Taux', 'Taux', ...(isAdmin ? [''] : [])]}
                        loading={loadingTarifs} error={errors.tarifs}
                        emptyMsg="Aucune association tarifaire. Utilisez la mise à jour en masse ci-dessus."
                        rows={tarifs.map(t => [
                            <TD key="nts"><Badge value={t.NTS} color={C.produits.accent} bg={C.produits.light} /></TD>,
                            <TD key="lib" style={{ fontSize: '12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}>{t.LibelleProduit}</TD>,
                            <TD key="ctax"><Badge value={t.CodeTaxe} color={C.taxes.accent} bg={C.taxes.light} /></TD>,
                            <TD key="ltax" style={{ fontSize: '12px', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.LibelleTaxe}</TD>,
                            <TD key="llong" style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.LibelleTaxeComplet}</TD>,
                            <TD key="niv" style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{t.Niveau}</TD>,
                            <TD key="base" style={{ fontSize: '12px', color: '#64748b' }}>{t.Base}</TD>,
                            <TD key="ctaux"><Badge value={t.CodeTaux} color={C.taux.accent} bg={C.taux.light} /></TD>,
                            <TD key="taux"><span style={{ fontFamily: 'monospace', fontWeight: 800, color: C.taux.accent, fontSize: '13px' }}>{t.Taux}</span></TD>,
                            ...(isAdmin ? [<TD key="del"><button onClick={() => handleDelete('tarif', t.IDTarifs)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', borderRadius: '4px', transition: 'color 0.2s' }}
                                onMouseEnter={e => e.target.style.color = '#ef4444'} onMouseLeave={e => e.target.style.color = '#cbd5e1'}><Trash2 size={13} /></button></TD>] : [])
                        ])}
                    />
                    {/* Pagination footer */}
                    <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                            {tarifs.length} affiché(s) sur {totalTarifs}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button onClick={() => loadTarifs(tarifFilter, tarifsPage - 1)} disabled={tarifsPage <= 1}
                                style={{ padding: '4px 8px', border: `1px solid ${C.tarifs.border}`, background: tarifsPage <= 1 ? '#f8fafc' : 'white', borderRadius: '6px', cursor: tarifsPage <= 1 ? 'not-allowed' : 'pointer', color: tarifsPage <= 1 ? '#cbd5e1' : C.tarifs.accent }}>
                                <ChevronLeft size={14} />
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', padding: '0 6px' }}>
                                Page {tarifsPage} / {totalPages}
                            </span>
                            <button onClick={() => loadTarifs(tarifFilter, tarifsPage + 1)} disabled={tarifsPage >= totalPages}
                                style={{ padding: '4px 8px', border: `1px solid ${C.tarifs.border}`, background: tarifsPage >= totalPages ? '#f8fafc' : 'white', borderRadius: '6px', cursor: tarifsPage >= totalPages ? 'not-allowed' : 'pointer', color: tarifsPage >= totalPages ? '#cbd5e1' : C.tarifs.accent }}>
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </BlockCard>
            </div>

            {/* ══════════ MODALS ══════════ */}
            {modal.type && (
                <div onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 30px 60px rgba(0,0,0,0.25)', padding: '2rem', width: '100%', maxWidth: '460px', animation: 'slideUp 0.25s ease' }}>
                        {/* Close */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                            <button onClick={closeModal} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><X size={16} /></button>
                        </div>

                        {/* NTS */}
                        {modal.type === 'nts' && (
                            <form onSubmit={handleAddNTS}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: C.produits.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Package size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>Ajouter un produit NTS</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Codification tarifaire nationale</div>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    {fLabel('Code NTS *')}
                                    {fInput({ placeholder: 'Ex: 0101100000', value: formNTS.NTS, onChange: e => setFormNTS(f => ({ ...f, NTS: e.target.value })), required: true })}
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    {fLabel('Libellé *')}
                                    {fInput({ placeholder: 'Libellé du produit tarifaire', value: formNTS.Libelle, onChange: e => setFormNTS(f => ({ ...f, Libelle: e.target.value })), required: true })}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={closeModal} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: C.produits.grad, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Enregistrement...' : '+ Ajouter'}</button>
                                </div>
                            </form>
                        )}

                        {/* TAXE */}
                        {modal.type === 'taxe' && (
                            <form onSubmit={handleAddTaxe}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: C.taxes.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Tag size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>Ajouter une taxe</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Taxe douanière ou para-fiscale</div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                                    <div>{fLabel('Code Taxe *')}{fInput({ placeholder: 'Ex: DD', value: formTaxe.CodeTaxe, onChange: e => setFormTaxe(f => ({ ...f, CodeTaxe: e.target.value })), required: true })}</div>
                                    <div>{fLabel('Niveau *')}{fInput({ type: 'number', step: '0.01', placeholder: '1', value: formTaxe.Niveau, onChange: e => setFormTaxe(f => ({ ...f, Niveau: e.target.value })), required: true })}</div>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>{fLabel('Libellé court *')}{fInput({ placeholder: 'Ex: DROIT DE DOUANE', value: formTaxe.LibelleTaxe, onChange: e => setFormTaxe(f => ({ ...f, LibelleTaxe: e.target.value })), required: true })}</div>
                                <div style={{ marginBottom: '1rem' }}>{fLabel('Libellé complet')}{fInput({ placeholder: 'Libellé long', value: formTaxe.LibelleTaxeComplet, onChange: e => setFormTaxe(f => ({ ...f, LibelleTaxeComplet: e.target.value })) })}</div>
                                <div style={{ marginBottom: '1.5rem' }}>{fLabel('Base')}{fInput({ placeholder: 'Ex: Y ou QC', value: formTaxe.Base, onChange: e => setFormTaxe(f => ({ ...f, Base: e.target.value })) })}</div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={closeModal} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: C.taxes.grad, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Enregistrement...' : '+ Ajouter'}</button>
                                </div>
                            </form>
                        )}

                        {/* TAUX */}
                        {modal.type === 'taux' && (
                            <form onSubmit={handleAddTaux}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: C.taux.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Percent size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>Ajouter un code taux</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Valeur du taux associé</div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
                                    <div>{fLabel('Code Taux *')}{fInput({ placeholder: 'Ex: B1C1', value: formTaux.CodeTaux, onChange: e => setFormTaux(f => ({ ...f, CodeTaux: e.target.value })), required: true })}</div>
                                    <div>{fLabel('Valeur *')}{fInput({ type: 'number', step: '0.0001', placeholder: 'Ex: 5.00', value: formTaux.Taux, onChange: e => setFormTaux(f => ({ ...f, Taux: e.target.value })), required: true })}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={closeModal} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: C.taux.grad, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Enregistrement...' : '+ Ajouter'}</button>
                                </div>
                            </form>
                        )}

                        {/* EDIT NTS */}
                        {modal.type === 'edit-nts' && (
                            <form onSubmit={handleEditNTS}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: C.produits.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Pencil size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>Modifier le produit NTS</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>{formNTS.NTS}</div>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    {fLabel('Libellé *')}
                                    {fInput({ placeholder: 'Libellé du produit tarifaire', value: formNTS.Libelle, onChange: e => setFormNTS(f => ({ ...f, Libelle: e.target.value })), required: true })}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={closeModal} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: C.produits.grad, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
                                </div>
                            </form>
                        )}

                        {/* EDIT TAXE */}
                        {modal.type === 'edit-taxe' && (
                            <form onSubmit={handleEditTaxe}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: C.taxes.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Pencil size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>Modifier la taxe</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>{formTaxe.CodeTaxe}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                                    <div>{fLabel('Niveau *')}{fInput({ type: 'number', step: '0.01', placeholder: '1', value: formTaxe.Niveau, onChange: e => setFormTaxe(f => ({ ...f, Niveau: e.target.value })), required: true })}</div>
                                    <div>{fLabel('Base')}{fInput({ placeholder: 'Ex: V ou QC', value: formTaxe.Base, onChange: e => setFormTaxe(f => ({ ...f, Base: e.target.value })) })}</div>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>{fLabel('Libellé court *')}{fInput({ placeholder: 'Ex: DROIT DE DOUANE', value: formTaxe.LibelleTaxe, onChange: e => setFormTaxe(f => ({ ...f, LibelleTaxe: e.target.value })), required: true })}</div>
                                <div style={{ marginBottom: '1.5rem' }}>{fLabel('Libellé complet')}{fInput({ placeholder: 'Libellé long', value: formTaxe.LibelleTaxeComplet, onChange: e => setFormTaxe(f => ({ ...f, LibelleTaxeComplet: e.target.value })) })}</div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={closeModal} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: C.taxes.grad, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
                                </div>
                            </form>
                        )}

                        {/* EDIT TAUX */}
                        {modal.type === 'edit-taux' && (
                            <form onSubmit={handleEditTaux}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: C.taux.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Pencil size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>Modifier le taux</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>{formTaux.CodeTaux}</div>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    {fLabel('Valeur *')}
                                    {fInput({ type: 'number', step: '0.0001', placeholder: 'Ex: 5.00', value: formTaux.Taux, onChange: e => setFormTaux(f => ({ ...f, Taux: e.target.value })), required: true })}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={closeModal} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: C.taux.grad, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
                                </div>
                            </form>
                        )}

                        {/* TARIF */}
                        {modal.type === 'tarif' && (
                            <form onSubmit={handleAddTarif}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: C.tarifs.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Link2 size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>Ajouter une association</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Lier NTS → Taxe → Taux</div>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    {fLabel('NTS *')}
                                    {fSelect({ value: formTarif.NTS, onChange: e => setFormTarif(f => ({ ...f, NTS: e.target.value })), required: true },
                                        <><option value="">Sélectionner...</option>{produits.map(p => <option key={p.IDProduits} value={p.NTS}>{p.NTS} – {p.Libelle?.substring(0, 40)}</option>)}</>
                                    )}
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    {fLabel('Code Taxe *')}
                                    {fSelect({ value: formTarif.CodeTaxe, onChange: e => setFormTarif(f => ({ ...f, CodeTaxe: e.target.value })), required: true },
                                        <><option value="">Sélectionner...</option>{taxes.map(t => <option key={t.IDTaxes} value={t.CodeTaxe}>{t.CodeTaxe} – {t.LibelleTaxe}</option>)}</>
                                    )}
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    {fLabel('Code Taux *')}
                                    {fSelect({ value: formTarif.CodeTaux, onChange: e => setFormTarif(f => ({ ...f, CodeTaux: e.target.value })), required: true },
                                        <><option value="">Sélectionner...</option>{taux.map(t => <option key={t.IDTaux} value={t.CodeTaux}>{t.CodeTaux} ({t.Taux})</option>)}</>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={closeModal} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: C.tarifs.grad, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Enregistrement...' : '+ Ajouter'}</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
