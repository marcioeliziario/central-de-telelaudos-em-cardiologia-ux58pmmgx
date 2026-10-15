import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Activity,
  ShieldAlert,
  FileText,
  FileCheck,
  CheckCircle2,
  LogOut,
  Building,
  User,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Layout() {
  const { user, isAuthenticated, currentOrg, currentRole, logout, userOrgs, switchOrg } = useAuth()
  const location = useLocation()

  const generationDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-blue-900 selection:text-white">
      {/* BARRA SUPERIOR (HEADER) FIXA */}
      <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* TÍTULO INSTITUCIONAL */}
          <Link to="/" className="flex items-center gap-3 min-w-0 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0E4C92] to-[#00A6A6] flex items-center justify-center text-white shadow-md shadow-blue-900/10 shrink-0 group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#00A6A6] hidden sm:inline-block">
                  Telemedicina Diagnóstica
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline-block">•</span>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                  ECG 12 Derivações
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate leading-tight group-hover:text-[#0E4C92] transition-colors">
                CENTRAL DE TELELAUDOS EM CARDIOLOGIA
              </h1>
            </div>
          </Link>

          {/* ÁREA DE CONTROLE DE SESSÃO / NAVEGAÇÃO */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Link para Documentação de Auditoria */}
            <Link
              to="/auditoria"
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                location.pathname === '/auditoria'
                  ? 'bg-blue-50 border-blue-300 text-[#0E4C92]'
                  : 'bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Relatório de Auditoria</span>
            </Link>

            <Link
              to="/homologacao"
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                location.pathname === '/homologacao'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm'
                  : 'bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Homologação 4B</span>
            </Link>

            <Link
              to="/admin/teste-assinatura"
              className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                location.pathname === '/admin/teste-assinatura'
                  ? 'bg-blue-50 border-blue-400 text-[#0E4C92] shadow-sm'
                  : 'bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#0E4C92]" />
              <span>Teste ICP-Brasil (6B)</span>
            </Link>
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                {/* Seletor de Organização se tiver mais de uma */}
                {userOrgs.length > 1 && (
                  <select
                    value={currentOrg?.id || ''}
                    onChange={(e) => switchOrg(e.target.value)}
                    aria-label="Selecionar Organização Ativa"
                    className="text-xs bg-slate-100 border border-slate-300 rounded px-2 py-1 text-slate-700 cursor-pointer hidden md:block"
                  >
                    {userOrgs.map((uo) => (
                      <option key={uo.id} value={uo.organization_id}>
                        {uo.expand?.organization_id?.name || 'Organização'}
                      </option>
                    ))}
                  </select>
                )}

                {/* Usuário logado */}
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 truncate max-w-[140px]">
                    {user.name || user.email}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                    {currentOrg?.name || 'Central'}
                  </div>
                </div>

                <Button
                  onClick={logout}
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs text-slate-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 border-slate-200 gap-1.5"
                  title="Sair do sistema"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Sair</span>
                </Button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Etapa 5 — Portal, SLA & Notificações Ativos</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      {/* RODAPÉ DO SISTEMA */}
      <footer className="w-full bg-[#0E4C92] text-slate-200 border-t border-blue-950 mt-12 py-8 transition-colors">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-white font-semibold">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Diretriz Operacional — Etapa 5 (Portal de Resultados, SLA e Notificações)</span>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Ambiente de homologação estrita com dados fictícios. Portal de resultados isolado,
              controle de prazos contratuais (SLA 24h/2h), notificações internas automáticas e
              downloads seguros com validação criptográfica estrita PAdES. Sem provedores de
              assinatura ativados e sem publicação para operação clínica real.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 text-xs text-slate-300 shrink-0">
            <div className="flex items-center gap-2">
              <Link
                to="/admin/teste-assinatura"
                className="flex items-center gap-1.5 bg-blue-950/80 hover:bg-blue-900 px-3 py-1.5 rounded-md border border-blue-700 transition-colors text-white text-xs font-bold"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Teste ICP-Brasil (6B)</span>
              </Link>
              <Link
                to="/homologacao"
                className="flex items-center gap-1.5 bg-blue-950/60 hover:bg-blue-900 px-3 py-1.5 rounded-md border border-blue-800 transition-colors text-white text-xs"
              >
                <FileText className="w-3.5 h-3.5 text-[#00A6A6]" />
                <span>Painel 4B</span>
              </Link>
            </div>{' '}
            <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Etapa 5 Homologada</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
