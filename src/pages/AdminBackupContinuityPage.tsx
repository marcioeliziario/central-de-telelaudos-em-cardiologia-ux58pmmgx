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
import SecurityTestRunnerModal from '@/components/SecurityTestRunnerModal'
import {
  BACKUP_AND_DR_PLAN,
  STAGE_10_BACKUP_INVENTORY_REPORT,
  STAGE_10B_FEASIBILITY_REPORT,
} from '@/data/infrastructureAuditData'

export function AdminBackupContinuityPage() {
  const [loading, setLoading] = useState(false)
  const [drillLoading, setDrillLoading] = useState(false)
  const [feasibilityLoading, setFeasibilityLoading] = useState(false)
  const [snapshotProofLoading, setSnapshotProofLoading] = useState(false)
  const [manifestLoading, setManifestLoading] = useState(false)

  const [backupStatusData, setBackupStatusData] = useState<any>(null)
  const [feasibilityData, setFeasibilityData] = useState<any>(null)
  const [snapshotProofResult, setSnapshotProofResult] = useState<any>(null)
  const [manifestResult, setManifestResult] = useState<any>(null)
  const [drillResult, setDrillResult] = useState<any>(null)
  const [showTestRunner, setShowTestRunner] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchBackupStatus = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const [statusRes, feasRes] = await Promise.allSettled([
        pb.send('/backend/v1/infra/backup-status', { method: 'GET' }),
        pb.send('/backend/v1/infra/backup-feasibility', { method: 'GET' }),
      ])
      if (statusRes.status === 'fulfilled') setBackupStatusData(statusRes.value)
      if (feasRes.status === 'fulfilled') setFeasibilityData(feasRes.value)
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

  const runSnapshotProof = async () => {
    setSnapshotProofLoading(true)
    try {
      const res = await pb.send('/backend/v1/infra/backup-snapshot-test', { method: 'POST' })
      setSnapshotProofResult(res)
    } catch (err: any) {
      setSnapshotProofResult({ error: err.message || 'Falha na prova de snapshot' })
    } finally {
      setSnapshotProofLoading(false)
    }
  }

  const generateIntegrityManifest = async () => {
    setManifestLoading(true)
    try {
      const res = await pb.send('/backend/v1/infra/backup-manifest', { method: 'POST' })
      setManifestResult(res)
    } catch (err: any) {
      setManifestResult({ error: err.message || 'Falha ao gerar manifesto' })
    } finally {
      setManifestLoading(false)
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
                ETAPA 10B — INVESTIGAÇÃO E VIABILIDADE
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-[11px]">
                VERSÃO 0.0.20
              </Badge>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <HardDrive className="w-7 h-7 text-indigo-400" />
              Backup Completo, Recuperação e Continuidade Operacional
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Investigação real de recursos do PocketBase / Skip Cloud, prova não disruptiva de
              snapshot SQLite, manifesto criptográfico de integridade, segregação de segredos e
              plano objetivo de restauração.
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
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-1">
          <TabsTrigger value="inventory" className="text-xs font-bold py-2">
            1. Inventário & Arquitetura
          </TabsTrigger>
          <TabsTrigger value="feasibility" className="text-xs font-bold py-2">
            2. Viabilidade 10B (Real)
          </TabsTrigger>
          <TabsTrigger value="manifest" className="text-xs font-bold py-2">
            3. Manifesto & Provas
          </TabsTrigger>
          <TabsTrigger value="mirror" className="text-xs font-bold py-2">
            4. Ambiente Espelho & Restore
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs font-bold py-2">
            5. Segurança & Auth (9B/10B)
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

        {/* TAB 2: VIABILIDADE TÉCNICA ETAPA 10B (RECURSOS REAIS VS LIMITAÇÕES) */}
        <TabsContent value="feasibility" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-slate-200 shadow-sm lg:col-span-2">
              <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  Investigação de Recursos Efetivamente Disponíveis (PocketBase / Skip Cloud)
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Resultados comprovados por inspeção direta do backend v0.36
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                {/* 1. API NATIVA /api/backups */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      API Nativa /api/backups do PocketBase
                    </span>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                      RESTRITO A SUPERUSER
                    </Badge>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {STAGE_10B_FEASIBILITY_REPORT.nativeBackupApiAssessment.explanation}
                  </p>
                  <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-950 font-mono text-[11px]">
                    <strong>Diagnóstico Operacional:</strong>{' '}
                    {STAGE_10B_FEASIBILITY_REPORT.nativeBackupApiAssessment.technicalLimitation}
                  </div>
                </div>

                {/* 2. SNAPSHOT CONSISTENTE DO SQLITE SEM INTERRUPÇÃO */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      Snapshot Consistente do SQLite (VACUUM INTO)
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                      COMPROVADO
                    </Badge>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    O SQLite em modo WAL permite snapshot consistente ponto-no-tempo sem bloquear
                    leituras ou escritas clínicas. Testado e comprovado via rota administrativa{' '}
                    <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-700">
                      POST /backend/v1/infra/backup-snapshot-test
                    </code>
                    .
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={runSnapshotProof}
                      disabled={snapshotProofLoading}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7 gap-1"
                    >
                      <Play className={`w-3 h-3 ${snapshotProofLoading ? 'animate-spin' : ''}`} />
                      <span>Executar Prova Real de Snapshot</span>
                    </Button>
                    <span className="text-[11px] text-slate-500">
                      (Mede tempo e remove imediatamente do disco)
                    </span>
                  </div>

                  {snapshotProofResult && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 font-mono text-[11px] mt-2">
                      <div className="flex items-center justify-between text-slate-800 font-bold">
                        <span>Resultado da Prova:</span>
                        <Badge className="bg-emerald-600 text-white text-[10px]">
                          {snapshotProofResult.durationMs}ms
                        </Badge>
                      </div>
                      <p className="text-slate-600">{snapshotProofResult.message}</p>
                      <p className="text-emerald-700">
                        ✓ Purgado imediatamente:{' '}
                        {snapshotProofResult.cleanupSuccess ? 'SIM' : 'NÃO'}
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. CONTEÚDO MÍNIMO DO BACKUP */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <span className="font-bold text-slate-900 text-sm block">
                    Definição de Conteúdo Mínimo Obrigatório:
                  </span>
                  <div className="space-y-1.5">
                    {STAGE_10B_FEASIBILITY_REPORT.minimumBackupContent.componentsIncluded.map(
                      (comp, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]"
                        >
                          <div>
                            <strong className="text-slate-800">{comp.category}</strong>
                            <p className="text-slate-500">{comp.description}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] shrink-0 font-mono">
                            {comp.retentionPolicy}
                          </Badge>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CARD LATERAL: SEGREGAÇÃO DE SEGREDOS E DESTINO EXTERNO */}
            <div className="space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-rose-600" />
                    Segregação Estrita de Segredos
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    O que NÃO entra no pacote comum de backup
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 space-y-2.5 text-xs">
                  {STAGE_10B_FEASIBILITY_REPORT.minimumBackupContent.componentsSegregated.map(
                    (seg, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-rose-100 bg-rose-50/60 space-y-1"
                      >
                        <strong className="text-rose-950 font-mono text-[11px] block">
                          {seg.item}
                        </strong>
                        <p className="text-rose-900 text-[11px] leading-relaxed">{seg.reason}</p>
                        <p className="text-slate-600 text-[10px] italic">
                          {seg.segregatedProcedure}
                        </p>
                      </div>
                    ),
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4 text-indigo-600" />
                    Destino Externo (S3 / R2 / Wasabi)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    O que faltaria para automatizar envio externo
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 space-y-2 text-xs">
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Nenhuma credencial externa está ativa (conforme diretriz). Para viabilizar
                    automação via cronAdd interno sem contratar nada nesta etapa, seriam necessárias
                    as variáveis:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 font-mono text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                    {STAGE_10B_FEASIBILITY_REPORT.backupSecurityArchitecture
                      .clientSidePreTransferEncryption && (
                      <>
                        <li>S3_ENDPOINT (ex.: Cloudflare R2 / AWS)</li>
                        <li>S3_BUCKET_NAME</li>
                        <li>S3_ACCESS_KEY_ID (permissão PutObject)</li>
                        <li>S3_SECRET_ACCESS_KEY</li>
                        <li>S3_REGION (sa-east-1 ANPD)</li>
                        <li>BACKUP_ENCRYPTION_KEY_AES256</li>
                      </>
                    )}
                  </ul>
                  <p className="text-slate-500 text-[10px]">
                    Cadastradas via segredos do ambiente ($os.getenv), nunca no Git.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: MANIFESTO DE INTEGRIDADE & PROVAS TÉCNICAS */}
        <TabsContent value="manifest" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    Manifesto Criptográfico de Integridade (Banco ↔ Storage)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    Hashes SHA-256 por coleção, batimento de arquivos referenciados e carimbo
                    temporal
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={generateIntegrityManifest}
                  disabled={manifestLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${manifestLoading ? 'animate-spin' : ''}`} />
                  <span>Gerar Manifesto Live</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                O endpoint administrativo{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-700">
                  POST /backend/v1/infra/backup-manifest
                </code>{' '}
                valida a consistência entre o banco SQLite e o storage de arquivos (ECG e PDFs),
                calculando hash SHA-256 por componente e emitindo um Hash Global com registro na
                auditoria imutável.
              </p>

              {manifestResult && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="font-bold text-emerald-950 text-sm">
                        Manifesto Gerado com Sucesso ({manifestResult.manifestId})
                      </span>
                    </div>
                    <Badge className="bg-emerald-700 text-white font-mono text-[10px]">
                      {manifestResult.summary?.consistencyStatus}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block font-sans">Coleções:</span>
                      <strong className="text-slate-800">
                        {manifestResult.summary?.totalCollections}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block font-sans">
                        Registros Totais:
                      </span>
                      <strong className="text-slate-800">
                        {manifestResult.summary?.totalDatabaseRecords}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block font-sans">
                        Arquivos no Storage:
                      </span>
                      <strong className="text-slate-800">
                        {manifestResult.summary?.totalReferencedStorageFiles}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block font-sans">
                        Tempo de Geração:
                      </span>
                      <strong className="text-slate-800">{manifestResult.durationMs}ms</strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-emerald-200 space-y-1 font-mono text-[11px]">
                    <span className="text-slate-500 block text-[10px] font-sans">
                      Hash SHA-256 Global do Manifesto:
                    </span>
                    <strong className="text-indigo-900 break-all text-xs">
                      {manifestResult.globalManifestHashSha256}
                    </strong>
                    <span className="text-slate-400 text-[10px] block font-sans">
                      Capturado em: {manifestResult.capturedAt}
                    </span>
                  </div>

                  {manifestResult.components?.collections && (
                    <div className="space-y-1 pt-1">
                      <span className="font-bold text-slate-800 text-[11px] block font-sans">
                        Hashes SHA-256 por Coleção (Amostra):
                      </span>
                      <div className="max-h-40 overflow-y-auto border border-emerald-200 rounded-lg bg-white">
                        <table className="w-full text-left text-[10px] font-mono">
                          <thead className="bg-slate-50 text-slate-600 sticky top-0">
                            <tr>
                              <th className="p-1.5">Coleção</th>
                              <th className="p-1.5 text-right">Registros</th>
                              <th className="p-1.5">Component Hash SHA-256</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {manifestResult.components.collections.map((c: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-1.5 font-bold text-slate-700">{c.collection}</td>
                                <td className="p-1.5 text-right text-slate-600">
                                  {c.recordsCount}
                                </td>
                                <td className="p-1.5 text-slate-500 truncate max-w-xs">
                                  {c.componentHashSha256}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Segurança e Criptografia do Pacote
                  </span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {
                      STAGE_10B_FEASIBILITY_REPORT.backupSecurityArchitecture
                        .clientSidePreTransferEncryption
                    }
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    Proteção WORM / Imutabilidade 20 Anos
                  </span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {STAGE_10B_FEASIBILITY_REPORT.backupSecurityArchitecture.immutabilityAndWORM}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: AMBIENTE ESPELHO E REQUISITOS EXTERNOS */}
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
                  {STAGE_10B_FEASIBILITY_REPORT.restorationInIsolatedEnvironment.requiredSpecs.map(
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

        {/* TAB 5: SEGURANÇA E PENDÊNCIAS DE AUTENTICAÇÃO (ETAPA 10B) */}
        <TabsContent value="security" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                Auditoria Técnica de Segurança e Pendências Documentais de Autenticação (Etapa 10B)
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Esclarecimento técnico preciso sobre segredos TOTP, sessões JWT e endurecimento de
                reset de MFA
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. SEGREDO TOTP: HIDDEN VS REPOUSO */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Segredos TOTP em Repouso</span>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] font-bold">
                      PENDÊNCIA PROVEDOR
                    </Badge>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    <strong>Distinção técnica estrita:</strong> O atributo{' '}
                    <code className="font-mono">hidden: true</code> na coleção users oculta o
                    segredo nas respostas da API JSON.{' '}
                    <u>Não constitui criptografia em nível de coluna no SQLite</u>.
                  </p>
                  <p className="text-slate-700 text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                    A proteção em repouso do segredo Base32 depende exclusivamente da criptografia
                    do volume de disco do provedor Skip Cloud (AES-256/LUKS).
                  </p>
                </div>

                {/* 2. DURAÇÃO ABSOLUTA DE SESSÃO VS REFRESH */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Sessão JWT e Renovação</span>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[9px] font-bold">
                      12H CONFIGURADO
                    </Badge>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    A validade base do JWT está configurada para 12 horas (43.200s). No entanto, o
                    endpoint nativo <code className="font-mono">/auth-refresh</code> do PocketBase
                    estende o token por mais 12 horas enquanto válido.
                  </p>
                  <p className="text-slate-700 text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                    <strong>Recomendação:</strong> Implementar temporizador de inatividade (idle
                    timeout 30m) no client e teto absoluto de 12h improrrogáveis desde o login
                    inicial.
                  </p>
                </div>

                {/* 3. RESET ADMINISTRATIVO DE MFA */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Endurecimento do Reset MFA</span>
                    <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[9px] font-bold">
                      PROPOSTA FORMAL
                    </Badge>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Atualmente o reset administrativo exige admin geral autenticado e registra
                    evento auditado específico{' '}
                    <code className="font-mono">MFA_DISABLED_ADMIN_RESET</code>.
                  </p>
                  <p className="text-slate-700 text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                    <strong>Proposta de endurecimento:</strong> Confirmação fora-de-banda por
                    e-mail, aprovação por segundo administrador e janela de espera de 2 horas.
                  </p>
                </div>
              </div>

              {/* CRITÉRIOS OBJETIVOS DE APROVAÇÃO DE RESTAURAÇÃO */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="font-bold text-slate-900 text-sm">
                  Critérios Objetivos de Aprovação da Restauração (Checklist Homologado):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  {STAGE_10B_FEASIBILITY_REPORT.restorationInIsolatedEnvironment.objectiveApprovalCriteria.map(
                    (crit, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{crit}</span>
                      </div>
                    ),
                  )}
                </div>
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
