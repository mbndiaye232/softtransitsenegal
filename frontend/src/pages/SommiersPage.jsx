/**
 * Sommiers — Page principale (v2)
 *
 * Liste des sommiers (seuls les régimes de type Suspensif sont proposés).
 * Création avec articles figés à la déclaration + entrepôt par article.
 * Drawer : Détail / Articles / Apurements.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ShieldCheck, Plus, RefreshCw, X, Trash2, AlertTriangle,
    CheckCircle2, Clock, Lock, Unlock, PlusCircle, Package, FileText, Edit2, Search
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
    sommiersAPI, entrepotsAPI, apurementsAPI,
    regimesAPI, clientsAPI, dossiersAPI
} from '../services/api';
import { getReferenceSymbol } from '../utils/currency';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtNum = (n) => n != null ? Number(n).toLocaleString('fr-FR') : '—';
const todayStr = () => new Date().toISOString().slice(0, 10);

/** Régimes éligibles aux sommiers : type Suspensif (donnée de la table des régimes). */
const isSommierRegime = (regime) => regime?.type_regime_code === 'SUSPENSIF';

/** Couleur d'échéance selon jours restants (cf. spec PR A). */
function echeanceColor(daysLeft) {
    if (daysLeft == null) return { bg: '#f3f4f6', color: '#6b7280', label: '—' };
    if (daysLeft <= 0)  return { bg: '#000000', color: '#ffffff', label: daysLeft === 0 ? 'Aujourd\'hui' : `J+${Math.abs(daysLeft)}` };
    if (daysLeft <= 3)  return { bg: '#7f1d1d', color: '#ffffff', label: `J-${daysLeft}` };
    if (daysLeft <= 7)  return { bg: '#ef4444', color: '#ffffff', label: `J-${daysLeft}` };
    if (daysLeft <= 15) return { bg: '#c2410c', color: '#ffffff', label: `J-${daysLeft}` };
    if (daysLeft <= 30) return { bg: '#fb923c', color: '#ffffff', label: `J-${daysLeft}` };
    return { bg: '#166534', color: '#ffffff', label: `J-${daysLeft}` };
}

const STATUT_STYLE = {
    ACTIF:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Actif' },
    APURE:   { bg: '#dcfce7', color: '#15803d', label: 'Apuré' },
    EXPIRE:  { bg: '#fee2e2', color: '#991b1b', label: 'Expiré' },
    RESILIE: { bg: '#f3f4f6', color: '#374151', label: 'Résilié' },
};

const TYPE_SORTIE_LABELS = {
    REEXPORTATION:       'Réexportation',
    MISE_A_CONSOMMATION: 'Mise à la consommation',
    DESTRUCTION:         'Destruction',
    TRANSFERT:           'Transfert régime',
    AUTRE:               'Autre',
};

const EMPTY_ARTICLE = {
    entrepot_id: '', designation: '', code_tarif: '',
    poids_initial: '', colis_initial: '', valeur_initial: '', unite_poids: 'KG'
};

/* ─── Mini composants ────────────────────────────────────────────────────── */
function Badge({ children, bg = '#f3f4f6', color = '#374151' }) {
    return (
        <span style={{
            background: bg, color, padding: '3px 10px', borderRadius: 10,
            fontSize: 12, fontWeight: 600, display: 'inline-block'
        }}>{children}</span>
    );
}

