// Styles et formats partagés par les pages du portail client (charte SST)
export const MARINE = '#0f172a'
export const BLEU = '#2563eb'
export const VERT = '#059669'

export const argent = (v) => `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(v) || 0))} F CFA`
export const date = (v) => (v ? new Date(v).toLocaleDateString('fr-FR') : '—')

export const carte = { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px -10px rgba(15,23,42,0.18)', padding: '1.35rem', marginBottom: '1.25rem' }
export const titre = { margin: '0 0 0.75rem', color: MARINE, fontSize: '1.05rem', fontWeight: 700 }
export const champ = { width: '100%', padding: '0.7rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: '0.95rem', boxSizing: 'border-box', background: '#fbfcfe' }
export const etiquette = { display: 'block', margin: '0.9rem 0 0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }
export const bouton = { background: BLEU, color: '#fff', border: 'none', borderRadius: 10, padding: '0.65rem 1.15rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 6px 16px -6px rgba(37,99,235,0.6)' }
export const boutonVert = { ...bouton, background: VERT }
export const boutonClair = { ...bouton, background: '#eaf1ff', color: '#1b3464', boxShadow: 'none' }
export const th = { textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }
export const td = { padding: '0.7rem 0.75rem', borderBottom: '1px solid #eef2f7', fontSize: '0.9rem' }
export const alerte = (type) => ({
    padding: '0.75rem 1rem', borderRadius: 8, margin: '0.75rem 0', fontSize: '0.9rem',
    background: type === 'ok' ? '#ecfdf5' : '#fef2f2', color: type === 'ok' ? '#065f46' : '#991b1b',
})
