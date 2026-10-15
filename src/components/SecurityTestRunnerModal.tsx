import React, { useState, useEffect } from 'react'
import { runSecurityAndIsolationTests, TestResultItem } from '@/services/securityTests'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Clock,
  Activity,
  X,
} from 'lucide-react'

interface SecurityTestRunnerModalProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function SecurityTestRunnerModal({
  isOpen = false,
  onClose,
}: SecurityTestRunnerModalProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<TestResultItem[]>([])
  const [hasRun, setHasRun] = useState(false)

  const executeTests = async () => {
    setIsRunning(true)
    try {
      const res = await runSecurityAndIsolationTests((updatedTests) => {
        setResults(updatedTests)
      })
      setResults(res)
      setHasRun(true)
    } catch (err) {
      console.error('Erro na execução dos testes:', err)
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    // Executar quando o modal for aberto ou na inicialização
    if (isOpen) {
      executeTests()
    }
  }, [isOpen])

  const passedCount = results.filter((r) => r.status === 'passed').length
  const failedCount = results.filter((r) => r.status === 'failed').length

  const modalBody = (
    <div className="space-y-4">
      {/* Resumo da Bateria */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Resultado dos Testes:</span>
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-800 border-emerald-300 gap-1"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{passedCount} Aprovados</span>
          </Badge>
          {failedCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="w-3 h-3" />
              <span>{failedCount} Reprovados</span>
            </Badge>
          )}
        </div>

        <Button
          onClick={executeTests}
          disabled={isRunning}
          size="sm"
          className="h-7 text-xs bg-[#0E4C92] hover:bg-[#0c3e77] text-white gap-1"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Executando...</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              <span>Reexecutar Bateria Completa</span>
            </>
          )}
        </Button>
      </div>

      {/* Lista de Casos de Teste */}
      <div className="max-h-[60vh] overflow-y-auto space-y-2.5 pr-1">
        {results.map((item) => (
          <div
            key={item.id}
            className={`p-3 rounded-lg border text-xs transition-all ${
              item.status === 'passed'
                ? 'bg-white border-slate-200'
                : item.status === 'running'
                  ? 'bg-sky-50/50 border-sky-300'
                  : 'bg-red-50/50 border-red-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 flex-1">
                {item.status === 'passed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : item.status === 'running' ? (
                  <RefreshCw className="w-4 h-4 text-[#0E4C92] animate-spin shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] py-0 px-1.5 bg-slate-100 text-slate-700"
                    >
                      {item.category}
                    </Badge>
                    {item.httpStatus && (
                      <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        HTTP {item.httpStatus}
                      </span>
                    )}
                    {item.durationMs && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.durationMs}ms
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600">{item.description}</p>

                  <div className="mt-1.5 p-2 bg-slate-50 rounded border border-slate-100 text-[11px] space-y-1 font-mono">
                    <div className="text-slate-500">
                      <strong className="text-slate-700">Esperado:</strong> {item.expected}
                    </div>
                    {item.realResult && (
                      <div
                        className={
                          item.status === 'passed'
                            ? 'text-emerald-700 font-medium'
                            : 'text-red-700 font-medium'
                        }
                      >
                        <strong className="text-slate-700">Resultado real:</strong>{' '}
                        {item.realResult}
                      </div>
                    )}
                  </div>
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
  )

  if (onClose) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Bateria de Validação Automatizada (Etapas 1, 3, 4A, 4B e 5)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Chamadas reais autenticadas ao backend PocketBase testando isolamento, atomicidade,
              portal de resultados, SLA, notificações e integridade probatória
            </DialogDescription>
          </DialogHeader>

          {modalBody}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Visualização Inline (Card)
  return (
    <Card className="border-slate-300 shadow-sm mt-6">
      <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <CardTitle className="text-sm text-slate-900 font-bold">
            Validação Efetiva de Segurança, Fila, Portal de Resultados e SLA (Etapa 5)
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4">{modalBody}</CardContent>
    </Card>
  )
}
