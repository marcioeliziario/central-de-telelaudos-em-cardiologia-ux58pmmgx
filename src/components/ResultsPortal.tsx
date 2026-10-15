import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Search,
  Filter,
  Download,
  ShieldCheck,
  Lock,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileCheck,
  History,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ExamRequest, ReportDocument, ReportSignature } from '@/types/telelaudos'
import { documentService, examService } from '@/services/telelaudosService'
import { useAuth } from '@/contexts/AuthContext'

interface ResultsPortalProps {
  exams: ExamRequest[]
  onRefresh: () => void
}

export function ResultsPortal({ exams, onRefresh }: ResultsPortalProps) {
  const { user } = useAuth()

  // Filtros de busca
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterPeriod, setFilterPeriod] = useState<string>('all') // all, today, 7days, 30days

  // Estado de Documentos e Assinaturas
  const [selectedExam, setSelectedExam] = useState<ExamRequest | null>(null)
  const [examDocuments, setExamDocuments] = useState<ReportDocument[]>([])
  const [signaturesMap, setSignaturesMap] = useState<Record<string, ReportSignature | null>>({})
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState(false)

  // Download seguro com token temporário
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const [downloadSuccessInfo, setDownloadSuccessInfo] = useState<any | null>(null)

  // Filtragem dos exames da clínica
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      // 1. Busca por Paciente, Protocolo (ID) ou Indicação
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const patientName = exam.expand?.patient_id?.full_name?.toLowerCase() || ''
        const protocol = exam.id.toLowerCase()
        const clinical = exam.clinical_indication?.toLowerCase() || ''
        const cpf = exam.expand?.patient_id?.cpf || ''
        if (
          !patientName.includes(term) &&
          !protocol.includes(term) &&
          !clinical.includes(term) &&
          !cpf.includes(term)
        ) {
          return false
        }
      }

      // 2. Filtro de Situação
      if (filterStatus !== 'all') {
        if (filterStatus === 'em_elaboracao' && exam.status !== 'in_analysis') return false
        if (filterStatus === 'aguardando_assinatura' && exam.status !== 'waiting_signature')
          return false
        if (filterStatus === 'concluidos' && exam.status !== 'reported') return false
        if (filterStatus === 'devolvidos' && exam.status !== 'returned') return false
        if (filterStatus === 'pendentes' && exam.status !== 'pending') return false
      }

      // 3. Filtro de Prioridade
      if (filterPriority !== 'all' && exam.urgency !== filterPriority) {
        return false
      }

      // 4. Filtro de Período
      if (filterPeriod !== 'all') {
        const createdTime = new Date(exam.created).getTime()
        const now = Date.now()
        const oneDayMs = 24 * 60 * 60 * 1000
        if (filterPeriod === 'today' && now - createdTime > oneDayMs) return false
        if (filterPeriod === '7days' && now - createdTime > 7 * oneDayMs) return false
        if (filterPeriod === '30days' && now - createdTime > 30 * oneDayMs) return false
      }

      return true
    })
  }, [exams, searchTerm, filterStatus, filterPriority, filterPeriod])

  // Abrir histórico de versões e retificações de um exame
  const handleOpenVersions = async (exam: ExamRequest) => {
    setSelectedExam(exam)
    setIsVersionsModalOpen(true)
    setIsLoadingDocs(true)
    setDownloadError(null)
    setDownloadSuccessInfo(null)
    try {
      const docs = await documentService.getDocumentsForExam(exam.id)
      setExamDocuments(docs as ReportDocument[])

      // Buscar status das assinaturas de cada versão do documento
      const sigsMap: Record<string, ReportSignature | null> = {}
      for (const d of docs) {
        const sig = await documentService.getSignatureForDocument(d.id)
        sigsMap[d.id] = sig
      }
      setSignaturesMap(sigsMap)
    } catch (err: any) {
      console.warn('Erro ao carregar documentos do exame:', err)
    } finally {
      setIsLoadingDocs(false)
    }
  }

  // Ação de download seguro: chama o backend com validação criptográfica estrita
  const handleDownloadReport = async (doc: ReportDocument) => {
    setDownloadingDocId(doc.id)
    setDownloadError(null)
    setDownloadSuccessInfo(null)
    try {
      // 1. Backend verifica rigorosamente se o documento possui assinatura VALIDADA e está liberado
      const tokenRes = await documentService.getSecureAccessToken(doc.id)
      if (!tokenRes.success) {
        throw new Error('Falha ao obter permissão de acesso.')
      }

      // 2. Efetua o download auditado via endpoint temporário protegido
      const dlRes = await documentService.downloadWithSecureToken(
        doc.id,
        tokenRes.accessToken,
        user?.id || '',
      )

      setDownloadSuccessInfo({
        documentCode: tokenRes.documentCode,
        version: tokenRes.version,
        sha256: tokenRes.fileHashSha256,
        downloadUrl: tokenRes.downloadUrl,
      })
    } catch (err: any) {
      // Exibir bloqueio com clareza probatória
      setDownloadError(
        err.message ||
          'Este laudo ainda não possui assinatura digital válida e liberação clínica homologada.',
      )
    } finally {
      setDownloadingDocId(null)
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
            Prioritário (2h)
          </Badge>
        )
      case 'emergency':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] animate-pulse">
            Emergência
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-slate-600 border-slate-300 text-[10px]">
            Rotina (24h)
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px]">Na Fila</Badge>
      case 'in_analysis':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
            Em Elaboração
          </Badge>
        )
      case 'waiting_signature':
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[10px]">
            Aguardando Assinatura
          </Badge>
        )
      case 'returned':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]">
            Devolvido Técnico
          </Badge>
        )
      case 'reported':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
            Concluído & Assinado
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {status}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Busca do Portal de Resultados */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Campo de Pesquisa */}
            <div className="relative w-full md:flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Pesquisar por paciente, CPF, protocolo ou indicação clínica..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs h-9"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Filtros em Linha */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Filtro de Situação */}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="text-xs h-9 w-[170px]">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Situações</SelectItem>
                  <SelectItem value="pendentes">Na Fila</SelectItem>
                  <SelectItem value="em_elaboracao">Em Elaboração</SelectItem>
                  <SelectItem value="aguardando_assinatura">Aguardando Assinatura</SelectItem>
                  <SelectItem value="concluidos">Concluídos</SelectItem>
                  <SelectItem value="devolvidos">Devolvidos</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro de Prioridade */}
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="text-xs h-9 w-[140px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Prioridades</SelectItem>
                  <SelectItem value="routine">Rotina (24h)</SelectItem>
                  <SelectItem value="urgent">Prioritário (2h)</SelectItem>
                  <SelectItem value="emergency">Emergência</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro de Período */}
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="text-xs h-9 w-[130px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o Período</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="30days">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Exibindo <strong>{filteredExams.length}</strong> de <strong>{exams.length}</strong>{' '}
              exames enviados
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Validação criptográfica PAdES exigida para liberação
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela do Portal de Resultados */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="p-3">Protocolo</th>
                <th className="p-3">Data / Envio</th>
                <th className="p-3">Paciente / CPF</th>
                <th className="p-3">Prioridade & Prazo</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Laudo Clínico</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Nenhum exame encontrado com os critérios de busca selecionados.
                  </td>
                </tr>
              ) : (
                filteredExams.map((ex) => {
                  const isReady = ex.status === 'reported'
                  const isWaitingSig = ex.status === 'waiting_signature'
                  const isReturned = ex.status === 'returned'
                  const isInProgress = ex.status === 'in_analysis'

                  return (
                    <tr key={ex.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Protocolo */}
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {ex.id.slice(-6).toUpperCase()}
                      </td>

                      {/* Data */}
                      <td className="p-3 text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(ex.created).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(ex.created).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Paciente */}
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">
                          {ex.expand?.patient_id?.full_name || 'Paciente'}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          CPF: {ex.expand?.patient_id?.cpf || '—'}
                        </div>
                      </td>

                      {/* Prioridade e Prazo */}
                      <td className="p-3 space-y-1">
                        <div>{getUrgencyBadge(ex.urgency)}</div>
                        {ex.deadline_at && (
                          <div
                            className={`text-[10px] flex items-center gap-1 ${
                              ex.sla_status === 'atrasado'
                                ? 'text-red-600 font-semibold'
                                : ex.sla_status === 'proximo_do_vencimento'
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-slate-500'
                            }`}
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>
                              {ex.sla_status === 'atrasado' && 'Atrasado • '}
                              {ex.sla_status === 'proximo_do_vencimento' && 'Vence em breve • '}
                              {new Date(ex.deadline_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Situação */}
                      <td className="p-3">
                        {getStatusBadge(ex.status)}
                        {isReturned && ex.return_reason && (
                          <div
                            className="text-[10px] text-rose-600 mt-1 max-w-xs truncate"
                            title={ex.return_reason}
                          >
                            Motivo: {ex.return_reason}
                          </div>
                        )}
                      </td>

                      {/* Indicador de Laudo / Documento */}
                      <td className="p-3">
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Liberado
                          </span>
                        ) : isWaitingSig ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                            title="Em conferência médica. O laudo definitivo só é liberado após a assinatura ICP-Brasil validada."
                          >
                            <Lock className="w-3 h-3 text-amber-600" />
                            Assinatura Pendente
                          </span>
                        ) : isInProgress ? (
                          <span className="text-[10px] text-slate-500 italic">
                            Interpretação em andamento
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="p-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenVersions(ex)}
                          className="h-7 px-2.5 text-xs text-slate-700 hover:text-blue-700 border-slate-300 gap-1"
                        >
                          <History className="w-3.5 h-3.5 text-blue-600" />
                          <span>Versões & Laudo</span>
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DE HISTÓRICO DE VERSÕES, RETIFICAÇÕES E DOWNLOAD SEGURO */}
      <Dialog open={isVersionsModalOpen} onOpenChange={setIsVersionsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#0E4C92]" />
              <span>Documentos e Histórico de Retificações do Laudo</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Protocolo: {selectedExam?.id.slice(-6).toUpperCase()} • Paciente:{' '}
              {selectedExam?.expand?.patient_id?.full_name}
            </DialogDescription>
          </DialogHeader>

          {/* Banner de Segurança: Condições Estritas de Liberação */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#00A6A6]" />
              <span>Política Estrita de Liberação Probatória (Backend Enforcement):</span>
            </div>
            <p className="text-[11px] leading-relaxed text-blue-800">
              Apenas documentos formalmente{' '}
              <strong>assinados e com validação criptográfica homologada (VALIDADA)</strong> são
              disponibilizados para visualização ou download pela clínica. Versões preliminares ou
              não assinadas permanecem bloqueadas no servidor.
            </p>
          </div>

          {/* Alertas de Erro ou Sucesso */}
          {downloadError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold">Acesso Bloqueado pelo Servidor:</span>
                <p className="text-[11px] text-red-700">{downloadError}</p>
              </div>
            </div>
          )}

          {downloadSuccessInfo && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold">Laudo Validado Criptograficamente:</span>
                <div className="font-mono text-[10px] text-emerald-900">
                  Doc: {downloadSuccessInfo.documentCode} (v{downloadSuccessInfo.version}) •
                  SHA-256: {downloadSuccessInfo.sha256}
                </div>
                <div className="pt-1">
                  <Badge
                    variant="outline"
                    className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]"
                  >
                    Download auditado e registrado no banco
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Lista de Versões Geradas */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Versões Oficiais do Laudo Médico
            </h4>

            {isLoadingDocs ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Verificando documentos e assinaturas no servidor...
              </div>
            ) : examDocuments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                <Lock className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                <p className="font-medium text-slate-700">Nenhum laudo liberado para este exame.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  O documento estará disponível após a conclusão pelo cardiologista e a validação da
                  assinatura digital.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {examDocuments.map((doc) => {
                  const sig = signaturesMap[doc.id]
                  const isValidated =
                    sig?.signature_status === 'VALIDADA' && sig?.is_clinically_released === true
                  const isPending =
                    sig?.signature_status === 'PENDENTE' || sig?.signature_status === 'NAO_INICIADA'
                  const isProcessing = sig?.signature_status === 'PROCESSANDO'

                  return (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">
                              Versão {doc.version}.0
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {doc.document_code}
                            </span>
                            {doc.version > 1 && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[9px]">
                                Retificação
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Gerado em: {new Date(doc.generated_at).toLocaleString('pt-BR')} •
                            Tamanho:{' '}
                            {doc.file_size_bytes
                              ? `${Math.round(doc.file_size_bytes / 1024)} KB`
                              : 'PDF'}
                          </div>
                        </div>

                        {/* Status da Assinatura Digital */}
                        <div>
                          {isValidated ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Assinado & Validado
                            </Badge>
                          ) : isPending ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] gap-1">
                              <Lock className="w-3 h-3 text-amber-600" />
                              Assinatura Pendente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {sig?.signature_status || 'Em Conferência'}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Hash Criptográfico e Snapshot da Versão */}
                      <div className="bg-slate-50 p-2 rounded text-[10px] font-mono text-slate-600 break-all border border-slate-100">
                        SHA-256: {doc.file_hash_sha256}
                      </div>

                      {/* Botão de Download ou Bloqueio */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-500">
                          {isValidated
                            ? 'Documento validado e liberado para a clínica.'
                            : 'Bloqueado no backend: versão não liberada formalmente.'}
                        </span>

                        <Button
                          size="sm"
                          disabled={downloadingDocId === doc.id || !isValidated}
                          onClick={() => handleDownloadReport(doc)}
                          className={`text-xs gap-1.5 ${
                            isValidated
                              ? 'bg-[#0E4C92] hover:bg-[#0b3c74] text-white'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                          }`}
                        >
                          {downloadingDocId === doc.id ? (
                            <>Verificando no backend...</>
                          ) : isValidated ? (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Baixar Laudo Assinado</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Download Bloqueado</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVersionsModalOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default ResultsPortal
