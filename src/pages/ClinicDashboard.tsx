import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { patientService, unitService, examService } from '@/services/telelaudosService'
import { Patient, Unit, ExamRequest } from '@/types/telelaudos'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Building2,
  Users,
  UploadCloud,
  FileText,
  AlertCircle,
  Plus,
  CheckCircle2,
  ShieldCheck,
  Lock,
  FileCheck2,
} from 'lucide-react'
import SecurityTestRunnerModal from '@/components/SecurityTestRunnerModal'
import ResultsPortal from '@/components/ResultsPortal'
import NotificationsPopover from '@/components/NotificationsPopover'

export default function ClinicDashboard() {
  const { currentOrg, currentRole, user } = useAuth()
  const [activeTab, setActiveTab] = useState('portal')
  const [patients, setPatients] = useState<Patient[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [myExams, setMyExams] = useState<ExamRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Formulário de Paciente
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [patientBirth, setPatientBirth] = useState('1985-05-12')
  const [patientGender, setPatientGender] = useState<'M' | 'F' | 'other'>('M')
  const [patientCpf, setPatientCpf] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [patientNotes, setPatientNotes] = useState('')

  // Formulário de Envio de ECG
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine')
  const [clinicalIndication, setClinicalIndication] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [meds, setMeds] = useState('')
  const [hasPacemaker, setHasPacemaker] = useState(false)
  const [examFile, setExamFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const loadClinicData = async () => {
    if (!currentOrg) return
    setLoading(true)
    try {
      const [pts, unts, exms] = await Promise.all([
        patientService.getAll(currentOrg.id),
        unitService.getAll(currentOrg.id),
        examService.getAll(`organization_id = '${currentOrg.id}'`),
      ])
      setPatients(pts)
      setUnits(unts)
      setMyExams(exms)
      if (pts.length > 0 && !selectedPatientId) {
        setSelectedPatientId(pts[0].id)
      }
      if (unts.length > 0 && !selectedUnitId) {
        setSelectedUnitId(unts[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar dados da clínica:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClinicData()
  }, [currentOrg])

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrg) return
    try {
      await patientService.create({
        organization_id: currentOrg.id,
        full_name: patientName,
        birth_date: patientBirth,
        gender: patientGender,
        cpf: patientCpf,
        phone: patientPhone,
        clinical_notes: patientNotes,
      })
      setIsPatientModalOpen(false)
      setPatientName('')
      setPatientCpf('')
      setPatientPhone('')
      setPatientNotes('')
      loadClinicData()
    } catch (err: any) {
      alert(`Erro ao cadastrar paciente: ${err.message}`)
    }
  }

  const handleUploadExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrg || !user || !selectedPatientId || !examFile) {
      alert('Selecione o paciente e o arquivo do ECG.')
      return
    }

    setIsUploading(true)
    setUploadSuccess(false)

    try {
      const formData = new FormData()
      formData.append('organization_id', currentOrg.id)
      if (selectedUnitId) formData.append('unit_id', selectedUnitId)
      formData.append('patient_id', selectedPatientId)
      formData.append('requested_by', user.id)
      formData.append('status', 'pending')
      formData.append('urgency', urgency)
      formData.append('exam_file', examFile)
      formData.append('clinical_indication', clinicalIndication)
      formData.append('symptoms', symptoms)
      formData.append('medications_in_use', meds)
      formData.append('has_pacemaker', String(hasPacemaker))
      formData.append('exam_date', new Date().toISOString())

      await examService.create(formData)
      setUploadSuccess(true)
      setClinicalIndication('')
      setSymptoms('')
      setMeds('')
      setExamFile(null)
      loadClinicData()
      setActiveTab('exams')
    } catch (err: any) {
      alert(`Erro ao enviar exame: ${err.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Topo do Painel da Clínica */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-[#0E4C92] mb-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>
              Perfil:{' '}
              {currentRole === 'clinic_manager' ? 'Gestor da Clínica' : 'Operador da Clínica'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {currentOrg?.name || 'Painel da Clínica Contratante'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            CNPJ: {currentOrg?.cnpj} • Ambiente Isolado: seus dados não são visíveis para outras
            clínicas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NotificationsPopover orgId={currentOrg?.id} role={currentRole || undefined} />
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-800 border-emerald-300 py-1 text-xs gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Multi-tenant Isolado</span>
          </Badge>
        </div>
      </div>

      {/* Tabs da Clínica com Portal de Resultados na vanguarda */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1 bg-slate-200/80 gap-1 text-xs">
          <TabsTrigger
            value="portal"
            className="py-2 flex items-center justify-center gap-1.5 font-bold"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-[#0E4C92]" />
            <span>Portal de Resultados</span>
          </TabsTrigger>
          <TabsTrigger value="overview" className="py-2">
            Painel Geral
          </TabsTrigger>
          <TabsTrigger value="patients" className="py-2">
            Pacientes ({patients.length})
          </TabsTrigger>
          <TabsTrigger value="upload" className="py-2">
            Enviar ECG
          </TabsTrigger>
          <TabsTrigger value="exams" className="py-2">
            Histórico Simples ({myExams.length})
          </TabsTrigger>
        </TabsList>

        {/* 0. PORTAL DE RESULTADOS (ETAPA 5) */}
        <TabsContent value="portal" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#0E4C92]" />
                <span>Portal de Resultados & Laudos Clínicos</span>
              </h2>
              <p className="text-xs text-slate-600">
                Consulta completa com filtros por período, paciente e situação. Download auditado
                exclusivo para laudos com assinatura PAdES validada.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadClinicData}
              className="text-xs h-8 border-slate-300"
            >
              Atualizar Lista
            </Button>
          </div>

          <ResultsPortal exams={myExams} onRefresh={loadClinicData} />
        </TabsContent>

        {/* 1. VISÃO GERAL */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Pacientes Cadastrados</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{patients.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Exclusivos desta organização</div>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Exames Enviados</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{myExams.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Solicitações de laudo</div>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Laudos Concluídos</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {myExams.filter((e) => e.status === 'reported').length}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Laudados pelos cardiologistas</div>
            </Card>
          </div>

          {/* Cartão de Aviso de Escopo da Etapa 1 */}
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#00A6A6]" />
              <span>Funcionalidades em Desenvolvimento (Etapa 1 — Fundação):</span>
            </div>
            <p>
              Nesta fase estão disponíveis o cadastro de pacientes, envio protegido de arquivos ECG
              e controle de acesso estrito. As funcionalidades de edição de laudo, geração de PDF
              com assinatura digital, faturamento e integração com aparelhos de eletrocardiograma
              estão indisponíveis nesta etapa e serão implementadas nas próximas fases com
              autorização explícita.
            </p>
          </div>

          <SecurityTestRunnerModal />
        </TabsContent>

        {/* 2. PACIENTES */}
        <TabsContent value="patients" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Pacientes da Clínica</h2>
              <p className="text-xs text-slate-600">
                Registros vinculados estritamente à {currentOrg?.name}
              </p>
            </div>

            <Dialog open={isPatientModalOpen} onOpenChange={setIsPatientModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-[#0E4C92] text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo Paciente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold">Cadastrar Novo Paciente</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreatePatient} className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs">Nome Completo</Label>
                    <Input
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Nome do paciente"
                      required
                      className="text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Data de Nascimento</Label>
                      <Input
                        type="date"
                        value={patientBirth}
                        onChange={(e) => setPatientBirth(e.target.value)}
                        required
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Sexo Biológico</Label>
                      <Select
                        value={patientGender}
                        onValueChange={(val: any) => setPatientGender(val)}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Feminino</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">CPF</Label>
                      <Input
                        value={patientCpf}
                        onChange={(e) => setPatientCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Telefone</Label>
                      <Input
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observações Clínicas Relevantes</Label>
                    <Textarea
                      value={patientNotes}
                      onChange={(e) => setPatientNotes(e.target.value)}
                      placeholder="Histórico clínico prévio, queixas..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                  <DialogFooter className="pt-2">
                    <Button type="submit" size="sm" className="bg-[#0E4C92] text-xs">
                      Salvar Paciente
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
                    <th className="p-3">Nome Completo</th>
                    <th className="p-3">CPF</th>
                    <th className="p-3">Nascimento</th>
                    <th className="p-3">Sexo</th>
                    <th className="p-3">Prontuário</th>
                    <th className="p-3">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Nenhum paciente cadastrado nesta clínica.
                      </td>
                    </tr>
                  ) : (
                    patients.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">{p.full_name}</td>
                        <td className="p-3 font-mono text-slate-600">{p.cpf || '—'}</td>
                        <td className="p-3 text-slate-600">
                          {p.birth_date ? new Date(p.birth_date).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="p-3 text-slate-600">{p.gender}</td>
                        <td className="p-3 font-mono text-slate-500">{p.record_number || '—'}</td>
                        <td className="p-3 text-slate-500 max-w-xs truncate">
                          {p.clinical_notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 3. ENVIAR ECG */}
        <TabsContent value="upload" className="space-y-4 pt-4">
          <Card className="max-w-2xl mx-auto border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#00A6A6]" />
                <span>Nova Solicitação de Telelaudo em ECG</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Envio protegido do traçado eletrocardiográfico (PDF, PNG ou JPG) para o corpo
                clínico.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleUploadExam} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Paciente *</Label>
                    <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Selecione o paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name} {p.cpf ? `(${p.cpf})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Unidade de Coleta</Label>
                    <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Nível de Urgência *</Label>
                    <Select value={urgency} onValueChange={(val: any) => setUrgency(val)}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Rotina (Até 24h)</SelectItem>
                        <SelectItem value="urgent">Urgente (Até 2h)</SelectItem>
                        <SelectItem value="emergency">Emergência / Imediato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Possui Marcapasso?</Label>
                    <div className="flex items-center gap-3 pt-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="pacemaker"
                          checked={!hasPacemaker}
                          onChange={() => setHasPacemaker(false)}
                        />
                        <span>Não</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="pacemaker"
                          checked={hasPacemaker}
                          onChange={() => setHasPacemaker(true)}
                        />
                        <span>Sim</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Indicação Clínica / Motivo do Exame
                  </Label>
                  <Input
                    value={clinicalIndication}
                    onChange={(e) => setClinicalIndication(e.target.value)}
                    placeholder="Ex: Avaliação pré-operatória, dor precordial atípica..."
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Sintomas Referidos</Label>
                    <Input
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      placeholder="Ex: Palpitações, dispneia..."
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Medicamentos em Uso</Label>
                    <Input
                      value={meds}
                      onChange={(e) => setMeds(e.target.value)}
                      placeholder="Ex: Betabloqueador, Digoxina..."
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <Label className="text-xs font-semibold text-slate-800">
                    Arquivo do Traçado de ECG (PDF, PNG, JPG - Máx 15MB) *
                  </Label>
                  <Input
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    onChange={(e) => setExamFile(e.target.files?.[0] || null)}
                    required
                    className="text-xs cursor-pointer"
                  />
                  <div className="text-[11px] text-slate-500">
                    O arquivo é armazenado no Skip Cloud com proteção nativa (file field protected:
                    não acessível por URLs públicas).
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isUploading}
                  className="w-full bg-[#0E4C92] text-xs font-semibold mt-2"
                >
                  {isUploading
                    ? 'Enviando Exame com Proteção...'
                    : 'Submeter Exame para Fila de Laudos'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. MEUS EXAMES */}
        <TabsContent value="exams" className="space-y-4 pt-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Histórico de Exames da Clínica</h2>
            <p className="text-xs text-slate-600">Acompanhamento do status de cada solicitação</p>
          </div>
          <Card className="border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">Urgência</th>
                    <th className="p-3">Indicação Clínica</th>
                    <th className="p-3">Arquivo</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myExams.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Nenhum exame enviado ainda. Utilize a aba "Enviar ECG".
                      </td>
                    </tr>
                  ) : (
                    myExams.map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-slate-500">
                          {new Date(ex.created).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          {ex.expand?.patient_id?.full_name || 'Paciente'}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              ex.urgency === 'emergency'
                                ? 'bg-red-50 text-red-700 border-red-300'
                                : 'bg-slate-50'
                            }
                          >
                            {ex.urgency}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-600">{ex.clinical_indication || '—'}</td>
                        <td className="p-3">
                          <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {ex.exam_file} (Protegido)
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">
                            {ex.status === 'pending' && 'Na Fila'}
                            {ex.status === 'in_analysis' && 'Em Elaboração'}
                            {ex.status === 'waiting_signature' && 'Aguardando Assinatura'}
                            {ex.status === 'returned' && 'Devolvido Técnico'}
                            {ex.status === 'reported' && 'Concluído'}
                            {ex.status === 'cancelled' && 'Cancelado'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ETAPA 4A: Política de liberação de laudos assinados */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-slate-900">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Liberação de Laudos Definitivos (Etapa 4A — Documentos e Assinatura):</span>
            </div>
            <p>
              Laudos com status <strong>Aguardando Assinatura</strong> ou posterior permanecem{' '}
              <strong>INDISPONÍVEIS para download</strong> até que o documento PDF seja assinado
              digitalmente com certificado ICP-Brasil (PAdES) e a assinatura seja validada
              criptograficamente pela prestadora.
            </p>
            <p className="text-slate-500 text-[11px]">
              Nenhum documento é liberado à clínica antes da validação da assinatura. O download só
              será habilitado nesta tela após a etapa de integração com o provedor de assinatura
              qualificada.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
