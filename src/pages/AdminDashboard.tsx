import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  organizationService,
  unitService,
  doctorService,
  userOrgService,
  examService,
  patientService,
  auditService,
  slaService,
} from '@/services/telelaudosService'
import {
  Organization,
  Unit,
  Doctor,
  ExamRequest,
  Patient,
  UserOrganization,
  AuditLog,
} from '@/types/telelaudos'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Building2,
  Users,
  Stethoscope,
  FileText,
  Settings,
  ShieldAlert,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Activity,
  RotateCcw,
} from 'lucide-react'
import SecurityTestRunnerModal from '@/components/SecurityTestRunnerModal'
import NotificationsPopover from '@/components/NotificationsPopover'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([])
  const [exams, setExams] = useState<ExamRequest[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [contractSlas, setContractSlas] = useState<any[]>([])
  const [isRefreshingSla, setIsRefreshingSla] = useState(false)
  const [loading, setLoading] = useState(true)

  // Estados de formulários simples para criar clínica/unidade/médico
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgCnpj, setNewOrgCnpj] = useState('')
  const [newOrgCity, setNewOrgCity] = useState('')
  const [newOrgState, setNewOrgState] = useState('SP')
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [orgs, unts, docs, uos, exms, pts, logs, slas] = await Promise.all([
        organizationService.getAll().catch(() => []),
        unitService.getAll().catch(() => []),
        doctorService.getAll().catch(() => []),
        userOrgService.getAll().catch(() => []),
        examService.getAll().catch(() => []),
        patientService.getAll().catch(() => []),
        auditService.getRecent(30).catch(() => []),
        slaService.getAll().catch(() => []),
      ])
      setOrganizations(orgs)
      setUnits(unts)
      setDoctors(docs)
      setUserOrgs(uos)
      setExams(exms)
      setPatients(pts)
      setAuditLogs(logs)
      setContractSlas(slas)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshSla = async () => {
    setIsRefreshingSla(true)
    try {
      const res = await slaService.refreshSlaStatus()
      await loadData()
      alert(
        `SLA atualizado com sucesso! ${res.totalEvaluated} exames avaliados, ${res.nearWarningCount} próximos do vencimento, ${res.overdueCount} atrasados.`,
      )
    } catch (err: any) {
      alert(`Erro ao reavaliar SLA: ${err.message}`)
    } finally {
      setIsRefreshingSla(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName || !newOrgCnpj) return
    try {
      await organizationService.create({
        name: newOrgName,
        cnpj: newOrgCnpj,
        city: newOrgCity,
        state: newOrgState,
        type: 'client',
        is_active: true,
      })
      setIsOrgDialogOpen(false)
      setNewOrgName('')
      setNewOrgCnpj('')
      setNewOrgCity('')
      loadData()
    } catch (err: any) {
      alert(`Erro ao cadastrar organização: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Painel Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-[#0E4C92] mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Perfil: Administrador Geral (Prestadora Central)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Painel de Gestão da Central
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Controle de organizações prestadoras e contratantes, unidades, corpo clínico, usuários e
            segurança.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NotificationsPopover role="admin" />
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-900 border-emerald-300 py-1 text-xs"
          >
            Etapa 5 — SLA & Notificações Ativos
          </Badge>
        </div>
      </div>

      {/* Tabs de Navegação do Administrador */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-8 w-full h-auto p-1 bg-slate-200/80 gap-1 text-xs">
          <TabsTrigger value="overview" className="py-2">
            Geral
          </TabsTrigger>
          <TabsTrigger value="sla" className="py-2 font-bold text-[#0E4C92]">
            Contratos SLA
          </TabsTrigger>
          <TabsTrigger value="clinics" className="py-2">
            Clínicas
          </TabsTrigger>
          <TabsTrigger value="units" className="py-2">
            Unidades
          </TabsTrigger>
          <TabsTrigger value="doctors" className="py-2">
            Médicos
          </TabsTrigger>
          <TabsTrigger value="users" className="py-2">
            Usuários
          </TabsTrigger>
          <TabsTrigger value="exams" className="py-2">
            Exames ({exams.length})
          </TabsTrigger>
          <TabsTrigger value="audit" className="py-2">
            Auditoria
          </TabsTrigger>
        </TabsList>

        {/* TAB DE CONTRATOS & CONTROLE DE PRAZOS (SLA) */}
        <TabsContent value="sla" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#0E4C92]" />
                <span>Gestão de Contratos de SLA & Controle de Prazos</span>
              </h2>
              <p className="text-xs text-slate-600">
                Prazos configuráveis por contrato e prioridade. Parâmetros homologados: Rotina: 24h
                • Prioritário: 2h.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleRefreshSla}
              disabled={isRefreshingSla}
              className="bg-[#0E4C92] hover:bg-[#0c3e77] text-white text-xs gap-1.5 h-8"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRefreshingSla ? 'animate-spin' : ''}`} />
              <span>
                {isRefreshingSla ? 'Reavaliando Prazos...' : 'Reavaliar Prazos no Servidor'}
              </span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-3.5 bg-white border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Exames no Prazo</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {
                  exams.filter(
                    (e) =>
                      e.sla_status === 'no_prazo' || (!e.sla_status && e.status !== 'reported'),
                  ).length
                }
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Dentro do prazo contratual</div>
            </Card>

            <Card className="p-3.5 bg-white border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Próximos do Vencimento</span>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {exams.filter((e) => e.sla_status === 'proximo_do_vencimento').length}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Menos de 30 min para expirar</div>
            </Card>

            <Card className="p-3.5 bg-white border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Exames Atrasados</span>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {exams.filter((e) => e.sla_status === 'atrasado').length}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Prazo contratual estourado</div>
            </Card>
          </div>

          <Card className="border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Contrato / Clínica</th>
                    <th className="p-3">Prazo Rotina</th>
                    <th className="p-3">Prazo Prioritário</th>
                    <th className="p-3">Emergência com Prazo Garantido</th>
                    <th className="p-3">Horário de Atendimento</th>
                    <th className="p-3">Alerta de Proximidade</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contractSlas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        Nenhum contrato cadastrado.
                      </td>
                    </tr>
                  ) : (
                    contractSlas.map((sla) => (
                      <tr key={sla.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{sla.contract_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {sla.expand?.organization_id?.name}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800">
                          {sla.routine_sla_hours} horas
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-700">
                          {sla.urgent_sla_hours} horas
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className="text-[10px] text-slate-500 bg-slate-50 border-slate-300"
                          >
                            Desabilitada (Etapa 5)
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-600">
                          {sla.business_hours_start || '08:00'} às{' '}
                          {sla.business_hours_end || '18:00'}
                          {sla.operates_on_weekends ? ' (Sáb/Dom)' : ' (Seg-Sex)'}
                        </td>
                        <td className="p-3 text-slate-600 font-mono">
                          {sla.warning_threshold_minutes || 30} min antes
                        </td>
                        <td className="p-3">
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                            Ativo
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 1. VISÃO GERAL */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Clínicas Contratantes</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {organizations.filter((o) => o.type === 'client').length}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Organizações ativas</div>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Unidades Físicas</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{units.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Postos de coleta de ECG</div>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Cardiologistas</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{doctors.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Corpo clínico credenciado</div>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Total de Exames</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{exams.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Solicitações na plataforma</div>
            </Card>
          </div>

          {/* Validação de Segurança e Isolamento ao vivo */}
          <SecurityTestRunnerModal />
        </TabsContent>

        {/* 2. CLÍNICAS */}
        <TabsContent value="clinics" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Organizações Cadastradas</h2>
              <p className="text-xs text-slate-600">
                Empresas contratantes e prestadoras de telelaudos
              </p>
            </div>

            <Dialog open={isOrgDialogOpen} onOpenChange={setIsOrgDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-[#0E4C92] text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nova Clínica
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold">
                    Cadastrar Nova Clínica Contratante
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateOrg} className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs">Razão Social / Nome</Label>
                    <Input
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Ex: Policlínica Cardiocenter"
                      required
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">CNPJ</Label>
                    <Input
                      value={newOrgCnpj}
                      onChange={(e) => setNewOrgCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      required
                      className="text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        value={newOrgCity}
                        onChange={(e) => setNewOrgCity(e.target.value)}
                        placeholder="Cidade"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Estado</Label>
                      <Input
                        value={newOrgState}
                        onChange={(e) => setNewOrgState(e.target.value)}
                        maxLength={2}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <DialogFooter className="pt-2">
                    <Button type="submit" size="sm" className="bg-[#0E4C92] text-xs">
                      Salvar Cadastro
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Nome / Razão Social</th>
                    <th className="p-3">CNPJ</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Cidade / UF</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">
                        {org.name}
                        {org.trade_name && (
                          <div className="text-[11px] text-slate-400 font-normal">
                            {org.trade_name}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{org.cnpj}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            org.type === 'provider'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-slate-100 text-slate-700'
                          }
                        >
                          {org.type === 'provider' ? 'Prestadora Central' : 'Clínica Contratante'}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600">
                        {org.city ? `${org.city}/${org.state}` : '—'}
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                          Ativa
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 3. UNIDADES */}
        <TabsContent value="units" className="space-y-4 pt-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Unidades Físicas das Clínicas</h2>
            <p className="text-xs text-slate-600">
              Cada unidade pertence a uma clínica contratante
            </p>
          </div>
          <Card className="border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Unidade</th>
                    <th className="p-3">Código / CNES</th>
                    <th className="p-3">Clínica Pertencente</th>
                    <th className="p-3">Endereço / Cidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">{unit.name}</td>
                      <td className="p-3 font-mono text-slate-600">
                        {unit.code || '—'} {unit.cnes ? `(CNES: ${unit.cnes})` : ''}
                      </td>
                      <td className="p-3 text-slate-800">
                        {unit.expand?.organization_id?.name || '—'}
                      </td>
                      <td className="p-3 text-slate-600">
                        {unit.address
                          ? `${unit.address}, ${unit.city}/${unit.state}`
                          : `${unit.city || '—'}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 4. MÉDICOS */}
        <TabsContent value="doctors" className="space-y-4 pt-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Corpo Clínico (Cardiologistas)</h2>
            <p className="text-xs text-slate-600">
              Médicos vinculados à organização prestadora com CRM e RQE
            </p>
          </div>
          <Card className="border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Médico</th>
                    <th className="p-3">CRM / UF</th>
                    <th className="p-3">RQE</th>
                    <th className="p-3">Especialidade</th>
                    <th className="p-3">Organização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctors.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">
                        {doc.expand?.user_id?.name || 'Médico Cadastrado'}
                        <div className="text-[11px] text-slate-400 font-normal">
                          {doc.expand?.user_id?.email}
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {doc.crm}-{doc.crm_state}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{doc.rqe || '—'}</td>
                      <td className="p-3 text-slate-700">{doc.specialty || 'Cardiologia'}</td>
                      <td className="p-3 text-slate-600">
                        {doc.expand?.organization_id?.name || 'Prestadora Central'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 5. USUÁRIOS E PERFIS */}
        <TabsContent value="users" className="space-y-4 pt-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Vínculos de Usuários & Perfis (user_organizations)
            </h2>
            <p className="text-xs text-slate-600">
              Mapeamento de papéis de acesso: Administrador, Gestor, Operador, Cardiologista
            </p>
          </div>
          <Card className="border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">Organização Vinculada</th>
                    <th className="p-3">Perfil Atribuído</th>
                    <th className="p-3">Cargo / Função</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userOrgs.map((uo) => (
                    <tr key={uo.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">
                        {uo.expand?.user_id?.name || 'Usuário'}
                        <div className="text-[11px] text-slate-400 font-normal">
                          {uo.expand?.user_id?.email}
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {uo.expand?.organization_id?.name || '—'}
                      </td>
                      <td className="p-3">
                        <Badge className="text-[10px]" variant="secondary">
                          {uo.role === 'admin' && 'Administrador Geral'}
                          {uo.role === 'clinic_manager' && 'Gestor da Clínica'}
                          {uo.role === 'clinic_operator' && 'Operador da Clínica'}
                          {uo.role === 'cardiologist' && 'Cardiologista Laudador'}
                          {uo.role === 'financial' && 'Financeiro (Inativo)'}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-500">{uo.title_position || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 6. EXAMES */}
        <TabsContent value="exams" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Todas as Solicitações de ECG</h2>
              <p className="text-xs text-slate-600">Visão global administrativa dos exames</p>
            </div>
            <div className="p-2 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>
                O perfil administrativo gerencia clientes e exames, mas NÃO autoriza elaborar ou
                assinar laudos médicos.
              </span>
            </div>
          </div>
          <Card className="border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">Clínica Solicitante</th>
                    <th className="p-3">Urgência & Prazo SLA</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exams.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        Nenhum exame enviado ainda.
                      </td>
                    </tr>
                  ) : (
                    exams.map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-slate-500">
                          {new Date(ex.created).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          {ex.expand?.patient_id?.full_name || 'Paciente'}
                        </td>
                        <td className="p-3 text-slate-700">
                          {ex.expand?.organization_id?.name || '—'}
                        </td>
                        <td className="p-3 space-y-1">
                          <Badge
                            variant="outline"
                            className={
                              ex.urgency === 'urgent'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-slate-50'
                            }
                          >
                            {ex.urgency === 'urgent' ? 'Prioritário (2h)' : 'Rotina (24h)'}
                          </Badge>
                          {ex.sla_status === 'atrasado' && (
                            <Badge className="bg-red-600 text-white text-[10px] ml-1">
                              Atrasado
                            </Badge>
                          )}
                          {ex.sla_status === 'proximo_do_vencimento' && (
                            <Badge className="bg-amber-500 text-white text-[10px] ml-1">
                              Vence em breve
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">{ex.status}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 7. AUDITORIA */}
        <TabsContent value="audit" className="space-y-4 pt-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Trilha de Auditoria (audit_logs)</h2>
            <p className="text-xs text-slate-600">
              Registros imutáveis gerados pelo backend para operações críticas
            </p>
          </div>
          <Card className="border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Ação</th>
                    <th className="p-3">Coleção</th>
                    <th className="p-3">Detalhes</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-500">
                        {new Date(log.created).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3 font-bold text-slate-800">{log.action}</td>
                      <td className="p-3 text-slate-600">{log.target_collection}</td>
                      <td className="p-3 text-slate-700 font-sans text-xs">{log.details}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]"
                        >
                          {log.status || 'SUCCESS'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
