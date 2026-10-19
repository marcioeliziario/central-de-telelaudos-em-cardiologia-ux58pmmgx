import React, { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Activity,
  ShieldCheck,
  Building2,
  Users,
  FileText,
  DollarSign,
  Settings,
  LayoutDashboard,
  Menu,
  X,
  ChevronRight,
  LogOut,
  PenTool,
  Clock,
  FileCheck,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrandLogo } from '@/components/BrandLogo'

export default function Layout() {
  const {
    user,
    isAuthenticated,
    logout,
    activeEnvironment,
    switchEnvironment,
    canSwitchEnvironment,
  } = useAuth()
  const location = useLocation()

  // Sidebar mobile (aberta/fechada)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  // Sidebar desktop recolhível (expandida/colapsada)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false)

  const isCardioMode = activeEnvironment === 'cardiologist'
  const isAdminMode = activeEnvironment === 'admin'

  // Query string atual (para manter estados de tab/section)
  const searchParams = new URLSearchParams(location.search)
  const currentSection = searchParams.get('section') || 'overview'

  // MENU ADMINISTRATIVO SIMPLIFICADO: 5 SEÇÕES PRINCIPAIS + 1 ACESSO SECUNDÁRIO CONFIGURAÇÕES
  const adminMainSections = [
    {
      to: '/?section=overview',
      label: 'Visão Geral',
      icon: LayoutDashboard,
      active:
        location.pathname === '/' &&
        (!searchParams.get('section') || currentSection === 'overview'),
    },
    {
      to: '/?section=clinics',
      label: 'Clínicas',
      icon: Building2,
      active: location.pathname === '/' && currentSection === 'clinics',
    },
    {
      to: '/?section=users',
      label: 'Usuários e Médicos',
      icon: Users,
      active: location.pathname === '/' && currentSection === 'users',
    },
    {
      to: '/?section=exams',
      label: 'Exames',
      icon: FileText,
      active: location.pathname === '/' && currentSection === 'exams',
    },
    {
      to: '/?section=finance',
      label: 'Financeiro',
      icon: DollarSign,
      active: location.pathname === '/' && currentSection === 'finance',
    },
  ]

  const adminSecondarySection = {
    to: '/?section=settings',
    label: 'Configurações',
    icon: Settings,
    active: location.pathname === '/' && currentSection === 'settings',
  }

  // Itens clínicos para o perfil de cardiologista
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

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#F7F6F4] text-[#2F3942] antialiased selection:bg-[#4A90D9] selection:text-white">
      {/*
        CABEÇALHO SÓBRIO E LIMPO
        Contém somente: Identificação da Central, Ambiente atual, Perfil conectado e
        Alternância entre Administração e Cardiologia para usuários autorizados.
      */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E3E6E8] shadow-[0_1px_3px_rgba(47,57,66,0.04)]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* IDENTIFICAÇÃO DA CENTRAL & CONTROLE DO MENU LATERAL */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user && (
              <>
                {/* Botão Mobile para abrir Gaveta */}
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                  className="lg:hidden p-2 rounded-lg text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4] transition-colors"
                  aria-label="Menu principal"
                >
                  {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>

                {/* Botão Desktop para recolher/expandir sidebar lateral */}
                <button
                  type="button"
                  onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
                  className="hidden lg:flex p-2 rounded-lg text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4] transition-colors"
                  title={isDesktopCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                  aria-label="Recolher menu lateral"
                >
                  {isDesktopCollapsed ? (
                    <PanelLeft className="w-4 h-4" />
                  ) : (
                    <PanelLeftClose className="w-4 h-4" />
                  )}
                </button>
              </>
            )}

            <Link
              to="/"
              className="group flex items-center transition-opacity hover:opacity-95"
              title="Central de Telelaudos — Dr. Márcio Eliziário"
            >
              <BrandLogo size="md" layout="horizontal" />
            </Link>
          </div>

          {/* ÁREA DIREITA DO CABEÇALHO */}
          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* ALTERNÂNCIA ADMINISTRAÇÃO / CARDIOLOGIA (para usuários autorizados) */}
                {canSwitchEnvironment && (
                  <div className="flex items-center bg-[#F7F6F4] p-0.5 rounded-lg border border-[#E3E6E8]">
                    <button
                      type="button"
                      onClick={() => switchEnvironment('admin')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                        isAdminMode
                          ? 'bg-white text-[#2F3942] shadow-2xs border border-[#E3E6E8]'
                          : 'text-[#6F7780] hover:text-[#2F3942]'
                      }`}
                      title="Mudar para o ambiente de Administração"
                    >
                      <ShieldCheck
                        className={`w-3.5 h-3.5 ${isAdminMode ? 'text-[#4A90D9]' : 'text-[#6F7780]'}`}
                      />
                      <span className="hidden sm:inline">Administração</span>
                      <span className="sm:hidden">Admin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => switchEnvironment('cardiologist')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                        isCardioMode
                          ? 'bg-[#4A90D9] text-white shadow-2xs'
                          : 'text-[#6F7780] hover:text-[#2F3942]'
                      }`}
                      title="Mudar para o ambiente de Cardiologia"
                    >
                      <Activity
                        className={`w-3.5 h-3.5 ${isCardioMode ? 'text-white' : 'text-[#6F7780]'}`}
                      />
                      <span className="hidden sm:inline">Cardiologia</span>
                      <span className="sm:hidden">Laudos</span>
                    </button>
                  </div>
                )}

                {/* AMBIENTE ATUAL & PERFIL CONECTADO */}
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
                      {isAdminMode ? 'Administração' : 'Cardiologia'}
                    </Badge>
                  </div>
                </div>

                {/* LOGOUT */}
                <Button
                  onClick={logout}
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 sm:px-3 text-xs text-[#6F7780] hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 border-[#E3E6E8] rounded-md gap-1.5 font-medium transition-colors"
                  title="Sair do sistema"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Sair</span>
                </Button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#4A90D9]/10 text-[#4A90D9] border border-[#4A90D9]/20">
                <span className="w-2 h-2 rounded-full bg-[#4A90D9]" />
                <span>Central Segura</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CORPO PRINCIPAL COM MENU LATERAL ÚNICO E RECOLHÍVEL */}
      {isAuthenticated && user ? (
        <div className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 flex gap-6">
          {/* MENU LATERAL ÚNICO E RECOLHÍVEL (DESKTOP) */}
          <aside
            className={`hidden lg:block shrink-0 transition-all duration-200 ${
              isDesktopCollapsed ? 'w-16' : 'w-60'
            }`}
          >
            <div className="bg-white rounded-xl border border-[#E3E6E8] p-2.5 shadow-2xs space-y-3 sticky top-22">
              {/* Se for modo Administrador: Apresenta as 5 seções + Configurações */}
              {isAdminMode ? (
                <>
                  {!isDesktopCollapsed && (
                    <div className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#6F7780]">
                      Menu Administrativo
                    </div>
                  )}

                  {/* 5 Seções Principais */}
                  <nav className="space-y-1">
                    {adminMainSections.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          title={isDesktopCollapsed ? item.label : undefined}
                          className={`flex items-center ${
                            isDesktopCollapsed
                              ? 'justify-center p-2.5'
                              : 'justify-between px-3 py-2'
                          } rounded-lg text-xs font-medium transition-colors ${
                            item.active
                              ? 'bg-[#4A90D9]/10 text-[#4A90D9] font-bold'
                              : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                item.active ? 'text-[#4A90D9]' : 'text-[#6F7780]'
                              }`}
                            />
                            {!isDesktopCollapsed && <span className="truncate">{item.label}</span>}
                          </div>
                          {!isDesktopCollapsed && item.active && (
                            <ChevronRight className="w-3.5 h-3.5 text-[#4A90D9] shrink-0" />
                          )}
                        </Link>
                      )
                    })}
                  </nav>

                  {/* Divisor discreto para o acesso secundário */}
                  <div className="pt-2 border-t border-[#E3E6E8]">
                    {!isDesktopCollapsed && (
                      <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#8C959E]">
                        Acesso Secundário
                      </div>
                    )}
                    <Link
                      to={adminSecondarySection.to}
                      title={isDesktopCollapsed ? adminSecondarySection.label : undefined}
                      className={`flex items-center ${
                        isDesktopCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                      } rounded-lg text-xs font-medium transition-colors ${
                        adminSecondarySection.active
                          ? 'bg-[#4A90D9]/10 text-[#4A90D9] font-bold'
                          : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Settings
                          className={`w-4 h-4 shrink-0 ${
                            adminSecondarySection.active ? 'text-[#4A90D9]' : 'text-[#6F7780]'
                          }`}
                        />
                        {!isDesktopCollapsed && (
                          <span className="truncate">{adminSecondarySection.label}</span>
                        )}
                      </div>
                      {!isDesktopCollapsed && adminSecondarySection.active && (
                        <ChevronRight className="w-3.5 h-3.5 text-[#4A90D9] shrink-0" />
                      )}
                    </Link>
                  </div>
                </>
              ) : (
                /* Modo Cardiologista: Menus clínicos habituais */
                <>
                  {!isDesktopCollapsed && (
                    <div className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#6F7780]">
                      Operação Clínica
                    </div>
                  )}
                  <nav className="space-y-1">
                    {clinicalNavItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          title={isDesktopCollapsed ? item.label : undefined}
                          className={`flex items-center ${
                            isDesktopCollapsed
                              ? 'justify-center p-2.5'
                              : 'justify-between px-3 py-2'
                          } rounded-lg text-xs font-medium transition-colors ${
                            item.active
                              ? 'bg-[#4A90D9]/10 text-[#4A90D9] font-bold'
                              : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                item.active ? 'text-[#4A90D9]' : 'text-[#6F7780]'
                              }`}
                            />
                            {!isDesktopCollapsed && <span className="truncate">{item.label}</span>}
                          </div>
                          {!isDesktopCollapsed && item.active && (
                            <ChevronRight className="w-3.5 h-3.5 text-[#4A90D9] shrink-0" />
                          )}
                        </Link>
                      )
                    })}
                  </nav>
                </>
              )}
            </div>
          </aside>

          {/* GAVETA LATERAL MOBILE */}
          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
              <div className="relative w-72 max-w-[80vw] bg-white h-full p-4 flex flex-col justify-between shadow-xl z-10 border-r border-[#E3E6E8]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E3E6E8]">
                    <BrandLogo size="sm" layout="horizontal" />
                    <button
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="p-1.5 rounded-lg text-[#6F7780] hover:bg-[#F7F6F4]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {isAdminMode ? (
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#6F7780] px-1">
                        Menu Administrativo
                      </div>
                      <nav className="space-y-1">
                        {adminMainSections.map((item) => {
                          const Icon = item.icon
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setIsMobileSidebarOpen(false)}
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

                      <div className="pt-2 border-t border-[#E3E6E8]">
                        <Link
                          to={adminSecondarySection.to}
                          onClick={() => setIsMobileSidebarOpen(false)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium ${
                            adminSecondarySection.active
                              ? 'bg-[#4A90D9]/10 text-[#4A90D9] font-bold'
                              : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Settings className="w-4 h-4" />
                            <span>{adminSecondarySection.label}</span>
                          </div>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <nav className="space-y-1">
                      {clinicalNavItems.map((item) => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsMobileSidebarOpen(false)}
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
                  )}
                </div>

                <div className="text-[11px] text-[#6F7780] pt-4 border-t border-[#E3E6E8]">
                  Central de Telelaudos de ECG
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

      {/* RODAPÉ INSTITUCIONAL DISCRETO */}
      <footer className="w-full bg-[#2F3942] text-slate-300 border-t border-[#1f262c] mt-auto py-5 text-xs">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="space-y-0.5">
            <div className="font-semibold text-white">
              Márcio Eliziário — Clínica Médica e Cardiologia
            </div>
            <p className="text-[11px] text-[#A2ABB3]">
              Central de Telelaudos em Eletrocardiografia • Diretrizes SBC e CFM • Assinatura
              ICP-Brasil PAdES
            </p>
          </div>
          <div className="text-[11px] text-[#A2ABB3] font-mono">Ambiente Seguro</div>
        </div>
      </footer>
    </div>
  )
}
