import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  UserCheck,
  Stethoscope,
  Building2,
  Shield,
  Loader2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
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
  const [resetEmail, setResetEmail] = useState('')
  const [resetStatus, setResetStatus] = useState<{ success?: boolean; message?: string } | null>(
    null,
  )

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
      setError(err?.message || 'Falha na autenticação. Verifique suas credenciais de acesso.')
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
    const res = await requestPasswordReset(resetEmail)
    if (res.success) {
      setResetStatus({
        success: true,
        message: 'Instruções de redefinição de senha enviadas com sucesso para o e-mail informado.',
      })
    } else {
      setResetStatus({
        success: false,
        message: `Atenção: O fluxo de redefinição foi acionado no sistema, porém o servidor SMTP de envio de e-mails da nuvem não está configurado (${res.note}). Em ambiente de homologação, utilize a senha padrão do seed.`,
      })
    }
  }

  const fillQuickLogin = (userEmail: string) => {
    setEmail(userEmail)
    setPassword('Skip@Pass')
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Banner Superior com a Identidade Médica Oficial */}
      <div className="text-center mb-8 space-y-3">
        <BrandLogo size="lg" layout="vertical" className="mx-auto" />
        <p className="text-xs text-[#6F7780] max-w-md mx-auto">
          Central de Telelaudos em Eletrocardiografia Conforme Diretrizes da SBC
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-8 items-start">
        {/* Lado Esquerdo: Formulário de Acesso */}
        <div className="md:col-span-7">
          <Card className="border-[#E3E6E8] bg-white shadow-[0_1px_3px_rgba(47,57,66,0.04)] rounded-xl overflow-hidden">
            <Tabs defaultValue="login" className="w-full">
              <CardHeader className="pb-3 border-b border-[#E3E6E8] bg-[#F7F6F4]/60">
                <TabsList className="grid w-full grid-cols-2 bg-[#E3E6E8]/70 p-1 rounded-lg">
                  <TabsTrigger
                    value="login"
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#2F3942] data-[state=active]:bg-white data-[state=active]:text-[#4A90D9] data-[state=active]:shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Entrar no Sistema</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="reset"
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#6F7780] data-[state=active]:bg-white data-[state=active]:text-[#4A90D9] data-[state=active]:shadow-xs"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Recuperar Senha</span>
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="login">
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4 pt-5 px-6">
                    {error && (
                      <Alert
                        variant="destructive"
                        className="py-2.5 bg-red-50 text-red-900 border-red-200"
                      >
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <AlertDescription className="text-xs">{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-bold text-[#2F3942]">
                        E-mail Institucional
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu.email@exemplo.com.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="text-xs h-9 border-[#E3E6E8] focus:border-[#4A90D9] focus:ring-[#4A90D9]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="pass" className="text-xs font-bold text-[#2F3942]">
                        Senha de Acesso
                      </Label>
                      <Input
                        id="pass"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="text-xs h-9 border-[#E3E6E8] focus:border-[#4A90D9] focus:ring-[#4A90D9]"
                      />
                    </div>

                    <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8] text-xs text-[#6F7780] space-y-1">
                      <div className="font-bold text-[#2F3942] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#4A90D9]" />
                        <span>Isolamento Multi-tenant & Segurança:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Acesso estritamente auditado e isolado no banco de dados. Exames e
                        prontuários ficam visíveis apenas para sua organização credenciada.
                      </p>
                    </div>
                  </CardContent>

                  <CardFooter className="flex flex-col gap-3 pt-2 px-6 pb-6">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold text-xs h-9 rounded-md shadow-xs transition-colors"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          <span>Autenticando...</span>
                        </>
                      ) : (
                        <>
                          <span>Acessar Central de Laudos</span>
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>

                    <div className="text-center w-full">
                      <Link
                        to="/auditoria"
                        className="text-[11px] text-[#6F7780] hover:text-[#2F3942] underline transition-colors"
                      >
                        Consultar Relatório de Auditoria de Viabilidade Técnica
                      </Link>
                    </div>
                  </CardFooter>
                </form>
              </TabsContent>

              <TabsContent value="reset">
                <form onSubmit={handleReset}>
                  <CardContent className="space-y-4 pt-5 px-6">
                    <p className="text-xs text-[#6F7780] leading-relaxed">
                      Informe seu e-mail corporativo cadastrado para receber as instruções de
                      redefinição de senha segura.
                    </p>

                    {resetStatus && (
                      <Alert
                        className={
                          resetStatus.success
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }
                      >
                        {resetStatus.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                        )}
                        <AlertDescription className="text-xs leading-relaxed">
                          {resetStatus.message}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email" className="text-xs font-bold text-[#2F3942]">
                        E-mail de Cadastro
                      </Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="seu.email@exemplo.com.br"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="text-xs h-9 border-[#E3E6E8] focus:border-[#4A90D9]"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 px-6 pb-6">
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4] text-xs h-9"
                    >
                      Enviar Link de Redefinição
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Modal de Segundo Fator no Login */}
        <Dialog open={isMfaPromptOpen} onOpenChange={setIsMfaPromptOpen}>
          <DialogContent className="max-w-sm bg-white border-[#E3E6E8]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#2F3942] text-sm font-bold">
                <ShieldCheck className="w-5 h-5 text-[#4A90D9]" />
                <span>Autenticação em Duas Etapas</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6F7780]">
                Esta conta possui proteção MFA. Digite o código de 6 dígitos gerado pelo seu
                aplicativo autenticador (TOTP).
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleMfaVerifySubmit} className="space-y-4 py-2">
              {mfaError && (
                <Alert
                  variant="destructive"
                  className="py-2 text-xs bg-red-50 text-red-900 border-red-200"
                >
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription>{mfaError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="login-mfa-code" className="text-xs font-bold text-[#2F3942]">
                  Código de Autenticação:
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

              <DialogFooter className="gap-2 sm:gap-0">
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

        {/* Lado Direito: Acesso Rápido para Teste com Design Elegante */}
        <div className="md:col-span-5 space-y-4">
          <Card className="border-[#E3E6E8] bg-white shadow-[0_1px_3px_rgba(47,57,66,0.04)] rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#E3E6E8] bg-[#F7F6F4]/50">
              <div className="flex items-center gap-2 text-[#4A90D9]">
                <UserCheck className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Homologação Médica
                </span>
              </div>
              <CardTitle className="text-sm font-bold text-[#2F3942]">
                Perfis Pré-configurados
              </CardTitle>
              <CardDescription className="text-xs text-[#6F7780]">
                Selecione um usuário para testar as permissões e o isolamento entre clínicas:
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2 text-xs">
              {/* Administrador */}
              <button
                type="button"
                onClick={() => fillQuickLogin('marcio.eliziario@hotmail.com')}
                className="w-full text-left p-2.5 rounded-lg border border-[#E3E6E8] hover:border-[#4A90D9] hover:bg-[#4A90D9]/5 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-[#2F3942] group-hover:text-[#4A90D9] flex items-center gap-1.5">
                    <span>Administrador Geral</span>
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Central
                    </span>
                  </div>
                  <div className="text-[#6F7780] text-[11px]">marcio.eliziario@hotmail.com</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#6F7780] group-hover:text-[#4A90D9] group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Cardiologista */}
              <button
                type="button"
                onClick={() => fillQuickLogin('dr.carlos@cardiolab.fake')}
                className="w-full text-left p-2.5 rounded-lg border border-[#E3E6E8] hover:border-[#4A90D9] hover:bg-[#4A90D9]/5 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-[#2F3942] group-hover:text-[#4A90D9] flex items-center gap-1.5">
                    <span>Dr. Carlos Silveira</span>
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Cardiologista
                    </span>
                  </div>
                  <div className="text-[#6F7780] text-[11px]">CRM 145892/SP • RQE 68492</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#6F7780] group-hover:text-[#4A90D9] group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Gestor Clínica Alfa */}
              <button
                type="button"
                onClick={() => fillQuickLogin('gestor.alfa@cardioalfa.fake')}
                className="w-full text-left p-2.5 rounded-lg border border-[#E3E6E8] hover:border-[#4A90D9] hover:bg-[#4A90D9]/5 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-[#2F3942] group-hover:text-[#4A90D9] flex items-center gap-1.5">
                    <span>Gestor da Clínica Alfa</span>
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200">
                      Campinas
                    </span>
                  </div>
                  <div className="text-[#6F7780] text-[11px]">gestor.alfa@cardioalfa.fake</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#6F7780] group-hover:text-[#4A90D9] group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Operador Clínica Alfa */}
              <button
                type="button"
                onClick={() => fillQuickLogin('operador.alfa@cardioalfa.fake')}
                className="w-full text-left p-2.5 rounded-lg border border-[#E3E6E8] hover:border-[#4A90D9] hover:bg-[#4A90D9]/5 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-[#2F3942] group-hover:text-[#4A90D9] flex items-center gap-1.5">
                    <span>Operador de ECG</span>
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      Envio de traçados
                    </span>
                  </div>
                  <div className="text-[#6F7780] text-[11px]">operador.alfa@cardioalfa.fake</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#6F7780] group-hover:text-[#4A90D9] group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Gestora Clínica Beta */}
              <button
                type="button"
                onClick={() => fillQuickLogin('gestora.beta@clinica-beta.fake')}
                className="w-full text-left p-2.5 rounded-lg border border-[#E3E6E8] hover:border-[#4A90D9] hover:bg-[#4A90D9]/5 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-[#2F3942] group-hover:text-[#4A90D9] flex items-center gap-1.5">
                    <span>Gestora da Clínica Beta</span>
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-200">
                      Isolada
                    </span>
                  </div>
                  <div className="text-[#6F7780] text-[11px]">gestora.beta@clinica-beta.fake</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#6F7780] group-hover:text-[#4A90D9] group-hover:translate-x-0.5 transition-transform" />
              </button>

              <div className="pt-2 text-[11px] text-[#6F7780] border-t border-[#E3E6E8] text-center">
                Senha padrão para todos os perfis:{' '}
                <span className="font-mono font-semibold bg-[#F7F6F4] px-1.5 py-0.5 rounded text-[#2F3942] border border-[#E3E6E8]">
                  Skip@Pass
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
