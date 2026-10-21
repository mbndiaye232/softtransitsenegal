/**
 * Entrepôts — CRUD + vue agrégée des articles par entrepôt.
 *
 * - Liste des entrepôts (Libellé, Adresse, Type, nb sommiers actifs)
 * - Création / édition / suppression
 * - Click entrepôt → vue des articles actifs (sommiers ACTIF) :
 *     désignation, code SH, sommier, échéance (avec couleur),
 *     initial / apuré / restant (poids · colis · valeur)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Warehouse, Plus, RefreshCw, X, Edit2, Trash2, ArrowLeft, Package,
    ChevronDown, ChevronRight, PlusCircle
} from 'lucide-react';
import { entrepotsAPI, sommiersAPI } from '../services/api';
import { getReferenceSymbol } from '../utils/currency';

const TYPE_OPTIONS = ['REEL', 'FICTIF', 'MAD', 'PRIVE', 'PUBLIC', 'AUTRE'];

const TYPE_SORTIE_LABELS = {
    REEXPORTATION:       'Réexportation',
    MISE_A_CONSOMMATION: 'Mise à la consommation',
    DESTRUCTION:         'Destruction',
    TRANSFERT:           'Transfert régime',
    AUTRE:               'Autre',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtNum = (n) => n != null ? Number(n).toLocaleString('fr-FR') : '—';

/** Couleur d'échéance (alignée sur SommiersPage). */
function echeanceColor(daysLeft) {
    if (daysLeft == null) return { bg: '#f3f4f6', color: '#6b7280', label: '—' };
    if (daysLeft <= 0)  return { bg: '#000000', color: '#ffffff', label: daysLeft === 0 ? 'Aujourd\'hui' : `J+${Math.abs(daysLeft)}` };
    if (daysLeft <= 3)  return { bg: '#7f1d1d', color: '#ffffff', label: `J-${daysLeft}` };
    if (daysLeft <= 7)  return { bg: '#ef4444', color: '#ffffff', label: `J-${daysLeft}` };
    if (daysLeft <= 15) return { bg: '#c2410c', color: '#ffffff', label: `J-${daysLeft}` };
    if (daysLeft <= 30) return { bg: '#fb923c', color: '#ffffff', label: `J-${daysLeft}` };
    return { bg: '#166534', color: '#ffffff', label: `J-${daysLeft}` };
}

