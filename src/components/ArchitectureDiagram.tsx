import { useState } from 'react'
import {
  Server,
  Layers,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Database,
  FileKey,
  Users,
  Lock,
  Workflow,
  Radio,
  Clock,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ARCHITECTURE_BLOCKS } from '@/data/auditReportData'

export function ArchitectureDiagram() {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)

  const getLayerIcon = (layer: string) => {
    switch (layer) {
      case 'frontend':
        return <Layers className="w-5 h-5 text-blue-600" />
      case 'backend':
        return <Server className="w-5 h-5 text-teal-600" />
      case 'external':
        return <ExternalLink className="w-5 h-5 text-amber-600" />
      case 'security':
        return <ShieldCheck className="w-5 h-5 text-emerald-600" />
      default:
        return <Database className="w-5 h-5 text-slate-600" />
    }
  }

  const getLayerBorder = (layer: string) => {
    switch (layer) {
      case 'frontend':
        return 'border-blue-200 hover:border-blue-500 hover:shadow-blue-100'
      case 'backend':
        return 'border-teal-200 hover:border-teal-500 hover:shadow-teal-100'
      case 'external':
        return 'border-amber-200 hover:border-amber-500 hover:shadow-amber-100'
      case 'security':
        return 'border-emerald-200 hover:border-emerald-500 hover:shadow-emerald-100'
      default:
        return 'border-slate-200'
    }
  }

  return (
    <div className="space-y-8">
      {/* CABEÇALHO DO DIAGRAMA */}
      <div className="bg-gradient-to-r from-[#0E4C92] to-[#00A6A6] text-white p-6 sm:p-8 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-teal-300" />
            Topologia de Alta Fidelidade Clínica
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
            Arquitetura Recomendada: Máxima Utilização do Skip Cloud com Delegação Especializada
          </h3>
          <p className="text-slate-100 text-sm leading-relaxed">
            O ecossistema foi projetado para extrair 100% da capacidade nativa do Skip Cloud (banco
            relacional, RBAC, RLS por organização, armazenamento seguro e ganchos reativos),
            acoplando serviços especializados externos apenas para requisitos regulatórios estritos
            (assinatura ICP-Brasil) e integrações de hardware.
          </p>
        </div>
      </div>

      {/* FLUXO CONCEITUAL DAS CAMADAS (COMPOSIÇÃO VISUAL EM BOXES) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
        {ARCHITECTURE_BLOCKS.map((block, idx) => {
          const isSelected = activeBlockId === block.id

          return (
            <Card
              key={block.id}
              onClick={() => setActiveBlockId(isSelected ? null : block.id)}
              className={`cursor-pointer transition-all duration-300 relative border-2 ${getLayerBorder(block.layer)} ${
                isSelected ? 'ring-2 ring-[#0E4C92] shadow-lg scale-[1.02]' : 'hover:shadow-md'
              }`}
            >
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Camada 0{idx + 1}
                    </span>
                    <div className="p-2 rounded-lg bg-slate-100">{getLayerIcon(block.layer)}</div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-base leading-snug">
                      {block.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{block.subtitle}</p>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {block.role}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {block.tags.slice(0, 3).map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-[#0E4C92] pt-1">
                    <span>{isSelected ? 'Ocultar detalhes' : 'Ver componentes'}</span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90' : ''}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* DETALHAMENTO DO BLOCO SELECIONADO (EXPANDIDO) */}
      {activeBlockId && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md animate-fade-in space-y-4">
          {(() => {
            const block = ARCHITECTURE_BLOCKS.find((b) => b.id === activeBlockId)
            if (!block) return null

            return (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 text-[#0E4C92]">
                      {getLayerIcon(block.layer)}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[#00A6A6] uppercase tracking-wider">
                        {block.layerLabel}
                      </span>
                      <h4 className="text-lg font-bold text-slate-900">{block.title}</h4>
                    </div>
                  </div>
                  <Badge variant="outline" className="self-start sm:self-auto font-mono text-xs">
                    {block.tags.join(' • ')}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Responsabilidades e Componentes Internos:
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {block.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-[#00A6A6] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-blue-900 leading-relaxed">
                  <strong>Papel Estratégico no Ecossistema:</strong> {block.role}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* MAPA DE COHABITAÇÃO E DIRETRIZES CRÍTICAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* COLUNA 1: COHABITAÇÃO */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Database className="w-5 h-5 text-teal-600" />
            <h4>Mapa de Cohabitação</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Separação técnica estrita entre o núcleo operacional gerenciado no Skip Cloud e os nós
            periféricos especializados.
          </p>

          <div className="space-y-3 pt-1">
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs space-y-1.5">
              <span className="font-bold text-teal-900 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-600" />
                Residência no Skip Cloud:
              </span>
              <ul className="text-teal-800 space-y-1 pl-3 list-disc list-outside">
                <li>Cadastros de Organizações, Clínicas, Médicos e Pacientes</li>
                <li>Fila central de exames com priorização por SLA</li>
                <li>Mecanismo de Mutex / Atribuição exclusiva via hook</li>
                <li>Repositório privado de exames (PDF/PNG/JPEG) e metadados</li>
                <li>Rascunhos de laudos, histórico de versões e métricas quantitativas</li>
                <li>Trilha imutável de auditoria (logs de acessos e ações)</li>
                <li>Módulo de faturamento e consolidação financeira</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
              <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                Delegação para Provedores Externos:
              </span>
              <ul className="text-amber-800 space-y-1 pl-3 list-disc list-outside">
                <li>Assinatura Digital ICP-Brasil (PAdES com carimbo do tempo)</li>
                <li>Agente local de captura em portas de eletrocardiógrafos</li>
                <li>Gateway de mensageria de emergência (SMS / WhatsApp)</li>
                <li>Conversores hospitalares legados (HL7 FHIR / DICOM)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* COLUNA 2: ISOLAMENTO ENTRE CLÍNICAS (MULTI-TENANCY) */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Lock className="w-5 h-5 text-blue-600" />
            <h4>Isolamento entre Clínicas (Multi-Tenancy)</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Estratégia mandatória para garantir que empresas e clínicas contratantes jamais
            visualizem registros de outras entidades.
          </p>

          <div className="space-y-3 pt-1 text-xs text-slate-700 leading-relaxed">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                Vínculo Organizacional Forçado:
              </strong>
              <span>
                Todo registro nas coleções sensíveis (<code>pacientes</code>,{' '}
                <code>solicitacoes_ecg</code>, <code>exames_ecg</code>, <code>laudos</code>) possui
                o campo <code>organizacao_id</code> indexado e obrigatório.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-[11px]">
              <strong className="text-slate-900 block font-sans text-xs">
                Expressão de API Rule no Skip Cloud:
              </strong>
              <div className="p-2 bg-slate-900 text-emerald-400 rounded-md overflow-x-auto">
                organizacao_id = @request.auth.organizacao_id || @request.auth.role =
                &apos;super_admin&apos;
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Bloqueio de escalação: o campo <code>role</code> e <code>organizacao_id</code> na
              coleção <code>users</code> possui a restrição{' '}
              <code>@request.body.role:changed = false</code> para impedir auto-promover
              privilégios.
            </p>
          </div>
        </div>

        {/* COLUNA 3: ATRIBUIÇÃO EXCLUSIVA DE EXAMES (MUTEX) */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Workflow className="w-5 h-5 text-emerald-600" />
            <h4>Atribuição Exclusiva de Exames (Anti-Colisão)</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Mecanismo determinístico para impedir concorrência predatória ou laudos duplicados para
            o mesmo traçado de ECG.
          </p>

          <div className="space-y-3 pt-1 text-xs text-slate-700 leading-relaxed">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Trava Atômica de Estado (Atomic Mutex):
              </strong>
              <span>
                A assunção do exame ocorre via transação única no banco de dados. A transição só é
                confirmada se o estado prévio for exatamente <code>&quot;disponivel&quot;</code>.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-[11px]">
              <strong className="text-slate-900 block font-sans text-xs">
                Query Atômica em Transação (pb_hooks):
              </strong>
              <div className="p-2 bg-slate-900 text-teal-300 rounded-md overflow-x-auto">
                UPDATE exames_ecg SET status = &apos;em_analise&apos;, medico_laudador_id =
                :medicoId, lock_expira_em = :expira WHERE id = :exameId AND status =
                &apos;disponivel&apos;
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Se dois cardiologistas clicarem no mesmo segundo, o primeiro a gravar obtém o exame; a
              requisição do segundo retorna <code>409 Conflict</code> amigável e atualiza a fila em
              tempo real.
            </p>
          </div>
        </div>
      </div>

      {/* LINHA DO TEMPO CONCEITUAL: CICLO DE VIDA DO EXAME */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
          <Radio className="w-5 h-5 text-[#0E4C92]" />
          <h4>Ciclo de Vida do Exame e Rastreabilidade Documental</h4>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Fluxo imutável de transição de dados clínicos, integridade criptográfica e governança de
          saúde digital.
        </p>

        <div className="relative pt-4 pb-2">
          <div className="hidden md:block absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 relative z-10">
            {[
              {
                step: '01',
                title: 'Recepção',
                desc: 'Upload de PDF/PNG/JPEG + Geração de SHA-256 imediata',
                icon: '📥',
              },
              {
                step: '02',
                title: 'Triagem & SLA',
                desc: 'Cálculo de prazo limite (Rotina, Urgência, Emergência)',
                icon: '⏱️',
              },
              {
                step: '03',
                title: 'Assunção Exclusiva',
                desc: 'Lock atômico no backend vinculado ao CRM do médico',
                icon: '🔒',
              },
              {
                step: '04',
                title: 'Elaboração & Rascunho',
                desc: 'Métricas de ECG + Conclusão diagnóstica versionada',
                icon: '📝',
              },
              {
                step: '05',
                title: 'Assinatura ICP-Brasil',
                desc: 'Envio ao provedor externo credenciado + PAdES/LTV',
                icon: '🔏',
              },
              {
                step: '06',
                title: 'Entrega & Fechamento',
                desc: 'Disponibilização segura + Extrato para faturamento',
                icon: '📊',
              },
            ].map((node, nIdx) => (
              <div
                key={nIdx}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1.5 shadow-sm hover:border-[#0E4C92] transition-colors"
              >
                <div className="text-xl mb-1">{node.icon}</div>
                <div className="text-[10px] font-bold text-[#00A6A6] tracking-wider uppercase">
                  Etapa {node.step}
                </div>
                <div className="text-xs font-bold text-slate-900">{node.title}</div>
                <div className="text-[11px] text-slate-500 leading-tight">{node.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
