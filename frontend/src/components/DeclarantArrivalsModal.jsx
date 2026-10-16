import { useEffect } from 'react'
import { Anchor, X, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const formatDate = (s) => s ? new Date(s).toLocaleDateString('fr-FR') : '---'

export default function DeclarantArrivalsModal({ arrivals, onClose }) {
    const navigate = useNavigate()

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = ''
        }
    }, [onClose])

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1.5rem', animation: 'fadeIn 0.2s ease-out',
            }}
        >
            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
            `}</style>
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'white', borderRadius: '20px',
                    width: '100%', maxWidth: '900px', maxHeight: '85vh',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                    animation: 'slideUp 0.3s ease-out',
                }}
            >
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
                    padding: '1.25rem 1.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.18)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Anchor size={22} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Bienvenue
                            </div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white' }}>
                                Vos prochaines arrivées de navires
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '34px', height: '34px', borderRadius: '10px',
                            background: 'rgba(255,255,255,0.15)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        aria-label="Fermer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
                    <div style={{
                        background: '#fef3c7', color: '#92400e',
                        padding: '0.75rem 1.5rem', fontSize: '13px', fontWeight: 600,
                        borderBottom: '1px solid #fde68a',
                    }}>
                        {arrivals.length} dossier{arrivals.length > 1 ? 's' : ''} avec arrivée prévue · ordre chronologique
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                {['Code dossier', 'Libellé', 'Navire / Transport', 'Date arrivée', 'J. restants'].map((h, i) => (
                                    <th key={i} style={{
                                        padding: '12px 16px', textAlign: 'left',
                                        fontSize: '10px', fontWeight: 800, color: '#64748b',
                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                        borderBottom: '1px solid #e2e8f0',
                                        position: 'sticky', top: 0, background: '#f8fafc',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {arrivals.map((item, idx) => {
                                const r = item.colorR ?? 200, g = item.colorG ?? 200, b = item.colorB ?? 200
                                const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                                const bg = item.colorR != null ? `rgb(${r},${g},${b})` : 'transparent'
                                const fg = item.colorR != null ? (lum > 0.55 ? '#1e293b' : 'white') : '#1e293b'
                                const days = item.daysRemaining
                                return (
                                    <tr key={idx} style={{ background: bg, color: fg, borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{item.code || '---'}</td>
                                        <td style={{ padding: '12px 16px' }}>{item.label || '---'}</td>
                                        <td style={{ padding: '12px 16px' }}>{item.transportMean || '---'}</td>
                                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formatDate(item.dateArrivee)}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{days != null ? days : '---'}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Cette fenêtre ne s'affichera plus pendant cette session.
                    </div>
                    <button
                        onClick={() => { onClose(); navigate('/transport-arrivals') }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
                            color: 'white', border: 'none', borderRadius: '10px',
                            padding: '10px 18px', fontWeight: 700, fontSize: '13px',
                            cursor: 'pointer',
                        }}
                    >
                        Voir le calendrier complet <ArrowRight size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}
