import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Users,
  FileText,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'
import { Organization, ExamRequest, Doctor } from '@/types/telelaudos'

interface AdminOverviewSectionProps {
  organizations: Organization[]
  doctors: Doctor[]
  exams: ExamRequest[]
  onNavigateSection: (sectionKey: 'clinics' | 'users' | 'exams' | 'finance' | 'settings') => void
}

export const AdminOverviewSection: React.FC<AdminOverviewSectionProps> = ({
  organizations,
  doctors,
  exams,
  onNavigateSection,
}) => {
  // Contagens objetivas do backend
  const activeClinics = organizations.filter((o) => o.type === 'client' && o.is_active).length
  const totalReceivedExams = exams.length
  const pendingExams = exams.filter(
    (e) => e.status === 'pending' || e.status === 'in_analysis' || e.status === 'waiting_signature',
  ).length
  const completedExams = exams.filter((e) => e.status === 'reported').length

  // Pendências administrativas relevantes:
  // 1. Exames com prazo estourado (atrasados)
  const delayedExams = exams.filter((e) => e.sla_status === 'atrasado' && e.status !== 'reported')
  // 2. Exames próximos do vencimento
  const warningExams = exams.filter(
    (e) => e.sla_status === 'proximo_do_vencimento' && e.status !== 'reported',
  )
  // 3. Exames devolvidos necessitando de contato com a clínica
  const returnedExams = exams.filter((e) => e.status === 'returned')
  // 4. Clínicas inativas cadastradas
  const inactiveClinics = organizations.filter((o) => o.type === 'client' && !o.is_active)

  const hasAdministrativeIssues =
    delayedExams.length > 0 ||
    warningExams.length > 0 ||
    returnedExams.length > 0 ||
    inactiveClinics.length > 0

  return (
    <div className="space-y-5">
      {/* 4 INDICADORES COMPACTOS E OBJETIVOS (conforme requisito do usuário) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-3.5 bg-white border-[#E3E6E8] shadow-2xs">
          <div className="flex items-center justify-between text-[#6F7780] text-xs">
            <span className="font-medium">Clínicas Ativas</span>
            <Building2 className="w-4 h-4 text-[#4A90D9]" />
          </div>
          <div className="text-2xl font-bold text-[#2F3942] mt-1 font-mono">{activeClinics}</div>
          <div className="text-[11px] text-[#6F7780] mt-0.5">
            {organizations.filter((o) => o.type === 'client').length} organizações cadastradas
          </div>
        </Card>

        <Card className="p-3.5 bg-white border-[#E3E6E8] shadow-2xs">
          <div className="flex items-center justify-between text-[#6F7780] text-xs">
            <span className="font-medium">Cardiologistas</span>
            <Users className="w-4 h-4 text-[#4A90D9]" />
          </div>
          <div className="text-2xl font-bold text-[#2F3942] mt-1 font-mono">
            {doctors.filter((d) => d.is_active !== false).length}
          </div>
          <div className="text-[11px] text-[#6F7780] mt-0.5">Corpo clínico credenciado</div>
        </Card>

        <Card className="p-3.5 bg-white border-[#E3E6E8] shadow-2xs">
          <div className="flex items-center justify-between text-[#6F7780] text-xs">
            <span className="font-medium">Exames Recebidos</span>
            <FileText className="w-4 h-4 text-[#4A90D9]" />
          </div>
          <div className="text-2xl font-bold text-[#2F3942] mt-1 font-mono">
            {totalReceivedExams}
          </div>
          <div className="text-[11px] text-[#6F7780] mt-0.5">
            {completedExams} concluídos (
            {totalReceivedExams > 0 ? Math.round((completedExams / totalReceivedExams) * 100) : 0}%)
          </div>
        </Card>

        <Card className="p-3.5 bg-white border-[#E3E6E8] shadow-2xs">
          <div className="flex items-center justify-between text-[#6F7780] text-xs">
            <span className="font-medium">Exames Pendentes</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-[#2F3942] mt-1 font-mono">{pendingExams}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            {delayedExams.length} fora do prazo contratual
          </div>
        </Card>
      </div>

      {/* PENDÊNCIAS QUE EXIGEM ATENÇÃO ADMINISTRATIVA */}
      <Card className="border-[#E3E6E8] bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-[#E3E6E8] bg-[#F7F6F4]/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#4A90D9]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F3942]">
              Pendências que Exigem Atenção Administrativa
            </h3>
          </div>
          <span className="text-[11px] text-[#6F7780]">Monitoramento operacional contínuo</span>
        </div>

        <div className="divide-y divide-[#E3E6E8]">
          {!hasAdministrativeIssues ? (
            <div className="p-6 text-center text-xs text-[#6F7780] flex flex-col items-center justify-center gap-1.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <span className="font-semibold text-[#2F3942]">Operação Regular</span>
              <p className="text-[11px] text-[#8C959E]">
                Nenhum exame atrasado, devolução não tratada ou inconsistência cadastral detectada.
              </p>
            </div>
          ) : (
            <>
              {/* Exames atrasados */}
              {delayedExams.length > 0 && (
                <div className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-[#F7F6F4]/40 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-[#2F3942]">
                        {delayedExams.length}{' '}
                        {delayedExams.length === 1
                          ? 'exame com prazo contratual de SLA estourado'
                          : 'exames com prazo contratual de SLA estourado'}
                      </div>
                      <p className="text-[11px] text-[#6F7780] mt-0.5">
                        Necessita priorização clínica junto ao cardiologista de plantão ou
                        notificação da clínica.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateSection('exams')}
                    className="text-xs h-7 gap-1 border-[#E3E6E8] text-[#2F3942] hover:bg-white shrink-0"
                  >
                    <span>Ver Exames</span>
                    <ArrowRight className="w-3 h-3 text-[#6F7780]" />
                  </Button>
                </div>
              )}

              {/* Exames próximos do vencimento */}
              {warningExams.length > 0 && (
                <div className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-[#F7F6F4]/40 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-[#2F3942]">
                        {warningExams.length}{' '}
                        {warningExams.length === 1
                          ? 'exame próximo do vencimento'
                          : 'exames próximos do vencimento'}{' '}
                        (menos de 30 min)
                      </div>
                      <p className="text-[11px] text-[#6F7780] mt-0.5">
                        Em análise ou aguardando emissão para evitar não conformidade de SLA.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateSection('exams')}
                    className="text-xs h-7 gap-1 border-[#E3E6E8] text-[#2F3942] hover:bg-white shrink-0"
                  >
                    <span>Ver Exames</span>
                    <ArrowRight className="w-3 h-3 text-[#6F7780]" />
                  </Button>
                </div>
              )}

              {/* Exames devolvidos */}
              {returnedExams.length > 0 && (
                <div className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-[#F7F6F4]/40 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-[#2F3942]">
                        {returnedExams.length}{' '}
                        {returnedExams.length === 1
                          ? 'exame devolvido por inconsistência técnica'
                          : 'exames devolvidos por inconsistência técnica'}
                      </div>
                      <p className="text-[11px] text-[#6F7780] mt-0.5">
                        Traçado ilegível ou dados ausentes: exige alinhamento com o operador da
                        clínica.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateSection('exams')}
                    className="text-xs h-7 gap-1 border-[#E3E6E8] text-[#2F3942] hover:bg-white shrink-0"
                  >
                    <span>Ver Devoluções</span>
                    <ArrowRight className="w-3 h-3 text-[#6F7780]" />
                  </Button>
                </div>
              )}

              {/* Clínicas inativas */}
              {inactiveClinics.length > 0 && (
                <div className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-[#F7F6F4]/40 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#6F7780] mt-1.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-[#2F3942]">
                        {inactiveClinics.length}{' '}
                        {inactiveClinics.length === 1
                          ? 'clínica contratante desativada'
                          : 'clínicas contratantes desativadas'}
                      </div>
                      <p className="text-[11px] text-[#6F7780] mt-0.5">
                        Cadastros suspensos administrativamente com recebimento de exames bloqueado.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateSection('clinics')}
                    className="text-xs h-7 gap-1 border-[#E3E6E8] text-[#2F3942] hover:bg-white shrink-0"
                  >
                    <span>Gerenciar Clínicas</span>
                    <ArrowRight className="w-3 h-3 text-[#6F7780]" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
