import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usersAPI, groupesAPI } from '../services/api'
import PermissionMatrix from '../components/PermissionMatrix'
import {
    Save, User, Mail, Phone, Smartphone, MapPin, Briefcase,
    Key, Shield, Lock, Info, CheckCircle2, AlertCircle,
    ArrowLeft, UserCircle, Users, ShieldCheck, Settings2
} from 'lucide-react'

const GRAD  = 'linear-gradient(135deg,#312e81 0%,#4338ca 50%,#6366f1 100%)'
const ACC   = '#4338ca'
const ACC2  = '#6366f1'
const LIGHT = '#eef2ff'
const BORDER= '#c7d2fe'

/* ── Input style ── */
const inp = {
    width:'100%', padding:'0.7rem 0.9rem', border:'1px solid #e2e8f0',
    borderRadius:'0.625rem', fontSize:'0.875rem', background:'#f8fafc',
    outline:'none', boxSizing:'border-box', fontFamily:'inherit', transition:'all 0.2s'
}
const inpIcon = { ...inp, paddingLeft:'2.4rem' }

/* ── Field wrapper ── */
const Field = ({ label, required, icon: Icon, children, span = 1 }) => (
    <div style={{ gridColumn:`span ${span}` }}>
        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
            {label}{required && <span style={{ color:ACC2, marginLeft:3 }}>*</span>}
        </label>
        {Icon ? (
            <div style={{ position:'relative' }}>
                <Icon size={13} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
                {children}
            </div>
        ) : children}
    </div>
)

