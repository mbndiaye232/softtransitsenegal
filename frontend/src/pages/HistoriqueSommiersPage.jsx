/**
 * HistoriqueSommiersPage
 *
 * Deux modes de navigation :
 *  Option 1 — Par client  : Clients → Entrepôts du client → Sommiers + apurements
 *  Option 2 — Par entrepôt: Entrepôts → Sommiers (avec colonne Client) + apurements
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    History, Search, ChevronRight, ChevronDown, Plus, Minus,
    Warehouse, X, ArrowLeft, FileText, Users, Building2
} from 'lucide-react';
import { sommiersAPI, entrepotsAPI, clientsAPI } from '../services/api';
import { getReferenceSymbol } from '../utils/currency';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmt    = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtNum = (n) => n != null ? Number(n).toLocaleString('fr-FR') : '—';

const TYPE_LABELS = {
    REEXPORTATION:       'Réexportation',
    MISE_A_CONSOMMATION: 'Mise à conso.',
    DESTRUCTION:         'Destruction',
    TRANSFERT:           'Transfert régime',
    AUTRE:               'Autre',
};

const STATUT_STYLE = {
    ACTIF:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Actif'   },
    APURE:   { bg: '#dcfce7', color: '#15803d', label: 'Apuré'   },
    EXPIRE:  { bg: '#fee2e2', color: '#991b1b', label: 'Expiré'  },
    RESILIE: { bg: '#f3f4f6', color: '#374151', label: 'Résilié' },
};

const TYPE_ENTREPOT_STYLE = {
    PUBLIC:  { bg: '#eff6ff', color: '#2563eb' },
    PRIVE:   { bg: '#eff6ff', color: '#1d4ed8' },
    REEL:    { bg: '#f0fdf4', color: '#15803d' },
    FICTIF:  { bg: '#fff7ed', color: '#c2410c' },
    MAD:     { bg: '#fefce8', color: '#ca8a04' },
    AUTRE:   { bg: '#f3f4f6', color: '#374151' },
};

function echeanceColor(daysLeft) {
    if (daysLeft == null) return { bg: '#f3f4f6', color: '#6b7280', label: '—' };
    if (daysLeft <= 0)  return { bg: '#000000', color: '#ffffff', label: daysLeft === 0 ? "Aujourd'hui" : `J+${Math.abs(daysLeft)}` };
    if (daysLeft <= 3)  return { bg: '#7f1d1d', color: '#ffffff', label: `J-${daysLeft}` };
    if (daysLeft <= 7)  return { bg: '#ef4444', color: '#ffffff', label: `J-${daysLeft}` };
    if (daysLeft <= 15) return { bg: '#c2410c', color: '#ffffff', label: `J-${daysLeft}` };
    if (daysLeft <= 30) return { bg: '#fb923c', color: '#ffffff', label: `J-${daysLeft}` };
    return { bg: '#166534', color: '#ffffff', label: `J-${daysLeft}` };
}

/* ─── Badge ──────────────────────────────────────────────────────────────── */
function Badge({ children, bg, color }) {
    return (
        <span style={{
            background: bg || '#f3f4f6', color: color || '#374151',
            padding: '2px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            display: 'inline-block', whiteSpace: 'nowrap',
        }}>{children}</span>
    );
}

const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' };
const tdStyle = { padding: '9px 12px', color: '#374151' };

