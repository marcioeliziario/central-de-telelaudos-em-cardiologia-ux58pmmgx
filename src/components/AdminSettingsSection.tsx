import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ShieldCheck,
  FileText,
  Server,
  HardDrive,
  Lock,
  Cpu,
  Clock,
  RotateCcw,
  KeyRound,
  Database,
  CheckCircle2,
  AlertTriangle,
  Terminal,
} from 'lucide-react'
import { MfaSecurityCard } from '@/components/MfaSecurityCard'
import { APP_CONFIG } from '@/config/appConfig'
import { AuditLog } from '@/types/telelaudos'
import { slaService } from '@/services/telelaudosService'
import { Link } from 'react-router-dom'
import SecurityTestRunnerModal from '@/components/SecurityTestRunnerModal'

interface AdminSettingsSectionProps {
  auditLogs: AuditLog[]
  contractSlas: any[]
  slaJobTelemetry: any
  onRefreshData?: () => void
}

export const AdminSettingsSection: React.FC<AdminSettingsSectionProps> = ({
  auditLogs,
  contractSlas,
  slaJobTelemetry,
  onRefreshData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'security_mfa' | 'audit' | 'backup_dr' | 'parameters' | 'tech_info'
  >('security_mfa')

  const [isRefreshingSla, setIsRefreshingSla] = useState(false)

  const handleRefreshSla = async () => {
    setIsRefreshingSla(true)
    try {
      await slaService.runNow()
      if (onRefreshData) await onRefreshData()
      alert('Prazos de SLA reavaliados com sucesso no servidor.')
    } catch (err: any) {
      alert(`Falha ao reavaliar SLA: ${err.message}`)
    } finally {
      setIsRefreshingSla(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sub-navegação secundária de Configurações */}
      <div className="flex flex-wrap items-center gap-1.5 bg-[#F7F6F4] p-1 rounded-lg border border-[#E3E6E8] text-xs">
        <button
          type="button"
          onClick={() => setActiveSubTab('security_mfa')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeSubTab === 'security_mfa'
              ? 'bg-white text-[#2F3942] font-semibold shadow-2xs border border-[#E3E6E8]'
              : 'text-[#6F7780] hover:text-[#2F3942]'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-[#4A90D9]" />
          <span>Segurança e MFA</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeSubTab === 'audit'
              ? 'bg-white text-[#2F3942] font-semibold shadow-2xs border border-[#E3E6E8]'
              : 'text-[#6F7780] hover:text-[#2F3942]'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-[#6F7780]" />
          <span>Auditoria</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('backup_dr')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeSubTab === 'backup_dr'
              ? 'bg-white text-[#2F3942] font-semibold shadow-2xs border border-[#E3E6E8]'
              : 'text-[#6F7780] hover:text-[#2F3942]'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
          <span>Backup e Recuperação</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('parameters')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeSubTab === 'parameters'
              ? 'bg-white text-[#2F3942] font-semibold shadow-2xs border border-[#E3E6E8]'
              : 'text-[#6F7780] hover:text-[#2F3942]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#6F7780]" />
          <span>Parâmetros Administrativos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('tech_info')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeSubTab === 'tech_info'
              ? 'bg-white text-[#2F3942] font-semibold shadow-2xs border border-[#E3E6E8]'
              : 'text-[#6F7780] hover:text-[#2F3942]'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-[#6F7780]" />
          <span>Informações Técnicas</span>
        </button>
      </div>

      {/* 1. SEGURANÇA E MFA */}
      {activeSubTab === 'security_mfa' && (
        <div className="space-y-4">
          <MfaSecurityCard />
        </div>
      )}

      {/* 2. AUDITORIA */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#2F3942]">
                Trilha de Auditoria do Sistema (audit_logs)
              </h3>
              <p className="text-xs text-[#6F7780]">
                Registros imutáveis gerados automaticamente para operações administrativas e
                clínicas.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {auditLogs.length} eventos recentes
            </Badge>
          </div>

          <Card className="border-[#E3E6E8] bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F4] border-b border-[#E3E6E8] text-[#2F3942] font-semibold">
                  <tr>
                    <th className="p-3">Data / Hora</th>
                    <th className="p-3">Ação</th>
                    <th className="p-3">Coleção / Entidade</th>
                    <th className="p-3">Detalhes</th>
                    <th className="p-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6E8]/60 font-mono text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#6F7780] font-sans">
                        Nenhum registro de auditoria disponível no momento.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F7F6F4]/50 transition-colors">
                        <td className="p-3 text-[#6F7780]">
                          {new Date(log.created).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-3 font-bold text-[#2F3942]">{log.action}</td>
                        <td className="p-3 text-[#6F7780]">{log.target_collection}</td>
                        <td className="p-3 text-[#2F3942] font-sans text-xs">{log.details}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]"
                          >
                            {log.status || 'SUCCESS'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 3. BACKUP E RECUPERAÇÃO */}
      {activeSubTab === 'backup_dr' && (
        <div className="space-y-4">
          <Card className="border-[#E3E6E8] bg-white p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#2F3942]">
                  Backup, Restauração e Continuidade Operacional
                </h3>
                <p className="text-xs text-[#6F7780]">
                  Estratégia de retenção de dados clínicos, snapshots do banco e plano de
                  recuperação (DRP).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8]">
                <span className="text-[#6F7780] text-[11px] block">RPO Homologado</span>
                <span className="text-sm font-bold text-[#2F3942] font-mono">&lt; 15 minutos</span>
                <p className="text-[10px] text-[#8C959E] mt-1">
                  Perda máxima tolerável de transações
                </p>
              </div>
              <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8]">
                <span className="text-[#6F7780] text-[11px] block">RTO Homologado</span>
                <span className="text-sm font-bold text-[#2F3942] font-mono">&lt; 2 horas</span>
                <p className="text-[10px] text-[#8C959E] mt-1">
                  Tempo máximo para restabelecimento do serviço
                </p>
              </div>
              <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8]">
                <span className="text-[#6F7780] text-[11px] block">
                  Retenção Médica Obrigatória
                </span>
                <span className="text-sm font-bold text-[#2F3942] font-mono">20 anos</span>
                <p className="text-[10px] text-[#8C959E] mt-1">
                  Conformidade com a Lei Federal nº 13.787/2018
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#E3E6E8]">
              <span className="text-xs text-[#6F7780]">
                Ambiente técnico especializado de homologação de contingência:
              </span>
              <Link to="/admin/backup-continuidade">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Server className="w-3.5 h-3.5 mr-1.5" />
                  <span>Acessar Painel Técnico de Backup & DR</span>
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* 4. PARÂMETROS ADMINISTRATIVOS */}
      {activeSubTab === 'parameters' && (
        <div className="space-y-4">
          <Card className="border-[#E3E6E8] bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#2F3942] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#4A90D9]" />
                  <span>Prazos Contratuais & Agendador Automático de SLA</span>
                </h3>
                <p className="text-xs text-[#6F7780]">
                  Prazos padrão vigentes: Rotina: 24h • Prioritário: 2h • Avaliação contínua por
                  cron.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleRefreshSla}
                disabled={isRefreshingSla}
                className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white text-xs h-8 gap-1.5"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRefreshingSla ? 'animate-spin' : ''}`} />
                <span>{isRefreshingSla ? 'Reavaliando...' : 'Reavaliar Prazos Agora'}</span>
              </Button>
            </div>

            {/* Telemetria do Job */}
            <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#2F3942]">
                  Agendador de Monitoramento de Prazos
                </span>
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]">
                  Ativo (A cada 5 min)
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#6F7780]">
                <div>
                  <span>Job ID:</span>
                  <span className="font-mono text-[#2F3942] block">
                    {slaJobTelemetry?.cronJob?.id || 'sla_monitor_5m'}
                  </span>
                </div>
                <div>
                  <span>Expressão Cron:</span>
                  <span className="font-mono text-[#2F3942] block">
                    {slaJobTelemetry?.cronJob?.schedule || '*/5 * * * *'}
                  </span>
                </div>
                <div>
                  <span>Última Execução:</span>
                  <span className="text-[#2F3942] block">
                    {slaJobTelemetry?.latestExecution?.completedAt
                      ? new Date(slaJobTelemetry.latestExecution.completedAt).toLocaleTimeString(
                          'pt-BR',
                        )
                      : 'Em ciclo regular'}
                  </span>
                </div>
                <div>
                  <span>Status do Agendador:</span>
                  <span className="text-emerald-700 font-semibold block">Operacional</span>
                </div>
              </div>
            </div>

            {/* Lista de Contratos SLA */}
            <div className="overflow-x-auto border border-[#E3E6E8] rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F4] border-b border-[#E3E6E8] text-[#2F3942] font-semibold">
                  <tr>
                    <th className="p-3">Contrato SLA</th>
                    <th className="p-3">Prazo Rotina</th>
                    <th className="p-3">Prazo Prioritário</th>
                    <th className="p-3">Horário de Atendimento</th>
                    <th className="p-3">Alerta de Proximidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6E8]/60">
                  {contractSlas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-[#6F7780]">
                        Nenhum SLA parametrizado.
                      </td>
                    </tr>
                  ) : (
                    contractSlas.map((s) => (
                      <tr key={s.id}>
                        <td className="p-3 font-semibold text-[#2F3942]">{s.contract_name}</td>
                        <td className="p-3 font-mono text-[#2F3942]">{s.routine_sla_hours}h</td>
                        <td className="p-3 font-mono text-amber-700 font-bold">
                          {s.urgent_sla_hours}h
                        </td>
                        <td className="p-3 text-[#6F7780]">
                          {s.business_hours_start || '08:00'} às {s.business_hours_end || '18:00'}
                        </td>
                        <td className="p-3 text-[#6F7780] font-mono">
                          {s.warning_threshold_minutes || 30} min antes
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 5. INFORMAÇÕES TÉCNICAS DO SISTEMA */}
      {activeSubTab === 'tech_info' && (
        <div className="space-y-4">
          <Card className="border-[#E3E6E8] bg-white p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-[#2F3942] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#4A90D9]" />
              <span>Metadados e Especificações Técnicas da Plataforma</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8] space-y-1">
                <span className="text-[#6F7780] text-[11px] block font-semibold">
                  Versão do Sistema
                </span>
                <span className="font-mono text-sm font-bold text-[#2F3942]">
                  {APP_CONFIG.versionLabel}
                </span>
                <p className="text-[10px] text-[#8C959E]">{APP_CONFIG.stageName}</p>
              </div>

              <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8] space-y-1">
                <span className="text-[#6F7780] text-[11px] block font-semibold">
                  Duração da Sessão
                </span>
                <span className="font-mono text-sm font-bold text-[#2F3942]">
                  {APP_CONFIG.sessionDurationLabel}
                </span>
                <p className="text-[10px] text-[#8C959E]">
                  Tempo limite de inatividade: {APP_CONFIG.idleTimeoutLabel}
                </p>
              </div>

              <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8] space-y-1">
                <span className="text-[#6F7780] text-[11px] block font-semibold">
                  Modelo de Assinatura Homologado
                </span>
                <span className="text-sm font-bold text-[#2F3942]">
                  Assinatura Externa ICP-Brasil Individual
                </span>
                <p className="text-[10px] text-[#8C959E]">
                  Assinatura em nuvem individual pelo cardiologista com padrão PAdES
                </p>
              </div>

              <div className="p-3 bg-[#F7F6F4] rounded-lg border border-[#E3E6E8] space-y-1">
                <span className="text-[#6F7780] text-[11px] block font-semibold">
                  Conformidade Normativa
                </span>
                <span className="text-sm font-bold text-[#2F3942]">
                  SBC 2022 • CFM 2.314/2022 • LGPD
                </span>
                <p className="text-[10px] text-[#8C959E]">
                  Auditoria SHA-256 e isolamento rigoroso entre clínicas contratantes
                </p>
              </div>
            </div>

            {/* Painel restrito de Homologação Técnica (somente ambiente autorizado) */}
            <div className="pt-3 border-t border-[#E3E6E8] space-y-2">
              <span className="font-bold text-[#2F3942] text-xs block">
                Ambiente Técnico Autorizado (Restrito a Administradores)
              </span>
              <p className="text-[#6F7780] text-xs leading-relaxed">
                As ferramentas abaixo permanecem totalmente protegidas e ativas no backend para
                auditorias formais, homologação técnica e testes automatizados de segurança.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <SecurityTestRunnerModal />
                <Link to="/admin/auditoria-infra">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4]"
                  >
                    <Server className="w-3.5 h-3.5 mr-1 text-[#6F7780]" />
                    <span>Auditoria de Infraestrutura</span>
                  </Button>
                </Link>
                <Link to="/homologacao">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4]"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1 text-[#6F7780]" />
                    <span>Relatório Homologação 4B</span>
                  </Button>
                </Link>
                <Link to="/auditoria">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-[#E3E6E8] text-[#2F3942] hover:bg-[#F7F6F4]"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1 text-[#6F7780]" />
                    <span>Auditoria de Viabilidade</span>
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
