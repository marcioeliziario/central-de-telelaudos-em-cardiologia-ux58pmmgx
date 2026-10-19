import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Lock,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  ArrowLeft,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import pb from '@/lib/pocketbase/client'
import { BrandLogo } from '@/components/BrandLogo'

export default function LoginPage() {
  const { login, requestPasswordReset, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Estado da visão de recuperação de senha (substitui tabs por fluxo focado e limpo)
  const [showForgotView, setShowForgotView] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetStatus, setResetStatus] = useState<{ success?: boolean; message?: string } | null>(
    null,
  )
  const [isSendingReset, setIsSendingReset] = useState(false)

  // Segundo Fator de Autenticação (MFA - TOTP)
  const [isMfaPromptOpen, setIsMfaPromptOpen] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)

      // Checar se o usuário possui MFA ativado
      try {
        const mfaStatus = await pb.send('/backend/v1/auth/mfa/status', { method: 'GET' })
        if (mfaStatus?.mfa?.enabled) {
          setIsMfaPromptOpen(true)
        }
      } catch (_) {
        // Se a checagem falhar ou não tiver MFA, sessão prossegue normalmente
      }
    } catch (err: any) {
      setError(err?.message || 'Falha na autenticação. Verifique seu e-mail e senha de acesso.')
    }
  }

  const handleMfaVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaCode) return
    setIsVerifyingMfa(true)
    setMfaError(null)

    try {
      const currentUserId = pb.authStore.model?.id
      if (!currentUserId) throw new Error('Sessão expirada. Faça login novamente.')

      await pb.send('/backend/v1/auth/mfa/verify-login', {
        method: 'POST',
        body: {
          user_id: currentUserId,
          code: mfaCode.trim(),
          is_recovery: mfaCode.includes('-'),
        },
      })
      setIsMfaPromptOpen(false)
      setMfaCode('')
    } catch (err: any) {
      setMfaError(err?.message || 'Código do segundo fator incorreto ou expirado.')
    } finally {
      setIsVerifyingMfa(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) return
    setResetStatus(null)
    setIsSendingReset(true)

    try {
      const res = await requestPasswordReset(resetEmail)
      if (res.success) {
        setResetStatus({
          success: true,
          message:
            'Instruções para redefinição de senha foram enviadas para o endereço de e-mail informado.',
        })
      } else {
        setResetStatus({
          success: false,
          message:
            'A solicitação de recuperação foi processada no sistema. Caso o e-mail esteja cadastrado, você receberá o link de redefinição.',
        })
      }
    } finally {
      setIsSendingReset(false)
    }
  }

  return (
    <div className="w-full flex items-center justify-center py-6 sm:py-10 px-4">
      <div className="w-full max-w-[420px] mx-auto space-y-6">
        {/* Identidade Médica Centralizada — Logomarca Original Preservada */}
        <div className="text-center space-y-3">
          <BrandLogo size="lg" layout="vertical" className="mx-auto" />
          <div className="space-y-1">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#2F3942]">
              Central de Telelaudos de ECG
            </h1>
            <p className="text-xs text-[#6F7780]">
              Ambiente restrito e autenticado para cardiologia e clínicas credenciadas
            </p>
          </div>
        </div>

        {/* Card Principal de Acesso */}
        <Card className="border-[#E3E6E8] bg-white shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-6 sm:p-7">
            {!showForgotView ? (
              /* Formulário Principal de Login */
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert
                    variant="destructive"
                    className="py-2.5 px-3 bg-red-50 text-red-900 border-red-200"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <AlertDescription className="text-xs leading-relaxed">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs font-semibold text-[#2F3942]">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="username"
                      placeholder="seu.email@clinica.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="text-xs h-10 border-[#E3E6E8] focus:border-[#4A90D9] focus:ring-[#4A90D9] pl-9"
                    />
                    <Mail className="w-4 h-4 text-[#8C959E] absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="login-password"
                      className="text-xs font-semibold text-[#2F3942]"
                    >
                      Senha
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotView(true)
                        setError(null)
                        setResetStatus(null)
                        if (email) setResetEmail(email)
                      }}
                      className="text-[11px] font-medium text-[#4A90D9] hover:text-[#3271b3] transition-colors"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="text-xs h-10 border-[#E3E6E8] focus:border-[#4A90D9] focus:ring-[#4A90D9] pl-9"
                    />
                    <Lock className="w-4 h-4 text-[#8C959E] absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold text-xs h-10 rounded-lg shadow-xs transition-colors mt-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar</span>
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              /* Formulário Discreto de Recuperação de Senha */
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1 pb-1">
                  <h2 className="text-sm font-bold text-[#2F3942] flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-[#4A90D9]" />
                    <span>Recuperação de Senha</span>
                  </h2>
                  <p className="text-xs text-[#6F7780] leading-relaxed">
                    Informe seu e-mail cadastrado para receber o link seguro de redefinição de
                    acesso.
                  </p>
                </div>

                {resetStatus && (
                  <Alert
                    className={`py-2.5 px-3 ${
                      resetStatus.success
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    {resetStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <AlertDescription className="text-xs leading-relaxed">
                      {resetStatus.message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label
                    htmlFor="reset-email-input"
                    className="text-xs font-semibold text-[#2F3942]"
                  >
                    E-mail de Cadastro
                  </Label>
                  <div className="relative">
                    <Input
                      id="reset-email-input"
                      type="email"
                      placeholder="seu.email@clinica.com.br"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      className="text-xs h-10 border-[#E3E6E8] focus:border-[#4A90D9] focus:ring-[#4A90D9] pl-9"
                    />
                    <Mail className="w-4 h-4 text-[#8C959E] absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <Button
                    type="submit"
                    disabled={isSendingReset || !resetEmail}
                    className="w-full bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold text-xs h-10 rounded-lg shadow-xs transition-colors"
                  >
                    {isSendingReset ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span>Enviando link...</span>
                      </>
                    ) : (
                      <span>Enviar Link de Redefinição</span>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowForgotView(false)
                      setResetStatus(null)
                    }}
                    className="w-full text-xs text-[#6F7780] hover:text-[#2F3942] h-9 gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar para o acesso</span>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Identificação de Acesso Restrito e Imutabilidade */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6F7780]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4A90D9]" />
            <span>Acesso Restrito & Auditado</span>
          </div>
          <p className="text-[11px] text-[#8C959E] max-w-xs mx-auto leading-relaxed">
            Uso exclusivo de profissionais credenciados. Todas as tentativas de autenticação e
            operações são auditadas conforme diretrizes médicas e normas de proteção de dados.
          </p>
        </div>
      </div>

      {/* Modal Seguro de Segundo Fator de Autenticação (MFA) */}
      <Dialog open={isMfaPromptOpen} onOpenChange={setIsMfaPromptOpen}>
        <DialogContent className="max-w-sm bg-white border-[#E3E6E8]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#2F3942] text-sm font-bold">
              <ShieldCheck className="w-5 h-5 text-[#4A90D9]" />
              <span>Autenticação em Duas Etapas</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F7780]">
              Esta conta possui proteção adicional por MFA. Digite o código de 6 dígitos gerado pelo
              seu aplicativo autenticador (TOTP) ou use um código de recuperação.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMfaVerifySubmit} className="space-y-4 py-2">
            {mfaError && (
              <Alert
                variant="destructive"
                className="py-2 text-xs bg-red-50 text-red-900 border-red-200"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <AlertDescription>{mfaError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="login-mfa-code" className="text-xs font-semibold text-[#2F3942]">
                Código de Autenticação
              </Label>
              <Input
                id="login-mfa-code"
                type="text"
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="font-mono text-center tracking-widest text-lg font-bold border-[#E3E6E8] focus:border-[#4A90D9]"
                required
                autoFocus
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  pb.authStore.clear()
                  setIsMfaPromptOpen(false)
                }}
                className="text-xs border-[#E3E6E8]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isVerifyingMfa || !mfaCode}
                className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold text-xs"
              >
                {isVerifyingMfa ? 'Validando...' : 'Confirmar e Acessar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
