/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import CentralDashboard from './pages/CentralDashboard'
import HomologationPage from './pages/HomologationPage'
import AdminBirdIdTestPage from './pages/AdminBirdIdTestPage'
import AdminInfrastructureAuditPage from './pages/AdminInfrastructureAuditPage'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

// ONLY IMPORT AND RENDER WORKING PAGES, NEVER ADD PLACEHOLDER COMPONENTS OR PAGES IN THIS FILE
// AVOID REMOVING ANY CONTEXT PROVIDERS FROM THIS FILE (e.g. TooltipProvider, Toaster, Sonner)

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            {/* Rota "/" agora é o Painel Central de Telelaudos com autenticação e isolamento multi-tenant */}
            <Route path="/" element={<CentralDashboard />} />
            {/* Relatório técnico original de auditoria preservado em /auditoria */}
            <Route path="/auditoria" element={<Index />} />
            {/* Relatório da Etapa 4B de Homologação de PDF & Assinatura Digital ICP-Brasil */}
            <Route path="/homologacao" element={<HomologationPage />} />
            {/* Painel Administrativo de Teste de Assinatura ICP-Brasil (Bird ID Pro / Soluti CESS - Etapa 6B) */}
            <Route path="/admin/teste-assinatura" element={<AdminBirdIdTestPage />} />
            {/* Painel Administrativo de Auditoria de Infraestrutura & Segurança - Etapa 8 */}
            <Route path="/admin/auditoria-infra" element={<AdminInfrastructureAuditPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
