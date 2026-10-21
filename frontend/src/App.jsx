import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import FloatingNav from './components/FloatingNav'
import AssistantWidget from './components/AssistantWidget'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CompanySettings from './pages/CompanySettings'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ClientForm from './pages/ClientForm'
import ClientList from './pages/ClientList'
import StatusList from './pages/StatusList'
import GroupList from './pages/GroupList'
import UserList from './pages/UserList'
import UserForm from './pages/UserForm'
import DossierCreate from './pages/DossierCreate'
import DossierEdit from './pages/DossierEdit'
import DossierList from './pages/DossierList'
import NoteDeDetail from './pages/NoteDeDetail'
import ProductList from './pages/ProductList'
import TiersPage from './pages/TiersPage'
import CotationPage from './pages/CotationPage'
import OrdreTransitPage from './pages/OrdreTransitPage'
import ReferenceDataOTPage from './pages/ReferenceDataOTPage'
import SettingsHub from './pages/SettingsHub'
import EtatsFinanciers from './pages/EtatsFinanciers'
import SuiviDossiers from './pages/SuiviDossiers'
import SuiviTraitements from './pages/SuiviTraitements'
import DocumentManager from './pages/DocumentManager'
import DecisionDashboard from './pages/DecisionDashboard'
import BackupManager from './pages/BackupManager'
import TarifsManager from './pages/TarifsManager'
import ComptesMailsPage from './pages/ComptesMailsPage'
import MoyensTransportPage from './pages/MoyensTransportPage'
import LieuxPage from './pages/LieuxPage'
import EtapesDossiersPage from './pages/EtapesDossiersPage'
import PaysPage from './pages/PaysPage'
import TypesTransportPage from './pages/TypesTransportPage'
import RubriquesPage from './pages/RubriquesPage'
import DevisesPage from './pages/DevisesPage'
import TypesDocumentsManager from './pages/TypesDocumentsManager'
import StatutsOrgPage from './pages/StatutsOrgPage'
import ModesReglementsPage from './pages/ModesReglementsPage'
import UnitesPoidsPage from './pages/UnitesPoidsPage'
import UnitesVolumePage from './pages/UnitesVolumePage'
import RegimesDeclarationPage from './pages/RegimesDeclarationPage'
import CouleursPage from './pages/CouleursPage'
import ReglementsPage from './pages/ReglementsPage'
import SuiviFacturesClient from './pages/SuiviFacturesClient'
import CancellationManager from './pages/CancellationManager'
import TransportArrivals from './pages/TransportArrivals'
import SommiersPage from './pages/SommiersPage'
import EntrepotsPage from './pages/EntrepotsPage'
import HistoriqueSommiersPage from './pages/HistoriqueSommiersPage'
import PortailLogin from './portail/PortailLogin'
import PortailReset from './portail/PortailReset'
import PortailConfirmer from './portail/PortailConfirmer'
import PortailLayout from './portail/PortailLayout'
import PortailDossiers from './portail/PortailDossiers'
import PortailDossier from './portail/PortailDossier'
import PortailFactures from './portail/PortailFactures'
import PortailAdmin from './pages/PortailAdmin'

// Portail client (option) : pages publiques sous /portail, activées par VITE_PORTAIL_CLIENT=true
const PORTAIL_ACTIF = import.meta.env.VITE_PORTAIL_CLIENT === 'true'

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth()
    if (loading) return <div className="loading">Chargement...</div>
    return user ? children : <Navigate to="/login" />
}

const ProtectedLayout = ({ children }) => (
    <ProtectedRoute>
        <FloatingNav />
        <AssistantWidget />
        {children}
    </ProtectedRoute>
)

