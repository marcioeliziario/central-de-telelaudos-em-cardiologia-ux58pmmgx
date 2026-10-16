import React, { useState, useEffect } from 'react'
import {
  runFlexibleReportEditorTests,
  FlexibleEditorTestResult,
} from '@/services/flexibleEditorTests'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  ShieldCheck,
  Sparkles,
  Clock,
  AlertTriangle,
} from 'lucide-react'

interface FlexibleEditorTestRunnerModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function FlexibleEditorTestRunnerModal({
  isOpen,
  onClose,
}: FlexibleEditorTestRunnerModalProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<FlexibleEditorTestResult[]>([])
  const [hasRun, setHasRun] = useState(false)

  const executeTests = async () => {
    setIsRunning(true)
    try {
      const res = await runFlexibleReportEditorTests((updatedTests) => {
        setResults(updatedTests)
      })
      setResults(res)
      setHasRun(true)
    } catch (err) {
      console.error('Erro na execução dos testes do editor flexível:', err)
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      executeTests()
    }
  }, [isOpen])

  const passedCount = results.filter((r) => r.status === 'passed').length
  const failedCount = results.filter((r) => r.status === 'failed').length

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-[#2F3942] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#4A90D9]" />
            <span>Validação Automatizada — Editor Flexível de Laudos (10 Testes Obrigatórios)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6F7780]">
            Bateria de testes reais executada contra o backend Skip Cloud / PocketBase cobrindo
            texto livre, laudo estruturado, alternância segura, síntese de texto, modelos pessoais,
            preferências individuais e não-regressão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Barra de Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#F7F6F4] border border-[#E3E6E8] rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#2F3942]">Resultado da Bateria:</span>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-300 gap-1 font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{passedCount} / 10 Aprovados</span>
              </Badge>
              {failedCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{failedCount} Reprovados</span>
                </Badge>
              )}
            </div>

            <Button
              onClick={executeTests}
              disabled={isRunning}
              size="sm"
              className="h-7 text-xs bg-[#4A90D9] hover:bg-[#3b7dc2] text-white gap-1 font-semibold"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Executando...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Reexecutar Bateria</span>
                </>
              )}
            </Button>
          </div>

          {/* Lista dos 10 Testes */}
          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {results.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border text-xs transition-all ${
                  item.status === 'passed'
                    ? 'bg-white border-[#E3E6E8]'
                    : item.status === 'running'
                      ? 'bg-sky-50/50 border-[#4A90D9]'
                      : 'bg-red-50/50 border-red-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1">
                    {item.status === 'passed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : item.status === 'running' ? (
                      <RefreshCw className="w-4 h-4 text-[#4A90D9] animate-spin shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#2F3942]">{item.name}</span>
                        {item.durationMs && (
                          <span className="text-[10px] text-[#6F7780] font-mono">
                            {item.durationMs}ms
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6F7780]">{item.description}</p>
                      {item.details && (
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700 font-mono mt-1">
                          {item.details}
                        </div>
                      )}
                      {item.error && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 font-mono mt-1">
                          {item.error}
                        </div>
                      )}
                    </div>
                  </div>

                  <Badge
                    className={`text-[10px] uppercase font-bold shrink-0 ${
                      item.status === 'passed'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : item.status === 'running'
                          ? 'bg-sky-100 text-sky-800 border-sky-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                    }`}
                  >
                    {item.status === 'passed'
                      ? 'Aprovado'
                      : item.status === 'running'
                        ? 'Executando'
                        : 'Falhou'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
