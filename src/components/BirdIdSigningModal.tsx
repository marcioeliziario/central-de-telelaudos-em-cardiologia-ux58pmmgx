import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  FileText,
  Lock,
  ArrowRight,
  Info,
} from 'lucide-react'
import { birdIdProConnector } from '@/services/birdIdProConnector'
import { documentService } from '@/services/telelaudosService'
import type { BirdIdProviderInfo, ReportSignature, ReportDocument } from '@/types/telelaudos'
import { useToast } from '@/hooks/use-toast'

interface BirdIdSigningModalProps {
  isOpen: boolean
  onClose: () => void
  document: ReportDocument | null
  examId?: string
  doctorCrm?: string
  doctorName?: string
  onSignatureUpdated?: () => void
}

export function BirdIdSigningModal({
  isOpen,
  onClose,
  document,
  examId,
  doctorCrm,
  doctorName,
  onSignatureUpdated,
}: BirdIdSigningModalProps) {
  const { toast } = useToast()

  const [providerInfo, setProviderInfo] = useState<BirdIdProviderInfo | null>(null)
  const [signatures, setSignatures] = useState<ReportSignature[]>([])
  const [activeSig, setActiveSig] = useState<ReportSignature | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStartingTx, setIsStartingTx] = useState(false)
  const [isQueryingStatus, setIsQueryingStatus] = useState(false)
  const [isValidatingRelease, setIsValidatingRelease] = useState(false)
  const [isSimulatingEvent, setIsSimulatingEvent] = useState(false)
  const [activeTab, setActiveTab] = useState<'flow' | 'history' | 'diagnostic'>('flow')

  const [validationResult, setValidationResult] = useState<any | null>(null)

  // Carregar status do conector e histórico de assinaturas do documento
  const loadData = async () => {
    if (!document) return
    setIsLoading(true)
    try {
      // 1. Provedores
      const provRes = await birdIdProConnector.getProvidersStatus()
      const birdProv = provRes.providers.find((p) => p.id === 'birdid') || null
      setProviderInfo(birdProv)

      // 2. Histórico de assinaturas para este documento
      const sigs = (await documentService.getSignaturesByDocument(document.id)) as ReportSignature[]
      setSignatures(sigs)

      if (sigs.length > 0) {
        setActiveSig(sigs[0])
      } else {
        setActiveSig(null)
      }
    } catch (err: any) {
      console.error('Falha ao carregar dados Bird ID Pro:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && document) {
      loadData()
      setValidationResult(null)
    }
  }, [isOpen, document])

  // Iniciar transação Bird ID Pro
  const handleStartTransaction = async () => {
    if (!document) return
    setIsStartingTx(true)
    try {
      const res = await birdIdProConnector.initTransaction(document.id)
      toast({
        title: 'Transação iniciada',
        description: `TCN gerado: ${res.tcn || res.transactionId}. Conector em standby seguro.`,
      })
      await loadData()
      if (onSignatureUpdated) onSignatureUpdated()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao iniciar transação',
        description: err.message || 'Erro ao comunicar com o conector Bird ID Pro.',
      })
    } finally {
      setIsStartingTx(false)
    }
  }

  // Consultar status no provedor (via TCN)
  const handleQueryStatus = async () => {
    if (!activeSig) return
    const tcnOrTx = activeSig.tcn || activeSig.transaction_id
    if (!tcnOrTx) return

    setIsQueryingStatus(true)
    try {
      const res = await birdIdProConnector.queryStatus(tcnOrTx)
      toast({
        title: 'Status consultado',
        description: `Situação: ${res.status} (Status CESS: ${res.externalStatus}).`,
      })
      await loadData()
      if (onSignatureUpdated) onSignatureUpdated()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao consultar status',
        description: err.message || 'Erro ao consultar TCN.',
      })
    } finally {
      setIsQueryingStatus(false)
    }
  }

  // Simular evento da Soluti (Homologação Técnica Local)
  const handleSimulateEvent = async (eventType: 'SIGN_SUCCESS' | 'SIGN_FAIL') => {
    if (!activeSig?.transaction_id) return
    setIsSimulatingEvent(true)
    try {
      const res = await birdIdProConnector.triggerMockEvent({
        transactionId: activeSig.transaction_id,
        eventType,
      })
      toast({
        title: eventType === 'SIGN_SUCCESS' ? 'Simulação de Sucesso' : 'Simulação de Falha',
        description: res.disclaimer,
      })
      await loadData()
      if (onSignatureUpdated) onSignatureUpdated()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha na simulação',
        description: err.message || 'Erro ao processar mock-event.',
      })
    } finally {
      setIsSimulatingEvent(false)
    }
  }

  // Executar checklist de validação criptográfica e liberação clínica
  const handleValidateAndRelease = async () => {
    if (!activeSig) return
    setIsValidatingRelease(true)
    try {
      const res = await birdIdProConnector.validateAndRelease(activeSig.id)
      setValidationResult(res)
      if (res.allPassed && res.isClinicallyReleased) {
        toast({
          title: 'Documento Liberado!',
          description: 'Todos os 7 critérios criptográficos foram validados com sucesso.',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Liberação Bloqueada por Segurança',
          description:
            res.message ||
            'A validação criptográfica PAdES e cadeia ICP-Brasil não foram completadas.',
        })
      }
      await loadData()
      if (onSignatureUpdated) onSignatureUpdated()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na validação',
        description: err.message || 'Falha ao processar checklist.',
      })
    } finally {
      setIsValidatingRelease(false)
    }
  }

  const isRealActive = Boolean(providerInfo?.active)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0E4C92]" />
              <span>Conector Bird ID Pro — Assinatura Digital ICP-Brasil (Soluti)</span>
            </div>
            <Badge
              variant="outline"
              className={
                isRealActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]'
                  : 'bg-amber-50 text-amber-800 border-amber-300 text-[10px]'
              }
            >
              {isRealActive ? 'CONEXÃO REAL ATIVA' : 'CONEXÃO EXTERNA EM STANDBY'}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Assinatura digital PAdES (ISO 32000-1 / ETSI EN 319 142) com certificado em nuvem Soluti
            CESS.
          </DialogDescription>
        </DialogHeader>

        {/* Metadados do Documento e do Cardiologista */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <span className="text-slate-500">Documento:</span>{' '}
            <strong className="text-slate-900 font-mono">
              {document?.document_code} v{document?.version}.0
            </strong>
            <div
              className="text-[11px] text-slate-600 truncate mt-0.5"
              title={document?.file_hash_sha256}
            >
              SHA-256: <span className="font-mono">{document?.file_hash_sha256}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-500">Cardiologista Responsável:</span>{' '}
            <strong className="text-slate-900">{doctorName || 'Médico da Central'}</strong>
            <div className="text-[11px] text-slate-600 mt-0.5">
              CRM: {doctorCrm || 'Identificado na sessão'} (Titular único da assinatura)
            </div>
          </div>
        </div>

        {/* Alerta de Segurança e Gate de Credenciais */}
        {!isRealActive && (
          <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-300 text-xs text-amber-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <Lock className="w-4 h-4 text-amber-700" />
              <span>Conector Operando com Conexão Externa Desativada (Modo Standby)</span>
            </div>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              O conector funcional está integralmente construído e mapeado segundo o padrão Soluti
              CESS (TCN assíncrono, PAdES SHA-256 e proteção anti-replay). As chamadas externas
              reais estão desativadas até a contratação e inserção das credenciais de
              homologação/produção (BIRDID_CLIENT_ID, BIRDID_CLIENT_SECRET) nos segredos do
              ambiente.
            </p>
          </div>
        )}

        {/* Navegação de Abas Internas */}
        <div className="flex border-b border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('flow')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'flow'
                ? 'border-[#0E4C92] text-[#0E4C92]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Fluxo de Assinatura
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-[#0E4C92] text-[#0E4C92]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Histórico de Transações ({signatures.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagnostic')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'diagnostic'
                ? 'border-[#0E4C92] text-[#0E4C92]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Diagnóstico de Infraestrutura & Soluti
          </button>
        </div>

        {/* CONTEÚDO DA ABA: FLUXO DE ASSINATURA */}
        {activeTab === 'flow' && (
          <div className="space-y-4 py-2 text-xs">
            {/* Status da Transação Atual */}
            {activeSig ? (
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-500">Transação Interna:</span>
                    <div className="font-mono font-bold text-slate-900">
                      {activeSig.transaction_id}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      activeSig.signature_status === 'VALIDADA'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : activeSig.signature_status === 'ASSINADA'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                          : activeSig.signature_status === 'PROCESSANDO'
                            ? 'bg-sky-50 text-sky-800 border-sky-300'
                            : activeSig.signature_status === 'FALHA'
                              ? 'bg-red-50 text-red-800 border-red-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                    }
                  >
                    {activeSig.signature_status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500">Identificador Soluti (TCN):</span>{' '}
                    <strong className="font-mono text-slate-800">
                      {activeSig.tcn || 'Pendente de geração'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Status Externo CESS:</span>{' '}
                    <strong className="text-slate-800">
                      {activeSig.external_status || 'WAITING'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Liberação Clínica à Clínica:</span>{' '}
                    <strong
                      className={
                        activeSig.is_clinically_released ? 'text-emerald-700' : 'text-amber-800'
                      }
                    >
                      {activeSig.is_clinically_released ? 'LIBERADO' : 'BLOQUEADO'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Origem:</span>{' '}
                    <strong className="text-slate-800">
                      {activeSig.is_simulated ? 'Simulação de Homologação' : 'Produção Oficial'}
                    </strong>
                  </div>
                </div>

                {/* Botões de Ação na Transação Existente */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleQueryStatus}
                    disabled={isQueryingStatus}
                    className="h-7 text-xs gap-1"
                  >
                    {isQueryingStatus ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Consultar Status (TCN)</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleValidateAndRelease}
                    disabled={isValidatingRelease}
                    className="h-7 text-xs bg-[#0E4C92] hover:bg-[#0c3e77] text-white gap-1"
                  >
                    {isValidatingRelease ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3 h-3" />
                    )}
                    <span>Validar Criptografia & Liberar</span>
                  </Button>

                  {/* Testes de Homologação Local (Mock Eventos) */}
                  {!isRealActive && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSimulateEvent('SIGN_SUCCESS')}
                        disabled={isSimulatingEvent}
                        className="h-7 text-[11px] text-indigo-700 hover:bg-indigo-50 border border-indigo-200"
                        title="Simula retorno com sucesso da Soluti para testar o checklist"
                      >
                        Simular Assinatura Soluti
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSimulateEvent('SIGN_FAIL')}
                        disabled={isSimulatingEvent}
                        className="h-7 text-[11px] text-rose-700 hover:bg-rose-50 border border-rose-200"
                        title="Simula rejeição no app Bird ID"
                      >
                        Simular Falha Soluti
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-600">
                  Nenhuma transação ativa para este documento. Inicie o fluxo com o Bird ID Pro.
                </p>
                <Button
                  size="sm"
                  onClick={handleStartTransaction}
                  disabled={isStartingTx}
                  className="bg-[#0E4C92] hover:bg-[#0c3e77] text-white text-xs gap-1"
                >
                  {isStartingTx ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3 h-3" />
                  )}
                  <span>Iniciar Transação Bird ID Pro</span>
                </Button>
              </div>
            )}

            {/* Checklist de Validação Criptográfica (Quando executado) */}
            {validationResult && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900 text-xs">
                    Checklist de Conformidade ICP-Brasil (7 Critérios Estritos)
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      validationResult.allPassed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-50 text-red-800 border-red-300'
                    }
                  >
                    {validationResult.passedCount} de {validationResult.totalCount} critérios
                    aprovados
                  </Badge>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  {validationResult.checklist?.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-2 rounded bg-white border border-slate-200 flex items-start gap-2"
                    >
                      {item.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">{item.name}</div>
                        <div className="text-slate-500 text-[10px]">{item.description}</div>
                        <div className="text-slate-600 mt-0.5 italic">{item.details}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-slate-500">
                  Aviso mandatório: A resposta de sucesso da API Soluti NÃO é suficiente para
                  liberação clínica. A liberação exige validação matemática PAdES e ancoragem na AC
                  Raiz da ICP-Brasil.
                </p>
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA: HISTÓRICO DE TRANSAÇÕES */}
        {activeTab === 'history' && (
          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            {signatures.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Nenhuma transação registrada para este documento.
              </p>
            ) : (
              signatures.map((sig) => (
                <div
                  key={sig.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-mono text-slate-900">{sig.transaction_id}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {sig.signature_status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-600 grid grid-cols-2 gap-1">
                    <div>TCN: {sig.tcn || '—'}</div>
                    <div>Provedor: {sig.signing_provider || 'Bird ID Pro'}</div>
                    <div>
                      Solicitado:{' '}
                      {sig.requested_at ? new Date(sig.requested_at).toLocaleString('pt-BR') : '—'}
                    </div>
                    <div>
                      Concluído:{' '}
                      {sig.completed_at ? new Date(sig.completed_at).toLocaleString('pt-BR') : '—'}
                    </div>
                  </div>
                  {sig.rejection_reason && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-200">
                      Motivo de Falha/Rejeição: {sig.rejection_reason}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500">
                    Liberação clínica:{' '}
                    {sig.is_clinically_released ? 'LIBERADA' : 'BLOQUEADA (segurança garantida)'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA: DIAGNÓSTICO DE INFRAESTRUTURA & SOLUTI */}
        {activeTab === 'diagnostic' && (
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-900">
                Diagnóstico de Compatibilidade de Infraestrutura (Item 10)
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Conforme documentado em{' '}
                <a
                  href="https://docs.vaultid.com.br/workspace/cess/instalacao-e-configuracao"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0E4C92] underline inline-flex items-center gap-0.5"
                >
                  docs.vaultid.com.br/workspace/cess/instalacao-e-configuracao
                  <ExternalLink className="w-3 h-3" />
                </a>
                , o CESS da Soluti é disponibilizado primariamente como imagem Docker com portas
                8080 (serviço) e 5432 (Postgres).
              </p>
              <div className="p-2.5 bg-sky-50 rounded border border-sky-200 text-sky-950 text-[11px] space-y-1">
                <strong>Compatibilidade com Skip Cloud:</strong>
                <p>
                  O Skip Cloud é uma plataforma gerenciada (PocketBase em Go + VM JS pool) sem
                  suporte para execução de containers Docker adicionais locais. A arquitetura viável
                  estabelecida é:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    <strong>Opção 1 (Recomendada):</strong> Instância do Bird ID Pro CESS hospedada
                    e gerenciada diretamente pela Soluti em nuvem (SaaS/API pública HTTPS).
                  </li>
                  <li>
                    <strong>Opção 2:</strong> Instância Docker do CESS hospedada em cluster ou VM da
                    instituição/clínica, acessível via URL HTTPS segura (configurada em
                    BIRDID_PRO_BASE_URL).
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-900">Variáveis de Ambiente Necessárias</div>
              <div className="space-y-1 font-mono text-[11px] text-slate-700 bg-white p-2.5 rounded border border-slate-200">
                <div>BIRDID_PRO_ENABLED = "true"</div>
                <div>BIRDID_PRO_BASE_URL = "https://cess.sua-instancia.soluti.com.br"</div>
                <div>BIRDID_CLIENT_ID = "SEU_CLIENT_ID_SOLUTI"</div>
                <div>BIRDID_CLIENT_SECRET = "SEU_CLIENT_SECRET_SOLUTI"</div>
              </div>
              <p className="text-[11px] text-slate-500">
                Observação: As credenciais devem ser configuradas exclusivamente via secrets de
                ambiente no Skip Cloud (nunca no banco de dados nem no frontend).
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center gap-2">
          <div className="text-[10px] text-slate-400">
            Resoluções CFM 2.314/2022 e 2.299/2021 • PAdES ICP-Brasil
          </div>
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
