import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { groupesAPI } from '../services/api'
import {
    Layers,
    Plus,
    Edit,
    Trash2,
    Users,
    Info,
    ChevronLeft,
    Save,
    RotateCcw,
    Activity,
    MessageSquare,
    Search
} from 'lucide-react'

export default function GroupList() {
    const navigate = useNavigate()
    const [groupes, setGroupes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [searchTerm, setSearchTerm] = useState('')

    // Form state
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({
        LibelleGroupe: '',
        Observations: ''
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadGroupes()
    }, [])

    const loadGroupes = async () => {
        try {
            const response = await groupesAPI.getAll()
            setGroupes(response.data)
        } catch (err) {
            setError('Impossible de charger les groupes')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setSaving(true)

        try {
            if (editingId) {
                await groupesAPI.update(editingId, formData)
                setSuccess('Groupe mis à jour avec succès')
            } else {
                await groupesAPI.create(formData)
                setSuccess('Nouveau groupe créé avec succès')
            }
            setFormData({ LibelleGroupe: '', Observations: '' })
            setEditingId(null)
            loadGroupes()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors de l\'enregistrement')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (groupe) => {
        setEditingId(groupe.IDGroupes)
        setFormData({
            LibelleGroupe: groupe.LibelleGroupe,
            Observations: groupe.Observations || ''
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce groupe ?')) return

        try {
            await groupesAPI.delete(id)
            setSuccess('Groupe supprimé avec succès')
            loadGroupes()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.response?.data?.error || 'Impossible de supprimer le groupe')
            console.error(err)
        }
    }

    const handleCancel = () => {
        setEditingId(null)
        setFormData({ LibelleGroupe: '', Observations: '' })
    }

    const filteredGroupes = groupes.filter(g =>
        g.LibelleGroupe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.Observations?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) return (
        <div className="view-loading">
            <div className="spinner"></div>
            <style>{`
                .view-loading { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: var(--bg); }
                .spinner { width: 40px; height: 40px; border: 3px solid var(--slate-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );

    return (
        <div className="group-wrapper">
            <style>{`
                .group-wrapper { min-height: 100vh; background: var(--bg); padding: 2.5rem; }
                .group-container { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; }
                
                .view-header { display: flex; justify-content: space-between; align-items: flex-end; }
                .title-area h1 { font-size: 1.75rem; font-weight: 800; color: var(--slate-900); display: flex; align-items: center; gap: 0.75rem; margin: 0; letter-spacing: -0.02em; }
                .title-area p { font-size: 0.875rem; color: var(--slate-500); margin: 0.25rem 0 0 0; font-weight: 500; }
                
                .back-btn { display: flex; align-items: center; gap: 0.5rem; color: var(--slate-500); text-decoration: none; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; background: none; margin-bottom: 0.5rem; }
                .back-btn:hover { color: var(--primary); }

                .management-card { background: white; border-radius: var(--radius-xl); border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; }
                .card-strip { padding: 1.25rem 2rem; background: var(--slate-50); border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 0.75rem; }
                .card-strip h2 { font-size: 0.75rem; font-weight: 800; color: var(--slate-400); text-transform: uppercase; letter-spacing: 0.1em; margin: 0; }
                
                .form-body { padding: 2.5rem; }
                .grid-form { display: grid; grid-template-columns: repeat(12, 1fr); gap: 1.5rem; }
                .input-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .input-label { font-size: 0.75rem; font-weight: 700; color: var(--slate-600); }
                
                .premium-input, .premium-textarea { 
                    width: 100%; 
                    padding: 0.75rem 1rem; 
                    border: 1px solid var(--border); 
                    border-radius: var(--radius-md); 
                    font-size: 0.875rem; 
                    outline: none; 
                    background: var(--slate-50); 
                    transition: all 0.2s; 
                }
                .premium-input:focus, .premium-textarea:focus { border-color: var(--primary); background: white; box-shadow: 0 0 0 4px var(--primary-light); }

                .btn { padding: 0.75rem 1.5rem; border-radius: var(--radius-md); font-weight: 700; font-size: 0.875rem; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
                .btn-primary { background: var(--primary); color: white; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); }
                .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
                .btn-secondary { background: white; color: var(--slate-600); border: 1px solid var(--border); }
                .btn-secondary:hover { background: var(--slate-50); }

                .search-box { position: relative; max-width: 320px; }
                .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--slate-400); width: 14px; }
                .search-input { width: 100%; padding: 0.5rem 1rem 0.5rem 2.25rem; border: 1px solid var(--border); border-radius: 999px; font-size: 0.8125rem; outline: none; }

                .list-area { margin-top: 1rem; }
                .premium-table { width: 100%; border-collapse: collapse; }
                .premium-table th { background: var(--slate-50); padding: 1rem 1.5rem; text-align: left; font-size: 0.75rem; font-weight: 800; color: var(--slate-400); text-transform: uppercase; border-bottom: 1px solid var(--border-light); }
                .premium-table td { padding: 1.25rem 1.5rem; font-size: 0.875rem; color: var(--slate-700); border-bottom: 1px solid var(--border-light); }
                .premium-table tr:hover td { background: var(--slate-50); }
                
                .group-tag { display: flex; align-items: center; gap: 0.625rem; }
                .group-icon { background: var(--primary-light); color: var(--primary); padding: 0.5rem; border-radius: 0.75rem; }
                .group-name { font-weight: 800; color: var(--slate-900); }
                
                .user-count { padding: 0.25rem 0.625rem; background: var(--slate-100); color: var(--slate-500); border-radius: 9999px; font-weight: 800; font-size: 0.75rem; display: flex; align-items: center; gap: 0.375rem; width: fit-content; }
                .user-count.active { background: var(--primary-light); color: var(--primary); }

                .actions-cell { display: flex; justify-content: flex-end; gap: 0.5rem; }
                .mini-action { padding: 0.5rem; border-radius: 0.5rem; border: none; background: transparent; color: var(--slate-400); cursor: pointer; transition: all 0.2s; }
                .mini-action:hover { background: var(--primary-light); color: var(--primary); }
                .mini-action.danger:hover { background: #fef2f2; color: var(--danger); }

                .alert { padding: 1rem 1.5rem; border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 600; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; }
                .alert-error { background: #fef2f2; color: var(--danger); border: 1px solid #fee2e2; }
                .alert-success { background: #ecfdf5; color: var(--success); border: 1px solid #d1fae5; }
            `}</style>

            <div className="group-container">
                <header className="view-header">
                    <div className="title-area">
                        <button className="back-btn" onClick={() => navigate('/dashboard')}>
                            <ChevronLeft size={14} /> Tableau de bord
                        </button>
                        <h1>
                            <Layers size={32} color="var(--primary)" />
                            Groupes de Travail
                        </h1>
                        <p>Organisez vos agents par services ou départements.</p>
                    </div>
                    <div className="search-box">
                        <Search className="search-icon" />
                        <input
                            className="search-input"
                            placeholder="Filtrer les services..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </header>

                {error && <div className="alert alert-error"><Info size={16} />{error}</div>}
                {success && <div className="alert alert-success"><CheckCircle2 size={16} />{success}</div>}

                <div className="management-card">
                    <div className="card-strip">
                        {editingId ? <Edit size={14} /> : <Plus size={14} />}
                        <h2>{editingId ? 'Configuration du Service' : 'Nouveau Service Interne'}</h2>
                    </div>
                    <div className="form-body">
                        <form onSubmit={handleSubmit}>
                            <div className="grid-form">
                                <div className="input-group" style={{ gridColumn: 'span 4' }}>
                                    <label className="input-label">Nom du Service *</label>
                                    <input
                                        className="premium-input"
                                        value={formData.LibelleGroupe}
                                        onChange={(e) => setFormData({ ...formData, LibelleGroupe: e.target.value })}
                                        placeholder="Ex: Département Transit, RH..."
                                        required
                                    />
                                </div>
                                <div className="input-group" style={{ gridColumn: 'span 8' }}>
                                    <label className="input-label">Missions / Observations</label>
                                    <input
                                        className="premium-input"
                                        value={formData.Observations}
                                        onChange={(e) => setFormData({ ...formData, Observations: e.target.value })}
                                        placeholder="Brève description des responsabilités"
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                {editingId && (
                                    <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                                        Annuler
                                    </button>
                                )}
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    <Save size={18} />
                                    {saving ? 'Enregistrement...' : editingId ? 'Valider les modifications' : 'Créer le service'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="management-card list-area">
                    <div className="card-strip">
                        <Activity size={14} />
                        <h2>Organigramme des Services</h2>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Département</th>
                                    <th>Description / Notes</th>
                                    <th>Effectif</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGroupes.map(g => (
                                    <tr key={g.IDGroupes}>
                                        <td>
                                            <div className="group-tag">
                                                <div className="group-icon">
                                                    <Layers size={18} />
                                                </div>
                                                <span className="group-name">{g.LibelleGroupe}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: g.Observations ? 'inherit' : 'var(--slate-400)' }}>
                                                <MessageSquare size={14} opacity={0.4} />
                                                <span style={{ fontSize: '0.8125rem' }}>{g.Observations || 'Aucune consigne spécifique'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`user-count ${g.user_count > 0 ? 'active' : ''}`}>
                                                <Users size={12} />
                                                {g.user_count} {g.user_count > 1 ? 'Agents' : 'Agent'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="actions-cell">
                                                <button className="mini-action" onClick={() => handleEdit(g)}>
                                                    <Edit size={16} />
                                                </button>
                                                <button className="mini-action danger" onClick={() => handleDelete(g.IDGroupes)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredGroupes.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--slate-400)', fontWeight: 600 }}>
                                            <Info size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                            <p>Aucun service ne correspond à vos critères.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
