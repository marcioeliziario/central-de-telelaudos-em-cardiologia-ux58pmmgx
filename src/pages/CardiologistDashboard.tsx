import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { examService, doctorService } from '@/services/telelaudosService'
import { ExamRequest, Doctor } from '@/types/telelaudos'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  Lock,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react'
import SecurityTestRunnerModal from '@/components/SecurityTestRunnerModal'

export default function CardiologistDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('queue')
  const [exams, setExams] = useState<ExamRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExam, setSelectedExam] = useState<ExamRequest | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const list = await examService.getAll()
      setExams(list)
    } catch (err) {
      console.error('Erro ao carregar fila de exames:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const queueExams = exams.filter((e) => e.status === 'pending' || e.status === 'in_analysis')
  const reportedExams = exams.filter((e) => e.status === 'reported')

  return (
    <div className="space-y-6">
      {/* Topo do Painel do Cardiologista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 mb-1">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Perfil: Cardiologista Laudador (Prestadora Central)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Fila de Laudos de ECG
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Acesso autorizado às solicitações de todas as clínicas conveniadas à prestadora central.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-900 border-blue-300 py-1 text-xs"
          >
            Corpo Clínico Credenciado
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-slate-200/80 gap-1 text-xs">
          <TabsTrigger value="queue" className="py-2">
            Fila de Exames ({queueExams.length})
          </TabsTrigger>
          <TabsTrigger value="reported" className="py-2">
            Meus Laudos ({reportedExams.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. FILA DE EXAMES */}
        <TabsContent value="queue" className="space-y-4 pt-4">
          <div className="grid md:grid-cols-12 gap-6 items-start">
            {/* Lista da Fila */}
            <div className="md:col-span-7 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>Solicitações Aguardando Laudo</span>
                <span className="text-xs font-normal text-slate-500">
                  {queueExams.length} disponíveis
                </span>
              </h2>

              {queueExams.length === 0 ? (
                <Card className="p-8 text-center text-slate-500 border-dashed">
                  Não há exames pendentes de laudo na fila no momento.
                </Card>
              ) : (
                queueExams.map((ex) => (
                  <Card
                    key={ex.id}
                    onClick={() => setSelectedExam(ex)}
                    className={`p-3.5 cursor-pointer transition-all border ${
                      selectedExam?.id === ex.id
                        ? 'border-[#0E4C92] bg-blue-50/40 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {ex.expand?.patient_id?.full_name || 'Paciente'}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              ex.urgency === 'emergency'
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : ex.urgency === 'urgent'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            {ex.urgency === 'emergency'
                              ? 'Emergência'
                              : ex.urgency === 'urgent'
                                ? 'Urgente'
                                : 'Rotina'}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Clínica:{' '}
                          <span className="font-medium text-slate-700">
                            {ex.expand?.organization_id?.name || '—'}
                          </span>
                          {ex.expand?.unit_id?.name ? ` • Unidade: ${ex.expand.unit_id.name}` : ''}
                        </div>
                        {ex.clinical_indication && (
                          <div className="text-[11px] text-slate-600 mt-1 line-clamp-1 italic">
                            Indicação: "{ex.clinical_indication}"
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-slate-400">
                          {new Date(ex.created).toLocaleDateString('pt-BR')}
                        </div>
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {ex.status === 'pending' ? 'Pendente' : 'Em Análise'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Painel de Detalhes da Solicitação */}
            <div className="md:col-span-5 space-y-4">
              {selectedExam ? (
                <Card className="border-slate-200 shadow-sm bg-white">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileSearch className="w-4 h-4 text-[#00A6A6]" />
                      <span>Detalhes da Solicitação #{selectedExam.id.slice(0, 8)}</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Enviado por {selectedExam.expand?.organization_id?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-700">Paciente:</span>{' '}
                      {selectedExam.expand?.patient_id?.full_name}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Sexo / Nasc:</span>{' '}
                      {selectedExam.expand?.patient_id?.gender} •{' '}
                      {selectedExam.expand?.patient_id?.birth_date
                        ? new Date(selectedExam.expand.patient_id.birth_date).toLocaleDateString(
                            'pt-BR',
                          )
                        : '—'}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Indicação Clínica:</span>{' '}
                      {selectedExam.clinical_indication || 'Não informada'}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Sintomas:</span>{' '}
                      {selectedExam.symptoms || 'Não informados'}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Medicamentos:</span>{' '}
                      {selectedExam.medications_in_use || 'Nenhum informado'}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Marcapasso:</span>{' '}
                      {selectedExam.has_pacemaker ? 'Sim' : 'Não'}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                      <div className="font-semibold text-slate-800 mb-1">
                        Arquivo do Traçado (Protegido):
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 break-all">
                        {selectedExam.exam_file}
                      </div>
                    </div>

                    {/* Aviso de delimitação de escopo da Etapa 1 */}
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs space-y-1 mt-3">
                      <div className="font-bold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Módulo de Emissão de Laudos Indisponível</span>
                      </div>
                      <p>
                        Conforme as diretrizes desta etapa de Fundação: o editor de laudos,
                        templates estruturados, geração de PDF e assinatura digital NÃO estão
                        implementados nesta fase. Nenhuma assinatura simulada será executada.
                      </p>
                    </div>

                    <Button
                      disabled
                      className="w-full bg-slate-200 text-slate-500 font-medium text-xs cursor-not-allowed"
                    >
                      Elaborar Laudo (Em breve na Etapa 2)
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="p-6 text-center text-slate-400 border-dashed">
                  Selecione um exame na lista para visualizar os detalhes clínicos.
                </Card>
              )}
            </div>
          </div>

          <SecurityTestRunnerModal />
        </TabsContent>

        {/* 2. MEUS LAUDOS */}
        <TabsContent value="reported" className="space-y-4 pt-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Histórico de Laudos Emitidos</CardTitle>
              <CardDescription className="text-xs">
                Registros de exames já concluídos pelo corpo clínico
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportedExams.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Nenhum laudo finalizado nesta etapa inicial de testes.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {reportedExams.map((ex) => (
                    <div key={ex.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {ex.expand?.patient_id?.full_name}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {ex.expand?.organization_id?.name}
                        </div>
                      </div>
                      <Badge variant="secondary">Concluído</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
