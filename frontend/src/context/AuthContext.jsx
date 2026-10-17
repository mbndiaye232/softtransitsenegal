import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI, usersAPI, devisesAPI } from '../services/api'
import { setReferenceCurrency } from '../utils/currency'

const AuthContext = createContext(null)

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

export const AuthProvider = ({ children }) => {
    const [user, setUser]                       = useState(null)
    const [loading, setLoading]                 = useState(true)
    // userPermissions : { CODE: { can_view, can_create, can_edit, can_delete } }
    // null = accès total (SUPER_ADMIN / ADMIN), {} = aucune permission assignée
    const [userPermissions, setUserPermissions] = useState(null)
    const [fullAccess, setFullAccess]           = useState(false)

    /* ── Charger les permissions de l'utilisateur connecté ── */
    const loadPermissions = useCallback(async () => {
        try {
            const r = await usersAPI.getMyPermissions()
            const { fullAccess: fa, permissions } = r.data
            setFullAccess(fa)
            if (fa) {
                setUserPermissions(null) // null = accès illimité
            } else {
                const map = {}
                permissions.forEach(p => { map[p.code] = p })
                setUserPermissions(map)
            }
        } catch {
            setUserPermissions({}) // en cas d'erreur réseau : aucune permission
        }
    }, [])

    /* ── Charger la devise de référence courante (symbole affiché dynamique) ── */
    const loadReferenceCurrency = useCallback(async () => {
        try {
            const r = await devisesAPI.getAll()
            setReferenceCurrency(r.data)
        } catch {
            // repli silencieux : currency.js garde son symbole par défaut
        }
    }, [])

    /* ── Vérifier si l'utilisateur peut voir une fonctionnalité ── */
    const canView = useCallback((permCode) => {
        if (!permCode) return true            // pas de restriction
        if (fullAccess) return true           // SUPER_ADMIN / ADMIN
        if (userPermissions === null) return true // chargement en cours
        const p = userPermissions[permCode]
        return !!(p && p.can_view)
    }, [fullAccess, userPermissions])

    useEffect(() => {
        const token = localStorage.getItem('token')
        const savedUser = localStorage.getItem('user')

        if (token && savedUser) {
            setUser(JSON.parse(savedUser))
            authAPI.getMe()
                .then(response => {
                    setUser(response.data.user)
                    localStorage.setItem('user', JSON.stringify(response.data.user))
                    return Promise.all([loadPermissions(), loadReferenceCurrency()])
                })
                .catch(() => logout())
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, []) // eslint-disable-line

    const login = async (credentials) => {
        const response = await authAPI.login(credentials)
        const { token, user } = response.data
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        setUser(user)
        await Promise.all([loadPermissions(), loadReferenceCurrency()])
        return response.data
    }

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
        setUserPermissions(null)
        setFullAccess(false)
    }

    const value = {
        user,
        loading,
        login,
        logout,
        userPermissions,
        fullAccess,
        canView,
        loadPermissions,
        loadReferenceCurrency,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
