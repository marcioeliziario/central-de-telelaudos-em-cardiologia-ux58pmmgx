import React, { useState, useEffect } from 'react'
import { runSecurityAndIsolationTests, TestResultItem } from '@/services/securityTests'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Lock,
} from 'lucide-react'

export default function SecurityTestRunnerModal() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<TestResultItem[]>([])
  const [hasRun, setHasRun] = useState(false)

  const executeTests = async () => {
    setIsRunning(true)
    try {
      const res = await runSecurityAndIsolationTests()
      setResults(res)
      setHasRun(true)
    } catch (err) {
      console.error('Erro na execução dos testes:', err)
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    // Executar automaticamente na primeira montagem para já apresentar os resultados reais ao usuário
    executeTests()
  }, [])

  const passedCount = results.filter((r) => r.status === 'passed').length
  const failedCount = results.filter((r) => r.status === 'failed').length

  return (
    <Card className="border-slate-300 shadow-sm mt-6">
      <CardHeader className="bg-slate-50 border-b border-slate-200 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 rounded-lg text-[#0E4C92]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-900 font-bold">
                Validação Efetiva de Segurança e Isolamento Multi-tenant (Skip Cloud)
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Testes executados com chamadas HTTP autenticadas reais no backend PocketBase
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={executeTests}
            disabled={isRunning}
            size="sm"
            variant="outline"
            className="border-slate-300 hover:bg-slate-100 text-xs font-semibold shrink-0 gap-1.5"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Testando Backend...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                <span>Reexecutar Testes ao Vivo</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {hasRun && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg text-xs">
            <span className="font-semibold text-slate-700">Resumo da Verificação:</span>
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-300 gap-1"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{passedCount} Aprovados</span>
            </Badge>
            {failedCount > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" />
                <span>{failedCount} Reprovados</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                100% de conformidade com regras RLS e hooks
              </Badge>
            )}
            <span className="text-slate-400 ml-auto text-[11px]">
              {results.length > 0 &&
                `Última execução: ${new Date(results[0].timestamp).toLocaleTimeString('pt-BR')}`}
            </span>
          </div>
        )}

        <div className="space-y-2.5">
          {results.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-lg border transition-all ${
                item.status === 'passed'
                  ? 'bg-slate-50/70 border-slate-200 hover:border-emerald-300'
                  : 'bg-red-50/50 border-red-200 hover:border-red-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {item.status === 'passed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{item.name}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] py-0 px-1.5 bg-slate-200/80 text-slate-700"
                      >
                        {item.category}
                      </Badge>
                      {item.httpStatus && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          HTTP {item.httpStatus}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{item.description}</p>
                    <div className="mt-2 text-xs space-y-1 font-mono text-[11px]">
                      <div className="text-slate-500">
                        <span className="font-semibold text-slate-700">Esperado:</span>{' '}
                        {item.expected}
                      </div>
                      <div
                        className={
                          item.status === 'passed'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-red-700 font-semibold'
                        }
                      >
                        <span className="font-semibold text-slate-700">Resultado real:</span>{' '}
                        {item.actual}
                      </div>
                    </div>
                  </div>
                </div>

                <Badge
                  className={`text-[10px] uppercase font-bold shrink-0 ${
                    item.status === 'passed'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  {item.status === 'passed' ? 'Aprovado' : 'Falhou'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
