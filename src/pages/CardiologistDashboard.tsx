import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  examService,
  doctorService,
  organizationService,
  draftService,
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
  Filter,
  Clock,
  AlertCircle,
  FileText,
  UserCheck,
  CheckCircle,
  RotateCcw,
  Search,
  ArrowUpDown,
  Maximize2,
  Calendar,
  Building,
  Heart,
  ChevronRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
  FolderOpen,
  X,
  AlertTriangle,
  PenTool,
} from 'lucide-react'
import EcgViewer from '@/components/EcgViewer'
import ReportEditor from '@/components/ReportEditor'
import SecurityTestRunnerModal from '@/components/SecurityTestRunnerModal'
import NotificationsPopover from '@/components/NotificationsPopover'
import { BirdIdSigningModal } from '@/components/BirdIdSigningModal'

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

  // ETAPA 6A: Modal Conector Bird ID Pro na lista de exames
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
        // Atualizar lista local
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
        // Abrir diretamente no modo de elaboração
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
        // Filtro de Clínica
        if (filterClinic !== 'all' && exam.organization_id !== filterClinic) {
          return false
        }
        // Filtro de Prioridade
        if (filterPriority !== 'all' && exam.urgency !== filterPriority) {
          return false
        }
        // Filtro de Situação
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
        // Busca textual (Paciente, Indicação Clínica, Sintomas)
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
          // Desempate por mais antigo
          return new Date(a.created).getTime() - new Date(b.created).getTime()
        }
        if (sortBy === 'waiting_time') {
          // Mais antigo esperando primeiro
          return new Date(a.created).getTime() - new Date(b.created).getTime()
        }
        // Por data decrescente
        return new Date(b.created).getTime() - new Date(a.created).getTime()
      })
  }, [exams, filterClinic, filterPriority, filterStatus, searchTerm, sortBy, doctor?.id])

  // Badges auxiliares
  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return (
          <Badge className="bg-red-600 hover:bg-red-700 text-white font-bold animate-pulse text-[10px]">
            EMERGÊNCIA
          </Badge>
        )
      case 'urgent':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-[10px]">
            URGENTE
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-slate-600 border-slate-300 text-[10px]">
            ROTINA
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: ExamStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200 text-[10px]">
            NA FILA
          </Badge>
        )
      case 'in_analysis':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 text-[10px]">
            EM ELABORAÇÃO
          </Badge>
        )
      case 'waiting_signature':
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200 text-[10px]">
            AGUARDANDO ASSINATURA
          </Badge>
        )
      case 'returned':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200 text-[10px]">
            DEVOLVIDO TÉCNICO
          </Badge>
        )
      case 'reported':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
            CONCLUÍDO
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

  // Se estiver com exame ativo em tela cheia / lado a lado
  if (activeExam) {
    return (
      <div className="space-y-3 pb-8">
        {/* Barra superior de navegação rápida do exame ativo */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActiveExam(null)
                loadInitialData()
              }}
              className="text-xs gap-1 border-slate-300 text-slate-700"
            >
              <ArrowUpDown className="w-3.5 h-3.5 rotate-90" />
              <span>Voltar à Fila Geral</span>
            </Button>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {activeExam.expand?.patient_id?.full_name || 'Paciente'}
                </span>
                {getUrgencyBadge(activeExam.urgency)}
                {getStatusBadge(activeExam.status)}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>
                  Clínica:{' '}
                  {activeExam.expand?.organization_id?.trade_name ||
                    activeExam.expand?.organization_id?.name}
                </span>
                <span>•</span>
                <span>
                  Data do Exame:{' '}
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
              className="text-xs gap-1 border-slate-300 text-slate-700"
            >
              <FileText className="w-3.5 h-3.5 text-[#0E4C92]" />
              <span>Dados Clínicos da Solicitação</span>
            </Button>
          </div>
        </div>

        {/* Layout LADO A LADO: Visualizador de ECG (Esq) + Editor SBC (Dir) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Lado Esquerdo: Visualizador de ECG Original */}
          <div className="lg:col-span-6 xl:col-span-6 h-[780px] sticky top-4">
            <EcgViewer exam={activeExam} />
          </div>

          {/* Lado Direito: Editor de Laudos Estruturado (SBC 2022) */}
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
      {/* Header do Cardiologista */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0E4C92] to-[#00A6A6] p-5 rounded-xl text-white shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-300" />
            <h1 className="text-xl font-bold tracking-tight">Fila Médica & Central de Laudos</h1>
          </div>
          <p className="text-xs text-sky-100 mt-1">
            Plataforma de Eletrocardiografia Conforme Diretriz SBC 2022 • Laudos Estruturados com
            Preservação Probatória
          </p>
          {doctor && (
            <div className="mt-2 text-xs bg-white/10 px-2.5 py-1 rounded inline-flex items-center gap-2 text-white">
              <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>
                Médico Logado:{' '}
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
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar Fila</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsSecurityTestsOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Executar Testes de Segurança</span>
          </Button>
        </div>
      </div>

      {/* Cartões de Contagem de Exames */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Aguardando na Fila</span>
            <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px]">
              Disponíveis
            </Badge>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {exams.filter((e) => e.status === 'pending').length}
          </div>
        </Card>

        <Card className="border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Em Elaboração</span>
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
              Assumidos
            </Badge>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {exams.filter((e) => e.status === 'in_analysis').length}
          </div>
        </Card>

        <Card className="border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Aguardando Assinatura</span>
            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[10px]">
              Concluídos
            </Badge>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {exams.filter((e) => e.status === 'waiting_signature').length}
          </div>
        </Card>

        <Card className="border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Devolvidos à Clínica</span>
            <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]">
              Problema Técnico
            </Badge>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {exams.filter((e) => e.status === 'returned').length}
          </div>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="border-slate-200 bg-white shadow-sm p-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Busca textual */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <Input
              placeholder="Buscar paciente, indicação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          {/* Filtro de Clínica Solicitante */}
          <div>
            <Select value={filterClinic} onValueChange={setFilterClinic}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Todas as Clínicas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as Clínicas Contratantes
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

          {/* Filtro de Prioridade / Urgência */}
          <div>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Todas as Prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as Prioridades
                </SelectItem>
                <SelectItem value="emergency" className="text-xs text-red-600 font-semibold">
                  🚨 Emergência
                </SelectItem>
                <SelectItem value="urgent" className="text-xs text-amber-600 font-semibold">
                  ⚠️ Urgente
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
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Todas as Situações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as Situações
                </SelectItem>
                <SelectItem value="pending" className="text-xs">
                  Disponíveis (Na Fila)
                </SelectItem>
                <SelectItem value="my_exams" className="text-xs font-semibold text-[#0E4C92]">
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
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority" className="text-xs">
                  Prioridade (Emergência Primeiro)
                </SelectItem>
                <SelectItem value="waiting_time" className="text-xs">
                  Tempo de Espera (Mais Antigos Primeiro)
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
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Traçados de ECG na Fila Médica ({filteredExams.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Atribuição atômica no backend impede conflitos entre cardiologistas
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#0E4C92] mb-2" />
              <span className="text-xs">Carregando fila médica de cardiologia...</span>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="text-center p-10 text-slate-400">
              <FolderOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-medium text-slate-600">
                Nenhum exame encontrado com os filtros selecionados.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Aguarde o envio de novos exames pelas clínicas autorizadas.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {filteredExams.map((exam) => {
                const isAssignedToMe = exam.assigned_doctor_id === doctor?.id
                const isAssignedToOther =
                  exam.assigned_doctor_id && exam.assigned_doctor_id !== doctor?.id

                return (
                  <div
                    key={exam.id}
                    className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    {/* Identificação e Dados Clínicos */}
                    <div className="space-y-1 flex-1 min-w-[260px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {exam.expand?.patient_id?.full_name || 'Paciente Fictício'}
                        </span>
                        {getUrgencyBadge(exam.urgency)}
                        {getStatusBadge(exam.status)}
                        {exam.has_pacemaker && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                            Marcapasso
                          </Badge>
                        )}
                        {/* Indicador de SLA: Próximo do Vencimento ou Atrasado */}
                        {exam.sla_status === 'atrasado' && (
                          <Badge className="bg-red-600 text-white border-red-700 text-[10px] animate-pulse flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>SLA Atrasado</span>
                          </Badge>
                        )}
                        {exam.sla_status === 'proximo_do_vencimento' && (
                          <Badge className="bg-amber-500 text-white border-amber-600 text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Vence em breve</span>
                          </Badge>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-400" />
                          {exam.expand?.organization_id?.trade_name ||
                            exam.expand?.organization_id?.name ||
                            'Clínica'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
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
                                    : 'text-slate-600'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              Prazo Contratual:{' '}
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
                        <div className="text-[11px] text-slate-600 line-clamp-1 italic">
                          <strong className="font-semibold text-slate-700">Indicação:</strong>{' '}
                          {exam.clinical_indication}
                        </div>
                      )}

                      {exam.return_reason && (
                        <div className="text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 mt-1">
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
                        className="h-8 text-xs text-slate-700 hover:bg-slate-100 gap-1 border border-slate-200"
                        title="Ver ficha clínica completa"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>Ficha Clínica</span>
                      </Button>

                      {/* Botão de Assumir ou Abrir Laudo */}
                      {exam.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => handleClaimExam(exam)}
                          disabled={isClaiming === exam.id}
                          className="h-8 text-xs bg-[#0E4C92] hover:bg-[#0c3e77] text-white gap-1 shadow-sm font-semibold"
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
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-sm font-semibold"
                        >
                          <Activity className="w-3.5 h-3.5" />
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
                            className="h-8 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-1 font-semibold"
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
                            className="h-8 text-xs bg-[#0E4C92] hover:bg-[#0c3e77] text-white gap-1 font-semibold shadow-sm"
                            title="Assinar com Bird ID Pro (Soluti CESS)"
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

                      {/* Opção de Devolver com Problema Técnico */}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0E4C92]" />
              <span>Dados Clínicos da Solicitação</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Informações fornecidas pela clínica no envio do traçado
            </DialogDescription>
          </DialogHeader>

          {viewingClinicalDataExam && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="font-semibold text-slate-900">
                  {viewingClinicalDataExam.expand?.patient_id?.full_name}
                </div>
                <div className="text-[11px] text-slate-500">
                  CPF: {viewingClinicalDataExam.expand?.patient_id?.cpf || 'Não informado'} • Sexo:{' '}
                  {viewingClinicalDataExam.expand?.patient_id?.gender || 'N/I'}
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700">Indicação Clínica:</span>
                <p className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-800 mt-1">
                  {viewingClinicalDataExam.clinical_indication || 'Nenhuma indicação informada.'}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-700">Sintomas Referidos:</span>
                <p className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-800 mt-1">
                  {viewingClinicalDataExam.symptoms || 'Nenhum sintoma informado.'}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-700">Medicamentos em Uso:</span>
                <p className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-800 mt-1">
                  {viewingClinicalDataExam.medications_in_use || 'Nenhum medicamento informado.'}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="font-semibold text-slate-700">Portador de Marcapasso:</span>
                <Badge variant={viewingClinicalDataExam.has_pacemaker ? 'default' : 'outline'}>
                  {viewingClinicalDataExam.has_pacemaker ? 'SIM' : 'NÃO'}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setViewingClinicalDataExam(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE DEVOLUÇÃO TÉCNICA PELA FILA */}
      <Dialog
        open={Boolean(returningExam)}
        onOpenChange={(open) => !open && setReturningExam(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>Devolução Técnica de Exame</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Registrar devolução de exame com justificativa médica/técnica (Diretriz SBC).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <span className="text-slate-600">Paciente:</span>{' '}
              <strong className="text-slate-900">
                {returningExam?.expand?.patient_id?.full_name}
              </strong>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-800">
                Justificativa da Devolução Técnica *
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Traçado com tremor muscular excessivo em derivações precordiais impossibilitando análise confiável..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              disabled={isReturning}
              onClick={() => setReturningExam(null)}
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

      {/* Modal Bird ID Pro na fila médica */}
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
