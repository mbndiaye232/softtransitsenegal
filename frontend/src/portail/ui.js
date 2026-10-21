// Styles et formats partagés par les pages du portail client (charte SST)
export const MARINE = '#1B3464'
export const BLEU = '#2D5A9E'
export const VERT = '#059669'

export const argent = (v) => `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(v) || 0))} F CFA`
export const date = (v) => (v ? new Date(v).toLocaleDateString('fr-FR') : '—')

export const carte = { background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(27,52,100,0.08)', padding: '1.25rem', marginBottom: '1.25rem' }
export const titre = { margin: '0 0 0.75rem', color: MARINE, fontSize: '1.05rem', fontWeight: 700 }
export const champ = { width: '100%', padding: '0.7rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box' }
export const etiquette = { display: 'block', margin: '0.9rem 0 0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }
export const bouton = { background: BLEU, color: '#fff', border: 'none', borderRadius: 8, padding: '0.65rem 1.1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }
export const boutonVert = { ...bouton, background: VERT }
export const boutonClair = { ...bouton, background: '#e8eef8', color: MARINE }
export const th = { textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }
export const td = { padding: '0.7rem 0.75rem', borderBottom: '1px solid #eef2f7', fontSize: '0.9rem' }
export const alerte = (type) => ({
    padding: '0.75rem 1rem', borderRadius: 8, margin: '0.75rem 0', fontSize: '0.9rem',
    background: type === 'ok' ? '#ecfdf5' : '#fef2f2', color: type === 'ok' ? '#065f46' : '#991b1b',
})
