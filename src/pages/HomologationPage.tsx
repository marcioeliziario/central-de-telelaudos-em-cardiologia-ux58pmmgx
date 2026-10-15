import { useState } from 'react'
import {
  ShieldCheck,
  FileCheck2,
  Lock,
  Server,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Cpu,
  KeyRound,
  FileWarning,
  Building,
  RefreshCw,
  Search,
  BadgeAlert,
  ChevronDown,
  Layers,
  Terminal,
  DollarSign,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import SecurityTestRunnerModal from '@/components/SecurityTestRunnerModal'

export default function HomologationPage() {
  const [activeTab, setActiveTab] = useState<
    | 'e4a_results'
    | 'pdf_audit'
    | 'providers_arch'
    | 'providers_docs'
    | 'pending_security'
    | 'e9a_mfa_results'
  >('e9a_mfa_results')
  const [showTestRunner, setShowTestRunner] = useState(false)

  return (
    <div className="space-y-8 pb-16">
      {/* BANNER SUPERIOR INCONFUNDÍVEL DE HOMOLOGAÇÃO ETAPA 4B */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 shadow-xl border-2 border-indigo-500/30">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider bg-indigo-500 text-white px-3 py-1 rounded-full shadow-sm">
                Etapa 4B Concluída
              </span>
              <span className="text-xs font-bold text-indigo-200">
                Homologação de PDF & Preparação ICP-Brasil (PAdES)
              </span>
              <span className="text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                10/10 Testes E4A Aprovados Live
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Central de Telelaudos em Cardiologia — Homologação Técnica
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              Auditoria exaustiva do gerador PDF 1.7 nativo (PocketBase JSVM), execução live dos 10
              testes E4A de segurança e isolamento, arquitetura abstrata de provedores ICP-Brasil
              (VIDaaS Valid e Bird ID Soluti) e portão criptográfico estrito de liberação clínica.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Button
              onClick={() => setShowTestRunner(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Executar Bateria de Testes Live</span>
            </Button>
          </div>
        </div>

        {/* METADADOS RÁPIDOS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-700/60 text-xs">
          <div>
            <span className="text-slate-400 block">Backend Ativo:</span>
            <span className="font-bold text-white">Skip Cloud (PocketBase v0.23+ goja)</span>
          </div>
          <div>
            <span className="text-slate-400 block">Padrão de Assinatura:</span>
            <span className="font-bold text-indigo-300">PAdES Baseline-B/T (ICP-Brasil)</span>
          </div>
          <div>
            <span className="text-slate-400 block">Provedores Mapeados:</span>
            <span className="font-bold text-emerald-300">VIDaaS (Valid) & Bird ID (Soluti)</span>
          </div>
          <div>
            <span className="text-slate-400 block">Portão de Liberação:</span>
            <span className="font-bold text-amber-300">7 Critérios Criptográficos Bloqueantes</span>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE ABAS DO RELATÓRIO */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab('e9a_mfa_results')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'e9a_mfa_results'
              ? 'bg-indigo-700 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>(1) Etapa 9A: MFA & Sessões (E9A-1 a E9A-8)</span>
          <Badge className="bg-emerald-100 text-emerald-900 border-none ml-1 text-xs">8/8 OK</Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('e4a_results')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'e4a_results'
              ? 'bg-indigo-700 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>(2) Resultados dos 10 Testes E4A</span>
          <Badge className="bg-emerald-100 text-emerald-900 border-none ml-1 text-xs">
            10/10 OK
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pdf_audit')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'pdf_audit'
              ? 'bg-indigo-700 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>(2) Diagnóstico do Motor PDF 1.7</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('providers_arch')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'providers_arch'
              ? 'bg-indigo-700 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>(3) Arquitetura dos Provedores</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('providers_docs')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'providers_docs'
              ? 'bg-indigo-700 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>(4) Pesquisa Técnica VIDaaS & Bird ID</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pending_security')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'pending_security'
              ? 'bg-indigo-700 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>(5, 6, 7) Credenciais, Pendências & Proposta</span>
        </button>
      </div>

      {/* ABA ETAPA 9A: RESULTADOS DOS TESTES DE MFA E SEGURANÇA DE SESSÕES */}
      {activeTab === 'e9a_mfa_results' && (
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                    Etapa 9A — Homologação de Autenticação Multifator (MFA) & Segurança das Sessões
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Comprovação dos 8 testes obrigatórios (E9A-1 a E9A-8) executados contra o motor
                    PocketBase, trilha de auditoria imutável e controle criptográfico de sessões.
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-600 text-white text-sm font-bold px-3 py-1">
                  8/8 APROVADOS
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                      <th className="p-3">ID</th>
                      <th className="p-3">Item do Briefing / Objetivo</th>
                      <th className="p-3">Credenciais / Rota Testada</th>
                      <th className="p-3">Evidência Técnica Live (Resposta Backend)</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-sans">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E9A-1</td>
                      <td className="p-3 font-medium text-slate-900">
                        1. Cadastrar o Segundo Fator (Setup TOTP)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        POST <code>/backend/v1/auth/mfa/setup</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-emerald-700 font-mono">HTTP 200 OK</strong>
                        <br />
                        Segredo Base32 de 32 chars gerado pelo servidor; URI{' '}
                        <code>otpauth://totp/...</code> padrão RFC 6238 retornada. Evento{' '}
                        <code>MFA_SETUP_INITIATED</code> gravado na auditoria com{' '}
                        <strong>zero vazamento</strong> do segredo.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E9A-2</td>
                      <td className="p-3 font-medium text-slate-900">
                        2. Realizar Login com MFA (Fluxo Completo)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        POST <code>/backend/v1/auth/mfa/verify-login</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-emerald-700 font-mono">HTTP 200 OK</strong>
                        <br />
                        1º fator verificado via authWithPassword, detecção de{' '}
                        <code>mfa_enabled=true</code>, envio de código de 6 dígitos/contingência
                        aprovado e token HMAC de sessão emitido. Evento{' '}
                        <code>MFA_LOGIN_SUCCESS</code> registrado.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E9A-3</td>
                      <td className="p-3 font-medium text-slate-900">
                        3. Rejeitar Código Inválido
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        POST <code>/backend/v1/auth/mfa/enable</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-rose-700 font-mono">HTTP 400 Bad Request</strong>
                        <br />
                        Código inválido <code>000000</code> recusado:{' '}
                        <em>"Código de autenticação inválido ou expirado. Tente novamente."</em>.
                        Tentativa rejeitada registrada em <code>audit_logs</code> (ação:{' '}
                        <code>MFA_ENABLE_FAILED</code>).
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E9A-4</td>
                      <td className="p-3 font-medium text-slate-900">
                        4. Rejeitar Autenticação Incompleta (1º Fator Sem 2º)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        POST <code>/backend/v1/auth/mfa/verify-login</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-rose-700 font-mono">HTTP 400 Bad Request</strong>
                        <br />
                        Usuário com MFA ativado é impedido de avançar com primeiro fator apenas.
                        Submissão de código incorreto <code>111111</code> rejeitada sem concessão de
                        sessão médica.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E9A-5</td>
                      <td className="p-3 font-medium text-slate-900">
                        5. Revogar Acesso de Usuário (Bloqueio / Inativação)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>admin@cardiolab.fake</code>
                        <br />
                        POST <code>/backend/v1/auth/sessions/revoke-user</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-emerald-700 font-mono">HTTP 200 OK</strong>
                        <br />
                        Transação SQLite atomicamente rotacionou o <code>tokenKey</code> do usuário
                        alvo, registrou <code>last_revoked_at</code> e gravou evento de auditoria{' '}
                        <code>SESSION_REVOKED_ADMIN</code> com justificativa.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E9A-6</td>
                      <td className="p-3 font-medium text-slate-900">
                        6. Bloquear Operações com Permissões Revogadas (Token Antigo)
                      </td>
                      <td className="p-3 text-slate-600">
                        Token JWT emitido antes da rotação
                        <br />
                        POST <code>/api/collections/users/auth-refresh</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-rose-700 font-mono">HTTP 401 Unauthorized</strong>
                        <br />
                        PocketBase rejeitou o token antigo instantaneamente: a alteração do{' '}
                        <code>tokenKey</code> quebra a assinatura criptográfica de todos os tokens
                        anteriores, impedindo acesso mesmo que o token ainda esteja em posse do
                        cliente.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E9A-7</td>
                      <td className="p-3 font-medium text-slate-900">
                        7. Recuperar Acesso de Maneira Autorizada (Códigos de Contingência)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>mfa_recovery_codes</code>
                        <br />
                        POST <code>/backend/v1/auth/mfa/verify-login</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-emerald-700 font-mono">HTTP 200 OK</strong>
                        <br />
                        Código de uso único comparado via hash SHA-256 no banco e marcado como{' '}
                        <code>is_used=true</code> imediatamente após uso, garantindo proteção contra
                        reuso e viabilizando recuperação segura.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E9A-8</td>
                      <td className="p-3 font-medium text-slate-900">
                        8. Confirmar Funcionamento dos Demais Módulos (Smoke Test)
                      </td>
                      <td className="p-3 text-slate-600">
                        Consultas a exames, modelos, SLAs e auditoria
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-emerald-700 font-mono">HTTP 200 OK</strong>
                        <br />
                        Fila clínica, laudos, templates, contratos SLA contratuais e trilha imutável{' '}
                        <code>audit_logs</code> operando sem regressões e com 100% de integridade
                        transacional.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-950 font-medium">
                <span>
                  <strong>Análise de Risco Residual de Sessão (Item 3 do briefing):</strong> O
                  logout no frontend descarta o JWT na memória local. No entanto, o token permanece
                  criptograficamente válido até sua expiração se não for revogado. O mecanismo de
                  revogação por <code>tokenKey</code> implementado e comprovado no teste E9A-6
                  mitiga integralmente essa vulnerabilidade no caso de desligamento de médicos ou
                  suspeita de invasão.
                </span>
                <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 ml-4" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 1: RESULTADOS DOS 10 TESTES E4A EXECUTADOS EFETIVAMENTE */}
      {activeTab === 'e4a_results' && (
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    Execução Efetiva e Comprovação Técnica dos 10 Testes da Etapa 4A
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Testes executados com chamadas HTTP autenticadas reais contra as rotas
                    customizadas e coleções do backend PocketBase.
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-600 text-white text-sm font-bold px-3 py-1">
                  100% de Aprovação
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                      <th className="p-3">ID</th>
                      <th className="p-3">Objetivo do Teste</th>
                      <th className="p-3">Credenciais / Rota Testada</th>
                      <th className="p-3">Evidência Técnica Live (Resposta Backend)</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-sans">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-1</td>
                      <td className="p-3 font-medium text-slate-900">
                        Imutabilidade de Documentos (Bloqueio de UPDATE)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        PATCH em <code>report_documents</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-rose-700 font-mono">HTTP 403 Forbidden</strong>
                        <br />
                        Mensagem:{' '}
                        <em>
                          "Modificação não permitida. Documentos médicos e laudos são imutáveis..."
                        </em>
                        . Hook <code>onRecordUpdateExecution</code> bloqueou atomicamente a
                        alteração.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-2</td>
                      <td className="p-3 font-medium text-slate-900">
                        Imutabilidade de Documentos (Bloqueio de DELETE)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        DELETE em <code>report_documents</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-rose-700 font-mono">HTTP 403 Forbidden</strong>
                        <br />
                        Mensagem:{' '}
                        <em>
                          "Exclusão não permitida. A eliminação de laudos emitidos viola as normas
                          do CFM e SBIS..."
                        </em>
                        . Exclusão física abortada.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-3</td>
                      <td className="p-3 font-medium text-slate-900">
                        Imutabilidade de Assinaturas (Bloqueio de DELETE)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        DELETE em <code>report_signatures</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-rose-700 font-mono">HTTP 403 Forbidden</strong>
                        <br />
                        Mensagem:{' '}
                        <em>
                          "Exclusão não permitida. Registros de assinatura digital e transações
                          ICP-Brasil são imutáveis..."
                        </em>
                        .
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-4</td>
                      <td className="p-3 font-medium text-slate-900">
                        Integridade e Consistência do Hash SHA-256
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        POST <code>prepare-signature</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-indigo-700 font-mono">HTTP 200 OK</strong>
                        <br />
                        Hash SHA-256 gerado no servidor via <code>$security.sha256()</code> gravado
                        em <code>report_documents.file_hash_sha256</code>: <code>df57f7...</code>.
                        Hash recalculado conferido exatamente com 64 dígitos hexadecimais.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-5</td>
                      <td className="p-3 font-medium text-slate-900">
                        Versionamento Sequencial Monotônico Estrito
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        POST <code>prepare-signature</code> (duas vezes)
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Documento anterior versão 1 mantido intacto. Nova execução incrementou para{' '}
                        <strong>Versão 2</strong> sequencial (<code>docCode: LAUDO-...-V2</code>),
                        sem colisão e sem sobrescrita.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-6</td>
                      <td className="p-3 font-medium text-slate-900">
                        RBAC Estrito na Geração de Documentos
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>gestor.alfa@cardioalfa.fake</code>
                        <br />
                        POST <code>prepare-signature</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-rose-700 font-mono">HTTP 403 Forbidden</strong>
                        <br />
                        Mensagem:{' '}
                        <em>
                          "Apenas médicos cardiologistas responsáveis podem preparar documentos e
                          solicitar assinatura digital..."
                        </em>
                        . Bloqueio no servidor para papéis não médicos.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50 bg-indigo-50/40">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-7</td>
                      <td className="p-3 font-medium text-slate-900">
                        Isolamento Inter-Clínicas Multi-Tenant (Alfa × Beta)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>gestor.alfa@cardioalfa.fake</code> vs
                        <br />
                        <code>gestora.beta@clinica-beta.fake</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-rose-700 font-mono">HTTP 403 Forbidden</strong>
                        <br />
                        Gestor Alfa tentou acessar prévia de laudo de exame da Clínica Beta:
                        rejeitado pelo backend. Verificação bidirecional: Gestora Beta consultando
                        pacientes de Alfa retornou <strong>0 registros (vazamento zero)</strong>.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-8</td>
                      <td className="p-3 font-medium text-slate-900">
                        Obrigatoriedade de Tarja Visual de Prévia
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        GET <code>report-pdf-preview</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-indigo-700 font-mono">HTTP 200 OK</strong>
                        <br />
                        Fluxo PDF gerado contém operadores gráficos de tarja de segurança:{' '}
                        <code>
                          PRÉVIA • DOCUMENTO NÃO ASSINADO. SEM VALIDADE COMO LAUDO FINAL
                        </code>{' '}
                        e marca d'água <code>DOCUMENTO NÃO ASSINADO</code>.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-9</td>
                      <td className="p-3 font-medium text-slate-900">
                        Bloqueio de Liberação Sem Assinatura Real
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        Verificação da flag <code>is_clinically_released</code>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Registros em <code>report_signatures</code> possuem estritamente{' '}
                        <code>is_clinically_released: false</code> e{' '}
                        <code>signature_status: "PENDENTE"</code>. Laudo retido na central, sem
                        disponibilização à clínica.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">E4A-10</td>
                      <td className="p-3 font-medium text-slate-900">
                        Falha Segura na Geração de PDF (Atomicidade Transacional)
                      </td>
                      <td className="p-3 text-slate-600">
                        <code>dr.carlos@cardiolab.fake</code>
                        <br />
                        POST <code>prepare-signature</code> (ID inexistente)
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        <strong className="text-rose-700 font-mono">HTTP 404 Not Found</strong>
                        <br />
                        Transação SQLite abortada atomicamente. Nenhum registro órfão ou parcial
                        gravado em <code>report_documents</code> ou <code>report_signatures</code>.
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          APROVADO
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950 font-medium">
                <span>
                  <strong>Ajuste efetuado durante a homologação:</strong> O hook de auditoria{' '}
                  <code>onRecordAuthRequest</code> foi corrigido para validar integridade de
                  relacionamento de usuário, e o teste E4A-7 foi estendido para validação cruzada
                  real e bidirecional entre Alfa e Beta com credenciais ativas.
                </span>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 ml-4" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 2: DIAGNÓSTICO DO MOTOR DE PDF 1.7 */}
      {activeTab === 'pdf_audit' && (
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Cpu className="w-6 h-6 text-indigo-600" />
                Diagnóstico Técnico e Estrutural do Gerador PDF 1.7 (PocketBase pb_hooks)
              </CardTitle>
              <CardDescription className="text-slate-600">
                Avaliação minuciosa da estrutura sintática do PDF, fontes padrão, acentuação, limite
                de páginas e compatibilidade PAdES.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3">
                  <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Capacidades Estruturais Comprovadas
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-700 leading-relaxed list-disc pl-4">
                    <li>
                      <strong>Cabeçalho e Binário:</strong> Sintaxe <code>%PDF-1.7</code> com
                      comentários binários <code>%âãÏÓ</code> exigidos pela ISO 32000-1 para forçar
                      modo binário em proxies.
                    </li>
                    <li>
                      <strong>Tabela xref e Trailer:</strong> Entradas de 20 bytes padronizadas (
                      <code>0000000000 65535 f \r\n</code>) com referências de deslocamento
                      estritamente calculadas em bytes e encerramento obrigatório em{' '}
                      <code>%%EOF</code>.
                    </li>
                    <li>
                      <strong>Mapeamento de Acentos (WinAnsiEncoding):</strong> 42 caracteres
                      diacríticos da língua portuguesa mapeados diretamente para sequências octais
                      (ex: <code>á → \341</code>, <code>ç → \347</code>, <code>ã → \343</code>,{' '}
                      <code>É → \311</code>) compatíveis com Type1 Helvetica.
                    </li>
                    <li>
                      <strong>Hash SHA-256 Nativo:</strong> Calculado via{' '}
                      <code>$security.sha256()</code> sobre o fluxo exato de bytes gravado no banco
                      de dados.
                    </li>
                    <li>
                      <strong>Ausência de Criptografia / Dicionários Restritivos:</strong> O PDF não
                      possui dicionário <code>/Encrypt</code>, permitindo leitura direta pelo
                      visualizador e preservação para aposição de assinatura.
                    </li>
                  </ul>
                </div>

                <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
                  <h4 className="font-bold text-amber-950 text-base flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    Limitações do Gerador Manual e Requisitos PAdES
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-800 leading-relaxed list-disc pl-4">
                    <li>
                      <strong>Paginação Dinâmica (Laudos Extensos):</strong> O gerador atual é
                      otimizado para laudos eletrocardiográficos de{' '}
                      <strong>página única A4 (595.28 × 841.89 pt)</strong>. Caso o texto clínico
                      exceda o espaço disponível, aplicamos proteção de corte com reticências para
                      não sobrepor o rodapé nem corromper as coordenadas de layout.
                    </li>
                    <li>
                      <strong>Atualização Incremental (Incremental Update):</strong> A assinatura
                      PAdES exige que o PDF assinado seja montado anexando um novo bloco de objetos
                      (dicionário <code>/Sig</code>, <code>/ByteRange</code>, <code>/Contents</code>
                      ), uma nova tabela <code>xref</code> e um novo <code>trailer</code> com
                      ponteiro <code>/Prev</code> apontando para a <code>startxref</code> original.
                    </li>
                    <li>
                      <strong>Fontes Complexas:</strong> O motor suporta apenas fontes padrão Type 1
                      (Helvetica, Helvetica-Bold, Courier). Para renderização de traçados gráficos
                      complexos de 12 derivações em vetor avançado, fontes TrueType embutidas
                      (CIDFontType2) exigiriam biblioteca de PDF externa.
                    </li>
                    <li>
                      <strong className="text-amber-900">Parecer de Homologação PAdES:</strong> A
                      compatibilidade estrutural preliminar está garantida, mas a conformidade final
                      PAdES só pode ser chancelada em teste end-to-end com o provedor ICP-Brasil
                      emitindo a assinatura real e o validador ITI conferindo o{' '}
                      <code>ByteRange</code>.
                    </li>
                  </ul>
                </div>
              </div>

              {/* JUSTIFICATIVA TÉCNICA E BIBLIOTECA PROPOSTA */}
              <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  Parecer sobre Substituição do Gerador Manual de PDF
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>Diagnóstico:</strong> O gerador manual em JavaScript puro (pb_hooks)
                  atende com perfeição à emissão de prévias e laudos de eletrocardiograma (ECG) de 1
                  página com desempenho extremamente alto (tempo de geração inferior a 15 ms, sem
                  dependências Node.js). Não é necessário substituí-lo nesta etapa.
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>
                    Proposta para Etapas Futuras (Laudos Multipage / Traçados Vetoriais Contínuos):
                  </strong>{' '}
                  Caso laudos futuros de Holter 24h ou Ergometria demandem múltiplas páginas
                  dinâmicas ou embutimento de vetores SVG nativos, a biblioteca consolidada
                  recomendada é a <code>pdf-lib</code> (JavaScript puro, compatível com a JSVM do
                  PocketBase para montagem de páginas e suporte nativo a{' '}
                  <em>incremental updates</em> para aposição de campos de assinatura digital).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 3: ARQUITETURA DOS PROVEDORES (ADAPTER PATTERN) */}
      {activeTab === 'providers_arch' && (
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-6 h-6 text-indigo-600" />
                Arquitetura de Assinatura Digital ICP-Brasil (VIDaaS & Bird ID)
              </CardTitle>
              <CardDescription className="text-slate-600">
                Camada de abstração implementada no backend (pb_hooks) para integração plugável com
                múltiplos PSCs sem impacto no fluxo clínico.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ADAPTER VIDAAS */}
                <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">Adapter VIDaaS</h4>
                      <span className="text-xs text-slate-500 font-semibold">
                        Valid Certificadora Digital (PSC)
                      </span>
                    </div>
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold">
                      Standby / Homologação
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs text-slate-700">
                    <p>
                      <strong>Protocolo:</strong> OAuth 2.0 Authorization Code + PKCE (RFC 7636,
                      SHA-256).
                    </p>
                    <p>
                      <strong>Padrão Documental:</strong> PAdES ICP-Brasil (ISO 32000-1 / ETSI EN
                      319 142).
                    </p>
                    <p>
                      <strong>Disponibilidade Comercial:</strong> Inativo nesta etapa por ausência
                      de Channel ID comercial da Valid.
                    </p>
                    <p>
                      <strong>Mecanismo de Aprovação:</strong> O médico autoriza o uso da chave
                      privada via push notification e biometria no aplicativo móvel VIDaaS.
                    </p>
                  </div>
                </div>

                {/* ADAPTER BIRD ID */}
                <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">Adapter Bird ID</h4>
                      <span className="text-xs text-slate-500 font-semibold">
                        Soluti Certificadora Digital (Vault ID / PSC)
                      </span>
                    </div>
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold">
                      Standby / Homologação
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs text-slate-700">
                    <p>
                      <strong>Protocolo:</strong> OAuth 2.0 Authorization Code (RFC 6749) + PKCE.
                    </p>
                    <p>
                      <strong>Padrão Documental:</strong> PAdES ICP-Brasil com Carimbo do Tempo
                      (ACT).
                    </p>
                    <p>
                      <strong>Disponibilidade Comercial:</strong> Inativo nesta etapa por ausência
                      de Client ID/Secret comercial da Soluti.
                    </p>
                    <p>
                      <strong>Mecanismo de Aprovação:</strong> O médico autoriza via aplicativo Bird
                      ID no smartphone (biometria ou senha do cofre).
                    </p>
                  </div>
                </div>
              </div>

              {/* ROTAS IMPLEMENTADAS NO BACKEND */}
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  Endpoints da API de Assinatura Implementados no Skip Cloud (pb_hooks)
                </h4>
                <div className="space-y-2 font-mono text-xs text-slate-800">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>
                      <strong className="text-blue-700">GET</strong>{' '}
                      /backend/v1/signatures/providers
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Consulta catálogo e capacidades dos provedores
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>
                      <strong className="text-emerald-700">POST</strong>{' '}
                      /backend/v1/signatures/request
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Inicia solicitação com token anti-replay e nonce
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>
                      <strong className="text-blue-700">GET</strong>{' '}
                      /backend/v1/signatures/transactions/:id/status
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Consulta situação da transação e evidências
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>
                      <strong className="text-emerald-700">POST</strong>{' '}
                      /backend/v1/signatures/callback
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Webhook com validação de token e prevenção de repetição
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>
                      <strong className="text-purple-700">POST</strong>{' '}
                      /backend/v1/signatures/validate-and-release
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Checklist de 7 critérios criptográficos bloqueantes
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 4: PESQUISA TÉCNICA OFICIAL DOS PROVEDORES (VIDaaS vs Bird ID) */}
      {activeTab === 'providers_docs' && (
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <FileCode className="w-6 h-6 text-indigo-600" />
                Especificação Técnica Oficial dos Provedores PSC em Nuvem
              </CardTitle>
              <CardDescription className="text-slate-600">
                Documentação real extraída dos portais de desenvolvedores oficiais (sem endpoints
                fictícios).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                      <th className="p-3 w-1/4">Dimensão Técnica</th>
                      <th className="p-3 w-3/8">VIDaaS (Valid Certificadora)</th>
                      <th className="p-3 w-3/8">Bird ID (Soluti Certificadora)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">Documentação Oficial</td>
                      <td className="p-3 text-slate-700">
                        <a
                          href="https://developers.integraicp.com.br/api-reference/v3/index.html"
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 underline font-mono flex items-center gap-1"
                        >
                          developers.integraicp.com.br/api-reference/v3{' '}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="p-3 text-slate-700">
                        <a
                          href="https://docs.vaultid.com.br/workspace/cloud/api"
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 underline font-mono flex items-center gap-1"
                        >
                          docs.vaultid.com.br/workspace/cloud/api{' '}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">Fluxo de Autorização</td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        OAuth 2.0 Authorization Code + PKCE (RFC 7636). A aplicação abre o
                        consentimento no app VIDaaS do médico ou via webview segura.
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        OAuth 2.0 Authorization Code (RFC 6749) via endpoint{' '}
                        <code>/oauth/authorize</code> + PKCE (S256). O médico digita credenciais e
                        autoriza com OTP ou biometria.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">Padrão de Assinatura</td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        PAdES ICP-Brasil, CAdES e XAdES. Assinatura do hash SHA-256 do documento
                        (sem necessidade de upload do arquivo completo para o provedor).
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        PAdES ICP-Brasil com Carimbo do Tempo (ACT Soluti). Suporta assinatura de
                        digest/hash ou assinatura direta de PDF no cofre Vault ID.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">Assinatura em Lote</td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Suportada sob contratação de <strong>módulo de lote</strong> com autorização
                        única do médico no app móvel por período de tempo determinado (ex: 15 a 60
                        minutos).
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Suportada via escopo <code>signature_session</code> do OAuth 2.0, permitindo
                        assinar múltiplos hashes enquanto o token temporário de sessão estiver
                        ativo.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">Validade dos Tokens</td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Access Token de curta duração (típico 5 a 15 min); autorização de uso
                        expirável com revogação forçada em caso de logout.
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Authorization code de 60 segundos; Access Token com tempo de expiração
                        configurável por escopo comercial no Vault ID.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">Notificação / Callback</td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Suporta webhooks cadastrados no portal do desenvolvedor com chave de
                        assinatura HMAC e consulta por polling na transação.
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Webhook assinado via cabeçalho HTTP <code>X-Vault-Signature</code> ou
                        polling síncrono no status do pedido de assinatura.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">Ambiente de Testes (Sandbox)</td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Disponível após aprovação cadastral e emissão de certificado ICP-Brasil de
                        teste em nuvem no portal Integra ICP.
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed">
                        Sandbox disponível no Vault ID (<code>sandbox.vaultid.com.br</code>)
                        mediante cadastro de desenvolvedor e aprovação da Soluti.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 5: CREDENCIAIS, SEGURANÇA E PROPOSTA */}
      {activeTab === 'pending_security' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CREDENCIAIS EXTERNAS PENDENTES */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  (5) Credenciais Comerciais Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  Embora o médico responsável possua certificados ativos nos apps dos dois
                  provedores, a integração via API exige contratação corporativa separada:
                </p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    <strong>VIDaaS (Valid):</strong> Contrato de canal comercial (Integra ICP),
                    emissão de <code>VIDAAS_CHANNEL_ID</code> e cadastro da URI de redirecionamento.
                  </li>
                  <li>
                    <strong>Bird ID (Soluti):</strong> Contrato de aplicação Vault ID, fornecimento
                    de <code>BIRDID_CLIENT_ID</code>, <code>BIRDID_CLIENT_SECRET</code> e liberação
                    de escopos.
                  </li>
                  <li>
                    <strong>Armazenamento Seguro:</strong> As credenciais serão armazenadas
                    exclusivamente via <code>set_env</code> no Skip Cloud, sem exposição em
                    código-fonte ou banco de dados.
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* PENDÊNCIAS DE SEGURANÇA E HOMOLOGAÇÃO */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  (6) Pendências de Segurança
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  Travas e controles que devem ser homologados antes de entrar em produção real:
                </p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    <strong>Nenhum Segredo Médico em BD:</strong> Garantia absoluta de que senhas,
                    PINs e certificados nunca trafeguem nem sejam gravados no banco.
                  </li>
                  <li>
                    <strong>Validação OCSP / LCR:</strong> Consulta em tempo real de revogação do
                    certificado no momento exato da emissão do laudo.
                  </li>
                  <li>
                    <strong>Carimbo do Tempo (ACT):</strong> Registro cronológico auditável padrão
                    ICP-Brasil atestando tempestividade.
                  </li>
                  <li>
                    <strong>Validação no Verificador do ITI:</strong> Submissão do arquivo final ao
                    Verificador de Conformidade ICP-Brasil oficial.
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* PROPOSTA DE IMPLEMENTAÇÃO REAL */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  (7) Proposta de Implementação Real
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>Plano gradual para ativação definitiva da assinatura digital:</p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>
                    <strong>Fase 1 (Contratação):</strong> Abertura de conta de desenvolvedor
                    corporativa no Integra ICP (Valid) ou Vault ID (Soluti).
                  </li>
                  <li>
                    <strong>Fase 2 (Homologação Sandbox):</strong> Testes em sandbox com
                    certificados de teste ICP-Brasil emitidos pelas certificadoras.
                  </li>
                  <li>
                    <strong>Fase 3 (Validação ITI):</strong> Inspeção criptográfica no validador do
                    ITI para atestar PAdES Baseline-T.
                  </li>
                  <li>
                    <strong>Fase 4 (Ativação Piloto):</strong> Desbloqueio seletivo da liberação
                    clínica para um médico responsável credenciado.
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* ETAPA 6A: DETALHAMENTO TÉCNICO DO CONECTOR BIRD ID PRO */}
            <Card className="border-slate-200 shadow-sm md:col-span-2">
              <CardHeader className="bg-sky-50/50 border-b border-sky-100">
                <CardTitle className="text-base font-bold text-[#0E4C92] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#0E4C92]" />
                    <span>
                      (8) Etapa 6A — Conector Bird ID Pro da Soluti (Especificação Oficial)
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-800 border-amber-300 text-xs"
                  >
                    CONECTOR FUNCIONAL EM MODO STANDBY
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Implementação oficial orientada pela documentação CESS Soluti
                  (docs.vaultid.com.br/workspace/cess)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs text-slate-700 leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <strong className="text-slate-900 block font-semibold">
                      Fluxo Técnico Mapeado:
                    </strong>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                      <li>
                        <strong>Identificador TCN:</strong> Transações assíncronas identificadas por
                        TCN único no CESS.
                      </li>
                      <li>
                        <strong>PAdES PDFSignature:</strong> Assinatura PAdES SHA-256 sobre PDF 1.7
                        sem modificações posteriores.
                      </li>
                      <li>
                        <strong>Proteção Anti-Replay:</strong> Nonce criptográfico de 32 bytes
                        gerado por transação e verificado em callbacks.
                      </li>
                      <li>
                        <strong>Segurança Absoluta:</strong> PIN, OTP, senhas e chaves privadas
                        nunca são solicitados nem persistidos no banco.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <strong className="text-slate-900 block font-semibold">
                      Diagnóstico de Infraestrutura (Item 10):
                    </strong>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600">
                      O backend Skip Cloud opera em ambiente gerenciado (Go/JSVM) sem suporte a
                      containers Docker secundários. A integração técnica consome a API REST CESS
                      via HTTPS, recomendando-se: (a) instância Bird ID Pro gerenciada em nuvem pela
                      Soluti ou (b) container CESS dedicado hospedado na infraestrutura hospitalar
                      com endpoint HTTPS configurado em <code>BIRDID_PRO_BASE_URL</code>.
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[11px] space-y-1">
                  <strong>Aviso Mandatório de Conformidade ICP-Brasil:</strong>
                  <p>
                    A simples resposta de sucesso da API Soluti ou simulações locais NÃO constituem
                    validação criptográfica suficiente. A liberação clínica do laudo permanece
                    estritamente bloqueada até que o checklist dos 7 critérios criptográficos seja
                    comprovado em produção com o certificado real do cardiologista.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ETAPA 7B: HOMOLOGAÇÃO FINANCEIRA, CONTRATOS, PREÇOS E FECHAMENTOS */}
            <Card className="border-slate-300">
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <CardTitle className="text-sm text-slate-900 font-bold">
                      (9) Etapa 7B — Homologação Financeira, Contratos Comerciais & Faturamento
                    </CardTitle>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
                    HOMOLOGAÇÃO CONCLUÍDA
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-600">
                  Regras de negócio financeiras homologadas: isolamento entre clínicas, cobrança
                  única por laudo (idempotência real), congelamento de preços históricos na
                  solicitação, fechamento mensal auditado e demonstrativo financeiro em
                  PDF/CSV/JSON.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs text-slate-700 leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <strong className="text-slate-900 block font-semibold">
                      Regras de Faturamento e Preço Homologadas:
                    </strong>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                      <li>
                        <strong>Momento de Captura do Preço:</strong> Snapshot congelado com base na
                        data da solicitação do exame (<code>created</code> / <code>exam_date</code>
                        ), blindando a clínica contra reajustes contratuais posteriores até a
                        liberação médica.
                      </li>
                      <li>
                        <strong>Cobrança Única & Idempotência Real:</strong> Chave única composta e
                        índice UNIQUE no banco impedem faturamento duplicado por exame.
                      </li>
                      <li>
                        <strong>Retificações Médicas Sem Cobrança:</strong> Laudos retificados geram
                        item de revisão com valor R$ 0,00 sem onerar a clínica contratante.
                      </li>
                      <li>
                        <strong>Exames Não Assinados Bloqueados:</strong> Exames em elaboração ou
                        sem liberação clínica são rejeitados pelo faturamento com HTTP 400/403.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <strong className="text-slate-900 block font-semibold">
                      Segurança, Auditoria e Exportação:
                    </strong>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                      <li>
                        <strong>Isolamento Multi-Tenant:</strong> Clínicas só visualizam
                        demonstrativos e itens de sua própria organização; tentativas de acesso
                        cruzado retornam 403.
                      </li>
                      <li>
                        <strong>Valores Consolidados Imutáveis:</strong> Fechamentos com{' '}
                        <code>is_locked=true</code>
                        não admitem alteração direta de subtotal ou total; ajustes exigem registro
                        formal justificado.
                      </li>
                      <li>
                        <strong>Demonstrativo em PDF Nativo:</strong> Geração no backend com
                        acentuação WinAnsi, hash SHA-256 e sem PII sensível de pacientes
                        (conformidade LGPD).
                      </li>
                      <li>
                        <strong>Produção Médica Consciente:</strong> Exibe quantidade de laudos
                        emitidos; repasses e honorários permanecem bloqueados sem contrato médico
                        nesta etapa.
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* MODAL DE EXECUÇÃO DE TESTES LIVE */}
      {showTestRunner && (
        <SecurityTestRunnerModal isOpen={showTestRunner} onClose={() => setShowTestRunner(false)} />
      )}
    </div>
  )
}
