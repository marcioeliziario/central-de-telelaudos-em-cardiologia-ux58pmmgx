import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  examService,
  doctorService,
  organizationService,
  documentService,
} from '@/services/telelaudosService'
import { ExamRequest, Doctor, Organization, ExamStatus } from '@/types/telelaudos'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Activity,
  Clock,
  FileText,
  UserCheck,
  CheckCircle,
  RotateCcw,
  Search,
  ArrowUpDown,
  Building2,
  ShieldAlert,
  Loader2,
  RefreshCw,
  FolderOpen,
  AlertTriangle,
  PenTool,
  CheckCircle2,
  Stethoscope,
  ChevronRight,
  Filter,
  Sparkles,
} from 'lucide-react'
import EcgViewer from '@/components/EcgViewer'
import ReportEditor from '@/components/ReportEditor'
import SecurityTestRunnerModal from '@/components/SecurityTestRunnerModal'
import FlexibleEditorTestRunnerModal from '@/components/FlexibleEditorTestRunnerModal'
import { MfaSecurityCard } from '@/components/MfaSecurityCard'
import { DoctorSignatureCard } from '@/components/DoctorSignatureCard'
import NotificationsPopover from '@/components/NotificationsPopover'
import { BirdIdSigningModal } from '@/components/BirdIdSigningModal'
import { MultiProviderSigningCard } from '@/components/MultiProviderSigningCard'
import { BrandLogo } from '@/components/BrandLogo'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ChevronDown, ChevronUp, Eye, User, Calendar, ExternalLink } from 'lucide-react'