function KpiCard({ icon, label, value, color }) {
    return (
        <div style={{
            background: color + '08', border: `1px solid ${color}20`, borderRadius: 12,
            padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 'fit-content',
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: 10, background: color + '18',
                color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{icon}</div>
            <div>
                <div style={{ fontSize: 11, color: color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1.1, marginTop: 2 }}>{value}</div>
            </div>
        </div>
    );
}

function Toast({ message, type = 'info', onClose }) {
    if (!message) return null;
    const colors = { success: '#16a34a', error: '#dc2626', warning: '#f59e0b', info: '#2563eb' };
    return (
        <div style={{
            position: 'fixed', top: 16, right: 16, zIndex: 10000,
            background: colors[type], color: 'white', padding: '12px 20px',
            borderRadius: 10, fontWeight: 600, fontSize: 14, boxShadow: '0 6px 24px rgba(0,0,0,.15)'
        }} onClick={onClose}>{message}</div>
    );
}

/* ─── PAGE ───────────────────────────────────────────────────────────────── */
export default function SommiersPage() {
    const [sommiers, setSommiers]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [filterStatut, setFilterStatut] = useState('ACTIF');
    const [search, setSearch]       = useState('');

    const [showCreate, setShowCreate] = useState(false);
    const [detailId, setDetailId]     = useState(null);
    const [autoApurement, setAutoApurement] = useState(false);

    // Query params : ?sommier=ID&newApurement=1
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const sid = searchParams.get('sommier');
        const ap  = searchParams.get('newApurement');
        if (sid) {
            setDetailId(Number(sid));
            setAutoApurement(ap === '1');
            // Nettoyer les params pour ne pas ré-ouvrir au refresh
            searchParams.delete('sommier');
            searchParams.delete('newApurement');
            setSearchParams(searchParams, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [toast, setToast] = useState({ msg: '', type: 'info' });
    const showMsg = (msg, type = 'info') => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: '', type }), 3500);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterStatut) params.statut = filterStatut;
            const { data } = await sommiersAPI.list(params);
            setSommiers(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            showMsg('Erreur chargement sommiers', 'error');
        } finally {
            setLoading(false);
        }
    }, [filterStatut]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        if (!search.trim()) return sommiers;
        const s = search.toLowerCase();
        return sommiers.filter(x =>
            (x.numero_declaration || '').toLowerCase().includes(s) ||
            (x.client_nom || '').toLowerCase().includes(s) ||
            (x.regime_code || '').toLowerCase().includes(s)
        );
    }, [sommiers, search]);

    const kpis = useMemo(() => {
        const all = sommiers;
        return {
            total:  all.length,
            actifs: all.filter(x => x.statut === 'ACTIF').length,
            apures: all.filter(x => x.statut === 'APURE').length,
            urgents: all.filter(x => x.statut === 'ACTIF'
                                  && x.jours_avant_echeance != null
                                  && x.jours_avant_echeance <= 7).length,
        };
    }, [sommiers]);

    /* ─── Rendu ──────────────────────────────────────────────────────────── */
    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ msg: '' })} />

            {/* ── HERO HEADER ── */}
            <div style={{
                background: 'linear-gradient(135deg, #0c1a3a 0%, #1e3a8a 50%, #1d4ed8 100%)',
                padding: '2.5rem 2.5rem 4rem',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Cercles décoratifs */}
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
                <div style={{ position: 'absolute', bottom: '-60px', right: '15%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />
                <div style={{ position: 'absolute', top: '20px', left: '40%', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />

                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ShieldCheck size={22} color="white" />
                            </div>
                            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-.03em' }}>
                                Sommiers
                            </h1>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '14px', margin: 0, marginLeft: '56px' }}>
                            Régimes suspensifs douaniers — suivi et apurements
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={load} disabled={loading} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,.3)',
                            background: 'rgba(255,255,255,.1)', color: 'white', backdropFilter: 'blur(6px)',
                            fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
                        }}>
                            <RefreshCw size={15} /> Actualiser
                        </button>
                        <button onClick={() => setShowCreate(true)} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: 'white', color: '#1e3a8a',
                            fontSize: '14px', fontWeight: 700,
                            boxShadow: '0 4px 16px rgba(0,0,0,.2)', transition: 'all .2s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.25)' }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.2)' }}
                        >
                            <Plus size={18} /> Nouveau sommier
                        </button>
                    </div>
                </div>
            </div>

            {/* ── CONTENU ── */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2.5rem 3rem', marginTop: '-2rem' }}>

                {/* KPIs + Filtres flottants */}
                <div style={{
                    background: 'white', borderRadius: '20px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 32px rgba(0,0,0,.08)',
                    padding: '20px 24px',
                    marginBottom: '28px',
                }}>
                    {/* KPIs row */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                        <KpiCard icon={<FileText size={20} />}      label="Total"       value={kpis.total}   color="#1e3a8a" />
                        <KpiCard icon={<Clock size={20} />}         label="Actifs"      value={kpis.actifs}  color="#2563eb" />
                        <KpiCard icon={<AlertTriangle size={20} />} label="Urgents ≤7j" value={kpis.urgents} color="#dc2626" />
                        <KpiCard icon={<CheckCircle2 size={20} />}  label="Apurés"      value={kpis.apures}  color="#16a34a" />
                    </div>
                    {/* Séparateur */}
                    <div style={{ height: '1px', background: '#f3f4f6', marginBottom: 16 }} />
                    {/* Filtres */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                            style={{ ...inputStyle, width: '180px', flexShrink: 0 }}>
                            <option value="">Tous statuts</option>
                            <option value="ACTIF">Actifs</option>
                            <option value="APURE">Apurés</option>
                            <option value="EXPIRE">Expirés</option>
                            <option value="RESILIE">Résiliés</option>
                        </select>
                        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                            <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#d1d5db' }} />
                            <input
                                type="text" placeholder="Rechercher n° déclaration / client / régime…"
                                value={search} onChange={e => setSearch(e.target.value)}
                                style={{ ...inputStyle, paddingLeft: '34px' }}
                                onFocus={e => e.target.style.borderColor = '#1d4ed8'}
                                onBlur={e => e.target.style.borderColor = '#d1d5db'}
                            />
                        </div>
                        {filtered.length !== sommiers.length && (
                            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>
                                {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>

                {/* Liste */}
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
                    {loading ? (
                        <div style={{ padding: 60, textAlign: 'center' }}>
                            <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            <div style={{ color: '#9ca3af', fontSize: 14 }}>Chargement...</div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '70px 40px', textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '18px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <ShieldCheck size={28} color="#1d4ed8" />
                            </div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                                {search ? 'Aucun résultat' : 'Aucun sommier'}
                            </div>
                            <p style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 20px' }}>
                                {search ? `Aucun sommier ne correspond à "${search}"` : 'Créez votre premier sommier avec « Nouveau sommier »'}
                            </p>
                            {!search && (
                                <button onClick={() => setShowCreate(true)} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                    background: '#1e3a8a', color: 'white', fontSize: 14, fontWeight: 700,
                                }}>
                                    <Plus size={15} /> Nouveau sommier
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={th}>N° Déclaration</th>
                                    <th style={th}>Régime</th>
                                    <th style={th}>Client</th>
                                    <th style={th}>Date début</th>
                                    <th style={th}>Échéance</th>
                                    <th style={th}>Statut</th>
                                    <th style={th}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(s => {
                                    const echColor = echeanceColor(parseInt(s.jours_avant_echeance, 10));
                                    const stat = STATUT_STYLE[s.statut] || STATUT_STYLE.ACTIF;
                                    return (
                                        <tr key={s.id}
                                            onClick={() => setDetailId(s.id)}
                                            style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background .15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                                            <td style={{ ...td, fontWeight: 700, color: '#1e3a8a' }}>{s.numero_declaration}</td>
                                            <td style={td}>
                                                <span style={{ fontWeight: 700, color: '#374151' }}>{s.regime_code}</span>
                                                <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: 12 }}>{s.regime_libelle}</span>
                                            </td>
                                            <td style={td}>{s.client_nom || '—'}</td>
                                            <td style={{ ...td, color: '#6b7280' }}>{fmt(s.date_declaration)}</td>
                                            <td style={td}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ color: '#374151' }}>{fmt(s.date_echeance)}</span>
                                                    {s.statut === 'ACTIF' && (
                                                        <Badge bg={echColor.bg} color={echColor.color}>{echColor.label}</Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={td}><Badge bg={stat.bg} color={stat.color}>{stat.label}</Badge></td>
                                            <td style={td}>
                                                <span style={{ color: '#cbd5e1', fontSize: 20, fontWeight: 700 }}>›</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Création */}
            {showCreate && (
                <CreateSommierModal
                    onClose={() => setShowCreate(false)}
                    onCreated={(id) => { setShowCreate(false); load(); setDetailId(id); showMsg('Sommier créé', 'success'); }}
                    showMsg={showMsg}
                />
            )}

            {/* Drawer Détail */}
            {detailId && (
                <SommierDrawer
                    id={detailId}
                    onClose={() => { setDetailId(null); setAutoApurement(false); }}
                    onChanged={load}
                    showMsg={showMsg}
                    initialTab={autoApurement ? 'apurements' : 'detail'}
                    autoOpenApurement={autoApurement}
                />
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   MODAL CRÉATION
───────────────────────────────────────────────────────────────────────── */
function CreateSommierModal({ onClose, onCreated, showMsg }) {
    const [regimes, setRegimes]     = useState([]);
    const [clients, setClients]     = useState([]);
    const [dossiers, setDossiers]   = useState([]);
    const [entrepots, setEntrepots] = useState([]);

    const [form, setForm] = useState({
        IDRegimeDeclaration: '', numero_declaration: '',
        date_declaration: todayStr(), date_echeance: '',
        IDDossiers: '', IDCLIENTS: '',
        caution_requise: false, caution_montant: '',
        observations: ''
    });
    const [articles, setArticles] = useState([{ ...EMPTY_ARTICLE }]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [r, c, d, e] = await Promise.all([
                    regimesAPI.getAll(), clientsAPI.getAll(), dossiersAPI.getAll(), entrepotsAPI.list()
                ]);
                // Filtrer régimes éligibles
                const allRegimes = Array.isArray(r.data) ? r.data : (r.data?.data || []);
                setRegimes(allRegimes.filter(isSommierRegime));
                setClients(Array.isArray(c.data) ? c.data : (c.data?.data || []));
                setDossiers(Array.isArray(d.data) ? d.data : (d.data?.data || []));
                setEntrepots(Array.isArray(e.data) ? e.data : []);
            } catch (err) { console.error(err); }
        })();
    }, []);

    const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const setArt = (i, k, v) => setArticles(a => a.map((x, j) => j === i ? { ...x, [k]: v } : x));
    const addArt = () => setArticles(a => [...a, { ...EMPTY_ARTICLE }]);
    const rmArt = (i) => setArticles(a => a.filter((_, j) => j !== i));

    const submit = async () => {
        if (!form.IDRegimeDeclaration || !form.numero_declaration.trim() || !form.date_echeance) {
            return showMsg('Régime, n° déclaration et échéance requis', 'warning');
        }
        const arts = articles.filter(a => a.designation.trim() && a.entrepot_id);
        if (arts.length === 0) return showMsg('Au moins un article avec entrepôt requis', 'warning');

        setSaving(true);
        try {
            const { data } = await sommiersAPI.create({
                ...form,
                IDDossiers: form.IDDossiers || null,
                IDCLIENTS:  form.IDCLIENTS || null,
                caution_montant: form.caution_montant || null,
                articles: arts.map((a, i) => ({
                    entrepot_id: Number(a.entrepot_id),
                    numero_ligne: i + 1,
                    designation: a.designation.trim(),
                    code_tarif: a.code_tarif || null,
                    poids_initial:  Number(a.poids_initial)  || 0,
                    colis_initial:  Number(a.colis_initial)  || 0,
                    valeur_initial: Number(a.valeur_initial) || 0,
                    unite_poids:    a.unite_poids || 'KG'
                }))
            });
            onCreated(data.id);
        } catch (err) {
            showMsg(err.response?.data?.error || 'Erreur création', 'error');
        } finally { setSaving(false); }
    };

    return (
        <Modal title="Nouveau sommier" onClose={onClose} width={900}>
            {/* En-tête */}
            <div style={section}>
                <h3 style={sectionTitle}>Déclaration douanière</h3>
                <div style={grid2}>
                    <Field label="Régime *">
                        <select value={form.IDRegimeDeclaration}
                                onChange={e => setField('IDRegimeDeclaration', e.target.value)}
                                style={inputStyle}>
                            <option value="">— Choisir —</option>
                            {regimes.map(r => (
                                <option key={r.IDRegimeDeclaration} value={r.IDRegimeDeclaration}>
                                    {r.CodeRegimeDeclaration} — {r.LibelleRegimeDeclaration}
                                </option>
                            ))}
                        </select>
                        {regimes.length === 0 && (
                            <small style={{ color: '#dc2626' }}>Aucun régime suspensif disponible (voir Paramètres → Régimes de déclaration)</small>
                        )}
                    </Field>
                    <Field label="N° Déclaration * (unique global)">
                        <input value={form.numero_declaration}
                               onChange={e => setField('numero_declaration', e.target.value)}
                               style={inputStyle} placeholder="ex: IM7-2026-001234" />
                    </Field>
                    <Field label="Date déclaration *">
                        <input type="date" value={form.date_declaration}
                               onChange={e => setField('date_declaration', e.target.value)}
                               style={inputStyle} />
                    </Field>
                    <Field label="Date échéance *">
                        <input type="date" value={form.date_echeance}
                               onChange={e => setField('date_echeance', e.target.value)}
                               style={inputStyle} />
                    </Field>
                </div>
            </div>

            <div style={section}>
                <h3 style={sectionTitle}>Rattachement (optionnel)</h3>
                <div style={grid2}>
                    <Field label="Client">
                        <select value={form.IDCLIENTS}
                                onChange={e => {
                                    // Sélection client : reset le dossier si plus compatible
                                    setForm(f => ({ ...f, IDCLIENTS: e.target.value, IDDossiers: '' }));
                                }}
                                style={inputStyle}>
                            <option value="">—</option>
                            {clients.map(c => (
                                <option key={c.IDCLIENTS || c.id} value={c.IDCLIENTS || c.id}>{c.NomRS || c.nom}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label={form.IDCLIENTS ? "Dossier (filtré pour ce client)" : "Dossier (sélectionnez un client d'abord)"}>
                        <select value={form.IDDossiers}
                                onChange={e => setField('IDDossiers', e.target.value)}
                                style={inputStyle}
                                disabled={!form.IDCLIENTS}>
                            <option value="">—</option>
                            {dossiers
                                .filter(d => String(d.clientId ?? d.IDCLIENTS ?? '') === String(form.IDCLIENTS))
                                .map(d => {
                                    const id   = d.id ?? d.IDDossiers;
                                    const code = d.code ?? d.CodeDossier;
                                    const lbl  = d.label ?? d.Libelle ?? '';
                                    return (
                                        <option key={id} value={id}>
                                            {code} — {lbl}
                                        </option>
                                    );
                                })}
                        </select>
                        {form.IDCLIENTS && dossiers.filter(d => String(d.clientId ?? d.IDCLIENTS ?? '') === String(form.IDCLIENTS)).length === 0 && (
                            <small style={{ color: '#9ca3af' }}>Aucun dossier pour ce client</small>
                        )}
                    </Field>
                </div>
            </div>

            <div style={section}>
                <h3 style={sectionTitle}>Caution</h3>
                <div style={grid2}>
                    <Field label="">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                            <input type="checkbox" checked={form.caution_requise}
                                   onChange={e => setField('caution_requise', e.target.checked)} />
                            Caution requise
                        </label>
                    </Field>
                    {form.caution_requise && (
                        <Field label={`Montant caution (${getReferenceSymbol()})`}>
                            <input type="number" value={form.caution_montant}
                                   onChange={e => setField('caution_montant', e.target.value)}
                                   style={inputStyle} placeholder="0" />
                        </Field>
                    )}
                </div>
            </div>

            {/* Articles */}
            <div style={section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={sectionTitle}>Articles déclarés (figés après création)</h3>
                    <button type="button" onClick={addArt} style={btnSecondary}>
                        <Plus size={14} /> Ajouter article
                    </button>
                </div>
                {entrepots.length === 0 && (
                    <div style={{ padding: 12, background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#9a3412' }}>
                        Aucun entrepôt enregistré. Créez-en un depuis « Entrepôts » avant de créer un sommier.
                    </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            <th style={th}>Désignation *</th>
                            <th style={th}>Code SH</th>
                            <th style={th}>Entrepôt *</th>
                            <th style={th}>Poids</th>
                            <th style={th}>Unité</th>
                            <th style={th}>Colis</th>
                            <th style={th}>Valeur CAF</th>
                            <th style={th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {articles.map((a, i) => (
                            <tr key={i}>
                                <td style={td}>
                                    <input value={a.designation} onChange={e => setArt(i, 'designation', e.target.value)} style={inputStyle} />
                                </td>
                                <td style={td}>
                                    <input value={a.code_tarif} onChange={e => setArt(i, 'code_tarif', e.target.value)} style={{ ...inputStyle, width: 110 }} />
                                </td>
                                <td style={td}>
                                    <select value={a.entrepot_id} onChange={e => setArt(i, 'entrepot_id', e.target.value)} style={inputStyle}>
                                        <option value="">—</option>
                                        {entrepots.map(e => (<option key={e.id} value={e.id}>{e.libelle}</option>))}
                                    </select>
                                </td>
                                <td style={td}>
                                    <input type="number" step="0.001" value={a.poids_initial} onChange={e => setArt(i, 'poids_initial', e.target.value)} style={{ ...inputStyle, width: 90 }} />
                                </td>
                                <td style={td}>
                                    <select value={a.unite_poids} onChange={e => setArt(i, 'unite_poids', e.target.value)} style={{ ...inputStyle, width: 70 }}>
                                        <option>KG</option><option>T</option><option>L</option><option>M3</option>
                                    </select>
                                </td>
                                <td style={td}>
                                    <input type="number" value={a.colis_initial} onChange={e => setArt(i, 'colis_initial', e.target.value)} style={{ ...inputStyle, width: 70 }} />
                                </td>
                                <td style={td}>
                                    <input type="number" step="0.01" value={a.valeur_initial} onChange={e => setArt(i, 'valeur_initial', e.target.value)} style={{ ...inputStyle, width: 110 }} />
                                </td>
                                <td style={td}>
                                    {articles.length > 1 && (
                                        <button type="button" onClick={() => rmArt(i)} style={{ ...btnGhost, color: '#dc2626' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>

            <div style={section}>
                <Field label="Observations">
                    <textarea value={form.observations} onChange={e => setField('observations', e.target.value)}
                              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button onClick={onClose} style={btnSecondary}>Annuler</button>
                <button onClick={submit} disabled={saving} style={btnPrimary}>
                    {saving ? 'Création...' : 'Créer le sommier'}
                </button>
            </div>
        </Modal>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   DRAWER DÉTAIL
───────────────────────────────────────────────────────────────────────── */
function SommierDrawer({ id, onClose, onChanged, showMsg, initialTab = 'detail', autoOpenApurement = false }) {
    const [data, setData]   = useState(null);
    const [tab, setTab]     = useState(initialTab);
    const [showApurement, setShowApurement] = useState(false);
    const [showEdit, setShowEdit]           = useState(false);

    const load = useCallback(async () => {
        try {
            const r = await sommiersAPI.getOne(id);
            setData(r.data);
        } catch { showMsg('Erreur chargement sommier', 'error'); }
    }, [id, showMsg]);

    useEffect(() => { load(); }, [load]);

    // Auto-ouverture de la modale apurement (depuis EntrepotsPage)
    useEffect(() => {
        if (data && autoOpenApurement && data.statut === 'ACTIF') {
            setShowApurement(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.id]);

    if (!data) {
        return (
            <Drawer onClose={onClose}>
                <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Chargement...</div>
            </Drawer>
        );
    }

    const echColor = echeanceColor(parseInt(data.jours_avant_echeance, 10));
    const stat = STATUT_STYLE[data.statut] || STATUT_STYLE.ACTIF;

    const handleResilier = async () => {
        if (!confirm('Résilier ce sommier ? Action irréversible.')) return;
        try { await sommiersAPI.resilier(id); showMsg('Sommier résilié', 'success'); load(); onChanged(); }
        catch (e) { showMsg(e.response?.data?.error || 'Erreur', 'error'); }
    };

    const handleLiberer = async () => {
        try { await sommiersAPI.libererCaution(id); showMsg('Caution libérée', 'success'); load(); onChanged(); }
        catch (e) { showMsg(e.response?.data?.error || 'Erreur', 'error'); }
    };

    const handleDelete = async () => {
        if (!confirm('Supprimer ce sommier ?')) return;
        try { await sommiersAPI.delete(id); showMsg('Supprimé', 'success'); onClose(); onChanged(); }
        catch (e) { showMsg(e.response?.data?.error || 'Erreur', 'error'); }
    };

    return (
        <Drawer onClose={onClose} width={780}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>SOMMIER #{data.id}</div>
                        <h2 style={{ margin: '4px 0', fontSize: 20, color: '#111827' }}>{data.numero_declaration}</h2>
                        <div style={{ fontSize: 14, color: '#6b7280' }}>{data.regime_code} — {data.regime_libelle}</div>
                    </div>
                    <button onClick={onClose} style={btnGhost}><X size={20} /></button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <Badge bg={stat.bg} color={stat.color}>{stat.label}</Badge>
                    {data.statut === 'ACTIF' && <Badge bg={echColor.bg} color={echColor.color}>Échéance {echColor.label}</Badge>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {data.statut === 'ACTIF' && (
                        <button onClick={() => setShowApurement(true)} style={btnPrimary}>
                            <PlusCircle size={14} /> Saisir une sortie
                        </button>
                    )}
                    {data.statut === 'ACTIF' && (
                        <button onClick={() => setShowEdit(true)} style={btnSecondary}>
                            <Edit2 size={14} /> Modifier
                        </button>
                    )}
                    {data.statut === 'ACTIF' && (
                        <button onClick={handleResilier} style={btnSecondary}>Résilier</button>
                    )}
                    {!!data.caution_requise && !data.caution_liberee && (
                        <button onClick={handleLiberer} style={btnSecondary}>
                            <Unlock size={14} /> Libérer caution
                        </button>
                    )}
                    {!!data.caution_liberee && (
                        <Badge bg="#dcfce7" color="#166534"><Lock size={11} style={{ verticalAlign: 'middle' }} /> Caution libérée</Badge>
                    )}
                    <button onClick={handleDelete} style={{ ...btnSecondary, color: '#dc2626' }}>
                        <Trash2 size={14} /> Supprimer
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, padding: '12px 24px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {[
                    { key: 'detail',     label: 'Détail' },
                    { key: 'articles',   label: `Articles (${data.articles?.length || 0})` },
                    { key: 'apurements', label: `Apurements (${data.apurements?.length || 0})` },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        ...btnGhost, fontWeight: 600,
                        background: tab === t.key ? 'white' : 'transparent',
                        color: tab === t.key ? '#1e3a8a' : '#6b7280',
                        boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none'
                    }}>{t.label}</button>
                ))}
            </div>

            {/* Contenu */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                {tab === 'detail'     && <DetailTab data={data} />}
                {tab === 'articles'   && <ArticlesTab articles={data.articles || []} />}
                {tab === 'apurements' && (
                    <ApurementsTab
                        data={data}
                        onNew={() => setShowApurement(true)}
                        onChanged={() => { load(); onChanged(); }}
                        showMsg={showMsg}
                    />
                )}
            </div>

            {showApurement && (
                <ApurementModal
                    sommier={data}
                    onClose={() => setShowApurement(false)}
                    onCreated={() => { setShowApurement(false); load(); onChanged(); showMsg('Apurement créé', 'success'); }}
                    showMsg={showMsg}
                />
            )}
            {showEdit && (
                <EditSommierModal
                    sommier={data}
                    onClose={() => setShowEdit(false)}
                    onSaved={() => { setShowEdit(false); load(); onChanged(); showMsg('Sommier modifié', 'success'); }}
                    showMsg={showMsg}
                />
            )}
        </Drawer>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   MODAL ÉDITION (champs autorisés : date_echeance, caution, observations)
───────────────────────────────────────────────────────────────────────── */
function EditSommierModal({ sommier, onClose, onSaved, showMsg }) {
    const [form, setForm] = useState({
        date_echeance:           sommier.date_echeance ? String(sommier.date_echeance).slice(0, 10) : '',
        caution_requise:         !!sommier.caution_requise,
        caution_montant:         sommier.caution_montant || '',
        observations:            sommier.observations || ''
    });
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!form.date_echeance) return showMsg('Date d\'échéance requise', 'warning');
        setSaving(true);
        try {
            await sommiersAPI.update(sommier.id, {
                date_echeance:   form.date_echeance,
                caution_requise: form.caution_requise ? 1 : 0,
                caution_montant: form.caution_montant || null,
                observations:    form.observations || null
            });
            onSaved();
        } catch (e) {
            showMsg(e.response?.data?.error || 'Erreur', 'error');
        } finally { setSaving(false); }
    };

    return (
        <Modal title={`Modifier sommier ${sommier.numero_declaration}`} onClose={onClose} width={520}>
            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                ℹ️ Le régime, le n° de déclaration et les articles ne sont pas modifiables
                (la déclaration douane est immuable).
                Pour proroger l'échéance, ajustez la date ci-dessous.
            </div>

            <Field label="Date d'échéance *">
                <input type="date" value={form.date_echeance}
                       onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))}
                       style={inputStyle} />
            </Field>

            <Field label="">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <input type="checkbox" checked={form.caution_requise}
                           onChange={e => setForm(f => ({ ...f, caution_requise: e.target.checked }))} />
                    Caution requise
                </label>
            </Field>

            {form.caution_requise && (
                <Field label={`Montant caution (${getReferenceSymbol()})`}>
                    <input type="number" value={form.caution_montant}
                           onChange={e => setForm(f => ({ ...f, caution_montant: e.target.value }))}
                           style={inputStyle} />
                </Field>
            )}

            <Field label="Observations">
                <textarea value={form.observations}
                          onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                          rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button onClick={onClose} style={btnSecondary}>Annuler</button>
                <button onClick={submit} disabled={saving} style={btnPrimary}>
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
            </div>
        </Modal>
    );
}

/* ─── Onglets ────────────────────────────────────────────────────────────── */
function DetailTab({ data }) {
    return (
        <div>
            <Row label="Dossier"          value={data.dossier_code || '—'} />
            <Row label="Client"           value={data.client_nom || '—'} />
            <Row label="Date déclaration" value={fmt(data.date_declaration)} />
            <Row label="Date échéance"    value={fmt(data.date_echeance)} />
            {!!data.caution_requise && (
                <>
                    <Row label="Caution montant" value={`${fmtNum(data.caution_montant)} ${getReferenceSymbol()}`} />
                    <Row label="Caution libérée" value={data.caution_liberee ? `Oui (${fmt(data.caution_date_liberation)})` : 'Non'} />
                </>
            )}
            {data.observations && (
                <div style={{ marginTop: 14, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Observations</div>
                    {data.observations}
                </div>
            )}
        </div>
    );
}

function ArticlesTab({ articles }) {
    if (articles.length === 0) return <Empty msg="Aucun article" />;
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={th}>Désignation</th>
                    <th style={th}>SH</th>
                    <th style={th}>Entrepôt</th>
                    <th style={th}>Initial (P / C / V)</th>
                    <th style={th}>Apuré (P / C / V)</th>
                    <th style={th}>Restant (P / C / V)</th>
                </tr>
            </thead>
            <tbody>
                {articles.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={td}><strong>{a.designation}</strong></td>
                        <td style={td}>{a.code_tarif || '—'}</td>
                        <td style={td}>{a.entrepot_libelle}</td>
                        <td style={td}>
                            {fmtNum(a.poids_initial)} {a.unite_poids} / {fmtNum(a.colis_initial)} c. / {fmtNum(a.valeur_initial)}
                        </td>
                        <td style={td}>
                            {fmtNum(a.poids_apure)} / {fmtNum(a.colis_apure)} / {fmtNum(a.valeur_apure)}
                        </td>
                        <td style={{ ...td, fontWeight: 600,
                            color: (Number(a.poids_restant) <= 0 || Number(a.colis_restant) <= 0) ? '#16a34a' : '#111827' }}>
                            {fmtNum(a.poids_restant)} / {fmtNum(a.colis_restant)} / {fmtNum(a.valeur_restante)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        </div>
    );
}

function ApurementsTab({ data, onNew, onChanged, showMsg }) {
    const apurements = data.apurements || [];
    const canApurer = data.statut === 'ACTIF';

    const handleDelete = async (apId) => {
        if (!confirm('Supprimer cet apurement ? Les compteurs seront recalculés.')) return;
        try {
            await apurementsAPI.delete(apId);
            onChanged();
            showMsg('Apurement supprimé', 'success');
        } catch (e) { showMsg(e.response?.data?.error || 'Erreur', 'error'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>Historique des apurements</h3>
                {canApurer && (
                    <button onClick={onNew} style={btnPrimary}>
                        <PlusCircle size={14} /> Nouvel apurement
                    </button>
                )}
            </div>
            {apurements.length === 0 ? (
                <Empty msg={canApurer ? "Aucun apurement. Cliquez sur « Nouvel apurement »." : "Aucun apurement."} />
            ) : apurements.map(ap => (
                <div key={ap.id} style={{
                    border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 10
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                {fmt(ap.date_apurement)} — {TYPE_SORTIE_LABELS[ap.type_sortie] || ap.type_sortie}
                            </div>
                            {ap.reference_sortie && (
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Réf : {ap.reference_sortie}</div>
                            )}
                        </div>
                        <button onClick={() => handleDelete(ap.id)} style={{ ...btnGhost, color: '#dc2626' }}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                    {Array.isArray(ap.lignes) && ap.lignes.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: '#f9fafb' }}>
                                    <th style={td}>Article</th>
                                    <th style={td}>Poids</th>
                                    <th style={td}>Colis</th>
                                    <th style={td}>Valeur</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ap.lignes.map(l => (
                                    <tr key={l.id}>
                                        <td style={td}>{l.designation}</td>
                                        <td style={td}>{fmtNum(l.poids)}</td>
                                        <td style={td}>{fmtNum(l.colis)}</td>
                                        <td style={td}>{fmtNum(l.valeur)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    )}
                    {ap.observations && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>{ap.observations}</div>
                    )}
                </div>
            ))}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   MODAL APUREMENT
───────────────────────────────────────────────────────────────────────── */
function ApurementModal({ sommier, onClose, onCreated, showMsg }) {
    const [form, setForm] = useState({
        date_apurement: todayStr(), type_sortie: 'REEXPORTATION',
        reference_sortie: '', observations: ''
    });
    const articles = sommier.articles || [];
    const [lines, setLines] = useState(
        articles.map(a => ({ sommier_article_id: a.id, poids: '', colis: '', valeur: '' }))
    );
    const [saving, setSaving] = useState(false);

    const setLine = (i, k, v) => setLines(L => L.map((x, j) => j === i ? { ...x, [k]: v } : x));

    const submit = async () => {
        const lignes = lines
            .map(l => ({
                sommier_article_id: l.sommier_article_id,
                poids:  Number(l.poids)  || 0,
                colis:  Number(l.colis)  || 0,
                valeur: Number(l.valeur) || 0
            }))
            .filter(l => l.poids > 0 || l.colis > 0 || l.valeur > 0);

        if (lignes.length === 0) return showMsg('Renseignez au moins une quantité', 'warning');

        setSaving(true);
        try {
            await apurementsAPI.create({
                sommier_id: sommier.id,
                date_apurement: form.date_apurement,
                type_sortie: form.type_sortie,
                reference_sortie: form.reference_sortie || null,
                observations: form.observations || null,
                lignes
            });
            onCreated();
        } catch (e) {
            showMsg(e.response?.data?.error || 'Erreur création apurement', 'error');
        } finally { setSaving(false); }
    };

    return (
        <Modal title="Nouvel apurement" onClose={onClose} width={820}>
            <div style={grid2}>
                <Field label="Date apurement *">
                    <input type="date" value={form.date_apurement}
                           onChange={e => setForm(f => ({ ...f, date_apurement: e.target.value }))}
                           style={inputStyle} />
                </Field>
                <Field label="Type sortie *">
                    <select value={form.type_sortie}
                            onChange={e => setForm(f => ({ ...f, type_sortie: e.target.value }))}
                            style={inputStyle}>
                        {Object.entries(TYPE_SORTIE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </Field>
                <Field label="Référence (DAU sortie / PV…)">
                    <input value={form.reference_sortie}
                           onChange={e => setForm(f => ({ ...f, reference_sortie: e.target.value }))}
                           style={inputStyle} />
                </Field>
                <Field label="Observations">
                    <input value={form.observations}
                           onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                           style={inputStyle} />
                </Field>
            </div>

            <h3 style={sectionTitle}>Ventilation par article</h3>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                Renseignez les quantités à apurer pour chaque article (laisser 0 si non concerné).
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                    <tr style={{ background: '#f9fafb' }}>
                        <th style={th}>Article</th>
                        <th style={th}>Restant (P / C / V)</th>
                        <th style={th}>Poids</th>
                        <th style={th}>Colis</th>
                        <th style={th}>Valeur</th>
                    </tr>
                </thead>
                <tbody>
                    {articles.map((a, i) => (
                        <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={td}><strong>{a.designation}</strong>
                                <div style={{ fontSize: 11, color: '#6b7280' }}>{a.code_tarif} — {a.entrepot_libelle}</div>
                            </td>
                            <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>
                                {fmtNum(a.poids_restant)} {a.unite_poids} / {fmtNum(a.colis_restant)} c. / {fmtNum(a.valeur_restante)}
                            </td>
                            <td style={td}>
                                <input type="number" step="0.001"
                                       value={lines[i].poids}
                                       onChange={e => setLine(i, 'poids', e.target.value)}
                                       style={{ ...inputStyle, width: 100 }} />
                            </td>
                            <td style={td}>
                                <input type="number"
                                       value={lines[i].colis}
                                       onChange={e => setLine(i, 'colis', e.target.value)}
                                       style={{ ...inputStyle, width: 80 }} />
                            </td>
                            <td style={td}>
                                <input type="number" step="0.01"
                                       value={lines[i].valeur}
                                       onChange={e => setLine(i, 'valeur', e.target.value)}
                                       style={{ ...inputStyle, width: 110 }} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button onClick={onClose} style={btnSecondary}>Annuler</button>
                <button onClick={submit} disabled={saving} style={btnPrimary}>
                    {saving ? 'Enregistrement...' : 'Enregistrer apurement'}
                </button>
            </div>
        </Modal>
    );
}

/* ─── Composants utilitaires ─────────────────────────────────────────────── */
function Modal({ title, children, onClose, width = 720 }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'white', borderRadius: 12, width: '100%', maxWidth: width,
                maxHeight: '90vh', overflow: 'auto'
            }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: 18, color: '#111827' }}>{title}</h2>
                    <button onClick={onClose} style={btnGhost}><X size={20} /></button>
                </div>
                <div style={{ padding: 24 }}>{children}</div>
            </div>
        </div>
    );
}

function Drawer({ children, onClose, width = 720 }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999 }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{
                position: 'absolute', right: 0, top: 0, height: '100vh', width: '100%',
                maxWidth: width, background: 'white', boxShadow: '-10px 0 30px rgba(0,0,0,.15)',
                display: 'flex', flexDirection: 'column'
            }}>{children}</div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
            {children}
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
            <span style={{ flex: '0 0 180px', color: '#6b7280', fontWeight: 600 }}>{label}</span>
            <span style={{ color: '#111827' }}>{value}</span>
        </div>
    );
}

function Empty({ msg }) {
    return <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>{msg}</div>;
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
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
    cursor: 'pointer', color: '#6b7280', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 4
};
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' };
const td = { padding: '10px 12px', fontSize: 14, color: '#374151' };
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 };
const section = { marginBottom: 18 };
const sectionTitle = { margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 };