export default function EntrepotsPage() {
    const [entrepots, setEntrepots] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [editing, setEditing]     = useState(null);    // null = pas de form, {} = création, {id,...} = édition
    const [viewing, setViewing]     = useState(null);    // entrepot à visualiser (vue articles)
    const [toast, setToast]         = useState({ msg: '', type: '' });

    const showMsg = (msg, type = 'info') => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: '' }), 3500);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await entrepotsAPI.list();
            setEntrepots(Array.isArray(data) ? data : []);
        } catch { showMsg('Erreur chargement', 'error'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const handleDelete = async (e) => {
        if (!confirm(`Supprimer l'entrepôt "${e.libelle}" ?`)) return;
        try { await entrepotsAPI.delete(e.id); showMsg('Supprimé', 'success'); load(); }
        catch (err) { showMsg(err.response?.data?.error || 'Erreur', 'error'); }
    };

    if (viewing) {
        return <EntrepotView entrepot={viewing} onBack={() => setViewing(null)} showMsg={showMsg} />;
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <Toast {...toast} onClose={() => setToast({ msg: '' })} />

            {/* ── HERO HEADER ── */}
            <div style={{
                background: 'var(--hero-gradient)',
                padding: '2.5rem 2.5rem 4rem',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
                <div style={{ position: 'absolute', bottom: '-60px', right: '15%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />
                <div style={{ position: 'absolute', top: '20px', left: '40%', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />

                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Warehouse size={22} color="white" />
                            </div>
                            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-.03em' }}>
                                Entrepôts
                            </h1>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '14px', margin: 0, marginLeft: '56px' }}>
                            Entrepôts douaniers — gestion des sommiers et articles
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={load} disabled={loading} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,.3)',
                            background: 'rgba(255,255,255,.1)', color: 'white', backdropFilter: 'blur(6px)',
                            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                        }}>
                            <RefreshCw size={15} /> Actualiser
                        </button>
                        <button onClick={() => setEditing({})} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: 'white', color: '#0f766e',
                            fontSize: '14px', fontWeight: 700,
                            boxShadow: '0 4px 16px rgba(0,0,0,.2)', transition: 'all .2s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.25)' }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.2)' }}
                        >
                            <Plus size={18} /> Nouvel entrepôt
                        </button>
                    </div>
                </div>
            </div>

            {/* ── CONTENU ── */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2.5rem 3rem', marginTop: '-2rem' }}>

                {/* Stats + liste dans card flottante */}
                <div style={{
                    background: 'white', borderRadius: '20px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 32px rgba(0,0,0,.08)',
                    overflow: 'hidden',
                    marginBottom: '0',
                }}>
                    {/* Stats bar */}
                    {!loading && entrepots.length > 0 && (
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0fdf4', background: '#f0fdf4', display: 'flex', gap: 24 }}>
                            <StatBar label="Total entrepôts" value={entrepots.length} color="#0f766e" />
                            <StatBar label="Publics" value={entrepots.filter(e => e.type_entrepot === 'PUBLIC').length} color="#0891b2" />
                            <StatBar label="Privés" value={entrepots.filter(e => e.type_entrepot === 'PRIVE').length} color="#1d4ed8" />
                        </div>
                    )}

                    {loading ? (
                        <div style={{ padding: 60, textAlign: 'center' }}>
                            <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            <div style={{ color: '#9ca3af', fontSize: 14 }}>Chargement...</div>
                        </div>
                    ) : entrepots.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '70px 40px', textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '18px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <Warehouse size={28} color="#0f766e" />
                            </div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Aucun entrepôt</div>
                            <p style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 20px' }}>Créez votre premier entrepôt douanier</p>
                            <button onClick={() => setEditing({})} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: '#0f766e', color: 'white', fontSize: 14, fontWeight: 700,
                            }}>
                                <Plus size={15} /> Nouvel entrepôt
                            </button>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={th}>Libellé</th>
                                    <th style={th}>Code</th>
                                    <th style={th}>Adresse</th>
                                    <th style={th}>Type</th>
                                    <th style={th}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {entrepots.map(e => (
                                    <tr key={e.id}
                                        style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background .15s' }}
                                        onMouseEnter={ev => ev.currentTarget.style.background = '#f0fdf4'}
                                        onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                                        <td style={{ ...td, fontWeight: 700, color: '#0f766e' }}
                                            onClick={() => setViewing(e)}>
                                            <Warehouse size={14} style={{ marginRight: 8, verticalAlign: 'middle', color: '#0f766e' }} />
                                            {e.libelle}
                                        </td>
                                        <td style={{ ...td, color: '#374151', fontFamily: 'monospace', fontWeight: 600 }} onClick={() => setViewing(e)}>
                                            {e.code || <span style={{ color: '#d1d5db' }}>—</span>}
                                        </td>
                                        <td style={{ ...td, color: '#6b7280' }} onClick={() => setViewing(e)}>{e.adresse || '—'}</td>
                                        <td style={td} onClick={() => setViewing(e)}><Badge>{e.type_entrepot}</Badge></td>
                                        <td style={{ ...td, textAlign: 'right' }}>
                                            <button onClick={() => setViewing(e)} style={{ ...btnGhost, color: '#0f766e' }} title="Voir articles">
                                                <Package size={14} /> Articles
                                            </button>
                                            <button onClick={() => setEditing(e)} style={btnGhost} title="Modifier">
                                                <Edit2 size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(e)} style={{ ...btnGhost, color: '#dc2626' }} title="Supprimer">
                                                <Trash2 size={14} />
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

            {editing && (
                <EntrepotForm
                    entrepot={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load(); showMsg('Enregistré', 'success'); }}
                    showMsg={showMsg}
                />
            )}
        </div>
    );
}

function StatBar({ label, value, color }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{label} :</span>
            <span style={{ fontSize: 14, fontWeight: 800, color }}>{value}</span>
        </div>
    );
}

