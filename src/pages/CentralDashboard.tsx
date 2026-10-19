import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LoginPage from './LoginPage'
import AdminDashboard from './AdminDashboard'
import ClinicDashboard from './ClinicDashboard'
import CardiologistDashboard from './CardiologistDashboard'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { AlertCircle, Lock, ShieldAlert, KeyRound, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function CentralDashboard() {
  const {
    isAuthenticated,
    isLoading,
    currentRole,
    activeEnvironment,
    user,
    userOrgs,
    currentOrg,
    mustChangePassword,
    updatePassword,
    logout,
  } = useAuth()

  // Estado do formulário de substituição de credencial padrão
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false)

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError(null)

    if (newPassword.length < 8) {
      setPwdError('A nova senha deve possuir no mínimo 8 caracteres.')
      return
    }
    if (newPassword === 'Skip@Pass') {
      setPwdError('A nova senha não pode ser igual à credencial padrão de demonstração.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdError('A confirmação da senha não coincide com a nova senha digitada.')
      return
    }

    setIsUpdatingPwd(true)
    try {
      await updatePassword(oldPassword, newPassword)
      setPwdSuccess(true)
    } catch (err: any) {
      setPwdError(err?.message || 'Falha ao atualizar a senha. Verifique a senha atual informada.')
    } finally {
      setIsUpdatingPwd(false)
    }
  }

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

  // Se o usuário utilizou credencial padrão temporária, exige sua substituição obrigatória
  if (mustChangePassword && !pwdSuccess) {
    return (
      <div className="max-w-md mx-auto py-8 px-4">
        <Card className="border-amber-200 bg-white shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-amber-50/70 border-b border-amber-200/60 pb-4">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Substituição Obrigatória de Credencial Padrão</span>
            </div>
            <CardDescription className="text-xs text-amber-800 leading-relaxed mt-1">
              Por diretriz de segurança, contas autenticadas com a credencial padrão de demonstração
              devem cadastrar uma nova senha definitiva antes de acessar registros clínicos e
              operacionais.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handlePasswordChangeSubmit}>
            <CardContent className="space-y-4 pt-5 px-6">
              {pwdError && (
                <Alert
                  variant="destructive"
                  className="py-2.5 px-3 bg-red-50 text-red-900 border-red-200"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <AlertDescription className="text-xs">{pwdError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="old-password" className="text-xs font-semibold text-[#2F3942]">
                  Senha Atual (Credencial Padrão)
                </Label>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-semibold text-[#2F3942]">
                  Nova Senha Definitiva (mínimo 8 caracteres)
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-semibold text-[#2F3942]">
                  Confirmar Nova Senha
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="text-xs h-9"
                />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between gap-3 pt-2 px-6 pb-6 border-t border-[#E3E6E8]/60 bg-slate-50/50">
              <Button
                type="button"
                variant="outline"
                onClick={logout}
                className="text-xs h-9 border-[#E3E6E8] text-[#6F7780]"
              >
                Sair
              </Button>
              <Button
                type="submit"
                disabled={isUpdatingPwd || !newPassword || !confirmPassword}
                className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold text-xs h-9"
              >
                {isUpdatingPwd ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Atualizar e Prosseguir</span>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    )
  }

  // Usuário autenticado mas sem organização vinculada
  if (userOrgs.length === 0) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-base">Vínculo Institucional Pendente</CardTitle>
            </div>
            <CardDescription className="text-xs text-amber-900 leading-relaxed">
              Sua conta ({user.email}) foi autenticada com sucesso, porém ainda não possui perfil
              atribuído nem organização vinculada pela administração da Central de Telelaudos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-700">
            <p>
              Solicite ao Administrador Geral a ativação do seu perfil ou utilize uma conta
              devidamente vinculada.
            </p>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              Encerrar Sessão
            </Button>
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
