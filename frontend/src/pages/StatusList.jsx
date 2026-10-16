import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { statutsAPI } from '../services/api'
import {
    Activity,
    Plus,
    Edit,
    Trash2,
    CheckCircle2,
    XCircle,
    Info,
    ChevronLeft,
    Save,
    RotateCcw
} from 'lucide-react'

export default function StatusList() {
    const navigate = useNavigate()
    const [statuts, setStatuts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Form state
    const [editingId, setEditingId] = useState(null)
    const [libelle, setLibelle] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadStatuts()
    }, [])

    const loadStatuts = async () => {
        try {
            const response = await statutsAPI.getAll()
            setStatuts(response.data)
        } catch (err) {
            setError('Impossible de charger les statuts')
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
                await statutsAPI.update(editingId, { libelle })
                setSuccess('Statut mis à jour avec succès')
            } else {
                await statutsAPI.create({ libelle })
                setSuccess('Nouveau statut créé avec succès')
            }
            setLibelle('')
            setEditingId(null)
            loadStatuts()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError('Erreur lors de l\'enregistrement')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (statut) => {
        setEditingId(statut.IDStatuts)
        setLibelle(statut.libelle)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce statut ?')) return

        try {
            await statutsAPI.delete(id)
            setSuccess('Statut supprimé avec succès')
            loadStatuts()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError('Impossible de supprimer le statut (il est probablement utilisé)')
            console.error(err)
        }
    }

    const handleCancel = () => {
        setEditingId(null)
        setLibelle('')
    }

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
        <div className="status-wrapper">
            <style>{`
                .status-wrapper { min-height: 100vh; background: var(--bg); padding: 2.5rem; }
                .status-container { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; }
                
                .view-header { display: flex; justify-content: space-between; align-items: flex-end; }
                .title-area h1 { font-size: 1.75rem; font-weight: 800; color: var(--slate-900); display: flex; align-items: center; gap: 0.75rem; margin: 0; letter-spacing: -0.02em; }
                .title-area p { font-size: 0.875rem; color: var(--slate-500); margin: 0.25rem 0 0 0; font-weight: 500; }
                
                .back-btn { display: flex; align-items: center; gap: 0.5rem; color: var(--slate-500); text-decoration: none; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; background: none; margin-bottom: 0.5rem; }
                .back-btn:hover { color: var(--primary); }

                .management-card { background: white; border-radius: var(--radius-xl); border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; }
                .card-strip { padding: 1.25rem 2rem; background: var(--slate-50); border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 0.75rem; }
                .card-strip h2 { font-size: 0.75rem; font-weight: 800; color: var(--slate-400); text-transform: uppercase; letter-spacing: 0.1em; margin: 0; }
                
                .form-body { padding: 2rem; }
                .form-flex { display: flex; gap: 1rem; align-items: flex-end; }
                .input-group { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
                .input-label { font-size: 0.75rem; font-weight: 700; color: var(--slate-600); }
                
                .premium-input { 
                    width: 100%; 
                    padding: 0.75rem 1rem; 
                    border: 1px solid var(--border); 
                    border-radius: var(--radius-md); 
                    font-size: 0.875rem; 
                    outline: none; 
                    background: var(--slate-50); 
                    transition: all 0.2s; 
                }
                .premium-input:focus { border-color: var(--primary); background: white; box-shadow: 0 0 0 4px var(--primary-light); }

                .btn { padding: 0.75rem 1.5rem; border-radius: var(--radius-md); font-weight: 700; font-size: 0.875rem; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
                .btn-primary { background: var(--primary); color: white; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); }
                .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
                .btn-secondary { background: white; color: var(--slate-600); border: 1px solid var(--border); }
                .btn-secondary:hover { background: var(--slate-50); }

                .list-area { margin-top: 1rem; }
                .premium-table { width: 100%; border-collapse: collapse; }
                .premium-table th { background: var(--slate-50); padding: 1rem 1.5rem; text-align: left; font-size: 0.75rem; font-weight: 800; color: var(--slate-400); text-transform: uppercase; border-bottom: 1px solid var(--border-light); }
                .premium-table td { padding: 1.25rem 1.5rem; font-size: 0.875rem; color: var(--slate-700); border-bottom: 1px solid var(--border-light); }
                .premium-table tr:hover td { background: var(--slate-50); }
                
                .status-tag { padding: 0.25rem 0.75rem; background: var(--primary-light); color: var(--primary); border-radius: 9999px; font-weight: 700; font-size: 0.8125rem; border: 1px solid color-mix(in srgb, var(--primary), transparent 85%); }

                .actions-cell { display: flex; justify-content: flex-end; gap: 0.5rem; }
                .mini-action { padding: 0.5rem; border-radius: 0.5rem; border: none; background: transparent; color: var(--slate-400); cursor: pointer; transition: all 0.2s; }
                .mini-action:hover { background: var(--primary-light); color: var(--primary); }
                .mini-action.danger:hover { background: #fef2f2; color: var(--danger); }

                .alert { padding: 1rem 1.5rem; border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 600; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; }
                .alert-error { background: #fef2f2; color: var(--danger); border: 1px solid #fee2e2; }
                .alert-success { background: #ecfdf5; color: var(--success); border: 1px solid #d1fae5; }
            `}</style>

            <div className="status-container">
                <header className="view-header">
                    <div className="title-area">
                        <button className="back-btn" onClick={() => navigate('/dashboard')}>
                            <ChevronLeft size={14} /> Tableau de bord
                        </button>
                        <h1>
                            <Activity size={32} color="var(--primary)" />
                            Statuts & Références
                        </h1>
                        <p>Définissez les nomenclatures pour vos clients et partenaires.</p>
                    </div>
                </header>

                {error && <div className="alert alert-error"><Info size={16} />{error}</div>}
                {success && <div className="alert alert-success"><CheckCircle2 size={16} />{success}</div>}

                <div className="management-card">
                    <div className="card-strip">
                        {editingId ? <Edit size={14} /> : <Plus size={14} />}
                        <h2>{editingId ? 'Modifier la référence' : 'Nouveau Libellé de Statut'}</h2>
                    </div>
                    <div className="form-body">
                        <form onSubmit={handleSubmit} className="form-flex">
                            <div className="input-group">
                                <label className="input-label">Libellé du Statut *</label>
                                <input
                                    className="premium-input"
                                    value={libelle}
                                    onChange={(e) => setLibelle(e.target.value)}
                                    placeholder="Ex: Client Premium, Partenaire Externe..."
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <Save size={18} />
                                {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Ajouter au catalogue'}
                            </button>
                            {editingId && (
                                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                                    <RotateCcw size={18} />
                                    Annuler
                                </button>
                            )}
                        </form>
                    </div>
                </div>

                <div className="management-card list-area">
                    <div className="card-strip">
                        <Activity size={14} />
                        <h2>Référentiels Enregistrés</h2>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Libellé Professionnel</th>
                                    <th>Identifiant Unique</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statuts.map(s => (
                                    <tr key={s.IDStatuts}>
                                        <td>
                                            <span className="status-tag">{s.libelle}</span>
                                        </td>
                                        <td>
                                            <code style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>#REF_{s.IDStatuts}</code>
                                        </td>
                                        <td>
                                            <div className="actions-cell">
                                                <button className="mini-action" onClick={() => handleEdit(s)}>
                                                    <Edit size={16} />
                                                </button>
                                                <button className="mini-action danger" onClick={() => handleDelete(s.IDStatuts)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {statuts.length === 0 && (
                                    <tr>
                                        <td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: 'var(--slate-400)', fontWeight: 600 }}>
                                            <Info size={32} style={{ opacity: 0.1, marginBottom: '0.75rem', display: 'block', margin: '0 auto' }} />
                                            Aucun statut n'est encore configuré.
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