/* ─── SommierRow (ligne dépliable — partagée par les deux modes) ─────────── */
function SommierRow({ s, entrepotId, showClient, onExpand, detail, loadingDetail }) {
    const stat   = STATUT_STYLE[s.statut] || STATUT_STYLE.ACTIF;
    const isOpen = !!detail;
    const ech    = echeanceColor(parseInt(s.jours_avant_echeance, 10));
    const colSpan = showClient ? 8 : 7;

    const articles = useMemo(() => {
        if (!detail) return [];
        if (!entrepotId) return detail.articles || [];
        return (detail.articles || []).filter(a => String(a.entrepot_id) === String(entrepotId));
    }, [detail, entrepotId]);

    const apurementsAgg = useMemo(() => {
        if (!detail) return [];
        const articleIds = new Set(articles.map(a => String(a.id)));
        return (detail.apurements || []).map(ap => {
            const lignes = Array.isArray(ap.lignes) ? ap.lignes : [];
            const filt   = entrepotId ? lignes.filter(l => articleIds.has(String(l.sommier_article_id))) : lignes;
            if (!filt.length) return null;
            return {
                id: ap.id,
                date_apurement:   ap.date_apurement,
                type_sortie:      ap.type_sortie,
                reference_sortie: ap.reference_sortie,
                poids:  filt.reduce((s, l) => s + Number(l.poids  || 0), 0),
                colis:  filt.reduce((s, l) => s + Number(l.colis  || 0), 0),
                valeur: filt.reduce((s, l) => s + Number(l.valeur || 0), 0),
            };
        }).filter(Boolean);
    }, [detail, articles, entrepotId]);

    const solde = useMemo(() => {
        if (!articles.length) return null;
        return {
            poids:  articles.reduce((s, a) => s + Number(a.poids_restant  || 0), 0),
            colis:  articles.reduce((s, a) => s + Number(a.colis_restant  || 0), 0),
            valeur: articles.reduce((s, a) => s + Number(a.valeur_restante || 0), 0),
            unite:  articles[0]?.unite_poids || 'KG',
        };
    }, [articles]);

    return (
        <>
            <tr
                onClick={onExpand}
                style={{ borderBottom: isOpen ? 'none' : '1px solid #f3f4f6', cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = ''; }}
            >
                {/* Toggle */}
                <td style={{ padding: '11px 14px', width: 40 }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: isOpen ? '#1e3a8a' : '#eff6ff',
                        color: isOpen ? 'white' : '#1e3a8a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all .2s', flexShrink: 0,
                    }}>
                        {loadingDetail
                            ? <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                            : isOpen ? <Minus size={13} /> : <Plus size={13} />
                        }
                    </div>
                </td>
                {/* N° déclaration */}
                <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1e3a8a', fontSize: 14 }}>
                    {s.numero_declaration}
                </td>
                {/* Client (mode entrepôt-first uniquement) */}
                {showClient && (
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>
                        {s.client_nom
                            ? <span style={{ fontWeight: 600, color: '#374151' }}>{s.client_nom}</span>
                            : <span style={{ color: '#d1d5db' }}>—</span>
                        }
                        {s.client_ninea && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{s.client_ninea}</div>}
                    </td>
                )}
                {/* Régime */}
                <td style={{ padding: '11px 14px', fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: '#374151' }}>{s.regime_code}</span>
                </td>
                {/* Date début */}
                <td style={{ padding: '11px 14px', fontSize: 13, color: '#6b7280' }}>{fmt(s.date_declaration)}</td>
                {/* Échéance */}
                <td style={{ padding: '11px 14px', fontSize: 13 }}>
                    <div>{fmt(s.date_echeance)}</div>
                    {s.statut === 'ACTIF' && (
                        <Badge bg={ech.bg} color={ech.color}>{ech.label}</Badge>
                    )}
                </td>
                {/* Statut */}
                <td style={{ padding: '11px 14px' }}>
                    <Badge bg={stat.bg} color={stat.color}>{stat.label}</Badge>
                </td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1', fontSize: 14, fontWeight: 700 }}>›</td>
            </tr>

            {/* Zone dépliée */}
            {isOpen && (
                <tr>
                    <td colSpan={colSpan} style={{ padding: 0, background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                        <div style={{ padding: '16px 20px 20px 56px' }}>
                            {apurementsAgg.length === 0 ? (
                                <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', padding: '8px 0' }}>
                                    Aucune sortie enregistrée.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Type de sortie</th>
                                            <th style={thStyle}>Référence</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Poids sorti</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Colis sortis</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Montant ({getReferenceSymbol()})</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {apurementsAgg.map(ap => (
                                            <tr key={ap.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={tdStyle}>{fmt(ap.date_apurement)}</td>
                                                <td style={tdStyle}>{TYPE_LABELS[ap.type_sortie] || ap.type_sortie}</td>
                                                <td style={{ ...tdStyle, color: '#6b7280' }}>{ap.reference_sortie || '—'}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmtNum(ap.poids)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmtNum(ap.colis)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmtNum(ap.valeur)}</td>
                                            </tr>
                                        ))}
                                        {solde && (
                                            <tr style={{ background: '#f0fdf4', borderTop: '2px solid #bbf7d0' }}>
                                                <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 800, fontSize: 12, color: '#15803d', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                                                    Solde restant
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#15803d' }}>
                                                    {fmtNum(solde.poids)} <span style={{ fontSize: 10, fontWeight: 600 }}>{solde.unite}</span>
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#15803d' }}>
                                                    {fmtNum(solde.colis)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#15803d' }}>
                                                    {fmtNum(solde.valeur)}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

/* ─── Tableau de sommiers (partagé) ──────────────────────────────────────── */
function SommierTable({ sommiers, entrepotId, showClient, expanded, loadingDetail, onExpand, onFilter, filterStatut, sommierSearch, onSearchChange }) {
    const statutsDisponibles = ['ACTIF', 'APURE', 'RESILIE'];

    const filteredSommiers = useMemo(() => {
        let list = sommiers;
        if (filterStatut) list = list.filter(s => s.statut === filterStatut);
        const q = sommierSearch.toLowerCase().trim();
        if (q) list = list.filter(s =>
            s.numero_declaration?.toLowerCase().includes(q) ||
            s.client_nom?.toLowerCase().includes(q) ||
            s.regime_code?.toLowerCase().includes(q)
        );
        return list;
    }, [sommiers, filterStatut, sommierSearch]);

    return (
        <div>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <select
                    value={filterStatut}
                    onChange={e => onFilter(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, background: 'white', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="">Tous les statuts</option>
                    {statutsDisponibles.map(s => (
                        <option key={s} value={s}>{STATUT_STYLE[s]?.label || s}</option>
                    ))}
                </select>
                <div style={{ position: 'relative', width: 280 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#d1d5db' }} />
                    <input
                        type="text"
                        placeholder="N° déclaration, régime…"
                        value={sommierSearch}
                        onChange={e => onSearchChange(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 30px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', background: '#f9fafb' }}
                        onFocus={e => e.target.style.borderColor = '#1d4ed8'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                    {sommierSearch && (
                        <button onClick={() => onSearchChange('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Tableau */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,.05)', overflow: 'hidden' }}>
                {filteredSommiers.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                        {sommiers.length === 0
                            ? "Aucun sommier trouvé."
                            : `Aucun résultat pour « ${sommierSearch || filterStatut} »`
                        }
                    </div>
                ) : (
                    <>
                        {/* Compteur + résumé statuts */}
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid #f3f4f6', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <FileText size={13} color="#6b7280" />
                            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>
                                {filteredSommiers.length} sommier{filteredSommiers.length > 1 ? 's' : ''}
                                {sommiers.length !== filteredSommiers.length && ` sur ${sommiers.length}`}
                            </span>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {statutsDisponibles.map(st => {
                                    const n = sommiers.filter(s => s.statut === st).length;
                                    if (!n) return null;
                                    const stl = STATUT_STYLE[st];
                                    return (
                                        <span key={st} style={{ background: stl.bg, color: stl.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                            {stl.label} ({n})
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={{ ...thStyle, width: 40 }}></th>
                                    <th style={thStyle}>N° Déclaration</th>
                                    {showClient && <th style={thStyle}>Client</th>}
                                    <th style={thStyle}>Régime</th>
                                    <th style={thStyle}>Date début</th>
                                    <th style={thStyle}>Échéance</th>
                                    <th style={thStyle}>Statut</th>
                                    <th style={thStyle}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSommiers.map(s => (
                                    <SommierRow
                                        key={s.id}
                                        s={s}
                                        entrepotId={entrepotId}
                                        showClient={showClient}
                                        onExpand={() => onExpand(s.id)}
                                        detail={expanded[s.id] || null}
                                        loadingDetail={!!loadingDetail[s.id]}
                                    />
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/* ─── PAGE PRINCIPALE ────────────────────────────────────────────────────── */
export default function HistoriqueSommiersPage() {
    const [mode, setMode] = useState('client'); // 'client' | 'entrepot'

    /* ── État commun ── */
    const [expanded,      setExpanded]      = useState({});
    const [loadingDetail, setLoadingDetail] = useState({});
    const [filterStatut,  setFilterStatut]  = useState('');
    const [sommierSearch, setSommierSearch] = useState('');

    /* ── Mode "Par client" ── */
    const [clients,        setClients]        = useState([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [clientSearch,   setClientSearch]   = useState('');
    const [selectedClient, setSelectedClient] = useState(null);

    const [clientEntrepots,        setClientEntrepots]        = useState([]);
    const [loadingClientEntrepots, setLoadingClientEntrepots] = useState(false);
    const [selectedClientEntrepot, setSelectedClientEntrepot] = useState(null);

    const [clientSommiers,        setClientSommiers]        = useState([]);
    const [loadingClientSommiers, setLoadingClientSommiers] = useState(false);

    /* ── Mode "Par entrepôt" ── */
    const [entrepots,        setEntrepots]        = useState([]);
    const [loadingEntrepots, setLoadingEntrepots] = useState(false);
    const [entrepotSearch,   setEntrepotSearch]   = useState('');
    const [filterType,       setFilterType]       = useState('');
    const [selectedEntrepot, setSelectedEntrepot] = useState(null);

    const [entrepotSommiers,        setEntrepotSommiers]        = useState([]);
    const [loadingEntrepotSommiers, setLoadingEntrepotSommiers] = useState(false);

    /* ─── Chargements initiaux ─────────────────────────────────────────── */
    useEffect(() => {
        if (mode === 'client' && clients.length === 0) {
            setLoadingClients(true);
            clientsAPI.getAll()
                .then(r => setClients(Array.isArray(r.data) ? r.data : []))
                .catch(() => setClients([]))
                .finally(() => setLoadingClients(false));
        }
        if (mode === 'entrepot' && entrepots.length === 0) {
            setLoadingEntrepots(true);
            entrepotsAPI.list()
                .then(r => setEntrepots(Array.isArray(r.data) ? r.data : []))
                .catch(() => setEntrepots([]))
                .finally(() => setLoadingEntrepots(false));
        }
    }, [mode]);

    /* ─── Changement de mode ───────────────────────────────────────────── */
    const switchMode = (m) => {
        setMode(m);
        setExpanded({});
        setFilterStatut('');
        setSommierSearch('');
    };

    /* ─── Helpers expand ───────────────────────────────────────────────── */
    const handleExpand = useCallback(async (sommierId) => {
        if (expanded[sommierId]) {
            setExpanded(e => { const n = { ...e }; delete n[sommierId]; return n; });
            return;
        }
        setLoadingDetail(d => ({ ...d, [sommierId]: true }));
        try {
            const { data } = await sommiersAPI.getOne(sommierId);
            if (data.apurements) {
                data.apurements = data.apurements.map(ap => ({
                    ...ap,
                    lignes: typeof ap.lignes === 'string' ? JSON.parse(ap.lignes || '[]') : (ap.lignes || []),
                }));
            }
            setExpanded(e => ({ ...e, [sommierId]: data }));
        } catch {}
        finally { setLoadingDetail(d => ({ ...d, [sommierId]: false })); }
    }, [expanded]);

    /* ─── Mode client : actions ────────────────────────────────────────── */
    const handleSelectClient = async (client) => {
        setSelectedClient(client);
        setSelectedClientEntrepot(null);
        setClientEntrepots([]);
        setClientSommiers([]);
        setExpanded({});
        setFilterStatut('');
        setSommierSearch('');
        setLoadingClientEntrepots(true);
        try {
            const { data } = await sommiersAPI.clientEntrepots(client.IDCLIENTS);
            setClientEntrepots(Array.isArray(data) ? data : []);
        } catch { setClientEntrepots([]); }
        finally { setLoadingClientEntrepots(false); }
    };

    const handleSelectClientEntrepot = async (entrepot) => {
        setSelectedClientEntrepot(entrepot);
        setClientSommiers([]);
        setExpanded({});
        setFilterStatut('');
        setSommierSearch('');
        setLoadingClientSommiers(true);
        try {
            const { data } = await sommiersAPI.clientEntrepotSommiers(selectedClient.IDCLIENTS, entrepot.id);
            setClientSommiers(Array.isArray(data) ? data : []);
        } catch { setClientSommiers([]); }
        finally { setLoadingClientSommiers(false); }
    };

    const backToClients = () => {
        setSelectedClient(null);
        setSelectedClientEntrepot(null);
        setClientEntrepots([]);
        setClientSommiers([]);
        setExpanded({});
    };

    const backToClientEntrepots = () => {
        setSelectedClientEntrepot(null);
        setClientSommiers([]);
        setExpanded({});
        setFilterStatut('');
        setSommierSearch('');
    };

    /* ─── Mode entrepôt : actions ──────────────────────────────────────── */
    const handleSelectEntrepot = async (entrepot) => {
        setSelectedEntrepot(entrepot);
        setEntrepotSommiers([]);
        setExpanded({});
        setFilterStatut('');
        setSommierSearch('');
        setLoadingEntrepotSommiers(true);
        try {
            const { data } = await sommiersAPI.entrepotSommiers(entrepot.id);
            setEntrepotSommiers(Array.isArray(data) ? data : []);
        } catch { setEntrepotSommiers([]); }
        finally { setLoadingEntrepotSommiers(false); }
    };

    const backToEntrepots = () => {
        setSelectedEntrepot(null);
        setEntrepotSommiers([]);
        setExpanded({});
        setFilterStatut('');
        setSommierSearch('');
    };

    /* ─── Données filtrées ─────────────────────────────────────────────── */
    const filteredClients = useMemo(() => {
        const q = clientSearch.toLowerCase().trim();
        if (!q) return clients;
        return clients.filter(c =>
            c.NomRS?.toLowerCase().includes(q) ||
            c.NINEA?.toLowerCase().includes(q) ||
            c.Ville?.toLowerCase().includes(q)
        );
    }, [clients, clientSearch]);

    const filteredEntrepots = useMemo(() => {
        let list = entrepots;
        if (filterType) list = list.filter(e => e.type_entrepot === filterType);
        const q = entrepotSearch.toLowerCase().trim();
        if (q) list = list.filter(e =>
            e.libelle?.toLowerCase().includes(q) ||
            e.code?.toLowerCase().includes(q) ||
            e.adresse?.toLowerCase().includes(q)
        );
        return list;
    }, [entrepots, entrepotSearch, filterType]);

    const typesDisponibles = useMemo(() => [...new Set(entrepots.map(e => e.type_entrepot))].sort(), [entrepots]);

    /* ─── Breadcrumb texte selon l'état ──────────────────────────────────── */
    const breadcrumb = () => {
        if (mode === 'client') {
            if (selectedClientEntrepot) return `${selectedClient?.NomRS} › ${selectedClientEntrepot.libelle}`;
            if (selectedClient) return selectedClient.NomRS;
            return 'Sélectionnez un client';
        }
        if (selectedEntrepot) return selectedEntrepot.libelle;
        return 'Sélectionnez un entrepôt';
    };

    /* ─── Rendu grille clients ───────────────────────────────────────────── */
    const renderClientGrid = () => (
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', boxShadow: '0 8px 32px rgba(0,0,0,.08)', overflow: 'hidden' }}>
            {/* Barre */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Users size={15} color="#2563eb" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                        Clients
                        {!loadingClients && <span style={{ marginLeft: 6, fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>({filteredClients.length})</span>}
                    </span>
                </div>
                <div style={{ position: 'relative', width: 280 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#d1d5db' }} />
                    <input
                        type="text"
                        placeholder="Nom, NINEA, ville…"
                        value={clientSearch}
                        onChange={e => setClientSearch(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 32px 8px 30px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', background: '#f9fafb' }}
                        onFocus={e => e.target.style.borderColor = '#1d4ed8'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                    {clientSearch && (
                        <button onClick={() => setClientSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>
            {/* Grille */}
            {loadingClients ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                    <div style={{ width: 34, height: 34, border: '3px solid #e5e7eb', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                    <div style={{ color: '#9ca3af', fontSize: 14 }}>Chargement…</div>
                </div>
            ) : filteredClients.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    {clients.length === 0 ? 'Aucun client.' : `Aucun résultat pour « ${clientSearch} »`}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 0 }}>
                    {filteredClients.map(c => (
                        <button key={c.IDCLIENTS} onClick={() => handleSelectClient(c)} style={{
                            background: 'white', border: 'none',
                            borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6',
                            padding: '18px 22px', cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
                        }}
                            onMouseEnter={ev => ev.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={ev => ev.currentTarget.style.background = 'white'}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: '#eff6ff', border: '1.5px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Building2 size={18} color="#2563eb" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {c.NomRS}
                                    </div>
                                    {c.NINEA && <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{c.NINEA}</div>}
                                    {c.Ville && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{c.Ville}</div>}
                                </div>
                            </div>
                            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Warehouse size={11} /> Voir les entrepôts
                                </span>
                                <ChevronRight size={14} color="#d1d5db" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    /* ─── Rendu grille entrepôts client ──────────────────────────────────── */
    const renderClientEntrepotGrid = () => (
        <div>
            {/* Bouton retour + badge client */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <button onClick={backToClients} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <ArrowLeft size={13} /> Tous les clients
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '7px 14px' }}>
                    <Building2 size={15} color="#2563eb" />
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1d4ed8' }}>{selectedClient?.NomRS}</span>
                    {selectedClient?.NINEA && <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{selectedClient.NINEA}</span>}
                </div>
            </div>

            {loadingClientEntrepots ? (
                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 60, textAlign: 'center' }}>
                    <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                    <div style={{ color: '#9ca3af', fontSize: 14 }}>Chargement…</div>
                </div>
            ) : clientEntrepots.length === 0 ? (
                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 60, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    Ce client n'a aucun sommier enregistré.
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,.06)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Warehouse size={14} color="#0f766e" />
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                            Entrepôts
                            <span style={{ marginLeft: 6, fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>({clientEntrepots.length})</span>
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 0 }}>
                        {clientEntrepots.map(e => {
                            const ts = TYPE_ENTREPOT_STYLE[e.type_entrepot] || TYPE_ENTREPOT_STYLE.AUTRE;
                            return (
                                <button key={e.id} onClick={() => handleSelectClientEntrepot(e)} style={{
                                    background: 'white', border: 'none',
                                    borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6',
                                    padding: '18px 22px', cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
                                }}
                                    onMouseEnter={ev => ev.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={ev => ev.currentTarget.style.background = 'white'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: ts.bg, border: `1.5px solid ${ts.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Warehouse size={18} color={ts.color} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 2 }}>{e.libelle}</div>
                                            {e.code && <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: ts.color, background: ts.bg, display: 'inline-block', padding: '1px 6px', borderRadius: 4, marginBottom: 4 }}>{e.code}</div>}
                                            {e.adresse && <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.adresse}</div>}
                                        </div>
                                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: ts.bg, color: ts.color, flexShrink: 0 }}>{e.type_entrepot}</span>
                                    </div>
                                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                                            {e.nb_sommiers} sommier{e.nb_sommiers > 1 ? 's' : ''}
                                        </span>
                                        <ChevronRight size={14} color="#d1d5db" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    /* ─── Rendu sommiers client+entrepôt ─────────────────────────────────── */
    const renderClientSommiers = () => (
        <div>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button onClick={backToClients} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Users size={12} /> Clients
                </button>
                <ChevronRight size={12} color="#d1d5db" />
                <button onClick={backToClientEntrepots} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Building2 size={12} /> {selectedClient?.NomRS}
                </button>
                <ChevronRight size={12} color="#d1d5db" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px' }}>
                    <Warehouse size={12} color="#0f766e" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f766e' }}>{selectedClientEntrepot?.libelle}</span>
                </div>
            </div>

            {loadingClientSommiers ? (
                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 60, textAlign: 'center' }}>
                    <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                    <div style={{ color: '#9ca3af', fontSize: 13 }}>Chargement…</div>
                </div>
            ) : (
                <SommierTable
                    sommiers={clientSommiers}
                    entrepotId={selectedClientEntrepot?.id}
                    showClient={false}
                    expanded={expanded}
                    loadingDetail={loadingDetail}
                    onExpand={handleExpand}
                    filterStatut={filterStatut}
                    onFilter={setFilterStatut}
                    sommierSearch={sommierSearch}
                    onSearchChange={setSommierSearch}
                />
            )}
        </div>
    );

    /* ─── Rendu grille entrepôts (mode entrepôt) ─────────────────────────── */
    const renderEntrepotGrid = () => (
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', boxShadow: '0 8px 32px rgba(0,0,0,.08)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Warehouse size={15} color="#0f766e" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                        Entrepôts
                        {!loadingEntrepots && <span style={{ marginLeft: 6, fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>({filteredEntrepots.length})</span>}
                    </span>
                </div>
                {typesDisponibles.length > 1 && (
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, background: 'white', color: '#374151', outline: 'none', cursor: 'pointer' }}>
                        <option value="">Tous les types</option>
                        {typesDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                )}
                <div style={{ position: 'relative', width: 280 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#d1d5db' }} />
                    <input
                        type="text"
                        placeholder="Libellé, code, adresse…"
                        value={entrepotSearch}
                        onChange={e => setEntrepotSearch(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 32px 8px 30px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', background: '#f9fafb' }}
                        onFocus={e => e.target.style.borderColor = '#1d4ed8'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                    {entrepotSearch && (
                        <button onClick={() => setEntrepotSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {loadingEntrepots ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                    <div style={{ width: 34, height: 34, border: '3px solid #e5e7eb', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                    <div style={{ color: '#9ca3af', fontSize: 14 }}>Chargement…</div>
                </div>
            ) : filteredEntrepots.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    {entrepots.length === 0 ? 'Aucun entrepôt configuré.' : `Aucun résultat pour « ${entrepotSearch || filterType} »`}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 0 }}>
                    {filteredEntrepots.map(e => {
                        const ts = TYPE_ENTREPOT_STYLE[e.type_entrepot] || TYPE_ENTREPOT_STYLE.AUTRE;
                        return (
                            <button key={e.id} onClick={() => handleSelectEntrepot(e)} style={{
                                background: 'white', border: 'none',
                                borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6',
                                padding: '20px 24px', cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
                            }}
                                onMouseEnter={ev => ev.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={ev => ev.currentTarget.style.background = 'white'}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                    <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: ts.bg, border: `1.5px solid ${ts.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Warehouse size={20} color={ts.color} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 2 }}>{e.libelle}</div>
                                        {e.code && <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: ts.color, background: ts.bg, display: 'inline-block', padding: '1px 6px', borderRadius: 4, marginBottom: 4 }}>{e.code}</div>}
                                        {e.adresse && <div style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.adresse}</div>}
                                    </div>
                                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: ts.bg, color: ts.color, flexShrink: 0 }}>{e.type_entrepot}</span>
                                </div>
                                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <FileText size={11} /> Voir les sommiers
                                    </span>
                                    <ChevronRight size={14} color="#d1d5db" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );

    /* ─── Rendu sommiers entrepôt (mode entrepôt) ────────────────────────── */
    const renderEntrepotSommiers = () => (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <button onClick={backToEntrepots} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <ArrowLeft size={13} /> Tous les entrepôts
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '7px 14px' }}>
                    <Warehouse size={15} color="#0f766e" />
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f766e' }}>{selectedEntrepot?.libelle}</div>
                        {selectedEntrepot?.code && <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{selectedEntrepot.code}</div>}
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'white', color: '#0f766e', border: '1px solid #bbf7d0' }}>
                        {selectedEntrepot?.type_entrepot}
                    </span>
                </div>
            </div>

            {loadingEntrepotSommiers ? (
                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 60, textAlign: 'center' }}>
                    <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                    <div style={{ color: '#9ca3af', fontSize: 13 }}>Chargement…</div>
                </div>
            ) : (
                <SommierTable
                    sommiers={entrepotSommiers}
                    entrepotId={selectedEntrepot?.id}
                    showClient={true}
                    expanded={expanded}
                    loadingDetail={loadingDetail}
                    onExpand={handleExpand}
                    filterStatut={filterStatut}
                    onFilter={setFilterStatut}
                    sommierSearch={sommierSearch}
                    onSearchChange={setSommierSearch}
                />
            )}
        </div>
    );

    /* ─── RENDU GLOBAL ──────────────────────────────────────────────────── */
    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* ── HERO ── */}
            <div style={{
                background: 'var(--hero-gradient)',
                padding: '1.5rem 2.5rem 2.5rem',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
                <div style={{ position: 'absolute', bottom: '-60px', right: '15%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />

                <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <History size={22} color="white" />
                                </div>
                                <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-.03em' }}>
                                    Historique Sommiers
                                </h1>
                            </div>
                            <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, margin: 0, marginLeft: 56 }}>
                                {breadcrumb()}
                            </p>
                        </div>

                        {/* Onglets de mode */}
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: 4, gap: 4, backdropFilter: 'blur(6px)', alignSelf: 'flex-start' }}>
                            <button
                                onClick={() => switchMode('client')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                                    fontSize: 13, fontWeight: 700, transition: 'all .2s',
                                    background: mode === 'client' ? 'white' : 'transparent',
                                    color: mode === 'client' ? '#1e3a8a' : 'rgba(255,255,255,.75)',
                                }}
                            >
                                <Users size={14} /> Par client
                            </button>
                            <button
                                onClick={() => switchMode('entrepot')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                                    fontSize: 13, fontWeight: 700, transition: 'all .2s',
                                    background: mode === 'entrepot' ? 'white' : 'transparent',
                                    color: mode === 'entrepot' ? '#1e3a8a' : 'rgba(255,255,255,.75)',
                                }}
                            >
                                <Warehouse size={14} /> Par entrepôt
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CONTENU ── */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2.5rem 3rem', marginTop: '-1.5rem' }}>

                {/* ── Mode Par client ── */}
                {mode === 'client' && (
                    <>
                        {!selectedClient                 && renderClientGrid()}
                        {selectedClient && !selectedClientEntrepot && renderClientEntrepotGrid()}
                        {selectedClient && selectedClientEntrepot  && renderClientSommiers()}
                    </>
                )}

                {/* ── Mode Par entrepôt ── */}
                {mode === 'entrepot' && (
                    <>
                        {!selectedEntrepot && renderEntrepotGrid()}
                        {selectedEntrepot  && renderEntrepotSommiers()}
                    </>
                )}
            </div>
        </div>
    );
}
