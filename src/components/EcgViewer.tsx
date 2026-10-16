import React, { useState, useRef, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { ExamRequest } from '@/types/telelaudos'
import { Card } from '@/components/ui/card'
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
    <Card className="flex flex-col h-full border-[#E3E6E8] shadow-[0_1px_3px_rgba(47,57,66,0.04)] bg-white text-[#2F3942] rounded-xl overflow-hidden">
      {/* Barra de Ferramentas do Visualizador Médica e Sóbria */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[#F7F6F4] border-b border-[#E3E6E8] text-xs shrink-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-emerald-200 text-emerald-800 bg-emerald-50 gap-1 text-[11px] font-medium"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Traçado Original Protegido</span>
          </Badge>
          <span className="text-[#6F7780] font-mono text-[11px] truncate max-w-[140px] sm:max-w-xs">
            {exam.exam_file}
          </span>
        </div>

        {/* Controles Ergonômicos de Manipulação Visual */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomOut}
            title="Diminuir Zoom"
            className="h-7 w-7 p-0 text-[#6F7780] hover:text-[#2F3942] hover:bg-white"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[11px] font-mono text-[#2F3942] font-semibold px-1 select-none">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomIn}
            title="Aumentar Zoom"
            className="h-7 w-7 p-0 text-[#6F7780] hover:text-[#2F3942] hover:bg-white"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>

          <div className="h-4 w-px bg-[#E3E6E8] mx-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRotateCcw}
            title="Girar 90° Anti-horário"
            className="h-7 w-7 p-0 text-[#6F7780] hover:text-[#2F3942] hover:bg-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRotateCw}
            title="Girar 90° Horário"
            className="h-7 w-7 p-0 text-[#6F7780] hover:text-[#2F3942] hover:bg-white"
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
                ? 'bg-[#4A90D9] text-white hover:bg-[#3b7dc2]'
                : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-white'
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
            className="h-7 px-2 text-[11px] text-[#6F7780] hover:text-[#2F3942] hover:bg-white"
          >
            Ajustar
          </Button>

          {toggleFullscreen && (
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleFullscreen}
              title={fullscreenMode ? 'Restaurar' : 'Tela Cheia'}
              className="h-7 w-7 p-0 text-[#6F7780] hover:text-[#2F3942] hover:bg-white"
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

      {/* Área Central de Visualização Confortável com fundo limpo */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setMouseInside(true)}
        onMouseLeave={() => setMouseInside(false)}
        className="relative flex-1 bg-[#2F3942]/5 overflow-auto flex items-center justify-center p-4 select-none min-h-[440px]"
      >
        {isPdf ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {fileUrl ? (
              <iframe
                src={`${fileUrl}#toolbar=1&navpanes=1`}
                className="w-full h-full min-h-[500px] rounded-lg border border-[#E3E6E8] bg-white shadow-xs"
                title="Visualizador de PDF do ECG"
              />
            ) : (
              <div className="text-center p-6 text-[#6F7780]">
                <FileText className="w-12 h-12 mx-auto text-[#6F7780]/40 mb-2" />
                <p className="font-semibold text-xs text-[#2F3942]">
                  Arquivo PDF anexado à solicitação.
                </p>
                <p className="text-[11px] text-[#6F7780] mt-1">
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
                className="max-h-[640px] max-w-full object-contain rounded-lg border border-[#E3E6E8] shadow-sm bg-white"
              />
            ) : (
              <div
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                className="w-[560px] h-[380px] bg-white border border-[#E3E6E8] rounded-lg flex flex-col items-center justify-center p-6 text-center shadow-xs"
              >
                {/* Grid milimetrado estético simulador de papel de ECG */}
                <div
                  className="w-full h-full rounded flex items-center justify-center relative overflow-hidden"
                  style={{
                    backgroundColor: '#fffdfa',
                    backgroundImage:
                      'linear-gradient(to right, rgba(220,100,80,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(220,100,80,0.12) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                >
                  <div className="text-center p-4 bg-white/95 rounded-lg border border-[#E3E6E8] text-[#2F3942] shadow-xs max-w-sm">
                    <Info className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
                    <div className="font-bold text-xs text-[#2F3942]">
                      Arquivo de ECG Não Anexado
                    </div>
                    <div className="text-[11px] text-[#6F7780] mt-1">
                      {exam.exam_file ? (
                        <>Arquivo referenciado ({exam.exam_file}) não localizado no servidor.</>
                      ) : (
                        <>
                          Nenhum arquivo de imagem ou PDF foi anexado a esta solicitação cadastrada.
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-[#6F7780] mt-2 bg-[#F7F6F4] p-2 rounded border border-[#E3E6E8]">
                      Para emitir o laudo com segurança diagnóstica, devolva o exame à clínica
                      solicitante solicitando o reenvio do traçado legível.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lente da Lupa de Alta Ampliação */}
            {isMagnifierActive && mouseInside && fileUrl && (
              <div
                className="pointer-events-none absolute w-36 h-36 rounded-full border-2 border-[#4A90D9] shadow-2xl overflow-hidden bg-white z-50"
                style={{
                  left: `${magnifierPos.x - 72}px`,
                  top: `${magnifierPos.y - 72}px`,
                  boxShadow:
                    '0 0 0 3px rgba(74, 144, 217, 0.35), 0 10px 25px rgba(47, 57, 66, 0.3)',
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-[#F7F6F4] border-t border-[#E3E6E8] text-[11px] text-[#6F7780] shrink-0">
        <div className="flex items-center gap-3">
          <span>
            Paciente:{' '}
            <strong className="text-[#2F3942]">
              {exam.expand?.patient_id?.full_name || 'Paciente'}
            </strong>
          </span>
          <span>•</span>
          <span>
            Clínica:{' '}
            <strong className="text-[#2F3942]">
              {exam.expand?.organization_id?.trade_name ||
                exam.expand?.organization_id?.name ||
                '—'}
            </strong>
          </span>
          {exam.has_pacemaker && (
            <>
              <span>•</span>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] px-1.5 py-0">
                Portador de Marcapasso
              </Badge>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-[#6F7780]">
          <span>
            {exam.calibration_speed
              ? `Velocidade: ${exam.calibration_speed}`
              : 'Velocidade: não informada'}{' '}
            • {exam.calibration_gain ? `Ganho: ${exam.calibration_gain}` : 'Ganho: não informado'}
          </span>
          {isMagnifierActive && (
            <span className="text-[#4A90D9] font-medium">• Lupa ativa (2.5x)</span>
          )}
        </div>
      </div>
    </Card>
  )
}
