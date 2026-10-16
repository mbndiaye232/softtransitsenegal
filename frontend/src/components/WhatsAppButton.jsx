import React, { useEffect, useState } from 'react';

/**
 * WhatsAppButton — Floating WhatsApp Click-to-Chat button.
 *
 * Props:
 *   - phone   : international number, no '+' (ex: "221771234567"). Defaults to VITE_WHATSAPP_NUMBER.
 *   - message : pre-filled message. Defaults to a generic Soft Transit greeting.
 *   - tooltip : tooltip text shown on desktop hover and as initial bubble. Default provided.
 *   - delay   : ms before the button appears (avoids being too aggressive). Default 1500ms.
 */
export default function WhatsAppButton({
    phone = import.meta.env.VITE_WHATSAPP_NUMBER || '221771234567',
    message = 'Bonjour, je souhaiterais en savoir plus sur Soft Transit et réserver une démo.',
    tooltip = 'Discutons sur WhatsApp 👋',
    delay = 1500,
}) {
    const [visible, setVisible] = useState(false);
    const [showBubble, setShowBubble] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setVisible(true), delay);
        const t2 = setTimeout(() => setShowBubble(true), delay + 800);
        const t3 = setTimeout(() => setShowBubble(false), delay + 8000);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [delay]);

    if (!visible) return null;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return (
        <>
            <style>{`
                @keyframes wa-fadein {
                    from { opacity: 0; transform: scale(0.5) translateY(20px); }
                    to   { opacity: 1; transform: scale(1)  translateY(0); }
                }
                @keyframes wa-pulse {
                    0%   { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.55); }
                    70%  { box-shadow: 0 0 0 16px rgba(37, 211, 102, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
                }
                @keyframes wa-bubble-in {
                    from { opacity: 0; transform: translateX(20px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .wa-fab {
                    position: fixed; bottom: 24px; right: 24px;
                    width: 60px; height: 60px; border-radius: 50%;
                    background: #25D366; color: white;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; text-decoration: none;
                    box-shadow: 0 8px 24px rgba(37, 211, 102, 0.45);
                    z-index: 9999;
                    animation: wa-fadein 0.4s ease-out, wa-pulse 2.4s infinite 1s;
                    transition: transform 0.15s ease;
                }
                .wa-fab:hover { transform: scale(1.08); }
                .wa-bubble {
                    position: fixed; bottom: 38px; right: 96px;
                    background: white; color: #0f172a;
                    padding: 10px 14px; border-radius: 12px;
                    font-size: 13px; font-weight: 600;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                    z-index: 9998; max-width: 220px;
                    animation: wa-bubble-in 0.3s ease-out;
                }
                .wa-bubble::after {
                    content: ''; position: absolute;
                    right: -6px; top: 50%; transform: translateY(-50%) rotate(45deg);
                    width: 12px; height: 12px; background: white;
                }
                .wa-bubble-close {
                    position: absolute; top: -8px; right: -8px;
                    width: 20px; height: 20px; border-radius: 50%;
                    background: #64748b; color: white; border: none;
                    cursor: pointer; font-size: 12px; line-height: 1;
                    display: flex; align-items: center; justify-content: center;
                }
                @media (max-width: 480px) {
                    .wa-fab { width: 56px; height: 56px; bottom: 16px; right: 16px; }
                    .wa-bubble { right: 80px; bottom: 28px; font-size: 12px; max-width: 180px; }
                }
            `}</style>

            {showBubble && (
                <div className="wa-bubble">
                    {tooltip}
                    <button
                        className="wa-bubble-close"
                        onClick={() => setShowBubble(false)}
                        aria-label="Fermer"
                    >×</button>
                </div>
            )}

            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="wa-fab"
                aria-label="Contacter Soft Transit sur WhatsApp"
                title={tooltip}
                onClick={() => setShowBubble(false)}
            >
                {/* WhatsApp official icon (inline SVG, no external dep) */}
                <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" aria-hidden="true">
                    <path d="M16.001 3.2c-7.07 0-12.8 5.73-12.8 12.8 0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.56-1.71a12.74 12.74 0 0 0 6.23 1.6h.01c7.07 0 12.8-5.73 12.8-12.8s-5.73-12.69-12.8-12.69zm0 23.3h-.01a10.59 10.59 0 0 1-5.4-1.48l-.39-.23-3.9 1.02 1.04-3.8-.25-.39a10.6 10.6 0 0 1-1.62-5.62c0-5.86 4.77-10.62 10.63-10.62 2.84 0 5.5 1.1 7.5 3.11 2.01 2.01 3.11 4.68 3.11 7.52 0 5.86-4.77 10.49-10.71 10.49zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.77-2.22-.18-.32-.02-.49.14-.65.15-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.53-.71-.54l-.61-.01c-.21 0-.55.08-.84.4-.29.32-1.1 1.07-1.1 2.62 0 1.55 1.13 3.04 1.29 3.25.16.21 2.22 3.4 5.39 4.77.75.32 1.34.52 1.8.66.76.24 1.45.21 2 .13.61-.09 1.89-.77 2.16-1.52.27-.74.27-1.38.19-1.52-.08-.13-.29-.21-.61-.37z"/>
                </svg>
            </a>
        </>
    );
}
