/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import CentralDashboard from './pages/CentralDashboard'
import HomologationPage from './pages/HomologationPage'
import AdminBirdIdTestPage from './pages/AdminBirdIdTestPage'
import AdminInfrastructureAuditPage from './pages/AdminInfrastructureAuditPage'
import { AdminBackupContinuityPage } from './pages/AdminBackupContinuityPage'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

// Componente Guard para rotas restritas técnicas/administrativas
const AdminRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, availableRoles, user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-2 border-[#4A90D9] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#6F7780] font-medium">Verificando autorização...</p>
      </div>
    )
  }

  // Não autenticado -> Redireciona para "/" (onde é renderizada a tela de Login limpa)
  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />
  }

  // Autenticado mas sem perfil administrativo autorizado
  if (!availableRoles.includes('admin')) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <span className="font-bold text-sm">403</span>
          </div>
          <h2 className="text-sm font-bold text-red-900">Acesso Restrito à Administração</h2>
          <p className="text-xs text-red-700 leading-relaxed">
            Esta rota técnica é de acesso exclusivo para administradores da Central de Telelaudos.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            {/* Rota "/" é o Painel Central de Telelaudos com autenticação e isolamento multi-tenant */}
            <Route path="/" element={<CentralDashboard />} />
            {/* Relatório técnico original de auditoria preservado em /auditoria (protegido por guard admin) */}
            <Route
              path="/auditoria"
              element={
                <AdminRouteGuard>
                  <Index />
                </AdminRouteGuard>
              }
            />
            {/* Relatório da Etapa 4B de Homologação de PDF & Assinatura Digital ICP-Brasil */}
            <Route
              path="/homologacao"
              element={
                <AdminRouteGuard>
                  <HomologationPage />
                </AdminRouteGuard>
              }
            />
            {/* Painel Administrativo de Teste de Assinatura ICP-Brasil (Bird ID Pro / Soluti CESS - Etapa 6B) */}
            <Route
              path="/admin/teste-assinatura"
              element={
                <AdminRouteGuard>
                  <AdminBirdIdTestPage />
                </AdminRouteGuard>
              }
            />
            {/* Painel Administrativo de Auditoria de Infraestrutura & Segurança - Etapa 8 */}
            <Route
              path="/admin/auditoria-infra"
              element={
                <AdminRouteGuard>
                  <AdminInfrastructureAuditPage />
                </AdminRouteGuard>
              }
            />
            {/* Painel de Backup, Restauração & Continuidade Operacional - Etapa 10 */}
            <Route
              path="/admin/backup-continuidade"
              element={
                <AdminRouteGuard>
                  <AdminBackupContinuityPage />
                </AdminRouteGuard>
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
