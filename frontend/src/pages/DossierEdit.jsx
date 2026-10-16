import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dossiersAPI, clientsAPI, authAPI, documentsAPI } from '../services/api';
import CotationManager from '../components/dossiers/CotationManager';
import OrdreTransitManager from '../components/dossiers/OrdreTransitManager';
import TransportManager from '../components/dossiers/TransportManager';
import TitreTransportManager from '../components/dossiers/TitreTransportManager';
import CompositionTransportManager from '../components/dossiers/CompositionTransportManager';
import OrdreTransportManager from '../components/dossiers/OrdreTransportManager';
import DeclarationManager from '../components/dossiers/DeclarationManager';
import MiseEnLivraisonManager from '../components/dossiers/MiseEnLivraisonManager';
import BordereauLivraisonManager from '../components/dossiers/BordereauLivraisonManager';
import FacturationManager from '../components/dossiers/FacturationManager';
import EnvoiFacturesManager from '../components/dossiers/EnvoiFacturesManager';
import DevisManager from '../components/dossiers/DevisManager';
import FacturesTiersManager from '../components/dossiers/FacturesTiersManager';
import DossierReglementsManager from '../components/dossiers/DossierReglementsManager';
import {
    Save, X, Link as LinkIcon, FileText, User, Phone, Mail, Info,
    Settings, CheckCircle, Building2, Briefcase, FileSearch,
    ChevronLeft, Shield, Package, Truck, CreditCard, FileCheck2,
    Eye, Ship, Plane, Hash, Calendar, ArrowLeft
} from 'lucide-react';

/* ─── Mode config (same as DossierList) ─────────────────────────────────── */
const MODE_CONFIG = {
    MA: { label: 'Maritime', icon: <Ship size={13} />,  bg: '#dbeafe', color: '#1d4ed8', grad: '#1e40af' },
    AE: { label: 'Aérien',   icon: <Plane size={13} />, bg: '#ede9fe', color: '#7c3aed', grad: '#5b21b6' },
    TE: { label: 'Routier',  icon: <Truck size={13} />, bg: '#ffedd5', color: '#c2410c', grad: '#9a3412' },
}
const modeConf = (m) => MODE_CONFIG[m] || { label: m || '—', icon: <FileText size={13} />, bg: '#f3f4f6', color: '#6b7280', grad: '#374151' }

const NATURE_LABELS = { IMP: 'Importation', EXP: 'Exportation' }
const TYPE_LABELS   = { TC: 'Conteneur', GR: 'Groupage', CO: 'Conventionnel' }

/* ─── MetaBadge ─────────────────────────────────────────────────────────── */
const MetaBadge = ({ icon, label, color = '#fff', opacity = 0.8 }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(6px)',
        borderRadius: '99px', padding: '5px 12px',
        fontSize: '12px', fontWeight: 700, color,
        border: '1px solid rgba(255,255,255,.18)',
    }}>
        <span style={{ opacity }}>{icon}</span>
        <span style={{ opacity }}>{label}</span>
    </div>
)

const DossierEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { canView } = useAuth();
    const [loading, setLoading]       = useState(true);
    const [clients, setClients]       = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [dossierInfo, setDossierInfo] = useState(null);
    const [documents, setDocuments]   = useState([]);
    const [saving, setSaving]         = useState(false);

    const [form, setForm] = useState({
        label: '', nature: 'IMP', mode: 'MA', type: 'TC',
        description: '', contactId: '', isFacturable: false, dpiNumber: '',
        quotationStep: false, contactName: '', contactPhone: '',
        contactEmail: '', observations: '', clientId: '', dateRemiseDocs: ''
    });

    const [editCode, setEditCode] = useState(false);
    const [file, setFile]         = useState(null);
    const [error, setError]       = useState(null);
    const [activeTab, setActiveTab] = useState('detail');

    const allTabs = [
        { id: 'detail',             label: 'Détails',         icon: <Info size={13} />,        perm: 'DOSSIER_DETAILS' },
        { id: 'cotation',           label: 'Cotation',        icon: <Briefcase size={13} />,   perm: 'DOSSIER_COTATION' },
        { id: 'ot',                 label: 'OT (Transit)',    icon: <FileText size={13} />,    perm: 'DOSSIER_OT' },
        { id: 'titre_transport',    label: 'TT (Titre)',      icon: <FileText size={13} />,    perm: 'DOSSIER_TT' },
        { id: 'transport',          label: 'Transports',      icon: <LinkIcon size={13} />,    perm: 'DOSSIER_TRANSPORTS' },
        { id: 'composition',        label: 'Composition',     icon: <Package size={13} />,     perm: 'DOSSIER_COMPOSITION' },
        { id: 'notes_detail',       label: 'Notes de détail', icon: <FileSearch size={13} />,  perm: 'DOSSIER_NOTES',     navigate: true },
        { id: 'declaration',        label: 'Déclaration',     icon: <Shield size={13} />,      perm: 'DOSSIER_DECLARATION' },
        { id: 'mise_livraison',     label: 'Mise en Liv.',    icon: <Truck size={13} />,       perm: 'DOSSIER_LIVRAISON' },
        { id: 'ordre-transport',    label: 'OTR (Transp.)',   icon: <Truck size={13} />,       perm: 'DOSSIER_OTR' },
        { id: 'bordereau_livraison',label: 'BL (Bordereau)',  icon: <FileText size={13} />,    perm: 'DOSSIER_BL' },
        { id: 'devis',              label: 'Devis',           icon: <FileCheck2 size={13} />,  perm: 'DOSSIER_DEVIS' },
        { id: 'factures_tiers',     label: 'Factures Tiers',  icon: <Building2 size={13} />,   perm: 'DOSSIER_FACTURES_TIERS' },
        { id: 'facturation',        label: 'Facturation',     icon: <CreditCard size={13} />,  perm: 'DOSSIER_FACTURATION' },
        { id: 'envoi_factures',     label: 'Envoi Factures',  icon: <Mail size={13} />,        perm: 'DOSSIER_ENVOI_FACTURES' },
        { id: 'reglements',         label: 'Règlements',      icon: <CheckCircle size={13} />, perm: 'DOSSIER_REGLEMENTS' },
    ];
    const tabs = allTabs.filter(t => canView(t.perm));

    // Si l'onglet actif n'est plus visible (permissions changées), se repositionner sur le premier visible
    useEffect(() => {
        if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
            setActiveTab(tabs[0].id)
        }
    }, [tabs.length]) // eslint-disable-line

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [dossierRes, clientsRes, userRes, docsRes] = await Promise.all([
                    dossiersAPI.getOne(id),
                    clientsAPI.getAll(),
                    authAPI.getMe(),
                    documentsAPI.getByDossier(id).catch(() => ({ data: [] }))
                ]);
                const data = dossierRes.data;
                setDossierInfo(data);
                setClients(clientsRes.data);
                setCurrentUser(userRes.data);
                setDocuments(docsRes.data || []);
                setForm({
                    label: data.label,
                    nature: data.nature,
                    mode: data.mode,
                    type: data.type,
                    description: data.description || '',
                    contactId: data.contactId || '',
                    isFacturable: data.isFacturable === 1 || data.isFacturable === true,
                    dpiNumber: data.dpiNumber || '',
                    quotationStep: data.quotationStep === 1 || data.quotationStep === true,
                    contactName: data.contactName || '',
                    contactPhone: data.contactPhone || '',
                    contactEmail: data.contactEmail || '',
                    observations: data.observations || '',
                    clientId: data.clientId || '',
                    dateRemiseDocs: data.dateRemiseDocs ? data.dateRemiseDocs.split('T')[0] : ''
                });
            } catch (err) {
                console.error('Fetch data error:', err);
                setError('Échec du chargement des données du dossier');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const formData = new FormData();
            Object.keys(form).forEach(key => formData.append(key, form[key]));
            formData.append('editCode', editCode);
            if (file) formData.append('file', file);
            await dossiersAPI.update(id, formData);
            navigate('/dossiers');
        } catch (err) {
            setError(err.response?.data?.error || 'Échec de la mise à jour');
        } finally {
            setSaving(false);
        }
    };

    /* ── Loading ── */
    if (loading) return (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#fffbeb' }}>
            <div style={{ textAlign:'center' }}>
                <div style={{ width:44, height:44, border:'3px solid #fde68a', borderTopColor:'#f59e0b', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 12px' }} />
                <div style={{ fontSize:14, color:'#92400e', fontWeight:600 }}>Chargement du dossier…</div>
            </div>
            <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
        </div>
    );

    const clientName = clients.find(c => c.IDCLIENTS === form.clientId)?.NomClient
        || dossierInfo?.clientName || dossierInfo?.NomClient || 'Client inconnu';
    const mc = modeConf(form.mode);

    return (
        <div style={{ minHeight:'100vh', background:'#fffbeb', fontFamily:'inherit' }}>

            {/* ── Hero Banner ────────────────────────────────────────────── */}
            <div style={{
                background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #f59e0b 100%)',
                padding: '28px 40px 70px',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* decorative circles */}
                <div style={{ position:'absolute', top:-60, right:-60, width:220, height:220, background:'rgba(255,255,255,.06)', borderRadius:'50%' }} />
                <div style={{ position:'absolute', bottom:-40, right:140, width:120, height:120, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />

                {/* back link */}
                <button
                    onClick={() => navigate('/dossiers')}
                    style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', borderRadius:99, padding:'6px 14px', color:'white', fontSize:12, fontWeight:700, cursor:'pointer', marginBottom:20, backdropFilter:'blur(6px)' }}
                >
                    <ArrowLeft size={14} /> Retour à la liste
                </button>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:20, flexWrap:'wrap' }}>
                    <div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                            <MetaBadge icon={mc.icon} label={mc.label} />
                            <MetaBadge icon={<Hash size={12}/>} label={NATURE_LABELS[form.nature] || form.nature} />
                            <MetaBadge icon={<Package size={12}/>} label={TYPE_LABELS[form.type] || form.type} />
                        </div>
                        <h1 style={{ margin:0, fontSize:26, fontWeight:900, color:'white', letterSpacing:'-.01em' }}>
                            Modifier le Dossier
                        </h1>
                        <div style={{ fontSize:20, fontWeight:800, color:'rgba(255,255,255,.85)', marginTop:4, fontFamily:'monospace', letterSpacing:'.02em' }}>
                            {dossierInfo?.code}
                        </div>
                        <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
                            <Building2 size={14} color="rgba(255,255,255,.7)" />
                            <span style={{ fontSize:14, color:'rgba(255,255,255,.85)', fontWeight:600 }}>{clientName}</span>
                        </div>
                    </div>
                    <div style={{ background:'rgba(255,255,255,.12)', borderRadius:16, padding:'12px 20px', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,.2)', textAlign:'right' }}>
                        <div style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:'.1em' }}>Code Court</div>
                        <div style={{ fontSize:20, fontWeight:900, color:'white', fontFamily:'monospace', marginTop:4 }}>{dossierInfo?.shortCode}</div>
                    </div>
                </div>
            </div>

            {/* ── Floating content card ───────────────────────────────────── */}
            <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 32px 48px', marginTop:'-44px', position:'relative', zIndex:1 }}>

                {/* ── Tab bar ── */}
                <div style={{
                    display:'flex', flexWrap:'wrap', gap:4, background:'white', padding:6, borderRadius:16,
                    border:'1px solid #e5e7eb', boxShadow:'0 8px 24px rgba(0,0,0,.10)',
                    marginBottom:24,
                }}>
                    <style>{`::-webkit-scrollbar{display:none}`}</style>
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => tab.navigate
                                    ? navigate('/notes', { state: { preselectedDossierId: id, preselectedClientId: form.clientId } })
                                    : setActiveTab(tab.id)
                                }
                                style={{
                                    display:'flex', alignItems:'center', gap:6,
                                    padding:'9px 14px', borderRadius:10, border:'none', cursor:'pointer',
                                    fontSize:13, fontWeight:700, whiteSpace:'nowrap',
                                    transition:'all .15s',
                                    background: isActive ? 'linear-gradient(135deg,#b45309,#f59e0b)' : 'transparent',
                                    color: isActive ? 'white' : '#6b7280',
                                    boxShadow: isActive ? '0 4px 12px rgba(245,158,11,.35)' : 'none',
                                }}
                            >
                                {tab.icon}{tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Detail tab ─────────────────────────────────────────── */}
                {activeTab === 'detail' && (
                    <form onSubmit={handleSubmit}>
                        {error && (
                            <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:12, padding:'12px 18px', color:'#be123c', fontWeight:600, marginBottom:20, fontSize:14 }}>
                                {error}
                            </div>
                        )}

                        {/* ── Section: Identification & Type ── */}
                        <FormSection icon={<FileSearch size={15}/>} title="Identification & Type">
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:20 }}>
                                <Field label="Libellé du dossier" span={4}>
                                    <PInput name="label" value={form.label} onChange={handleChange} required placeholder="Libellé…" />
                                </Field>
                                <Field label="Date Remise Docs" span={2}>
                                    <PInput type="date" name="dateRemiseDocs" value={form.dateRemiseDocs} onChange={handleChange} />
                                </Field>
                                <Field label="Nature" span={2}>
                                    <PSelect name="nature" value={form.nature} onChange={handleChange} disabled={!editCode}>
                                        <option value="IMP">Importation</option>
                                        <option value="EXP">Exportation</option>
                                    </PSelect>
                                </Field>
                                <Field label="Expédition" span={2}>
                                    <PSelect name="mode" value={form.mode} onChange={handleChange} disabled={!editCode}>
                                        <option value="MA">Maritime</option>
                                        <option value="AE">Aérien</option>
                                        <option value="TE">Terrestre</option>
                                    </PSelect>
                                </Field>
                                <Field label="Type" span={1}>
                                    <PSelect name="type" value={form.type} onChange={handleChange} disabled={!editCode}>
                                        <option value="TC">Conteneur</option>
                                        <option value="GR">Groupage</option>
                                        <option value="CO">Conv.</option>
                                    </PSelect>
                                </Field>
                                <Field label="Document" span={1}>
                                    <PInput readOnly value={form.mode === 'MA' ? 'BL' : form.mode === 'AE' ? 'LTA' : 'LVI'} />
                                </Field>
                            </div>
                        </FormSection>

                        {/* ── Section: Validation & Fiches ── */}
                        <FormSection icon={<Shield size={15}/>} title="Validation & Fiches">
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:20 }}>
                                <Field label="Numéro de dossier" span={4}>
                                    <div style={{ display:'flex', gap:8 }}>
                                        <PInput readOnly value={dossierInfo?.code || ''} style={{ flex:1 }} />
                                        <button
                                            type="button"
                                            title="Débloquer les champs du code"
                                            onClick={() => setEditCode(!editCode)}
                                            style={{
                                                padding:'0 12px', borderRadius:10, border:'none', cursor:'pointer',
                                                transition:'all .15s', flexShrink:0,
                                                background: editCode ? 'linear-gradient(135deg,#b45309,#f59e0b)' : '#f1f5f9',
                                                color: editCode ? 'white' : '#64748b',
                                                boxShadow: editCode ? '0 4px 12px rgba(245,158,11,.35)' : 'none',
                                            }}
                                        >
                                            <Settings size={15} />
                                        </button>
                                    </div>
                                </Field>
                                <Field label="Validé par" span={4}>
                                    <PInput readOnly value={currentUser?.name || ''} />
                                </Field>
                                <Field label="Fiche Dossier (Scan)" span={4}>
                                    <input
                                        type="file"
                                        onChange={e => setFile(e.target.files[0])}
                                        style={{ width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, background:'#f8fafc', cursor:'pointer' }}
                                    />
                                    {dossierInfo?.fileUrl && (
                                        <a
                                            href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${dossierInfo.fileUrl}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ display:'flex', alignItems:'center', gap:4, color:'#b45309', fontWeight:600, fontSize:12, marginTop:6, textDecoration:'none' }}
                                        >
                                            <LinkIcon size={11} /> Voir la fiche actuelle
                                        </a>
                                    )}
                                </Field>
                            </div>
                        </FormSection>

                        {/* ── Section: Contact & Suivi ── */}
                        <FormSection icon={<User size={15}/>} title="Contact & Suivi">
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:20 }}>
                                <Field label="Point focal" span={4}>
                                    <PInput name="contactName" value={form.contactName} onChange={handleChange} placeholder="Nom du contact…" />
                                </Field>
                                <Field label="Téléphone" span={4}>
                                    <PInput name="contactPhone" value={form.contactPhone} onChange={handleChange} placeholder="+221…" />
                                </Field>
                                <Field label="Email" span={4}>
                                    <PInput name="contactEmail" value={form.contactEmail} onChange={handleChange} placeholder="email@domaine.com" />
                                </Field>
                                <Field label="Observations / Notes" span={12}>
                                    <textarea
                                        name="observations"
                                        rows={3}
                                        value={form.observations}
                                        onChange={handleChange}
                                        placeholder="Commentaires internes…"
                                        style={{
                                            width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10,
                                            fontSize:13, background:'#f8fafc', outline:'none', resize:'vertical',
                                            fontFamily:'inherit', transition:'border-color .15s, box-shadow .15s',
                                            boxSizing:'border-box',
                                        }}
                                        onFocus={e => { e.target.style.borderColor='#f59e0b'; e.target.style.boxShadow='0 0 0 3px rgba(245,158,11,.15)'; e.target.style.background='white'; }}
                                        onBlur={e => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; e.target.style.background='#f8fafc'; }}
                                    />
                                </Field>
                            </div>
                        </FormSection>

                        {/* ── Toggle cards ── */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, marginBottom:24 }}>
                            <CheckCard
                                label="Prêt pour facturation"
                                desc="Marquer comme éligible à la clôture financière"
                                checked={form.isFacturable}
                                onChange={() => handleChange({ target:{ name:'isFacturable', type:'checkbox', checked:!form.isFacturable } })}
                            />
                            <CheckCard
                                label="Étape de Cotation"
                                desc="Requiert l'imputation d'un déclarant"
                                checked={form.quotationStep}
                                onChange={() => handleChange({ target:{ name:'quotationStep', type:'checkbox', checked:!form.quotationStep } })}
                            />
                        </div>

                        {/* ── Documents ── */}
                        {documents.length > 0 && (
                            <FormSection icon={<FileText size={15}/>} title="Documents Associés au Dossier">
                                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                    {documents.map(doc => (
                                        <div key={doc.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:12 }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                                                <div style={{ padding:10, background:'white', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,.08)' }}>
                                                    <FileText size={18} color="#b45309" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight:700, color:'#111827', fontSize:14 }}>{doc.label || doc.type}</div>
                                                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                                                        {doc.number ? `N° ${doc.number} • ` : ''}
                                                        Ajouté le {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const res = await documentsAPI.view(doc.id);
                                                        const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
                                                        const url = window.URL.createObjectURL(blob);
                                                        window.open(url, '_blank');
                                                    } catch (e) {
                                                        alert('Impossible d\'ouvrir le document');
                                                    }
                                                }}
                                                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'1px solid #e5e7eb', background:'white', color:'#374151', fontWeight:600, fontSize:13, cursor:'pointer' }}
                                            >
                                                <Eye size={14}/> Consulter
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </FormSection>
                        )}

                        {/* ── Footer ── */}
                        <div style={{ display:'flex', justifyContent:'flex-end', gap:12, paddingTop:8 }}>
                            <button
                                type="button"
                                onClick={() => navigate('/dossiers')}
                                style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 24px', borderRadius:12, border:'1px solid #e5e7eb', background:'white', color:'#374151', fontWeight:700, fontSize:14, cursor:'pointer' }}
                            >
                                <X size={16}/> Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                style={{
                                    display:'flex', alignItems:'center', gap:8,
                                    padding:'11px 28px', borderRadius:12, border:'none',
                                    background: saving ? '#d97706' : 'linear-gradient(135deg,#b45309,#f59e0b)',
                                    color:'white', fontWeight:700, fontSize:14, cursor: saving ? 'not-allowed' : 'pointer',
                                    boxShadow:'0 4px 14px rgba(245,158,11,.4)',
                                    transition:'all .15s',
                                }}
                            >
                                <Save size={16}/> {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ── Sub-managers ─────────────────────────────────────────── */}
                {activeTab !== 'detail' && (
                    <div style={{ background:'white', borderRadius:20, border:'1px solid #e5e7eb', boxShadow:'0 4px 16px rgba(0,0,0,.06)', padding:8, overflow:'hidden' }}>
                        {activeTab === 'cotation'            && <CotationManager dossierId={id} />}
                        {activeTab === 'ot'                  && <OrdreTransitManager dossierId={id} />}
                        {activeTab === 'titre_transport'     && <TitreTransportManager dossierId={id} />}
                        {activeTab === 'transport'           && <TransportManager dossierId={id} />}
                        {activeTab === 'composition'         && <CompositionTransportManager dossierId={id} dossierType={dossierInfo?.type} />}
                        {activeTab === 'ordre-transport'     && <OrdreTransportManager dossierId={id} />}
                        {activeTab === 'declaration'         && <DeclarationManager dossierId={id} />}
                        {activeTab === 'mise_livraison'      && <MiseEnLivraisonManager dossierId={id} />}
                        {activeTab === 'bordereau_livraison' && <BordereauLivraisonManager dossierId={id} />}
                        {activeTab === 'devis'               && <DevisManager dossierId={id} />}
                        {activeTab === 'factures_tiers'      && <FacturesTiersManager dossierId={id} />}
                        {activeTab === 'facturation'         && <FacturationManager dossierId={id} />}
                        {activeTab === 'envoi_factures'      && <EnvoiFacturesManager dossierId={id} />}
                        {activeTab === 'reglements'          && <DossierReglementsManager dossierId={id} />}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */

const FormSection = ({ icon, title, children }) => (
    <div style={{ background:'white', borderRadius:20, border:'1px solid #e5e7eb', boxShadow:'0 2px 8px rgba(0,0,0,.05)', padding:'24px 28px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, paddingBottom:14, borderBottom:'1px solid #f1f5f9' }}>
            <div style={{ display:'flex', padding:7, background:'#fffbeb', borderRadius:8, color:'#b45309' }}>{icon}</div>
            <span style={{ fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em' }}>{title}</span>
        </div>
        {children}
    </div>
);

const Field = ({ label, span = 4, children }) => (
    <div style={{ gridColumn:`span ${span}` }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#475569', marginBottom:6 }}>{label}</label>
        {children}
    </div>
);

const inputBase = {
    width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10,
    fontSize:13, background:'#f8fafc', outline:'none', transition:'border-color .15s, box-shadow .15s, background .15s',
    boxSizing:'border-box', fontFamily:'inherit',
};

const PInput = ({ readOnly, style: extraStyle, ...props }) => (
    <input
        {...props}
        readOnly={readOnly}
        style={{
            ...inputBase,
            ...(readOnly ? { background:'#f1f5f9', color:'#94a3b8', borderStyle:'dashed', cursor:'default' } : {}),
            ...extraStyle,
        }}
        onFocus={readOnly ? undefined : e => { e.target.style.borderColor='#f59e0b'; e.target.style.boxShadow='0 0 0 3px rgba(245,158,11,.15)'; e.target.style.background='white'; }}
        onBlur={readOnly ? undefined : e => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; e.target.style.background='#f8fafc'; }}
    />
);

const PSelect = ({ disabled, ...props }) => (
    <select
        {...props}
        disabled={disabled}
        style={{
            ...inputBase,
            cursor: disabled ? 'not-allowed' : 'pointer',
            ...(disabled ? { background:'#f1f5f9', color:'#94a3b8', borderStyle:'dashed' } : {}),
        }}
        onFocus={disabled ? undefined : e => { e.target.style.borderColor='#f59e0b'; e.target.style.boxShadow='0 0 0 3px rgba(245,158,11,.15)'; e.target.style.background='white'; }}
        onBlur={disabled ? undefined : e => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; e.target.style.background='#f8fafc'; }}
    />
);

const CheckCard = ({ label, desc, checked, onChange }) => (
    <div
        onClick={onChange}
        style={{
            display:'flex', alignItems:'center', gap:16, padding:'18px 20px',
            background: checked ? '#fffbeb' : '#f8fafc',
            border: `1.5px solid ${checked ? '#f59e0b' : '#e5e7eb'}`,
            borderRadius:14, cursor:'pointer', transition:'all .15s',
        }}
    >
        <div style={{
            width:22, height:22, borderRadius:6, border:`2px solid ${checked ? '#f59e0b' : '#d1d5db'}`,
            background: checked ? '#f59e0b' : 'white', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s',
        }}>
            {checked && <CheckCircle size={13} color="white" />}
        </div>
        <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{label}</div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{desc}</div>
        </div>
    </div>
);

export default DossierEdit;
