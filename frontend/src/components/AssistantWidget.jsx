import { useState, useEffect, useRef } from 'react';
import { X, MessageCircleQuestion, Minimize2, Maximize2 } from 'lucide-react';

const ASSISTANT_URL = 'https://guidestransit.pages.dev/';

export default function AssistantWidget() {
    const [open, setOpen]       = useState(false);
    const [expanded, setExpanded] = useState(false);
    const iframeRef             = useRef(null);

    // Fermer avec Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const panelW = expanded ? 700 : 420;
    const panelH = expanded ? '85vh' : 560;

    return (
        <>
            {/* ── Panneau assistant ── */}
            {open && (
                <div style={{
                    position: 'fixed',
                    bottom: '5.5rem',
                    right: '1.5rem',
                    width: panelW,
                    height: panelH,
                    maxWidth: 'calc(100vw - 2rem)',
                    maxHeight: 'calc(100vh - 8rem)',
                    background: 'white',
                    borderRadius: 16,
                    boxShadow: '0 20px 60px rgba(0,0,0,.22), 0 4px 16px rgba(0,0,0,.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: 10000,
                    transition: 'width .25s ease, height .25s ease',
                    border: '1px solid #e5e7eb',
                }}>
                    {/* En-tête */}
                    <div style={{
                        background: 'var(--hero-gradient)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexShrink: 0,
                    }}>
                        <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: 'rgba(255,255,255,.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <MessageCircleQuestion size={18} color="white" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                                Assistant Soft Transit
                            </div>
                            <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 1 }}>
                                Posez vos questions sur l'application
                            </div>
                        </div>
                        <button
                            onClick={() => setExpanded(v => !v)}
                            style={{
                                background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8,
                                width: 30, height: 30, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', flexShrink: 0,
                            }}
                            title={expanded ? 'Réduire' : 'Agrandir'}
                        >
                            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                        <button
                            onClick={() => setOpen(false)}
                            style={{
                                background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8,
                                width: 30, height: 30, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', flexShrink: 0,
                            }}
                            title="Fermer"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* iFrame */}
                    <iframe
                        ref={iframeRef}
                        src={ASSISTANT_URL}
                        title="Assistant Soft Transit"
                        style={{ flex: 1, border: 'none', width: '100%' }}
                        allow="microphone"
                    />
                </div>
            )}

            {/* ── Bouton flottant ── */}
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    position: 'fixed',
                    bottom: '1.5rem',
                    right: '1.5rem',
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    background: open
                        ? 'var(--hero-gradient)'
                        : 'var(--hero-gradient)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(29,78,216,.45)',
                    zIndex: 10001,
                    transition: 'all .2s ease',
                    transform: open ? 'rotate(0deg)' : 'rotate(0deg)',
                }}
                title={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
                {open
                    ? <X size={22} color="white" />
                    : <MessageCircleQuestion size={22} color="white" />
                }
            </button>
        </>
    );
}
