const GROUPS = [
    {
        label: 'Dossiers & Transit',
        color: '#0369a1',
        modules: [
            { code: 'DOSSIERS',  label: 'Gestion des Dossiers (liste, création)' },
            { code: 'COTATIONS', label: 'Gestion des Cotations' },
            { code: 'NOTES',     label: 'Notes de Détails' },
        ]
    },
    {
        label: 'Onglets du Dossier',
        color: '#0284c7',
        modules: [
            { code: 'DOSSIER_DETAILS',        label: '↳ Onglet — Détails' },
            { code: 'DOSSIER_COTATION',        label: '↳ Onglet — Cotation' },
            { code: 'DOSSIER_OT',              label: '↳ Onglet — OT (Transit)' },
            { code: 'DOSSIER_TT',              label: '↳ Onglet — TT (Titre Transport)' },
            { code: 'DOSSIER_TRANSPORTS',      label: '↳ Onglet — Transports' },
            { code: 'DOSSIER_COMPOSITION',     label: '↳ Onglet — Composition' },
            { code: 'DOSSIER_NOTES',           label: '↳ Onglet — Notes de détail' },
            { code: 'DOSSIER_DECLARATION',     label: '↳ Onglet — Déclaration' },
            { code: 'DOSSIER_LIVRAISON',       label: '↳ Onglet — Mise en Livraison' },
            { code: 'DOSSIER_OTR',             label: '↳ Onglet — OTR (Transp.)' },
            { code: 'DOSSIER_BL',              label: '↳ Onglet — BL (Bordereau)' },
            { code: 'DOSSIER_DEVIS',           label: '↳ Onglet — Devis' },
            { code: 'DOSSIER_FACTURES_TIERS',  label: '↳ Onglet — Factures Tiers' },
            { code: 'DOSSIER_FACTURATION',     label: '↳ Onglet — Facturation' },
            { code: 'DOSSIER_ENVOI_FACTURES',  label: '↳ Onglet — Envoi Factures' },
            { code: 'DOSSIER_REGLEMENTS',      label: '↳ Onglet — Règlements' },
        ]
    },
    {
        label: 'Régimes Suspensifs (Sommiers)',
        color: '#0f766e',
        modules: [
            { code: 'SOMMIERS',   label: 'Gestion des Sommiers (création, suivi, résiliation)' },
            { code: 'ENTREPOTS',  label: 'Gestion des Entrepôts' },
            { code: 'APUREMENTS', label: 'Apurements (historique & saisie)' },
        ]
    },
    {
        label: 'Clients & Relations',
        color: '#1d4ed8',
        modules: [
            { code: 'CLIENTS', label: 'Gestion des Clients' },
            { code: 'TIERS',   label: 'Gestion des Tiers' },
        ]
    },
    {
        label: 'Finances',
        color: '#059669',
        modules: [
            { code: 'FACTURES', label: 'Factures & Règlements' },
            { code: 'FINANCES', label: 'Tableaux de bord financiers' },
        ]
    },
    {
        label: 'Catalogue & Tarifs',
        color: '#d97706',
        modules: [
            { code: 'PRODUITS', label: 'Référentiel Produits' },
            { code: 'TAXES',    label: 'Référentiel Taxes & Tarifs' },
        ]
    },
    {
        label: 'Administration',
        color: '#dc2626',
        modules: [
            { code: 'AGENTS',     label: 'Gestion des Agents' },
            { code: 'GROUPES',    label: 'Gestion des Groupes' },
            { code: 'STRUCTURES', label: 'Configuration Sociétés' },
        ]
    },
    {
        label: 'Référentiels',
        color: '#0891b2',
        modules: [
            { code: 'PAYS',     label: 'Référentiel Pays' },
            { code: 'DEVISES',  label: 'Référentiel Devises' },
            { code: 'REGIMES',  label: 'Référentiel Régimes & Unités' },
            { code: 'STATUTS',  label: 'Référentiel Étapes Dossiers' },
            { code: 'RUBRIQUES',label: 'Référentiel Rubriques' },
        ]
    },
    {
        label: 'Configuration Système',
        color: '#475569',
        modules: [
            { code: 'CONFIG',              label: 'Configuration Générale (moyens transport, lieux, types docs…)' },
            { code: 'PARAMETRES_GENERAUX', label: 'Paramètres Système (sauvegardes, codes couleurs)' },
        ]
    },
]

