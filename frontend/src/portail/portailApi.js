import axios from 'axios'

// Portail client : jeton et API distincts de ceux du personnel (clé « portail_token », routes /api/portail)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
export const TOKEN_KEY = 'portail_token'

const portailApi = axios.create({ baseURL: `${API_URL}/portail` })

portailApi.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// Session expirée ou accès suspendu : retour à la page de connexion du portail
portailApi.interceptors.response.use(
    (r) => r,
    (error) => {
        const url = error.config?.url || ''
        if (error.response?.status === 401 && localStorage.getItem(TOKEN_KEY) && !url.startsWith('/auth/')) {
            localStorage.removeItem(TOKEN_KEY)
            window.location.assign('/portail')
        }
        return Promise.reject(error)
    }
)

export const messageErreur = (error, defaut = 'Une erreur est survenue.') => error.response?.data?.error || defaut

/** Télécharge un fichier en envoyant le jeton (un simple lien ne le pourrait pas) ; le nom vient du serveur. */
export async function telecharger(chemin, nomParDefaut) {
    const res = await portailApi.get(chemin, { responseType: 'blob' })
    const cd = res.headers['content-disposition'] || ''
    const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) || /filename="?([^";]+)"?/i.exec(cd)
    const url = URL.createObjectURL(res.data)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = m ? decodeURIComponent(m[1]) : nomParDefaut
    document.body.appendChild(lien)
    lien.click()
    lien.remove()
    URL.revokeObjectURL(url)
}

export default portailApi
