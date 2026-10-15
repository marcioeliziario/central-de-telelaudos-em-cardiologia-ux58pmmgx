import React, { useState, useEffect } from 'react'
import {
  commercialContractService,
  priceTableService,
  monthlyClosingService,
  billingService,
} from '@/services/telelaudosService'
import {
  CommercialContract,
  PriceTable,
  MonthlyClosing,
  BillingItem,
  MedicalProductionItem,
  Organization,
} from '@/types/telelaudos'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DollarSign,
  FileSpreadsheet,
  FileText,
  Lock,
  Plus,
  TrendingUp,
  CreditCard,
  Download,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  Stethoscope,
  Building2,
  FileCheck2,
  HelpCircle,
} from 'lucide-react'

interface FinancialManagementModuleProps {
  organizations: Organization[]
  onRefreshData?: () => void
}

export default function FinancialManagementModule({
  organizations,
}: FinancialManagementModuleProps) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [contracts, setContracts] = useState<CommercialContract[]>([])
  const [priceTables, setPriceTables] = useState<PriceTable[]>([])
  const [closings, setClosings] = useState<MonthlyClosing[]>([])
  const [billingItems, setBillingItems] = useState<BillingItem[]>([])
  const [medicalProduction, setMedicalProduction] = useState<MedicalProductionItem[]>([])
  const [loading, setLoading] = useState(false)

  // Dialogs
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false)
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false)
  const [isClosingDialogOpen, setIsClosingDialogOpen] = useState(false)
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedClosing, setSelectedClosing] = useState<MonthlyClosing | null>(null)

  // Form states - Novo Contrato
  const [contractClientOrgId, setContractClientOrgId] = useState('')
  const [contractNumber, setContractNumber] = useState('')
  const [contractStartDate, setContractStartDate] = useState('2026-01-01')
  const [contractClosingDay, setContractClosingDay] = useState(30)
  const [contractPaymentDays, setContractPaymentDays] = useState(15)
  const [contractMinVolume, setContractMinVolume] = useState(0)
  const [contractMinAmount, setContractMinAmount] = useState(0)
  const [contractNotes, setContractNotes] = useState('')

  // Form states - Novo Preço
  const [priceContractId, setPriceContractId] = useState('')
  const [priceModality, setPriceModality] = useState<'ECG_12_DERIVACOES' | 'ECG_RITMO' | 'OUTRA'>(
    'ECG_12_DERIVACOES',
  )
  const [priceUrgency, setPriceUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine')
  const [priceAmount, setPriceAmount] = useState(25.0)
  const [priceValidFrom, setPriceValidFrom] = useState('2026-01-01')
  const [priceNotes, setPriceNotes] = useState('')

  // Form states - Fechamento
  const [closingClientOrgId, setClosingClientOrgId] = useState('')
  const [closingCompetence, setClosingCompetence] = useState('2026-10')

  // Form states - Ajuste
  const [adjType, setAdjType] = useState('DESCONTO_COMERCIAL')
  const [adjAmount, setAdjAmount] = useState(-50)
  const [adjJustification, setAdjJustification] = useState('')

  // Form states - Pagamento
  const [paymentAmount, setPaymentAmount] = useState(0)

  const loadFinancialData = async () => {
    setLoading(true)
    try {
      const [ctrList, prcList, clsList, bllList] = await Promise.all([
        commercialContractService.getAll(),
        priceTableService.getAll(),
        monthlyClosingService.getAll(),
        billingService.getAll(),
      ])
      setContracts(ctrList)
      setPriceTables(prcList)
      setClosings(clsList)
      setBillingItems(bllList)

      // Carregar produção médica
      try {
        const prodRes = await billingService.getMedicalProduction('2026-10')
        if (prodRes && prodRes.production) {
          setMedicalProduction(prodRes.production)
        }
      } catch (prodErr) {
        console.log('Produção médica indisponível:', prodErr)
      }
    } catch (err) {
      console.error('Erro ao carregar módulo financeiro:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFinancialData()
  }, [])

  // Métricas calculadas para o Painel Financeiro
  // NÃO tratar faturamento como lucro!
  const totalInvoiced = closings.reduce((acc, c) => acc + (c.final_total_amount || 0), 0)
  const totalReceived = closings.reduce((acc, c) => acc + (c.payment_received_amount || 0), 0)
  const totalPending = Math.max(0, totalInvoiced - totalReceived)
  const totalBillableExams = closings.reduce((acc, c) => acc + (c.billable_exams || 0), 0)
  const averageTicket = totalBillableExams > 0 ? totalInvoiced / totalBillableExams : 0

  // Criar contrato comercial
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const provider = organizations.find((o) => o.type === 'provider')
      if (!provider || !contractClientOrgId) {
        alert('Selecione a clínica contratante.')
        return
      }

      await commercialContractService.create({
        provider_org_id: provider.id,
        client_org_id: contractClientOrgId,
        contract_number: contractNumber.trim(),
        start_date: new Date(contractStartDate).toISOString(),
        status: 'active',
        modalities: JSON.stringify(['ECG_12_DERIVACOES']),
        closing_day: Number(contractClosingDay),
        payment_terms_days: Number(contractPaymentDays),
        monthly_minimum_volume: Number(contractMinVolume) || undefined,
        monthly_minimum_amount: Number(contractMinAmount) || undefined,
        billing_notes: contractNotes.trim(),
        change_history: JSON.stringify([
          {
            date: new Date().toISOString().split('T')[0],
            action: 'CONTRACT_CREATED',
            description: 'Contrato comercial formalizado no sistema.',
          },
        ]),
      })

      setIsContractDialogOpen(false)
      setContractNumber('')
      loadFinancialData()
    } catch (err: any) {
      alert(`Erro ao criar contrato: ${err.message}`)
    }
  }

  // Criar preço
  const handleCreatePrice = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const targetContract = contracts.find((c) => c.id === priceContractId)
      if (!targetContract) {
        alert('Selecione o contrato correspondente.')
        return
      }

      await priceTableService.create({
        contract_id: priceContractId,
        client_org_id: targetContract.client_org_id,
        modality: priceModality,
        urgency: priceUrgency,
        price_amount: Number(priceAmount),
        valid_from: new Date(priceValidFrom).toISOString(),
        is_active: true,
        notes: priceNotes.trim(),
      })

      setIsPriceDialogOpen(false)
      loadFinancialData()
    } catch (err: any) {
      alert(`Erro ao configurar preço: ${err.message}`)
    }
  }

  // Executar fechamento mensal
  const handleGenerateClosing = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await monthlyClosingService.generateClosing(closingClientOrgId, closingCompetence)
      setIsClosingDialogOpen(false)
      loadFinancialData()
    } catch (err: any) {
      alert(`Erro ao processar fechamento: ${err.message}`)
    }
  }

  // Adicionar ajuste justificado
  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClosing) return
    try {
      await monthlyClosingService.addAdjustment(selectedClosing.id, {
        adjustment_type: adjType,
        amount: Number(adjAmount),
        justification: adjJustification,
      })
      setIsAdjustmentDialogOpen(false)
      setAdjJustification('')
      loadFinancialData()
    } catch (err: any) {
      alert(`Erro ao registrar ajuste: ${err.message}`)
    }
  }

  // Registrar pagamento recebido
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClosing) return
    try {
      await monthlyClosingService.registerPayment(selectedClosing.id, Number(paymentAmount))
      setIsPaymentDialogOpen(false)
      loadFinancialData()
    } catch (err: any) {
      alert(`Erro ao registrar recebimento: ${err.message}`)
    }
  }

  // Exportar demonstrativo
  const handleExport = async (closingId: string, format: 'json' | 'csv') => {
    try {
      const res = await monthlyClosingService.exportStatement(closingId, format)
      if (format === 'csv' && res.csvContent) {
        const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `demonstrativo_${res.closingCode || closingId}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        alert(`Demonstrativo exportado com sucesso: ${res.closing?.closing_code || 'Consistente'}`)
      }
    } catch (err: any) {
      alert(`Erro ao exportar demonstrativo: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Gestão Comercial, Faturamento e Fechamentos</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Módulo Financeiro & Contratos da Prestadora
          </h2>
          <p className="text-xs text-slate-600">
            Contratos comerciais vinculados aos SLAs existentes, tabelas de preço com congelamento
            histórico, produção faturável única e fechamentos auditados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadFinancialData}
            disabled={loading}
            className="text-xs h-8"
          >
            {loading ? 'Carregando...' : 'Atualizar Dados'}
          </Button>
        </div>
      </div>

      {/* Abas do Módulo Financeiro */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1 bg-slate-200/80 gap-1 text-xs">
          <TabsTrigger value="dashboard" className="py-2 font-bold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
            <span>Painel Financeiro</span>
          </TabsTrigger>
          <TabsTrigger value="contracts" className="py-2 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Contratos ({contracts.length})</span>
          </TabsTrigger>
          <TabsTrigger value="prices" className="py-2 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Tabelas de Preços ({priceTables.length})</span>
          </TabsTrigger>
          <TabsTrigger value="closings" className="py-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Fechamentos ({closings.length})</span>
          </TabsTrigger>
          <TabsTrigger value="production" className="py-2 flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5 text-[#0E4C92]" />
            <span>Produção Médica</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. PAINEL FINANCEIRO */}
        <TabsContent value="dashboard" className="space-y-5 pt-3">
          {/* Alerta de conformidade: NÃO tratar faturamento como lucro */}
          <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Critério Contábil Homologado:</span>
              <p>
                O faturamento bruto consolidado representa o volume cobrado por laudos efetivamente
                liberados. NÃO deve ser tratado como lucro líquido: recebimentos em aberto, custos
                operacionais e tributação de NFS-e (desativada nesta etapa) devem ser segregados.
              </p>
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Faturamento Consolidado
              </span>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                R$ {totalInvoiced.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {totalBillableExams} exames faturados
              </span>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
                Recebimentos Registrados
              </span>
              <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">
                R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-600/80 mt-0.5 block">
                Entradas confirmadas
              </span>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
                Valores em Aberto
              </span>
              <div className="text-xl font-bold text-amber-700 mt-1 font-mono">
                R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-600/80 mt-0.5 block">
                Contas a receber pendentes
              </span>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Ticket Médio por Exame
              </span>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Média ponderada por laudo
              </span>
            </Card>
          </div>

          {/* Gráfico / Tabela de Evolução Mensal da Produção */}
          <Card className="border-slate-200">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-slate-900">
                Evolução Mensal da Produção e Fechamentos
              </CardTitle>
              <CardDescription className="text-xs">
                Histórico consolidado por competência, clínica e situação de recebimento
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-2.5">Competência</th>
                      <th className="p-2.5">Clínica</th>
                      <th className="p-2.5 text-center">Exames Faturáveis</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                      <th className="p-2.5 text-right">Ajustes</th>
                      <th className="p-2.5 text-right">Total Devido</th>
                      <th className="p-2.5 text-right">Recebido</th>
                      <th className="p-2.5 text-center">Situação Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {closings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400">
                          Nenhum fechamento registrado no sistema.
                        </td>
                      </tr>
                    ) : (
                      closings.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-mono font-bold text-slate-800">
                            {c.competence_period}
                          </td>
                          <td className="p-2.5 text-slate-900 font-medium">
                            {c.expand?.client_org_id?.name || 'Clínica'}
                          </td>
                          <td className="p-2.5 text-center font-semibold text-slate-700">
                            {c.billable_exams}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-600">
                            R$ {(c.subtotal_amount || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            <span
                              className={
                                (c.discounts_adjustments_amount || 0) < 0
                                  ? 'text-emerald-700'
                                  : 'text-slate-600'
                              }
                            >
                              R$ {(c.discounts_adjustments_amount || 0).toFixed(2)}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            R$ {(c.final_total_amount || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-700 font-medium">
                            R$ {(c.payment_received_amount || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-center">
                            <Badge
                              className={`text-[10px] font-semibold ${
                                c.payment_status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              {c.payment_status === 'paid' ? 'Quitado' : 'Em Aberto'}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. CONTRATOS COMERCIAIS */}
        <TabsContent value="contracts" className="space-y-4 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Contratos Comerciais com Clínicas
              </h3>
              <p className="text-xs text-slate-600">
                Cada clínica possui seu contrato próprio, regras de cancelamento, volume mínimo e
                vínculo direto com seu contrato de SLA existente.
              </p>
            </div>

            <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#0E4C92] hover:bg-[#0c3e77] text-white text-xs h-8 gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Contrato Comercial</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold">
                    Formalizar Contrato Comercial
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateContract} className="space-y-3 pt-2 text-xs">
                  <div>
                    <Label className="text-xs">Clínica Contratante</Label>
                    <Select value={contractClientOrgId} onValueChange={setContractClientOrgId}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Selecione a clínica" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations
                          .filter((o) => o.type === 'client')
                          .map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name} ({o.cnpj})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Número do Contrato</Label>
                      <Input
                        value={contractNumber}
                        onChange={(e) => setContractNumber(e.target.value)}
                        placeholder="Ex: CTR-2026-NOVO"
                        required
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data de Início</Label>
                      <Input
                        type="date"
                        value={contractStartDate}
                        onChange={(e) => setContractStartDate(e.target.value)}
                        required
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Dia do Fechamento Mensal</Label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={contractClosingDay}
                        onChange={(e) => setContractClosingDay(Number(e.target.value))}
                        required
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Prazo Pagto (dias pós-fechamento)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={contractPaymentDays}
                        onChange={(e) => setContractPaymentDays(Number(e.target.value))}
                        required
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Volume Mínimo Mensal (Exames)</Label>
                      <Input
                        type="number"
                        value={contractMinVolume}
                        onChange={(e) => setContractMinVolume(Number(e.target.value))}
                        placeholder="0 para livre demanda"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Valor Mínimo Faturável (R$)</Label>
                      <Input
                        type="number"
                        value={contractMinAmount}
                        onChange={(e) => setContractMinAmount(Number(e.target.value))}
                        placeholder="0.00"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Notas e Regras de Cancelamento</Label>
                    <Textarea
                      value={contractNotes}
                      onChange={(e) => setContractNotes(e.target.value)}
                      placeholder="Aviso prévio de 30 dias, regras especiais..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button type="submit" size="sm" className="bg-[#0E4C92] text-xs">
                      Salvar Contrato
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {contracts.map((c) => (
              <Card key={c.id} className="border-slate-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-xs text-[#0E4C92]">
                      {c.contract_number}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {c.expand?.client_org_id?.name || 'Clínica Contratante'}
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      CNPJ: {c.expand?.client_org_id?.cnpj || '—'}
                    </span>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                    {c.status === 'active' ? 'Ativo' : c.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                  <div>
                    <span className="text-slate-500 block">Fechamento:</span>
                    <span className="font-semibold text-slate-800">Todo dia {c.closing_day}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Vencimento da Fatura:</span>
                    <span className="font-semibold text-slate-800">
                      +{c.payment_terms_days} dias corridos
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Volume Mínimo:</span>
                    <span className="font-semibold text-slate-800">
                      {c.monthly_minimum_volume
                        ? `${c.monthly_minimum_volume} exames`
                        : 'Sem mínimo'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">SLA Vinculado:</span>
                    <span className="font-semibold text-indigo-700">
                      {c.expand?.contract_sla_id?.contract_name || 'SLA Padrão (24h/2h)'}
                    </span>
                  </div>
                </div>

                {c.cancellation_rules && (
                  <div className="text-[11px] text-slate-600 bg-amber-50/50 p-2 rounded border border-amber-100">
                    <span className="font-semibold text-amber-900 block">Regras de Rescisão:</span>
                    {c.cancellation_rules}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 3. TABELAS DE PREÇOS COM CONGELAMENTO HISTÓRICO */}
        <TabsContent value="prices" className="space-y-4 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tabelas de Preços por Vigência</h3>
              <p className="text-xs text-slate-600">
                Preços por clínica, modalidade e prioridade. Alterações de preço não alteram
                cobranças já consolidadas (snapshot mantido no item).
              </p>
            </div>

            <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#0E4C92] hover:bg-[#0c3e77] text-white text-xs h-8 gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Preço / Vigência</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold">Cadastrar Regra de Preço</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreatePrice} className="space-y-3 pt-2 text-xs">
                  <div>
                    <Label className="text-xs">Contrato Associado</Label>
                    <Select value={priceContractId} onValueChange={setPriceContractId}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Selecione o contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {contracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.contract_number} - {c.expand?.client_org_id?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Modalidade</Label>
                      <Select value={priceModality} onValueChange={(v: any) => setPriceModality(v)}>
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ECG_12_DERIVACOES">ECG 12 Derivações</SelectItem>
                          <SelectItem value="ECG_RITMO">ECG Ritmo / Fita Longa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Prioridade / SLA</Label>
                      <Select value={priceUrgency} onValueChange={(v: any) => setPriceUrgency(v)}>
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="routine">Rotina (SLA 24h)</SelectItem>
                          <SelectItem value="urgent">Prioritário (SLA 2h)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Valor Unitário (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={priceAmount}
                        onChange={(e) => setPriceAmount(Number(e.target.value))}
                        required
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Vigência a partir de</Label>
                      <Input
                        type="date"
                        value={priceValidFrom}
                        onChange={(e) => setPriceValidFrom(e.target.value)}
                        required
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Observações do Preço</Label>
                    <Input
                      value={priceNotes}
                      onChange={(e) => setPriceNotes(e.target.value)}
                      placeholder="Motivo do reajuste ou vigência"
                      className="text-xs"
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button type="submit" size="sm" className="bg-[#0E4C92] text-xs">
                      Gravar Preço
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
                    <th className="p-3">Clínica Contratante</th>
                    <th className="p-3">Modalidade</th>
                    <th className="p-3">Prioridade / Urgência</th>
                    <th className="p-3 text-right">Preço Unitário</th>
                    <th className="p-3">Período de Vigência</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {priceTables.map((pt) => (
                    <tr key={pt.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">
                        {pt.expand?.client_org_id?.name || 'Clínica'}
                        <div className="text-[11px] text-slate-400 font-normal">
                          {pt.notes || '—'}
                        </div>
                      </td>
                      <td className="p-3 text-slate-700">{pt.modality}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            pt.urgency === 'urgent'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-50'
                          }
                        >
                          {pt.urgency === 'urgent' ? 'Prioritário (2h)' : 'Rotina (24h)'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        R$ {Number(pt.price_amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        A partir de {new Date(pt.valid_from).toLocaleDateString('pt-BR')}
                        {pt.valid_to && ` até ${new Date(pt.valid_to).toLocaleDateString('pt-BR')}`}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={
                            pt.is_active
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-600'
                          }
                        >
                          {pt.is_active ? 'Vigente' : 'Histórico (Encerrado)'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 4. FECHAMENTOS MENSAIS E DEMONSTRATIVOS */}
        <TabsContent value="closings" className="space-y-4 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Fechamentos Mensais de Competência
              </h3>
              <p className="text-xs text-slate-600">
                Consolidação por competência e clínica. Valores fechados ficam protegidos contra
                alteração direta; ajustes e estornos são registrados separadamente.
              </p>
            </div>

            <Dialog open={isClosingDialogOpen} onOpenChange={setIsClosingDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#0E4C92] hover:bg-[#0c3e77] text-white text-xs h-8 gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Consolidar Fechamento</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold">
                    Gerar Fechamento de Competência
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleGenerateClosing} className="space-y-3 pt-2 text-xs">
                  <div>
                    <Label className="text-xs">Clínica Contratante</Label>
                    <Select value={closingClientOrgId} onValueChange={setClosingClientOrgId}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Selecione a clínica" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations
                          .filter((o) => o.type === 'client')
                          .map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Competência (AAAA-MM)</Label>
                    <Input
                      value={closingCompetence}
                      onChange={(e) => setClosingCompetence(e.target.value)}
                      placeholder="Ex: 2026-10"
                      required
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="p-2.5 rounded bg-blue-50 text-blue-900 border border-blue-200 text-[11px]">
                    O fechamento agrupará todos os laudos faturáveis da competência com seus preços
                    capturados e bloqueará alterações indevidas. Emissão de NFS-e permanece
                    desativada.
                  </div>

                  <DialogFooter className="pt-2">
                    <Button type="submit" size="sm" className="bg-[#0E4C92] text-xs">
                      Executar Fechamento
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {closings.map((c) => (
              <Card key={c.id} className="border-slate-200 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {c.closing_code}
                      </span>
                      {c.is_locked && (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] gap-1">
                          <Lock className="w-3 h-3 text-slate-500" />
                          <span>Consolidado Imutável</span>
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 block">
                      Clínica: {c.expand?.client_org_id?.name} • Competência: {c.competence_period}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExport(c.id, 'csv')}
                      className="text-xs h-8 gap-1 border-slate-300"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>Exportar CSV</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedClosing(c)
                        setIsAdjustmentDialogOpen(true)
                      }}
                      className="text-xs h-8 gap-1 border-slate-300 text-amber-700 hover:text-amber-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajuste Justificado</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedClosing(c)
                        setPaymentAmount(c.final_total_amount - (c.payment_received_amount || 0))
                        setIsPaymentDialogOpen(true)
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Registrar Pagamento</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-500 block text-[11px]">Exames Faturáveis</span>
                    <span className="font-bold text-slate-800">{c.billable_exams}</span>
                  </div>

                  <div className="p-2 rounded bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-500 block text-[11px]">Subtotal Bruto</span>
                    <span className="font-mono font-bold text-slate-800">
                      R$ {(c.subtotal_amount || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-500 block text-[11px]">Ajustes / Descontos</span>
                    <span
                      className={`font-mono font-bold ${
                        (c.discounts_adjustments_amount || 0) < 0
                          ? 'text-emerald-700'
                          : 'text-slate-800'
                      }`}
                    >
                      R$ {(c.discounts_adjustments_amount || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-blue-50/70 border border-blue-200">
                    <span className="text-blue-900 block text-[11px] font-semibold">
                      Total Devido
                    </span>
                    <span className="font-mono font-bold text-blue-950 text-sm">
                      R$ {(c.final_total_amount || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-emerald-50/70 border border-emerald-200">
                    <span className="text-emerald-900 block text-[11px] font-semibold">
                      Recebido
                    </span>
                    <span className="font-mono font-bold text-emerald-950 text-sm">
                      R$ {(c.payment_received_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Dialog de Ajuste Justificado */}
          <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">
                  Registrar Ajuste / Estorno Justificado
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddAdjustment} className="space-y-3 pt-2 text-xs">
                <div>
                  <Label className="text-xs">Fechamento Selecionado</Label>
                  <Input
                    value={selectedClosing?.closing_code || ''}
                    disabled
                    className="text-xs bg-slate-100 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">Tipo de Ajuste</Label>
                  <Select value={adjType} onValueChange={setAdjType}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DESCONTO_COMERCIAL">
                        Desconto Comercial / Bonificação
                      </SelectItem>
                      <SelectItem value="ESTORNO_QUALIDADE">
                        Estorno por Apontamento Técnico
                      </SelectItem>
                      <SelectItem value="ACRESCIMO_CONTRATUAL">
                        Acréscimo Contratual / Urgência Extra
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Valor do Ajuste em R$ (negativo para desconto)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(Number(e.target.value))}
                    required
                    className="text-xs font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">Justificativa Formal (Obrigatória na Auditoria)</Label>
                  <Textarea
                    value={adjJustification}
                    onChange={(e) => setAdjJustification(e.target.value)}
                    placeholder="Descreva o motivo contratual ou apontamento clínico..."
                    rows={3}
                    required
                    className="text-xs"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="submit" size="sm" className="bg-[#0E4C92] text-xs">
                    Gravar Ajuste Separadamente
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Dialog de Pagamento */}
          <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">
                  Registrar Recebimento de Clínica
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRegisterPayment} className="space-y-3 pt-2 text-xs">
                <div>
                  <Label className="text-xs">Fechamento</Label>
                  <Input
                    value={selectedClosing?.closing_code || ''}
                    disabled
                    className="text-xs bg-slate-100 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">Valor Recebido (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    required
                    className="text-xs font-mono"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    Confirmar Recebimento
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* 5. PRODUÇÃO MÉDICA */}
        <TabsContent value="production" className="space-y-4 pt-3">
          <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-950 space-y-1">
            <span className="font-semibold block flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#0E4C92]" />
              <span>Regra da Etapa 7: Produção Médica Qualitativa / Quantitativa</span>
            </span>
            <p>
              Apresenta estritamente a quantidade de laudos efetivamente emitidos por profissional.
              Cálculos de repasses financeiros e honorários médicos estão desativados por ausência
              de contrato de remuneração médica homologado.
            </p>
          </div>

          <Card className="border-slate-200">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-slate-900">
                Laudos Emitidos por Médico Cardiologista
              </CardTitle>
              <CardDescription className="text-xs">
                Contagem real de documentos liberados pelo corpo clínico
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-3">Médico Cardiologista</th>
                      <th className="p-3">CRM / UF</th>
                      <th className="p-3">Especialidade</th>
                      <th className="p-3 text-center">Laudos Emitidos</th>
                      <th className="p-3">Situação Remuneração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medicalProduction.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          Nenhum cardiologista localizado.
                        </td>
                      </tr>
                    ) : (
                      medicalProduction.map((m) => (
                        <tr key={m.doctorId} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-900">{m.doctorName}</td>
                          <td className="p-3 font-mono text-slate-700">{m.crm}</td>
                          <td className="p-3 text-slate-600">{m.specialty}</td>
                          <td className="p-3 text-center font-bold text-indigo-700">
                            {m.reportsIssuedCount}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className="bg-slate-50 text-slate-600 border-slate-300 text-[10px]"
                            >
                              Repasse Indisponível (Sem Contrato)
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
