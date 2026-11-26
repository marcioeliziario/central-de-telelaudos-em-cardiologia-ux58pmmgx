import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import {
  manualConferenceService,
  fileToBase64,
  sha256Hex,
  SIGNATURE_STATE_LABELS,
  SignatureExternalState,
  SignatureStateResponse,
} from '@/services/manualConferenceService'
import {
  Eye,
  Download,
  Upload,
  ClipboardCheck,
  XCircle,
  Lock,
  ShieldCheck,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

// Painel de Conferência Manual & Trilha de Estados da Assinatura Externa.
// Integra o serviço manualConferenceService (5 rotas do hook
// manual_conference_release.js) ao editor de laudos. Rótulos distintos:
// conferência manual NUNCA é rotulada como validação criptográfica automática.

const STATE_ORDER: SignatureExternalState[] = [
  'AGUARDANDO_ASSINATURA',
  'PDF_ASSINADO_RECEBIDO',
  'AGUARDANDO_CONFERENCIA',
  'CONFERENCIA_MANUAL_REGISTRADA',
  'VALIDADO_CRIPTOGRAFICAMENTE',
  'LIBERADO_A_CLINICA',
  'REJEITADO',
]

function stateTone(state: SignatureExternalState): string {
  switch (state) {
    case 'LIBERADO_A_CLINICA':
    case 'VALIDADO_CRIPTOGRAFICAMENTE':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300'
    case 'REJEITADO':
      return 'bg-rose-50 text-rose-800 border-rose-300'
    case 'CONFERENCIA_MANUAL_REGISTRADA':
      return 'bg-[#4A90D9]/10 text-[#2F3942] border-[#4A90D9]/30'
    default:
      return 'bg-amber-50 text-amber-800 border-amber-300'
  }
}

async function sha256Base64Bytes(pdfBase64: string): Promise<string> {
  const bin = atob(pdfBase64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface ManualConferencePanelProps {
  examId: string
  document: any | null
  onUpdated?: () => void
}

export function ManualConferencePanel({ examId, document, onUpdated }: ManualConferencePanelProps) {
  const { user } = useAuth()
  const [stateData, setStateData] = useState<SignatureStateResponse | null>(null)
  const [isLoadingState, setIsLoadingState] = useState(false)
  const [stateError, setStateError] = useState<string | null>(null)

  // Ação: enviar PDF assinado
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Ação: registrar conferência manual
  const [declaration, setDeclaration] = useState(false)
  const [itiResult, setItiResult] = useState<string>('')
  const [itiReference, setItiReference] = useState<string>('')
  const [conferenceNotes, setConferenceNotes] = useState<string>('')
  const [isRegistering, setIsRegistering] = useState(false)

  // Ação: rejeitar documento
  const [rejectReason, setRejectReason] = useState<string>('')
  const [isRejecting, setIsRejecting] = useState(false)

  // Ação: liberação clínica (espera-se bloqueio 403 com bloqueadores)
  const [releaseBlockers, setReleaseBlockers] = useState<string[] | null>(null)
  const [isRequestingRelease, setIsRequestingRelease] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(
    null,
  )

  const documentId = document?.id || stateData?.documentId || ''
  const signatureId = stateData?.signatureId || ''

  const loadState = useCallback(async () => {
    if (!documentId) return
    setIsLoadingState(true)
    setStateError(null)
    try {
      const res = await manualConferenceService.fetchState(documentId)
      setStateData(res)
      if (res.blockers?.length) setReleaseBlockers(res.blockers)
    } catch (err: any) {
      setStateData(null)
      setStateError(err?.message || 'Falha ao consultar o estado da assinatura.')
    } finally {
      setIsLoadingState(false)
    }
  }, [documentId])

  useEffect(() => {
    loadState()
  }, [loadState])

  const currentState = stateData?.state
  const showUpload = currentState === 'AGUARDANDO_ASSINATURA'
  const showConference =
    currentState === 'PDF_ASSINADO_RECEBIDO' || currentState === 'AGUARDANDO_CONFERENCIA'
  const showReject =
    currentState !== undefined &&
    currentState !== 'LIBERADO_A_CLINICA' &&
    currentState !== 'REJEITADO'
  const showRelease =
    currentState !== undefined &&
    currentState !== 'AGUARDANDO_ASSINATURA' &&
    currentState !== 'REJEITADO'

  const handleDownloadPdf = async () => {
    if (!document) {
      alert('Conclua o laudo para gerar o PDF definitivo antes de baixar.')
      return
    }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL || ''}/backend/v1/exams/${examId}/report-pdf-preview`,
        { headers: { Authorization: `Bearer ${pb.authStore.token}` } },
      )
      if (!res.ok) throw new Error('Falha ao obter o PDF para assinatura.')
      const data = await res.json()
      const filename = `${document.document_code || `LAUDO-ECG-${examId.slice(-6).toUpperCase()}-V${document.version || 1}`}.pdf`
      const blob = new Blob([data.pdfRawString], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = filename
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setActionMessage({ tone: 'ok', text: `PDF ${filename} baixado para assinatura externa.` })
    } catch (err: any) {
      setActionMessage({ tone: 'err', text: `Erro ao baixar PDF: ${err.message}` })
    }
  }

  const handleUploadSignedPdf = async () => {
    if (!selectedFile || !signatureId) return
    setIsUploading(true)
    setActionMessage(null)
    try {
      const pdfBase64 = await fileToBase64(selectedFile)
      const signedPdfHash = await sha256Base64Bytes(pdfBase64)
      await manualConferenceService.uploadSignedPdf({
        signatureId,
        pdfBase64,
        reportVersion: document?.version || 1,
        originalPdfHash: stateData?.originalFileHash || document?.file_hash_sha256 || undefined,
        signedPdfHash,
      })
      setSelectedFile(null)
      setActionMessage({
        tone: 'ok',
        text: 'PDF assinado registrado. A conferência manual é o próximo passo.',
      })
      await loadState()
      onUpdated?.()
    } catch (err: any) {
      setActionMessage({ tone: 'err', text: err?.message || 'Falha ao enviar o PDF assinado.' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleRegisterConference = async () => {
    if (!signatureId || !declaration) {
      setActionMessage({
        tone: 'err',
        text: 'A declaração de conferência manual é obrigatória para registrar.',
      })
      return
    }
    setIsRegistering(true)
    setActionMessage(null)
    try {
      await manualConferenceService.registerConference({
        signatureId,
        declaration,
        responsibleName: user?.name || '',
        responsibleCrm: '',
        originalPdfHash: stateData?.originalFileHash || document?.file_hash_sha256 || undefined,
        signedPdfHash: stateData?.signedFileHash || undefined,
        validarItiResult: itiResult || undefined,
        validarItiReference: itiReference || undefined,
        notes: conferenceNotes || undefined,
      })
      setDeclaration(false)
      setItiResult('')
      setItiReference('')
      setConferenceNotes('')
      setActionMessage({
        tone: 'ok',
        text: 'Conferência manual registrada. Isso NÃO constitui validação criptográfica automática.',
      })
      await loadState()
      onUpdated?.()
    } catch (err: any) {
      setActionMessage({ tone: 'err', text: err?.message || 'Falha ao registrar a conferência.' })
    } finally {
      setIsRegistering(false)
    }
  }

  const handleReject = async () => {
    if (!signatureId || rejectReason.trim().length < 5) {
      setActionMessage({
        tone: 'err',
        text: 'Informe a justificativa da rejeição (mín. 5 caracteres).',
      })
      return
    }
    setIsRejecting(true)
    setActionMessage(null)
    try {
      await manualConferenceService.rejectSignedPdf(signatureId, rejectReason.trim())
      setRejectReason('')
      setActionMessage({ tone: 'ok', text: 'Documento rejeitado. Um novo PDF poderá ser enviado.' })
      await loadState()
      onUpdated?.()
    } catch (err: any) {
      setActionMessage({ tone: 'err', text: err?.message || 'Falha ao rejeitar o documento.' })
    } finally {
      setIsRejecting(false)
    }
  }

  const handleRequestClinicalRelease = async () => {
    if (!signatureId) return
    setIsRequestingRelease(true)
    setActionMessage(null)
    try {
      const res = await manualConferenceService.requestClinicalRelease(signatureId)
      setReleaseBlockers(res.blockers || null)
      setActionMessage({
        tone: res.state === 'LIBERADO_A_CLINICA' ? 'ok' : 'err',
        text:
          res.state === 'LIBERADO_A_CLINICA'
            ? 'Documento liberado à clínica.'
            : res.message || 'Liberação clínica não permitida neste estado.',
      })
      await loadState()
      onUpdated?.()
    } catch (err: any) {
      const blockers: string[] =
        err?.response?.blockers || err?.response?.data?.blockers || err?.data?.blockers || []
      setReleaseBlockers(blockers.length ? blockers : [err?.message || 'Liberação bloqueada.'])
    } finally {
      setIsRequestingRelease(false)
    }
  }

  return (
    <div className="p-4 bg-white rounded-xl border border-[#4A90D9]/30 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#4A90D9]" />
          <span className="font-bold text-xs text-[#2F3942]">
            Conferência Manual &amp; Trilha de Estados da Assinatura
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={loadState}
            disabled={isLoadingState}
            className="h-6 text-[10px] px-2 text-[#4A90D9] hover:bg-[#4A90D9]/10"
            aria-label="Atualizar estado da assinatura"
          >
            {isLoadingState ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>Atualizar</span>}
          </Button>
          {currentState && (
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold ${stateTone(currentState)}`}
            >
              {stateData?.stateLabel || SIGNATURE_STATE_LABELS[currentState]}
            </Badge>
          )}
        </div>
      </div>

      {/* TRILHA DOS 7 ESTADOS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
        {STATE_ORDER.map((st) => {
          const isCurrent = st === currentState
          const isRejected = currentState === 'REJEITADO' && st === 'REJEITADO'
          const isDone =
            !isCurrent &&
            currentState !== 'REJEITADO' &&
            STATE_ORDER.indexOf(st) < STATE_ORDER.indexOf(currentState as SignatureExternalState)
          return (
            <div
              key={st}
              className={`p-1.5 rounded border text-[9px] leading-tight ${
                isCurrent || isRejected
                  ? stateTone(st) + ' font-semibold'
                  : isDone
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-slate-50 border-slate-200 text-[#6F7780]'
              }`}
            >
              {isCurrent || isRejected ? (
                <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
              ) : isDone ? (
                <CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5" />
              ) : null}
              {SIGNATURE_STATE_LABELS[st]}
            </div>
          )
        })}
      </div>

      {!documentId && (
        <p className="text-[11px] text-[#6F7780]">
          Conclua o laudo para gerar o documento definitivo e iniciar o ciclo de assinatura.
        </p>
      )}
      {stateError && (
        <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded p-2">
          {stateError}
        </p>
      )}

      {/* AÇÕES CONTEXTUAIS (apenas as aplicáveis ao estado atual) */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!document}
          onClick={() => {
            const evt = new CustomEvent('cardiolaudo:view-document', { detail: { documentId } })
            window.dispatchEvent(evt)
          }}
          className="h-7 text-[11px] border-[#4A90D9]/30 text-[#4A90D9] bg-white hover:bg-[#4A90D9]/10"
        >
          <Eye className="w-3 h-3 mr-1" />
          <span>Visualizar PDF</span>
        </Button>
        {(showUpload || currentState === 'REJEITADO') && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={!document}
            className="h-7 text-[11px] border-[#E3E6E8] bg-white text-[#2F3942] hover:bg-slate-50"
          >
            <Download className="w-3 h-3 mr-1" />
            <span>Baixar PDF para assinatura</span>
          </Button>
        )}
        {showUpload && (
          <label className="inline-flex items-center gap-1.5 h-7 px-2 text-[11px] border border-[#2F3942] rounded-md bg-[#2F3942] text-white cursor-pointer hover:bg-[#1f262c] font-semibold">
            {isUploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            <span>{selectedFile ? selectedFile.name.slice(0, 24) : 'Enviar PDF assinado'}</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setSelectedFile(f)
                  void handleUploadSignedPdf()
                }
              }}
            />
          </label>
        )}
        {showRelease && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRequestClinicalRelease}
            disabled={isRequestingRelease || !signatureId}
            className="h-7 text-[11px] border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold"
          >
            {isRequestingRelease ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Lock className="w-3 h-3 mr-1" />
            )}
            <span>Solicitar liberação à clínica</span>
          </Button>
        )}
      </div>

      {actionMessage && (
        <p
          className={`text-[11px] rounded p-2 border ${
            actionMessage.tone === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {actionMessage.text}
        </p>
      )}

      {/* LIBERAÇÃO CLÍNICA BLOQUEADA + BLOQUEADORES DO 403 */}
      {showRelease && currentState !== 'LIBERADO_A_CLINICA' && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-950 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Liberação à clínica bloqueada</span>
          </div>
          {releaseBlockers?.length ? (
            <ul className="list-disc pl-5 space-y-0.5">
              {releaseBlockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="text-amber-800">
              O endpoint /clinical-release retorna os bloqueadores do estado atual (403) até que a
              validação criptográfica automática seja aprovada.
            </p>
          )}
        </div>
      )}

      {/* FORMULÁRIO: CONFERÊNCIA MANUAL (rótulo explícito, distinto da validação automática) */}
      {showConference && (
        <div className="p-3 bg-[#F7F6F4]/60 rounded-lg border border-[#E3E6E8] space-y-2">
          <div className="flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-[#4A90D9]" />
            <span className="font-bold text-[11px] text-[#2F3942]">
              Registrar Conferência Manual (conferência humana — não é validação criptográfica
              automática)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <input
              id="conf-declaration"
              type="checkbox"
              checked={declaration}
              onChange={(e) => setDeclaration(e.target.checked)}
              className="mt-0.5 accent-[#4A90D9]"
            />
            <Label
              htmlFor="conf-declaration"
              className="text-[11px] font-normal text-[#2F3942] cursor-pointer"
            >
              Declaro que conferi o PDF assinado recebido contra o documento original (conferência
              manual, sem validação criptográfica automática neste passo).
            </Label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label htmlFor="conf-iti-result" className="text-[10px] font-semibold text-[#6F7780]">
                Resultado VALIDAR/ITI (opcional)
              </Label>
              <Input
                id="conf-iti-result"
                value={itiResult}
                onChange={(e) => setItiResult(e.target.value)}
                placeholder="Ex: valido / invalido / pendente"
                className="h-7 text-[11px] mt-0.5 border-[#E3E6E8]"
              />
            </div>
            <div>
              <Label htmlFor="conf-iti-ref" className="text-[10px] font-semibold text-[#6F7780]">
                Evidência / referência (opcional)
              </Label>
              <Input
                id="conf-iti-ref"
                value={itiReference}
                onChange={(e) => setItiReference(e.target.value)}
                placeholder="Ex: protocolo, print, relatório"
                className="h-7 text-[11px] mt-0.5 border-[#E3E6E8]"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="conf-notes" className="text-[10px] font-semibold text-[#6F7780]">
              Observações (opcional)
            </Label>
            <Textarea
              id="conf-notes"
              rows={2}
              value={conferenceNotes}
              onChange={(e) => setConferenceNotes(e.target.value)}
              className="text-[11px] mt-0.5 border-[#E3E6E8]"
            />
          </div>
          <Button
            size="sm"
            onClick={handleRegisterConference}
            disabled={isRegistering || !declaration}
            className="h-7 text-[11px] bg-[#4A90D9] hover:bg-[#3a7bc2] text-white font-semibold"
          >
            {isRegistering ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <ClipboardCheck className="w-3 h-3 mr-1" />
            )}
            <span>Registrar conferência manual</span>
          </Button>
        </div>
      )}

      {/* FORMULÁRIO: REJEIÇÃO */}
      {showReject && (
        <div className="p-3 bg-white rounded-lg border border-[#E3E6E8] space-y-2">
          <div className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span className="font-bold text-[11px] text-[#2F3942]">Rejeitar documento</span>
          </div>
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Justificativa da rejeição (mín. 5 caracteres)"
            aria-label="Justificativa da rejeição"
            className="h-7 text-[11px] border-[#E3E6E8]"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={isRejecting || !signatureId}
            className="h-7 text-[11px] border-rose-300 text-rose-800 bg-white hover:bg-rose-50 font-semibold"
          >
            {isRejecting ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <XCircle className="w-3 h-3 mr-1" />
            )}
            <span>Rejeitar documento</span>
          </Button>
        </div>
      )}

      {/* METADADOS DA CONFERÊNCIA REGISTRADA */}
      {stateData?.manualConference && (
        <div className="p-3 bg-[#F7F6F4]/60 rounded-lg border border-[#E3E6E8] space-y-1 text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-[#2F3942]">
            <ClipboardCheck className="w-3.5 h-3.5 text-[#4A90D9]" />
            <span>Metadados da conferência registrada</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[#2F3942]">
            <span>
              Responsável: <strong>{stateData.manualConference.responsibleName || '—'}</strong>
              {stateData.manualConference.responsibleCrm
                ? ` (CRM ${stateData.manualConference.responsibleCrm})`
                : ''}
            </span>
            <span>
              Documento/versão:{' '}
              <strong>
                {stateData.documentId?.slice(-8) || '—'} · v{stateData.documentVersion ?? '—'}
              </strong>
            </span>
            <span className="sm:col-span-2 break-all font-mono text-[10px]">
              Hash original: {stateData.originalFileHash || '—'}
            </span>
            <span className="sm:col-span-2 break-all font-mono text-[10px]">
              Hash assinado: {stateData.signedFileHash || '—'}
            </span>
            <span>
              Data/hora:{' '}
              <strong>
                {stateData.manualConference.timestamp
                  ? new Date(stateData.manualConference.timestamp).toLocaleString('pt-BR')
                  : '—'}
              </strong>
            </span>
            <span>
              Resultado VALIDAR/ITI:{' '}
              <strong>{stateData.manualConference.reportRef || 'não informado'}</strong>
            </span>
            {stateData.manualConference.notes && (
              <span className="sm:col-span-2">
                Evidência/obs: {stateData.manualConference.notes}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#6F7780] pt-1 border-t border-[#E3E6E8]">
            Registro de conferência manual. Somente o estado{' '}
            <strong>{SIGNATURE_STATE_LABELS.VALIDADO_CRIPTOGRAFICAMENTE}</strong> indica validação
            criptográfica automática (PAdES real, não simulada). padesDetected:{' '}
            {String(stateData.padesDetected ?? false)} · validação simulada:{' '}
            {String(stateData.isSimulated ?? false)}.
          </p>
        </div>
      )}

      {currentState === 'REJEITADO' && stateData?.rejectionReason && (
        <p className="text-[11px] text-rose-900 bg-rose-50 border border-rose-200 rounded p-2">
          Motivo da rejeição: {stateData.rejectionReason}
        </p>
      )}
      {currentState === 'LIBERADO_A_CLINICA' && (
        <p className="text-[11px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded p-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Documento liberado à clínica solicitante após validação criptográfica automática.
        </p>
      )}
      {/* hash local de conferência (informativo) */}
      <p className="text-[9px] text-[#6F7780]">
        Fluxo pendente de homologação E2E com documento fictício e assinatura ICP-Brasil válida.
      </p>
    </div>
  )
}

export default ManualConferencePanel
