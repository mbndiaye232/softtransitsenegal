import React, { useState, useEffect } from 'react';
import {
    Download, Save, Clock, Settings as SettingsIcon,
    HardDrive, Play, AlertCircle, CheckCircle2, ArrowLeft,
    RefreshCw, Shield, Database, Folder, RotateCcw, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ── helpers ── */
const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024, dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const formatDate = (dateString) =>
    new Date(dateString).toLocaleString('fr-FR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });

/* ── sub-components ── */
function BlockCard({ gradFrom, gradTo, iconBg, icon, title, children, style = {} }) {
    const grad = `linear-gradient(135deg, ${gradFrom}, ${gradTo})`;
    return (
        <div style={{
            background: 'white', borderRadius: '1.15rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
            overflow: 'hidden', ...style
        }}>
            <div style={{ background: grad, padding: '0.9rem 1.35rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>{title}</span>
            </div>
            <div style={{ padding: '1.5rem' }}>{children}</div>
        </div>
    );
}

function Toggle({ checked, onChange }) {
    return (
        <div
            onClick={onChange}
            style={{
                width: '48px', height: '26px', borderRadius: '99px', cursor: 'pointer',
                background: checked ? 'linear-gradient(135deg,#1e3a8a,#3b82f6)' : '#cbd5e1',
                position: 'relative', transition: 'background 0.3s', flexShrink: 0,
                boxShadow: checked ? '0 2px 8px rgba(59,130,246,0.4)' : 'none'
            }}
        >
            <div style={{
                position: 'absolute', top: '3px',
                left: checked ? '25px' : '3px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'white', transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
            }} />
        </div>
    );
}

/* ── composant principal ── */
export default function BackupManager() {
    const navigate = useNavigate();
    const [config, setConfig] = useState({
        backup_directory: '',
        auto_backup_enabled: false,
        frequency_hours: 6,
        retain_count: 10
    });
    const [history, setHistory]               = useState([]);
    const [isLoading, setIsLoading]           = useState(true);
    const [isSaving, setIsSaving]             = useState(false);
    const [isRunningBackup, setIsRunningBackup] = useState(false);
    const [message, setMessage]               = useState({ type: '', text: '' });
    const [hoveredRow, setHoveredRow]         = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [configRes, historyRes] = await Promise.all([
                api.get('/backups/config'),
                api.get('/backups/history')
            ]);
            if (configRes.data) {
                setConfig({
                    backup_directory: configRes.data.backup_directory || '',
                    auto_backup_enabled: !!configRes.data.auto_backup_enabled,
                    frequency_hours: configRes.data.frequency_hours || 6,
                    retain_count: configRes.data.retain_count || 10
                });
            }
            setHistory(historyRes.data || []);
        } catch (error) {
            setMessage({ type: 'error', text: 'Impossible de charger la configuration de sauvegarde.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfigChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfig(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const saveConfig = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            setMessage({ type: '', text: '' });
            await api.put('/backups/config', {
                ...config,
                frequency_hours: parseInt(config.frequency_hours, 10),
                retain_count: parseInt(config.retain_count, 10)
            });
            setMessage({ type: 'success', text: 'Configuration enregistrée avec succès.' });
            await fetchData();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la sauvegarde.' });
        } finally {
            setIsSaving(false);
        }
    };

    const triggerManualBackup = async () => {
        if (!window.confirm("Lancer une sauvegarde maintenant ? L'opération peut prendre quelques instants.")) return;
        try {
            setIsRunningBackup(true);
            setMessage({ type: 'info', text: 'Sauvegarde en cours, veuillez patienter...' });
            await api.post('/backups/trigger');
            setMessage({ type: 'success', text: 'Sauvegarde terminée avec succès !' });
            await fetchData();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Échec de la sauvegarde manuelle.' });
        } finally {
            setIsRunningBackup(false);
        }
    };

    const downloadBackup = (filename) => {
        window.open(`${process.env.VITE_API_URL || 'http://localhost:3001/api'}/backups/download/${filename}`, '_blank');
    };

    const fmtSize = (bytes) => formatBytes(bytes);

    const MSG_STYLE = {
        error:   { bg: '#fee2e2', border: '#fca5a5', color: '#b91c1c', icon: <AlertCircle size={17}/> },
        success: { bg: '#dcfce7', border: '#86efac', color: '#15803d', icon: <CheckCircle2 size={17}/> },
        info:    { bg: '#dbeafe', border: '#bfdbfe', color: '#1d4ed8', icon: <RefreshCw size={17} style={{ animation:'spin 1s linear infinite' }}/> },
    };

    const inputSt = {
        width: '100%', padding: '0.7rem 0.9rem', borderRadius: '0.6rem',
        border: '1px solid #e2e8f0', fontSize: '0.875rem',
        boxSizing: 'border-box', outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        fontFamily: 'system-ui, sans-serif', color: '#1e293b'
    };
    const labelSt = { display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' };

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>

            {/* ── Hero ── */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #1e3a5f 100%)',
                padding: '2rem 2rem 5.5rem',
                position: 'relative', overflow: 'hidden'
            }}>
                <div style={{ position:'absolute', top:'-70px', right:'-70px', width:'280px', height:'280px', borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', bottom:'-40px', left:'35%', width:'180px', height:'180px', borderRadius:'50%', background:'rgba(59,130,246,0.06)', pointerEvents:'none' }} />

                <button
                    onClick={() => navigate('/parameters-hub')}
                    style={{
                        display:'flex', alignItems:'center', gap:'0.45rem',
                        background:'rgba(255,255,255,0.1)', backdropFilter:'blur(8px)',
                        border:'1px solid rgba(255,255,255,0.2)', borderRadius:'0.6rem',
                        padding:'0.45rem 0.85rem', color:'rgba(255,255,255,0.8)',
                        cursor:'pointer', fontSize:'0.8rem', fontWeight:600,
                        marginBottom:'1.75rem', transition:'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
                >
                    <ArrowLeft size={14}/> Retour au Hub
                </button>

                <div style={{ display:'flex', alignItems:'center', gap:'1rem', position:'relative' }}>
                    <div style={{
                        width:'52px', height:'52px', borderRadius:'14px',
                        background:'rgba(255,255,255,0.12)', backdropFilter:'blur(8px)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        border:'1px solid rgba(255,255,255,0.2)'
                    }}>
                        <HardDrive size={26} color="white"/>
                    </div>
                    <div>
                        <h1 style={{ margin:0, fontSize:'1.65rem', fontWeight:900, color:'white', letterSpacing:'-0.02em' }}>
                            Sauvegardes du Système
                        </h1>
                        <p style={{ margin:'0.25rem 0 0', color:'rgba(255,255,255,0.6)', fontSize:'0.875rem' }}>
                            Gérez la rétention des données et synchronisez avec vos dossiers OneDrive/GDrive.
                        </p>
                    </div>

                    {/* Stats dans le hero */}
                    <div style={{ marginLeft:'auto', display:'flex', gap:'0.75rem' }}>
                        <div style={{ background:'rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:'1rem', padding:'0.65rem 1.1rem', textAlign:'center' }}>
                            <div style={{ fontSize:'1.5rem', fontWeight:800, color:'white', lineHeight:1 }}>{history.length}</div>
                            <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.65)', marginTop:'0.15rem' }}>sauvegardes</div>
                        </div>
                        <div style={{ background: config.auto_backup_enabled ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', border:`1px solid ${config.auto_backup_enabled ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.18)'}`, borderRadius:'1rem', padding:'0.65rem 1.1rem', textAlign:'center' }}>
                            <div style={{ fontSize:'0.85rem', fontWeight:800, color: config.auto_backup_enabled ? '#86efac' : 'rgba(255,255,255,0.5)', lineHeight:1 }}>
                                {config.auto_backup_enabled ? '⏱ Auto' : '⏸ Manuel'}
                            </div>
                            <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.55)', marginTop:'0.15rem' }}>mode</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Contenu flottant ── */}
            <div style={{ maxWidth:'1280px', margin:'-48px auto 0', padding:'0 2rem 3rem', position:'relative', zIndex:10 }}>

                {/* Toast message */}
                {message.text && (() => {
                    const m = MSG_STYLE[message.type] || MSG_STYLE.info;
                    return (
                        <div style={{ background:m.bg, border:`1px solid ${m.border}`, borderRadius:'0.9rem', padding:'0.85rem 1.1rem', display:'flex', alignItems:'center', gap:'0.65rem', marginBottom:'1.25rem', color:m.color, fontSize:'0.875rem', fontWeight:500 }}>
                            {m.icon} {message.text}
                        </div>
                    );
                })()}

                {isLoading ? (
                    <div style={{ background:'white', borderRadius:'1.15rem', border:'1px solid #e2e8f0', boxShadow:'0 20px 60px rgba(0,0,0,0.08)', padding:'4rem 2rem', textAlign:'center' }}>
                        <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:'linear-gradient(135deg,#0f172a,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem', animation:'spin 1s linear infinite', boxShadow:'0 4px 16px rgba(59,130,246,0.3)' }}>
                            <RefreshCw size={22} color="white"/>
                        </div>
                        <p style={{ color:'#64748b', margin:0 }}>Chargement de la configuration…</p>
                    </div>
                ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.35rem', alignItems:'start' }}>

                        {/* ── Colonne gauche : Action + Historique ── */}
                        <div style={{ display:'flex', flexDirection:'column', gap:'1.35rem' }}>

                            {/* Bloc Lancer sauvegarde */}
                            <BlockCard
                                gradFrom="#047857" gradTo="#10b981"
                                icon={<Database size={17} color="white"/>}
                                title="Sauvegarde Manuelle"
                            >
                                <button
                                    onClick={triggerManualBackup}
                                    disabled={isRunningBackup || !config.backup_directory}
                                    style={{
                                        display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem',
                                        width:'100%', padding:'1.1rem',
                                        background: (isRunningBackup || !config.backup_directory)
                                            ? 'linear-gradient(135deg,#94a3b8,#cbd5e1)'
                                            : 'linear-gradient(135deg,#047857,#10b981)',
                                        color:'white', border:'none', borderRadius:'0.85rem',
                                        fontSize:'1rem', fontWeight:700, cursor: (isRunningBackup || !config.backup_directory) ? 'not-allowed' : 'pointer',
                                        transition:'all 0.25s',
                                        boxShadow: (isRunningBackup || !config.backup_directory) ? 'none' : '0 6px 20px rgba(5,150,105,0.35)',
                                        marginBottom:'0.85rem'
                                    }}
                                    onMouseEnter={e => { if (!isRunningBackup && config.backup_directory) { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 28px rgba(5,150,105,0.45)' }}}
                                    onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 6px 20px rgba(5,150,105,0.35)' }}
                                >
                                    {isRunningBackup
                                        ? <><RefreshCw size={22} style={{ animation:'spin 1s linear infinite' }}/> Création de la sauvegarde…</>
                                        : <><Play size={22}/> Lancer la sauvegarde maintenant</>
                                    }
                                </button>

                                {!config.backup_directory && (
                                    <div style={{ background:'#fef9c3', border:'1px solid #fde68a', borderRadius:'0.6rem', padding:'0.65rem 0.85rem', fontSize:'0.8rem', color:'#92400e', display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                                        <AlertCircle size={14}/> Configurez d'abord un répertoire de destination.
                                    </div>
                                )}

                                <p style={{ textAlign:'center', fontSize:'0.8rem', color:'#94a3b8', margin:0 }}>
                                    Compile la base de données et tous les documents attachés en un fichier ZIP unique.
                                </p>
                            </BlockCard>

                            {/* Bloc Historique */}
                            <BlockCard
                                gradFrom="#1e3a8a" gradTo="#3b82f6"
                                icon={<Clock size={17} color="white"/>}
                                title="Historique Récent"
                            >
                                {history.length === 0 ? (
                                    <div style={{ textAlign:'center', padding:'2rem 1rem', color:'#94a3b8' }}>
                                        <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
                                            <HardDrive size={24} style={{ opacity:0.3 }}/>
                                        </div>
                                        <p style={{ margin:0, fontSize:'0.875rem', fontWeight:500 }}>Aucune sauvegarde trouvée dans le répertoire.</p>
                                        <p style={{ margin:'0.4rem 0 0', fontSize:'0.78rem' }}>Lancez votre première sauvegarde manuelle ci-dessus.</p>
                                    </div>
                                ) : (
                                    <div style={{ margin:'-0.25rem 0' }}>
                                        {history.map((file, i) => {
                                            const hov = hoveredRow === i;
                                            return (
                                                <div key={i}
                                                    onMouseEnter={() => setHoveredRow(i)}
                                                    onMouseLeave={() => setHoveredRow(null)}
                                                    style={{
                                                        display:'flex', alignItems:'center', justifyContent:'space-between',
                                                        padding:'0.85rem 0',
                                                        borderBottom: i < history.length-1 ? '1px solid #f1f5f9' : 'none',
                                                        transition:'background 0.15s',
                                                        background: hov ? '#f0f9ff' : 'transparent',
                                                        borderRadius:'0.5rem', margin:'0 -0.5rem', paddingLeft:'0.5rem', paddingRight:'0.5rem'
                                                    }}
                                                >
                                                    <div style={{ display:'flex', alignItems:'center', gap:'0.85rem' }}>
                                                        <div style={{ width:'36px', height:'36px', borderRadius:'9px', background: hov ? '#dbeafe' : '#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s', flexShrink:0 }}>
                                                            <Save size={16} color={hov ? '#2563eb' : '#94a3b8'}/>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight:600, fontSize:'0.83rem', color:'#1e293b', fontFamily:'monospace' }}>{file.filename}</div>
                                                            <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:'2px' }}>
                                                                {formatDate(file.createdAt)} · {fmtSize(file.size)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => downloadBackup(file.filename)}
                                                        style={{
                                                            display:'inline-flex', alignItems:'center', gap:'0.3rem',
                                                            padding:'0.35rem 0.75rem', fontSize:'0.75rem', fontWeight:700,
                                                            color: hov ? 'white' : '#2563eb',
                                                            background: hov ? 'linear-gradient(135deg,#1d4ed8,#3b82f6)' : '#eff6ff',
                                                            border:'none', borderRadius:'0.5rem', cursor:'pointer',
                                                            transition:'all 0.2s',
                                                            boxShadow: hov ? '0 4px 10px rgba(37,99,235,0.3)' : 'none'
                                                        }}
                                                    >
                                                        <Download size={13}/> Télécharger
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </BlockCard>
                        </div>

                        {/* ── Colonne droite : Configuration ── */}
                        <form onSubmit={saveConfig}>
                            <BlockCard
                                gradFrom="#334155" gradTo="#64748b"
                                icon={<SettingsIcon size={17} color="white"/>}
                                title="Paramètres de Sauvegarde"
                            >
                                {/* Toggle planification auto */}
                                <div style={{
                                    display:'flex', alignItems:'center', justifyContent:'space-between',
                                    padding:'1rem 1.1rem', borderRadius:'0.85rem',
                                    background: config.auto_backup_enabled ? '#f0fdf4' : '#f8fafc',
                                    border: `1px solid ${config.auto_backup_enabled ? '#a7f3d0' : '#e2e8f0'}`,
                                    marginBottom:'1.5rem', transition:'all 0.3s'
                                }}>
                                    <div>
                                        <div style={{ fontWeight:700, fontSize:'0.9rem', color:'#1e293b' }}>Planification Automatique</div>
                                        <div style={{ fontSize:'0.78rem', color:'#64748b', marginTop:'2px' }}>
                                            {config.auto_backup_enabled ? '✅ Actif — sauvegarde automatique en tâche de fond.' : 'Activez pour sauvegarder automatiquement en tâche de fond.'}
                                        </div>
                                    </div>
                                    <Toggle
                                        checked={config.auto_backup_enabled}
                                        onChange={() => setConfig(p => ({ ...p, auto_backup_enabled: !p.auto_backup_enabled }))}
                                    />
                                </div>

                                {/* Fréquence (si auto activé) */}
                                {config.auto_backup_enabled && (
                                    <div style={{ marginBottom:'1.35rem' }}>
                                        <label style={labelSt}>Fréquence (Heures)</label>
                                        <input type="number" name="frequency_hours" value={config.frequency_hours}
                                            onChange={handleConfigChange} min="1" max="168"
                                            style={inputSt}
                                            onFocus={e => { e.target.style.borderColor='#3b82f6'; e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.12)' }}
                                            onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none' }}
                                        />
                                        <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'0.3rem' }}>
                                            Effectue une sauvegarde toutes les <strong>{config.frequency_hours}h</strong>. Recommandé : 6h.
                                        </div>
                                    </div>
                                )}

                                {/* Répertoire */}
                                <div style={{ marginBottom:'1.35rem' }}>
                                    <label style={labelSt}>
                                        <Folder size={13} style={{ display:'inline', marginRight:'5px', verticalAlign:'middle' }}/>
                                        Répertoire de destination
                                    </label>
                                    <input type="text" name="backup_directory" value={config.backup_directory}
                                        onChange={handleConfigChange} required
                                        placeholder="Ex: C:/Users/Admin/Google Drive/SoftTransitBackups"
                                        style={inputSt}
                                        onFocus={e => { e.target.style.borderColor='#3b82f6'; e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.12)' }}
                                        onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none' }}
                                    />
                                    <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'0.6rem', padding:'0.65rem 0.85rem', marginTop:'0.5rem', fontSize:'0.77rem', color:'#64748b', lineHeight:1.6 }}>
                                        <Info size={12} style={{ display:'inline', marginRight:'4px', verticalAlign:'middle', color:'#3b82f6' }}/>
                                        Chemin absolu sur le serveur. Pour <strong>OneDrive</strong>, <strong>Google Drive</strong> ou <strong>Dropbox</strong>, indiquez le chemin de synchronisation. Pour un VPS, le répertoire de stockage des .zip.
                                    </div>
                                </div>

                                {/* Limite conservation */}
                                <div style={{ marginBottom:'1.75rem' }}>
                                    <label style={labelSt}>
                                        <RotateCcw size={13} style={{ display:'inline', marginRight:'5px', verticalAlign:'middle' }}/>
                                        Limite de conservation (Fichiers)
                                    </label>
                                    <input type="number" name="retain_count" value={config.retain_count}
                                        onChange={handleConfigChange} min="1" max="100"
                                        style={inputSt}
                                        onFocus={e => { e.target.style.borderColor='#3b82f6'; e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.12)' }}
                                        onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none' }}
                                    />
                                    <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'0.3rem' }}>
                                        Maximum <strong>{config.retain_count} fichiers</strong> conservés. Les plus anciennes sauvegardes seront supprimées automatiquement.
                                    </div>
                                </div>

                                {/* Bouton enregistrer */}
                                <button type="submit" disabled={isSaving} style={{
                                    display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
                                    width:'100%', padding:'0.95rem',
                                    background: isSaving ? 'linear-gradient(135deg,#94a3b8,#cbd5e1)' : 'linear-gradient(135deg,#0f172a,#334155)',
                                    color:'white', border:'none', borderRadius:'0.85rem',
                                    fontWeight:700, fontSize:'0.9rem', cursor: isSaving ? 'not-allowed' : 'pointer',
                                    transition:'all 0.2s',
                                    boxShadow: isSaving ? 'none' : '0 4px 16px rgba(15,23,42,0.25)'
                                }}>
                                    {isSaving
                                        ? <><RefreshCw size={17} style={{ animation:'spin 1s linear infinite' }}/> Enregistrement…</>
                                        : <><Save size={17}/> Enregistrer la configuration</>
                                    }
                                </button>
                            </BlockCard>
                        </form>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (max-width: 900px) {
                    .bm-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}