/* ─── Formulaire création/édition ────────────────────────────────────────── */
function EntrepotForm({ entrepot, onClose, onSaved, showMsg }) {
    const isEdit = !!entrepot.id;
    const [form, setForm] = useState({
        libelle:       entrepot.libelle       || '',
        code:          entrepot.code          || '',
        adresse:       entrepot.adresse       || '',
        type_entrepot: entrepot.type_entrepot || 'REEL'
    });
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!form.libelle.trim()) return showMsg('Libellé requis', 'warning');
        setSaving(true);
        try {
            if (isEdit) await entrepotsAPI.update(entrepot.id, form);
            else        await entrepotsAPI.create(form);
            onSaved();
        } catch (e) { showMsg(e.response?.data?.error || 'Erreur', 'error'); }
        finally { setSaving(false); }
    };

    return (
        <Modal title={isEdit ? `Modifier "${entrepot.libelle}"` : 'Nouvel entrepôt'} onClose={onClose}>
            <Field label="Libellé *">
                <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                       style={inputStyle} placeholder="ex: Entrepôt Bel-Air" />
            </Field>
            <Field label="Code entrepôt">
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                       style={inputStyle} placeholder="ex: ENT-001" />
            </Field>
            <Field label="Adresse">
                <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                       style={inputStyle} placeholder="ex: Port de Dakar, môle 8" />
            </Field>
            <Field label="Type d'entrepôt">
                <select value={form.type_entrepot} onChange={e => setForm(f => ({ ...f, type_entrepot: e.target.value }))}
                        style={inputStyle}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button onClick={onClose} style={btnSecondary}>Annuler</button>
                <button onClick={submit} disabled={saving} style={btnPrimary}>
                    {saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer')}
                </button>
            </div>
        </Modal>
    );
}

