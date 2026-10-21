import React, { useState, useEffect } from 'react';
import { getReferenceSymbol } from '../../utils/currency';
import {
    Mail, Send, FileText, CheckCircle, Clock, AlertCircle,
    ChevronDown, ChevronUp, RefreshCw, User, Calendar,
    Building2, Paperclip, MessageSquare, X, Eye
} from 'lucide-react';
import { facturesAPI, comptesMailsAPI, documentsAPI } from '../../services/api';

const C = {
    grad:   'var(--hero-gradient)',
    accent: '#0e7490',
    light:  '#ecfeff',
    border: '#a5f3fc',
};

const fmt = (n, dec = 0) => n == null ? '—' : Number(n).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtDateTime = d => d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

function Badge({ color, bg, children }) {
    return (
        <span style={{ background: bg, color, borderRadius: '6px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>
            {children}
        </span>
    );
}

export default function EnvoiFacturesManager({ dossierId }) {
    const [invoices, setInvoices]         = useState([]);
    const [comptesMails, setComptesMails] = useState([]);
    const [dossierDocs, setDossierDocs]   = useState([]);
    const [loading, setLoading]           = useState(true);
    const [expanded, setExpanded]         = useState(null);   // IDFactures of open panel
    const [sending, setSending]           = useState(null);   // IDFactures being sent
    const [sent, setSent]                 = useState({});     // { id: { at: Date } }
    const [error, setError]               = useState({});
    const [forms, setForms]               = useState({});     // { id: { compteMailId, email, objet, message, docIds } }

    useEffect(() => {
        if (!dossierId) return;
        const load = async () => {
            setLoading(true);
            try {
                const [invRes, mailRes, docRes] = await Promise.all([
                    facturesAPI.getByDossier(dossierId),
                    comptesMailsAPI.getAll(),
                    documentsAPI.getByDossier(dossierId),
                ]);
                const validated = (invRes.data || []).filter(f => f.Validee === 1 || f.Validee === '1');
                setInvoices(validated);
                setComptesMails(Array.isArray(mailRes.data) ? mailRes.data : []);
                setDossierDocs(Array.isArray(docRes.data) ? docRes.data : []);

                // Init forms
                const defaultMailId = mailRes.data?.[0]?.IDComptesMails ? String(mailRes.data[0].IDComptesMails) : '';
                const initForms = {};
                validated.forEach(f => {
                    const prefix = (f.NumeroFacture || '').substring(0, 2);
                    const typeLabel = prefix === 'FD' ? 'Douane' : prefix === 'FP' ? 'Prestations' : 'Globale';
                    const delai = prefix === 'FD'
                        ? parseInt(f.DelaiReglementDouane) || 0
                        : parseInt(f.DelaiReglement) || 0;
                    const echeance = f.DateEcheance ? fmtDate(f.DateEcheance) : (delai > 0 ? `sous ${delai} jour(s)` : 'à réception');
                    const montantTTC = fmt(f.MontantTTCFacture, 0) + ' ' + getReferenceSymbol();
                    const dossierRef = `${f.CodeDossier || ''} — ${f.LibelleDossier || ''}`.trim();

                    initForms[f.IDFactures] = {
                        compteMailId: defaultMailId,
                        email: f.EmailClient || '',
                        objet: `Facture n° ${f.NumeroFacture} — Dossier ${dossierRef}`,
                        message: buildMessage(f, typeLabel, echeance, montantTTC),
                        docIds: [],
                    };
                });
                setForms(initForms);
            } catch (e) {
                console.error('EnvoiFactures load error', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [dossierId]);

    function buildMessage(f, typeLabel, echeance, montantTTC) {
        const dossierRef = `${f.CodeDossier || ''} — ${f.LibelleDossier || ''}`.trim();
        return `Madame, Monsieur,

Nous avons l'honneur de vous adresser, en pièce jointe, la facture n° ${f.NumeroFacture} (${typeLabel}) établie dans le cadre du dossier ${dossierRef}.

Le montant total TTC de cette facture s'élève à ${montantTTC}, avec une date d'échéance fixée au ${echeance}.

Nous vous saurions gré de bien vouloir procéder au règlement à l'échéance indiquée. Pour toute question relative à cette facture ou aux documents joints, notre équipe reste à votre entière disposition.

Dans l'attente de votre règlement, nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`;
    }

    const setForm = (id, patch) => setForms(p => ({ ...p, [id]: { ...p[id], ...patch } }));

    const toggleDoc = (factureId, docId) => {
        setForms(p => {
            const ids = p[factureId]?.docIds || [];
            const next = ids.includes(docId) ? ids.filter(x => x !== docId) : [...ids, docId];
            return { ...p, [factureId]: { ...p[factureId], docIds: next } };
        });
    };

    const handleSend = async (facture) => {
        const form = forms[facture.IDFactures];
        if (!form?.email) return;
        setSending(facture.IDFactures);
        setError(p => ({ ...p, [facture.IDFactures]: null }));
        try {
            await facturesAPI.sendEmail(facture.IDFactures, {
                compteMailId:    form.compteMailId || undefined,
                emailDestinataire: form.email,
                documentIds:     form.docIds,
                message:         form.message,
                objet:           form.objet,
            });
            const sentAt = new Date();
            setSent(p => ({ ...p, [facture.IDFactures]: { at: sentAt } }));
            setExpanded(null);
            setInvoices(p => p.map(f =>
                f.IDFactures === facture.IDFactures ? { ...f, dateenvoye: sentAt.toISOString() } : f
            ));
        } catch (e) {
            setError(p => ({ ...p, [facture.IDFactures]: e?.response?.data?.error || e.message }));
        } finally {
            setSending(null);
        }
    };

    const prefixColor = p => p === 'FD'
        ? { bg: '#dbeafe', color: '#1d4ed8' }
        : p === 'FP'
            ? { bg: '#f0fdf4', color: '#15803d' }
            : { bg: '#fef9c3', color: '#854d0e' };

    if (loading) return (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={28} style={{ animation: 'spin .8s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
            <div style={{ fontWeight: 600 }}>Chargement…</div>
        </div>
    );

    if (invoices.length === 0) return (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
            <Mail size={48} style={{ opacity: 0.15, margin: '0 auto 1rem', display: 'block' }} />
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem' }}>Aucune facture validée</div>
            <div style={{ fontSize: '0.85rem' }}>Validez une facture dans l'onglet Facturation pour pouvoir l'envoyer.</div>
        </div>
    );

    return (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .efm-card { border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; transition: box-shadow .2s; }
                .efm-card:hover { box-shadow: 0 4px 20px rgba(14,116,144,.12); }
                .efm-inp { width:100%; padding:.6rem .9rem; border:1px solid #e2e8f0; border-radius:.625rem; font-size:13px; outline:none; box-sizing:border-box; font-family:inherit; background:#f8fafc; transition:border-color .2s; }
                .efm-inp:focus { border-color:#0e7490; background:white; }
                .efm-ta { width:100%; padding:.7rem .9rem; border:1px solid #e2e8f0; border-radius:.625rem; font-size:13px; outline:none; box-sizing:border-box; font-family:inherit; background:#f8fafc; resize:vertical; line-height:1.6; transition:border-color .2s; }
                .efm-ta:focus { border-color:#0e7490; background:white; }
                .efm-lbl { font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; display:block; }
                .efm-doc-row { display:flex; align-items:center; gap:10px; padding:.5rem .875rem; border-bottom:1px solid #f1f5f9; cursor:pointer; transition:background .15s; }
                .efm-doc-row:last-child { border-bottom:none; }
                .efm-doc-row:hover { background:#f8fafc; }
                .efm-send-btn { display:flex; align-items:center; gap:.5rem; padding:.7rem 1.5rem; background:${C.grad}; color:white; border:none; border-radius:.75rem; font-weight:700; font-size:.875rem; cursor:pointer; transition:all .2s; }
                .efm-send-btn:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); }
                .efm-send-btn:disabled { opacity:.6; cursor:not-allowed; }
            `}</style>

            {/* Header */}
            <div style={{ background: C.grad, borderRadius: '14px', padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: '10px', padding: '10px', display: 'flex' }}>
                    <Mail size={22} color="white" />
                </div>
                <div>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: '1.05rem' }}>Envoi des factures par e-mail</div>
                    <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '12px', marginTop: 2 }}>
                        {invoices.length} facture{invoices.length > 1 ? 's' : ''} validée{invoices.length > 1 ? 's' : ''} — sélectionnez une facture pour la composer et l'envoyer
                    </div>
                </div>
                {comptesMails.length === 0 && (
                    <div style={{ marginLeft: 'auto', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', color: '#dc2626', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <AlertCircle size={13} /> Aucun compte mail configuré
                    </div>
                )}
            </div>

            {/* Invoice list */}
            {invoices.map(f => {
                const form    = forms[f.IDFactures] || {};
                const isOpen  = expanded === f.IDFactures;
                const sentInfo = sent[f.IDFactures];
                const isSent  = !!sentInfo || !!f.dateenvoye;
                const sentAt  = sentInfo?.at ? fmtDateTime(sentInfo.at) : (f.dateenvoye ? fmtDateTime(f.dateenvoye) : null);
                const isLoading = sending === f.IDFactures;
                const err     = error[f.IDFactures];
                const prefix  = (f.NumeroFacture || '').substring(0, 2);
                const { bg, color } = prefixColor(prefix);
                const typeLabel = prefix === 'FD' ? 'Douane' : prefix === 'FP' ? 'Prestations' : 'Globale';
                const delai = prefix === 'FD'
                    ? parseInt(f.DelaiReglementDouane) || 0
                    : parseInt(f.DelaiReglement) || 0;

                return (
                    <div key={f.IDFactures} className="efm-card" style={{ background: 'white' }}>
                        {/* Card header — click to expand */}
                        <div
                            onClick={() => setExpanded(isOpen ? null : f.IDFactures)}
                            style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', borderBottom: isOpen ? '1px solid #f1f5f9' : 'none' }}
                        >
                            {/* Type badge */}
                            <Badge bg={bg} color={color}>{typeLabel}</Badge>

                            {/* Ref */}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{f.NumeroFacture}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2, display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <Calendar size={11} /> {fmtDate(f.Datefacture || f.DateFacture)}
                                    </span>
                                    {f.DateEcheance && (
                                        <span style={{ display: 'flex', gap: 4, alignItems: 'center', color: new Date(f.DateEcheance) < new Date() ? '#dc2626' : '#64748b' }}>
                                            <Clock size={11} /> Échéance : {fmtDate(f.DateEcheance)}
                                        </span>
                                    )}
                                    {!f.DateEcheance && delai > 0 && (
                                        <span style={{ display: 'flex', gap: 4, alignItems: 'center', color: '#f59e0b' }}>
                                            <Clock size={11} /> Délai : {delai} j.
                                        </span>
                                    )}
                                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <User size={11} /> {f.EmailClient || 'Email non renseigné'}
                                    </span>
                                </div>
                            </div>

                            {/* Amount */}
                            <div style={{ textAlign: 'right', minWidth: 120 }}>
                                <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{fmt(f.MontantTTCFacture, 0)} {getReferenceSymbol()}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>TTC</div>
                            </div>

                            {/* Status */}
                            {isSent ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '6px 14px', minWidth: 160 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#15803d', fontWeight: 800, fontSize: '13px' }}>
                                        <CheckCircle size={15} fill="#15803d" color="white" /> Facture envoyée
                                    </div>
                                    {sentAt && <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>le {sentAt}</div>}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#0e7490', fontWeight: 700, fontSize: '12px', background: C.light, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '4px 12px', whiteSpace: 'nowrap' }}>
                                    <Mail size={13} /> À envoyer
                                </div>
                            )}

                            {/* Chevron */}
                            <div style={{ color: '#94a3b8' }}>
                                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                        </div>

                        {/* Expanded form */}
                        {isOpen && (
                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                                {/* Row 1: compte expéditeur + destinataire */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label className="efm-lbl">Compte expéditeur</label>
                                        {comptesMails.length === 0 ? (
                                            <div style={{ padding: '0.6rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', fontSize: '12px', color: '#c2410c' }}>
                                                Aucun compte configuré
                                            </div>
                                        ) : (
                                            <select
                                                className="efm-inp"
                                                value={form.compteMailId || ''}
                                                onChange={e => setForm(f.IDFactures, { compteMailId: e.target.value })}
                                                style={{ appearance: 'auto', cursor: 'pointer' }}
                                            >
                                                {comptesMails.map(c => (
                                                    <option key={c.IDComptesMails} value={c.IDComptesMails}>
                                                        {[c.LibelleMail, c.adressemail || c.AdresseMail].filter(Boolean).join(' — ')}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div>
                                        <label className="efm-lbl">Destinataire *</label>
                                        <input
                                            type="email"
                                            className="efm-inp"
                                            value={form.email || ''}
                                            onChange={e => setForm(f.IDFactures, { email: e.target.value })}
                                            placeholder="email@societe.com"
                                        />
                                    </div>
                                </div>

                                {/* Objet */}
                                <div>
                                    <label className="efm-lbl">Objet</label>
                                    <input
                                        className="efm-inp"
                                        value={form.objet || ''}
                                        onChange={e => setForm(f.IDFactures, { objet: e.target.value })}
                                    />
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="efm-lbl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <MessageSquare size={12} /> Corps du message
                                    </label>
                                    <textarea
                                        className="efm-ta"
                                        rows={10}
                                        value={form.message || ''}
                                        onChange={e => setForm(f.IDFactures, { message: e.target.value })}
                                    />
                                </div>

                                {/* Documents du dossier */}
                                {dossierDocs.length > 0 && (
                                    <div>
                                        <label className="efm-lbl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Paperclip size={12} /> Documents du dossier à joindre
                                            {(form.docIds || []).length > 0 && (
                                                <span style={{ background: C.accent, color: 'white', borderRadius: '99px', padding: '1px 8px', fontSize: '10px', fontWeight: 700 }}>
                                                    {(form.docIds || []).length}
                                                </span>
                                            )}
                                        </label>
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                            {dossierDocs.map(doc => (
                                                <label key={doc.id} className="efm-doc-row" style={{ background: (form.docIds || []).includes(doc.id) ? C.light : undefined }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={(form.docIds || []).includes(doc.id)}
                                                        onChange={() => toggleDoc(f.IDFactures, doc.id)}
                                                        style={{ accentColor: C.accent, width: 15, height: 15 }}
                                                    />
                                                    <FileText size={13} style={{ color: (form.docIds || []).includes(doc.id) ? C.accent : '#94a3b8', flexShrink: 0 }} />
                                                    <span style={{ fontSize: '13px', color: '#334155', flex: 1 }}>{doc.title}</span>
                                                    {doc.typeLabel && (
                                                        <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', borderRadius: '4px', padding: '1px 8px' }}>
                                                            {doc.typeLabel}
                                                        </span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Récapitulatif pièces jointes */}
                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.875rem 1rem', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                                    <strong style={{ color: '#0f172a' }}>Pièces jointes :</strong>{' '}
                                    Facture_{f.NumeroFacture.replace(/\//g, '-')}.pdf (principal)
                                    {(form.docIds || []).length > 0 && ` + ${(form.docIds || []).length} document(s) du dossier`}
                                </div>

                                {/* Error */}
                                {err && (
                                    <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px', display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <AlertCircle size={15} /> {err}
                                    </div>
                                )}

                                {/* Footer buttons */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                                    <button
                                        onClick={() => setExpanded(null)}
                                        style={{ padding: '.7rem 1.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '.75rem', fontWeight: 600, color: '#64748b', cursor: 'pointer', fontSize: '14px' }}
                                    >
                                        Fermer
                                    </button>
                                    <button
                                        className="efm-send-btn"
                                        disabled={!form.email || isLoading || comptesMails.length === 0}
                                        onClick={() => handleSend(f)}
                                    >
                                        {isLoading
                                            ? <><RefreshCw size={15} style={{ animation: 'spin .8s linear infinite' }} /> Envoi en cours…</>
                                            : <><Send size={15} /> Envoyer la facture</>
                                        }
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
