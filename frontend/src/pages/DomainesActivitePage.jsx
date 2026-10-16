import React, { useState, useEffect } from 'react';
import { domainesActiviteAPI } from '../services/api';
import {
    Briefcase,
    Plus,
    Search,
    Edit2,
    Trash2,
    X,
    Check,
    AlertCircle,
    ArrowLeft,
    RefreshCw,
    Tag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DomainesActivitePage() {
    const navigate = useNavigate();
    const [domaines, setDomaines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ LibelleDomaineActivite: '', Code: '' });

    useEffect(() => { loadDomaines(); }, []);

    const loadDomaines = async () => {
        try {
            setLoading(true);
            const response = await domainesActiviteAPI.getAll();
            setDomaines(response.data);
            setError('');
        } catch (err) {
            setError('Erreur lors du chargement des domaines d\'activité');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({ LibelleDomaineActivite: item.LibelleDomaineActivite || '', Code: item.Code || '' });
        } else {
            setEditingItem(null);
            setFormData({ LibelleDomaineActivite: '', Code: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await domainesActiviteAPI.update(editingItem.IDDomaineActivite, formData);
                setSuccess('Domaine mis à jour avec succès');
            } else {
                await domainesActiviteAPI.create(formData);
                setSuccess('Nouveau domaine ajouté');
            }
            setIsModalOpen(false);
            loadDomaines();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer ce domaine ?')) {
            try {
                await domainesActiviteAPI.delete(id);
                setSuccess('Domaine supprimé');
                loadDomaines();
                setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
                setError(err.response?.data?.error || 'Erreur lors de la suppression');
            }
        }
    };

    const filtered = domaines.filter(d =>
        (d.LibelleDomaineActivite || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.Code || '').toLowerCase().includes(search.toLowerCase())
    );

    const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];

    return (
        <div style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh' }}>
            <style>{`
                .da-back { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; background: none; margin-bottom: 1.5rem; transition: color 0.2s; }
                .da-back:hover { color: #4f46e5; }
                .da-header h1 { font-size: 1.875rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.75rem; margin: 0 0 0.5rem; }
                .da-header p { color: #64748b; font-weight: 500; margin: 0 0 2rem; }

                .da-bar { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
                .da-search { position: relative; flex: 1; }
                .da-search input { width: 100%; padding: 0.75rem 1rem 0.75rem 2.75rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; outline: none; font-size: 0.875rem; transition: all 0.2s; }
                .da-search input:focus { border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79,70,229,0.1); }
                .da-search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; }
                .da-btn-add { display: flex; align-items: center; gap: 0.5rem; background: #4f46e5; color: white; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(79,70,229,0.2); }
                .da-btn-add:hover { background: #4338ca; transform: translateY(-1px); }
                .da-btn-refresh { display: flex; align-items: center; justify-content: center; width: 46px; border: 1px solid #e2e8f0; border-radius: 0.75rem; background: white; color: #64748b; cursor: pointer; transition: all 0.2s; }
                .da-btn-refresh:hover { border-color: #4f46e5; color: #4f46e5; }

                .da-table-wrap { background: white; border: 1px solid #e2e8f0; border-radius: 1rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .da-table { width: 100%; border-collapse: collapse; text-align: left; }
                .da-table th { background: #f8fafc; padding: 1rem 1.25rem; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
                .da-table td { padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; font-size: 0.875rem; color: #0f172a; }
                .da-table tr:last-child td { border-bottom: none; }
                .da-table tr:hover td { background: #f8fafc; }

                .da-code { font-family: 'JetBrains Mono', monospace; background: rgba(79,70,229,0.08); color: #4f46e5; padding: 0.25rem 0.625rem; border-radius: 0.375rem; font-weight: 700; font-size: 0.8125rem; letter-spacing: 0.05em; }
                .da-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 0.75rem; }

                .da-actions { display: flex; gap: 0.4rem; justify-content: flex-end; }
                .da-btn-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 0.5rem; border: 1px solid #e2e8f0; background: white; color: #64748b; cursor: pointer; transition: all 0.2s; }
                .da-btn-icon:hover { background: #f8fafc; color: #4f46e5; border-color: #4f46e5; }
                .da-btn-del:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

                .da-alert { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1.5rem; font-size: 0.875rem; font-weight: 600; }
                .da-success { background: #ecfdf5; color: #059669; border: 1px solid #d1fae5; }
                .da-error { background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; }

                .da-empty { text-align: center; padding: 4rem 2rem; }
                .da-empty-icon { width: 64px; height: 64px; background: #f1f5f9; color: #94a3b8; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; }
                .da-empty h3 { font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; }
                .da-empty p { color: #64748b; }

                .da-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
                .da-modal { background: white; border-radius: 1.25rem; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; animation: daSlideUp 0.3s ease-out; }
                @keyframes daSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .da-mhead { padding: 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .da-mhead h2 { font-size: 1.125rem; font-weight: 800; color: #0f172a; margin: 0; }
                .da-mbody { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
                .da-fg label { display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
                .da-input { width: 100%; padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; outline: none; font-size: 0.875rem; background: #f8fafc; transition: all 0.2s; }
                .da-input:focus { border-color: #4f46e5; background: white; box-shadow: 0 0 0 4px rgba(79,70,229,0.1); }
                .da-mfoot { padding: 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem; }
                .da-cancel { padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 700; border: 1px solid #e2e8f0; background: white; color: #64748b; cursor: pointer; }
                .da-cancel:hover { background: #f1f5f9; }
                .da-save { padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 700; background: #4f46e5; color: white; border: none; cursor: pointer; transition: all 0.2s; }
                .da-save:hover { background: #4338ca; transform: translateY(-1px); }
                .da-close { color: #64748b; cursor: pointer; border: none; background: none; }
                .da-close:hover { color: #ef4444; }
            `}</style>

            <button className="da-back" onClick={() => navigate('/parameters-hub')}>
                <ArrowLeft size={16} /> Retour aux paramètres
            </button>

            <div className="da-header">
                <h1><Briefcase size={30} color="#4f46e5" /> Domaines d'Activité</h1>
                <p>Configurez les domaines d'activité : Magasinage, Manutention, Transport, etc.</p>
            </div>

            {error && <div className="da-alert da-error"><AlertCircle size={18} /> {error}</div>}
            {success && <div className="da-alert da-success"><Check size={18} /> {success}</div>}

            <div className="da-bar">
                <div className="da-search">
                    <Search className="da-search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Rechercher un domaine..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className="da-btn-add" onClick={() => handleOpenModal()}>
                    <Plus size={20} /> Nouveau Domaine
                </button>
                <button className="da-btn-refresh" onClick={loadDomaines} title="Actualiser">
                    <RefreshCw size={18} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                </button>
            </div>

            <div className="da-table-wrap">
                <div style={{ overflowX: 'auto' }}>
                    <table className="da-table">
                    <thead>
                        <tr>
                            <th style={{ width: '50%' }}>Libellé</th>
                            <th style={{ width: '25%' }}>Code</th>
                            <th style={{ width: '25%', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</td></tr>
                        ) : filtered.length > 0 ? (
                            filtered.map((item, idx) => (
                                <tr key={item.IDDomaineActivite}>
                                    <td>
                                        <span className="da-dot" style={{ background: COLORS[idx % COLORS.length] }}></span>
                                        <strong>{item.LibelleDomaineActivite}</strong>
                                    </td>
                                    <td>
                                        {item.Code ? <span className="da-code">{item.Code}</span> : <span style={{ color: '#94a3b8' }}>—</span>}
                                    </td>
                                    <td className="da-actions">
                                        <button className="da-btn-icon" onClick={() => handleOpenModal(item)}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="da-btn-icon da-btn-del" onClick={() => handleDelete(item.IDDomaineActivite)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="3">
                                    <div className="da-empty">
                                        <div className="da-empty-icon"><Briefcase size={32} /></div>
                                        <h3>Aucun domaine trouvé</h3>
                                        <p>{search ? `Aucun résultat pour "${search}"` : 'Ajoutez votre premier domaine d\'activité.'}</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="da-overlay">
                    <div className="da-modal">
                        <div className="da-mhead">
                            <h2>{editingItem ? 'Modifier le Domaine' : 'Nouveau Domaine d\'Activité'}</h2>
                            <button className="da-close" onClick={() => setIsModalOpen(false)}><X size={22} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="da-mbody">
                                <div className="da-fg">
                                    <label>Libellé *</label>
                                    <input
                                        className="da-input"
                                        placeholder="Ex: Transport maritime, Manutention..."
                                        value={formData.LibelleDomaineActivite}
                                        onChange={e => setFormData({...formData, LibelleDomaineActivite: e.target.value})}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="da-fg">
                                    <label>Code</label>
                                    <input
                                        className="da-input"
                                        placeholder="Ex: MA, MN, AE, TE..."
                                        maxLength="5"
                                        value={formData.Code}
                                        onChange={e => setFormData({...formData, Code: e.target.value.toUpperCase()})}
                                    />
                                </div>
                            </div>
                            <div className="da-mfoot">
                                <button type="button" className="da-cancel" onClick={() => setIsModalOpen(false)}>Annuler</button>
                                <button type="submit" className="da-save">
                                    {editingItem ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