export function CardiologistDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'queue'
  const { user } = useAuth()
  const [exams, setExams] = useState<ExamRequest[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Filtros da Fila Médica
  const [filterClinic, setFilterClinic] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortBy, setSortBy] = useState<'priority' | 'waiting_time' | 'date'>('priority')

  // Exame em Atendimento Ativo (Traçado + Editor Lado a Lado)
  const [activeExam, setActiveExam] = useState<ExamRequest | null>(null)
  const [isClaiming, setIsClaiming] = useState<string | null>(null)

  // Linhas expandidas na tabela compacta (sem ocupar espaço desnecessário permanentemente)
  const [expandedExamIds, setExpandedExamIds] = useState<Record<string, boolean>>({})

  const toggleExpandExam = (id: string) => {
    setExpandedExamIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Modal de Detalhes Clínicos do Paciente
  const [viewingClinicalDataExam, setViewingClinicalDataExam] = useState<ExamRequest | null>(null)

  // Modal de Devolução Rápida pela Lista
  const [returningExam, setReturningExam] = useState<ExamRequest | null>(null)
  const [returnReason, setReturnReason] = useState<string>('')
  const [isReturning, setIsReturning] = useState<boolean>(false)

  // Modal Conector Bird ID Pro na lista de exames
  const [birdIdModalExam, setBirdIdModalExam] = useState<ExamRequest | null>(null)
  const [birdIdModalDoc, setBirdIdModalDoc] = useState<any | null>(null)
  const [isOpeningBirdIdModal, setIsOpeningBirdIdModal] = useState<string | null>(null)

  // Modal de Testes de Segurança Automatizados
  const [isSecurityTestsOpen, setIsSecurityTestsOpen] = useState<boolean>(false)
  const [isFlexibleEditorTestsOpen, setIsFlexibleEditorTestsOpen] = useState<boolean>(false)

  // Carregar dados iniciais
  const loadInitialData = async () => {
    setIsLoading(true)
    try {
      const [allExams, allOrgs] = await Promise.all([
        examService.getAll(),
        organizationService.getAll(),
      ])
      setExams(allExams)
      setOrganizations(allOrgs)

      if (user) {
        const doc = await doctorService.getByUserId(user.id)
        setDoctor(doc)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do cardiologista:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [user])

  // Assumir Exame (Operação Atômica no Backend)
  const handleClaimExam = async (exam: ExamRequest) => {
    setIsClaiming(exam.id)
    try {
      const res = await examService.claimExam(exam.id)
      if (res.success) {
        setExams((prev) =>
          prev.map((e) =>
            e.id === exam.id
              ? {
                  ...e,
                  status: 'in_analysis',
                  assigned_doctor_id: doctor?.id,
                  assigned_at: new Date().toISOString(),
                }
              : e,
          ),
        )
        setActiveExam({
          ...exam,
          status: 'in_analysis',
          assigned_doctor_id: doctor?.id,
        })
      }
    } catch (err: any) {
      alert(`Não foi possível assumir o exame: ${err.message}`)
    } finally {
      setIsClaiming(null)
    }
  }

  // Devolver Exame por Problema Técnico
  const handleConfirmReturn = async () => {
    if (!returningExam) return
    if (!returnReason.trim() || returnReason.trim().length < 5) {
      alert('A justificativa técnica da devolução é obrigatória (mínimo de 5 caracteres).')
      return
    }

    setIsReturning(true)
    try {
      await examService.returnExam(returningExam.id, returnReason.trim())
      setExams((prev) =>
        prev.map((e) =>
          e.id === returningExam.id
            ? { ...e, status: 'returned', return_reason: returnReason.trim() }
            : e,
        ),
      )
      if (activeExam?.id === returningExam.id) {
        setActiveExam(null)
      }
      setReturningExam(null)
      setReturnReason('')
      alert('Exame devolvido à clínica solicitante com justificativa registrada.')
    } catch (err: any) {
      alert(`Falha ao devolver exame: ${err.message}`)
    } finally {
      setIsReturning(false)
    }
  }

  // Lista Filtrada e Ordenada
  const filteredExams = useMemo(() => {
    return exams
      .filter((exam) => {
        if (filterClinic !== 'all' && exam.organization_id !== filterClinic) {
          return false
        }
        if (filterPriority !== 'all' && exam.urgency !== filterPriority) {
          return false
        }
        if (filterStatus !== 'all') {
          if (filterStatus === 'my_exams') {
            if (exam.assigned_doctor_id !== doctor?.id) return false
          } else if (filterStatus === 'pending') {
            if (exam.status !== 'pending') return false
          } else if (filterStatus === 'in_analysis') {
            if (exam.status !== 'in_analysis') return false
          } else if (filterStatus === 'waiting_signature') {
            if (exam.status !== 'waiting_signature') return false
          } else if (filterStatus === 'returned') {
            if (exam.status !== 'returned') return false
          }
        }
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase()
          const patientName = exam.expand?.patient_id?.full_name?.toLowerCase() || ''
          const clinical = exam.clinical_indication?.toLowerCase() || ''
          const symptoms = exam.symptoms?.toLowerCase() || ''
          return (
            patientName.includes(term) ||
            clinical.includes(term) ||
            symptoms.includes(term) ||
            exam.id.toLowerCase().includes(term)
          )
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const priorityWeight: Record<string, number> = {
            emergency: 3,
            urgent: 2,
            routine: 1,
          }
          const weightDiff = (priorityWeight[b.urgency] || 0) - (priorityWeight[a.urgency] || 0)
          if (weightDiff !== 0) return weightDiff
          return new Date(a.created).getTime() - new Date(b.created).getTime()
        }
        if (sortBy === 'waiting_time') {
          return new Date(a.created).getTime() - new Date(b.created).getTime()
        }
        return new Date(b.created).getTime() - new Date(a.created).getTime()
      })
  }, [exams, filterClinic, filterPriority, filterStatus, searchTerm, sortBy, doctor?.id])

  // Badges discretas e sóbrias
  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return (
          <Badge className="bg-red-50 text-red-800 border border-red-300 font-semibold text-[10px]">
            Emergência
          </Badge>
        )
      case 'urgent':
        return (
          <Badge className="bg-amber-50 text-amber-800 border border-amber-300 font-medium text-[10px]">
            Urgente
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[#6F7780] border-[#E3E6E8] text-[10px]">
            Rotina
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: ExamStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-[#4A90D9]/10 text-[#4A90D9] border-[#4A90D9]/30 text-[10px] font-medium">
            Na Fila
          </Badge>
        )
      case 'in_analysis':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-medium">
            Em Elaboração
          </Badge>
        )
      case 'waiting_signature':
        return (
          <Badge className="bg-sky-50 text-sky-800 border-sky-300 text-[10px] font-medium">
            Aguardando Assinatura
          </Badge>
        )
      case 'returned':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] font-medium">
            Devolvido
          </Badge>
        )
      case 'reported':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-medium">
            Concluído
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

  // Visualização de Exame Ativo: Lado a Lado Refinado
  if (activeExam) {
    return (
      <div className="space-y-4 pb-8">
        {/* Barra superior do exame ativo */}
        <div className="bg-white p-3.5 rounded-xl border border-[#E3E6E8] shadow-[0_1px_3px_rgba(47,57,66,0.03)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActiveExam(null)
                loadInitialData()
              }}
              className="text-xs gap-1.5 border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4] h-8"
            >
              <ArrowUpDown className="w-3.5 h-3.5 rotate-90 text-[#6F7780]" />
              <span>Voltar à Fila</span>
            </Button>

            <div className="h-4 w-px bg-[#E3E6E8] hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#2F3942]">
                  {activeExam.expand?.patient_id?.full_name || 'Paciente'}
                </span>
                {getUrgencyBadge(activeExam.urgency)}
                {getStatusBadge(activeExam.status)}
              </div>
              <div className="text-xs text-[#6F7780] flex items-center gap-2 mt-0.5">
                <span>
                  Clínica:{' '}
                  {activeExam.expand?.organization_id?.trade_name ||
                    activeExam.expand?.organization_id?.name}
                </span>
                <span>•</span>
                <span>
                  Exame:{' '}
                  {activeExam.exam_date
                    ? new Date(activeExam.exam_date).toLocaleDateString('pt-BR')
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setViewingClinicalDataExam(activeExam)}
              className="text-xs gap-1.5 border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4] h-8"
            >
              <FileText className="w-3.5 h-3.5 text-[#4A90D9]" />
              <span>Ficha Clínica</span>
            </Button>
          </div>
        </div>

        {/* Lado a Lado: Visualizador de ECG (aprox 60%) + Editor SBC (aprox 40%) com Redimensionamento Arrastável */}
        <div className="hidden xl:block">
          <ResizablePanelGroup
            direction="horizontal"
            className="min-h-[780px] max-h-[calc(100dvh-130px)] rounded-xl border border-[#E3E6E8] bg-white shadow-xs"
          >
            <ResizablePanel
              defaultSize={58}
              minSize={35}
              maxSize={75}
              className="p-3 bg-[#F7F6F4]/30 flex flex-col min-h-0 overflow-y-auto"
            >
              <div className="min-h-[680px] flex-1">
                <EcgViewer exam={activeExam} />
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-[#E3E6E8] hover:bg-[#4A90D9] transition-colors"
            />
            <ResizablePanel
              defaultSize={42}
              minSize={25}
              maxSize={65}
              className="p-3 overflow-y-auto min-h-0"
            >
              <ReportEditor
                exam={activeExam}
                onReportSubmitted={() => {
                  setActiveExam(null)
                  loadInitialData()
                }}
                onReturnRequested={() => {
                  setActiveExam(null)
                  loadInitialData()
                }}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Layout Empilhado Verticalmente com rolagem fluida para Telas Estreitas / Tablets / Iframe Skip */}
        <div className="xl:hidden space-y-6">
          <div className="min-h-[520px] rounded-xl border border-[#E3E6E8] bg-white p-3 shadow-xs">
            <EcgViewer exam={activeExam} />
          </div>
          <div className="rounded-xl border border-[#E3E6E8] bg-white p-3 shadow-xs">
            <ReportEditor
              exam={activeExam}
              onReportSubmitted={() => {
                setActiveExam(null)
                loadInitialData()
              }}
              onReturnRequested={() => {
                setActiveExam(null)
                loadInitialData()
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Cabeçalho do Cardiologista com Identidade Visual Márcio Eliziário */}
      <div className="bg-white border border-[#E3E6E8] p-5 rounded-xl shadow-[0_1px_3px_rgba(47,57,66,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#4A90D9] text-xs font-bold uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4" />
            <span>Fila Médica & Central de Laudos</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#2F3942]">
            Atendimento Eletrocardiográfico
          </h1>
          <p className="text-xs text-[#6F7780] mt-0.5">
            Plataforma conforme Diretriz SBC 2022 • Laudos estruturados e preservação probatória
          </p>

          {doctor && (
            <div className="mt-2.5 text-xs bg-[#F7F6F4] px-2.5 py-1 rounded-md inline-flex items-center gap-2 text-[#2F3942] border border-[#E3E6E8]">
              <Stethoscope className="w-3.5 h-3.5 text-[#4A90D9]" />
              <span>
                Médico Laudador:{' '}
                <strong>{doctor.expand?.user_id?.name || user?.name || 'Carlos Silveira'}</strong> •
                CRM {doctor.crm}/{doctor.crm_state} • RQE {doctor.rqe || 'N/I'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NotificationsPopover role="cardiologist" />

          <Button
            size="sm"
            onClick={loadInitialData}
            variant="outline"
            className="border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4] text-xs gap-1.5 h-8"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#6F7780] ${isLoading ? 'animate-spin' : ''}`}
            />
            <span>Atualizar Fila</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsFlexibleEditorTestsOpen(true)}
            variant="outline"
            className="border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs gap-1.5 h-8 font-semibold"
            title="Executar os 10 testes do Editor Flexível de Laudos"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Testes Editor Flexível</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsSecurityTestsOpen(true)}
            variant="outline"
            className="border-[#4A90D9]/30 text-[#4A90D9] bg-[#4A90D9]/5 hover:bg-[#4A90D9]/10 text-xs gap-1.5 h-8"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Testes de Segurança</span>
          </Button>
        </div>
      </div>

      {/* Sistema de Abas Ergonômico: Operação Clínica Imediata vs Assinatura vs Configuração */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setSearchParams(val === 'queue' ? {} : { tab: val })
        }}
        className="space-y-4"
      >
        <div className="border-b border-[#E3E6E8] bg-white rounded-t-xl px-2 pt-2">
          <TabsList className="bg-transparent h-10 gap-1 p-0 flex flex-wrap">
            <TabsTrigger
              value="queue"
              className="text-xs data-[state=active]:bg-[#4A90D9]/10 data-[state=active]:text-[#4A90D9] data-[state=active]:font-bold px-3 py-1.5 rounded-lg border-b-2 data-[state=active]:border-[#4A90D9] border-transparent"
            >
              Fila de Exames ({exams.length})
            </TabsTrigger>
            <TabsTrigger
              value="in_analysis"
              className="text-xs data-[state=active]:bg-[#4A90D9]/10 data-[state=active]:text-[#4A90D9] data-[state=active]:font-bold px-3 py-1.5 rounded-lg border-b-2 data-[state=active]:border-[#4A90D9] border-transparent"
            >
              Laudos em Elaboração ({exams.filter((e) => e.status === 'in_analysis').length})
            </TabsTrigger>
            <TabsTrigger
              value="waiting_signature"
              className="text-xs data-[state=active]:bg-[#4A90D9]/10 data-[state=active]:text-[#4A90D9] data-[state=active]:font-bold px-3 py-1.5 rounded-lg border-b-2 data-[state=active]:border-[#4A90D9] border-transparent"
            >
              Aguardando Assinatura ({exams.filter((e) => e.status === 'waiting_signature').length})
            </TabsTrigger>
            <TabsTrigger
              value="my_signature"
              className="text-xs data-[state=active]:bg-[#4A90D9]/10 data-[state=active]:text-[#4A90D9] data-[state=active]:font-bold px-3 py-1.5 rounded-lg border-b-2 data-[state=active]:border-[#4A90D9] border-transparent"
            >
              Minha Assinatura e Certificado
            </TabsTrigger>
            <TabsTrigger
              value="account_settings"
              className="text-xs data-[state=active]:bg-[#4A90D9]/10 data-[state=active]:text-[#4A90D9] data-[state=active]:font-bold px-3 py-1.5 rounded-lg border-b-2 data-[state=active]:border-[#4A90D9] border-transparent"
            >
              Configurações de Conta & Segurança
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ABA: MINHA ASSINATURA E CERTIFICADO */}
        <TabsContent value="my_signature" className="space-y-4 m-0">
          <DoctorSignatureCard />
          <MultiProviderSigningCard />
        </TabsContent>

        {/* ABA: CONFIGURAÇÕES DE CONTA E SEGURANÇA */}
        <TabsContent value="account_settings" className="space-y-4 m-0">
          <MfaSecurityCard />
        </TabsContent>

        {/* ABA: FILA PRINCIPAL E OUTRAS VISÕES CLÍNICAS */}
        <TabsContent
          value={
            activeTab === 'my_signature' || activeTab === 'account_settings' ? '_none' : activeTab
          }
          className="space-y-4 m-0"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-[#E3E6E8] bg-white p-3.5 shadow-[0_1px_2px_rgba(47,57,66,0.03)] rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6F7780]">Na Fila</span>
                <Badge className="bg-[#4A90D9]/10 text-[#4A90D9] border-[#4A90D9]/20 text-[10px]">
                  Disponíveis
                </Badge>
              </div>
              <div className="text-2xl font-bold text-[#2F3942] mt-1">
                {exams.filter((e) => e.status === 'pending').length}
              </div>
            </Card>

            <Card className="border-[#E3E6E8] bg-white p-3.5 shadow-[0_1px_2px_rgba(47,57,66,0.03)] rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6F7780]">Em Elaboração</span>
                <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                  Assumidos
                </Badge>
              </div>
              <div className="text-2xl font-bold text-[#2F3942] mt-1">
                {exams.filter((e) => e.status === 'in_analysis').length}
              </div>
            </Card>

            <Card className="border-[#E3E6E8] bg-white p-3.5 shadow-[0_1px_2px_rgba(47,57,66,0.03)] rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6F7780]">Aguardando Assinatura</span>
                <Badge className="bg-sky-50 text-sky-800 border-sky-200 text-[10px]">
                  Elaborados
                </Badge>
              </div>
              <div className="text-2xl font-bold text-[#2F3942] mt-1">
                {exams.filter((e) => e.status === 'waiting_signature').length}
              </div>
            </Card>

            <Card className="border-[#E3E6E8] bg-white p-3.5 shadow-[0_1px_2px_rgba(47,57,66,0.03)] rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6F7780]">Devolvidos</span>
                <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px]">
                  Técnico
                </Badge>
              </div>
              <div className="text-2xl font-bold text-[#2F3942] mt-1">
                {exams.filter((e) => e.status === 'returned').length}
              </div>
            </Card>
          </div>

          {/* Barra de Filtros e Busca com Visual Limpo */}
          <Card className="border-[#E3E6E8] bg-white shadow-[0_1px_3px_rgba(47,57,66,0.03)] p-3.5 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Busca textual */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6F7780] absolute left-2.5 top-2.5" />
                <Input
                  placeholder="Buscar paciente, indicação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-xs h-8 border-[#E3E6E8] focus:border-[#4A90D9]"
                />
              </div>

              {/* Filtro de Clínica */}
              <div>
                <Select value={filterClinic} onValueChange={setFilterClinic}>
                  <SelectTrigger className="text-xs h-8 border-[#E3E6E8]">
                    <SelectValue placeholder="Todas as Clínicas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      Todas as Clínicas
                    </SelectItem>
                    {organizations
                      .filter((o) => o.type === 'client')
                      .map((org) => (
                        <SelectItem key={org.id} value={org.id} className="text-xs">
                          {org.trade_name || org.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Prioridade */}
              <div>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="text-xs h-8 border-[#E3E6E8]">
                    <SelectValue placeholder="Todas as Prioridades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      Todas as Prioridades
                    </SelectItem>
                    <SelectItem value="emergency" className="text-xs text-red-600 font-semibold">
                      Emergência
                    </SelectItem>
                    <SelectItem value="urgent" className="text-xs text-amber-600 font-semibold">
                      Urgente
                    </SelectItem>
                    <SelectItem value="routine" className="text-xs">
                      Rotina
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Situação */}
              <div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="text-xs h-8 border-[#E3E6E8]">
                    <SelectValue placeholder="Todas as Situações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      Todas as Situações
                    </SelectItem>
                    <SelectItem value="pending" className="text-xs">
                      Disponíveis na Fila
                    </SelectItem>
                    <SelectItem value="my_exams" className="text-xs font-semibold text-[#4A90D9]">
                      Meus Exames Assumidos
                    </SelectItem>
                    <SelectItem value="in_analysis" className="text-xs">
                      Em Elaboração
                    </SelectItem>
                    <SelectItem value="waiting_signature" className="text-xs">
                      Aguardando Assinatura
                    </SelectItem>
                    <SelectItem value="returned" className="text-xs">
                      Devolvidos
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ordenação */}
              <div>
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                  <SelectTrigger className="text-xs h-8 border-[#E3E6E8]">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority" className="text-xs">
                      Prioridade (Emergência Primeiro)
                    </SelectItem>
                    <SelectItem value="waiting_time" className="text-xs">
                      Tempo de Espera (Mais Antigos)
                    </SelectItem>
                    <SelectItem value="date" className="text-xs">
                      Data Recente
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* TABELA DE FILA MÉDICA COMPACTA (Requisito 3)
          Colunas estritas: Paciente, Clínica, Prioridade, Situação, Prazo restante, Ação principal.
          Permite identificar atrasos e urgências rapidamente sem poluição.
          Informações adicionais sob demanda via expansão de linha ou drawer/modal. */}
          <Card className="border-[#E3E6E8] bg-white shadow-[0_1px_3px_rgba(47,57,66,0.03)] overflow-hidden rounded-xl">
            <CardHeader className="p-3.5 border-b border-[#E3E6E8] bg-[#F7F6F4]/60 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-[#2F3942]">
                  Fila de Exames ({filteredExams.length})
                </CardTitle>
                <span className="text-xs text-[#6F7780] hidden sm:inline">
                  • Atendimento prioritário e controle estrito de SLA
                </span>
              </div>
              <div className="text-[11px] text-[#6F7780]">
                Clique em <span className="font-semibold text-[#2F3942]">Detalhes</span> para
                expandir
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-[#6F7780]">
                  <Loader2 className="w-5 h-5 animate-spin text-[#4A90D9] mb-2" />
                  <span className="text-xs">Carregando fila médica de cardiologia...</span>
                </div>
              ) : filteredExams.length === 0 ? (
                <div className="text-center p-10 text-[#6F7780]">
                  <FolderOpen className="w-9 h-9 mx-auto text-[#6F7780]/40 mb-2" />
                  <p className="text-xs font-semibold text-[#2F3942]">
                    Nenhum exame encontrado com os filtros selecionados.
                  </p>
                  <p className="text-[11px] text-[#6F7780] mt-0.5">
                    Aguarde o envio de novos exames pelas clínicas autorizadas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E3E6E8] bg-[#F7F6F4] text-[#6F7780] font-semibold text-[11px]">
                        <th className="py-2.5 px-3 w-8"></th>
                        <th className="py-2.5 px-3">Paciente</th>
                        <th className="py-2.5 px-3">Clínica</th>
                        <th className="py-2.5 px-3 text-center">Prioridade</th>
                        <th className="py-2.5 px-3 text-center">Situação</th>
                        <th className="py-2.5 px-3">Prazo Restante</th>
                        <th className="py-2.5 px-3 text-right">Ação Principal</th>
                      </tr>
                    </thead>
                    {filteredExams.map((exam) => {
                      const isAssignedToMe = exam.assigned_doctor_id === doctor?.id
                      const isAssignedToOther =
                        exam.assigned_doctor_id && exam.assigned_doctor_id !== doctor?.id
                      const isExpanded = Boolean(expandedExamIds[exam.id])

                      // Cálculo visual do prazo restante / SLA
                      const getRemainingDeadline = () => {
                        if (!exam.deadline_at)
                          return <span className="text-[#6F7780]">Sem prazo</span>
                        const deadline = new Date(exam.deadline_at)
                        const now = new Date()
                        const diffMs = deadline.getTime() - now.getTime()
                        const diffHours = Math.round(diffMs / (1000 * 60 * 60))

                        if (exam.sla_status === 'atrasado' || diffMs < 0) {
                          return (
                            <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                              <span>Atrasado ({Math.abs(diffHours)}h)</span>
                            </span>
                          )
                        }
                        if (exam.sla_status === 'proximo_do_vencimento' || diffHours <= 2) {
                          return (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Vence em ~{Math.max(1, diffHours)}h</span>
                            </span>
                          )
                        }
                        return (
                          <span className="text-[#2F3942] font-mono text-[11px]">
                            ~{diffHours}h restantes
                          </span>
                        )
                      }

                      return (
                        <tbody
                          key={exam.id}
                          className="divide-y divide-[#E3E6E8] border-b border-[#E3E6E8] last:border-b-0"
                        >
                          <tr
                            className={`hover:bg-[#F7F6F4]/80 transition-colors ${
                              isExpanded ? 'bg-[#F7F6F4]/50' : ''
                            } ${exam.urgency === 'emergency' ? 'bg-red-50/20' : ''}`}
                          >
                            {/* Botão de Expansão */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandExam(exam.id)}
                                className="p-1 rounded hover:bg-[#E3E6E8]/60 text-[#6F7780] hover:text-[#2F3942]"
                                title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-[#4A90D9]" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>

                            {/* Coluna 1: Paciente */}
                            <td className="py-2.5 px-3 min-w-[180px]">
                              <div className="font-bold text-[#2F3942] text-xs">
                                {exam.expand?.patient_id?.full_name || 'Paciente Fictício'}
                              </div>
                              <div className="text-[11px] text-[#6F7780] flex items-center gap-1.5">
                                <span>
                                  Exame:{' '}
                                  {exam.exam_date
                                    ? new Date(exam.exam_date).toLocaleDateString('pt-BR')
                                    : '—'}
                                </span>
                                {exam.has_pacemaker && (
                                  <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[9px] px-1 py-0">
                                    MP
                                  </Badge>
                                )}
                              </div>
                            </td>

                            {/* Coluna 2: Clínica */}
                            <td
                              className="py-2.5 px-3 text-[#2F3942] min-w-[140px] truncate max-w-[200px]"
                              title={
                                exam.expand?.organization_id?.trade_name ||
                                exam.expand?.organization_id?.name
                              }
                            >
                              <span className="font-medium text-xs">
                                {exam.expand?.organization_id?.trade_name ||
                                  exam.expand?.organization_id?.name ||
                                  'Clínica'}
                              </span>
                            </td>

                            {/* Coluna 3: Prioridade */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {getUrgencyBadge(exam.urgency)}
                            </td>

                            {/* Coluna 4: Situação */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {getStatusBadge(exam.status)}
                            </td>

                            {/* Coluna 5: Prazo restante */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {getRemainingDeadline()}
                            </td>

                            {/* Coluna 6: Ação principal */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Botão de Ver Ficha Clínica */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setViewingClinicalDataExam(exam)}
                                  className="h-7 px-2 text-[11px] text-[#6F7780] hover:text-[#2F3942] hover:bg-[#E3E6E8]/50"
                                  title="Ver Ficha Clínica"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  <span className="hidden xl:inline">Ficha</span>
                                </Button>

                                {/* Ação Principal: Assumir / Continuar / Revisar / Assinar */}
                                {exam.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleClaimExam(exam)}
                                    disabled={isClaiming === exam.id}
                                    className="h-7 text-xs bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold px-2.5 shadow-xs"
                                  >
                                    {isClaiming === exam.id ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                        <span>Assumindo...</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="w-3 h-3 mr-1" />
                                        <span>Assumir</span>
                                      </>
                                    )}
                                  </Button>
                                )}

                                {exam.status === 'in_analysis' && isAssignedToMe && (
                                  <Button
                                    size="sm"
                                    onClick={() => setActiveExam(exam)}
                                    className="h-7 text-xs bg-[#2F3942] hover:bg-[#1f262c] text-white font-semibold px-2.5 shadow-xs"
                                  >
                                    <Activity className="w-3 h-3 mr-1 text-[#4A90D9]" />
                                    <span>Continuar</span>
                                  </Button>
                                )}

                                {exam.status === 'in_analysis' && isAssignedToOther && (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-2 py-0.5"
                                  >
                                    Outro Médico
                                  </Badge>
                                )}

                                {exam.status === 'waiting_signature' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setActiveExam(exam)}
                                      className="h-7 text-xs border-[#4A90D9]/40 text-[#4A90D9] hover:bg-[#4A90D9]/5 font-semibold px-2"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      <span>Revisar</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        setIsOpeningBirdIdModal(exam.id)
                                        try {
                                          const docs = await documentService.getDocumentsForExam(
                                            exam.id,
                                          )
                                          if (docs && docs.length > 0) {
                                            setBirdIdModalDoc(docs[0])
                                            setBirdIdModalExam(exam)
                                          } else {
                                            alert(
                                              'Nenhum documento preparado para assinatura encontrado neste exame. Abra o editor e prepare o PDF.',
                                            )
                                          }
                                        } catch (err: any) {
                                          alert(`Erro ao carregar documento: ${err.message}`)
                                        } finally {
                                          setIsOpeningBirdIdModal(null)
                                        }
                                      }}
                                      disabled={isOpeningBirdIdModal === exam.id}
                                      className="h-7 text-xs bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold px-2.5 shadow-xs"
                                      title="Assinar com Bird ID Pro"
                                    >
                                      {isOpeningBirdIdModal === exam.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                      ) : (
                                        <PenTool className="w-3 h-3 mr-1" />
                                      )}
                                      <span>Assinar</span>
                                    </Button>
                                  </>
                                )}

                                {/* Ação de Devolver com Problema Técnico */}
                                {exam.status !== 'returned' && exam.status !== 'reported' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setReturningExam(exam)
                                      setReturnReason('')
                                    }}
                                    className="h-7 px-1.5 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                                    title="Devolver exame à clínica com problema técnico"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Linha Expandida sob Demanda (Sem ocupar espaço permanentemente) */}
                          {isExpanded && (
                            <tr className="bg-[#F7F6F4]/40 border-b border-[#E3E6E8]">
                              <td colSpan={7} className="p-3.5">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-lg border border-[#E3E6E8] shadow-2xs">
                                  <div>
                                    <span className="font-semibold text-[#2F3942] block">
                                      Indicação Clínica:
                                    </span>
                                    <p className="text-[#6F7780] text-[11px] mt-0.5 italic">
                                      {exam.clinical_indication || 'Nenhuma indicação cadastrada.'}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-[#2F3942] block">
                                      Sintomas & Medicamentos:
                                    </span>
                                    <p className="text-[#6F7780] text-[11px] mt-0.5">
                                      <strong>Sintomas:</strong> {exam.symptoms || '—'}
                                      <br />
                                      <strong>Medicamentos:</strong>{' '}
                                      {exam.medications_in_use || '—'}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="font-semibold text-[#2F3942] block">
                                      Metadados da Solicitação:
                                    </span>
                                    <div className="text-[11px] text-[#6F7780] space-y-0.5">
                                      <div>
                                        ID: <span className="font-mono">{exam.id}</span>
                                      </div>
                                      <div>
                                        Entrada: {new Date(exam.created).toLocaleString('pt-BR')}
                                      </div>
                                      {exam.return_reason && (
                                        <div className="text-red-700 font-semibold bg-red-50 p-1 rounded border border-red-200 mt-1">
                                          Motivo da Devolução: {exam.return_reason}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      )
                    })}
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE DADOS CLÍNICOS E METADADOS DO EXAME */}
      <Dialog
        open={Boolean(viewingClinicalDataExam)}
        onOpenChange={(open) => !open && setViewingClinicalDataExam(null)}
      >
        <DialogContent className="max-w-md bg-white border-[#E3E6E8]">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#2F3942] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#4A90D9]" />
              <span>Dados Clínicos da Solicitação</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F7780]">
              Informações fornecidas pela clínica no envio do traçado
            </DialogDescription>
          </DialogHeader>

          {viewingClinicalDataExam && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8] space-y-1">
                <div className="font-bold text-[#2F3942]">
                  {viewingClinicalDataExam.expand?.patient_id?.full_name}
                </div>
                <div className="text-[11px] text-[#6F7780]">
                  CPF: {viewingClinicalDataExam.expand?.patient_id?.cpf || 'Não informado'} • Sexo:{' '}
                  {viewingClinicalDataExam.expand?.patient_id?.gender || 'N/I'}
                </div>
              </div>

              <div>
                <span className="font-semibold text-[#2F3942]">Indicação Clínica:</span>
                <p className="p-2.5 bg-[#F7F6F4] rounded-md border border-[#E3E6E8] text-[#2F3942] mt-1">
                  {viewingClinicalDataExam.clinical_indication || 'Nenhuma indicação informada.'}
                </p>
              </div>

              <div>
                <span className="font-semibold text-[#2F3942]">Sintomas Referidos:</span>
                <p className="p-2.5 bg-[#F7F6F4] rounded-md border border-[#E3E6E8] text-[#2F3942] mt-1">
                  {viewingClinicalDataExam.symptoms || 'Nenhum sintoma informado.'}
                </p>
              </div>

              <div>
                <span className="font-semibold text-[#2F3942]">Medicamentos em Uso:</span>
                <p className="p-2.5 bg-[#F7F6F4] rounded-md border border-[#E3E6E8] text-[#2F3942] mt-1">
                  {viewingClinicalDataExam.medications_in_use || 'Nenhum medicamento informado.'}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="font-semibold text-[#2F3942]">Portador de Marcapasso:</span>
                <Badge variant={viewingClinicalDataExam.has_pacemaker ? 'default' : 'outline'}>
                  {viewingClinicalDataExam.has_pacemaker ? 'SIM' : 'NÃO'}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setViewingClinicalDataExam(null)} className="text-xs">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE DEVOLUÇÃO TÉCNICA */}
      <Dialog
        open={Boolean(returningExam)}
        onOpenChange={(open) => !open && setReturningExam(null)}
      >
        <DialogContent className="max-w-md bg-white border-[#E3E6E8]">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#2F3942] flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>Devolução Técnica de Exame</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F7780]">
              Registrar devolução de exame com justificativa médica/técnica (Diretriz SBC).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <span className="text-[#6F7780]">Paciente:</span>{' '}
              <strong className="text-[#2F3942]">
                {returningExam?.expand?.patient_id?.full_name}
              </strong>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#2F3942]">
                Justificativa da Devolução Técnica *
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Traçado com tremor muscular excessivo em derivações precordiais impossibilitando análise confiável..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full text-xs p-2.5 border border-[#E3E6E8] rounded-md mt-1 focus:border-[#4A90D9] focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              disabled={isReturning}
              onClick={() => setReturningExam(null)}
              className="text-xs border-[#E3E6E8]"
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

      {/* Modal da Bateria de Testes Automatizados */}
      <SecurityTestRunnerModal
        isOpen={isSecurityTestsOpen}
        onClose={() => setIsSecurityTestsOpen(false)}
      />

      <FlexibleEditorTestRunnerModal
        isOpen={isFlexibleEditorTestsOpen}
        onClose={() => setIsFlexibleEditorTestsOpen(false)}
      />

      {/* Modal Bird ID Pro */}
      <BirdIdSigningModal
        isOpen={Boolean(birdIdModalDoc && birdIdModalExam)}
        onClose={() => {
          setBirdIdModalDoc(null)
          setBirdIdModalExam(null)
        }}
        document={birdIdModalDoc}
        examId={birdIdModalExam?.id}
        doctorCrm={doctor?.crm}
        doctorName={user?.name}
        onSignatureUpdated={loadInitialData}
      />
    </div>
  )
}

export default CardiologistDashboard
