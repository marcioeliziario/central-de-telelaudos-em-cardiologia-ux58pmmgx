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
  Activity,
  Shield,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  UserCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function LoginPage() {
  const { login, requestPasswordReset, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetEmail, setResetEmail] = useState('')
  const [resetStatus, setResetStatus] = useState<{ success?: boolean; message?: string } | null>(
    null,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(err?.message || 'Falha na autenticação. Verifique suas credenciais.')
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
        message: `Atenção: O fluxo de redefinição foi acionado no sistema, porém o servidor SMTP de envio de e-mails da nuvem não está configurado ou rejeitou a entrega (${res.note}). Em ambiente de homologação/teste, utilize a senha padrão definida no seed.`,
      })
    }
  }

  const fillQuickLogin = (userEmail: string) => {
    setEmail(userEmail)
    setPassword('Skip@Pass')
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="grid md:grid-cols-12 gap-8 items-start">
        {/* Lado Esquerdo: Formulário */}
        <div className="md:col-span-7">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#0E4C92] border border-blue-200 mb-3">
              <Activity className="w-3.5 h-3.5 text-[#00A6A6]" />
              <span>Acesso Seguro à Central</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Autenticação de Usuários
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Entre com suas credenciais autorizadas para acessar os painéis de telemedicina.
            </p>
          </div>

          <Card className="shadow-sm border-slate-200">
            <Tabs defaultValue="login" className="w-full">
              <CardHeader className="pb-3 border-b border-slate-100">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger
                    value="login"
                    className="flex items-center gap-1.5 text-xs sm:text-sm"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Entrar no Sistema</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="reset"
                    className="flex items-center gap-1.5 text-xs sm:text-sm"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Recuperar Senha</span>
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="login">
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4 pt-4">
                    {error && (
                      <Alert variant="destructive" className="py-2.5">
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription className="text-xs">{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                        E-mail institucional
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu.email@exemplo.com.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pass" className="text-xs font-semibold text-slate-700">
                          Senha de acesso
                        </Label>
                      </div>
                      <Input
                        id="pass"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="text-sm"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#00A6A6]" />
                        <span>Isolamento Multi-tenant Ativo:</span>
                      </div>
                      <p>
                        O acesso a pacientes e exames é restrito no nível do banco de dados (API
                        Rules + Hooks) à organização vinculada ao seu usuário.
                      </p>
                    </div>
                  </CardContent>

                  <CardFooter className="flex flex-col gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#0E4C92] hover:bg-blue-800 text-white font-medium"
                    >
                      {isLoading ? 'Autenticando...' : 'Acessar Central'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>

                    <div className="text-center w-full">
                      <Link
                        to="/auditoria"
                        className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors"
                      >
                        Consultar Relatório de Auditoria de Viabilidade Técnica
                      </Link>
                    </div>
                  </CardFooter>
                </form>
              </TabsContent>

              <TabsContent value="reset">
                <form onSubmit={handleReset}>
                  <CardContent className="space-y-4 pt-4">
                    <p className="text-xs text-slate-600">
                      Informe o e-mail cadastrado para receber o link seguro de redefinição de senha
                      via Skip Cloud.
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
                        <AlertDescription className="text-xs">
                          {resetStatus.message}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email" className="text-xs font-semibold text-slate-700">
                        E-mail de cadastro
                      </Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="seu.email@exemplo.com.br"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="text-sm"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Button type="submit" variant="outline" className="w-full border-slate-300">
                      Enviar Link de Redefinição
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Lado Direito: Contas de Teste para Homologação */}
        <div className="md:col-span-5 space-y-4">
          <Card className="bg-gradient-to-br from-slate-900 to-blue-950 text-white border-blue-900 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-[#00A6A6]">
                <UserCheck className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Acesso Rápido de Teste
                </span>
              </div>
              <CardTitle className="text-base text-white">Usuários Pré-configurados</CardTitle>
              <CardDescription className="text-slate-300 text-xs">
                Clique para preencher e validar os diferentes perfis e o isolamento entre
                organizações:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <button
                type="button"
                onClick={() => fillQuickLogin('marcio.eliziario@hotmail.com')}
                className="w-full text-left p-2.5 rounded-md bg-white/10 hover:bg-white/15 transition-all border border-white/10 flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white group-hover:text-[#00A6A6]">
                    Administrador Geral
                  </div>
                  <div className="text-slate-300 text-[11px]">marcio.eliziario@hotmail.com</div>
                  <div className="text-[10px] text-amber-300">Prestadora • Acesso total</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickLogin('dr.carlos@cardiolab.fake')}
                className="w-full text-left p-2.5 rounded-md bg-white/10 hover:bg-white/15 transition-all border border-white/10 flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white group-hover:text-[#00A6A6]">
                    Cardiologista Laudador
                  </div>
                  <div className="text-slate-300 text-[11px]">dr.carlos@cardiolab.fake</div>
                  <div className="text-[10px] text-emerald-300">CRM 145892-SP • RQE 68492</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickLogin('gestor.alfa@cardioalfa.fake')}
                className="w-full text-left p-2.5 rounded-md bg-white/10 hover:bg-white/15 transition-all border border-white/10 flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white group-hover:text-[#00A6A6]">
                    Gestor da Clínica Alfa
                  </div>
                  <div className="text-slate-300 text-[11px]">gestor.alfa@cardioalfa.fake</div>
                  <div className="text-[10px] text-sky-300">Apenas Clínica Alfa (Campinas)</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickLogin('operador.alfa@cardioalfa.fake')}
                className="w-full text-left p-2.5 rounded-md bg-white/10 hover:bg-white/15 transition-all border border-white/10 flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white group-hover:text-[#00A6A6]">
                    Operador da Clínica Alfa
                  </div>
                  <div className="text-slate-300 text-[11px]">operador.alfa@cardioalfa.fake</div>
                  <div className="text-[10px] text-sky-300">Envio de ECG • Clínica Alfa</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickLogin('gestora.beta@clinica-beta.fake')}
                className="w-full text-left p-2.5 rounded-md bg-white/10 hover:bg-white/15 transition-all border border-white/10 flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white group-hover:text-[#00A6A6]">
                    Gestora da Clínica Beta
                  </div>
                  <div className="text-slate-300 text-[11px]">gestora.beta@clinica-beta.fake</div>
                  <div className="text-[10px] text-purple-300">
                    Isolada • Clínica Beta (Ribeirão)
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="pt-2 text-[11px] text-slate-300 border-t border-white/10 text-center">
                Senha padrão de homologação:{' '}
                <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-white">
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
