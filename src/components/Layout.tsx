import { Outlet } from 'react-router-dom'
import { Activity, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react'

export default function Layout() {
  const generationDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-blue-900 selection:text-white">
      {/* BARRA SUPERIOR (HEADER) FIXA */}
      <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* TÍTULO INSTITUCIONAL */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0E4C92] to-[#00A6A6] flex items-center justify-center text-white shadow-md shadow-blue-900/10 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#00A6A6] hidden sm:inline-block">
                  Telemedicina Diagnóstica
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline-block">•</span>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                  ECG 12 Derivações
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate leading-tight">
                CENTRAL DE TELELAUDOS EM CARDIOLOGIA
              </h1>
            </div>
          </div>

          {/* SELO DE STATUS / AUDITORIA */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="hidden xs:inline">Fase:</span>
              <span>Auditoria de Viabilidade Técnica</span>
            </div>
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      {/* RODAPÉ DO SISTEMA */}
      <footer className="w-full bg-[#0E4C92] text-slate-200 border-t border-blue-950 mt-12 py-8 transition-colors">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-white font-semibold">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Aviso Legal e Diretriz Operacional</span>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Nenhum componente do sistema foi construído nesta etapa. Este é um relatório técnico
              de diagnóstico de viabilidade. Nenhum dado real de paciente foi coletado, armazenado
              ou processado.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 text-xs text-slate-300 shrink-0">
            <div className="flex items-center gap-1.5 bg-blue-950/50 px-3 py-1.5 rounded-md border border-blue-800">
              <FileText className="w-3.5 h-3.5 text-[#00A6A6]" />
              <span>Emissão: {generationDate}</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Aguardando autorização para a fase de implementação</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
