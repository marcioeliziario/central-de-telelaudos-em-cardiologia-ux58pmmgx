import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Shield,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  XCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { multiProviderSigningService } from '@/services/multiProviderSigningService'
import type {
  MultiSigningProvider,
  SigningSessionActiveResponse,
  SigningScope,
} from '@/types/telelaudos'

export function MultiProviderSigningCard() {
  const [providers, setProviders] = useState<MultiSigningProvider[]>([])
  const [selectedProviderKey, setSelectedProviderKey] = useState<string>('integra_bry')
  const [selectedPscId, setSelectedPscId] = useState<string>('birdid')
  const [selectedScope, setSelectedScope] = useState<SigningScope>('signature_session')
  const [activeSession, setActiveSession] = useState<SigningSessionActiveResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)
  const [isSimulatedAuthRunning, setIsSimulatedAuthRunning] = useState(false)

  const loadProvidersAndSession = async () => {
    setIsLoading(true)
    try {
      const [provRes, sessRes] = await Promise.all([
        multiProviderSigningService.getProviders(),
        multiProviderSigningService.getActiveSession(),
      ])
      if (provRes.success) {
        setProviders(provRes.providers)
        if (provRes.providers.length > 0 && !selectedProviderKey) {
          setSelectedProviderKey(provRes.providers[0].providerKey)
        }
      }
      setActiveSession(sessRes)
    } catch (err: any) {
      console.error('Erro carregando provedores/sessão:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProvidersAndSession()
  }, [])

  const currentProvider = providers.find((p) => p.providerKey === selectedProviderKey)

  // Iniciar Autorização de Sessão
  const handleStartAuthorization = async () => {
    setIsInitializing(true)
    setFeedbackMessage(null)
    try {
      const res = await multiProviderSigningService.initSession({
        providerKey: selectedProviderKey,
        pscId: selectedPscId,
        scope: selectedScope,
        lifetimeSeconds: 3600,
      })

      if (res.success) {
        setFeedbackMessage({
          type: 'info',
          text: `Fluxo de autenticação iniciado (State gerado: ${res.state.slice(0, 16)}...). Redirecionamento comercial em modo Standby (sem contratação real).`,
        })

        // Se for simulação permitida em homologação técnica, oferecer simulação de autorização
        if (res.isSimulated) {
          setIsSimulatedAuthRunning(true)
          setTimeout(async () => {
            try {
              const callbackRes = await multiProviderSigningService.processCallback({
                state: res.state,
                token: 'SIMULATED_PSC_AUTHORIZATION_TOKEN',
                isSimulated: true,
              })
              if (callbackRes.success) {
                setFeedbackMessage({
                  type: 'success',
                  text: `Sessão de assinatura simulada autorizada com sucesso! Validade até ${new Date(callbackRes.expiresAt).toLocaleTimeString('pt-BR')}.`,
                })
                await loadProvidersAndSession()
              }
            } catch (cbErr: any) {
              setFeedbackMessage({
                type: 'error',
                text: `Erro ao simular autorização do PSC: ${cbErr.message || 'Falha de callback'}`,
              })
            } finally {
              setIsSimulatedAuthRunning(false)
            }
          }, 1200)
        }
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro ao iniciar autorização: ${err.message || 'Falha no servidor'}`,
      })
    } finally {
      setIsInitializing(false)
    }
  }

  // Revogar / Encerrar Sessão
  const handleRevokeSession = async () => {
    setIsLoading(true)
    try {
      const res = await multiProviderSigningService.revokeSession()
      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: 'Sessão de assinatura revogada com sucesso. Credenciais descartadas do backend.',
        })
        await loadProvidersAndSession()
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro revogando sessão: ${err.message || 'Falha no servidor'}`,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-[#E3E6E8] bg-white text-[#2F3942] shadow-[0_1px_3px_rgba(47,57,66,0.03)] rounded-xl overflow-hidden">
      <CardHeader className="pb-3.5 px-5 border-b border-[#E3E6E8] bg-[#F7F6F4]/50 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-[#4A90D9]" />
          <CardTitle className="text-sm font-bold text-[#2F3942]">
            Assinatura Digital Multiprovedor (ICP-Brasil)
          </CardTitle>
          <Badge
            variant="outline"
            className="border-[#4A90D9]/30 text-[#4A90D9] bg-[#4A90D9]/10 text-[10px] font-medium"
          >
            Arquitetura Adapter
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadProvidersAndSession}
          disabled={isLoading}
          className="text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4] text-xs h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Status da Sessão Ativa */}
        {activeSession?.hasActiveSession ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-emerald-950">
                  Sessão de Assinatura Ativa (
                  {activeSession.providerKey === 'integra_bry' ? 'Integra Bry' : 'Bird ID Pro'})
                </span>
                {activeSession.isSimulated && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]"
                  >
                    SIMULAÇÃO
                  </Badge>
                )}
              </div>
              <div className="text-xs text-emerald-800 space-y-0.5">
                <p>
                  <strong>Titular do Certificado:</strong>{' '}
                  {activeSession.certificate?.cn || 'Cardiologista'}
                </p>
                <p>
                  <strong>Emissor ICP-Brasil:</strong> {activeSession.certificate?.issuer}
                </p>
                <p className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <strong>Expiração:</strong>{' '}
                  {new Date(activeSession.expiresAt || '').toLocaleString('pt-BR')} (restam aprox.{' '}
                  {Math.round((activeSession.remainingSeconds || 0) / 60)} min)
                </p>
                <p className="flex items-center gap-1 text-[11px] text-teal-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  <strong>Criptografia em Repouso:</strong>{' '}
                  {activeSession.encryptionAlgorithm || 'AES-256-GCM'} (Versão Chave:{' '}
                  {activeSession.keyVersion || 'v1'})
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeSession}
              disabled={isLoading}
              className="border-emerald-300 text-emerald-900 hover:bg-emerald-100 shrink-0"
            >
              <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" />
              Encerrar Sessão
            </Button>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm flex items-center justify-between text-slate-700">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-500" />
              <span>Nenhuma sessão autorizada no momento. Selecione o provedor e autorize.</span>
            </div>
            <Badge variant="outline" className="text-slate-500">
              Desconectado
            </Badge>
          </div>
        )}

        {/* Seleção do Provedor e Parâmetros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Provedor de Assinatura
            </label>
            <Select
              value={selectedProviderKey}
              onValueChange={(val) => {
                setSelectedProviderKey(val)
                const prov = providers.find((p) => p.providerKey === val)
                if (prov && prov.supportedPscs.length > 0) {
                  setSelectedPscId(prov.supportedPscs[0].id)
                }
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecione o provedor" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.providerKey} value={p.providerKey}>
                    {p.displayName} {p.status === 'STANDBY_HOMOLOGACAO' ? '(Standby)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              PSC Multiplexado (Nuvem)
            </label>
            <Select value={selectedPscId} onValueChange={setSelectedPscId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecione o PSC" />
              </SelectTrigger>
              <SelectContent>
                {currentProvider?.supportedPscs?.map((psc) => (
                  <SelectItem key={psc.id} value={psc.id}>
                    {psc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Escopo da Sessão
            </label>
            <Select value={selectedScope} onValueChange={(val: any) => setSelectedScope(val)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Escopo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="signature_session">
                  signature_session (Múltiplos laudos na sessão)
                </SelectItem>
                <SelectItem value="multi_signature">
                  multi_signature (Assinatura múltipla)
                </SelectItem>
                <SelectItem value="single_signature">
                  single_signature (Assinatura única)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Feedback visual */}
        {feedbackMessage && (
          <Alert
            className={
              feedbackMessage.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : feedbackMessage.type === 'error'
                  ? 'border-rose-300 bg-rose-50 text-rose-950'
                  : 'border-blue-300 bg-blue-50 text-blue-950'
            }
          >
            <AlertDescription className="text-xs">{feedbackMessage.text}</AlertDescription>
          </Alert>
        )}

        {/* Ações e Aviso de Homologação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Padrão PAdES ICP-Brasil (ISO 32000-1). Nenhum PIN/OTP armazenado no banco. Tokens
              temporários protegidos com Criptografia Autenticada Padronizada AES-256-GCM.
            </span>
          </div>

          <Button
            size="sm"
            onClick={handleStartAuthorization}
            disabled={isInitializing || isSimulatedAuthRunning}
            className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold text-xs h-8 shadow-xs shrink-0"
          >
            {isInitializing || isSimulatedAuthRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Autorizando Sessão...
              </>
            ) : (
              <>
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Autorizar Sessão no Provedor
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
