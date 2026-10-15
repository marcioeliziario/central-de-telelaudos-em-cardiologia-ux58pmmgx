import { useState } from 'react'
import {
  ChevronDown,
  CheckCircle2,
  Wrench,
  ExternalLink,
  AlertTriangle,
  FileSearch,
  SlidersHorizontal,
  Shield,
  Layers,
  Info,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AUDIT_ITEMS, AuditItem } from '@/data/auditReportData'

interface AuditSectionProps {
  category: 'A' | 'B' | 'C' | 'D'
  title: string
  subtitle: string
  badgeText: string
  icon: 'A' | 'B' | 'C' | 'D'
  items: AuditItem[]
}

export function AuditSection({
  category,
  title,
  subtitle,
  badgeText,
  icon,
  items,
}: AuditSectionProps) {
  const [isSectionOpen, setIsSectionOpen] = useState(true)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [filterTopic, setFilterTopic] = useState<string>('all')

  const toggleItem = (id: string) => {
    setExpandedItemId((prev) => (prev === id ? null : id))
  }

  const getHeaderIcon = () => {
    switch (icon) {
      case 'A':
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />
      case 'B':
        return <Wrench className="w-6 h-6 text-teal-600" />
      case 'C':
        return <ExternalLink className="w-6 h-6 text-amber-600" />
      case 'D':
        return <AlertTriangle className="w-6 h-6 text-rose-600" />
    }
  }

  const getHeaderStyles = () => {
    switch (category) {
      case 'A':
        return 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/80 text-emerald-950'
      case 'B':
        return 'border-teal-200 bg-teal-50/50 hover:bg-teal-50/80 text-teal-950'
      case 'C':
        return 'border-amber-200 bg-amber-50/50 hover:bg-amber-50/80 text-amber-950'
      case 'D':
        return 'border-rose-200 bg-rose-50/50 hover:bg-rose-50/80 text-rose-950'
    }
  }

  const getBadgeColor = () => {
    switch (category) {
      case 'A':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300'
      case 'B':
        return 'bg-teal-100 text-teal-800 border-teal-300'
      case 'C':
        return 'bg-amber-100 text-amber-800 border-amber-300'
      case 'D':
        return 'bg-rose-100 text-rose-800 border-rose-300'
    }
  }

  // Filtragem interna opcional por tópico
  const availableTopics = Array.from(new Set(items.map((i) => i.topic)))
  const filteredItems = filterTopic === 'all' ? items : items.filter((i) => i.topic === filterTopic)

  return (
    <div className="space-y-4">
      {/* CABEÇALHO DO ACCORDION DA SEÇÃO */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsSectionOpen(!isSectionOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsSectionOpen(!isSectionOpen)
          }
        }}
        className={`w-full text-left p-5 sm:p-6 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between gap-4 cursor-pointer select-none shadow-sm ${getHeaderStyles()}`}
      >
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-2.5 rounded-xl bg-white shadow-sm shrink-0">{getHeaderIcon()}</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Categoria {category}
              </span>
              <span className="text-xs text-slate-300">•</span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getBadgeColor()}`}
              >
                {badgeText}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-0.5">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-1 sm:line-clamp-none">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className="hidden sm:inline-flex bg-white font-mono text-xs">
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'itens'}
          </Badge>
          <div
            className={`w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-200 text-slate-600 transition-transform duration-300 ${
              isSectionOpen ? 'rotate-180' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* CONTEÚDO EXPANSÍVEL DA SEÇÃO */}
      {isSectionOpen && (
        <div className="space-y-4 pt-1 animate-fade-in">
          {/* BARRA DE FILTRO POR TÓPICO SE HOUVER MAIS DE UM */}
          {availableTopics.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <div className="flex items-center gap-1 text-slate-500 mr-1 shrink-0 font-medium">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filtrar tópico:</span>
              </div>
              <button
                type="button"
                onClick={() => setFilterTopic('all')}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
                  filterTopic === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todos ({items.length})
              </button>
              {availableTopics.map((topic) => {
                const count = items.filter((i) => i.topic === topic).length
                const sample = items.find((i) => i.topic === topic)
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setFilterTopic(topic)}
                    className={`px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
                      filterTopic === topic
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sample?.topicLabel || topic} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* GRADE DE CARDS DOS ITENS */}
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-sm">
              — Nenhum item nesta categoria com o filtro selecionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const isExpanded = expandedItemId === item.id

                return (
                  <Card
                    key={item.id}
                    className={`transition-all duration-200 bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 flex flex-col justify-between ${
                      isExpanded ? 'md:col-span-2 lg:col-span-3 ring-1 ring-blue-500/20' : ''
                    }`}
                  >
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                      {/* TOPO DO CARD */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {item.code}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                            {item.topicLabel}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {item.summary}
                          </p>
                        </div>
                      </div>

                      {/* DETALHAMENTO EXPANSÍVEL */}
                      {isExpanded ? (
                        <div className="space-y-3.5 pt-3 border-t border-slate-100 text-xs text-slate-700 animate-fade-in">
                          {/* EVIDÊNCIA */}
                          <div className="space-y-1 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-1.5 font-bold text-[#0E4C92] uppercase tracking-wider text-[11px]">
                              <FileSearch className="w-3.5 h-3.5 text-[#00A6A6]" />
                              <span>Evidência Consultada no Ambiente:</span>
                            </div>
                            <p className="text-slate-700 leading-relaxed pl-5">{item.evidence}</p>
                          </div>

                          {/* LIMITAÇÃO */}
                          <div className="space-y-1 bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                            <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Limitação Identificada:</span>
                            </div>
                            <p className="text-slate-700 leading-relaxed pl-5">
                              {item.limitations}
                            </p>
                          </div>

                          {/* IMPACTO */}
                          <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                              <Info className="w-3.5 h-3.5 text-[#0E4C92]" />
                              <span>Impacto no Projeto Clínico:</span>
                            </div>
                            <p className="text-slate-700 leading-relaxed pl-5">{item.impact}</p>
                          </div>

                          {/* AÇÕES TÉCNICAS OU MITIGAÇÕES */}
                          {item.technicalDetails && (
                            <div className="space-y-1 pt-1">
                              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                                Detalhes de Implementação:
                              </span>
                              <ul className="space-y-1 pl-4 list-disc list-outside text-slate-600">
                                {item.technicalDetails.map((td, idx) => (
                                  <li key={idx} className="leading-relaxed">
                                    {td}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {item.mitigationOrAction && (
                            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-950 font-medium">
                              <strong>Diretriz de Mitigação:</strong> {item.mitigationOrAction}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span className="line-clamp-1 text-[11px] italic">
                            Clique para expandir evidências e impacto
                          </span>
                        </div>
                      )}

                      {/* BOTÃO DE EXPANDIR / RECOLHER */}
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="w-full mt-2 py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-[#0E4C92] flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                      >
                        <span>
                          {isExpanded ? 'Recolher análise técnica' : 'Ver evidência e impacto'}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
