import React, { useState, useRef, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { ExamRequest } from '@/types/telelaudos'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Eye,
  Info,
} from 'lucide-react'

interface EcgViewerProps {
  exam: ExamRequest
  onClose?: () => void
  fullscreenMode?: boolean
  toggleFullscreen?: () => void
}

export default function EcgViewer({
  exam,
  onClose,
  fullscreenMode = false,
  toggleFullscreen,
}: EcgViewerProps) {
  const [zoom, setZoom] = useState<number>(1)
  const [rotation, setRotation] = useState<number>(0)
  const [isMagnifierActive, setIsMagnifierActive] = useState<boolean>(false)
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [mouseInside, setMouseInside] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const isPdf =
    exam.exam_file?.toLowerCase().endsWith('.pdf') ||
    exam.exam_file?.includes('application/pdf') ||
    exam.exam_file?.toLowerCase().includes('.pdf')

  // Gerar URL do arquivo protegido com token de autenticação ativo do PocketBase
  const fileUrl = exam.exam_file
    ? pb.files.getURL(exam, exam.exam_file, {
        token: pb.authStore.token || undefined,
      })
    : ''

  // Resetar zoom e rotação quando o exame muda
  useEffect(() => {
    setZoom(1)
    setRotation(0)
    setIsMagnifierActive(false)
    setCurrentPage(1)
    setTotalPages(1)
  }, [exam.id])

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 4))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))
  const handleReset = () => {
    setZoom(1)
    setRotation(0)
  }
  const handleRotateCw = () => setRotation((prev) => (prev + 90) % 360)
  const handleRotateCcw = () => setRotation((prev) => (prev - 90 + 360) % 360)

  // Tratamento da Lupa (Modo de Ampliação de Alta Resolução)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMagnifierActive || !imageRef.current || !containerRef.current) return
    const rect = imageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      setMagnifierPos({ x, y })
      setMouseInside(true)
    } else {
      setMouseInside(false)
    }
  }

  return (
    <Card className="flex flex-col h-full border-slate-200 shadow-sm bg-slate-900 text-white overflow-hidden">
      {/* Barra de Ferramentas do Visualizador */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-950 border-b border-slate-800 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-emerald-500/40 text-emerald-400 bg-emerald-950/40 gap-1 text-[11px]"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Traçado Original Protegido</span>
          </Badge>
          <span className="text-slate-400 font-mono text-[11px] truncate max-w-[160px] sm:max-w-xs">
            {exam.exam_file}
          </span>
        </div>

        {/* Controles de Manipulação Visual */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomOut}
            title="Diminuir Zoom"
            className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[11px] font-mono text-slate-300 px-1 select-none">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomIn}
            title="Aumentar Zoom"
            className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRotateCcw}
            title="Girar 90° Anti-horário"
            className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRotateCw}
            title="Girar 90° Horário"
            className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            variant={isMagnifierActive ? 'default' : 'ghost'}
            onClick={() => setIsMagnifierActive(!isMagnifierActive)}
            title="Modo Ampliação (Lupa)"
            className={`h-7 px-2 text-xs gap-1 ${
              isMagnifierActive
                ? 'bg-[#00A6A6] text-white hover:bg-[#008f8f]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lupa</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            title="Ajustar à tela"
            className="h-7 px-2 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800"
          >
            Ajustar
          </Button>

          {toggleFullscreen && (
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleFullscreen}
              title={fullscreenMode ? 'Restaurar' : 'Tela Cheia'}
              className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {fullscreenMode ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Área Central de Visualização */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setMouseInside(true)}
        onMouseLeave={() => setMouseInside(false)}
        className="relative flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4 select-none min-h-[360px]"
      >
        {isPdf ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {fileUrl ? (
              <iframe
                src={`${fileUrl}#toolbar=1&navpanes=1`}
                className="w-full h-full min-h-[460px] rounded border border-slate-800 bg-white"
                title="Visualizador de PDF do ECG"
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <FileText className="w-12 h-12 mx-auto text-slate-600 mb-2" />
                <p>Arquivo PDF anexado à solicitação.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Abra o arquivo diretamente pelo link seguro do sistema.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="relative inline-block transition-transform duration-100 ease-out">
            {/* Traçado de Imagem (PNG/JPG) ou Grid de ECG */}
            {fileUrl ? (
              <img
                ref={imageRef}
                src={fileUrl}
                alt="Traçado de ECG do Paciente"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                className="max-h-[650px] max-w-full object-contain rounded border border-slate-800 shadow-2xl bg-white"
              />
            ) : (
              <div
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                className="w-[600px] h-[400px] bg-red-950/20 border border-red-500/30 rounded flex flex-col items-center justify-center p-6 text-center"
              >
                {/* Grid milimetrado estético simulador de papel de ECG */}
                <div
                  className="w-full h-full rounded flex items-center justify-center relative overflow-hidden"
                  style={{
                    backgroundColor: '#fff9f5',
                    backgroundImage:
                      'linear-gradient(to right, rgba(255,0,0,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,0,0,0.15) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                >
                  <div className="text-center p-4 bg-white/90 rounded border border-red-200 text-slate-800 shadow-sm max-w-md">
                    <Info className="w-6 h-6 text-[#0E4C92] mx-auto mb-1" />
                    <div className="font-bold text-xs">Exame Cadastrado na Fila</div>
                    <div className="text-[11px] text-slate-600 mt-1 font-mono">
                      Arquivo: {exam.exam_file}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2">
                      Visualização preservada do exame original sem qualquer alteração.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lente da Lupa de Alta Ampliação */}
            {isMagnifierActive && mouseInside && fileUrl && (
              <div
                className="pointer-events-none absolute w-36 h-36 rounded-full border-2 border-[#00A6A6] shadow-2xl overflow-hidden bg-white z-50"
                style={{
                  left: `${magnifierPos.x - 72}px`,
                  top: `${magnifierPos.y - 72}px`,
                  boxShadow: '0 0 0 3px rgba(0, 166, 166, 0.4), 0 10px 25px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${fileUrl})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: `-${magnifierPos.x * 2.5 - 72}px -${
                      magnifierPos.y * 2.5 - 72
                    }px`,
                    backgroundSize: `${(imageRef.current?.width || 600) * 2.5}px ${
                      (imageRef.current?.height || 400) * 2.5
                    }px`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rodapé com Metadados Clínicos do Traçado */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <span>
            Paciente:{' '}
            <strong className="text-slate-200">
              {exam.expand?.patient_id?.full_name || 'Paciente'}
            </strong>
          </span>
          <span>•</span>
          <span>
            Clínica:{' '}
            <strong className="text-slate-200">
              {exam.expand?.organization_id?.trade_name ||
                exam.expand?.organization_id?.name ||
                '—'}
            </strong>
          </span>
          {exam.has_pacemaker && (
            <>
              <span>•</span>
              <Badge className="bg-amber-900/60 text-amber-200 border-amber-600 text-[10px] px-1.5 py-0">
                Portador de Marcapasso
              </Badge>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span>Velocidade padrão: 25 mm/s • Ganho: N (10 mm/mV)</span>
          {isMagnifierActive && (
            <span className="text-[#00A6A6] font-medium">• Lupa ativa (2.5x)</span>
          )}
        </div>
      </div>
    </Card>
  )
}
