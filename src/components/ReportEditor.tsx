import React, { useState, useEffect, useRef } from 'react'
import {
  ExamRequest,
  ReportTemplate,
  ReportDraft,
  ECGReport,
  CriticalFindingClassification,
  CriticalFindingChannel,
} from '@/types/telelaudos'
import {
  examService,
  templateService,
  draftService,
  criticalFindingService,
  documentService,
} from '@/services/telelaudosService'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  FileCheck,
  Save,
  CheckCircle2,
  AlertTriangle,
  History,
  BookOpen,
  Send,
  RotateCcw,
  Clock,
  Sparkles,
  PhoneCall,
  ShieldAlert,
  Lock,
  Loader2,
  Info,
  FileText,
  Eye,
  PenTool,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import { BirdIdSigningModal } from '@/components/BirdIdSigningModal'

interface ReportEditorProps {
  exam: ExamRequest
  onReportSubmitted?: () => void
  onReturnRequested?: () => void
}

export default function ReportEditor({
  exam,
  onReportSubmitted,
  onReturnRequested,
}: ReportEditorProps) {
  // Modelos e histórico
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [draftHistory, setDraftHistory] = useState<ReportDraft[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Estados dos Campos Clínicos - SBC 2022
  // Quantitativos opcionais e editáveis
  const [heartRate, setHeartRate] = useState<string>('')
  const [electricalAxis, setElectricalAxis] = useState<string>('')
  const [prIntervalMs, setPrIntervalMs] = useState<string>('')
  const [qrsDurationMs, setQrsDurationMs] = useState<string>('')
  const [qtIntervalMs, setQtIntervalMs] = useState<string>('')
  const [qtcIntervalMs, setQtcIntervalMs] = useState<string>('')

  // Qualitativos
  const [cardiacRhythm, setCardiacRhythm] = useState<string>('')
  const [pWaveDesc, setPWaveDesc] = useState<string>('')
  const [avConduction, setAvConduction] = useState<string>('')
  const [ivConduction, setIvConduction] = useState<string>('')
  const [repolarization, setRepolarization] = useState<string>('')
  const [qWaves, setQWaves] = useState<string>('')
  const [technicalQuality, setTechnicalQuality] = useState<string>(
    'Traçado com boa qualidade técnica, sem artefatos relevantes.',
  )

  // Descrição e Conclusão (Obrigatórias em texto livre)
  const [freeTextDescription, setFreeTextDescription] = useState<string>('')
  const [freeTextConclusion, setFreeTextConclusion] = useState<string>('')

  // Status de Salvamento Automático
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null)
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false)
  const [submissionSuccessModal, setSubmissionSuccessModal] = useState<boolean>(false)

  // Modais adicionais: Devolução Técnica e Achado Crítico
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false)
  const [returnReason, setReturnReason] = useState<string>('')
  const [isReturning, setIsReturning] = useState<boolean>(false)

  const [isCriticalModalOpen, setIsCriticalModalOpen] = useState<boolean>(false)
  const [criticalClass, setCriticalClass] =
    useState<CriticalFindingClassification>('infarto_agudo_supra_st')
  const [criticalJustification, setCriticalJustification] = useState<string>('')
  const [criticalRecipient, setCriticalRecipient] = useState<string>('')
  const [criticalChannel, setCriticalChannel] = useState<CriticalFindingChannel>('telefone_plantao')
  const [criticalConfirmed, setCriticalConfirmed] = useState<boolean>(false)
  const [criticalConfirmationNotes, setCriticalConfirmationNotes] = useState<string>('')
  const [isRegisteringCritical, setIsRegisteringCritical] = useState<boolean>(false)
  const [hasCriticalFindingRegistered, setHasCriticalFindingRegistered] = useState<boolean>(false)

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false)
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true)

  // ETAPA 4A: Documentos (PDF) e Assinatura Digital
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewMeta, setPreviewMeta] = useState<{
    documentCode: string
    version: number
    sha256: string
    fileSizeBytes: number
    disclaimer: string
  } | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false)
  const [isPreparing, setIsPreparing] = useState<boolean>(false)
  const [prepareResult, setPrepareResult] = useState<{
    documentCode: string
    version: number
    sha256: string
  } | null>(null)
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState<boolean>(false)
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false)
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false)
  const [signatures, setSignatures] = useState<any[]>([])
  const [isLoadingSigs, setIsLoadingSigs] = useState<boolean>(false)

  // ETAPA 6A: Modal Conector Bird ID Pro
  const [isBirdIdModalOpen, setIsBirdIdModalOpen] = useState<boolean>(false)
  const [activeReportDoc, setActiveReportDoc] = useState<any | null>(null)

  // Referência para debounce do auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstMountRef = useRef<boolean>(true)

  // Carregar Templates e Rascunho mais recente
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setIsLoadingInitial(true)
      try {
        const [tpls, latestDraft, history, criticals] = await Promise.all([
          templateService.getAll(),
          draftService.getLatestForExam(exam.id),
          draftService.getHistoryForExam(exam.id),
          criticalFindingService.getForExam(exam.id),
        ])

        if (!isMounted) return

        setTemplates(tpls)
        setDraftHistory(history)
        if (criticals && criticals.length > 0) {
          setHasCriticalFindingRegistered(true)
        }

        // Se houver rascunho salvo, restaurar
        if (latestDraft) {
          setHeartRate(latestDraft.heart_rate ? String(latestDraft.heart_rate) : '')
          setElectricalAxis(latestDraft.electrical_axis || '')
          setPrIntervalMs(latestDraft.pr_interval_ms ? String(latestDraft.pr_interval_ms) : '')
          setQrsDurationMs(latestDraft.qrs_duration_ms ? String(latestDraft.qrs_duration_ms) : '')
          setQtIntervalMs(latestDraft.qt_interval_ms ? String(latestDraft.qt_interval_ms) : '')
          setQtcIntervalMs(latestDraft.qtc_interval_ms ? String(latestDraft.qtc_interval_ms) : '')
          setCardiacRhythm(latestDraft.cardiac_rhythm || '')
          setPWaveDesc(latestDraft.p_wave_description || '')
          setAvConduction(latestDraft.av_conduction_alterations || '')
          setIvConduction(latestDraft.iv_conduction_alterations || '')
          setRepolarization(latestDraft.repolarization_alterations || '')
          setQWaves(latestDraft.q_waves_findings || '')
          setTechnicalQuality(
            latestDraft.technical_quality_notes || 'Traçado com boa qualidade técnica.',
          )
          setFreeTextDescription(latestDraft.free_text_description || '')
          setFreeTextConclusion(latestDraft.free_text_conclusion || '')
          setLastSavedTime(new Date(latestDraft.updated).toLocaleTimeString('pt-BR'))
          setSaveStatus('saved')
        } else {
          // Valores iniciais padrão neutros
          setCardiacRhythm('Ritmo sinusal regular')
        }
      } catch (err) {
        console.error('Erro ao carregar dados do editor de laudos:', err)
      } finally {
        if (isMounted) {
          setIsLoadingInitial(false)
          isFirstMountRef.current = false
        }
      }
    }

    loadData()
    return () => {
      isMounted = false
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [exam.id])

  // Lógica de Salvamento do Rascunho
  const performSaveDraft = async () => {
    setSaveStatus('saving')
    try {
      const payload = {
        heart_rate: heartRate ? Number(heartRate) : null,
        cardiac_rhythm: cardiacRhythm,
        electrical_axis: electricalAxis,
        pr_interval_ms: prIntervalMs ? Number(prIntervalMs) : null,
        qrs_duration_ms: qrsDurationMs ? Number(qrsDurationMs) : null,
        qt_interval_ms: qtIntervalMs ? Number(qtIntervalMs) : null,
        qtc_interval_ms: qtcIntervalMs ? Number(qtcIntervalMs) : null,
        p_wave_description: pWaveDesc,
        av_conduction_alterations: avConduction,
        iv_conduction_alterations: ivConduction,
        repolarization_alterations: repolarization,
        q_waves_findings: qWaves,
        free_text_description: freeTextDescription,
        free_text_conclusion: freeTextConclusion,
        technical_quality_notes: technicalQuality,
      }

      const res = await examService.saveDraft(exam.id, payload)
      if (res.success) {
        setSaveStatus('saved')
        setLastSavedTime(new Date().toLocaleTimeString('pt-BR'))
        // Atualizar lista de histórico
        const updatedHistory = await draftService.getHistoryForExam(exam.id)
        setDraftHistory(updatedHistory)
      } else {
        setSaveStatus('error')
      }
    } catch (err) {
      console.error('Erro ao salvar rascunho:', err)
      setSaveStatus('error')
    }
  }

  // Acionar auto-save com debounce de 2 segundos quando campos forem alterados
  useEffect(() => {
    if (isFirstMountRef.current || isLoadingInitial) return

    setSaveStatus('idle')
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)

    autoSaveTimerRef.current = setTimeout(() => {
      performSaveDraft()
    }, 2000)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [
    heartRate,
    electricalAxis,
    prIntervalMs,
    qrsDurationMs,
    qtIntervalMs,
    qtcIntervalMs,
    cardiacRhythm,
    pWaveDesc,
    avConduction,
    ivConduction,
    repolarization,
    qWaves,
    technicalQuality,
    freeTextDescription,
    freeTextConclusion,
  ])

  // Aplicar Modelo de Redação (SEM preencher medidas numéricas fictícias)
  const handleApplyTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId)
    if (!tpl) return

    setSelectedTemplateId(tplId)
    if (tpl.rhythm) setCardiacRhythm(tpl.rhythm)
    if (tpl.p_wave_description) setPWaveDesc(tpl.p_wave_description)
    if (tpl.av_conduction) setAvConduction(tpl.av_conduction)
    if (tpl.iv_conduction) setIvConduction(tpl.iv_conduction)
    if (tpl.repolarization) setRepolarization(tpl.repolarization)
    if (tpl.q_waves) setQWaves(tpl.q_waves)
    if (tpl.description) setFreeTextDescription(tpl.description)
    if (tpl.conclusion) setFreeTextConclusion(tpl.conclusion)
  }

  // Submeter laudo para Aguardando Assinatura (SEM liberação direta)
  const handleSubmitReport = async () => {
    if (!freeTextConclusion.trim()) {
      alert('A conclusão eletrocardiográfica é obrigatória conforme a Diretriz SBC.')
      return
    }
    if (!freeTextDescription.trim()) {
      alert('A descrição do traçado é obrigatória conforme a Diretriz SBC.')
      return
    }

    setIsSubmittingReport(true)
    try {
      const payload = {
        heart_rate: heartRate ? Number(heartRate) : null,
        cardiac_rhythm: cardiacRhythm,
        electrical_axis: electricalAxis,
        pr_interval_ms: prIntervalMs ? Number(prIntervalMs) : null,
        qrs_duration_ms: qrsDurationMs ? Number(qrsDurationMs) : null,
        qt_interval_ms: qtIntervalMs ? Number(qtIntervalMs) : null,
        qtc_interval_ms: qtcIntervalMs ? Number(qtcIntervalMs) : null,
        p_wave_description: pWaveDesc,
        av_conduction_alterations: avConduction,
        iv_conduction_alterations: ivConduction,
        repolarization_alterations: repolarization,
        q_waves_findings: qWaves,
        free_text_description: freeTextDescription,
        free_text_conclusion: freeTextConclusion,
        technical_quality_notes: technicalQuality,
        has_critical_findings: hasCriticalFindingRegistered,
      }

      await examService.submitReport(exam.id, payload)
      setSubmissionSuccessModal(true)
    } catch (err: any) {
      alert(`Erro ao submeter laudo: ${err.message}`)
    } finally {
      setIsSubmittingReport(false)
    }
  }

  // Devolver Exame por problema técnico
  const handleConfirmReturn = async () => {
    if (!returnReason.trim() || returnReason.trim().length < 5) {
      alert('A justificativa da devolução técnica é obrigatória (mínimo de 5 caracteres).')
      return
    }

    setIsReturning(true)
    try {
      await examService.returnExam(exam.id, returnReason.trim())
      setIsReturnModalOpen(false)
      if (onReturnRequested) onReturnRequested()
    } catch (err: any) {
      alert(`Erro ao devolver exame: ${err.message}`)
    } finally {
      setIsReturning(false)
    }
  }

  // ETAPA 4A: Visualizar prévia do PDF antes de iniciar a assinatura
  const handlePreviewPdf = async () => {
    setIsLoadingPreview(true)
    try {
      const res = await documentService.getPreview(exam.id)
      if (res.success && res.pdfRawString) {
        // Converte a string PDF recebida em Blob para renderização local (sem URL pública)
        const bytes = new Uint8Array(res.pdfRawString.length)
        for (let i = 0; i < res.pdfRawString.length; i++) {
          bytes[i] = res.pdfRawString.charCodeAt(i) & 0xff
        }
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        setPreviewPdfUrl(url)
        setPreviewMeta({
          documentCode: res.documentCode,
          version: res.version,
          sha256: res.sha256,
          fileSizeBytes: res.fileSizeBytes,
          disclaimer: res.disclaimer,
        })
        setIsPreviewModalOpen(true)
      }
    } catch (err: any) {
      alert(`Erro ao gerar prévia do PDF: ${err.message}`)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // ETAPA 4A: Preparar PDF definitivo para assinatura digital (bloqueia a versão)
  const handlePrepareSignature = async () => {
    if (
      !confirm(
        'Esta ação gera o PDF definitivo desta versão, calcula o hash SHA-256 e BLOQUEIA o conteúdo contra alterações. Para corrigir depois, será criada uma NOVA versão. Confirmar?',
      )
    ) {
      return
    }
    setIsPreparing(true)
    try {
      const res = await documentService.prepareForSignature(exam.id)
      setPrepareResult({
        documentCode: res.documentCode,
        version: res.version,
        sha256: res.sha256,
      })
    } catch (err: any) {
      alert(`Erro ao preparar documento para assinatura: ${err.message}`)
    } finally {
      setIsPreparing(false)
    }
  }

  // ETAPA 4A: Consultar versões do documento
  const handleOpenVersions = async () => {
    setIsVersionsModalOpen(true)
    setIsLoadingDocs(true)
    try {
      const docs = await documentService.getDocumentsForExam(exam.id)
      setDocuments(docs)
    } catch (err) {
      console.error('Erro ao carregar documentos:', err)
    } finally {
      setIsLoadingDocs(false)
    }
  }

  // ETAPA 4A: Consultar status da assinatura
  const handleOpenSignatureStatus = async () => {
    setIsSignatureModalOpen(true)
    setIsLoadingSigs(true)
    try {
      const sigs = await documentService.getSignaturesForExam(exam.id)
      setSignatures(sigs)
    } catch (err) {
      console.error('Erro ao carregar assinaturas:', err)
    } finally {
      setIsLoadingSigs(false)
    }
  }

  // Registrar Achado Crítico
  const handleRegisterCriticalFinding = async () => {
    if (!criticalJustification.trim() || !criticalRecipient.trim()) {
      alert('Preencha a justificativa clínica e o destinatário do contato.')
      return
    }

    setIsRegisteringCritical(true)
    try {
      await examService.registerCriticalFinding(exam.id, {
        classification: criticalClass,
        justification: criticalJustification.trim(),
        contact_recipient: criticalRecipient.trim(),
        contact_channel: criticalChannel,
        confirmed_by_recipient: criticalConfirmed,
        confirmation_notes: criticalConfirmationNotes.trim(),
      })
      setHasCriticalFindingRegistered(true)
      setIsCriticalModalOpen(false)
      alert(
        'Comunicação de achado potencialmente crítico registrada com sucesso em trilha de auditoria.',
      )
    } catch (err: any) {
      alert(`Erro ao registrar achado crítico: ${err.message}`)
    } finally {
      setIsRegisteringCritical(false)
    }
  }

  if (isLoadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 space-y-2">
        <Loader2 className="w-6 h-6 animate-spin text-[#0E4C92]" />
        <span className="text-xs">Carregando editor e rascunho de laudo...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Topo do Editor de Laudos: Status de Salvamento e Biblioteca de Modelos */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#0E4C92]" />
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Editor de Laudos Eletrocardiográficos
              </h3>
              <p className="text-[11px] text-slate-500">
                Referência: Diretriz SBC 2022 • Laudo Estruturado e Conclusivo
              </p>
            </div>
          </div>

          {/* Indicador Visual do Salvamento Automático */}
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <Badge
                variant="outline"
                className="text-[11px] bg-sky-50 text-sky-800 border-sky-300 gap-1"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Salvando rascunho...</span>
              </Badge>
            )}
            {saveStatus === 'saved' && (
              <Badge
                variant="outline"
                className="text-[11px] bg-emerald-50 text-emerald-800 border-emerald-300 gap-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Salvo {lastSavedTime ? `às ${lastSavedTime}` : ''}</span>
              </Badge>
            )}
            {saveStatus === 'error' && (
              <Badge
                variant="outline"
                className="text-[11px] bg-red-50 text-red-800 border-red-300 gap-1"
              >
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>Falha no salvamento</span>
              </Badge>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={performSaveDraft}
              className="h-7 text-xs gap-1 border-slate-300"
              title="Salvar rascunho agora"
            >
              <Save className="w-3 h-3" />
              <span>Salvar</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsHistoryModalOpen(true)}
              className="h-7 text-xs gap-1 border-slate-300"
              title="Histórico de versões deste rascunho"
            >
              <History className="w-3 h-3" />
              <span>Versões ({draftHistory.length})</span>
            </Button>
          </div>
        </div>

        {/* Barra de Seleção de Modelos de Laudo */}
        <div className="p-3 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <BookOpen className="w-4 h-4 text-[#00A6A6] shrink-0" />
            <div className="w-full">
              <Select value={selectedTemplateId} onValueChange={handleApplyTemplate}>
                <SelectTrigger className="text-xs bg-white h-8">
                  <SelectValue placeholder="Carregar Modelo SBC (Atalho de redação editável)" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                      [{tpl.category}] {tpl.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 italic max-w-sm">
            Modelos são sugestões de redação e NÃO diagnósticos automáticos. Medidas numéricas devem
            ser mensuradas pelo médico.
          </div>
        </div>
      </Card>

      {/* Formulário Estruturado Conforme Diretriz SBC 2022 */}
      <Card className="border-slate-200 bg-white shadow-sm p-4 space-y-4">
        {/* Bloco 1: Parâmetros Quantitativos Opcionais */}
        <div>
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              1. Medidas Eletrocardiográficas (Quantitativas Opcionais)
            </h4>
            <span className="text-[10px] text-slate-400">
              Preenchimento manual médico — sem preenchimento automático arbitrário
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-[11px] text-slate-600">FC (bpm)</Label>
              <Input
                type="number"
                placeholder="Ex: 72"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Eixo QRS (°)</Label>
              <Input
                placeholder="Ex: +45° ou normal"
                value={electricalAxis}
                onChange={(e) => setElectricalAxis(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Intervalo PR (ms)</Label>
              <Input
                type="number"
                placeholder="Ex: 160"
                value={prIntervalMs}
                onChange={(e) => setPrIntervalMs(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Duração QRS (ms)</Label>
              <Input
                type="number"
                placeholder="Ex: 88"
                value={qrsDurationMs}
                onChange={(e) => setQrsDurationMs(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Intervalo QT (ms)</Label>
              <Input
                type="number"
                placeholder="Ex: 380"
                value={qtIntervalMs}
                onChange={(e) => setQtIntervalMs(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">QTc Bazett (ms)</Label>
              <Input
                type="number"
                placeholder="Ex: 410"
                value={qtcIntervalMs}
                onChange={(e) => setQtcIntervalMs(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
          </div>
        </div>

        {/* Bloco 2: Análise Qualitativa dos Segmentos (SBC 2022) */}
        <div>
          <div className="pb-1.5 border-b border-slate-100 mb-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              2. Avaliação Morfológica e Condução
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-slate-700">Ritmo Cardíaco</Label>
              <Input
                placeholder="Ex: Ritmo sinusal regular"
                value={cardiacRhythm}
                onChange={(e) => setCardiacRhythm(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-700">Descrição da Onda P</Label>
              <Input
                placeholder="Ex: Positiva em D1, D2 e aVF, duração e amplitude normais"
                value={pWaveDesc}
                onChange={(e) => setPWaveDesc(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-700">Condução Atrioventricular</Label>
              <Input
                placeholder="Ex: Condução AV normal, relação 1:1 preservada"
                value={avConduction}
                onChange={(e) => setAvConduction(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-700">Condução Intraventricular</Label>
              <Input
                placeholder="Ex: Condução intraventricular normal (ou BDR, BRE, BDAS...)"
                value={ivConduction}
                onChange={(e) => setIvConduction(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-700">
                Repolarização Ventricular (ST-T / QT)
              </Label>
              <Input
                placeholder="Ex: Sem alterações primárias da repolarização ventricular"
                value={repolarization}
                onChange={(e) => setRepolarization(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-700">Ondas Q e Achados Relevantes</Label>
              <Input
                placeholder="Ex: Ausência de ondas Q patológicas de necrose"
                value={qWaves}
                onChange={(e) => setQWaves(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>
          </div>
        </div>

        {/* Bloco 3: Qualidade Técnica do Traçado */}
        <div>
          <Label className="text-[11px] text-slate-700 font-semibold">
            Avaliação da Qualidade Técnica do Traçado (Item 2 SBC 2022)
          </Label>
          <Input
            value={technicalQuality}
            onChange={(e) => setTechnicalQuality(e.target.value)}
            placeholder="Ex: Traçado legível, calibração N e 25mm/s, sem artefatos de tremor muscular"
            className="text-xs h-8 mt-1"
          />
        </div>

        {/* Bloco 4: Descrição e Conclusão em Texto Livre (Obrigatórias) */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div>
            <Label className="text-xs font-bold text-slate-900">
              Descrição Eletrocardiográfica Detalhada (Texto Livre) *
            </Label>
            <Textarea
              rows={3}
              value={freeTextDescription}
              onChange={(e) => setFreeTextDescription(e.target.value)}
              placeholder="Descreva detalhadamente os achados do traçado eletrocardiográfico..."
              className="text-xs mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-bold text-slate-900">
              Conclusão Eletrocardiográfica Diagnóstica (Texto Livre) *
            </Label>
            <Textarea
              rows={2}
              value={freeTextConclusion}
              onChange={(e) => setFreeTextConclusion(e.target.value)}
              placeholder="Ex: Eletrocardiograma dentro dos limites da normalidade."
              className="text-xs mt-1 font-semibold text-slate-900"
            />
          </div>
        </div>

        {/* Bloco 5: Ações Críticas e Devolução */}
        <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold text-amber-950">
                Segurança do Paciente & Triagem Técnica
              </span>
              <p className="text-[11px] text-amber-800">
                Sinalize suspeitas críticas ou devolva traçados com defeitos técnicos à clínica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCriticalModalOpen(true)}
              className={`h-7 text-xs border-red-300 ${
                hasCriticalFindingRegistered
                  ? 'bg-red-100 text-red-900 font-bold border-red-400'
                  : 'bg-red-50 text-red-800 hover:bg-red-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-600" />
              {hasCriticalFindingRegistered
                ? 'Achado Crítico Registrado'
                : 'Sinalizar Achado Crítico'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsReturnModalOpen(true)}
              className="h-7 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-600" />
              Devolver c/ Problema Técnico
            </Button>
          </div>
        </div>

        {/* ETAPA 4A: Barra de Documentos e Assinatura Digital */}
        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0E4C92] shrink-0" />
            <div>
              <span className="font-bold text-slate-900">
                Documento Médico (PDF) & Assinatura Digital
              </span>
              <p className="text-[11px] text-slate-500">
                Conferência do documento, preparação para assinatura PAdES ICP-Brasil e consulta de
                versões
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePreviewPdf}
              disabled={isLoadingPreview}
              className="h-7 text-xs gap-1 border-slate-300 bg-white"
              title="Conferir o documento completo antes de iniciar a assinatura"
            >
              {isLoadingPreview ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Eye className="w-3 h-3 text-[#0E4C92]" />
              )}
              <span>Visualizar PDF</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handlePrepareSignature}
              disabled={isPreparing}
              className="h-7 text-xs gap-1 border-[#0E4C92] text-[#0E4C92] bg-white hover:bg-sky-50"
              title="Gerar PDF definitivo com hash SHA-256 e bloquear esta versão"
            >
              {isPreparing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <PenTool className="w-3 h-3" />
              )}
              <span>Preparar PDF para Assinatura</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenVersions}
              className="h-7 text-xs gap-1 border-slate-300 bg-white"
              title="Consultar versões já geradas deste documento"
            >
              <Layers className="w-3 h-3 text-slate-600" />
              <span>Versões</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenSignatureStatus}
              className="h-7 text-xs gap-1 border-slate-300 bg-white"
              title="Visualizar status da assinatura digital"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Status da Assinatura</span>
            </Button>

            {/* ETAPA 6A: Botão Conector Bird ID Pro */}
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const docs = await documentService.getDocumentsForExam(exam.id)
                  if (docs && docs.length > 0) {
                    setActiveReportDoc(docs[0])
                    setIsBirdIdModalOpen(true)
                  } else {
                    alert(
                      'Prepare o PDF para assinatura primeiro antes de abrir o conector Bird ID Pro.',
                    )
                  }
                } catch (err: any) {
                  alert(`Erro ao carregar documento: ${err.message}`)
                }
              }}
              className="h-7 text-xs gap-1 bg-[#0E4C92] hover:bg-[#0c3e77] text-white shadow-sm font-semibold"
              title="Conector de Assinatura Digital Bird ID Pro (Soluti CESS)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Assinador Bird ID Pro</span>
            </Button>
          </div>
        </div>

        {prepareResult && (
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-300 text-xs text-emerald-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Documento preparado para assinatura digital</span>
            </div>
            <p>
              Código: <span className="font-mono">{prepareResult.documentCode}</span> • Versão:{' '}
              <span className="font-mono">{prepareResult.version}.0</span> • SHA-256:{' '}
              <span className="font-mono break-all">{prepareResult.sha256}</span>
            </p>
            <p className="text-[11px]">
              Esta versão está BLOQUEADA para alterações. Qualquer correção gerará uma nova versão
              sem sobrescrever a anterior. Status da assinatura: NAO_INICIADA (liberação clínica
              bloqueada).
            </p>
          </div>
        )}

        {/* Rodapé: Envio para Aguardando Assinatura */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Ao concluir, o exame passará para <strong>AGUARDANDO_ASSINATURA</strong> (não liberado
              diretamente).
            </span>
          </div>

          <Button
            size="sm"
            onClick={handleSubmitReport}
            disabled={isSubmittingReport}
            className="w-full sm:w-auto bg-[#0E4C92] hover:bg-[#0c3e77] text-white text-xs font-semibold px-4"
          >
            {isSubmittingReport ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                <span>Enviando Laudo...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1" />
                <span>Concluir Elaboração do Laudo</span>
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* MODAL 1: HISTÓRICO DE VERSÕES DO RASCUNHO */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#0E4C92]" />
              <span>Histórico de Alterações do Rascunho</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registros imutáveis de versão com autor, horário e modificações gravadas
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto space-y-2 py-2">
            {draftHistory.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Nenhuma versão intermediária salva ainda.
              </p>
            ) : (
              draftHistory.map((d) => (
                <div
                  key={d.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-900">Versão {d.version}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(d.created).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Autor: {d.expand?.author_id?.name || d.author_id}
                  </div>
                  {d.free_text_conclusion && (
                    <div className="text-[11px] text-slate-700 italic border-l-2 border-[#00A6A6] pl-2 mt-1">
                      Conclusão: "{d.free_text_conclusion}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsHistoryModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: DEVOLUÇÃO TÉCNICA DO EXAME */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>Devolução Técnica de Exame à Clínica</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Informe a justificativa técnica conforme critérios da Diretriz SBC (interferência
              elétrica grave, inversão de eletrodos, tremor muscular impeditivo, calibração
              inadequada).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Justificativa da Devolução *</Label>
              <Textarea
                rows={3}
                placeholder="Descreva o motivo técnico pelo qual o traçado não pôde ser laudado com segurança diagnóstica..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="text-xs mt-1"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Esta justificativa será registrada no evento de auditoria e enviada à clínica
                solicitante.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              disabled={isReturning}
              onClick={() => setIsReturnModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isReturning}
              onClick={handleConfirmReturn}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              {isReturning ? 'Devolvendo...' : 'Confirmar Devolução'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: ACHADO POTENCIALMENTE CRÍTICO */}
      <Dialog open={isCriticalModalOpen} onOpenChange={setIsCriticalModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-red-700 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>Registro de Achado Potencialmente Crítico</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Formalização probatória da comunicação direta entre o cardiologista e a equipe
              assistente da unidade solicitante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Classificação do Achado Crítico *</Label>
              <Select value={criticalClass} onValueChange={(val: any) => setCriticalClass(val)}>
                <SelectTrigger className="text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infarto_agudo_supra_st">
                    Infarto Agudo do Miocárdio com Supra de ST
                  </SelectItem>
                  <SelectItem value="bloqueio_av_avancado_total">
                    Bloqueio Atrioventricular Avançado / BAV Total
                  </SelectItem>
                  <SelectItem value="taquicardia_ventricular">
                    Taquicardia Ventricular / Fibrilação Ventricular
                  </SelectItem>
                  <SelectItem value="bradicardia_grave_sintomatica">
                    Bradicardia Grave Sintomática
                  </SelectItem>
                  <SelectItem value="intervalo_qt_muito_prolongado">
                    Intervalo QT Muito Prolongado (Risco de TdP)
                  </SelectItem>
                  <SelectItem value="pausa_sinusal_prolongada">
                    Pausa Sinusal Prolongada / Parada Sinusal
                  </SelectItem>
                  <SelectItem value="outro_achado_critico">
                    Outro Achado Eletrocardiográfico Grave
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">
                Justificativa Clínica e Conduta Sugerida *
              </Label>
              <Textarea
                rows={2}
                value={criticalJustification}
                onChange={(e) => setCriticalJustification(e.target.value)}
                placeholder="Ex: Supradesnivelamento de ST de 3mm em V1-V4 compatível com IAM anterior agudo. Notificado médico assistente da emergência."
                className="text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Destinatário do Contato *</Label>
                <Input
                  value={criticalRecipient}
                  onChange={(e) => setCriticalRecipient(e.target.value)}
                  placeholder="Ex: Dr. Marcelo / Plantonista Alfa"
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Canal de Comunicação *</Label>
                <Select
                  value={criticalChannel}
                  onValueChange={(val: any) => setCriticalChannel(val)}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telefone_plantao">Telefone do Plantão Médico</SelectItem>
                    <SelectItem value="telefone_medico_assistente">
                      Telefone do Médico Assistente
                    </SelectItem>
                    <SelectItem value="telefone_enfermagem">
                      Telefone da Enfermagem / Sala de Emergência
                    </SelectItem>
                    <SelectItem value="whatsapp_institucional">
                      WhatsApp Institucional Oficial
                    </SelectItem>
                    <SelectItem value="comunicador_clinico_direto">
                      Comunicador Clínico Direto
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criticalConfirmed}
                  onChange={(e) => setCriticalConfirmed(e.target.checked)}
                  className="rounded text-[#0E4C92]"
                />
                <span className="font-semibold text-slate-900">
                  Houve confirmação explícita de recebimento pelo destinatário?
                </span>
              </label>

              {criticalConfirmed && (
                <div>
                  <Label className="text-[11px] text-slate-600">
                    Detalhes da Confirmação (nome do atendente, horário exato, providências)
                  </Label>
                  <Input
                    value={criticalConfirmationNotes}
                    onChange={(e) => setCriticalConfirmationNotes(e.target.value)}
                    placeholder="Ex: Confirmado pelo Dr. Marcelo às 14:32h, paciente encaminhado para a sala de emergência."
                    className="text-xs mt-1"
                  />
                </div>
              )}
            </div>

            <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-amber-700" />
                <span>Ressalva de Responsabilidade Médica:</span>
              </div>
              <p>
                Este registro formaliza a comunicação médica mas NÃO substitui a avaliação clínica
                presencial de emergência. Notificações visuais de tela NÃO contam como confirmação
                de comunicação.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              disabled={isRegisteringCritical}
              onClick={() => setIsCriticalModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isRegisteringCritical}
              onClick={handleRegisterCriticalFinding}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-semibold"
            >
              {isRegisteringCritical ? 'Registrando...' : 'Registrar Achado Crítico'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CONFIRMAÇÃO DE SUBMISSÃO DO LAUDO (AGUARDANDO ASSINATURA) */}
      <Dialog open={submissionSuccessModal} onOpenChange={setSubmissionSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Laudo Concluído com Sucesso!</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              O laudo estruturado de ECG foi validado no servidor e avançou para a situação{' '}
              <strong>AGUARDANDO_ASSINATURA</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2 text-slate-700">
            <p>Conforme as diretrizes desta etapa de desenvolvimento:</p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
              <li>
                O laudo NÃO foi assinado digitalmente nem liberado publicamente como concluído.
              </li>
              <li>
                A assinatura digital ICP-Brasil e emissão final em PDF estão expressamente
                reservadas para etapas futuras.
              </li>
              <li>
                Todos os dados foram preservados e o evento foi registrado na trilha de auditoria.
              </li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              className="bg-[#0E4C92] text-xs text-white"
              onClick={() => {
                setSubmissionSuccessModal(false)
                if (onReportSubmitted) onReportSubmitted()
              }}
            >
              Entendido, retornar à Fila
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5 (ETAPA 4A): PRÉVIA DO PDF DO LAUDO */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0E4C92]" />
              <span>Prévia do Documento (PDF)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Conferência integral do laudo ANTES de iniciar a assinatura digital.
            </DialogDescription>
          </DialogHeader>

          <div className="p-2.5 bg-amber-50 rounded border border-amber-300 text-xs text-amber-950 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              {previewMeta?.disclaimer || 'DOCUMENTO NÃO ASSINADO. SEM VALIDADE COMO LAUDO FINAL.'}
            </span>
          </div>

          {previewPdfUrl && (
            <iframe
              src={previewPdfUrl}
              title="Prévia do Laudo em PDF"
              className="w-full h-[55vh] border border-slate-200 rounded"
            />
          )}

          {previewMeta && (
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-700 space-y-1">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Código: <span className="font-mono">{previewMeta.documentCode}</span>
                </span>
                <span>
                  Versão: <span className="font-mono">{previewMeta.version}.0</span>
                </span>
                <span>
                  Tamanho: <span className="font-mono">{previewMeta.fileSizeBytes} bytes</span>
                </span>
              </div>
              <div>
                SHA-256 (prévia): <span className="font-mono break-all">{previewMeta.sha256}</span>
              </div>
              <p className="text-slate-500">
                A prévia NÃO contém carimbo, imagem de assinatura ou qualquer representação de
                assinatura digital válida.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsPreviewModalOpen(false)}>
              Fechar Prévia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 6 (ETAPA 4A): VERSÕES DO DOCUMENTO */}
      <Dialog open={isVersionsModalOpen} onOpenChange={setIsVersionsModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#0E4C92]" />
              <span>Versões do Documento</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Registros imutáveis das versões de PDF preparadas para assinatura
            </DialogDescription>
          </DialogHeader>

          {isLoadingDocs ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#0E4C92]" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Nenhuma versão de documento foi preparada ainda.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 py-2">
              {documents.map((d) => (
                <div
                  key={d.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-900 font-mono">{d.document_code}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-sky-50 text-sky-800 border-sky-300"
                    >
                      v{d.version}.0
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Gerado em: {new Date(d.generated_at).toLocaleString('pt-BR')}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    SHA-256: <span className="font-mono break-all">{d.file_hash_sha256}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Lock className="w-3 h-3" />
                    <span>
                      {d.is_locked ? 'Versão bloqueada para alterações' : 'Versão aberta'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsVersionsModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 7 (ETAPA 4A): STATUS DA ASSINATURA DIGITAL */}
      <Dialog open={isSignatureModalOpen} onOpenChange={setIsSignatureModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Status da Assinatura Digital</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Transações de assinatura PAdES ICP-Brasil registradas para este exame
            </DialogDescription>
          </DialogHeader>

          {isLoadingSigs ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#0E4C92]" />
            </div>
          ) : signatures.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Nenhuma transação de assinatura registrada. Prepare o PDF primeiro.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 py-2">
              {signatures.map((s) => {
                const statusColors: Record<string, string> = {
                  NAO_INICIADA: 'bg-slate-100 text-slate-700 border-slate-300',
                  PENDENTE: 'bg-amber-50 text-amber-800 border-amber-300',
                  PROCESSANDO: 'bg-sky-50 text-sky-800 border-sky-300',
                  ASSINADA: 'bg-indigo-50 text-indigo-800 border-indigo-300',
                  VALIDADA: 'bg-emerald-50 text-emerald-800 border-emerald-300',
                  FALHA: 'bg-red-50 text-red-800 border-red-300',
                }
                return (
                  <div
                    key={s.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-900">
                        {s.expand?.report_document_id?.document_code || 'Documento'}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${statusColors[s.signature_status] || ''}`}
                      >
                        {s.signature_status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Provedor: {s.signing_provider || '—'} • Transação:{' '}
                      <span className="font-mono">{s.transaction_id || '—'}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Solicitado:{' '}
                      {s.requested_at ? new Date(s.requested_at).toLocaleString('pt-BR') : '—'}
                      {s.completed_at
                        ? ` • Concluído: ${new Date(s.completed_at).toLocaleString('pt-BR')}`
                        : ''}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      <span>
                        Liberação à clínica:{' '}
                        {s.is_clinically_released
                          ? 'AUTORIZADA (após validação criptográfica)'
                          : 'BLOQUEADA — aguardando assinatura e validação'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600">
            Estados previstos: NAO_INICIADA → PENDENTE → PROCESSANDO → ASSINADA → VALIDADA (ou
            FALHA). Nenhum documento é liberado à clínica antes da validação criptográfica da
            assinatura.
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsSignatureModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 8 (ETAPA 6A): CONECTOR BIRD ID PRO */}
      <BirdIdSigningModal
        isOpen={isBirdIdModalOpen}
        onClose={() => setIsBirdIdModalOpen(false)}
        document={activeReportDoc}
        examId={exam.id}
        doctorCrm={exam.expand?.assigned_doctor_id?.crm}
        doctorName={exam.expand?.assigned_doctor_id?.expand?.user_id?.name}
        onSignatureUpdated={async () => {
          try {
            const sigs = await documentService.getSignaturesForExam(exam.id)
            setSignatures(sigs)
          } catch {
            /* intentionally ignored */
          }
        }}
      />
    </div>
  )
}
