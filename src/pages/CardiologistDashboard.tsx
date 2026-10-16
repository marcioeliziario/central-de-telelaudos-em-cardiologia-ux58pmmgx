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
} from 'lucide-react'
import EcgViewer from '@/components/EcgViewer'
import ReportEditor from '@/components/ReportEditor'
import SecurityTestRunnerModal from '@/components/SecurityTestRunnerModal'
import { MfaSecurityCard } from '@/components/MfaSecurityCard'
import { DoctorSignatureCard } from '@/components/DoctorSignatureCard'
import NotificationsPopover from '@/components/NotificationsPopover'
import { BirdIdSigningModal } from '@/components/BirdIdSigningModal'
import { MultiProviderSigningCard } from '@/components/MultiProviderSigningCard'
import { BrandLogo } from '@/components/BrandLogo'

export function CardiologistDashboard() {
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

        {/* Lado a Lado: Visualizador de ECG + Editor SBC */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-6 xl:col-span-6 h-[760px] sticky top-20">
            <EcgViewer exam={activeExam} />
          </div>

          <div className="lg:col-span-6 xl:col-span-6">
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
                <strong>
                  Dr(a). {doctor.expand?.user_id?.name || user?.name || 'Carlos Silveira'}
                </strong>{' '}
                • CRM: {doctor.crm}/{doctor.crm_state} • RQE: {doctor.rqe || 'N/I'}
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
            onClick={() => setIsSecurityTestsOpen(true)}
            variant="outline"
            className="border-[#4A90D9]/30 text-[#4A90D9] bg-[#4A90D9]/5 hover:bg-[#4A90D9]/10 text-xs gap-1.5 h-8"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Testes de Segurança</span>
          </Button>
        </div>
      </div>

      {/* Cards de Assinatura e Segurança */}
      <DoctorSignatureCard />
      <MultiProviderSigningCard />
      <MfaSecurityCard />

      {/* Indicadores Numéricos em Cards Pequenos e Organizados */}
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
            <Badge className="bg-sky-50 text-sky-800 border-sky-200 text-[10px]">Elaborados</Badge>
          </div>
          <div className="text-2xl font-bold text-[#2F3942] mt-1">
            {exams.filter((e) => e.status === 'waiting_signature').length}
          </div>
        </Card>

        <Card className="border-[#E3E6E8] bg-white p-3.5 shadow-[0_1px_2px_rgba(47,57,66,0.03)] rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6F7780]">Devolvidos</span>
            <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px]">Técnico</Badge>
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

      {/* Tabela de Exames na Fila */}
      <Card className="border-[#E3E6E8] bg-white shadow-[0_1px_3px_rgba(47,57,66,0.03)] overflow-hidden rounded-xl">
        <CardHeader className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4]/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#2F3942]">
              Traçados de ECG na Fila Médica ({filteredExams.length})
            </CardTitle>
            <CardDescription className="text-xs text-[#6F7780]">
              Atribuição atômica no backend impede conflitos entre cardiologistas
            </CardDescription>
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
            <div className="divide-y divide-[#E3E6E8] text-xs">
              {filteredExams.map((exam) => {
                const isAssignedToMe = exam.assigned_doctor_id === doctor?.id
                const isAssignedToOther =
                  exam.assigned_doctor_id && exam.assigned_doctor_id !== doctor?.id

                return (
                  <div
                    key={exam.id}
                    className="p-3.5 hover:bg-[#F7F6F4]/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    {/* Identificação e Dados Clínicos */}
                    <div className="space-y-1 flex-1 min-w-[260px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#2F3942] text-xs">
                          {exam.expand?.patient_id?.full_name || 'Paciente Fictício'}
                        </span>
                        {getUrgencyBadge(exam.urgency)}
                        {getStatusBadge(exam.status)}
                        {exam.has_pacemaker && (
                          <Badge className="bg-amber-50 text-amber-900 border-amber-200 text-[10px]">
                            Marcapasso
                          </Badge>
                        )}
                        {/* Indicador de SLA */}
                        {exam.sla_status === 'atrasado' && (
                          <Badge className="bg-red-50 text-red-800 border-red-300 text-[10px] flex items-center gap-1 font-semibold">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>SLA Atrasado</span>
                          </Badge>
                        )}
                        {exam.sla_status === 'proximo_do_vencimento' && (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Vence em breve</span>
                          </Badge>
                        )}
                      </div>

                      <div className="text-[11px] text-[#6F7780] flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-[#6F7780]" />
                          {exam.expand?.organization_id?.trade_name ||
                            exam.expand?.organization_id?.name ||
                            'Clínica'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#6F7780]" />
                          Entrada: {new Date(exam.created).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(exam.created).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {exam.deadline_at && (
                          <>
                            <span>•</span>
                            <span
                              className={`flex items-center gap-1 ${
                                exam.sla_status === 'atrasado'
                                  ? 'text-red-700 font-bold'
                                  : exam.sla_status === 'proximo_do_vencimento'
                                    ? 'text-amber-700 font-bold'
                                    : 'text-[#6F7780]'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              Prazo:{' '}
                              {new Date(exam.deadline_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </>
                        )}
                        {exam.assigned_at && (
                          <>
                            <span>•</span>
                            <span className="text-amber-800">
                              Assumido em: {new Date(exam.assigned_at).toLocaleTimeString('pt-BR')}
                            </span>
                          </>
                        )}
                      </div>

                      {exam.clinical_indication && (
                        <div className="text-[11px] text-[#6F7780] line-clamp-1 italic">
                          <strong className="font-semibold text-[#2F3942]">Indicação:</strong>{' '}
                          {exam.clinical_indication}
                        </div>
                      )}

                      {exam.return_reason && (
                        <div className="text-[11px] text-red-800 bg-red-50 p-1.5 rounded-md border border-red-200 mt-1">
                          <strong>Motivo da Devolução:</strong> {exam.return_reason}
                        </div>
                      )}
                    </div>

                    {/* Ações da Fila Médica */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewingClinicalDataExam(exam)}
                        className="h-8 text-xs text-[#2F3942] hover:bg-[#F7F6F4] gap-1 border border-[#E3E6E8]"
                        title="Ver ficha clínica completa"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#6F7780]" />
                        <span>Ficha Clínica</span>
                      </Button>

                      {exam.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => handleClaimExam(exam)}
                          disabled={isClaiming === exam.id}
                          className="h-8 text-xs bg-[#4A90D9] hover:bg-[#3b7dc2] text-white gap-1 shadow-xs font-semibold"
                        >
                          {isClaiming === exam.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Assumindo...</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Assumir Exame</span>
                            </>
                          )}
                        </Button>
                      )}

                      {exam.status === 'in_analysis' && isAssignedToMe && (
                        <Button
                          size="sm"
                          onClick={() => setActiveExam(exam)}
                          className="h-8 text-xs bg-[#2F3942] hover:bg-[#1f262c] text-white gap-1 shadow-xs font-semibold"
                        >
                          <Activity className="w-3.5 h-3.5 text-[#4A90D9]" />
                          <span>Continuar Laudo</span>
                        </Button>
                      )}

                      {exam.status === 'in_analysis' && isAssignedToOther && (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] px-2 py-1"
                        >
                          Assumido por outro médico
                        </Badge>
                      )}

                      {exam.status === 'waiting_signature' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveExam(exam)}
                            className="h-8 text-xs border-[#4A90D9]/40 text-[#4A90D9] hover:bg-[#4A90D9]/5 gap-1 font-semibold"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Revisar Laudo</span>
                          </Button>

                          <Button
                            size="sm"
                            onClick={async () => {
                              setIsOpeningBirdIdModal(exam.id)
                              try {
                                const docs = await documentService.getDocumentsForExam(exam.id)
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
                            className="h-8 text-xs bg-[#4A90D9] hover:bg-[#3b7dc2] text-white gap-1 font-semibold shadow-xs"
                            title="Assinar com Bird ID Pro"
                          >
                            {isOpeningBirdIdModal === exam.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PenTool className="w-3.5 h-3.5" />
                            )}
                            <span>Assinar Bird ID</span>
                          </Button>
                        </>
                      )}

                      {exam.status !== 'returned' && exam.status !== 'reported' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReturningExam(exam)
                            setReturnReason('')
                          }}
                          className="h-8 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200"
                          title="Devolver exame à clínica com problema técnico"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span className="hidden sm:inline">Devolver</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
