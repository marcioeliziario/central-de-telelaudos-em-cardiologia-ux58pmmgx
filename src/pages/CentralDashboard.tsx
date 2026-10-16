import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LoginPage from './LoginPage'
import AdminDashboard from './AdminDashboard'
import ClinicDashboard from './ClinicDashboard'
import CardiologistDashboard from './CardiologistDashboard'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { AlertCircle, Lock, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CentralDashboard() {
  const { isAuthenticated, isLoading, currentRole, activeEnvironment, user, userOrgs, currentOrg } =
    useAuth()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-2 border-[#4A90D9] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#6F7780] font-medium">Carregando Central de Telelaudos...</p>
      </div>
    )
  }

  // Não autenticado -> Apresenta tela de Login imediatamente
  if (!isAuthenticated || !user) {
    return <LoginPage />
  }

  // Usuário autenticado mas sem organização vinculada
  if (userOrgs.length === 0) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-base">Vínculo Institucional Pendente</CardTitle>
            </div>
            <CardDescription className="text-xs text-amber-900">
              Sua conta ({user.email}) foi autenticada com sucesso no Skip Cloud, porém ainda não
              possui perfil atribuído nem organização vinculada pela administração.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-700">
            <p>
              Para validar o sistema nesta etapa, utilize uma das credenciais pré-configuradas no
              ambiente de testes (Administrador Geral, Gestor da Clínica Alfa, Gestora da Clínica
              Beta ou Médico Cardiologista).
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Roteamento conforme activeEnvironment (prioritário para multi-perfil Dr. Márcio)
  // e isolamento estrito para perfis de clínicas contratantes
  if (activeEnvironment === 'cardiologist' || currentRole === 'cardiologist') {
    if (activeEnvironment === 'cardiologist') {
      return <CardiologistDashboard />
    }
  }

  if (activeEnvironment === 'admin' || currentRole === 'admin') {
    if (activeEnvironment === 'admin') {
      return <AdminDashboard />
    }
  }

  if (
    currentRole === 'clinic_manager' ||
    currentRole === 'clinic_operator' ||
    activeEnvironment === 'clinic'
  ) {
    return <ClinicDashboard />
  }

  if (currentRole === 'admin') {
    return <AdminDashboard />
  }

  if (currentRole === 'cardiologist') {
    return <CardiologistDashboard />
  }

  if (currentRole === 'financial') {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2 text-slate-800">
              <Lock className="w-5 h-5 text-slate-500" />
              <CardTitle className="text-base">Módulo Financeiro</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-600">
              Organização: {currentOrg?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600">
            <p>
              O perfil financeiro está estruturado nas migrações de dados, mas o painel dedicado de
              faturamento e repasses está indisponível na Etapa 1 — Fundação.
            </p>
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-500">
              Status: Não disponível nesta etapa (previsto para etapas futuras após aprovação).
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="text-center py-12 text-slate-500 text-xs">
      Perfil de acesso não reconhecido.
    </div>
  )
}
