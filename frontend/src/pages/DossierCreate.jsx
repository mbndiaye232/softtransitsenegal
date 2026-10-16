import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dossiersAPI, clientsAPI, authAPI } from '../services/api';

const DossierCreate = () => {
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    const [form, setForm] = useState({
        label: '',
        nature: 'IMP',
        mode: 'MA',
        type: 'TC',
        description: '',
        contactId: '',
        dpiNumber: '',
        quotationStep: false,
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        observations: ''
    });
    const [file, setFile] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [clientsRes, userRes] = await Promise.all([
                    clientsAPI.getAll(),
                    authAPI.getMe()
                ]);
                setClients(clientsRes.data);
                setFilteredClients(clientsRes.data);
                setCurrentUser(userRes.data);
            } catch (err) {
                console.error('Fetch data error:', err);
                setError('Failed to load initial data');
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const results = clients.filter(client =>
            (client.NomClient && client.NomClient.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.Adresse && client.Adresse.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        setFilteredClients(results);
    }, [searchTerm, clients]);

    const handleClientSelect = (client) => {
        console.log('Client selected:', client);
        console.log('Client ID:', client.IDCLIENTS);
        setSelectedClient(client);
        // Préremplir la personne contact du dossier avec celle du client.
        // Si le client n'a pas de personne contact renseignée, fallback sur les
        // coordonnées principales du client. Les champs restent éditables.
        setForm(prev => ({
            ...prev,
            contactName:  client.PersonneContact      || client.NomClient || '',
            contactPhone: client.TelPersonneContact   || client.Tel1      || '',
            contactEmail: client.EmailPersonneContact || client.Email     || ''
        }));
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!selectedClient) {
            setError('Veuillez sélectionner un client');
            return;
        }

        try {
            console.log('=== SUBMITTING DOSSIER ===');
            console.log('Selected client:', selectedClient);
            console.log('Client IDCLIENTS:', selectedClient.IDCLIENTS);

            const formData = new FormData();
            formData.append('label', form.label);
            formData.append('nature', form.nature);
            formData.append('mode', form.mode);
            formData.append('type', form.type);
            formData.append('description', form.description || '');
            formData.append('contactId', form.contactId || '');
            formData.append('clientId', selectedClient.IDCLIENTS);
            formData.append('dpiNumber', form.dpiNumber || '');
            formData.append('quotationStep', form.quotationStep);
            formData.append('contactName', form.contactName || '');
            formData.append('contactPhone', form.contactPhone || '');
            formData.append('contactEmail', form.contactEmail || '');
            formData.append('observations', form.observations || '');

            if (file) {
                formData.append('file', file);
            }

            // Log what we're sending
            console.log('FormData clientId:', formData.get('clientId'));

            const response = await dossiersAPI.create(formData);
            const newId = response.data.id;
            navigate('/dossiers');
        } catch (err) {
            console.error('Create dossier error:', err);
            setError(err.response?.data?.error || 'Failed to create dossier');
        }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', padding: '2rem' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{
                    backgroundColor: '#2c5aa0',
                    color: 'white',
                    padding: '1.5rem 2rem',
                    borderRadius: '8px 8px 0 0',
                    marginBottom: '0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '600' }}>Ouverture de dossiers</h1>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: '#fee',
                        border: '1px solid #fcc',
                        color: '#c33',
                        padding: '1rem',
                        borderRadius: '6px',
                        marginBottom: '1.5rem'
                    }}>
                        {error}
                    </div>
                )}

                {/* Client Selection Section */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '0 0 8px 8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    marginBottom: '2rem',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        backgroundColor: '#3d6db5',
                        color: 'white',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500' }}>Sélection du client</h2>
                        <input
                            type="text"
                            placeholder="🔍 Rechercher un client..."
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                border: 'none',
                                width: '300px',
                                fontSize: '0.9rem'
                            }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{
                                position: 'sticky',
                                top: 0,
                                backgroundColor: '#f1f3f5',
                                zIndex: 1
                            }}>
                                <tr>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>Nom ou raison sociale</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>Adresse</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>Tél 1</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>Tél 2</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map((client, index) => {
                                    // Use correct property name IDCLIENTS
                                    const isSelected = selectedClient?.IDCLIENTS && client.IDCLIENTS && selectedClient.IDCLIENTS == client.IDCLIENTS;

                                    return (
                                        <tr key={`client-${client.IDCLIENTS || index}`}
                                            onClick={() => handleClientSelect(client)}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: isSelected ? '#cce5ff' : 'white', // Sky blue background
                                                borderLeft: isSelected ? '8px solid #004085' : '8px solid transparent', // Dark blue border
                                                boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
                                                transition: 'all 0.2s',
                                                transform: isSelected ? 'scale(1.005)' : 'scale(1)'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.backgroundColor = 'white';
                                                }
                                            }}
                                        >
                                            <td style={{
                                                padding: '1rem',
                                                borderBottom: '1px solid #e9ecef',
                                                fontWeight: isSelected ? '700' : '400',
                                                color: isSelected ? '#004085' : 'inherit' // Dark blue text for contrast
                                            }}>{client.NomClient}</td>
                                            <td style={{
                                                padding: '1rem',
                                                borderBottom: '1px solid #e9ecef',
                                                fontSize: '0.9rem',
                                                color: isSelected ? '#004085' : '#6c757d'
                                            }}>{client.Adresse}</td>
                                            <td style={{
                                                padding: '1rem',
                                                borderBottom: '1px solid #e9ecef',
                                                fontSize: '0.9rem',
                                                color: isSelected ? '#004085' : 'inherit'
                                            }}>{client.Tel1}</td>
                                            <td style={{
                                                padding: '1rem',
                                                borderBottom: '1px solid #e9ecef',
                                                fontSize: '0.9rem',
                                                color: isSelected ? '#004085' : 'inherit'
                                            }}>{client.Tel2}</td>
                                            <td style={{
                                                padding: '1rem',
                                                borderBottom: '1px solid #e9ecef',
                                                fontSize: '0.9rem',
                                                color: isSelected ? '#004085' : '#0066cc',
                                                fontWeight: isSelected ? '600' : '400'
                                            }}>{client.Email}</td>
                                        </tr>
                                    );
                                })}
                                {filteredClients.length === 0 && (
                                    <tr key="no-clients">
                                        <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#6c757d' }}>
                                            {clients.length === 0
                                                ? '⚠️ Aucun client trouvé. Vérifiez la console (F12) pour plus de détails.'
                                                : `🔍 Aucun client ne correspond à "${searchTerm}"`
                                            }
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>

                {/* Form Section */}
                <form onSubmit={handleSubmit} style={{
                    backgroundColor: 'white',
                    padding: '2rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    {/* Row 1: Main Info */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, 1fr)',
                        gap: '1.5rem',
                        marginBottom: '1.5rem'
                    }}>
                        <div style={{ gridColumn: 'span 4' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>
                                Libellé <span style={{ color: '#dc3545' }}>*</span>
                            </label>
                            <input
                                name="label"
                                type="text"
                                required
                                value={form.label}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#2c5aa0'}
                                onBlur={(e) => e.target.style.borderColor = '#ced4da'}
                            />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Nature dossier</label>
                            <select
                                name="nature"
                                value={form.nature}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    backgroundColor: 'white'
                                }}
                            >
                                <option value="IMP">Import</option>
                                <option value="EXP">Export</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Mode expédition</label>
                            <select
                                name="mode"
                                value={form.mode}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    backgroundColor: 'white'
                                }}
                            >
                                <option value="MA">Maritime</option>
                                <option value="AE">Aérien</option>
                                <option value="TE">Terrestre</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Type dossier</label>
                            <select
                                name="type"
                                value={form.type}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    backgroundColor: 'white'
                                }}
                            >
                                <option value="TC">Conteneur</option>
                                <option value="GR">Groupage</option>
                                <option value="CO">Conventionnel</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Type document</label>
                            <input
                                type="text"
                                readOnly
                                value={form.mode === 'MA' ? 'BL' : form.mode === 'AE' ? 'LTA' : 'LVI'}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    backgroundColor: '#e9ecef',
                                    color: '#495057'
                                }}
                            />
                        </div>
                    </div>

                    {/* Row 2: Code & Validation */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, 1fr)',
                        gap: '1.5rem',
                        marginBottom: '1.5rem',
                        padding: '1.5rem',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '6px'
                    }}>
                        <div style={{ gridColumn: 'span 3' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Code dossier</label>
                            <input
                                type="text"
                                disabled
                                placeholder="Généré automatiquement"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    backgroundColor: '#e9ecef',
                                    color: '#6c757d'
                                }}
                            />
                        </div>
                        <div style={{ gridColumn: 'span 3' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Validé par</label>
                            <input
                                type="text"
                                readOnly
                                value={currentUser?.name || ''}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    backgroundColor: '#e9ecef',
                                    color: '#495057'
                                }}
                            />
                        </div>
                        <div style={{ gridColumn: 'span 3' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Numéro DPI</label>
                            <input
                                name="dpiNumber"
                                type="text"
                                value={form.dpiNumber}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem'
                                }}
                            />
                        </div>
                        <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'flex-end' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.75rem' }}>
                                <input
                                    id="quotationStep"
                                    name="quotationStep"
                                    type="checkbox"
                                    checked={form.quotationStep}
                                    onChange={handleChange}
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        marginRight: '0.5rem',
                                        cursor: 'pointer'
                                    }}
                                />
                                <span style={{ fontSize: '0.9rem', fontWeight: '500', color: '#495057' }}>Etape cotation</span>
                            </label>
                        </div>
                    </div>

                    {/* Row 3: Contact Info */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: '600',
                            color: '#2c5aa0',
                            marginBottom: '1rem',
                            paddingBottom: '0.5rem',
                            borderBottom: '2px solid #e9ecef'
                        }}>Informations de contact</h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '1.5rem'
                        }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Personne contact</label>
                                <input
                                    name="contactName"
                                    type="text"
                                    value={form.contactName}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '1px solid #ced4da',
                                        borderRadius: '6px',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Tél Personne Contact</label>
                                <input
                                    name="contactPhone"
                                    type="text"
                                    value={form.contactPhone}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '1px solid #ced4da',
                                        borderRadius: '6px',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Email personne contact</label>
                                <input
                                    name="contactEmail"
                                    type="email"
                                    value={form.contactEmail}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '1px solid #ced4da',
                                        borderRadius: '6px',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 4: Description & Observations */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1.5rem',
                        marginBottom: '1.5rem'
                    }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Description</label>
                            <textarea
                                name="description"
                                rows={4}
                                value={form.description}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>Observations</label>
                            <textarea
                                name="observations"
                                rows={4}
                                value={form.observations}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                    </div>

                    {/* File Upload */}
                    <div style={{
                        marginBottom: '2rem',
                        padding: '1.5rem',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '6px',
                        border: '2px dashed #ced4da'
                    }}>
                        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>
                            📎 Fiche dossier (PDF, Word)
                        </label>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        />
                        {file && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#28a745' }}>
                                ✓ Fichier sélectionné: {file.name}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '1rem',
                        paddingTop: '1.5rem',
                        borderTop: '1px solid #e9ecef'
                    }}>
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard')}
                            style={{
                                padding: '0.75rem 2rem',
                                border: '1px solid #ced4da',
                                borderRadius: '6px',
                                backgroundColor: 'white',
                                color: '#495057',
                                fontSize: '0.95rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#f8f9fa';
                                e.target.style.borderColor = '#adb5bd';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'white';
                                e.target.style.borderColor = '#ced4da';
                            }}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            style={{
                                padding: '0.75rem 2.5rem',
                                border: 'none',
                                borderRadius: '6px',
                                backgroundColor: '#2c5aa0',
                                color: 'white',
                                fontSize: '0.95rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(44, 90, 160, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#234a85';
                                e.target.style.boxShadow = '0 4px 8px rgba(44, 90, 160, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#2c5aa0';
                                e.target.style.boxShadow = '0 2px 4px rgba(44, 90, 160, 0.2)';
                            }}
                        >
                            ✓ Valider et créer le dossier
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DossierCreate;
