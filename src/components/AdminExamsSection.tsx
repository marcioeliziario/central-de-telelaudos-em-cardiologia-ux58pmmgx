import React, { useState } from 'react'
import { ExamRequest, Organization } from '@/types/telelaudos'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  FileText,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  User,
  ShieldAlert,
  Eye,
  FileCheck2,
  ExternalLink,
  Download,
} from 'lucide-react'
import { documentService } from '@/services/telelaudosService'

interface AdminExamsSectionProps {
  exams: ExamRequest[]
  organizations: Organization[]
  onRefreshData?: () => void
}

export const AdminExamsSection: React.FC<AdminExamsSectionProps> = ({ exams, organizations }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all')
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('')

  // Modal de Detalhes Administrativos / Histórico do Exame
  const [selectedExam, setSelectedExam] = useState<ExamRequest | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [examDocuments, setExamDocuments] = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  // Status labels amigáveis
  const getStatusBadge = (status: ExamRequest['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]"
          >
            Aguardando Análise
          </Badge>
        )
      case 'in_analysis':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300 text-[10px]">
            Em Análise
          </Badge>
        )
      case 'waiting_signature':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-900 border-amber-300 text-[10px]"
          >
            Aguardando Assinatura
          </Badge>
        )
      case 'reported':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-medium">
            Laudo Concluído
          </Badge>
        )
      case 'returned':
        return (
          <Badge className="bg-purple-50 text-purple-800 border-purple-300 text-[10px]">
            Devolvido
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-300 text-[10px]">Cancelado</Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {status}
          </Badge>
        )
    }
  }

  // Filtragem
  const filteredExams = exams.filter((ex) => {
    if (selectedOrgFilter !== 'all' && ex.organization_id !== selectedOrgFilter) return false
    if (selectedStatusFilter !== 'all' && ex.status !== selectedStatusFilter) return false
    if (selectedUrgencyFilter !== 'all' && ex.urgency !== selectedUrgencyFilter) return false
    if (dateFilter) {
      const createdDate = ex.created ? ex.created.split('T')[0] : ''
      if (createdDate !== dateFilter) return false
    }
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const patientName = ex.expand?.patient_id?.full_name?.toLowerCase() || ''
    const orgName = ex.expand?.organization_id?.name?.toLowerCase() || ''
    const docName = ex.expand?.assigned_doctor_id?.expand?.user_id?.name?.toLowerCase() || ''
    return (
      patientName.includes(term) ||
      orgName.includes(term) ||
      docName.includes(term) ||
      ex.id.includes(term)
    )
  })

  const handleOpenDetails = async (exam: ExamRequest) => {
    setSelectedExam(exam)
    setIsDetailsModalOpen(true)
    setLoadingDocs(true)
    try {
      const docs = await documentService.getDocumentsForExam(exam.id)
      setExamDocuments(docs)
    } catch {
      setExamDocuments([])
    } finally {
      setLoadingDocs(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo e Alerta Administrativo de Escopo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-white border border-[#E3E6E8] text-xs">
        <div className="flex items-center gap-2 text-[#2F3942]">
          <FileText className="w-4 h-4 text-[#4A90D9]" />
          <span className="font-semibold">
            Consulta Administrativa de Solicitações ({filteredExams.length} de {exams.length})
          </span>
        </div>
        <div className="text-[11px] text-[#6F7780] flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>
            Gestão operacional e acompanhamento. Emissão e assinatura clínica são exclusivas de
            cardiologistas credenciados.
          </span>
        </div>
      </div>

      {/* Barra de Filtros Multifatoriais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 bg-white p-3 rounded-lg border border-[#E3E6E8]">
        {/* Busca textual */}
        <div className="lg:col-span-2 relative">
          <Label className="text-[11px] font-semibold text-[#6F7780] block mb-1">
            Buscar paciente ou ID
          </Label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6F7780]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome do paciente, clínica ou ID do exame..."
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        {/* Filtro de Clínica */}
        <div>
          <Label className="text-[11px] font-semibold text-[#6F7780] block mb-1">Clínica</Label>
          <select
            value={selectedOrgFilter}
            onChange={(e) => setSelectedOrgFilter(e.target.value)}
            className="w-full h-8 px-2.5 border border-[#E3E6E8] rounded-md text-xs bg-white text-[#2F3942]"
          >
            <option value="all">Todas as Clínicas</option>
            {organizations
              .filter((o) => o.type === 'client')
              .map((org) => (
                <option key={org.id} value={org.id}>
                  {org.trade_name || org.name}
                </option>
              ))}
          </select>
        </div>

        {/* Filtro de Situação */}
        <div>
          <Label className="text-[11px] font-semibold text-[#6F7780] block mb-1">Situação</Label>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="w-full h-8 px-2.5 border border-[#E3E6E8] rounded-md text-xs bg-white text-[#2F3942]"
          >
            <option value="all">Todas as Situações</option>
            <option value="pending">Aguardando Análise</option>
            <option value="in_analysis">Em Análise</option>
            <option value="waiting_signature">Aguardando Assinatura</option>
            <option value="reported">Laudo Concluído</option>
            <option value="returned">Devolvido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        {/* Filtro de Prioridade / Data */}
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <Label className="text-[11px] font-semibold text-[#6F7780] block mb-1">
              Prioridade
            </Label>
            <select
              value={selectedUrgencyFilter}
              onChange={(e) => setSelectedUrgencyFilter(e.target.value)}
              className="w-full h-8 px-2 border border-[#E3E6E8] rounded-md text-xs bg-white text-[#2F3942]"
            >
              <option value="all">Todas</option>
              <option value="routine">Rotina</option>
              <option value="urgent">Prioritário</option>
            </select>
          </div>
          <div>
            <Label className="text-[11px] font-semibold text-[#6F7780] block mb-1">Data</Label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs h-8 px-1.5"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Exames */}
      <Card className="border-[#E3E6E8] bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F6F4] border-b border-[#E3E6E8] text-[#2F3942] font-semibold">
              <tr>
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Paciente</th>
                <th className="p-3">Clínica Solicitante</th>
                <th className="p-3">Prioridade & Prazo</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Cardiologista Responsável</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E6E8]/60">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#6F7780]">
                    Nenhuma solicitação de ECG encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredExams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-[#F7F6F4]/50 transition-colors">
                    <td className="p-3 text-[#6F7780]">
                      <div className="font-mono text-[11px]">
                        {new Date(ex.created).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-[10px] text-[#8C959E]">
                        {new Date(ex.created).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-[#2F3942]">
                        {ex.expand?.patient_id?.full_name || 'Paciente'}
                      </div>
                      <div className="text-[11px] text-[#6F7780]">
                        ID: <span className="font-mono">{ex.id}</span>
                      </div>
                    </td>
                    <td className="p-3 text-[#2F3942]">
                      <div>
                        {ex.expand?.organization_id?.trade_name ||
                          ex.expand?.organization_id?.name ||
                          '—'}
                      </div>
                      {ex.expand?.unit_id?.name && (
                        <div className="text-[10px] text-[#6F7780]">{ex.expand?.unit_id?.name}</div>
                      )}
                    </td>
                    <td className="p-3 space-y-1">
                      <div>
                        <Badge
                          variant="outline"
                          className={
                            ex.urgency === 'urgent'
                              ? 'bg-amber-50 text-amber-900 border-amber-300 text-[10px]'
                              : 'bg-slate-100 text-slate-700 text-[10px]'
                          }
                        >
                          {ex.urgency === 'urgent' ? 'Prioritário (2h)' : 'Rotina (24h)'}
                        </Badge>
                      </div>
                      {ex.sla_status === 'atrasado' && (
                        <Badge className="bg-rose-600 text-white text-[9px] px-1.5 py-0">
                          Atrasado
                        </Badge>
                      )}
                      {ex.sla_status === 'proximo_do_vencimento' && (
                        <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0">
                          Vence em breve
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">{getStatusBadge(ex.status)}</td>
                    <td className="p-3 text-[#6F7780]">
                      {ex.expand?.assigned_doctor_id?.expand?.user_id?.name ||
                        (ex.assigned_doctor_id ? 'Cardiologista atribuído' : '—')}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDetails(ex)}
                        className="h-7 px-2.5 text-[11px] border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4]"
                        title="Consultar histórico e documentos"
                      >
                        <Eye className="w-3 h-3 mr-1 text-[#6F7780]" />
                        <span>Detalhes</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* DIALOG DE DETALHES ADMINISTRATIVOS DO EXAME */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-2xl text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#2F3942] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4A90D9]" />
              <span>Acompanhamento da Solicitação de ECG — {selectedExam?.id}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6F7780]">
              Consulta administrativa de dados clínicos informados, arquivos anexados e versões
              documentais.
            </DialogDescription>
          </DialogHeader>

          {selectedExam && (
            <div className="space-y-4 pt-2">
              {/* Resumo de identificação */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F7F6F4] p-3 rounded-lg border border-[#E3E6E8]">
                <div>
                  <span className="text-[10px] text-[#6F7780] block">Paciente</span>
                  <span className="font-semibold text-[#2F3942]">
                    {selectedExam.expand?.patient_id?.full_name || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6F7780] block">Clínica</span>
                  <span className="font-semibold text-[#2F3942]">
                    {selectedExam.expand?.organization_id?.name || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6F7780] block">Situação</span>
                  <span className="font-semibold text-[#2F3942]">
                    {getStatusBadge(selectedExam.status)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6F7780] block">Data Solicitação</span>
                  <span className="font-semibold text-[#2F3942]">
                    {new Date(selectedExam.created).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Informações clínicas registradas */}
              <div className="space-y-2 border border-[#E3E6E8] rounded-lg p-3 bg-white">
                <span className="font-bold text-[#2F3942] text-xs block">
                  Dados Clínicos Declarados
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-[#6F7780] block">Indicação Clínica:</span>
                    <p className="text-[#2F3942]">
                      {selectedExam.clinical_indication || 'Não informada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#6F7780] block">Sintomas:</span>
                    <p className="text-[#2F3942]">{selectedExam.symptoms || 'Não informados'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#6F7780] block">Medicações em Uso:</span>
                    <p className="text-[#2F3942]">
                      {selectedExam.medications_in_use || 'Nenhuma informada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#6F7780] block">
                      Portador de Marcapasso:
                    </span>
                    <p className="text-[#2F3942]">{selectedExam.has_pacemaker ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
              </div>

              {/* Documentos e Laudos Médicos Versionados */}
              <div className="space-y-2 border border-[#E3E6E8] rounded-lg p-3 bg-white">
                <span className="font-bold text-[#2F3942] text-xs block">
                  Documentos & Histórico de Laudos Versionados
                </span>
                {loadingDocs ? (
                  <p className="text-xs text-[#6F7780] py-2">Consultando documentos gerados...</p>
                ) : examDocuments.length === 0 ? (
                  <p className="text-xs text-[#6F7780] py-2">
                    Nenhum documento formal de laudo emitido ainda para esta solicitação.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {examDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 rounded border border-[#E3E6E8] bg-[#F7F6F4] text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[#2F3942] flex items-center gap-1.5">
                            <FileCheck2 className="w-3.5 h-3.5 text-[#4A90D9]" />
                            <span>
                              Versão {doc.version} — Código: {doc.document_code}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#6F7780] font-mono">
                            SHA-256:{' '}
                            {doc.file_hash_sha256
                              ? `${doc.file_hash_sha256.substring(0, 24)}...`
                              : 'Pendente'}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            doc.is_clinically_released
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]'
                              : 'bg-amber-50 text-amber-800 border-amber-300 text-[10px]'
                          }
                        >
                          {doc.is_clinically_released ? 'Liberado Clinicamente' : 'Em Elaboração'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDetailsModalOpen(false)}
              className="text-xs h-8"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
