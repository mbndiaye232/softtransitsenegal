import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText, Users, Search, ArrowLeft, ChevronDown, ChevronRight,
    AlertCircle, CheckCircle2, Clock, Calendar, RefreshCw, ExternalLink, CreditCard
} from 'lucide-react';
import { clientsAPI, facturesAPI, reglementsAPI } from '../services/api';
import { getReferenceSymbol } from '../utils/currency';

const FILTERS = {
    UNPAID:  'unpaid',   // Non intégralement réglées (reliquat > 0)
    PAID:    'paid',     // Intégralement réglées (reliquat <= 0 et au moins 1 règlement)
    ALL:     'all'
};

export default function SuiviFacturesClient() {
    const navigate = useNavigate();

    const [clients, setClients]         = useState([]);
    const [searchTerm, setSearchTerm]   = useState('');
    const [selectedClient, setSelectedClient] = useState(null);

    const [factures, setFactures]       = useState([]);
    const [reglements, setReglements]   = useState([]);
    const [loading, setLoading]         = useState(false);
    const [filter, setFilter]           = useState(FILTERS.UNPAID);
    const [expanded, setExpanded]       = useState({});  // { factureId: bool }
    const [error, setError]             = useState(null);

    useEffect(() => {
        clientsAPI.getAll()
            .then(res => setClients(res.data || []))
            .catch(() => setError('Erreur de chargement des clients'));
    }, []);

    const handleSelectClient = async (client) => {
        setSelectedClient(client);
        setExpanded({});
        setLoading(true);
        setError(null);
        try {
            const [fRes, rRes] = await Promise.all([
                facturesAPI.getByClient(client.IDCLIENTS),
                reglementsAPI.getClientHistory(client.IDCLIENTS)
            ]);
            setFactures(fRes.data || []);
            setReglements(rRes.data || []);
        } catch (e) {
            setError('Erreur lors du chargement des factures du client.');
            setFactures([]);
            setReglements([]);
        } finally {
            setLoading(false);
        }
    };

    // Group reglements by IDFactures (source of truth for amounts)
    const reglementsByFacture = useMemo(() => {
        return reglements.reduce((acc, r) => {
            (acc[r.IDFactures] = acc[r.IDFactures] || []).push(r);
            return acc;
        }, {});
    }, [reglements]);

    const enriched = useMemo(() => factures
        .filter(f => Number(f.Validee) === 1)
        .map(f => {
            const rs = reglementsByFacture[f.IDFactures] || [];
            const ttc = Number(f.MontantTTCFacture || 0);
            const regle = rs.reduce((s, r) => s + Number(r.MontantReglement || 0), 0);
            const reliquat = Math.max(0, ttc - regle);
            return { ...f, _reglements: rs, _ttc: ttc, _regle: regle, _reliquat: reliquat };
        }), [factures, reglementsByFacture]);

    const filtered = useMemo(() => {
        if (filter === FILTERS.UNPAID) return enriched.filter(f => f._reliquat > 0);
        if (filter === FILTERS.PAID)   return enriched.filter(f => f._reliquat <= 0 && f._regle > 0);
        return enriched;
    }, [enriched, filter]);

    const totals = useMemo(() => filtered.reduce((acc, f) => {
        acc.ttc += f._ttc;
        acc.regle += f._regle;
        acc.reliquat += f._reliquat;
        return acc;
    }, { ttc: 0, regle: 0, reliquat: 0 }), [filtered]);

    const filteredClients = useMemo(() => {
        if (!searchTerm) return clients;
        const s = searchTerm.toLowerCase().trim();
        return clients.filter(c => `${c.NomRS || ''} ${c.NomClient || ''} ${c.NINEA || ''}`.toLowerCase().includes(s));
    }, [clients, searchTerm]);

    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' ' + getReferenceSymbol();
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

    const getStatusInfo = (f) => {
        if (f._reliquat <= 0 && f._regle > 0) return { label: 'Soldée',  color: '#16a34a', bg: '#dcfce7', Icon: CheckCircle2 };
        if (f._regle > 0)                     return { label: 'Partielle', color: '#d97706', bg: '#fef3c7', Icon: Clock };
        return { label: 'Impayée', color: '#dc2626', bg: '#fee2e2', Icon: AlertCircle };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                .ssf-btn { padding: 0.5rem 0.9rem; border-radius: 0.5rem; font-weight: 700; font-size: 0.8rem; cursor: pointer; border: 1px solid #e2e8f0; background: white; color: #475569; display: inline-flex; align-items: center; gap: 0.4rem; }
                .ssf-btn.active { background: #1e40af; color: white; border-color: #1e40af; box-shadow: 0 2px 6px rgba(30,64,175,.25); }
                .ssf-btn:hover:not(.active) { background: #f1f5f9; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            <header style={{ background: '#1e293b', color: 'white', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FileText size={20} /> Suivi des factures par client
                </h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => navigate('/reglements')}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <CreditCard size={13} /> Saisie règlements
                    </button>
                    <button onClick={() => navigate('/dashboard')}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <ArrowLeft size={13} /> Tableau de bord
                    </button>
                </div>
            </header>

            <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar clients */}
                <aside style={{ width: 320, background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Users size={14} /> Clients ({clients.length})
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.35rem 0.75rem' }}>
                            <Search size={14} color="#94a3b8" />
                            <input
                                placeholder="Rechercher un client..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.8125rem', marginLeft: '0.5rem', color: '#334155' }}
                            />
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredClients.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                {searchTerm ? 'Aucun client trouvé' : 'Aucun client disponible'}
                            </div>
                        ) : filteredClients.map(c => {
                            const sel = selectedClient?.IDCLIENTS === c.IDCLIENTS;
                            return (
                                <div key={c.IDCLIENTS}
                                    onClick={() => handleSelectClient(c)}
                                    style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: sel ? '#eff6ff' : 'white', borderLeft: sel ? '3px solid #3b82f6' : '3px solid transparent' }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{c.NomRS || c.NomClient}</div>
                                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b' }}>{c.NINEA ? `NINEA: ${c.NINEA}` : '—'}</div>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* Main */}
                <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.5rem', gap: '1rem' }}>
                    {!selectedClient ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#94a3b8' }}>
                            <Users size={48} />
                            <div style={{ fontSize: 15, fontWeight: 700 }}>Sélectionnez un client pour consulter ses factures</div>
                        </div>
                    ) : (
                        <>
                            {/* Filtres + récap */}
                            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginRight: 8 }}>{selectedClient.NomRS || selectedClient.NomClient}</span>
                                    <button className={`ssf-btn ${filter === FILTERS.UNPAID ? 'active' : ''}`} onClick={() => setFilter(FILTERS.UNPAID)}>
                                        <AlertCircle size={13} /> Non intégralement réglées
                                    </button>
                                    <button className={`ssf-btn ${filter === FILTERS.PAID ? 'active' : ''}`} onClick={() => setFilter(FILTERS.PAID)}>
                                        <CheckCircle2 size={13} /> Réglées
                                    </button>
                                    <button className={`ssf-btn ${filter === FILTERS.ALL ? 'active' : ''}`} onClick={() => setFilter(FILTERS.ALL)}>
                                        Toutes
                                    </button>
                                    <button className="ssf-btn" onClick={() => handleSelectClient(selectedClient)} title="Rafraîchir">
                                        <RefreshCw size={13} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                                    <div><span style={{ color: '#64748b', fontWeight: 700 }}>Total facturé : </span><b style={{ color: '#1e40af' }}>{fmt(totals.ttc)}</b></div>
                                    <div><span style={{ color: '#64748b', fontWeight: 700 }}>Total réglé : </span><b style={{ color: '#16a34a' }}>{fmt(totals.regle)}</b></div>
                                    <div><span style={{ color: '#64748b', fontWeight: 700 }}>Reliquat : </span><b style={{ color: '#dc2626' }}>{fmt(totals.reliquat)}</b></div>
                                </div>
                            </div>

                            {error && (
                                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: 16, color: '#be123c', fontWeight: 600 }}>{error}</div>
                            )}

                            {/* Liste */}
                            <div style={{ flex: 1, background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {loading ? (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#1e40af' }} />
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
                                        Aucune facture pour ce filtre
                                    </div>
                                ) : (
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                                <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 1 }}>
                                                    <th style={{ width: 32, padding: '10px 8px' }}></th>
                                                    {['N° Facture', 'Date', 'Dossier', 'TTC', 'Réglé', 'Reliquat', 'Statut'].map(h => (
                                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, fontSize: 11, color: '#475569', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                                                    ))}
                                                    <th style={{ width: 60 }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filtered.map(f => {
                                                    const st = getStatusInfo(f);
                                                    const isOpen = !!expanded[f.IDFactures];
                                                    const hasReglements = f._reglements.length > 0;
                                                    return (
                                                        <React.Fragment key={f.IDFactures}>
                                                            <tr style={{ borderBottom: '1px solid #f1f5f9', cursor: hasReglements ? 'pointer' : 'default' }}
                                                                onClick={() => hasReglements && setExpanded(e => ({ ...e, [f.IDFactures]: !e[f.IDFactures] }))}>
                                                                <td style={{ padding: '10px 8px', textAlign: 'center', color: '#94a3b8' }}>
                                                                    {hasReglements ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}
                                                                </td>
                                                                <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>{f.NumeroFacture}</td>
                                                                <td style={{ padding: '12px', color: '#64748b' }}>{fmtDate(f.DateFacture)}</td>
                                                                <td style={{ padding: '12px', color: '#64748b' }}>
                                                                    {f.CodeDossier || '—'}
                                                                    {f.DossierLibelle && <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.DossierLibelle}</div>}
                                                                </td>
                                                                <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right' }}>{fmt(f._ttc)}</td>
                                                                <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right', color: '#16a34a' }}>{fmt(f._regle)}</td>
                                                                <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right', color: f._reliquat > 0 ? '#dc2626' : '#16a34a' }}>{fmt(f._reliquat)}</td>
                                                                <td style={{ padding: '12px' }}>
                                                                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 10px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                        <st.Icon size={11} /> {st.label}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                    <button onClick={(e) => { e.stopPropagation(); navigate(`/dossiers/${f.IDDossiers}`); }}
                                                                        title="Ouvrir le dossier"
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}>
                                                                        <ExternalLink size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            {isOpen && hasReglements && (
                                                                <tr style={{ background: '#fafbfc' }}>
                                                                    <td colSpan={9} style={{ padding: '0 12px 14px 48px' }}>
                                                                        <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                                            <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                <Calendar size={12} /> Règlements ({f._reglements.length})
                                                                            </div>
                                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                                                                <thead>
                                                                                    <tr style={{ background: '#fafbfc' }}>
                                                                                        {['Date', 'Montant', 'Mode', 'Observations'].map(h => (
                                                                                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                                                                                        ))}
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {f._reglements.map(r => (
                                                                                        <tr key={r.IDReglements} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                                                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{fmtDate(r.Datereglement)}</td>
                                                                                            <td style={{ padding: '8px 12px', fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>{fmt(r.MontantReglement)}</td>
                                                                                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.modeLibelle || '—'}</td>
                                                                                            <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{r.Observations || '—'}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}
