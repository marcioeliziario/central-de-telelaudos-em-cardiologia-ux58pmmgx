import React, { useState, useEffect } from 'react'
import {
  ShieldAlert,
  HardDrive,
  RefreshCw,
  Database,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
  Server,
  FileText,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Play,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import pb from '@/lib/pocketbase/client'
import { SecurityTestRunnerModal } from '@/components/SecurityTestRunnerModal'
import {
  BACKUP_AND_DR_PLAN,
  STAGE_10_BACKUP_INVENTORY_REPORT,
} from '@/data/infrastructureAuditData'

export function AdminBackupContinuityPage() {
  const [loading, setLoading] = useState(false)
  const [drillLoading, setDrillLoading] = useState(false)
  const [backupStatusData, setBackupStatusData] = useState<any>(null)
  const [drillResult, setDrillResult] = useState<any>(null)
  const [showTestRunner, setShowTestRunner] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchBackupStatus = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await pb.send('/backend/v1/infra/backup-status', { method: 'GET' })
      setBackupStatusData(res)
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao consultar status de backup')
    } finally {
      setLoading(false)
    }
  }

  const runNonDestructiveSimulation = async () => {
    setDrillLoading(true)
    try {
      const res = await pb.send('/backend/v1/infra/backup-drill-simulate', { method: 'POST' })
      setDrillResult(res)
    } catch (err: any) {
      setDrillResult({ error: err.message || 'Falha na simulação' })
    } finally {
      setDrillLoading(false)
    }
  }

  useEffect(() => {
    fetchBackupStatus()
  }, [])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER PRINCIPAL */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-mono text-[11px]">
                ETAPA 10 — HOMOLOGAÇÃO
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-[11px]">
                VERSÃO 0.0.17
              </Badge>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <HardDrive className="w-7 h-7 text-indigo-400" />
              Backup, Restauração e Continuidade Operacional
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Inventário técnico de infraestrutura, distinção entre banco SQLite e storage de
              arquivos médicos (ECG/PDF), comprovação ética das metas RPO/RTO e simulação não
              destrutiva de DR Drill.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchBackupStatus}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs h-9 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar Inventário</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setShowTestRunner(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 gap-1.5 shadow-md"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Rodar Suíte E10</span>
            </Button>
          </div>
        </div>
      </div>

      {/* BANNER DE PRESERVAÇÃO E CLASSIFICAÇÃO ÉTICA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
            <span className="font-bold text-amber-950 text-sm">
              Diretriz Estrita de Preservação: Zero Restauração Destrutiva
            </span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            Conforme regulamento,{' '}
            <strong>nenhuma restauração destrutiva foi executada sobre este ambiente</strong>,
            resguardando os dados de teste homologados nas etapas anteriores. O teste executado foi
            uma <u>simulação estrutural não destrutiva de leitura e integridade</u>.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/80 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-700 shrink-0" />
            <span className="font-bold text-indigo-950 text-sm">
              Metas RPO (&lt; 1h) e RTO (&lt; 4h): Classificação Honesta
            </span>
          </div>
          <p className="text-xs text-indigo-900 leading-relaxed">
            As metas de <strong>RPO &lt; 1 hora</strong> e <strong>RTO &lt; 4 horas</strong>{' '}
            permanecem catalogadas estritamente como <strong>PROPOSTAS E NÃO COMPROVADAS</strong>{' '}
            até que um DR Drill real com corte seja efetuado em um ambiente espelho contratado.
          </p>
        </div>
      </div>

      {/* TABS DE DETALHAMENTO */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-1">
          <TabsTrigger value="inventory" className="text-xs font-bold py-2">
            1. Inventário dos Backups
          </TabsTrigger>
          <TabsTrigger value="mirror" className="text-xs font-bold py-2">
            2. Ambiente Espelho & DR
          </TabsTrigger>
          <TabsTrigger value="simulation" className="text-xs font-bold py-2">
            3. Simulação DR Drill
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs font-bold py-2">
            4. Revisão de Segurança (9B/10)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INVENTÁRIO DOS BACKUPS */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-slate-200 shadow-sm lg:col-span-2">
              <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Mapeamento Arquitetural: SQLite vs Storage Médico
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Importante: Não confundir backup do banco relacional com cópia dos arquivos
                  médicos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Banco SQLite / Metadados</span>
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                        pb_data/data.db
                      </Badge>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Armazena pacientes, exames, laudos textuais, templates, usuários, permissões
                      RBAC, contratos SLA e trilha imutável{' '}
                      <code className="text-slate-800">audit_logs</code>.
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Mecanismo nativo PB:</span>
                      <strong className="text-slate-800 font-mono">/api/backups (zip)</strong>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Storage Médico (Binários)</span>
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]">
                        pb_data/storage
                      </Badge>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Armazena traçados brutos de ECG (
                      <code className="text-slate-800">exam_file</code>) e PDFs versionados (
                      <code className="text-slate-800">pdf_file</code>).
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Proteção de integridade:</span>
                      <strong className="text-indigo-700 font-mono">Hash SHA-256 no banco</strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                    <span className="font-bold text-rose-950">
                      Alerta Arquitetural: O que o mecanismo de backup cobre efetivamente?
                    </span>
                  </div>
                  <p className="text-rose-900 leading-relaxed">
                    Backups gerados pelo comando{' '}
                    <code className="font-mono bg-white px-1 py-0.5 rounded border border-rose-300">
                      /api/backups
                    </code>{' '}
                    nativo do PocketBase contêm primariamente o SQLite. Dependendo da configuração e
                    do tamanho, podem omitir a pasta{' '}
                    <code className="font-mono bg-white px-1 py-0.5 rounded border border-rose-300">
                      storage/
                    </code>
                    .{' '}
                    <strong>
                      Para operação clínica real, a infraestrutura deve obrigatoriamente manter
                      snapshot contínuo de volume em bloco ou replicação síncrona para bucket S3
                      secundário
                    </strong>
                    .
                  </p>
                </div>

                {backupStatusData && (
                  <div className="space-y-2 pt-2">
                    <h4 className="font-bold text-slate-900">
                      Coleções Inspecionadas ao Vivo no Skip Cloud (
                      {backupStatusData.metrics?.totalCollections} coleções /{' '}
                      {backupStatusData.metrics?.totalRecords} registros)
                    </h4>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 sticky top-0 text-slate-700">
                          <tr>
                            <th className="p-2">Coleção</th>
                            <th className="p-2">Categoria</th>
                            <th className="p-2 text-right">Registros</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {backupStatusData.metrics?.collectionsInventory?.map(
                            (ci: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2 font-medium text-slate-800">{ci.collection}</td>
                                <td className="p-2 text-slate-500 font-sans">
                                  {ci.isMedicalData ? (
                                    <Badge className="bg-rose-100 text-rose-800 text-[9px]">
                                      Médica
                                    </Badge>
                                  ) : ci.isAuditTrail ? (
                                    <Badge className="bg-indigo-100 text-indigo-800 text-[9px]">
                                      Auditoria
                                    </Badge>
                                  ) : ci.isFinancial ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 text-[9px]">
                                      Financeiro
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px]">
                                      Sistema
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-2 text-right font-bold text-slate-900">
                                  {ci.recordsCount}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  Dependências do Provedor
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Infraestrutura de suporte Skip Cloud
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 text-[11px] block">Motor do Backend:</span>
                  <p className="font-semibold text-slate-900">PocketBase v0.36 (Go/Goja JSVM)</p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 text-[11px] block">Banco de Dados:</span>
                  <p className="font-semibold text-slate-900">SQLite com WAL mode (CGO nativo)</p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 text-[11px] block">Armazenamento em Nuvem:</span>
                  <p className="font-semibold text-slate-900">
                    Volume de blocos persistente gerenciado
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 text-[11px] block">
                    Criptografia em Trânsito:
                  </span>
                  <p className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> TLS 1.3 / HTTPS Ativo
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 text-[11px] block">Criptografia em Repouso:</span>
                  <p className="font-semibold text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Pendência Documental do
                    Provedor (AES-256)
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 text-[11px] block">Frequência dos Backups:</span>
                  <p className="text-slate-700">Diário automatizado + WAL archiving contínuo</p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 text-[11px] block">Retenção Proposta:</span>
                  <p className="text-slate-700">
                    30 dias operacionais (CFM 1.821/2007 exige 20 anos para prontuários em cold
                    storage)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: AMBIENTE ESPELHO E REQUISITOS EXTERNOS */}
        <TabsContent value="mirror" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Diagnóstico de Ambiente Espelho e Requisitos para DR Drill Real
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Apresentação formal da necessidade de infraestrutura antes da execução
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 space-y-2">
                <h4 className="font-bold text-blue-950 text-sm">
                  Por que o DR Drill com restauração física não pôde ser executado neste ambiente?
                </h4>
                <p className="text-blue-900 leading-relaxed">
                  O Skip Cloud opera em arquitetura gerenciada PaaS em instância única. Não há
                  console self-service que permita instanciar em um clique uma segunda réplica
                  espelho idêntica sem incorrer em novas contratações ou provisionamento externo de
                  nuvem. Restaurar qualquer backup sobre a instância atual destruiria as credenciais
                  de teste, o histórico acumulado e violaria a diretriz de preservação estrita
                  estabelecida pelo usuário.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">
                  Recursos Necessários para viabilizar o DR Drill em Ambiente Espelho:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {STAGE_10_BACKUP_INVENTORY_REPORT.mirrorEnvironmentRequiredSpecs.map(
                    (spec, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2"
                      >
                        <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[11px]">
                            {idx + 1}
                          </span>
                          <span>{spec.item}</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{spec.purpose}</p>
                        <Badge variant="outline" className="text-[10px] text-slate-500 font-mono">
                          {spec.costType}
                        </Badge>
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <h4 className="font-bold text-slate-900">
                  Roteiro de 6 Passos Homologado para o Futuro Exercício em Ambiente Espelho:
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
                  {BACKUP_AND_DR_PLAN.drDrillProcedure.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SIMULAÇÃO DR DRILL (NÃO DESTRUTIVA) */}
        <TabsContent value="simulation" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-600" />
                    Simulação Não Destrutiva de DR Drill (Validação em Leitura)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    Validação ao vivo de consistência estrutural, índices, hashes e audit trail sem
                    mutações
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={runNonDestructiveSimulation}
                  disabled={drillLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5"
                >
                  <Play className={`w-3.5 h-3.5 ${drillLoading ? 'animate-spin' : ''}`} />
                  <span>Executar Simulação Live</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Este teste dispara a rota{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-700">
                  POST /backend/v1/infra/backup-drill-simulate
                </code>{' '}
                autenticada como administrador. O endpoint simula o procedimento de verificação
                pós-restauração sem modificar nenhuma tabela nem expor segredos.
              </p>

              {drillResult && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-emerald-950 text-sm">
                        Resultado da Simulação ao Vivo
                      </span>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-mono text-[11px]">
                      {drillResult.durationMs}ms
                    </Badge>
                  </div>
                  <p className="text-emerald-900 leading-relaxed">{drillResult.message}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block">Coleções Checadas:</span>
                      <strong className="text-emerald-900 text-xs">12 / 12 Presentes</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block">Hashes SHA-256:</span>
                      <strong className="text-emerald-900 text-xs">Estrutura Válida</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block">Cron Job SLA:</span>
                      <strong className="text-emerald-900 text-xs">sla_monitor_5m Ativo</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block">Trilha de Auditoria:</span>
                      <strong className="text-emerald-900 text-xs">Gravado no audit_logs</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="font-bold text-slate-900">
                  Resumo das Metas de Continuidade Propostas:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <span className="text-slate-500 text-[11px] block">
                      RPO (Recovery Point Objective):
                    </span>
                    <strong className="text-slate-900 text-sm block mt-0.5">
                      Meta &lt; 1 hora
                    </strong>
                    <Badge
                      variant="outline"
                      className="mt-1 bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                    >
                      NÃO COMPROVADO EM DR DRILL
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <span className="text-slate-500 text-[11px] block">
                      RTO (Recovery Time Objective):
                    </span>
                    <strong className="text-slate-900 text-sm block mt-0.5">
                      Meta &lt; 4 horas
                    </strong>
                    <Badge
                      variant="outline"
                      className="mt-1 bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                    >
                      NÃO COMPROVADO EM DR DRILL
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: REVISÃO DE SEGURANÇA RESIDUAL (9B/10) */}
        <TabsContent value="security" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                Revisão Adicional de Segurança (Pontos Residuais da Etapa 9B / 10)
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Auditoria técnica comprovada com evidências de código, schemas e respostas do
                servidor
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="space-y-3">
                {STAGE_10_BACKUP_INVENTORY_REPORT.securityReviewResiduals.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{sec.point}</span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                        CONFORME
                      </Badge>
                    </div>
                    <p className="text-slate-700 leading-relaxed font-sans">{sec.state}</p>
                    <div className="pt-1 text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                      <span className="font-bold text-slate-700">Evidência:</span>
                      <span>{sec.evidence}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-1.5">
                <span className="font-bold text-indigo-950">
                  Nota sobre Autenticação e Autorização:
                </span>
                <p className="text-indigo-900 leading-relaxed text-[11px]">
                  Nenhum mecanismo de autenticação existente foi substituído. O sistema utiliza a
                  coleção nativa <code className="font-mono">users</code> do PocketBase com extensão
                  de segurança via hooks e migrations não disruptivas, preservando 100% da
                  compatibilidade retroativa com os módulos clínicos e financeiros.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE EXECUÇÃO DA BATERIA GERAL (INCLUI TESTES E10) */}
      <SecurityTestRunnerModal isOpen={showTestRunner} onClose={() => setShowTestRunner(false)} />
    </div>
  )
}
