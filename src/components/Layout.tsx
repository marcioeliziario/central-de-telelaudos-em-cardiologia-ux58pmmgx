import React, { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Activity,
  ShieldCheck,
  FileText,
  FileCheck,
  CheckCircle2,
  LogOut,
  Building2,
  Server,
  HardDrive,
  LayoutDashboard,
  Menu,
  X,
  ChevronRight,
  User,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrandLogo } from '@/components/BrandLogo'
import { APP_CONFIG } from '@/config/appConfig'
import { PenTool, Settings, Inbox, Clock } from 'lucide-react'

export default function Layout() {
  const {
    user,
    isAuthenticated,
    currentOrg,
    currentRole,
    logout,
    userOrgs,
    switchOrg,
    activeEnvironment,
    switchEnvironment,
    canSwitchEnvironment,
  } = useAuth()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const isCardioMode = activeEnvironment === 'cardiologist'
  const isAdminMode = activeEnvironment === 'admin'

  // Itens clínicos estritos para o perfil de cardiologista
  // (Fila de exames, laudos em elaboração, aguardando assinatura, minha assinatura e certificado, configurações de conta — SEM auditoria/configurações globais)
  const clinicalNavItems = [
    {
      to: '/',
      label: 'Painel e Fila de Exames',
      icon: LayoutDashboard,
      active:
        location.pathname === '/' && (!location.search || location.search.includes('tab=queue')),
    },
    {
      to: '/?tab=in_analysis',
      label: 'Laudos em Elaboração',
      icon: Clock,
      active: location.pathname === '/' && location.search.includes('tab=in_analysis'),
    },
    {
      to: '/?tab=waiting_signature',
      label: 'Aguardando Assinatura',
      icon: FileCheck,
      active: location.pathname === '/' && location.search.includes('tab=waiting_signature'),
    },
    {
      to: '/?tab=my_signature',
      label: 'Minha Assinatura e Certificado',
      icon: PenTool,
      active: location.pathname === '/' && location.search.includes('tab=my_signature'),
    },
    {
      to: '/?tab=account_settings',
      label: 'Configurações de Conta',
      icon: Settings,
      active: location.pathname === '/' && location.search.includes('tab=account_settings'),
    },
  ]

  // Itens estritos para o perfil administrativo da Central
  // (Painel central, clínicas/contratos, faturamento, auditoria, homologação, monitoramento — SEM fila de ECGs como função principal)
  const adminNavItems = [
    {
      to: '/',
      label: 'Painel Central',
      icon: LayoutDashboard,
      active: location.pathname === '/',
    },
    {
      to: '/auditoria',
      label: 'Auditoria de Viabilidade',
      icon: FileText,
      active: location.pathname === '/auditoria',
    },
    {
      to: '/homologacao',
      label: 'Homologação 4B',
      icon: FileCheck,
      active: location.pathname === '/homologacao',
    },
    {
      to: '/admin/teste-assinatura',
      label: 'Teste ICP-Brasil (6B)',
      icon: ShieldCheck,
      active: location.pathname === '/admin/teste-assinatura',
    },
    {
      to: '/admin/auditoria-infra',
      label: 'Auditoria Infra (E8)',
      icon: Server,
      active: location.pathname === '/admin/auditoria-infra',
    },
    {
      to: '/admin/backup-continuidade',
      label: 'Backup & DR (E10)',
      icon: HardDrive,
      active: location.pathname === '/admin/backup-continuidade',
    },
  ]

  // Menu visível estritamente conforme o ambiente ativo selecionado
  const navItems = isCardioMode ? clinicalNavItems : adminNavItems

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'Administrador Geral'
      case 'cardiologist':
        return 'Médico Cardiologista'
      case 'clinic_manager':
        return 'Gestor de Clínica'
      case 'clinic_operator':
        return 'Operador Clínico'
      case 'financial':
        return 'Gestor Financeiro'
      default:
        return 'Usuário Autenticado'
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#F7F6F4] text-[#2F3942] antialiased selection:bg-[#4A90D9] selection:text-white">
      {/* CABEÇALHO SUPERIOR SÓBRIO E ELEGANTE */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E3E6E8] shadow-[0_1px_3px_rgba(47,57,66,0.04)]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* LOGOMARCA OFICIAL & IDENTIDADE MÉDICA */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 rounded-lg text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4] transition-colors"
                aria-label="Abrir menu de navegação"
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            <Link
              to="/"
              className="group flex items-center transition-opacity hover:opacity-95"
              title="Márcio Eliziário — Clínica Médica e Cardiologia"
            >
              <BrandLogo size="md" layout="horizontal" />
            </Link>
          </div>

          {/* ÁREA DE CONTROLE DE SESSÃO E ORGANIZAÇÃO */}
          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* SELETOR ELEGANTE "ALTERNAR AMBIENTE" (Dr. Márcio / Multi-Perfil) */}
                {canSwitchEnvironment && (
                  <div className="flex items-center bg-[#F7F6F4] p-0.5 rounded-lg border border-[#E3E6E8] shadow-2xs">
                    <button
                      type="button"
                      onClick={() => switchEnvironment('admin')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                        isAdminMode
                          ? 'bg-white text-[#2F3942] shadow-xs border border-[#E3E6E8]'
                          : 'text-[#6F7780] hover:text-[#2F3942]'
                      }`}
                      title="Alternar para o ambiente de Gestão e Administração da Central"
                    >
                      <ShieldCheck
                        className={`w-3.5 h-3.5 ${isAdminMode ? 'text-[#4A90D9]' : 'text-[#6F7780]'}`}
                      />
                      <span className="hidden md:inline">Administração</span>
                      <span className="md:hidden">Admin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => switchEnvironment('cardiologist')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                        isCardioMode
                          ? 'bg-[#4A90D9] text-white shadow-xs'
                          : 'text-[#6F7780] hover:text-[#2F3942]'
                      }`}
                      title="Alternar para o ambiente de Eletrocardiografia e Laudos Médicos"
                    >
                      <Activity
                        className={`w-3.5 h-3.5 ${isCardioMode ? 'text-white' : 'text-[#6F7780]'}`}
                      />
                      <span className="hidden md:inline">Cardiologia</span>
                      <span className="md:hidden">Laudos</span>
                    </button>
                  </div>
                )}

                {/* Seletor de Organização (apenas se houver mais de uma) */}
                {userOrgs.length > 1 && (
                  <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F7F6F4] border border-[#E3E6E8] text-xs">
                    <Building2 className="w-3.5 h-3.5 text-[#6F7780]" />
                    <select
                      value={currentOrg?.id || ''}
                      onChange={(e) => switchOrg(e.target.value)}
                      aria-label="Selecionar Organização Ativa"
                      className="bg-transparent text-[#2F3942] font-medium cursor-pointer focus:outline-none max-w-[130px] truncate"
                    >
                      {userOrgs.map((uo) => (
                        <option key={uo.id} value={uo.organization_id}>
                          {uo.expand?.organization_id?.trade_name ||
                            uo.expand?.organization_id?.name ||
                            'Organização'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Identificação Médica do Usuário e Badge do Ambiente Ativo */}
                <div className="text-right hidden sm:block border-l border-[#E3E6E8] pl-3 py-0.5">
                  <div className="text-xs font-bold text-[#2F3942] truncate max-w-[170px]">
                    {user.name || user.email}
                  </div>
                  <div className="text-[11px] text-[#6F7780] font-medium flex items-center justify-end gap-1.5 mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 font-medium ${
                        isAdminMode
                          ? 'bg-slate-100 text-slate-800 border-slate-300'
                          : 'bg-blue-50 text-[#0E4C92] border-blue-200'
                      }`}
                    >
                      {isAdminMode ? 'Ambiente Admin' : 'Ambiente Cardiologia'}
                    </Badge>
                  </div>
                </div>

                <Button
                  onClick={logout}
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 sm:px-3 text-xs text-[#6F7780] hover:text-red-700 hover:bg-red-50 hover:border-red-200 border-[#E3E6E8] rounded-md gap-1.5 font-medium transition-colors"
                  title="Sair do sistema com segurança"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Sair</span>
                </Button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#4A90D9]/10 text-[#4A90D9] border border-[#4A90D9]/20">
                <span className="w-2 h-2 rounded-full bg-[#4A90D9]" />
                <span className="hidden sm:inline">Acesso Restrito Autorizado</span>
                <span className="sm:hidden">Acesso Seguro</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CORPO PRINCIPAL */}
      {isAuthenticated && user ? (
        /* Layout com Navegação Lateral para Usuários Autenticados */
        <div className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 flex gap-6">
          {/* NAVEGAÇÃO LATERAL (DESKTOP) */}
          <aside className="hidden lg:block w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-[#E3E6E8] p-3 shadow-[0_1px_3px_rgba(47,57,66,0.03)]">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#6F7780] flex items-center justify-between">
                <span>{isCardioMode ? 'Operação Clínica' : 'Módulos da Central'}</span>
                <span className="text-[10px] font-normal text-[#4A90D9]">
                  {isCardioMode ? 'ECG' : 'Admin'}
                </span>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                        item.active
                          ? 'bg-[#4A90D9]/10 text-[#4A90D9] font-bold shadow-xs'
                          : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${item.active ? 'text-[#4A90D9]' : 'text-[#6F7780]'}`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.active && <ChevronRight className="w-3.5 h-3.5 text-[#4A90D9]" />}
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Cartão de Resumo Institucional */}
            <div className="bg-white rounded-xl border border-[#E3E6E8] p-4 text-xs text-[#6F7780] space-y-2.5 shadow-[0_1px_3px_rgba(47,57,66,0.03)]">
              <div className="flex items-center gap-2 text-[#2F3942] font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-[#4A90D9]" />
                <span>Padrões e Diretrizes</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Diretriz SBC 2022 • Trilha de Auditoria SHA-256 • Resolução CFM nº 2.314/2022 •
                Sessão de 12h
              </p>
              <div className="pt-2 border-t border-[#E3E6E8] text-[10px] text-[#6F7780] flex items-center justify-between">
                <span>Versão da Central</span>
                <span className="font-mono font-semibold text-[#2F3942]">
                  {APP_CONFIG.versionLabel}
                </span>
              </div>
            </div>
          </aside>

          {/* GAVETA LATERAL MOBILE */}
          {isSidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={() => setIsSidebarOpen(false)}
              />
              <div className="relative w-72 max-w-[80vw] bg-white h-full p-4 flex flex-col justify-between shadow-xl z-10 border-r border-[#E3E6E8]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E3E6E8]">
                    <BrandLogo size="sm" layout="horizontal" />
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-1.5 rounded-lg text-[#6F7780] hover:bg-[#F7F6F4]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <nav className="space-y-1">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium ${
                            item.active
                              ? 'bg-[#4A90D9]/10 text-[#4A90D9] font-bold'
                              : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </div>
                        </Link>
                      )
                    })}
                  </nav>
                </div>

                <div className="text-[11px] text-[#6F7780] pt-4 border-t border-[#E3E6E8]">
                  Central de Telelaudos em Cardiologia
                </div>
              </div>
            </div>
          )}

          {/* ÁREA DE CONTEÚDO PRINCIPAL (AUTENTICADO) */}
          <main className="flex-1 min-w-0 min-h-0">
            <Outlet />
          </main>
        </div>
      ) : (
        /* Layout Limpo e Centralizado para Usuários Não Autenticados (Login) */
        <main className="flex-1 w-full flex items-center justify-center p-4">
          <Outlet />
        </main>
      )}

      {/* RODAPÉ INSTITUCIONAL */}
      {isAuthenticated && user ? (
        <footer className="w-full bg-[#2F3942] text-slate-200 border-t border-[#1f262c] mt-12 py-8 transition-colors">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
            <div className="space-y-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 text-white font-semibold">
                <BrandLogo size="sm" showText={false} />
                <span>Márcio Eliziário — Clínica Médica e Cardiologia</span>
              </div>
              <p className="text-[#A2ABB3] text-xs max-w-2xl leading-relaxed">
                Central de Telelaudos em Eletrocardiografia alinhada às Diretrizes da SBC e do CFM.
                Imutabilidade documental com SHA-256, segurança em repouso AES-256 e auditoria
                contínua de acessos.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 text-xs text-[#A2ABB3] shrink-0">
              {isAdminMode && (
                <div className="flex items-center gap-2">
                  <Link
                    to="/admin/teste-assinatura"
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md border border-white/10 transition-colors text-white text-xs font-semibold"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#4A90D9]" />
                    <span>ICP-Brasil</span>
                  </Link>
                  <Link
                    to="/homologacao"
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md border border-white/10 transition-colors text-white text-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-300" />
                    <span>Homologação</span>
                  </Link>
                  <Link
                    to="/admin/auditoria-infra"
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md border border-white/10 transition-colors text-white text-xs"
                  >
                    <Server className="w-3.5 h-3.5 text-slate-300" />
                    <span>Infraestrutura</span>
                  </Link>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[#A2ABB3] font-mono text-[11px]">
                <span>Central {APP_CONFIG.versionLabel}</span>
              </div>
            </div>
          </div>
        </footer>
      ) : (
        <footer className="w-full border-t border-[#E3E6E8] py-4 bg-white text-center text-xs text-[#6F7780]">
          <div className="max-w-md mx-auto px-4 flex flex-col items-center gap-1">
            <span className="font-medium text-[#2F3942]">
              Márcio Eliziário — Clínica Médica e Cardiologia
            </span>
            <span className="text-[11px] text-[#8C959E]">
              Central de Telelaudos de ECG • Plataforma em conformidade com CFM e SBC
            </span>
          </div>
        </footer>
      )}
    </div>
  )
}