/* ── Section card ── */
const Section = ({ icon: Icon, title, color = ACC, children }) => (
    <div style={{ background:'white', borderRadius:'1rem', border:`1px solid ${BORDER}`, boxShadow:`0 2px 12px ${ACC}10`, overflow:'hidden' }}>
        <div style={{ padding:'0.875rem 1.5rem', background:LIGHT, borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', gap:'0.625rem' }}>
            <Icon size={14} color={color}/>
            <span style={{ fontSize:'0.7rem', fontWeight:800, color, textTransform:'uppercase', letterSpacing:'0.08em' }}>{title}</span>
        </div>
        <div style={{ padding:'1.5rem' }}>{children}</div>
    </div>
)

/* ── Toast ── */
function Toast({ toasts }) {
    return (
        <div style={{ position:'fixed', bottom:'2rem', right:'2rem', zIndex:300, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {toasts.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1.25rem', background:t.type==='success'?'#ecfdf5':'#fef2f2', border:`1px solid ${t.type==='success'?'#6ee7b7':'#fca5a5'}`, color:t.type==='success'?'#065f46':'#991b1b', borderRadius:'0.875rem', boxShadow:'0 10px 25px rgba(0,0,0,.12)', fontWeight:600, fontSize:'0.875rem', animation:'slideUp .3s ease' }}>
                    {t.type==='success'?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>} {t.msg}
                </div>
            ))}
        </div>
    )
}

export default function UserForm() {
    const navigate = useNavigate()
    const { id }   = useParams()
    const isEdit   = Boolean(id)

    const [loading, setLoading]               = useState(isEdit)
    const [saving, setSaving]                 = useState(false)
    const [groupes, setGroupes]               = useState([])
    const [permissions, setPermissions]       = useState([])
    const [allPermissions, setAllPermissions] = useState([])
    const [toasts, setToasts]                 = useState([])

    const [formData, setFormData] = useState({
        NomAgent:'', Email:'', Login:'', password:'', role:'USER',
        FonctionAgent:'', Tel:'', Cel:'', adresse:'', IDGroupes:'',
        recevoir_alerte_suspension: false
    })

    useEffect(() => {
        loadGroupes()
        loadAllPermissions()
        if (isEdit) loadUser()
    }, [id])

    const loadGroupes = async () => {
        try { setGroupes((await groupesAPI.getAll()).data) } catch {}
    }
    const loadAllPermissions = async () => {
        try { setAllPermissions((await usersAPI.getPermissionsList()).data) } catch {}
    }
    const loadUser = async () => {
        try {
            const user = (await usersAPI.getOne(id)).data
            setFormData({
                NomAgent: user.name || '', Email: user.email || '',
                Login: user.login || '', password: '', role: user.role || 'USER',
                FonctionAgent: user.function || '', Tel: user.phone || '',
                Cel: user.mobile || '', adresse: user.address || '',
                IDGroupes: user.IDGroupes || '',
                recevoir_alerte_suspension: !!user.recevoir_alerte_suspension
            })
            try { setPermissions((await usersAPI.getPermissions(id)).data) } catch {}
        } catch { toast('error', "Impossible de charger l'utilisateur") }
        finally { setLoading(false) }
    }

    const toast = (type, msg) => {
        const id2 = Date.now()
        setToasts(p => [...p, { id: id2, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id2)), 4000)
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            let userId = id
            if (isEdit) {
                await usersAPI.update(id, formData)
            } else {
                const r = await usersAPI.create(formData)
                userId = r.data.id
            }
            if (permissions.length > 0) {
                const toSave = permissions.map(p => {
                    if (p.permission_id) return p
                    const def = allPermissions.find(ap => ap.code === p.code)
                    return { ...p, permission_id: def ? def.id : null }
                }).filter(p => p.permission_id)
                await usersAPI.updatePermissions(userId, toSave)
            }
            toast('success', isEdit ? 'Agent modifié avec succès' : 'Agent créé avec succès')
            setTimeout(() => navigate('/users'), 1500)
        } catch (err) {
            toast('error', err.response?.data?.error || "Erreur lors de l'enregistrement")
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#f8fafc' }}>
            <div style={{ textAlign:'center' }}>
                <div style={{ width:40, height:40, border:`3px solid ${LIGHT}`, borderTopColor:ACC, borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 12px' }}/>
                <div style={{ fontSize:14, color:ACC, fontWeight:600 }}>Chargement…</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    return (
        <div style={{ minHeight:'100vh', background:'#f8fafc', paddingBottom:'5rem' }}>
            <style>{`
                @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes spin{to{transform:rotate(360deg)}}
                .uf-inp:focus{border-color:${ACC2}!important;background:white!important;box-shadow:0 0 0 3px ${LIGHT}!important}
                .uf-sel:focus{border-color:${ACC2}!important;outline:none!important;box-shadow:0 0 0 3px ${LIGHT}!important}
            `}</style>

            {/* ── Hero ── */}
            <div style={{ background:GRAD, padding:'2.5rem 2.5rem 5rem', position:'relative', overflow:'hidden' }}>
                {[['15%','15%',260,'rgba(99,102,241,.3)'],['72%','45%',200,'rgba(67,56,202,.25)']].map(([l,t,s,c],i)=>(
                    <div key={i} style={{ position:'absolute', left:l, top:t, width:s, height:s, borderRadius:'50%', background:c, filter:'blur(65px)', pointerEvents:'none' }}/>
                ))}
                <div style={{ maxWidth:1000, margin:'0 auto', position:'relative' }}>
                    <button onClick={() => navigate('/users')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', borderRadius:'2rem', padding:'0.375rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'1.5rem', backdropFilter:'blur(8px)' }}>
                        <ArrowLeft size={14}/> Liste des agents
                    </button>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                                <div style={{ background:'rgba(255,255,255,.2)', borderRadius:'0.875rem', padding:'0.625rem' }}>
                                    <UserCircle size={28} color="white"/>
                                </div>
                                <h1 style={{ margin:0, color:'white', fontWeight:800, fontSize:'1.875rem', letterSpacing:'-.02em' }}>
                                    {isEdit ? "Profil de l'Agent" : 'Recrutement Nouvel Agent'}
                                </h1>
                            </div>
                            <p style={{ margin:0, color:'rgba(255,255,255,.75)', fontSize:'0.9rem' }}>
                                {isEdit ? `Modification du profil — ${formData.NomAgent}` : 'Créez un nouveau compte agent et définissez ses droits d\'accès'}
                            </p>
                        </div>
                        {/* Badges rôle */}
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            <div style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                <Shield size={16} color="rgba(255,255,255,.85)"/>
                                <div>
                                    <div style={{ color:'white', fontWeight:800, fontSize:'0.9rem', lineHeight:1 }}>
                                        {formData.role === 'ADMIN' ? 'Administrateur' : formData.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Collaborateur'}
                                    </div>
                                    <div style={{ color:'rgba(255,255,255,.6)', fontSize:'0.68rem', fontWeight:600, marginTop:'0.2rem' }}>Rôle actuel</div>
                                </div>
                            </div>
                            <div style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'0.875rem', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.625rem' }}>
                                <ShieldCheck size={16} color="rgba(255,255,255,.85)"/>
                                <div>
                                    <div style={{ color:'white', fontWeight:800, fontSize:'0.9rem', lineHeight:1 }}>{permissions.filter(p => p.can_view).length || '—'}</div>
                                    <div style={{ color:'rgba(255,255,255,.6)', fontSize:'0.68rem', fontWeight:600, marginTop:'0.2rem' }}>Permissions</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleSubmit}>
                <div style={{ maxWidth:1000, margin:'-3.5rem auto 0', padding:'0 2.5rem', position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:'1.5rem' }}>

                    {/* ── Identité ── */}
                    <Section icon={UserCircle} title="Identité Personnelle">
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'1.25rem' }}>
                            <Field label="Prénom & Nom" required icon={User} span={8}>
                                <input name="NomAgent" className="uf-inp" style={inpIcon} required
                                    placeholder="Nom complet de l'agent"
                                    value={formData.NomAgent} onChange={handleChange}/>
                            </Field>
                            <Field label="Fonction / Poste" icon={Briefcase} span={4}>
                                <input name="FonctionAgent" className="uf-inp" style={inpIcon}
                                    placeholder="Ex: Déclarant Sénior"
                                    value={formData.FonctionAgent} onChange={handleChange}/>
                            </Field>
                            <Field label="Adresse Email" required icon={Mail} span={6}>
                                <input type="email" name="Email" className="uf-inp" style={inpIcon} required
                                    placeholder="email@domaine.com"
                                    value={formData.Email} onChange={handleChange}/>
                            </Field>
                            <Field label="Téléphone Fixe" icon={Phone} span={3}>
                                <input name="Tel" className="uf-inp" style={inpIcon}
                                    value={formData.Tel} onChange={handleChange}/>
                            </Field>
                            <Field label="Mobile Direct" icon={Smartphone} span={3}>
                                <input name="Cel" className="uf-inp" style={inpIcon}
                                    value={formData.Cel} onChange={handleChange}/>
                            </Field>
                            <Field label="Adresse Domicile" icon={MapPin} span={12}>
                                <input name="adresse" className="uf-inp" style={inpIcon}
                                    placeholder="Adresse complète…"
                                    value={formData.adresse} onChange={handleChange}/>
                            </Field>
                        </div>
                    </Section>

                    {/* ── Compte ── */}
                    <Section icon={Lock} title="Compte & Accès Système">
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'1.25rem' }}>
                            <Field label="Nom d'utilisateur (Login)" required icon={Key} span={4}>
                                <input name="Login" className="uf-inp" style={inpIcon} required
                                    placeholder="Identifiant unique"
                                    value={formData.Login} onChange={handleChange}/>
                            </Field>
                            <Field label={isEdit ? 'Mot de passe (vide = inchangé)' : 'Mot de passe'} required={!isEdit} icon={Lock} span={4}>
                                <input type="password" name="password" className="uf-inp" style={inpIcon}
                                    required={!isEdit} autoComplete="new-password"
                                    placeholder={isEdit ? 'Laisser vide pour ne pas modifier' : '••••••••'}
                                    value={formData.password} onChange={handleChange}/>
                            </Field>
                            <Field label="Rôle d'Accès Global" required span={4}>
                                <select name="role" className="uf-sel" style={{ ...inp, appearance:'auto', cursor:'pointer' }} required
                                    value={formData.role} onChange={handleChange}>
                                    <option value="USER">Collaborateur (Droits restreints)</option>
                                    <option value="ADMIN">Administrateur (Contrôle total)</option>
                                </select>
                            </Field>
                            <Field label="Service / Groupe de Travail" icon={Users} span={9}>
                                <select name="IDGroupes" className="uf-sel" style={{ ...inp, paddingLeft:'2.4rem', appearance:'auto', cursor:'pointer' }}
                                    value={formData.IDGroupes} onChange={handleChange}>
                                    <option value="">Affectation par défaut</option>
                                    {groupes.map(g => <option key={g.IDGroupes} value={g.IDGroupes}>{g.LibelleGroupe}</option>)}
                                </select>
                            </Field>
                            <Field label="Alertes suspensions" span={3}>
                                <label style={{ display:'flex', alignItems:'center', gap:'0.6rem', cursor:'pointer', padding:'0.65rem 0.875rem', border:`1px solid ${formData.recevoir_alerte_suspension ? '#6366f1' : '#e5e7eb'}`, borderRadius:'0.5rem', background: formData.recevoir_alerte_suspension ? '#eef2ff' : 'transparent', transition:'all .15s' }}>
                                    <input type="checkbox" name="recevoir_alerte_suspension"
                                        checked={formData.recevoir_alerte_suspension}
                                        onChange={handleChange}
                                        style={{ width:'1.1rem', height:'1.1rem', accentColor:'#6366f1', cursor:'pointer' }}/>
                                    <span style={{ fontSize:'0.85rem', fontWeight:600, color:'#4338ca' }}>🔔 Recevoir alertes suspensifs</span>
                                </label>
                            </Field>
                        </div>
                    </Section>

                    {/* ── Permissions ── */}
                    <div style={{ background:'white', borderRadius:'1rem', border:`1px solid ${BORDER}`, boxShadow:`0 2px 12px ${ACC}10`, overflow:'hidden' }}>
                        <div style={{ background:GRAD, padding:'1rem 1.5rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                            <div style={{ background:'rgba(255,255,255,.2)', borderRadius:'0.625rem', padding:'0.5rem', display:'flex' }}>
                                <Shield size={16} color="white"/>
                            </div>
                            <span style={{ color:'white', fontWeight:700 }}>Matrice des Permissions</span>
                        </div>

                        {/* Info banner */}
                        <div style={{ margin:'1.25rem 1.5rem 0', padding:'0.875rem 1rem', background: formData.role==='ADMIN' ? '#fefce8' : LIGHT, border:`1px solid ${formData.role==='ADMIN' ? '#fde68a' : BORDER}`, borderRadius:'0.75rem', display:'flex', gap:'0.625rem', alignItems:'flex-start' }}>
                            <Info size={14} color={formData.role==='ADMIN' ? '#b45309' : ACC} style={{ flexShrink:0, marginTop:1 }}/>
                            <p style={{ margin:0, fontSize:'0.8rem', color: formData.role==='ADMIN' ? '#92400e' : '#3730a3', lineHeight:1.5, fontWeight:500 }}>
                                {formData.role === 'ADMIN'
                                    ? "Les administrateurs héritent de tous les privilèges. Vous pouvez néanmoins affiner ces droits ci-dessous."
                                    : "Définissez précisément les modules auxquels cet agent peut accéder en cochant les droits correspondants."}
                            </p>
                        </div>

                        <div style={{ padding:'1.25rem 1.5rem 1.5rem' }}>
                            <div style={{ background:'#f8fafc', borderRadius:'0.75rem', border:`1px solid ${BORDER}`, padding:'1rem' }}>
                                <PermissionMatrix permissions={permissions} onChange={setPermissions}/>
                            </div>
                        </div>
                    </div>

                    {/* ── Footer actions ── */}
                    <div style={{ background:'white', borderRadius:'1rem', border:`1px solid ${BORDER}`, padding:'1.25rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:`0 2px 12px ${ACC}10` }}>
                        <div style={{ fontSize:'0.8rem', color:'#94a3b8', fontWeight:500 }}>
                            {isEdit ? `Modification de : ${formData.NomAgent}` : 'Nouvel agent · Rôle : ' + (formData.role === 'ADMIN' ? 'Administrateur' : 'Collaborateur')}
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem' }}>
                            <button type="button" onClick={() => navigate('/users')}
                                style={{ padding:'0.75rem 1.5rem', background:'white', border:'1px solid #e2e8f0', borderRadius:'0.75rem', fontWeight:600, color:'#64748b', cursor:'pointer', fontSize:'0.875rem' }}>
                                Annuler
                            </button>
                            <button type="submit" disabled={saving}
                                style={{ padding:'0.75rem 2rem', background:GRAD, color:'white', border:'none', borderRadius:'0.75rem', fontWeight:700, cursor:saving?'not-allowed':'pointer', fontSize:'0.875rem', display:'flex', alignItems:'center', gap:'0.5rem', opacity:saving?0.7:1, boxShadow:`0 4px 14px ${ACC}40`, transition:'all .2s' }}>
                                <Save size={15}/>
                                {saving ? 'Enregistrement…' : isEdit ? 'Sauvegarder les modifications' : "Créer l'agent"}
                            </button>
                        </div>
                    </div>

                </div>
            </form>

            <Toast toasts={toasts}/>
        </div>
    )
}