const ACTIONS = [
    { key: 'can_view',   label: 'Voir',      color: '#3b82f6' },
    { key: 'can_create', label: 'Créer',     color: '#10b981' },
    { key: 'can_edit',   label: 'Modifier',  color: '#f59e0b' },
    { key: 'can_delete', label: 'Supprimer', color: '#ef4444' },
]

export default function PermissionMatrix({ permissions = [], onChange, readOnly = false }) {
    const handleCheck = (moduleCode, action, checked) => {
        if (readOnly) return
        const newPermissions = [...permissions]
        const idx = newPermissions.findIndex(p => p.code === moduleCode)
        if (idx >= 0) {
            newPermissions[idx] = { ...newPermissions[idx], [action]: checked ? 1 : 0 }
        } else {
            newPermissions.push({ code: moduleCode, can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, [action]: checked ? 1 : 0 })
        }
        onChange(newPermissions)
    }

    const handleGroupCheck = (modules, action, checked) => {
        if (readOnly) return
        const newPermissions = [...permissions]
        for (const mod of modules) {
            const idx = newPermissions.findIndex(p => p.code === mod.code)
            if (idx >= 0) {
                newPermissions[idx] = { ...newPermissions[idx], [action]: checked ? 1 : 0 }
            } else {
                newPermissions.push({ code: mod.code, can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, [action]: checked ? 1 : 0 })
            }
        }
        onChange(newPermissions)
    }

    const getPerm = (code) =>
        permissions.find(p => p.code === code) || { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0 }

    const groupAllChecked = (modules, action) =>
        modules.every(m => getPerm(m.code)[action] === 1)

    const groupSomeChecked = (modules, action) =>
        modules.some(m => getPerm(m.code)[action] === 1)

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                    <tr style={{ background: '#0f172a' }}>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'white', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Module
                        </th>
                        {ACTIONS.map(a => (
                            <th key={a.key} style={{ padding: '0.75rem', textAlign: 'center', width: '90px', color: 'white', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {a.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {GROUPS.map(group => (
                        <>
                            {/* Group header row */}
                            <tr key={`group-${group.label}`} style={{ background: group.color + '18', borderTop: `2px solid ${group.color}40` }}>
                                <td style={{ padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.78rem', color: group.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {group.label}
                                </td>
                                {ACTIONS.map(a => {
                                    const allChecked = groupAllChecked(group.modules, a.key)
                                    const someChecked = groupSomeChecked(group.modules, a.key)
                                    return (
                                        <td key={a.key} style={{ textAlign: 'center', padding: '0.4rem' }}>
                                            {!readOnly && (
                                                <input
                                                    type="checkbox"
                                                    title={`Tout cocher "${a.label}" pour ${group.label}`}
                                                    checked={allChecked}
                                                    ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                                                    onChange={e => handleGroupCheck(group.modules, a.key, e.target.checked)}
                                                    style={{ accentColor: a.color, transform: 'scale(1.15)', cursor: 'pointer', opacity: 0.6 }}
                                                />
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                            {/* Module rows */}
                            {group.modules.map((module, i) => {
                                const perm = getPerm(module.code)
                                const isLast = i === group.modules.length - 1
                                return (
                                    <tr key={module.code} style={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9', background: 'white' }}>
                                        <td style={{ padding: '0.6rem 1rem 0.6rem 1.75rem', color: '#334155' }}>
                                            {module.label}
                                        </td>
                                        {ACTIONS.map(a => (
                                            <td key={a.key} style={{ textAlign: 'center', padding: '0.4rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={perm[a.key] === 1}
                                                    onChange={e => handleCheck(module.code, a.key, e.target.checked)}
                                                    disabled={readOnly}
                                                    style={{
                                                        accentColor: a.color,
                                                        transform: 'scale(1.2)',
                                                        cursor: readOnly ? 'not-allowed' : 'pointer'
                                                    }}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}
                        </>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