/* ─── Vue agrégée articles par entrepôt ──────────────────────────────────── */
function EntrepotView({ entrepot, onBack, showMsg }) {
    const navigate = useNavigate();
    const [articles, setArticles] = useState([]);
    const [loading, setLoading]   = useState(true);
    // Map article_id → { open: bool, loading: bool, sorties: [] }
    const [expanded, setExpanded] = useState({});

    const saisirSortie = (sommierId) => {
        // Ouvre le drawer du sommier directement sur l'onglet apurements + modale ouverte
        navigate(`/sommiers?sommier=${sommierId}&newApurement=1`);
    };

    useEffect(() => {
        (async () => {
            try {
                const { data } = await sommiersAPI.byEntrepot(entrepot.id);
                setArticles(Array.isArray(data) ? data : []);
            } catch { /* noop */ }
            finally { setLoading(false); }
        })();
    }, [entrepot.id]);

    const toggleArticle = async (articleId) => {
        const cur = expanded[articleId];
        if (cur?.open) {
            setExpanded(s => ({ ...s, [articleId]: { ...cur, open: false } }));
            return;
        }
        // Première ouverture : charger les sorties
        setExpanded(s => ({ ...s, [articleId]: { open: true, loading: true, sorties: [] } }));
        try {
            const { data } = await sommiersAPI.articleSorties(articleId);
            setExpanded(s => ({ ...s, [articleId]: { open: true, loading: false, sorties: data || [] } }));
        } catch {
            setExpanded(s => ({ ...s, [articleId]: { open: true, loading: false, sorties: [] } }));
        }
    };

    const totals = useMemo(() => {
        return articles.reduce((acc, a) => ({
            poids:  acc.poids  + Number(a.poids_restant  || 0),
            colis:  acc.colis  + Number(a.colis_restant  || 0),
            valeur: acc.valeur + Number(a.valeur_restante || 0),
        }), { poids: 0, colis: 0, valeur: 0 });
    }, [articles]);

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

            {/* ── HERO HEADER ── */}
            <div style={{
                background: 'var(--hero-gradient)',
                padding: '2.5rem 2.5rem 4rem',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
                <div style={{ position: 'absolute', bottom: '-60px', right: '15%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />

                <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
                    <button onClick={onBack} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.25)',
                        background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.8)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16,
                    }}>
                        <ArrowLeft size={14} /> Entrepôts
                    </button>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Warehouse size={26} color="white" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-.03em' }}>{entrepot.libelle}</h1>
                            <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 14, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {entrepot.adresse || 'Adresse non renseignée'}
                                <span style={{ opacity: .4 }}>·</span>
                                <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 6, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>
                                    {entrepot.type_entrepot}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CONTENU ── */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2.5rem 3rem', marginTop: '-2rem' }}>

                {/* KPIs flottants */}
                <div style={{
                    background: 'white', borderRadius: '20px', border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 32px rgba(0,0,0,.08)', padding: '18px 24px', marginBottom: 20,
                    display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
                }}>
                    <Stat label="Articles actifs" value={articles.length} />
                    <div style={{ width: 1, height: 32, background: '#f3f4f6' }} />
                    <Stat label="Poids restant" value={`${fmtNum(totals.poids)} (toutes unités)`} />
                    <Stat label="Colis restants" value={fmtNum(totals.colis)} />
                    <Stat label="Valeur restante" value={`${fmtNum(totals.valeur)} ${getReferenceSymbol()}`} />
                </div>

                {/* Table articles */}
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', fontSize: 14, fontWeight: 700, color: '#111827', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Package size={15} color="#0f766e" />
                        Articles sous sommiers actifs
                    </div>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        <div style={{ color: '#9ca3af', fontSize: 14 }}>Chargement...</div>
                    </div>
                ) : articles.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                        Aucun article actif dans cet entrepôt.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ ...th, width: 28 }}></th>
                                <th style={th}>Désignation</th>
                                <th style={th}>SH</th>
                                <th style={th}>Sommier (n° décl.)</th>
                                <th style={th}>Client</th>
                                <th style={th}>Échéance</th>
                                <th style={th}>Initial (P / C / V)</th>
                                <th style={th}>Apuré (P / C / V)</th>
                                <th style={th}>Restant (P / C / V)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {articles.map(a => {
                                const ech = echeanceColor(parseInt(a.jours_avant_echeance, 10));
                                const epuise = Number(a.poids_restant) <= 0 || Number(a.colis_restant) <= 0;
                                const exp = expanded[a.id];
                                return (
                                    <React.Fragment key={a.id}>
                                        <tr style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                                            onClick={() => toggleArticle(a.id)}
                                            title="Cliquez pour voir l'historique des sorties">
                                            <td style={{ ...td, textAlign: 'center', color: '#6b7280' }}>
                                                {exp?.open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </td>
                                            <td style={td}><strong>{a.designation}</strong></td>
                                            <td style={td}>{a.code_tarif || '—'}</td>
                                            <td style={td}>
                                                <div style={{ fontWeight: 600 }}>{a.numero_declaration}</div>
                                                <div style={{ fontSize: 11, color: '#6b7280' }}>{a.regime_code}</div>
                                            </td>
                                            <td style={td}>{a.client_nom || '—'}</td>
                                            <td style={td}>
                                                <div style={{ fontSize: 12 }}>{fmt(a.date_echeance)}</div>
                                                <Badge bg={ech.bg} color={ech.color}>{ech.label}</Badge>
                                            </td>
                                            <td style={td}>
                                                {fmtNum(a.poids_initial)} {a.unite_poids} / {fmtNum(a.colis_initial)} / {fmtNum(a.valeur_initial)}
                                            </td>
                                            <td style={td}>
                                                {fmtNum(a.poids_apure)} / {fmtNum(a.colis_apure)} / {fmtNum(a.valeur_apure)}
                                            </td>
                                            <td style={{ ...td, fontWeight: 600, color: epuise ? '#16a34a' : '#111827' }}>
                                                {fmtNum(a.poids_restant)} / {fmtNum(a.colis_restant)} / {fmtNum(a.valeur_restante)}
                                            </td>
                                        </tr>
                                        {exp?.open && (
                                            <tr style={{ background: '#f9fafb' }}>
                                                <td colSpan={9} style={{ padding: '12px 24px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                                                            Historique des sorties (apurements)
                                                        </div>
                                                        {!epuise && (
                                                            <button onClick={(ev) => { ev.stopPropagation(); saisirSortie(a.sommier_id); }}
                                                                    style={btnPrimary}>
                                                                <PlusCircle size={14} /> Saisir une sortie
                                                            </button>
                                                        )}
                                                    </div>
                                                    {exp.loading ? (
                                                        <div style={{ color: '#6b7280', fontSize: 12 }}>Chargement...</div>
                                                    ) : exp.sorties.length === 0 ? (
                                                        <div style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>Aucune sortie enregistrée pour cet article.</div>
                                                    ) : (
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: 'white', borderRadius: 8 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ ...th, padding: '6px 10px' }}>Date</th>
                                                                    <th style={{ ...th, padding: '6px 10px' }}>Type sortie</th>
                                                                    <th style={{ ...th, padding: '6px 10px' }}>Référence</th>
                                                                    <th style={{ ...th, padding: '6px 10px' }}>Poids</th>
                                                                    <th style={{ ...th, padding: '6px 10px' }}>Colis</th>
                                                                    <th style={{ ...th, padding: '6px 10px' }}>Valeur</th>
                                                                    <th style={{ ...th, padding: '6px 10px' }}>Observations</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {exp.sorties.map(s => (
                                                                    <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                                                        <td style={{ ...td, padding: '6px 10px' }}>{fmt(s.date_apurement)}</td>
                                                                        <td style={{ ...td, padding: '6px 10px' }}>{TYPE_SORTIE_LABELS[s.type_sortie] || s.type_sortie}</td>
                                                                        <td style={{ ...td, padding: '6px 10px' }}>{s.reference_sortie || '—'}</td>
                                                                        <td style={{ ...td, padding: '6px 10px' }}>{fmtNum(s.poids)}</td>
                                                                        <td style={{ ...td, padding: '6px 10px' }}>{fmtNum(s.colis)}</td>
                                                                        <td style={{ ...td, padding: '6px 10px' }}>{fmtNum(s.valeur)}</td>
                                                                        <td style={{ ...td, padding: '6px 10px', color: '#6b7280', fontStyle: s.observations ? 'normal' : 'italic' }}>
                                                                            {s.observations || '—'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}

/* ─── UI utilitaires ─────────────────────────────────────────────────────── */
function Modal({ title, children, onClose }) {
    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'white', borderRadius: 12, width: '100%', maxWidth: 520
            }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: 17, color: '#111827' }}>{title}</h2>
                    <button onClick={onClose} style={btnGhost}><X size={20} /></button>
                </div>
                <div style={{ padding: 20 }}>{children}</div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
            {children}
        </div>
    );
}

function Badge({ children, bg = '#f3f4f6', color = '#374151' }) {
    return (
        <span style={{
            background: bg, color, padding: '3px 10px', borderRadius: 10,
            fontSize: 11, fontWeight: 700, display: 'inline-block'
        }}>{children}</span>
    );
}

function Stat({ label, value }) {
    return (
        <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 2 }}>{value}</div>
        </div>
    );
}

function Toast({ msg, type, onClose }) {
    if (!msg) return null;
    const colors = { success: '#16a34a', error: '#dc2626', warning: '#f59e0b', info: '#2563eb' };
    return (
        <div onClick={onClose} style={{
            position: 'fixed', top: 16, right: 16, zIndex: 10000,
            background: colors[type] || colors.info, color: 'white',
            padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14,
            boxShadow: '0 6px 24px rgba(0,0,0,.15)', cursor: 'pointer'
        }}>{msg}</div>
    );
}

const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 14, background: 'white', boxSizing: 'border-box'
};
const btnPrimary = {
    background: '#1e3a8a', color: 'white', border: 'none', padding: '8px 16px',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6
};
const btnSecondary = {
    background: 'white', color: '#374151', border: '1px solid #d1d5db',
    padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
};
const btnGhost = {
    background: 'transparent', border: 'none', padding: '6px 10px', borderRadius: 6,
    cursor: 'pointer', color: '#6b7280', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4
};
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' };
const td = { padding: '10px 12px', fontSize: 14, color: '#374151' };
