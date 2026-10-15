import { useState } from 'react'
import {
  AlertTriangle,
  FileCheck,
  Server,
  ExternalLink,
  ShieldAlert,
  Info,
  CheckCircle2,
  Workflow,
  Sparkles,
  ChevronRight,
  Database,
  Lock,
  Stethoscope,
  Building2,
  Layers,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AUDIT_ITEMS, SUMMARY_STATS } from '@/data/auditReportData'
import { AuditSection } from '@/components/AuditSection'
import { ArchitectureDiagram } from '@/components/ArchitectureDiagram'

export default function Index() {
  const [activeTab, setActiveTab] = useState<'all' | 'A' | 'B' | 'C' | 'D' | 'architecture'>('all')

  const itemsA = AUDIT_ITEMS.filter((i) => i.category === 'A')
  const itemsB = AUDIT_ITEMS.filter((i) => i.category === 'B')
  const itemsC = AUDIT_ITEMS.filter((i) => i.category === 'C')
  const itemsD = AUDIT_ITEMS.filter((i) => i.category === 'D')

  return (
    <div className="space-y-10 pb-12">
      {/* 1. DESTAQUE DE URGÊNCIA / BANNER DE ESTÁGIO (VISUALMENTE INCONFUNDÍVEL) */}
      <div className="sticky top-20 z-40 w-full rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-amber-950 p-4 sm:p-5 shadow-lg border-2 border-amber-300 backdrop-blur-md transition-all hover:scale-[1.005]">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900 shrink-0 shadow-sm">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider bg-amber-900 text-amber-100 px-2.5 py-0.5 rounded-full">
                Instrução Mandatória
              </span>
              <span className="text-xs font-bold text-amber-950">
                Auditoria de Viabilidade Técnica Concluída
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-amber-950 mt-1 leading-snug">
              Diagnóstico técnico apenas. Sistema não implementado. Nenhuma tabela foi criada,
              nenhum domínio apontado e nenhuma integração externa ativada. Aguardando autorização
              expressa para a fase de construção.
            </p>
          </div>
        </div>
      </div>

      {/* 2. CABEÇALHO DO RELATÓRIO & ESCOPO */}
      <div className="space-y-6 pt-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00A6A6]">
            <Stethoscope className="w-4 h-4" />
            <span>Auditoria de Engenharia Clínica & Infraestrutura em Nuvem</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Relatório da Auditoria de Viabilidade Técnica
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 font-normal max-w-4xl leading-relaxed">
            Skip Cloud como Plataforma Principal para a{' '}
            <strong className="text-slate-900 font-semibold">
              Central de Telelaudos em Cardiologia
            </strong>{' '}
            — Modalidade Eletrocardiograma de 12 Derivações (ECG).
          </p>
        </div>

        {/* ESCOPO DA AUDITORIA */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Info className="w-5 h-5 text-[#0E4C92]" />
            <h3>Escopo e Premissas do Diagnóstico Técnico</h3>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Esta auditoria examinou rigorosamente as capacidades{' '}
            <strong className="text-slate-800">
              efetivamente disponíveis no ambiente Skip Cloud (PocketBase v0.36)
            </strong>{' '}
            deste projeto, sem presumir que funcionalidades comerciais anunciadas em documentações
            gerais estão habilitadas ou atendem automaticamente às exigências ético-médicas do CFM,
            SBIS e da LGPD. Foram analisados os pilares de banco de dados relacional, autenticação e
            permissões, arquivos médicos, fila e concorrência clínica, assinatura digital e
            segurança.
          </p>

          {/* INDICADORES EM NÚMEROS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-800 uppercase block tracking-wider">
                  Disponíveis
                </span>
                <span className="text-2xl font-black text-emerald-950">
                  {SUMMARY_STATS.categoryA}
                </span>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>

            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-teal-800 uppercase block tracking-wider">
                  Implementáveis
                </span>
                <span className="text-2xl font-black text-teal-950">{SUMMARY_STATS.categoryB}</span>
              </div>
              <Server className="w-6 h-6 text-teal-600" />
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-amber-800 uppercase block tracking-wider">
                  Integr. Externas
                </span>
                <span className="text-2xl font-black text-amber-950">
                  {SUMMARY_STATS.categoryC}
                </span>
              </div>
              <ExternalLink className="w-6 h-6 text-amber-600" />
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-rose-800 uppercase block tracking-wider">
                  Limitações / Dúvidas
                </span>
                <span className="text-2xl font-black text-rose-950">{SUMMARY_STATS.categoryD}</span>
              </div>
              <ShieldAlert className="w-6 h-6 text-rose-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. NAVEGAÇÃO INTERNA ENTRE SEÇÕES DO RELATÓRIO */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-[#0E4C92] text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Visão Geral Completa</span>
          <Badge variant="secondary" className="ml-1 text-xs">
            {AUDIT_ITEMS.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('A')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'A'
              ? 'bg-emerald-700 text-white shadow-md'
              : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>A. Recursos Disponíveis</span>
          <Badge className="bg-emerald-100 text-emerald-900 border-none ml-1 text-xs">
            {itemsA.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('B')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'B'
              ? 'bg-teal-700 text-white shadow-md'
              : 'bg-white text-teal-800 border border-teal-200 hover:bg-teal-50'
          }`}
        >
          <Server className="w-4 h-4 text-teal-500" />
          <span>B. Implementáveis</span>
          <Badge className="bg-teal-100 text-teal-900 border-none ml-1 text-xs">
            {itemsB.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('C')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'C'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
          }`}
        >
          <ExternalLink className="w-4 h-4 text-amber-500" />
          <span>C. Integrações Externas</span>
          <Badge className="bg-amber-100 text-amber-900 border-none ml-1 text-xs">
            {itemsC.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('D')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'D'
              ? 'bg-rose-700 text-white shadow-md'
              : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span>D. Limitações</span>
          <Badge className="bg-rose-100 text-rose-900 border-none ml-1 text-xs">
            {itemsD.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('architecture')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'architecture'
              ? 'bg-[#0E4C92] text-white shadow-md'
              : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Workflow className="w-4 h-4 text-[#00A6A6]" />
          <span>Arquitetura Recomendada</span>
        </button>
      </div>

      {/* 4. CONTEÚDO PRINCIPAL DO RELATÓRIO DE AUDITORIA */}
      <div className="space-y-8">
        {/* SEÇÃO A: RECURSOS DISPONÍVEIS */}
        {(activeTab === 'all' || activeTab === 'A') && (
          <AuditSection
            category="A"
            icon="A"
            title="Recursos Disponíveis e Verificados no Skip Cloud"
            subtitle="Funcionalidades nativas comprovadas no ambiente que podem ser utilizadas diretamente para modelagem e operação clínica."
            badgeText="Nativo & Pronto para Uso"
            items={itemsA}
          />
        )}

        {/* SEÇÃO B: RECURSOS IMPLEMENTÁVEIS */}
        {(activeTab === 'all' || activeTab === 'B') && (
          <AuditSection
            category="B"
            icon="B"
            title="Recursos Implementáveis Dentro do Skip Cloud"
            subtitle="Funcionalidades que demandam desenvolvimento (pb_hooks, transações SQLite, migrações e regras customizadas), viáveis no ecossistema."
            badgeText="Desenvolvimento no Backend/Frontend"
            items={itemsB}
          />
        )}

        {/* SEÇÃO C: INTEGRAÇÕES EXTERNAS NECESSÁRIAS */}
        {(activeTab === 'all' || activeTab === 'C') && (
          <AuditSection
            category="C"
            icon="C"
            title="Integrações Externas Mandatórias"
            subtitle="Capacidades regulatórias e de telecomunicações que não existem no Skip Cloud e exigem contratação de serviços especializados credenciados."
            badgeText="Exige Provedor Externo Especializado"
            items={itemsC}
          />
        )}

        {/* SEÇÃO D: LIMITAÇÕES E PONTOS NÃO COMPROVADOS */}
        {(activeTab === 'all' || activeTab === 'D') && (
          <AuditSection
            category="D"
            icon="D"
            title="Limitações e Pontos Críticos Não Comprovados"
            subtitle="Pontos de atenção regulatória, ausência de MFA nativo, governança de dados em repouso e localização física de servidores (LGPD)."
            badgeText="Atenção Regulatória / Pendente"
            items={itemsD}
          />
        )}

        {/* SEÇÃO ARQUITETURA RECOMENDADA */}
        {(activeTab === 'all' || activeTab === 'architecture') && (
          <div className="pt-6 border-t border-slate-200">
            <ArchitectureDiagram />
          </div>
        )}
      </div>

      {/* 5. SÍNTESE EXECUTIVA & CONCLUSÃO TÉCNICA */}
      <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0E4C92] flex items-center justify-center font-bold">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#00A6A6] uppercase tracking-wider">
              Diagnóstico Final da Engenharia
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Parecer Técnico de Viabilidade para a Central de Telelaudos
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-700 leading-relaxed">
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Viabilidade Operacional: Favorável com Adaptações
            </h4>
            <p>
              O Skip Cloud (PocketBase v0.36){' '}
              <strong>é plenamente viável como backend principal</strong> para sustentar o fluxo
              clínico de recepção de exames em PDF/PNG/JPEG, fila de laudos, gerenciamento de
              múltiplos perfis e isolamento entre clínicas contratantes via regras no servidor.
            </p>
            <p>
              O mecanismo de ganchos em JavaScript (
              <code className="text-xs bg-slate-100 p-1 rounded font-mono">pb_hooks</code>) é
              robusto o suficiente para implementar a{' '}
              <strong>atribuição exclusiva com trava atômica (mutex)</strong>, o cálculo de hash
              SHA-256 e a máquina de estados que impede colisões entre cardiologistas.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Gargalo Crítico: Assinatura ICP-Brasil & Governança LGPD
            </h4>
            <p>
              O maior ponto cego é a <strong className="text-amber-900">assinatura digital</strong>:
              nenhum sistema médico no Brasil possui validade jurídica sem certificado ICP-Brasil
              com carimbo do tempo (Resolução CFM 2.314/2022). O Skip Cloud não possui esse recurso
              e{' '}
              <strong>
                exigirá a contratação de uma autoridade homologada (ex: Bry Tecnologia, Certisign,
                ZapSign ou similar)
              </strong>
              .
            </p>
            <p>
              Além disso, a conformidade formal com a LGPD e o CFM dependerá de auditoria jurídica
              dos contratos de nuvem (DPA) para atestar a criptografia física dos discos e a
              residência geográfica dos dados.
            </p>
          </div>
        </div>

        {/* CONFIRMAÇÃO FINAL DE AGUARDANDO AUTORIZAÇÃO */}
        <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide">
              Etapa de Auditoria Finalizada com Sucesso. Aguardando comando para iniciar a fase de
              construção.
            </span>
          </div>
          <Badge className="bg-amber-500 text-amber-950 font-bold hover:bg-amber-400">
            Fase: Diagnóstico Concluído
          </Badge>
        </div>

        {/* ACESSO AO RELATÓRIO DA ETAPA 4B */}
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <h5 className="font-bold text-indigo-950 text-sm">
                Etapa 4B Concluída: Homologação do PDF e Preparação ICP-Brasil
              </h5>
              <p className="text-xs text-indigo-800">
                Acesse o dossiê com os resultados dos 10 testes live, diagnóstico estrutural do
                gerador PDF 1.7 e arquitetura plugável para VIDaaS e Bird ID.
              </p>
            </div>
          </div>
          <a
            href="/homologacao"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-sm"
          >
            Acessar Homologação 4B →
          </a>
        </div>
      </div>
    </div>
  )
}