function AppRoutes() {
    return (
        <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* App */}
            <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><CompanySettings /></ProtectedLayout>} />
            <Route path="/company-settings" element={<ProtectedLayout><CompanySettings /></ProtectedLayout>} />
            <Route path="/statuts" element={<ProtectedLayout><StatusList /></ProtectedLayout>} />
            <Route path="/groupes" element={<ProtectedLayout><GroupList /></ProtectedLayout>} />
            <Route path="/users" element={<ProtectedLayout><UserList /></ProtectedLayout>} />
            <Route path="/users/new" element={<ProtectedLayout><UserForm /></ProtectedLayout>} />
            <Route path="/users/:id" element={<ProtectedLayout><UserForm /></ProtectedLayout>} />
            <Route path="/clients" element={<ProtectedLayout><ClientList /></ProtectedLayout>} />
            <Route path="/clients/new" element={<ProtectedLayout><ClientForm /></ProtectedLayout>} />
            <Route path="/clients/:id" element={<ProtectedLayout><ClientForm /></ProtectedLayout>} />
            <Route path="/tiers" element={<ProtectedLayout><TiersPage /></ProtectedLayout>} />
            <Route path="/cotations" element={<ProtectedLayout><CotationPage /></ProtectedLayout>} />
            <Route path="/ordres-transit" element={<ProtectedLayout><OrdreTransitPage /></ProtectedLayout>} />
            <Route path="/config-transit" element={<ProtectedLayout><ReferenceDataOTPage /></ProtectedLayout>} />
            <Route path="/dossiers" element={<ProtectedLayout><DossierList /></ProtectedLayout>} />
            <Route path="/dossiers/new" element={<ProtectedLayout><DossierCreate /></ProtectedLayout>} />
            <Route path="/dossiers/:id" element={<ProtectedLayout><DossierEdit /></ProtectedLayout>} />
            <Route path="/notes" element={<ProtectedLayout><NoteDeDetail /></ProtectedLayout>} />
            <Route path="/produits" element={<ProtectedLayout><ProductList /></ProtectedLayout>} />
            <Route path="/parameters-hub" element={<ProtectedLayout><SettingsHub /></ProtectedLayout>} />
            <Route path="/etats-financiers" element={<ProtectedLayout><EtatsFinanciers /></ProtectedLayout>} />
            <Route path="/reglements" element={<ProtectedLayout><ReglementsPage /></ProtectedLayout>} />
            <Route path="/suivi-factures" element={<ProtectedLayout><SuiviFacturesClient /></ProtectedLayout>} />
            <Route path="/reglements/cancellation" element={<ProtectedLayout><CancellationManager /></ProtectedLayout>} />
            <Route path="/suivi-dossiers" element={<ProtectedLayout><SuiviDossiers /></ProtectedLayout>} />
            <Route path="/documents" element={<ProtectedLayout><DocumentManager /></ProtectedLayout>} />
            <Route path="/decision-dashboard" element={<ProtectedLayout><DecisionDashboard /></ProtectedLayout>} />
            <Route path="/backups" element={<ProtectedLayout><BackupManager /></ProtectedLayout>} />
            {PORTAIL_ACTIF && <Route path="/portail" element={<PortailLogin />} />}
            {PORTAIL_ACTIF && <Route path="/portail/reinitialiser" element={<PortailReset />} />}
            {PORTAIL_ACTIF && <Route path="/portail/confirmer" element={<PortailConfirmer />} />}
            {PORTAIL_ACTIF && <Route path="/portail/dossiers" element={<PortailLayout><PortailDossiers /></PortailLayout>} />}
            {PORTAIL_ACTIF && <Route path="/portail/dossiers/:id" element={<PortailLayout><PortailDossier /></PortailLayout>} />}
            {PORTAIL_ACTIF && <Route path="/portail/factures" element={<PortailLayout><PortailFactures /></PortailLayout>} />}
            {PORTAIL_ACTIF && <Route path="/portail-admin" element={<ProtectedLayout><PortailAdmin /></ProtectedLayout>} />}
            <Route path="/suivi-traitements" element={<ProtectedLayout><SuiviTraitements /></ProtectedLayout>} />
            <Route path="/transport-arrivals" element={<ProtectedLayout><TransportArrivals /></ProtectedLayout>} />
            <Route path="/tarifs" element={<ProtectedLayout><TarifsManager /></ProtectedLayout>} />
            <Route path="/sommiers" element={<ProtectedLayout><SommiersPage /></ProtectedLayout>} />
            <Route path="/entrepots" element={<ProtectedLayout><EntrepotsPage /></ProtectedLayout>} />
            <Route path="/historique-sommiers" element={<ProtectedLayout><HistoriqueSommiersPage /></ProtectedLayout>} />
            <Route path="/regime-suspensif" element={<Navigate to="/sommiers" />} />

            {/* ── Settings hub sub-pages ── */}
            <Route path="/comptes-mails"         element={<ProtectedLayout><ComptesMailsPage /></ProtectedLayout>} />
            <Route path="/moyens-transport"       element={<ProtectedLayout><MoyensTransportPage /></ProtectedLayout>} />
            <Route path="/lieux"                  element={<ProtectedLayout><LieuxPage /></ProtectedLayout>} />
            <Route path="/etapes-dossiers"        element={<ProtectedLayout><EtapesDossiersPage /></ProtectedLayout>} />
            <Route path="/pays"                   element={<ProtectedLayout><PaysPage /></ProtectedLayout>} />
            <Route path="/types-transport"        element={<ProtectedLayout><TypesTransportPage /></ProtectedLayout>} />
            <Route path="/rubriques"              element={<ProtectedLayout><RubriquesPage /></ProtectedLayout>} />
            <Route path="/devises"                element={<ProtectedLayout><DevisesPage /></ProtectedLayout>} />
            <Route path="/types-documents"        element={<ProtectedLayout><TypesDocumentsManager /></ProtectedLayout>} />
            <Route path="/statuts-organisations"  element={<ProtectedLayout><StatutsOrgPage /></ProtectedLayout>} />
            <Route path="/modes-reglement"        element={<ProtectedLayout><ModesReglementsPage /></ProtectedLayout>} />
            <Route path="/unites-poids"           element={<ProtectedLayout><UnitesPoidsPage /></ProtectedLayout>} />
            <Route path="/unites-volume"          element={<ProtectedLayout><UnitesVolumePage /></ProtectedLayout>} />
            <Route path="/regimes-declaration"    element={<ProtectedLayout><RegimesDeclarationPage /></ProtectedLayout>} />
            <Route path="/codes-couleurs"         element={<ProtectedLayout><CouleursPage /></ProtectedLayout>} />

            <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
    )
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </Router>
    )
}

export default App
