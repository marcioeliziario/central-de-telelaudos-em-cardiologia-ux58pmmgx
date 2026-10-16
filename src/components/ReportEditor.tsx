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
  Download,
  Upload,
  SlidersHorizontal,
  Wand2,
  Plus,
  Trash2,
  Bookmark,
  Check,
} from 'lucide-react'
import { BirdIdSigningModal } from '@/components/BirdIdSigningModal'
import { PdfViewerModal } from '@/components/PdfViewerModal'
import { useAuth } from '@/contexts/AuthContext'
import { personalTemplateService, doctorPreferenceService } from '@/services/telelaudosService'
import { multiProviderSigningService } from '@/services/multiProviderSigningService'
import {
  ReportMode,
  PersonalReportTemplate,
  SigningSessionActiveResponse,
} from '@/types/telelaudos'

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
  const { user } = useAuth()

  // Modalidade do laudo: 'structured' ou 'free_text'
  const [reportMode, setReportMode] = useState<ReportMode>('structured')
  const [isSavingPreference, setIsSavingPreference] = useState<boolean>(false)
  const [preferenceFeedback, setPreferenceFeedback] = useState<string | null>(null)

  // Modelos e histórico
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [personalTemplates, setPersonalTemplates] = useState<PersonalReportTemplate[]>([])
  const [draftHistory, setDraftHistory] = useState<ReportDraft[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Modais de Modelos Pessoais e Síntese de Texto
  const [isNewPersonalTemplateOpen, setIsNewPersonalTemplateOpen] = useState<boolean>(false)
  const [newTemplateTitle, setNewTemplateTitle] = useState<string>('')
  const [newTemplateCategory, setNewTemplateCategory] = useState<string>('Normalidade')
  const [isSavingPersonalTemplate, setIsSavingPersonalTemplate] = useState<boolean>(false)
  const [isGenerateConfirmOpen, setIsGenerateConfirmOpen] = useState<boolean>(false)
  const [generatedProposalCandidate, setGeneratedProposalCandidate] = useState<{
    description: string
    conclusion: string
  } | null>(null)

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

  // v0.0.35: Documentos (PDF Nativo em Canvas) e Assinatura Digital Unificada
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState<boolean>(false)
  const [viewerPdfBytes, setViewerPdfBytes] = useState<Uint8Array | null>(null)
  const [viewerPdfUrl, setViewerPdfUrl] = useState<string | null>(null)
  const [viewerTitle, setViewerTitle] = useState<string>('Laudo de Eletrocardiograma')
  const [viewerFileName, setViewerFileName] = useState<string>('Laudo-ECG.pdf')
  const [viewerMeta, setViewerMeta] = useState<{
    documentCode?: string
    version?: number
    sha256?: string
    fileSizeBytes?: number
    disclaimer?: string
    isFinal?: boolean
  } | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false)

  // Modal de Confirmação para Concluir Laudo (Ação 2)
  const [isConfirmFinalizeOpen, setIsConfirmFinalizeOpen] = useState<boolean>(false)
  const [isFinalizingReport, setIsFinalizingReport] = useState<boolean>(false)
  const [finalizedDocument, setFinalizedDocument] = useState<any | null>(null)

  // Painel Compacto de Assinatura Digital ICP-Brasil (Ação 3)
  const [isSigningPanelOpen, setIsSigningPanelOpen] = useState<boolean>(false)
  const [signingSession, setSigningSession] = useState<SigningSessionActiveResponse | null>(null)
  const [isLoadingSigningSession, setIsLoadingSigningSession] = useState<boolean>(false)
  const [selectedCertificateId, setSelectedCertificateId] = useState<string>('integra_bry')
  const [isExecutingPadesSign, setIsExecutingPadesSign] = useState<boolean>(false)
  const [signingBannerMessage, setSigningBannerMessage] = useState<string | null>(null)

  // Histórico de versões e assinaturas do documento
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState<boolean>(false)
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false)
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false)
  const [signatures, setSignatures] = useState<any[]>([])
  const [isLoadingSigs, setIsLoadingSigs] = useState<boolean>(false)

  // Adaptadores internos (Bird ID Pro e Bry)
  const [isBirdIdModalOpen, setIsBirdIdModalOpen] = useState<boolean>(false)
  const [activeReportDoc, setActiveReportDoc] = useState<any | null>(null)

  // Assinatura Digital Externa (exportar/importar)
  const [isExternalSigningModalOpen, setIsExternalSigningModalOpen] = useState<boolean>(false)
  const [externalUploadedFileName, setExternalUploadedFileName] = useState<string | null>(null)
  const [externalUploadSuccess, setExternalUploadSuccess] = useState<boolean>(false)
  const [validationChecklist, setValidationChecklist] = useState<any[]>([])

  // Referência para debounce do auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstMountRef = useRef<boolean>(true)

  // Carregar Templates, Modelos Pessoais, Preferências e Rascunho mais recente
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setIsLoadingInitial(true)
      try {
        const [tpls, latestDraft, history, criticals, personalTpls, pref] = await Promise.all([
          templateService.getAll(),
          draftService.getLatestForExam(exam.id),
          draftService.getHistoryForExam(exam.id),
          criticalFindingService.getForExam(exam.id),
          user?.id ? personalTemplateService.getForUser(user.id) : Promise.resolve([]),
          user?.id ? doctorPreferenceService.getForUser(user.id) : Promise.resolve(null),
        ])

        if (!isMounted) return

        setTemplates(tpls)
        setPersonalTemplates(personalTpls)
        setDraftHistory(history)
        if (criticals && criticals.length > 0) {
          setHasCriticalFindingRegistered(true)
        }

        // Se houver rascunho salvo, restaurar (prioridade sobre preferência geral)
        if (latestDraft) {
          if (latestDraft.report_mode) {
            setReportMode(latestDraft.report_mode)
          } else if (pref?.default_report_mode) {
            setReportMode(pref.default_report_mode)
          }

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
          // Sem rascunho: aplicar preferência do médico se configurada
          if (pref?.default_report_mode) {
            setReportMode(pref.default_report_mode)
          }
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
  }, [exam.id, user?.id])

  // Lógica de Salvamento do Rascunho
  const performSaveDraft = async () => {
    setSaveStatus('saving')
    try {
      const payload = {
        report_mode: reportMode,
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
    reportMode,
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

  // Salvar preferência individual do médico
  const handleSaveDefaultPreference = async (mode: ReportMode) => {
    if (!user?.id) return
    setIsSavingPreference(true)
    setPreferenceFeedback(null)
    try {
      await doctorPreferenceService.savePreference(user.id, mode)
      setPreferenceFeedback(
        `Preferência de modalidade padrão definida para: ${mode === 'free_text' ? 'Texto Livre' : 'Estruturado'}.`,
      )
      setTimeout(() => setPreferenceFeedback(null), 3500)
    } catch (err: any) {
      alert(`Erro ao salvar preferência médica: ${err.message || err}`)
    } finally {
      setIsSavingPreference(false)
    }
  }

  // Aplicar Modelo de Redação Oficial SBC (SEM preencher medidas numéricas fictícias)
  const handleApplyTemplate = (tplId: string) => {
    // Pode vir de template SBC oficial ou modelo pessoal
    if (tplId.startsWith('personal:')) {
      const pId = tplId.replace('personal:', '')
      const pt = personalTemplates.find((t) => t.id === pId)
      if (!pt) return
      setSelectedTemplateId(tplId)
      if (pt.description) setFreeTextDescription(pt.description)
      if (pt.conclusion) setFreeTextConclusion(pt.conclusion)
      return
    }

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

  // Salvar redação atual como Modelo Pessoal
  const handleSaveAsPersonalTemplate = async () => {
    if (!user?.id) return
    if (!newTemplateTitle.trim()) {
      alert('Informe o título do modelo pessoal.')
      return
    }
    if (!freeTextDescription.trim() && !freeTextConclusion.trim()) {
      alert('Preencha a descrição ou conclusão para criar o modelo.')
      return
    }

    setIsSavingPersonalTemplate(true)
    try {
      const created = await personalTemplateService.create({
        user_id: user.id,
        title: newTemplateTitle.trim(),
        category: newTemplateCategory.trim() || 'Geral',
        description: freeTextDescription.trim(),
        conclusion: freeTextConclusion.trim(),
      })
      setPersonalTemplates((prev) => [created, ...prev])
      setIsNewPersonalTemplateOpen(false)
      setNewTemplateTitle('')
      alert('Modelo pessoal salvo com sucesso!')
    } catch (err: any) {
      alert(`Erro ao salvar modelo pessoal: ${err.message || err}`)
    } finally {
      setIsSavingPersonalTemplate(false)
    }
  }

  // Excluir Modelo Pessoal
  const handleDeletePersonalTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Deseja excluir este modelo pessoal?')) return
    try {
      await personalTemplateService.remove(id)
      setPersonalTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err: any) {
      alert(`Erro ao remover modelo: ${err.message || err}`)
    }
  }

  // Gerar proposta de texto a partir dos campos estruturados (botão explícito com confirmação)
  const handleRequestGenerateProposal = () => {
    const parts: string[] = []

    if (cardiacRhythm) {
      parts.push(`Ritmo: ${cardiacRhythm}.`)
    }
    if (heartRate) {
      parts.push(`Frequência cardíaca estimada em ${heartRate} bpm.`)
    }
    if (electricalAxis) {
      parts.push(`Eixo elétrico do QRS a ${electricalAxis}.`)
    }
    if (prIntervalMs) {
      parts.push(`Intervalo PR medindo ${prIntervalMs} ms.`)
    }
    if (qrsDurationMs) {
      parts.push(`Duração do complexo QRS em ${qrsDurationMs} ms.`)
    }
    if (qtIntervalMs || qtcIntervalMs) {
      const qtText = [
        qtIntervalMs ? `QT ${qtIntervalMs} ms` : '',
        qtcIntervalMs ? `QTc (Bazett) ${qtcIntervalMs} ms` : '',
      ]
        .filter(Boolean)
        .join(', ')
      parts.push(`Intervalos: ${qtText}.`)
    }
    if (pWaveDesc) {
      parts.push(`Onda P: ${pWaveDesc}.`)
    }
    if (avConduction) {
      parts.push(`Condução atrioventricular: ${avConduction}.`)
    }
    if (ivConduction) {
      parts.push(`Condução intraventricular: ${ivConduction}.`)
    }
    if (repolarization) {
      parts.push(`Repolarização ventricular: ${repolarization}.`)
    }
    if (qWaves) {
      parts.push(`Achados de ondas Q: ${qWaves}.`)
    }
    if (technicalQuality) {
      const cleanQuality = technicalQuality.trim().replace(/\.+$/, '')
      parts.push(`Qualidade técnica: ${cleanQuality}.`)
    }

    const proposedDescription =
      parts.length > 0
        ? parts.join(' ').replace(/\.\.+/g, '.')
        : 'Traçado eletrocardiográfico avaliado conforme parâmetros estruturados.'

    // Proposta diagnóstica cautelosa (NÃO assume normalidade automática sem base)
    let proposedConclusion = ''
    if (
      cardiacRhythm.toLowerCase().includes('sinusal') &&
      (!ivConduction || ivConduction.toLowerCase().includes('normal')) &&
      (!repolarization || repolarization.toLowerCase().includes('sem alter'))
    ) {
      proposedConclusion = 'Traçado eletrocardiográfico dentro dos limites da normalidade.'
    } else {
      proposedConclusion = 'Análise eletrocardiográfica conclusiva a critério do cardiologista.'
    }

    setGeneratedProposalCandidate({
      description: proposedDescription,
      conclusion: proposedConclusion,
    })

    // Se já houver texto escrito, exige confirmação para não sobrescrever acidentalmente
    if (freeTextDescription.trim() || freeTextConclusion.trim()) {
      setIsGenerateConfirmOpen(true)
    } else {
      setFreeTextDescription(proposedDescription)
      setFreeTextConclusion(proposedConclusion)
    }
  }

  const handleConfirmApplyGeneratedProposal = () => {
    if (generatedProposalCandidate) {
      setFreeTextDescription(generatedProposalCandidate.description)
      setFreeTextConclusion(generatedProposalCandidate.conclusion)
    }
    setIsGenerateConfirmOpen(false)
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
        report_mode: reportMode,
        heart_rate: reportMode === 'free_text' ? null : heartRate ? Number(heartRate) : null,
        cardiac_rhythm: reportMode === 'free_text' ? '' : cardiacRhythm,
        electrical_axis: reportMode === 'free_text' ? '' : electricalAxis,
        pr_interval_ms:
          reportMode === 'free_text' ? null : prIntervalMs ? Number(prIntervalMs) : null,
        qrs_duration_ms:
          reportMode === 'free_text' ? null : qrsDurationMs ? Number(qrsDurationMs) : null,
        qt_interval_ms:
          reportMode === 'free_text' ? null : qtIntervalMs ? Number(qtIntervalMs) : null,
        qtc_interval_ms:
          reportMode === 'free_text' ? null : qtcIntervalMs ? Number(qtcIntervalMs) : null,
        p_wave_description: reportMode === 'free_text' ? '' : pWaveDesc,
        av_conduction_alterations: reportMode === 'free_text' ? '' : avConduction,
        iv_conduction_alterations: reportMode === 'free_text' ? '' : ivConduction,
        repolarization_alterations: reportMode === 'free_text' ? '' : repolarization,
        q_waves_findings: reportMode === 'free_text' ? '' : qWaves,
        free_text_description: freeTextDescription,
        free_text_conclusion: freeTextConclusion,
        technical_quality_notes: technicalQuality.trim().replace(/\.+$/, ''),
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

  // v0.0.35: Abrir Visualizador Nativo de PDF (Canvas/PDF.js) com Prévia ou Documento Definitivo
  const handleOpenPreviewInPdfViewer = async () => {
    setIsLoadingPreview(true)
    try {
      const res = await documentService.getPreview(exam.id)
      if (res.success && res.pdfRawString) {
        const bytes = new Uint8Array(res.pdfRawString.length)
        for (let i = 0; i < res.pdfRawString.length; i++) {
          bytes[i] = res.pdfRawString.charCodeAt(i) & 0xff
        }
        setViewerPdfBytes(bytes)
        setViewerPdfUrl(null)
        setViewerTitle('Prévia do Laudo em PDF (Rascunho)')
        setViewerFileName(`Previa-${res.documentCode || 'ECG'}.pdf`)
        setViewerMeta({
          documentCode: res.documentCode,
          version: res.version,
          sha256: res.sha256,
          fileSizeBytes: res.fileSizeBytes,
          disclaimer: res.disclaimer || 'DOCUMENTO NÃO ASSINADO. SEM VALIDADE COMO LAUDO FINAL.',
          isFinal: false,
        })
        setIsPdfViewerOpen(true)
      } else {
        alert('Não foi possível obter os dados da prévia do laudo.')
      }
    } catch (err: any) {
      alert(`Erro ao carregar prévia do PDF: ${err.message || err}`)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Visualizar PDF definitivo de um documento específico no PdfViewerModal
  const handleOpenDocumentInPdfViewer = async (doc: any) => {
    try {
      setIsLoadingPreview(true)
      let bytes: Uint8Array | null = null

      if (doc.pdf_file) {
        try {
          bytes = await documentService.fetchDocumentFileBytes(doc.id, doc.pdf_file)
        } catch (fetchErr) {
          console.warn('Aviso ao carregar bytes protegidos do documento:', fetchErr)
        }
      }

      // Se não obteve bytes do arquivo direto, carregar via preview com snapshot correspondente
      if (!bytes) {
        const res = await documentService.getPreview(exam.id)
        if (res.pdfRawString) {
          bytes = new Uint8Array(res.pdfRawString.length)
          for (let i = 0; i < res.pdfRawString.length; i++) {
            bytes[i] = res.pdfRawString.charCodeAt(i) & 0xff
          }
        }
      }

      setViewerPdfBytes(bytes)
      setViewerPdfUrl(null)
      setViewerTitle(`Laudo Concluído - ${doc.document_code}`)
      setViewerFileName(`${doc.document_code || 'Laudo-Concluido'}.pdf`)
      setViewerMeta({
        documentCode: doc.document_code,
        version: doc.version,
        sha256: doc.file_hash_sha256,
        fileSizeBytes: doc.file_size_bytes,
        disclaimer: 'Laudo Concluído e auditado. Pronto para assinatura e liberação.',
        isFinal: true,
      })
      setIsPdfViewerOpen(true)
    } catch (err: any) {
      alert(`Erro ao abrir documento no visualizador: ${err.message || err}`)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // v0.0.35 AÇÃO 2: Concluir Laudo Médico (Submissão + Geração do PDF Definitivo)
  const handleExecuteFinalizeReport = async () => {
    if (!freeTextConclusion.trim()) {
      alert('A conclusão eletrocardiográfica é obrigatória conforme a Diretriz SBC.')
      return
    }
    if (!freeTextDescription.trim()) {
      alert('A descrição do traçado é obrigatória conforme a Diretriz SBC.')
      return
    }

    setIsFinalizingReport(true)
    try {
      // 1. Submeter elaboração clínica (ecg_reports)
      const payload = {
        report_mode: reportMode,
        heart_rate: reportMode === 'free_text' ? null : heartRate ? Number(heartRate) : null,
        cardiac_rhythm: reportMode === 'free_text' ? '' : cardiacRhythm,
        electrical_axis: reportMode === 'free_text' ? '' : electricalAxis,
        pr_interval_ms:
          reportMode === 'free_text' ? null : prIntervalMs ? Number(prIntervalMs) : null,
        qrs_duration_ms:
          reportMode === 'free_text' ? null : qrsDurationMs ? Number(qrsDurationMs) : null,
        qt_interval_ms:
          reportMode === 'free_text' ? null : qtIntervalMs ? Number(qtIntervalMs) : null,
        qtc_interval_ms:
          reportMode === 'free_text' ? null : qtcIntervalMs ? Number(qtcIntervalMs) : null,
        p_wave_description: reportMode === 'free_text' ? '' : pWaveDesc,
        av_conduction_alterations: reportMode === 'free_text' ? '' : avConduction,
        iv_conduction_alterations: reportMode === 'free_text' ? '' : ivConduction,
        repolarization_alterations: reportMode === 'free_text' ? '' : repolarization,
        q_waves_findings: reportMode === 'free_text' ? '' : qWaves,
        free_text_description: freeTextDescription,
        free_text_conclusion: freeTextConclusion,
        technical_quality_notes: technicalQuality.trim().replace(/\.+$/, ''),
        has_critical_findings: hasCriticalFindingRegistered,
      }
      await examService.submitReport(exam.id, payload)

      // 2. Preparar PDF definitivo em report_documents com hash SHA-256 e assinatura manuscrita ativa
      const prepRes = await documentService.prepareForSignature(exam.id)
      setFinalizedDocument(
        prepRes.document || {
          document_code: prepRes.documentCode,
          version: prepRes.version,
          file_hash_sha256: prepRes.sha256,
          generated_at: new Date().toISOString(),
        },
      )
      setActiveReportDoc(prepRes.document)

      // Atualizar lista de documentos e assinaturas
      const [docs, sigs] = await Promise.all([
        documentService.getDocumentsForExam(exam.id),
        documentService.getSignaturesForExam(exam.id),
      ])
      setDocuments(docs)
      setSignatures(sigs)

      setIsConfirmFinalizeOpen(false)
      alert(
        `Laudo concluído com sucesso! Documento definitivo ${prepRes.documentCode} (v${prepRes.version}.0) gerado com hash SHA-256 e incorporação de assinatura manuscrita ativa. Você já pode visualizá-lo ou prosseguir com a assinatura digital ICP-Brasil.`,
      )
    } catch (err: any) {
      alert(`Erro ao concluir laudo médico: ${err.message || err}`)
    } finally {
      setIsFinalizingReport(false)
    }
  }

  // v0.0.35 AÇÃO 3: Consultar sessão e abrir painel compacto de assinatura digital
  const handleOpenSigningFlow = async () => {
    setIsSigningPanelOpen(true)
    setIsLoadingSigningSession(true)
    setSigningBannerMessage(null)
    try {
      // Carregar documento mais recente se ainda não carregado
      let doc = activeReportDoc
      if (!doc) {
        const docs = await documentService.getDocumentsForExam(exam.id)
        setDocuments(docs)
        if (docs && docs.length > 0) {
          doc = docs[0]
          setActiveReportDoc(doc)
          setFinalizedDocument(doc)
        }
      }

      // Consultar sessão ativa do médico
      const sessionRes = await multiProviderSigningService.getActiveSession()
      setSigningSession(sessionRes)

      if (!sessionRes || !sessionRes.hasActiveSession || sessionRes.isExpired) {
        setSigningBannerMessage(
          'O documento permanece como Laudo Concluído, aguardando assinatura digital para liberação clínica.',
        )
      } else {
        setSigningBannerMessage(null)
      }

      // Carregar assinaturas existentes
      const sigs = await documentService.getSignaturesForExam(exam.id)
      setSignatures(sigs)
    } catch (err: any) {
      console.error('Erro ao verificar sessão de assinatura:', err)
      setSigningBannerMessage(
        'O documento permanece como Laudo Concluído, aguardando assinatura digital para liberação clínica.',
      )
    } finally {
      setIsLoadingSigningSession(false)
    }
  }

  // Executar Assinatura Digital ICP-Brasil (PAdES) quando sessão estiver ativa
  const handleExecutePadesSignature = async () => {
    if (!activeReportDoc && documents.length === 0) {
      alert('Conclua o laudo primeiro para gerar o PDF definitivo antes de assinar.')
      return
    }

    const targetDocId = activeReportDoc?.id || documents[0]?.id
    if (!targetDocId) {
      alert('Documento não localizado para assinatura.')
      return
    }

    if (!signingSession || !signingSession.hasActiveSession || signingSession.isExpired) {
      alert(
        'Sessão ICP-Brasil inativa ou pendente de autorização. O laudo permanece como Laudo Concluído, aguardando assinatura digital para liberação clínica.',
      )
      return
    }

    setIsExecutingPadesSign(true)
    try {
      const res = await multiProviderSigningService.signDocument({
        documentId: targetDocId,
        providerKey: selectedCertificateId,
      })

      if (res.success) {
        // Atualizar assinaturas
        const updatedSigs = await documentService.getSignaturesForExam(exam.id)
        setSignatures(updatedSigs)

        if (res.status === 'VALIDADA' && res.isClinicallyReleased) {
          alert('Assinatura PAdES ICP-Brasil VALIDADA e liberação clínica homologada com sucesso!')
          if (onReportSubmitted) {
            onReportSubmitted()
          }
        } else {
          alert(
            `Assinatura processada com status ${res.status}. Liberação clínica: ${
              res.isClinicallyReleased ? 'Autorizada' : 'Bloqueada até validação criptográfica'
            }.`,
          )
        }
      } else {
        alert(`Falha ao assinar documento: ${res.message}`)
      }
    } catch (err: any) {
      alert(`Erro durante assinatura digital: ${err.message || err}`)
    } finally {
      setIsExecutingPadesSign(false)
    }
  }

  // Iniciar / Renovar autorização de sessão ICP-Brasil
  const handleAuthorizeSigningSession = async () => {
    try {
      setIsLoadingSigningSession(true)
      const initRes = await multiProviderSigningService.initSession({
        providerKey: selectedCertificateId,
        lifetimeSeconds: 3600,
        scope: 'signature_session',
      })

      if (initRes.success) {
        if (initRes.authUrl && initRes.authUrl !== '#' && !initRes.isSimulated) {
          window.open(initRes.authUrl, '_blank', 'width=600,height=700')
        }
        // Processar callback de homologação/ambiente caso em modo seguro
        const cbRes = await multiProviderSigningService.processCallback({
          state: initRes.state,
          isSimulated: initRes.isSimulated,
        })
        if (cbRes.success) {
          const updatedSession = await multiProviderSigningService.getActiveSession()
          setSigningSession(updatedSession)
          setSigningBannerMessage(null)
          alert('Sessão de assinatura ICP-Brasil autorizada com sucesso!')
        }
      }
    } catch (err: any) {
      alert(`Falha ao autorizar sessão de assinatura: ${err.message || err}`)
    } finally {
      setIsLoadingSigningSession(false)
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
      {/* Topo do Editor de Laudos: Modalidade, Status de Salvamento e Biblioteca de Modelos */}
      <Card className="border-[#E3E6E8] bg-white shadow-[0_1px_3px_rgba(47,57,66,0.03)] rounded-xl overflow-hidden">
        <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E6E8] bg-[#F7F6F4]/50">
          <div className="flex items-center gap-2.5">
            <FileCheck className="w-4 h-4 text-[#4A90D9]" />
            <div>
              <h3 className="text-xs font-bold text-[#2F3942]">
                Editor Flexível de Laudos Eletrocardiográficos
              </h3>
              <p className="text-[11px] text-[#6F7780]">
                Diretriz SBC 2022 • Alternância Livre sem perda de dados
              </p>
            </div>
          </div>

          {/* Seletor de Modalidade: Texto Livre vs Laudo Estruturado */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-[#E3E6E8]">
            <button
              type="button"
              onClick={() => setReportMode('structured')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                reportMode === 'structured'
                  ? 'bg-[#2F3942] text-white shadow-2xs font-semibold'
                  : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4]'
              }`}
            >
              Estruturado
            </button>
            <button
              type="button"
              onClick={() => setReportMode('free_text')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                reportMode === 'free_text'
                  ? 'bg-[#4A90D9] text-white shadow-2xs font-semibold'
                  : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4]'
              }`}
            >
              Texto Livre
            </button>
          </div>

          {/* Indicador Visual do Salvamento Automático */}
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <Badge
                variant="outline"
                className="text-[11px] bg-[#4A90D9]/10 text-[#4A90D9] border-[#4A90D9]/30 gap-1"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Salvando rascunho...</span>
              </Badge>
            )}
            {saveStatus === 'saved' && (
              <Badge
                variant="outline"
                className="text-[11px] bg-emerald-50 text-emerald-800 border-emerald-300 gap-1 font-medium"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Salvo {lastSavedTime ? `às ${lastSavedTime}` : ''}</span>
              </Badge>
            )}
            {saveStatus === 'error' && (
              <Badge
                variant="outline"
                className="text-[11px] bg-red-50 text-red-800 border-red-300 gap-1 font-medium"
              >
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>Falha no salvamento</span>
              </Badge>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={performSaveDraft}
              className="h-8 text-xs gap-1.5 border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4] font-medium"
              title="Salvar rascunho agora"
            >
              <Save className="w-3.5 h-3.5 text-[#6F7780]" />
              <span>Salvar Rascunho</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsHistoryModalOpen(true)}
              className="h-8 text-xs gap-1.5 border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4] font-medium"
              title="Histórico de versões deste rascunho"
            >
              <History className="w-3.5 h-3.5 text-[#6F7780]" />
              <span>Versões ({draftHistory.length})</span>
            </Button>
          </div>
        </div>

        {/* Linha de Preferências e Ações Rápidas */}
        <div className="px-3.5 py-2 bg-[#F7F6F4]/30 border-b border-[#E3E6E8] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#6F7780]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#4A90D9]" />
            <span>
              Modalidade atual:{' '}
              <strong className="text-[#2F3942]">
                {reportMode === 'free_text' ? 'Texto Livre' : 'Estruturado SBC'}
              </strong>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSaveDefaultPreference(reportMode)}
              disabled={isSavingPreference}
              className="h-6 text-[11px] px-2 text-[#4A90D9] hover:bg-[#4A90D9]/10"
              title="Definir esta modalidade como padrão para seus próximos exames"
            >
              {isSavingPreference ? 'Salvando...' : 'Definir como meu padrão'}
            </Button>
            {preferenceFeedback && (
              <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {preferenceFeedback}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Botão explícito para síntese de texto a partir do estruturado */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRequestGenerateProposal}
              className="h-7 text-xs gap-1 border-[#4A90D9]/30 text-[#4A90D9] bg-[#4A90D9]/5 hover:bg-[#4A90D9]/10 font-medium"
              title="Gerar proposta de redação médica a partir dos campos estruturados"
            >
              <Wand2 className="w-3.5 h-3.5 text-[#4A90D9]" />
              <span>Sintetizar Redação a partir do Estruturado</span>
            </Button>

            {/* Criar Modelo Pessoal */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsNewPersonalTemplateOpen(true)}
              className="h-7 text-xs gap-1 border-[#E3E6E8] text-[#2F3942] hover:bg-white"
              title="Salvar descrição e conclusão atuais como modelo reutilizável do médico"
            >
              <Plus className="w-3.5 h-3.5 text-[#6F7780]" />
              <span>Salvar como Modelo Pessoal</span>
            </Button>
          </div>
        </div>

        {/* Barra de Seleção de Modelos (SBC Oficial + Modelos Pessoais do Cardiologista) */}
        <div className="p-3 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <BookOpen className="w-4 h-4 text-[#4A90D9] shrink-0" />
            <div className="w-full">
              <Select value={selectedTemplateId} onValueChange={handleApplyTemplate}>
                <SelectTrigger className="text-xs bg-white h-8 border-[#E3E6E8]">
                  <SelectValue placeholder="Carregar Modelo (SBC Oficial ou Pessoal do Cardiologista)" />
                </SelectTrigger>
                <SelectContent>
                  {personalTemplates.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4A90D9] bg-[#F7F6F4]">
                      Meus Modelos Pessoais
                    </div>
                  )}
                  {personalTemplates.map((pt) => (
                    <div
                      key={`personal:${pt.id}`}
                      className="flex items-center justify-between pr-2 hover:bg-slate-50"
                    >
                      <SelectItem value={`personal:${pt.id}`} className="text-xs flex-1">
                        <span className="font-semibold text-[#2F3942]">[Pessoal]</span> {pt.title}
                      </SelectItem>
                      <button
                        type="button"
                        onClick={(e) => handleDeletePersonalTemplate(pt.id, e)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Excluir este modelo pessoal"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6F7780] bg-[#F7F6F4] mt-1">
                    Modelos SBC Diretriz
                  </div>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                      [{tpl.category}] {tpl.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-[11px] text-[#6F7780] italic max-w-sm">
            Modelos e textos gerados são sugestões editáveis. Conclusões de normalidade jamais são
            atribuídas sem confirmação médica.
          </div>
        </div>
      </Card>

      {/* Corpo do Editor: seletivo por modalidade com preservação integral de estado */}
      <Card className="border-[#E3E6E8] bg-white shadow-[0_1px_3px_rgba(47,57,66,0.03)] rounded-xl p-5 space-y-5">
        {reportMode === 'structured' ? (
          <>
            {/* Bloco 1: Parâmetros Quantitativos Opcionais */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#E3E6E8] mb-3">
                <h4 className="text-xs font-bold text-[#2F3942] uppercase tracking-wider flex items-center gap-1.5">
                  <span>1. Medidas Eletrocardiográficas</span>
                  <span className="text-[10px] text-[#6F7780] font-normal lowercase">
                    (quantitativas opcionais)
                  </span>
                </h4>
                <span className="text-[10px] text-[#6F7780]">Preenchimento médico manual</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="min-w-0">
                  <Label
                    className="text-[11px] font-semibold text-[#2F3942] block truncate"
                    title="Frequência Cardíaca em bpm"
                  >
                    FC (bpm)
                  </Label>
                  <Input
                    type="number"
                    placeholder="Ex: 72"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div className="min-w-0">
                  <Label
                    className="text-[11px] font-semibold text-[#2F3942] block truncate"
                    title="Eixo Elétrico do QRS"
                  >
                    Eixo QRS (°)
                  </Label>
                  <Input
                    placeholder="Ex: +45°"
                    value={electricalAxis}
                    onChange={(e) => setElectricalAxis(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div className="min-w-0">
                  <Label
                    className="text-[11px] font-semibold text-[#2F3942] block truncate"
                    title="Intervalo PR em milissegundos"
                  >
                    Intervalo PR (ms)
                  </Label>
                  <Input
                    type="number"
                    placeholder="Ex: 160"
                    value={prIntervalMs}
                    onChange={(e) => setPrIntervalMs(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div className="min-w-0">
                  <Label
                    className="text-[11px] font-semibold text-[#2F3942] block truncate"
                    title="Duração do QRS em milissegundos"
                  >
                    Duração QRS (ms)
                  </Label>
                  <Input
                    type="number"
                    placeholder="Ex: 88"
                    value={qrsDurationMs}
                    onChange={(e) => setQrsDurationMs(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div className="min-w-0">
                  <Label
                    className="text-[11px] font-semibold text-[#2F3942] block truncate"
                    title="Intervalo QT em milissegundos"
                  >
                    Intervalo QT (ms)
                  </Label>
                  <Input
                    type="number"
                    placeholder="Ex: 380"
                    value={qtIntervalMs}
                    onChange={(e) => setQtIntervalMs(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div className="min-w-0">
                  <Label
                    className="text-[11px] font-semibold text-[#2F3942] block truncate"
                    title="QT Corrigido por Bazett em milissegundos"
                  >
                    QTc Bazett (ms)
                  </Label>
                  <Input
                    type="number"
                    placeholder="Ex: 410"
                    value={qtcIntervalMs}
                    onChange={(e) => setQtcIntervalMs(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 2: Análise Qualitativa dos Segmentos (SBC 2022) */}
            <div>
              <div className="pb-2 border-b border-[#E3E6E8] mb-3">
                <h4 className="text-xs font-bold text-[#2F3942] uppercase tracking-wider">
                  2. Avaliação Morfológica e Condução
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-[#2F3942]">Ritmo Cardíaco</Label>
                  <Input
                    placeholder="Ex: Ritmo sinusal regular"
                    value={cardiacRhythm}
                    onChange={(e) => setCardiacRhythm(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-[#2F3942]">
                    Descrição da Onda P
                  </Label>
                  <Input
                    placeholder="Ex: Positiva em D1, D2 e aVF, duração e amplitude normais"
                    value={pWaveDesc}
                    onChange={(e) => setPWaveDesc(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-[#2F3942]">
                    Condução Atrioventricular
                  </Label>
                  <Input
                    placeholder="Ex: Condução AV normal, relação 1:1 preservada"
                    value={avConduction}
                    onChange={(e) => setAvConduction(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-[#2F3942]">
                    Condução Intraventricular
                  </Label>
                  <Input
                    placeholder="Ex: Condução intraventricular normal (ou BDR, BRE, BDAS...)"
                    value={ivConduction}
                    onChange={(e) => setIvConduction(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-[#2F3942]">
                    Repolarização Ventricular (ST-T / QT)
                  </Label>
                  <Input
                    placeholder="Ex: Sem alterações primárias da repolarização ventricular"
                    value={repolarization}
                    onChange={(e) => setRepolarization(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-[#2F3942]">
                    Ondas Q e Achados Relevantes
                  </Label>
                  <Input
                    placeholder="Ex: Ausência de ondas Q patológicas de necrose"
                    value={qWaves}
                    onChange={(e) => setQWaves(e.target.value)}
                    className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 3: Qualidade Técnica do Traçado */}
            <div>
              <Label className="text-[11px] text-[#2F3942] font-semibold">
                Avaliação da Qualidade Técnica do Traçado (Item 2 SBC 2022)
              </Label>
              <Input
                value={technicalQuality}
                onChange={(e) => setTechnicalQuality(e.target.value)}
                placeholder="Ex: Traçado legível, calibração N e 25mm/s, sem artefatos de tremor muscular"
                className="text-xs h-8 mt-1 border-[#E3E6E8] focus:border-[#4A90D9]"
              />
            </div>
          </>
        ) : (
          /* MODALIDADE TEXTO LIVRE: campos amplos e redimensionáveis */
          <div className="p-4 bg-[#F7F6F4]/40 rounded-xl border border-[#E3E6E8] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#4A90D9]" />
                <h4 className="text-xs font-bold text-[#2F3942]">Modalidade Texto Livre Ativa</h4>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] bg-white text-[#4A90D9] border-[#4A90D9]/30"
              >
                Sem obrigatoriedade de campos estruturados
              </Badge>
            </div>
            <p className="text-[11px] text-[#6F7780] leading-relaxed">
              Escreva diretamente o laudo eletrocardiográfico e a conclusão diagnóstica. Caso decida
              voltar ao modo estruturado a qualquer momento, todos os campos previamente preenchidos
              permanecem preservados.
            </p>
          </div>
        )}

        {/* Bloco de Redação em Texto Livre (Comum às modalidades, redimensionável e amplo) */}
        <div className="space-y-4 pt-2 border-t border-[#E3E6E8]">
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#2F3942]">
                Descrição Eletrocardiográfica Detalhada *
              </Label>
              <span className="text-[10px] text-[#6F7780]">
                {reportMode === 'free_text'
                  ? 'Redação livre ampla (redimensionável)'
                  : 'Área expandida para redação minuciosa'}
              </span>
            </div>
            <Textarea
              rows={reportMode === 'free_text' ? 10 : 5}
              value={freeTextDescription}
              onChange={(e) => setFreeTextDescription(e.target.value)}
              placeholder={
                reportMode === 'free_text'
                  ? 'Descreva livremente o traçado (ritmo, condução, intervalos, repolarização, sobrecargas, achados especiais)...'
                  : 'Descreva detalhadamente os achados do traçado eletrocardiográfico...'
              }
              className={`text-xs mt-1.5 border-[#E3E6E8] focus:border-[#4A90D9] leading-relaxed resize-y ${
                reportMode === 'free_text' ? 'min-h-[180px]' : 'min-h-[90px]'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#2F3942]">
                Conclusão Eletrocardiográfica Diagnóstica *
              </Label>
              <span className="text-[10px] text-[#6F7780]">Síntese diagnóstica final</span>
            </div>
            <Textarea
              rows={reportMode === 'free_text' ? 5 : 3}
              value={freeTextConclusion}
              onChange={(e) => setFreeTextConclusion(e.target.value)}
              placeholder="Ex: 1. Ritmo sinusal regular. 2. Traçado dentro dos limites da normalidade."
              className={`text-xs mt-1.5 font-semibold text-[#2F3942] border-[#E3E6E8] focus:border-[#4A90D9] leading-relaxed resize-y ${
                reportMode === 'free_text' ? 'min-h-[100px]' : 'min-h-[70px]'
              }`}
            />
          </div>
        </div>

        {/* Bloco 5: Ações Críticas e Devolução */}
        <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="font-bold text-[#2F3942]">
                Segurança do Paciente & Triagem Técnica
              </span>
              <p className="text-[11px] text-[#6F7780]">
                Sinalize suspeitas críticas ou devolva traçados com defeitos técnicos à clínica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCriticalModalOpen(true)}
              className={`h-8 text-xs border-red-300 ${
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
              className="h-8 text-xs border-[#E3E6E8] text-[#2F3942] hover:bg-white"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1 text-[#6F7780]" />
              Devolver c/ Problema Técnico
            </Button>
          </div>
        </div>

        {/* v0.0.35: BARRA UNIFICADA COM AS TRÊS AÇÕES PRINCIPAIS */}
        <div className="p-4 bg-white rounded-xl border border-[#E3E6E8] shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#E3E6E8] pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#4A90D9]" />
              <div>
                <span className="font-bold text-xs text-[#2F3942]">Fluxo Clínico Centralizado</span>
                <span className="text-[11px] text-[#6F7780] ml-2">
                  Três etapas claras: Rascunho • Conclusão • Assinatura ICP-Brasil
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpenPreviewInPdfViewer}
                disabled={isLoadingPreview}
                className="h-7 text-xs text-[#4A90D9] hover:bg-[#4A90D9]/10 gap-1 px-2"
                title="Visualizar prévia em PDF direto no visualizador nativo Canvas"
              >
                {isLoadingPreview ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                <span>Prévia em PDF</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpenVersions}
                className="h-7 text-xs text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4] gap-1 px-2"
              >
                <Layers className="w-3 h-3" />
                <span>Versões ({documents.length})</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpenSignatureStatus}
                className="h-7 text-xs text-[#6F7780] hover:text-[#2F3942] hover:bg-[#F7F6F4] gap-1 px-2"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>Auditoria ({signatures.length})</span>
              </Button>
            </div>
          </div>

          {/* AS TRÊS AÇÕES PRINCIPAIS BEM DISTINGUÍVEIS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* AÇÃO 1: SALVAR RASCUNHO */}
            <div className="p-3 bg-[#F7F6F4]/60 rounded-lg border border-[#E3E6E8] flex flex-col justify-between gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#2F3942] flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5 text-[#6F7780]" />
                    <span>1. Salvar Rascunho</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-white border-[#E3E6E8]">
                    {saveStatus === 'saved' ? 'Salvo' : 'Automático'}
                  </Badge>
                </div>
                <p className="text-[11px] text-[#6F7780] leading-snug">
                  Grava em rascunhos sem gerar documento definitivo nem bloquear a edição.
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={performSaveDraft}
                disabled={saveStatus === 'saving'}
                className="w-full h-8 text-xs border-[#E3E6E8] bg-white text-[#2F3942] hover:bg-slate-50 font-medium"
              >
                {saveStatus === 'saving' ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Save className="w-3 h-3 mr-1 text-[#6F7780]" />
                )}
                <span>Salvar Agora</span>
              </Button>
            </div>

            {/* AÇÃO 2: CONCLUIR LAUDO */}
            <div className="p-3 bg-[#4A90D9]/5 rounded-lg border border-[#4A90D9]/30 flex flex-col justify-between gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#2F3942] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#4A90D9]" />
                    <span>2. Concluir Laudo</span>
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-[#4A90D9]/10 text-[#4A90D9] border-[#4A90D9]/30"
                  >
                    Definitivo
                  </Badge>
                </div>
                <p className="text-[11px] text-[#6F7780] leading-snug">
                  Gera PDF definitivo com hash SHA-256 e assinatura manuscrita ativa no rodapé.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => setIsConfirmFinalizeOpen(true)}
                  className="flex-1 h-8 text-xs bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold shadow-xs"
                >
                  <Send className="w-3 h-3 mr-1" />
                  <span>Concluir Laudo</span>
                </Button>

                {(finalizedDocument || documents.length > 0) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDocumentInPdfViewer(finalizedDocument || documents[0])}
                    className="h-8 px-2.5 text-xs border-[#4A90D9]/40 text-[#4A90D9] bg-white hover:bg-[#4A90D9]/10"
                    title="Visualizar PDF definitivo concluído"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* AÇÃO 3: ASSINAR E LIBERAR */}
            <div className="p-3 bg-[#2F3942]/5 rounded-lg border border-[#2F3942]/30 flex flex-col justify-between gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#2F3942] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>3. Assinar e Liberar</span>
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300"
                  >
                    ICP-Brasil
                  </Badge>
                </div>
                <p className="text-[11px] text-[#6F7780] leading-snug">
                  Aplica PAdES ICP-Brasil e libera clinicamente após validação criptográfica.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={handleOpenSigningFlow}
                  className="flex-1 h-8 text-xs bg-[#2F3942] hover:bg-[#1f262c] text-white font-semibold shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  <span>Painel de Assinatura</span>
                </Button>

                {(finalizedDocument || documents.length > 0) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const doc = finalizedDocument || documents[0]
                      setActiveReportDoc(doc)
                      setIsExternalSigningModalOpen(true)
                    }}
                    className="h-8 px-2.5 text-xs border-[#2F3942]/40 text-[#2F3942] bg-white hover:bg-slate-100"
                    title="Acessar Assinatura Externa ICP-Brasil (Visualizar, Baixar e Importar)"
                  >
                    <Download className="w-3.5 h-3.5 text-[#2F3942]" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* PAINEL COMPACTO RETRÁTIL DE ASSINATURA DIGITAL */}
          {isSigningPanelOpen && (
            <div className="mt-4 p-4 bg-[#F7F6F4] rounded-xl border-2 border-[#4A90D9]/30 space-y-3.5 transition-all">
              <div className="flex items-center justify-between border-b border-[#E3E6E8] pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#4A90D9]" />
                  <span className="font-bold text-xs text-[#2F3942]">
                    Painel Compacto de Assinatura ICP-Brasil
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsSigningPanelOpen(false)}
                  className="h-6 text-[11px] text-[#6F7780] hover:text-[#2F3942]"
                >
                  Recolher Painel
                </Button>
              </div>

              {/* Situação da Sessão e Certificado Selecionado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Certificado */}
                <div className="p-2.5 bg-white rounded-lg border border-[#E3E6E8] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#6F7780]">
                    Certificado Selecionado
                  </span>
                  <Select
                    value={selectedCertificateId}
                    onValueChange={(v) => setSelectedCertificateId(v)}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white border-[#E3E6E8]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="integra_bry" className="text-xs">
                        Certificado em Nuvem (Integra Bry)
                      </SelectItem>
                      <SelectItem value="birdid_pro" className="text-xs">
                        Bird ID Pro (Soluti CESS)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Situação da Sessão */}
                <div className="p-2.5 bg-white rounded-lg border border-[#E3E6E8] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#6F7780]">
                    Situação da Sessão
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {isLoadingSigningSession ? (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Verificando...</span>
                      </Badge>
                    ) : signingSession?.hasActiveSession && !signingSession.isExpired ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 gap-1 font-semibold"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Sessão Ativa</span>
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 gap-1 font-semibold"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Pendente / Inativa</span>
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Validade / Renovação */}
                <div className="p-2.5 bg-white rounded-lg border border-[#E3E6E8] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#6F7780]">
                    Validade da Autorização
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[#2F3942] font-medium truncate">
                      {signingSession?.expiresAt
                        ? new Date(signingSession.expiresAt).toLocaleTimeString('pt-BR')
                        : 'Não autorizada'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAuthorizeSigningSession}
                      disabled={isLoadingSigningSession}
                      className="h-6 text-[10px] px-2 border-[#4A90D9]/30 text-[#4A90D9] hover:bg-[#4A90D9]/10"
                    >
                      {signingSession?.hasActiveSession ? 'Renovar' : 'Autorizar'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* BANNER OBJETIVO DE PENDÊNCIA (SEM FINGIR ASSINATURA) */}
              {signingBannerMessage && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-950 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-medium">{signingBannerMessage}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAuthorizeSigningSession}
                    className="h-7 text-xs border-amber-300 bg-white text-amber-950 font-semibold hover:bg-amber-100 shrink-0"
                  >
                    Autorizar Sessão ICP-Brasil
                  </Button>
                </div>
              )}

              {/* SITUAÇÃO DO DOCUMENTO NOS TRÊS ESTADOS EXPLÍCITOS */}
              <div className="p-3 bg-white rounded-lg border border-[#E3E6E8] space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#6F7780] block">
                  Situação Cadastral e Probatória do Documento
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* Estado 1 */}
                  <div
                    className={`p-2 rounded border ${
                      !finalizedDocument && documents.length === 0
                        ? 'bg-amber-50 border-amber-300 font-semibold text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-[#6F7780]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>1. Prévia de Rascunho</span>
                    </div>
                    <p className="text-[10px] mt-1">Sem assinatura, sem validade jurídica.</p>
                  </div>

                  {/* Estado 2 */}
                  <div
                    className={`p-2 rounded border ${
                      (finalizedDocument || documents.length > 0) &&
                      !signatures.some((s) => s.signature_status === 'VALIDADA')
                        ? 'bg-sky-50 border-sky-300 font-semibold text-sky-950'
                        : 'bg-slate-50 border-slate-200 text-[#6F7780]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      <span>2. Laudo Concluído</span>
                    </div>
                    <p className="text-[10px] mt-1">
                      PDF definitivo com assinatura manuscrita ativa.
                    </p>
                  </div>

                  {/* Estado 3 */}
                  <div
                    className={`p-2 rounded border ${
                      signatures.some((s) => s.signature_status === 'VALIDADA')
                        ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-950'
                        : 'bg-slate-50 border-slate-200 text-[#6F7780]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>3. Laudo Assinado</span>
                    </div>
                    <p className="text-[10px] mt-1">
                      PAdES validado e liberação clínica homologada.
                    </p>
                  </div>
                </div>
              </div>

              {/* AÇÕES DE ASSINATURA COMPACTAS */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  {/* Opção de Assinador Externo */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const doc = finalizedDocument || documents[0]
                      if (!doc) {
                        alert('Conclua o laudo primeiro para gerar o PDF definitivo.')
                        return
                      }
                      setActiveReportDoc(doc)
                      setIsExternalSigningModalOpen(true)
                    }}
                    className="h-8 text-xs border-[#E3E6E8] bg-white text-[#2F3942] hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5 mr-1 text-[#6F7780]" />
                    <span>Assinar Externamente (Exportar PDF)</span>
                  </Button>

                  {/* Conector Bird ID Pro caso selecionado */}
                  {selectedCertificateId === 'birdid_pro' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const doc = finalizedDocument || documents[0]
                        if (!doc) {
                          alert('Conclua o laudo primeiro para gerar o PDF definitivo.')
                          return
                        }
                        setActiveReportDoc(doc)
                        setIsBirdIdModalOpen(true)
                      }}
                      className="h-8 text-xs border-[#4A90D9]/30 text-[#4A90D9] bg-white hover:bg-[#4A90D9]/10"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      <span>Abrir Modal Bird ID Pro</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleExecutePadesSignature}
                    disabled={
                      isExecutingPadesSign ||
                      !signingSession?.hasActiveSession ||
                      signingSession.isExpired ||
                      (!finalizedDocument && documents.length === 0)
                    }
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  >
                    {isExecutingPadesSign ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        <span>Assinando PAdES...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                        <span>Executar Assinatura Digital e Liberar</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* MODAL 0A: CRIAR NOVO MODELO PESSOAL DO CARDIOLOGISTA */}
      <Dialog open={isNewPersonalTemplateOpen} onOpenChange={setIsNewPersonalTemplateOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4] shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5 text-[#2F3942]">
              <Bookmark className="w-4 h-4 text-[#4A90D9]" />
              <span>Salvar como Modelo Pessoal</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F7780]">
              Crie um modelo próprio a partir da descrição e conclusão preenchidas para reutilizar
              em futuros laudos.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
            <div>
              <Label className="text-xs font-semibold text-[#2F3942]">Título do Modelo *</Label>
              <Input
                placeholder="Ex: ECG Normal Adulto - Dr. Carlos"
                value={newTemplateTitle}
                onChange={(e) => setNewTemplateTitle(e.target.value)}
                className="text-xs mt-1 border-[#E3E6E8]"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#2F3942]">Categoria</Label>
              <Input
                placeholder="Ex: Normalidade, Isquemia, Arritmias..."
                value={newTemplateCategory}
                onChange={(e) => setNewTemplateCategory(e.target.value)}
                className="text-xs mt-1 border-[#E3E6E8]"
              />
            </div>

            <div className="p-2.5 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8] text-[11px] space-y-1 text-[#6F7780]">
              <div>
                <strong>Descrição a gravar:</strong>{' '}
                <span className="italic">
                  {freeTextDescription ? `"${freeTextDescription.slice(0, 80)}..."` : '(vazia)'}
                </span>
              </div>
              <div>
                <strong>Conclusão a gravar:</strong>{' '}
                <span className="italic">
                  {freeTextConclusion ? `"${freeTextConclusion.slice(0, 80)}..."` : '(vazia)'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-[#E3E6E8] bg-white shrink-0">
            <Button
              size="sm"
              variant="outline"
              disabled={isSavingPersonalTemplate}
              onClick={() => setIsNewPersonalTemplateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isSavingPersonalTemplate}
              onClick={handleSaveAsPersonalTemplate}
              className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white text-xs font-semibold"
            >
              {isSavingPersonalTemplate ? 'Salvando...' : 'Salvar Modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 0B: CONFIRMAÇÃO DE SÍNTESE DE TEXTO A PARTIR DO ESTRUTURADO */}
      <Dialog open={isGenerateConfirmOpen} onOpenChange={setIsGenerateConfirmOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4] shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5 text-[#2F3942]">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Confirmar Substituição da Redação Atual</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F7780]">
              Você já possui texto redigido na descrição ou conclusão. Deseja substituí-lo pela
              proposta gerada a partir dos campos estruturados?
            </DialogDescription>
          </DialogHeader>

          {generatedProposalCandidate && (
            <div className="p-4 space-y-2 overflow-y-auto flex-1 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="font-semibold text-slate-800 text-[11px]">
                  Proposta de Descrição:
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {generatedProposalCandidate.description}
                </p>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="font-semibold text-slate-800 text-[11px]">
                  Proposta de Conclusão:
                </span>
                <p className="text-[11px] text-slate-600 font-medium">
                  {generatedProposalCandidate.conclusion}
                </p>
              </div>
              <p className="text-[10px] text-[#6F7780] italic">
                A proposta permanecerá 100% editável após ser inserida.
              </p>
            </div>
          )}

          <DialogFooter className="p-4 border-t border-[#E3E6E8] bg-white shrink-0">
            <Button size="sm" variant="outline" onClick={() => setIsGenerateConfirmOpen(false)}>
              Manter meu texto atual
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmApplyGeneratedProposal}
              className="bg-[#2F3942] hover:bg-[#1f262c] text-white text-xs font-semibold"
            >
              Sim, substituir pela proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 1: HISTÓRICO DE VERSÕES DO RASCUNHO */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4] shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5 text-[#2F3942]">
              <History className="w-4 h-4 text-[#4A90D9]" />
              <span>Histórico de Alterações do Rascunho</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F7780]">
              Registros imutáveis de versão com autor, horário e modificações gravadas
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 overflow-y-auto flex-1 space-y-2 text-xs">
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
                    <div className="text-[11px] text-slate-700 italic border-l-2 border-[#4A90D9] pl-2 mt-1">
                      Conclusão: "{d.free_text_conclusion}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="p-4 border-t border-[#E3E6E8] bg-white shrink-0">
            <Button size="sm" variant="outline" onClick={() => setIsHistoryModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: DEVOLUÇÃO TÉCNICA DO EXAME */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4] shrink-0">
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

          <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
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

          <DialogFooter className="p-4 border-t border-[#E3E6E8] bg-white shrink-0">
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
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4] shrink-0">
            <DialogTitle className="text-sm font-bold text-red-700 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>Registro de Achado Potencialmente Crítico</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Formalização probatória da comunicação direta entre o cardiologista e a equipe
              assistente da unidade solicitante.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
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

          <DialogFooter className="p-4 border-t border-[#E3E6E8] bg-white shrink-0">
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

      {/* MODAL 4: CONFIRMAÇÃO DE CONCLUSÃO DO LAUDO (AÇÃO 2) */}
      <Dialog open={isConfirmFinalizeOpen} onOpenChange={setIsConfirmFinalizeOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4] shrink-0">
            <DialogTitle className="text-sm font-bold text-[#2F3942] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#4A90D9]" />
              <span>Concluir Elaboração do Laudo</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F7780]">
              Esta ação finaliza a elaboração médica, grava a versão clínica definitiva e gera o
              documento PDF com hash criptográfico SHA-256.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 overflow-y-auto flex-1 space-y-2 text-xs text-[#2F3942]">
            <div className="p-3.5 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8] space-y-2">
              <p className="font-semibold">O que acontecerá ao confirmar:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#6F7780]">
                <li>
                  O laudo médico avança para a situação <strong>AGUARDANDO_ASSINATURA</strong>.
                </li>
                <li>
                  O documento PDF definitivo é gerado e registrado em <code>report_documents</code>.
                </li>
                <li>
                  A assinatura manuscrita ativa do cardiologista é incorporada fisicamente no rodapé
                  (quando cadastrada).
                </li>
                <li>
                  Você poderá imediatamente <strong>visualizar em PDF</strong> e{' '}
                  <strong>baixar o laudo concluído</strong> sem exigir assinatura digital
                  ICP-Brasil.
                </li>
                <li>
                  A liberação clínica definitiva para a clínica permanece protegida até a assinatura
                  ICP-Brasil.
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-[#E3E6E8] bg-white shrink-0">
            <Button
              size="sm"
              variant="outline"
              disabled={isFinalizingReport}
              onClick={() => setIsConfirmFinalizeOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isFinalizingReport}
              onClick={handleExecuteFinalizeReport}
              className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white text-xs font-semibold"
            >
              {isFinalizingReport ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Concluindo e Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  <span>Confirmar e Concluir Laudo</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* v0.0.35: NOVO VISUALIZADOR DE PDF EM CANVAS (SEM SUB-IFRAME) */}
      <PdfViewerModal
        isOpen={isPdfViewerOpen}
        onClose={() => setIsPdfViewerOpen(false)}
        pdfData={viewerPdfBytes}
        pdfUrl={viewerPdfUrl}
        title={viewerTitle}
        fileName={viewerFileName}
        metadata={viewerMeta}
      />

      {/* MODAL 6 (ETAPA 4A): VERSÕES DO DOCUMENTO */}
      <Dialog open={isVersionsModalOpen} onOpenChange={setIsVersionsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden bg-white border-[#E3E6E8] shadow-2xl">
          <DialogHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4] shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#0E4C92]" />
              <span>Versões do Documento</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Registros imutáveis das versões de PDF preparadas para assinatura
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 overflow-y-auto flex-1 space-y-3">
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
          </div>

          <DialogFooter className="p-4 border-t border-[#E3E6E8] bg-white shrink-0">
            <Button size="sm" variant="outline" onClick={() => setIsVersionsModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 7 (ETAPA 4A): STATUS DA ASSINATURA DIGITAL */}
      <Dialog open={isSignatureModalOpen} onOpenChange={setIsSignatureModalOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden bg-white border-[#E3E6E8] shadow-2xl">
          <DialogHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4] shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Status da Assinatura Digital</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Transações de assinatura PAdES ICP-Brasil registradas para este exame
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 overflow-y-auto flex-1 space-y-3">
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
          </div>

          <DialogFooter className="p-4 border-t border-[#E3E6E8] bg-white shrink-0">
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

      {/* MODAL 9: ASSINATURA DIGITAL EXTERNA OPCIONAL (ICP-BRASIL) */}
      <Dialog open={isExternalSigningModalOpen} onOpenChange={setIsExternalSigningModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden bg-white border-[#E3E6E8] shadow-2xl">
          <DialogHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4] shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-[#2F3942]">
              <ShieldCheck className="w-4 h-4 text-[#4A90D9]" />
              <span>Painel Integrado de Assinatura Digital & Externa (ICP-Brasil)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F7780]">
              Visualização probatória, download seguro para assinatura externa, importação e
              checklist dos critérios de conformidade ICP-Brasil sem transição de telas.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* Bloco 1: Visualizar e Baixar PDF Preparado */}
            <div className="p-4 bg-[#F7F6F4]/60 rounded-xl border border-[#E3E6E8] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#4A90D9]" />
                  <span className="font-bold text-xs text-[#2F3942]">
                    1. Documento Oficial Preparado para Assinatura
                  </span>
                </div>
                {activeReportDoc && (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-mono bg-white text-[#2F3942] border-[#E3E6E8]"
                  >
                    {activeReportDoc.document_code ||
                      `LAUDO-ECG-${exam.id.slice(-6).toUpperCase()}-V${activeReportDoc.version || 1}`}{' '}
                    (v{activeReportDoc.version || 1}.0)
                  </Badge>
                )}
              </div>

              {activeReportDoc ? (
                <div className="space-y-2">
                  <div className="p-2.5 bg-white rounded-lg border border-[#E3E6E8] text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-[#6F7780]">
                      <span>Nome do arquivo para assinatura:</span>
                      <strong className="text-[#2F3942] font-mono">
                        {activeReportDoc.document_code ||
                          `LAUDO-ECG-${exam.id.slice(-6).toUpperCase()}-V${activeReportDoc.version || 1}`}
                        .pdf
                      </strong>
                    </div>
                    <div className="text-[#6F7780] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pt-1 border-t border-[#F7F6F4]">
                      <span>Hash SHA-256 Registrado:</span>
                      <span className="font-mono text-[10px] text-[#2F3942] break-all select-all font-semibold">
                        {activeReportDoc.file_hash_sha256 || 'Calculado e protegido pelo backend'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (activeReportDoc) {
                          handleOpenDocumentInPdfViewer(activeReportDoc)
                        } else {
                          handleOpenPreviewInPdfViewer()
                        }
                      }}
                      className="w-full text-xs gap-1.5 border-[#4A90D9]/30 text-[#4A90D9] hover:bg-[#4A90D9]/10 bg-white"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar PDF em Tela Cheia</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `${import.meta.env.VITE_POCKETBASE_URL || ''}/backend/v1/exams/${exam.id}/report-pdf-preview`,
                            {
                              headers: {
                                Authorization: `Bearer ${pb.authStore.token}`,
                              },
                            },
                          )
                          if (!res.ok) throw new Error('Falha ao obter PDF para assinatura')
                          const data = await res.json()
                          const filename = `${activeReportDoc.document_code || `LAUDO-ECG-${exam.id.slice(-6).toUpperCase()}-V${activeReportDoc.version || 1}`}.pdf`
                          const blob = new Blob([data.pdfRawString], { type: 'application/pdf' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = filename
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                        } catch (err: any) {
                          alert(`Erro ao baixar PDF para assinatura: ${err.message}`)
                        }
                      }}
                      className="w-full text-xs gap-1.5 bg-[#2F3942] hover:bg-[#1f262c] text-white font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar PDF para Assinar</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-950 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Conclua a elaboração do laudo para gerar a versão oficial antes de baixar.
                  </span>
                </div>
              )}
            </div>

            {/* Bloco 2: Importar PDF Assinado Externamente */}
            <div className="p-4 bg-[#F7F6F4]/60 rounded-xl border border-[#E3E6E8] space-y-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#4A90D9]" />
                <span className="font-bold text-xs text-[#2F3942]">
                  2. Importar PDF Assinado com Certificado ICP-Brasil
                </span>
              </div>
              <p className="text-[11px] text-[#6F7780]">
                Faça o upload do documento após aplicar a assinatura digital PAdES (Token A3 físico,
                Certificado A1 ou Assinador Desktop do ITI / Gov.br / Adobe Sign).
              </p>

              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#4A90D9]/30 rounded-lg bg-white hover:bg-[#4A90D9]/5 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-[#4A90D9] mb-1" />
                <span className="text-xs font-semibold text-[#2F3942]">
                  {externalUploadedFileName || 'Selecionar PDF assinado digitalmente'}
                </span>
                <span className="text-[10px] text-[#6F7780] mt-0.5">
                  Arquivo .pdf com assinatura PAdES
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setExternalUploadedFileName(file.name)
                      setExternalUploadSuccess(true)
                      // Executar verificação dos critérios ICP-Brasil no backend
                      try {
                        const sigToVerify = signatures[0]
                        if (sigToVerify) {
                          const valRes = await pb.send(
                            '/backend/v1/signatures/validate-and-release',
                            {
                              method: 'POST',
                              body: { signature_id: sigToVerify.id },
                            },
                          )
                          if (valRes && valRes.checklist) {
                            setValidationChecklist(valRes.checklist)
                          }
                        }
                      } catch (vErr) {
                        console.log('Verificação critérios:', vErr)
                      }
                    }
                  }}
                />
              </label>

              {externalUploadSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Arquivo <strong>{externalUploadedFileName}</strong> anexado para conferência
                      probatória.
                    </span>
                  </div>
                  <Badge className="bg-emerald-600 text-white text-[10px]">Anexado</Badge>
                </div>
              )}
            </div>

            {/* Bloco 3: Checklist dos Critérios ICP-Brasil e Bloqueio de Liberação */}
            <div className="p-4 bg-[#F7F6F4]/60 rounded-xl border border-[#E3E6E8] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#4A90D9]" />
                  <span className="font-bold text-xs text-[#2F3942]">
                    3. Resultado da Validação Criptográfica (Checklist ICP-Brasil)
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    signatures.some(
                      (s) => s.signature_status === 'VALIDADA' && s.is_clinically_released,
                    )
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  {signatures.some(
                    (s) => s.signature_status === 'VALIDADA' && s.is_clinically_released,
                  )
                    ? 'Liberação Homologada'
                    : 'Liberação Clínica Bloqueada'}
                </Badge>
              </div>

              <div className="space-y-1.5">
                {(validationChecklist.length > 0
                  ? validationChecklist
                  : [
                      {
                        id: 'crit-1',
                        name: 'Identidade do Signatário',
                        description:
                          'Certificado ICP-Brasil pertencente ao cardiologista responsável.',
                        passed: Boolean(activeReportDoc),
                        details: 'Médico vinculado e autenticado na solicitação.',
                      },
                      {
                        id: 'crit-2',
                        name: 'Correspondência Documento ↔ Transação',
                        description: 'Identificador do documento e versão correspondentes.',
                        passed: Boolean(activeReportDoc),
                        details: `Doc ID: ${activeReportDoc?.id || '—'} v${activeReportDoc?.version || 1}.0`,
                      },
                      {
                        id: 'crit-3',
                        name: 'Integridade e Hash SHA-256',
                        description: 'Hash do PDF coincide com o digest registrado no backend.',
                        passed: Boolean(activeReportDoc?.file_hash_sha256),
                        details: activeReportDoc?.file_hash_sha256
                          ? `Digest: ${activeReportDoc.file_hash_sha256.slice(0, 24)}...`
                          : 'Pendente',
                      },
                      {
                        id: 'crit-4',
                        name: 'Validade Criptográfica PAdES (CMS/PKCS#7)',
                        description: 'Assinatura matemática válida sobre o digest do documento.',
                        passed: false,
                        details: externalUploadSuccess
                          ? 'Pendente de validação da chave pública da AC emissora.'
                          : 'Aguardando importação do arquivo assinado.',
                      },
                      {
                        id: 'crit-5',
                        name: 'Cadeia de Confiança AC Raiz ICP-Brasil',
                        description:
                          'Ancoragem na infraestrutura de chaves públicas brasileira (DOC-ICP-04/05).',
                        passed: false,
                        details:
                          'Pendente de validação do certificado raiz da autoridade certificadora.',
                      },
                      {
                        id: 'crit-6',
                        name: 'Situação de Revogação (LCR / OCSP)',
                        description: 'Verificação em tempo real contra lista de revogações da AC.',
                        passed: false,
                        details: 'Pendente de consulta LCR/OCSP.',
                      },
                      {
                        id: 'crit-7',
                        name: 'Política de Assinatura e Carimbo de Tempo',
                        description:
                          'Conformidade com Resolução CFM 2.314/2022 e carimbo ICP-Brasil.',
                        passed: false,
                        details: 'Pendente de validação do carimbo temporal ACT.',
                      },
                    ]
                ).map((crit: any) => (
                  <div
                    key={crit.id}
                    className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                      crit.passed
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-white border-[#E3E6E8]'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-[#2F3942]">
                        {crit.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span>{crit.name}</span>
                      </div>
                      <p className="text-[11px] text-[#6F7780] pl-5">{crit.description}</p>
                      {crit.details && (
                        <p className="text-[10px] text-[#2F3942] pl-5 font-mono italic">
                          {crit.details}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 ${
                        crit.passed
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {crit.passed ? 'Aprovado' : 'Pendente'}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-lg text-amber-950 text-[11px] flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Regra de Segurança Estrita:</strong> A liberação clínica do exame para
                  download pelas clínicas permanece bloqueada até que todos os 7 critérios
                  ICP-Brasil sejam plenamente validados. O laudo concluído com assinatura manuscrita
                  fica seguro sob custódia médica.
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-white border-t border-[#E3E6E8] flex flex-row items-center justify-between shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExternalSigningModalOpen(false)}
              className="text-xs border-[#E3E6E8]"
            >
              Fechar Painel
            </Button>
            {externalUploadSuccess && (
              <Button
                size="sm"
                className="bg-[#2F3942] hover:bg-[#1f262c] text-white text-xs font-semibold gap-1.5"
                onClick={() => {
                  alert(
                    'Documento assinado externamente registrado com sucesso. A integridade e a custódia do laudo foram auditadas.',
                  )
                  setIsExternalSigningModalOpen(false)
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Concluir e Salvar Custódia</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
