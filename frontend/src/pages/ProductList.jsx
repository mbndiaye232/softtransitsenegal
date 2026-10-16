import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { produitsAPI } from '../services/api';
import {
    Package,
    Search,
    ChevronLeft,
    ChevronRight,
    LogOut,
    LayoutDashboard,
    ArrowLeft,
    Info,
    Hash,
    Tag,
    Activity
} from 'lucide-react';

export default function ProductList() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit] = useState(50); // Set to 50 for better performance balance
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const showMessage = useCallback((text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    }, []);

    const loadProducts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await produitsAPI.getAll({
                page,
                limit,
                search: searchTerm
            });
            setProducts(response.data.products);
            setTotal(response.data.total);
        } catch (error) {
            console.error('Error loading products:', error);
            showMessage(`Erreur lors du chargement des produits`, 'error');
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchTerm, showMessage]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setPage(1);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const totalPages = Math.ceil(total / limit);

    if (loading && products.length === 0) return (
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
        <div className="products-wrapper">
            <style>{`
                .products-wrapper { min-height: 100vh; background: var(--bg); padding: 2.5rem; }
                .products-container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; }
                
                .view-header { display: flex; justify-content: space-between; align-items: flex-end; }
                .title-area h1 { font-size: 1.75rem; font-weight: 800; color: var(--slate-900); display: flex; align-items: center; gap: 0.75rem; margin: 0; letter-spacing: -0.02em; }
                .title-area p { font-size: 0.875rem; color: var(--slate-500); margin: 0.25rem 0 0 0; font-weight: 500; }
                
                .back-btn { display: flex; align-items: center; gap: 0.5rem; color: var(--slate-500); text-decoration: none; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; background: none; margin-bottom: 0.5rem; transition: color 0.2s; }
                .back-btn:hover { color: var(--primary); }

                .nav-actions { display: flex; align-items: center; gap: 1rem; }
                .action-btn { 
                    padding: 0.625rem 1.25rem; 
                    background: white; 
                    color: var(--slate-600); 
                    border-radius: var(--radius-md); 
                    font-weight: 700; 
                    font-size: 0.8125rem; 
                    border: 1px solid var(--border); 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.5rem; 
                    transition: all 0.2s; 
                }
                .action-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
                .action-btn.primary { background: var(--primary); color: white; border: none; }
                .action-btn.primary:hover { background: var(--primary-hover); }

                .search-card { background: white; border-radius: var(--radius-lg); border: 1px solid var(--border); padding: 1rem 1.5rem; box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; }
                .search-box { position: relative; flex: 1; max-width: 400px; }
                .search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--slate-400); width: 1.125rem; }
                .search-input { width: 100%; padding: 0.75rem 1rem 0.75rem 2.75rem; border: 1px solid var(--border); border-radius: 999px; font-size: 0.875rem; outline: none; background: var(--slate-50); transition: all 0.2s; }
                .search-input:focus { border-color: var(--primary); background: white; box-shadow: 0 0 0 4px var(--primary-light); }
                
                .stats-info { font-size: 0.8125rem; font-weight: 700; color: var(--slate-400); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem; }
                .stats-badge { background: var(--primary-light); color: var(--primary); padding: 0.25rem 0.625rem; border-radius: 999px; }

                .table-card { background: white; border-radius: var(--radius-xl); border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; }
                .premium-table { width: 100%; border-collapse: collapse; }
                .premium-table th { background: var(--slate-50); padding: 1.25rem 1.5rem; text-align: left; font-size: 0.75rem; font-weight: 800; color: var(--slate-400); text-transform: uppercase; border-bottom: 1px solid var(--border-light); }
                .premium-table td { padding: 1.25rem 1.5rem; font-size: 0.875rem; color: var(--slate-700); border-bottom: 1px solid var(--border-light); }
                .premium-table tr:last-child td { border-bottom: none; }
                .premium-table tr:hover td { background: var(--slate-50); }
                
                .nts-code { font-family: 'JetBrains Mono', monospace; font-weight: 800; color: var(--primary); background: var(--primary-light); padding: 0.375rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem; }
                .product-libelle { font-weight: 600; color: var(--slate-800); line-height: 1.4; }

                .pagination-footer { padding: 1.5rem 2rem; background: var(--slate-50); border-top: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; }
                .page-info { font-size: 0.8125rem; font-weight: 600; color: var(--slate-500); }
                .pager-group { display: flex; gap: 0.5rem; }
                .pager-btn { padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid var(--border); background: white; color: var(--slate-600); font-weight: 700; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.375rem; transition: all 0.2s; }
                .pager-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
                .pager-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .alert { padding: 1rem 1.5rem; border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem; }
                .alert-error { background: #fef2f2; color: var(--danger); border: 1px solid #fee2e2; }
                .alert-info { background: var(--primary-light); color: var(--primary); border: 1px solid #e0e7ff; }
            `}</style>

            <div className="products-container">
                <header className="view-header">
                    <div className="title-area">
                        <button className="back-btn" onClick={() => navigate('/dashboard')}>
                            <ChevronLeft size={14} /> Tableau de bord
                        </button>
                        <h1>
                            <Package size={32} color="var(--primary)" />
                            Codification Produits
                        </h1>
                        <p>Consultez et recherchez dans la nomenclature tarifaire (NTS).</p>
                    </div>
                    <div className="nav-actions">
                        <div style={{ textAlign: 'right', marginRight: '1rem' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--slate-900)' }}>{user?.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontWeight: 600 }}>{user?.role}</div>
                        </div>
                        <button onClick={handleLogout} className="action-btn">
                            <LogOut size={16} />
                            Quitter
                        </button>
                    </div>
                </header>

                {message.text && (
                    <div className={`alert alert-${message.type === 'error' ? 'error' : 'info'}`}>
                        <Info size={16} />
                        {message.text}
                    </div>
                )}

                <div className="search-card">
                    <div className="search-box">
                        <Search className="search-icon" />
                        <input
                            type="text"
                            placeholder="Recherche par code NTS ou libellé de produit..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="search-input"
                        />
                    </div>
                    <div className="stats-info">
                        <Activity size={14} />
                        Catalogue : <span className="stats-badge">{total} Articles</span>
                    </div>
                </div>

                <div className="table-card">
                    <div style={{ overflowX: 'auto' }}>
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '200px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Hash size={14} /> Code NTS
                                        </div>
                                    </th>
                                    <th>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Tag size={14} /> Libellé Tarifaire
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="2" style={{ textAlign: 'center', padding: '4rem 0' }}>
                                            <div className="spinner" style={{ margin: '0 auto' }}></div>
                                        </td>
                                    </tr>
                                ) : products.map((product) => (
                                    <tr key={product.IDProduits}>
                                        <td>
                                            <span className="nts-code">{product.NTS}</span>
                                        </td>
                                        <td>
                                            <div className="product-libelle">{product.Libelle}</div>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && products.length === 0 && (
                                    <tr>
                                        <td colSpan="2" style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--slate-400)', fontWeight: 600 }}>
                                            <Info size={48} style={{ opacity: 0.1, marginBottom: '1rem', display: 'block', margin: '0 auto' }} />
                                            Aucun produit trouvé pour "{searchTerm}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <footer className="pagination-footer">
                            <div className="page-info">
                                Affichage de la page <strong>{page}</strong> sur <strong>{totalPages}</strong>
                            </div>
                            <div className="pager-group">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="pager-btn"
                                >
                                    <ChevronLeft size={16} /> Précédent
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="pager-btn"
                                >
                                    Suivant <ChevronRight size={16} />
                                </button>
                            </div>
                        </footer>
                    )}
                </div>
            </div>
        </div>
    );
}
