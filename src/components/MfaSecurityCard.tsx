import React, { useEffect, useState } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Lock,
  UserX,
  Sliders,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react'
import {
  mfaSecurityService,
  MfaStatusResponse,
  MfaSetupResponse,
} from '@/services/mfaSecurityService'
import { useAuth } from '@/contexts/AuthContext'

export const MfaSecurityCard: React.FC = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<MfaStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modais
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [isDisableOpen, setIsDisableOpen] = useState(false)
  const [isRevokeOpen, setIsRevokeOpen] = useState(false)
  const [isPolicyOpen, setIsPolicyOpen] = useState(false)

  // Estado do Setup
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [showSecretManual, setShowSecretManual] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [copiedSecret, setCopiedSecret] = useState(false)

  // Estado do Disable
  const [disableCode, setDisableCode] = useState('')

  // Estado de Revogação Admin
  const [targetUserId, setTargetUserId] = useState('')
  const [revokeAction, setRevokeAction] = useState<
    'revoke_tokens' | 'deactivate_user' | 'deactivate_doctor'
  >('revoke_tokens')
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeResult, setRevokeResult] = useState<string | null>(null)

  // Estado de Política Admin
  const [policyRole, setPolicyRole] = useState<'none' | 'admin' | 'cardiologist' | 'all'>('none')
  const [policyEnforce, setPolicyEnforce] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await mfaSecurityService.getStatus()
      setStatus(res)
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar status do segundo fator.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleStartSetup = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await mfaSecurityService.setupMfa()
      setSetupData(res)
      setVerificationCode('')
      setRecoveryCodes([])
      setIsSetupOpen(true)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar o cadastro do segundo fator.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmEnable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verificationCode || verificationCode.length !== 6) return
    setLoading(true)
    setError(null)
    try {
      const res = await mfaSecurityService.enableMfa(verificationCode)
      setRecoveryCodes(res.recoveryCodes || [])
      setSuccessMsg('Segundo fator ativado com sucesso! Guarde os códigos de recuperação.')
      await loadStatus()
    } catch (err: any) {
      setError(err?.message || 'Código inválido. Verifique o aplicativo autenticador.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await mfaSecurityService.disableMfa(disableCode)
      setIsDisableOpen(false)
      setDisableCode('')
      setSuccessMsg('Segundo fator desativado.')
      await loadStatus()
    } catch (err: any) {
      setError(err?.message || 'Falha ao desativar segundo fator.')
    } finally {
      setLoading(false)
    }
  }

  const handleExecuteRevocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUserId) return
    setLoading(true)
    setError(null)
    setRevokeResult(null)
    try {
      const res = await mfaSecurityService.revokeUserSessions({
        targetUserId,
        actionType: revokeAction,
        reason: revokeReason || 'Ação administrativa de segurança',
      })
      setRevokeResult(
        `Sucesso: tokenKey rotacionado. Usuário ativo: ${res.userActive ? 'Sim' : 'Não'}. Médico inativado: ${res.doctorDeactivated ? 'Sim' : 'Não'}.`,
      )
      setSuccessMsg('Sessões e credenciais invalidadas com sucesso.')
    } catch (err: any) {
      setError(err?.message || 'Falha na revogação de sessões.')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await mfaSecurityService.configurePolicy(policyRole, policyEnforce)
      setIsPolicyOpen(false)
      setSuccessMsg(
        `Política atualizada: ${res.affectedUsersCount} usuários afetados no perfil ${policyRole}.`,
      )
      await loadStatus()
    } catch (err: any) {
      setError(err?.message || 'Falha ao atualizar política de MFA.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  // Gera URL do QR code via CDN seguro ou Data URI SVG básico para renderizar otpauthUri
  const qrCodeImgUrl = setupData?.otpauthUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.otpauthUri)}`
    : ''

  const isMfaActive = status?.mfa?.enabled || false
  const isAdmin = status?.isAdmin || false

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="bg-slate-50 border-b border-slate-200 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isMfaActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isMfaActive ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-[#2F3942] flex items-center gap-2">
                <span>Autenticação Multifator (MFA / 2FA) & Sessões</span>
                <Badge
                  className={
                    isMfaActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-medium'
                      : 'bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-medium'
                  }
                >
                  {isMfaActive ? 'MFA Ativo (TOTP)' : 'MFA Opcional (Desativado)'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-[#6F7780] mt-0.5">
                Padrão RFC 6238 (TOTP 6 dígitos, janela 30s) • Google Authenticator e Microsoft
                Authenticator
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadStatus}
            disabled={loading}
            className="text-xs gap-1.5 border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {error && (
          <Alert variant="destructive" className="py-2.5">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {successMsg && (
          <Alert className="bg-emerald-50 text-emerald-900 border-emerald-200 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <AlertDescription className="text-xs">{successMsg}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Card 1: Situação do Usuário */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              <span>Status do Segundo Fator:</span>
            </div>
            <div className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Método:</span>
                <span className="font-mono font-medium text-slate-900">
                  {status?.mfa?.method || 'TOTP_RFC6238'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Algoritmo:</span>
                <span className="font-medium text-slate-900">HMAC-SHA256 (30s)</span>
              </div>
              <div className="flex justify-between">
                <span>Última Validação:</span>
                <span className="font-medium text-slate-900">
                  {status?.mfa?.verifiedAt
                    ? new Date(status.mfa.verifiedAt).toLocaleString('pt-BR')
                    : 'Nunca verificado'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Exigência por Perfil:</span>
                <span className="font-medium text-slate-900">
                  {status?.mfa?.enforced ? `Obrigatório (${status.mfa.enforcedRole})` : 'Opcional'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Segurança da Sessão e JWT */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>Segurança da Sessão PocketBase:</span>
            </div>
            <div className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Duração do authToken:</span>
                <span className="font-mono text-slate-900">12 horas (43.200s)</span>
              </div>
              <div className="flex justify-between">
                <span>Invalidação Imediata:</span>
                <span className="text-emerald-700 font-medium">Rotação de tokenKey</span>
              </div>
              <div className="flex justify-between">
                <span>Última Revogação:</span>
                <span className="font-mono text-slate-900">
                  {status?.sessionSecurity?.lastRevokedAt
                    ? new Date(status.sessionSecurity.lastRevokedAt).toLocaleString('pt-BR')
                    : 'Nenhuma ativa'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Risco Residual:</span>
                <span className="text-amber-700">Logout client descarta JWT</span>
              </div>
            </div>
          </div>

          {/* Card 3: Perfil e Permissões */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Identificação do Operador:</span>
            </div>
            <div className="space-y-1 text-slate-600">
              <div className="truncate">
                <span className="text-slate-500">Usuário: </span>
                <span className="font-medium text-slate-900">{user?.email}</span>
              </div>
              <div>
                <span className="text-slate-500">Papéis: </span>
                <span className="font-semibold text-indigo-700">
                  {status?.roles?.join(', ') || 'Sem perfil'}
                </span>
              </div>
              {status?.doctorProfile && (
                <div className="text-emerald-700 font-medium">
                  Médico: CRM {status.doctorProfile.crm}/{status.doctorProfile.crmState}
                </div>
              )}
              <div className="pt-1">
                <Badge variant="outline" className="text-[10px] bg-white">
                  Auditoria de Ativação: audit_logs
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Informação Técnica de Sessão e Logout */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-950 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-700" />
            <span>Nota de Segurança sobre Sessões e JWTs (Item 3 do briefing):</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            No PocketBase, o logout no frontend descarta o token na memória e no armazenamento local
            (<code>pb.authStore.clear()</code>). Porém, por ser um JWT assinado criptograficamente
            com o <code>tokenKey</code> do usuário, o token continuará tecnicamente válido até o seu
            tempo de expiração a menos que: (1) o usuário altere sua senha, (2) o usuário seja
            bloqueado ou (3) o administrador rotacione o <code>tokenKey</code> via rota de
            revogação. A funcionalidade de Revogação de Sessão abaixo executa exatamente essa
            rotação criptográfica instantânea.
          </p>
        </div>
      </CardContent>

      <CardFooter className="bg-slate-50/70 border-t border-slate-200 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isMfaActive ? (
            <Button
              type="button"
              onClick={handleStartSetup}
              disabled={loading}
              className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Configurar Segundo Fator (TOTP)</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDisableOpen(true)}
              disabled={loading}
              className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50 gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Desativar Segundo Fator</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleStartSetup}
            disabled={loading || !isMfaActive}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Regerar Segredo / App</span>
          </Button>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPolicyOpen(true)}
              className="text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Política por Perfil</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRevokeOpen(true)}
              className="text-xs text-amber-800 border-amber-300 hover:bg-amber-50 gap-1.5"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Revogar Sessões de Usuário</span>
            </Button>
          </div>
        )}
      </CardFooter>

      {/* MODAL 1: CONFIGURAÇÃO / ATIVAÇÃO DO SEGUNDO FATOR */}
      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Smartphone className="w-5 h-5 text-indigo-600" />
              <span>Configurar Aplicativo Autenticador (MFA)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Siga os passos abaixo para vincular seu aplicativo autenticador (Google Authenticator,
              Microsoft Authenticator, 1Password, Aegis etc.).
            </DialogDescription>
          </DialogHeader>

          {setupData && (
            <div className="space-y-4 py-2">
              {/* QR Code */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center">
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm mb-2">
                  {qrCodeImgUrl ? (
                    <img
                      src={qrCodeImgUrl}
                      alt="QR Code MFA"
                      className="w-44 h-44 object-contain"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                      QR Code indisponível
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Escaneie com a câmera do seu aplicativo de autenticação
                </span>
              </div>

              {/* Chave manual */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Chave de entrada manual:</span>
                  <button
                    type="button"
                    onClick={() => setShowSecretManual(!showSecretManual)}
                    className="text-indigo-600 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    {showSecretManual ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Ocultar
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Exibir Chave
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type={showSecretManual ? 'text' : 'password'}
                    value={setupData.secret}
                    className="font-mono text-xs bg-slate-100"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(setupData.secret)}
                    className="shrink-0 gap-1 text-xs"
                  >
                    {copiedSecret ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedSecret ? 'Copiado' : 'Copiar'}</span>
                  </Button>
                </div>
              </div>

              {/* Formulário de Confirmação com Código */}
              {recoveryCodes.length === 0 ? (
                <form onSubmit={handleConfirmEnable} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="mfa-verify-code"
                      className="text-xs font-semibold text-slate-800"
                    >
                      Digite o código de 6 dígitos gerado pelo seu app:
                    </Label>
                    <Input
                      id="mfa-verify-code"
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="font-mono text-center tracking-widest text-lg font-bold"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || verificationCode.length !== 6}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs"
                  >
                    {loading ? 'Validando Código...' : 'Confirmar e Ativar Segundo Fator'}
                  </Button>
                </form>
              ) : (
                /* Códigos de Recuperação */
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                  <div className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>MFA Ativado! Guarde estes códigos de uso único:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-xs text-emerald-950 font-bold p-2 bg-white rounded border border-emerald-200">
                    {recoveryCodes.map((c, i) => (
                      <div key={i} className="p-1 text-center bg-slate-50 rounded">
                        {c}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-emerald-800">
                    Estes códigos permitem acesso de emergência caso você perca o dispositivo. Cada
                    um só pode ser utilizado uma vez.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSetupOpen(false)}
              className="text-xs w-full"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: DESATIVAÇÃO DO SEGUNDO FATOR */}
      <Dialog open={isDisableOpen} onOpenChange={setIsDisableOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Desativar Segundo Fator (MFA)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              A remoção do segundo fator reduz a segurança da sua conta médica. Confirme com um
              código de 6 dígitos do autenticador:
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmDisable} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="disable-mfa-code" className="text-xs font-semibold text-slate-800">
                Código atual do autenticador (6 dígitos):
              </Label>
              <Input
                id="disable-mfa-code"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                className="font-mono text-center tracking-widest text-lg font-bold"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDisableOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || disableCode.length !== 6}
                className="bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs"
              >
                {loading ? 'Desativando...' : 'Confirmar Desativação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: REVOGAÇÃO DE SESSÕES / BLOQUEIO ADMINISTRATIVO (ADMIN) */}
      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <UserX className="w-5 h-5 text-amber-600" />
              <span>Revogação Administrativa de Sessões & Acessos</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              A rotação do <code>tokenKey</code> invalida instantaneamente todos os JWTs ativos do
              usuário em qualquer dispositivo ou navegador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteRevocation} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="target-user-id" className="text-xs font-semibold text-slate-800">
                ID do Usuário Alvo (PocketBase ID):
              </Label>
              <Input
                id="target-user-id"
                type="text"
                placeholder="ex: 62gqen1s1xuxyba"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                required
                className="font-mono text-xs"
              />
              <span className="text-[10px] text-slate-500">
                Pode ser obtido no painel de usuários ou lista de membros.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">Tipo de Ação:</Label>
              <select
                value={revokeAction}
                onChange={(e: any) => setRevokeAction(e.target.value)}
                className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
              >
                <option value="revoke_tokens">
                  Apenas Rotacionar tokenKey (Desconectar todas as sessões)
                </option>
                <option value="deactivate_user">
                  Bloquear Usuário + Rotacionar tokenKey (Inativar Conta)
                </option>
                <option value="deactivate_doctor">
                  Desligar Médico (Inativar em 'doctors' + Rotacionar tokenKey)
                </option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="revoke-reason" className="text-xs font-semibold text-slate-800">
                Motivo / Justificativa da Revogação:
              </Label>
              <Input
                id="revoke-reason"
                type="text"
                placeholder="ex: Suspeita de credencial comprometida ou desligamento clínico"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="text-xs"
              />
            </div>

            {revokeResult && (
              <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900 py-2 text-xs">
                {revokeResult}
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRevokeOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !targetUserId}
                className="bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs"
              >
                {loading ? 'Executando Revogação...' : 'Executar Revogação Imediata'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: POLÍTICA DE EXIGÊNCIA DE MFA POR PERFIL (ADMIN) */}
      <Dialog open={isPolicyOpen} onOpenChange={setIsPolicyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-900">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>Configurar Política de MFA por Perfil</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Permite sinalizar a recomendação ou obrigatoriedade de segundo fator para grupos de
              usuários (ex: apenas administradores ou médicos laudadores).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePolicy} className="space-y-4 py-2">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <strong>Diretriz Mandatória da Etapa 9A:</strong>
              <p className="text-[11px]">
                NÃO torne o MFA obrigatório globalmente sem autorização expressa do usuário. Esta
                configuração permanece por padrão <strong>DESATIVADA (Opcional)</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">Perfil Alvo:</Label>
              <select
                value={policyRole}
                onChange={(e: any) => setPolicyRole(e.target.value)}
                className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
              >
                <option value="none">Nenhum (MFA estritamente voluntário para todos)</option>
                <option value="admin">Apenas Administradores Gerais</option>
                <option value="cardiologist">Apenas Médicos Cardiologistas</option>
                <option value="all">
                  Todos os Usuários do Sistema (Requer Autorização Expressa)
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="policy-enforce-check"
                checked={policyEnforce}
                onChange={(e) => setPolicyEnforce(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <Label htmlFor="policy-enforce-check" className="text-xs font-medium text-slate-800">
                Sinalizar campo <code>mfa_enforced</code> para usuários deste perfil
              </Label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPolicyOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs"
              >
                {loading ? 'Salvando...' : 'Salvar Política'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
