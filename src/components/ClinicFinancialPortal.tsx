import React, { useState, useEffect } from 'react'
import { monthlyClosingService } from '@/services/telelaudosService'
import { MonthlyClosing, Organization } from '@/types/telelaudos'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Download,
  DollarSign,
  Calendar,
  Lock,
  Building2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react'

interface ClinicFinancialPortalProps {
  organization: Organization
}

export default function ClinicFinancialPortal({ organization }: ClinicFinancialPortalProps) {
  const [closings, setClosings] = useState<MonthlyClosing[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedClosing, setSelectedClosing] = useState<MonthlyClosing | null>(null)
  const [exportDetails, setExportDetails] = useState<any | null>(null)

  const loadClosings = async () => {
    setLoading(true)
    try {
      const list = await monthlyClosingService.getAll(`client_org_id = '${organization.id}'`)
      setClosings(list)
    } catch (err) {
      console.error('Erro ao carregar demonstrativos da clínica:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClosings()
  }, [organization.id])

  const handleExportCsv = async (closingId: string) => {
    try {
      const res = await monthlyClosingService.exportStatement(closingId, 'csv')
      if (res.csvContent) {
        const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `demonstrativo_${res.closingCode || closingId}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      alert(`Erro ao exportar CSV: ${err.message}`)
    }
  }

  const handleViewStatement = async (c: MonthlyClosing) => {
    setSelectedClosing(c)
    try {
      const res = await monthlyClosingService.exportStatement(c.id, 'json')
      setExportDetails(res)
    } catch (err: any) {
      alert(`Erro ao carregar detalhes: ${err.message}`)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Faturamento & Demonstrativos da Clínica</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Demonstrativos Financeiros Consolidados
          </h3>
          <p className="text-xs text-slate-600">
            Acesso exclusivo aos demonstrativos mensais de faturamento emitidos para a{' '}
            {organization.name}.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={loadClosings}
          disabled={loading}
          className="text-xs h-8"
        >
          {loading ? 'Atualizando...' : 'Recarregar Faturas'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {closings.length === 0 ? (
          <Card className="col-span-2 p-8 text-center text-slate-400 border-dashed border-2">
            Nenhum demonstrativo de competência emitido para esta clínica até o momento.
          </Card>
        ) : (
          closings.map((c) => (
            <Card key={c.id} className="border-slate-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-xs text-[#0E4C92]">
                    {c.closing_code}
                  </span>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    Competência: {c.competence_period}
                  </div>
                </div>
                <Badge
                  className={`text-[10px] font-semibold ${
                    c.payment_status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {c.payment_status === 'paid' ? 'Fatura Quitada' : 'Aguardando Pagamento'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                <div>
                  <span className="text-slate-500 block text-[11px]">Total Exames</span>
                  <span className="font-bold text-slate-800">{c.billable_exams}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Ajustes/Desc.</span>
                  <span
                    className={`font-mono font-semibold ${
                      (c.discounts_adjustments_amount || 0) < 0
                        ? 'text-emerald-700'
                        : 'text-slate-800'
                    }`}
                  >
                    R$ {(c.discounts_adjustments_amount || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Valor Total</span>
                  <span className="font-mono font-bold text-slate-900">
                    R$ {(c.final_total_amount || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewStatement(c)}
                  className="text-xs h-7 gap-1"
                >
                  <FileText className="w-3 h-3 text-slate-500" />
                  <span>Ver Detalhes</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportCsv(c.id)}
                  className="text-xs h-7 gap-1 border-slate-300"
                >
                  <Download className="w-3 h-3 text-slate-600" />
                  <span>Baixar CSV</span>
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Detalhes do demonstrativo expandido */}
      {selectedClosing && exportDetails && (
        <Card className="border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Detalhamento: {selectedClosing.closing_code}
              </h4>
              <span className="text-xs text-slate-500">
                Prestadora: {exportDetails.provider?.name} (CNPJ {exportDetails.provider?.cnpj})
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedClosing(null)}
              className="text-xs h-7 text-slate-500"
            >
              Fechar
            </Button>
          </div>

          <div className="text-xs space-y-2">
            <span className="font-semibold text-slate-700 block">
              Itens Faturados na Competência:
            </span>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="p-2">Item ID</th>
                    <th className="p-2">Modalidade</th>
                    <th className="p-2">Prioridade</th>
                    <th className="p-2 text-right">Valor Unitário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(exportDetails.items || []).map((it: any) => (
                    <tr key={it.id}>
                      <td className="p-2 font-mono text-[11px] text-slate-600">{it.id}</td>
                      <td className="p-2">{it.modality}</td>
                      <td className="p-2">{it.urgency}</td>
                      <td className="p-2 text-right font-mono font-semibold">
                        R$ {Number(it.unit_price_snapshotted).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
