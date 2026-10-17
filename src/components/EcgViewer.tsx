import React, { useState, useRef, useEffect, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { ExamRequest } from '@/types/telelaudos'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
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
  Info,
  Download,
  RotateCcw as ResetIcon,
  Sliders,
  Sparkles,
  Sun,
  Contrast,
  Compass,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// Configura o worker do PDF.js bundled pelo Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

interface EcgViewerProps {
  exam: ExamRequest
  onClose?: () => void
  fullscreenMode?: boolean
  toggleFullscreen?: () => void
}

type ImageRenderingMode = 'auto' | 'crisp-edges' | 'pixelated'

interface VisualGuide {
  id: string
  orientation: 'horizontal' | 'vertical'
  position: number // porcentagem 0-100%
}

export default function EcgViewer({
  exam,
  onClose: _onClose,
  fullscreenMode = false,
  toggleFullscreen,
}: EcgViewerProps) {
  // Zoom centrado (50% - 600%)
  const [zoom, setZoom] = useState<number>(1)
  const [rotation, setRotation] = useState<number>(0)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number }>({
    mouseX: 0,
    mouseY: 0,
    panX: 0,
    panY: 0,
  })

  // Lupa nativa de 3,5x amostrando pixels originais da imagem (img.naturalWidth / naturalHeight)
  const [isMagnifierActive, setIsMagnifierActive] = useState<boolean>(false)
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [mouseInsideImage, setMouseInsideImage] = useState<boolean>(false)
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null)

  // Filtros CSS
  const [brightness, setBrightness] = useState<number>(100) // 50% - 200%
  const [contrast, setContrast] = useState<number>(100) // 50% - 250%
  const [inverted, setInverted] = useState<boolean>(false)
  const [renderingMode, setRenderingMode] = useState<ImageRenderingMode>('auto')
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(false)

  // Guias visuais arrastáveis (somente referência visual)
  const [showGuides, setShowGuides] = useState<boolean>(false)
  const [guides, setGuides] = useState<VisualGuide[]>([
    { id: 'h1', orientation: 'horizontal', position: 35 },
    { id: 'v1', orientation: 'vertical', position: 50 },
  ])
  const [activeDraggingGuideId, setActiveDraggingGuideId] = useState<string | null>(null)

  // Modo tela cheia nativo (HTML5 requestFullscreen)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false)

  const cardRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const isPdf =
    exam.exam_file?.toLowerCase().endsWith('.pdf') ||
    exam.exam_file?.includes('application/pdf') ||
    exam.exam_file?.toLowerCase().includes('.pdf')

  // Gerar URL do arquivo original protegido com token de autenticação ativo do PocketBase
  const [fileUrl, setFileUrl] = useState<string>('')
  const [fileBlobUrl, setFileBlobUrl] = useState<string>('')
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false)
  const [fileLoadError, setFileLoadError] = useState<string | null>(null)
  const [reloadTrigger, setReloadTrigger] = useState<number>(0)

  // Acesso seguro aos metadados de calibração opcionais não previstos na coleção estrita
  const examRecord = exam as unknown as Record<string, unknown>
  const calibrationSpeed =
    typeof examRecord.calibration_speed === 'string' ? examRecord.calibration_speed : undefined
  const calibrationGain =
    typeof examRecord.calibration_gain === 'string' ? examRecord.calibration_gain : undefined

  // Estado para suporte a PDF multipáginas
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [numPages, setNumPages] = useState<number>(0)
  const [isRenderingPdfPage, setIsRenderingPdfPage] = useState<boolean>(false)
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Resetar estado quando o exame muda
  useEffect(() => {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
    setIsMagnifierActive(false)
    setBrightness(100)
    setContrast(100)
    setInverted(false)
    setRenderingMode('auto')
    setShowFiltersPanel(false)
    setCurrentPage(1)
    setNumPages(0)
  }, [exam.id])

  // Carregamento resiliente do arquivo de exame (File Token + fetch com Authorization + fallback URL + PDF.js Uint8Array)
  useEffect(() => {
    let isCancelled = false
    let currentBlobUrlToRevoke = ''

    if (!exam.exam_file) {
      setFileUrl('')
      setFileBlobUrl('')
      setPdfData(null)
      setIsLoadingFile(false)
      setFileLoadError(null)
      return
    }

    setIsLoadingFile(true)
    setFileLoadError(null)
    setPdfData(null)

    const loadExamFile = async () => {
      try {
        // 1. Obter File Token temporário oficial para campos com protected: true
        let fileToken = ''
        try {
          fileToken = await pb.files.getToken()
        } catch (tokenErr) {
          console.warn(
            'pb.files.getToken() falhou ou não suportado, tentando sem file token:',
            tokenErr,
          )
        }

        // 2. Construir URL com token
        const generatedUrl = pb.files.getURL(exam, exam.exam_file, {
          token: fileToken || undefined,
        })
        if (!isCancelled) {
          setFileUrl(generatedUrl)
        }

        // 3. Buscar os bytes do arquivo via fetch com token de sessão ativo (Authorization)
        // Isso resolve quaisquer restrições de headers/CORS e previne erros silenciosos na tag <img>
        const headers: Record<string, string> = {}
        if (pb.authStore.token) {
          headers['Authorization'] = pb.authStore.token
        }

        let blob: Blob | null = null
        try {
          const resp = await fetch(generatedUrl, { headers })
          if (resp.ok) {
            blob = await resp.blob()
          } else {
            // Tentar URL sem query token se falhou
            const directUrl = pb.files.getURL(exam, exam.exam_file)
            const fallbackResp = await fetch(directUrl, { headers })
            if (fallbackResp.ok) {
              blob = await fallbackResp.blob()
            } else {
              throw new Error(
                `Falha HTTP ao carregar arquivo de ECG: ${resp.status} ${resp.statusText}`,
              )
            }
          }
        } catch (fetchErr: any) {
          console.warn(
            'Fetch direto do arquivo falhou, mantendo URL direta como fallback:',
            fetchErr,
          )
          // Se o fetch falhou (ex: modo offline ou restrição), ainda temos a generatedUrl
          if (!generatedUrl) {
            throw fetchErr
          }
        }

        if (isCancelled) return

        if (blob) {
          const bUrl = URL.createObjectURL(blob)
          currentBlobUrlToRevoke = bUrl
          setFileBlobUrl(bUrl)

          if (isPdf) {
            const arrayBuffer = await blob.arrayBuffer()
            if (!isCancelled) {
              setPdfData(new Uint8Array(arrayBuffer))
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Erro ao carregar arquivo do exame de ECG:', err)
          setFileLoadError(
            err.message || 'Falha ao autenticar e descarregar o arquivo de ECG do servidor.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingFile(false)
        }
      }
    }

    loadExamFile()

    return () => {
      isCancelled = true
      if (currentBlobUrlToRevoke) {
        URL.revokeObjectURL(currentBlobUrlToRevoke)
      }
    }
  }, [exam.id, exam.exam_file, reloadTrigger, isPdf])

  // Inicializar e carregar documento PDF.js
  useEffect(() => {
    if (!isPdf || (!pdfData && !fileUrl)) {
      setPdfDoc(null)
      setNumPages(0)
      return
    }

    let isCancelled = false

    const loadPdfDoc = async () => {
      try {
        let loadingTask: pdfjsLib.PDFDocumentLoadingTask
        if (pdfData && pdfData.length > 0) {
          const copy = new Uint8Array(pdfData)
          loadingTask = pdfjsLib.getDocument({
            data: copy,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
            cMapPacked: true,
          })
        } else if (fileBlobUrl) {
          loadingTask = pdfjsLib.getDocument({
            url: fileBlobUrl,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
            cMapPacked: true,
          })
        } else {
          loadingTask = pdfjsLib.getDocument({
            url: fileUrl,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
            cMapPacked: true,
          })
        }

        const loadedDoc = await loadingTask.promise
        if (isCancelled) return
        setPdfDoc(loadedDoc)
        setNumPages(loadedDoc.numPages)
        setCurrentPage(1)
      } catch (pdfErr: any) {
        if (!isCancelled) {
          console.error('Erro ao processar PDF via PDF.js:', pdfErr)
          setFileLoadError(`Erro ao interpretar traçado em PDF: ${pdfErr.message}`)
        }
      }
    }

    loadPdfDoc()

    return () => {
      isCancelled = true
    }
  }, [isPdf, pdfData, fileBlobUrl, fileUrl])

  // Renderizar página do PDF em canvas nativo
  const renderPdfPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !pdfCanvasRef.current) return

      try {
        setIsRenderingPdfPage(true)
        const page = await pdfDoc.getPage(pageNum)
        const canvas = pdfCanvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        // Escala base de visualização (1.5x)
        const viewport = page.getViewport({ scale: 1.5 })

        // Suporte a telas de alta densidade (HiDPI / Retina)
        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined

        const renderContext = {
          canvasContext: context,
          viewport,
          transform,
        }

        await page.render(renderContext).promise
      } catch (err: any) {
        console.error('Falha ao renderizar página do PDF:', err)
      } finally {
        setIsRenderingPdfPage(false)
      }
    },
    [pdfDoc],
  )

  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPdfPage(currentPage)
    }
  }, [pdfDoc, currentPage, renderPdfPage])

  // Escuta mudanças de tela cheia do navegador
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Clamp da contenção de pan (limites proporcionais ao zoom)
  const clampPan = useCallback((newX: number, newY: number, currentZoom: number) => {
    if (!containerRef.current) return { x: newX, y: newY }
    const container = containerRef.current
    const maxPanX = Math.max(0, (container.clientWidth * (currentZoom - 0.5)) / 1.2)
    const maxPanY = Math.max(0, (container.clientHeight * (currentZoom - 0.5)) / 1.2)
    return {
      x: Math.min(Math.max(newX, -maxPanX), maxPanX),
      y: Math.min(Math.max(newY, -maxPanY), maxPanY),
    }
  }, [])

  // Zoom de 50% até 600%
  const applyZoom = useCallback(
    (targetZoom: number, cursorCenter?: { clientX: number; clientY: number }) => {
      const clampedZoom = Math.min(Math.max(targetZoom, 0.5), 6.0)
      if (!containerRef.current || !cursorCenter) {
        setZoom(clampedZoom)
        setPan((prev) => clampPan(prev.x, prev.y, clampedZoom))
        return
      }

      // Zoom centrado na posição do cursor
      const rect = containerRef.current.getBoundingClientRect()
      const cursorX = cursorCenter.clientX - rect.left - rect.width / 2
      const cursorY = cursorCenter.clientY - rect.top - rect.height / 2

      setZoom((prevZoom) => {
        const factor = clampedZoom / prevZoom
        const newPanX = cursorX - (cursorX - pan.x) * factor
        const newPanY = cursorY - (cursorY - pan.y) * factor
        const clamped = clampPan(newPanX, newPanY, clampedZoom)
        setPan(clamped)
        return clampedZoom
      })
    },
    [pan, clampPan],
  )

  const handleZoomIn = () => applyZoom(zoom + 0.25)
  const handleZoomOut = () => applyZoom(zoom - 0.25)
  const handleResetView = () => {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
    setBrightness(100)
    setContrast(100)
    setInverted(false)
    setRenderingMode('auto')
  }

  const handleRotateCw = () => setRotation((prev) => (prev + 90) % 360)
  const handleRotateCcw = () => setRotation((prev) => (prev - 90 + 360) % 360)

  // Roda do mouse com zoom centrado no cursor (suporta Ctrl+Wheel ou Wheel direto na área da imagem)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const zoomDelta = e.deltaY < 0 ? 0.2 : -0.2
    applyZoom(zoom + zoomDelta, { clientX: e.clientX, clientY: e.clientY })
  }

  // Pan por arraste com contenção (clamp)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isMagnifierActive || activeDraggingGuideId) return
    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // 1. Arraste de Guia Visual
    if (activeDraggingGuideId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const guide = guides.find((g) => g.id === activeDraggingGuideId)
      if (guide) {
        if (guide.orientation === 'horizontal') {
          const rawPercent = ((e.clientY - rect.top) / rect.height) * 100
          const clamped = Math.min(Math.max(rawPercent, 2), 98)
          setGuides((prev) =>
            prev.map((g) => (g.id === activeDraggingGuideId ? { ...g, position: clamped } : g)),
          )
        } else {
          const rawPercent = ((e.clientX - rect.left) / rect.width) * 100
          const clamped = Math.min(Math.max(rawPercent, 2), 98)
          setGuides((prev) =>
            prev.map((g) => (g.id === activeDraggingGuideId ? { ...g, position: clamped } : g)),
          )
        }
      }
      return
    }

    // 2. Arraste de Imagem (Pan)
    if (isDragging) {
      const deltaX = e.clientX - dragStartRef.current.mouseX
      const deltaY = e.clientY - dragStartRef.current.mouseY
      const newPanX = dragStartRef.current.panX + deltaX
      const newPanY = dragStartRef.current.panY + deltaY
      setPan(clampPan(newPanX, newPanY, zoom))
    }

    // 3. Atualização da Lupa Nativa 3,5x (suporta Imagem ou Canvas de PDF)
    if (isMagnifierActive && containerRef.current) {
      const targetElement = isPdf ? pdfCanvasRef.current : imageRef.current
      if (targetElement) {
        const elemRect = targetElement.getBoundingClientRect()
        const x = e.clientX - elemRect.left
        const y = e.clientY - elemRect.top

        if (x >= 0 && x <= elemRect.width && y >= 0 && y <= elemRect.height) {
          setMagnifierPos({ x: e.clientX, y: e.clientY })
          setMouseInsideImage(true)
          updateMagnifierCanvas(x, y, elemRect.width, elemRect.height)
        } else {
          setMouseInsideImage(false)
        }
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setActiveDraggingGuideId(null)
  }

  // Renderização da Lupa 3,5x amostrando pixels NATIVOS da imagem ou do canvas PDF
  const updateMagnifierCanvas = (
    cursorXOnTarget: number,
    cursorYOnTarget: number,
    displayedW: number,
    displayedH: number,
  ) => {
    const canvas = magnifierCanvasRef.current
    if (!canvas) return

    const sourceElement: CanvasImageSource | null = isPdf ? pdfCanvasRef.current : imageRef.current

    if (!sourceElement) return

    let naturalW = 0
    let naturalH = 0

    if (isPdf && pdfCanvasRef.current) {
      naturalW = pdfCanvasRef.current.width
      naturalH = pdfCanvasRef.current.height
    } else if (imageRef.current) {
      naturalW = imageRef.current.naturalWidth
      naturalH = imageRef.current.naturalHeight
    }

    if (!naturalW || !naturalH) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Proporção real da fonte nativa
    const scaleNativeX = naturalW / displayedW
    const scaleNativeY = naturalH / displayedH

    // Ponto central em pixels originais da fonte HD
    const nativeCenterX = cursorXOnTarget * scaleNativeX
    const nativeCenterY = cursorYOnTarget * scaleNativeY

    const canvasSize = 180
    canvas.width = canvasSize
    canvas.height = canvasSize

    // Ampliação nativa estrita de 3,5x
    const MAGNIFICATION = 3.5
    const sourceW = canvasSize / MAGNIFICATION
    const sourceH = canvasSize / MAGNIFICATION
    const sourceX = nativeCenterX - sourceW / 2
    const sourceY = nativeCenterY - sourceH / 2

    // Configurar interpolação conforme modo de nitidez selecionado
    ctx.imageSmoothingEnabled = renderingMode !== 'pixelated'
    if (renderingMode === 'crisp-edges') {
      ctx.imageSmoothingQuality = 'high'
    }

    // Aplicar filtros ao contexto do canvas da lupa
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) ${
      inverted ? 'invert(100%)' : ''
    }`.trim()

    ctx.clearRect(0, 0, canvasSize, canvasSize)

    try {
      ctx.drawImage(sourceElement, sourceX, sourceY, sourceW, sourceH, 0, 0, canvasSize, canvasSize)
    } catch (_) {
      // Caso a fonte ainda esteja carregando
    }

    // Desenhar retículo central fino (mira médica)
    ctx.filter = 'none'
    ctx.strokeStyle = 'rgba(74, 144, 217, 0.85)'
    ctx.lineWidth = 1
    ctx.beginPath()
    // Traço horizontal
    ctx.moveTo(canvasSize / 2 - 12, canvasSize / 2)
    ctx.lineTo(canvasSize / 2 + 12, canvasSize / 2)
    // Traço vertical
    ctx.moveTo(canvasSize / 2, canvasSize / 2 - 12)
    ctx.lineTo(canvasSize / 2, canvasSize / 2 + 12)
    ctx.stroke()

    // Borda interna discreta
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.beginPath()
    ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 - 1, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Alternar tela cheia nativa via HTML5 Fullscreen API
  const handleToggleFullscreen = async () => {
    if (toggleFullscreen) {
      toggleFullscreen()
      return
    }

    if (!document.fullscreenElement) {
      if (cardRef.current?.requestFullscreen) {
        try {
          await cardRef.current.requestFullscreen()
          setIsNativeFullscreen(true)
        } catch {
          /* intentionally ignored */
        }
      }
    } else {
      if (document.exitFullscreen) {
        try {
          await document.exitFullscreen()
          setIsNativeFullscreen(false)
        } catch {
          /* intentionally ignored */
        }
      }
    }
  }

  // Download do arquivo original sem recompressão via URL autenticada do PocketBase / Blob
  const handleDownloadOriginal = () => {
    const downloadTarget = fileBlobUrl || fileUrl
    if (!downloadTarget) return
    const a = document.createElement('a')
    a.href = downloadTarget
    a.download = exam.exam_file || (isPdf ? 'ecg_original.pdf' : 'ecg_original.png')
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Montar string de filtros CSS
  const cssFilter = `brightness(${brightness}%) contrast(${contrast}%) ${
    inverted ? 'invert(100%)' : ''
  }`.trim()

  return (
    <Card
      ref={cardRef}
      className={`flex flex-col h-full border-[#E3E6E8] shadow-[0_1px_3px_rgba(47,57,66,0.04)] bg-white text-[#2F3942] rounded-xl overflow-hidden select-none ${
        fullscreenMode || isNativeFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* Barra de Ferramentas Superior — Identidade Visual Cardiolab */}
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
            {exam.exam_file || 'Sem arquivo'}
          </span>
        </div>

        {/* Controles Ergonômicos */}
        <div className="flex flex-wrap items-center gap-1">
          {/* Paginação para PDFs com mais de 1 página */}
          {isPdf && numPages > 1 && (
            <div className="flex items-center bg-white rounded-md border border-[#E3E6E8] px-1 py-0.5 shadow-2xs mr-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isRenderingPdfPage}
                title="Página anterior"
                className="h-6 w-6 p-0 text-[#6F7780] hover:text-[#2F3942]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] font-mono text-[#2F3942] font-semibold px-1.5 select-none">
                {currentPage} / {numPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages || isRenderingPdfPage}
                title="Próxima página"
                className="h-6 w-6 p-0 text-[#6F7780] hover:text-[#2F3942]"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Zoom Controles (50% - 600%) */}
          <div className="flex items-center bg-white rounded-md border border-[#E3E6E8] px-1 py-0.5 shadow-2xs">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              title="Diminuir Zoom (mínimo 50%)"
              className="h-6 w-6 p-0 text-[#6F7780] hover:text-[#2F3942]"
            >
              <ZoomOut className="w-3 h-3" />
            </Button>
            <span className="text-[11px] font-mono text-[#2F3942] font-semibold px-1.5 min-w-[44px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleZoomIn}
              disabled={zoom >= 6.0}
              title="Aumentar Zoom (máximo 600%)"
              className="h-6 w-6 p-0 text-[#6F7780] hover:text-[#2F3942]"
            >
              <ZoomIn className="w-3 h-3" />
            </Button>
          </div>

          <div className="h-4 w-px bg-[#E3E6E8] mx-0.5" />

          {/* Rotação */}
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

          <div className="h-4 w-px bg-[#E3E6E8] mx-0.5" />

          {/* Lupa 3.5x Nativa */}
          <Button
            size="sm"
            variant={isMagnifierActive ? 'default' : 'ghost'}
            onClick={() => setIsMagnifierActive(!isMagnifierActive)}
            title="Modo Lupa 3,5x (Amostragem de pixels nativos)"
            className={`h-7 px-2 text-xs gap-1 ${
              isMagnifierActive
                ? 'bg-[#4A90D9] text-white hover:bg-[#3b7dc2]'
                : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lupa 3,5×</span>
          </Button>

          {/* Painel de Filtros CSS e Nitidez */}
          <Button
            size="sm"
            variant={showFiltersPanel ? 'default' : 'ghost'}
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            title="Ajustes de Brilho, Contraste e Nitidez"
            className={`h-7 px-2 text-xs gap-1 ${
              showFiltersPanel
                ? 'bg-[#4A90D9] text-white hover:bg-[#3b7dc2]'
                : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filtros</span>
          </Button>

          {/* Guias Visuais Arrastáveis */}
          <Button
            size="sm"
            variant={showGuides ? 'default' : 'ghost'}
            onClick={() => setShowGuides(!showGuides)}
            title="Guias Visuais Arrastáveis (Apenas referência visual)"
            className={`h-7 px-2 text-xs gap-1 ${
              showGuides
                ? 'bg-[#4A90D9] text-white hover:bg-[#3b7dc2]'
                : 'text-[#6F7780] hover:text-[#2F3942] hover:bg-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guias</span>
          </Button>

          {/* Download Original com Token / Blob */}
          {(fileBlobUrl || fileUrl) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownloadOriginal}
              title="Baixar arquivo original protegido (sem recompressão)"
              className="h-7 px-2 text-xs gap-1 text-[#6F7780] hover:text-[#2F3942] hover:bg-white"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          )}

          {/* Botão Restaurar */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleResetView}
            title="Restaurar zoom, rotação e posição"
            className="h-7 px-2 text-[11px] text-[#6F7780] hover:text-[#2F3942] hover:bg-white gap-1"
          >
            <ResetIcon className="w-3 h-3" />
            <span>Restaurar</span>
          </Button>

          {/* Tela Cheia */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleFullscreen}
            title={fullscreenMode || isNativeFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
            className="h-7 w-7 p-0 text-[#6F7780] hover:text-[#2F3942] hover:bg-white"
          >
            {fullscreenMode || isNativeFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Painel Expansível de Filtros de Imagem e Nitidez */}
      {showFiltersPanel && (
        <div className="bg-[#F7F6F4] border-b border-[#E3E6E8] px-4 py-2.5 text-xs grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
          {/* Brilho */}
          <div className="flex items-center gap-2">
            <Sun className="w-3.5 h-3.5 text-[#6F7780] shrink-0" />
            <span className="text-[#2F3942] text-[11px] w-14 shrink-0">Brilho:</span>
            <input
              type="range"
              min={50}
              max={200}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full accent-[#4A90D9] h-1.5 bg-[#E3E6E8] rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[10px] text-[#6F7780] w-9 text-right shrink-0">
              {brightness}%
            </span>
          </div>

          {/* Contraste */}
          <div className="flex items-center gap-2">
            <Contrast className="w-3.5 h-3.5 text-[#6F7780] shrink-0" />
            <span className="text-[#2F3942] text-[11px] w-16 shrink-0">Contraste:</span>
            <input
              type="range"
              min={50}
              max={250}
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-full accent-[#4A90D9] h-1.5 bg-[#E3E6E8] rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[10px] text-[#6F7780] w-9 text-right shrink-0">
              {contrast}%
            </span>
          </div>

          {/* Nitidez / Renderização */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#6F7780] shrink-0" />
            <span className="text-[#2F3942] text-[11px] shrink-0">Nitidez:</span>
            <div className="flex rounded-md border border-[#E3E6E8] bg-white p-0.5">
              <button
                type="button"
                onClick={() => setRenderingMode('auto')}
                className={`px-2 py-0.5 text-[10px] rounded ${
                  renderingMode === 'auto'
                    ? 'bg-[#4A90D9] text-white font-medium'
                    : 'text-[#6F7780] hover:text-[#2F3942]'
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setRenderingMode('crisp-edges')}
                className={`px-2 py-0.5 text-[10px] rounded ${
                  renderingMode === 'crisp-edges'
                    ? 'bg-[#4A90D9] text-white font-medium'
                    : 'text-[#6F7780] hover:text-[#2F3942]'
                }`}
              >
                Nítido
              </button>
              <button
                type="button"
                onClick={() => setRenderingMode('pixelated')}
                className={`px-2 py-0.5 text-[10px] rounded ${
                  renderingMode === 'pixelated'
                    ? 'bg-[#4A90D9] text-white font-medium'
                    : 'text-[#6F7780] hover:text-[#2F3942]'
                }`}
              >
                Pixelado
              </button>
            </div>
          </div>

          {/* Inversão e Restaurar Filtros */}
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant={inverted ? 'default' : 'outline'}
              onClick={() => setInverted(!inverted)}
              className={`h-6 px-2 text-[11px] ${
                inverted ? 'bg-[#2F3942] text-white' : 'border-[#E3E6E8] text-[#2F3942]'
              }`}
            >
              Inverter Cores
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBrightness(100)
                setContrast(100)
                setInverted(false)
                setRenderingMode('auto')
              }}
              className="h-6 px-2 text-[11px] text-[#6F7780] hover:text-[#2F3942]"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      )}

      {/* Banner de Aviso das Guias Visuais */}
      {showGuides && (
        <div className="bg-amber-50/80 border-b border-amber-200/80 px-4 py-1.5 text-[11px] text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-700" />
            <span className="font-semibold">Referência visual — medidas ms/mV desativadas</span>
            <span className="text-amber-700 hidden sm:inline">
              (Arraste as linhas para calibrar alinhamentos visuais no traçado)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setGuides((prev) => [
                  ...prev,
                  {
                    id: `h_${Date.now()}`,
                    orientation: 'horizontal',
                    position: 50,
                  },
                ])
              }
              className="text-[10px] underline hover:text-amber-950 font-medium px-1"
            >
              + Guia H
            </button>
            <button
              type="button"
              onClick={() =>
                setGuides((prev) => [
                  ...prev,
                  {
                    id: `v_${Date.now()}`,
                    orientation: 'vertical',
                    position: 50,
                  },
                ])
              }
              className="text-[10px] underline hover:text-amber-950 font-medium px-1"
            >
              + Guia V
            </button>
          </div>
        </div>
      )}

      {/* Área Central de Visualização com Arraste (Pan) e Contenção (Clamp) */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false)
          setMouseInsideImage(false)
          setActiveDraggingGuideId(null)
        }}
        className={`relative flex-1 bg-[#2F3942]/5 overflow-hidden flex items-center justify-center p-4 min-h-[440px] ${
          isDragging ? 'cursor-grabbing' : isMagnifierActive ? 'cursor-crosshair' : 'cursor-grab'
        }`}
      >
        {/* Estado 1: Carregando Arquivo Protegido */}
        {isLoadingFile && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-2xs flex flex-col items-center justify-center gap-2 z-30">
            <Loader2 className="w-8 h-8 animate-spin text-[#4A90D9]" />
            <p className="text-xs text-[#2F3942] font-semibold">
              Obtendo arquivo protegido de ECG...
            </p>
            <span className="text-[10px] text-[#6F7780] font-mono">
              Autenticação de token de arquivo em processamento
            </span>
          </div>
        )}

        {/* Estado 2: Erro no Carregamento com Botão Tentar Novamente */}
        {!isLoadingFile && fileLoadError && (
          <div className="p-6 bg-white rounded-xl border border-red-200 text-center max-w-md shadow-sm space-y-3 z-20">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-red-950">Falha ao Carregar Traçado de ECG</h4>
              <p className="text-xs text-red-800 mt-1">{fileLoadError}</p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => setReloadTrigger((prev) => prev + 1)}
                className="text-xs bg-[#4A90D9] hover:bg-[#3b7dc2] text-white gap-1.5 font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar novamente</span>
              </Button>
            </div>
          </div>
        )}

        {/* Estado 3: Sem arquivo anexado */}
        {!isLoadingFile && !fileLoadError && !exam.exam_file && (
          <div className="w-[560px] h-[380px] bg-white border border-[#E3E6E8] rounded-lg flex flex-col items-center justify-center p-6 text-center shadow-xs">
            <div
              className="w-full h-full rounded flex items-center justify-center relative overflow-hidden"
              style={{
                backgroundColor: '#fffdf8',
                backgroundImage:
                  'linear-gradient(to right, rgba(240,155,125,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(240,155,125,0.18) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              <div className="text-center p-4 bg-white/95 rounded-lg border border-[#E3E6E8] text-[#2F3942] shadow-xs max-w-sm">
                <Info className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
                <div className="font-bold text-xs text-[#2F3942]">Arquivo de ECG Não Anexado</div>
                <div className="text-[11px] text-[#6F7780] mt-1">
                  Nenhum arquivo de imagem ou PDF foi anexado a esta solicitação cadastrada.
                </div>
                <div className="text-[10px] text-[#6F7780] mt-2 bg-[#F7F6F4] p-2 rounded border border-[#E3E6E8]">
                  Para emitir o laudo com segurança diagnóstica, devolva o exame à clínica
                  solicitante solicitando o reenvio do traçado legível.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Estado 4: Visualização com Pan/Zoom de PDF (Canvas Direto) ou Imagem (PNG/JPEG) */}
        {!isLoadingFile && !fileLoadError && exam.exam_file && (
          <div
            className="relative inline-block transition-transform duration-75 ease-out"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
          >
            {isPdf ? (
              /* Traçado direto em PDF renderizado sobre Canvas com PDF.js */
              <div className="relative shadow-sm rounded-lg overflow-hidden bg-white border border-[#E3E6E8]">
                {isRenderingPdfPage && (
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1 z-10">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Renderizando página...</span>
                  </div>
                )}
                <canvas
                  ref={pdfCanvasRef}
                  style={{
                    filter: cssFilter,
                    imageRendering: renderingMode,
                    maxHeight: 'calc(100vh - 220px)',
                    maxWidth: '100%',
                    display: 'block',
                  }}
                  className="pointer-events-none select-none bg-white"
                />
              </div>
            ) : (
              /* Traçado de Imagem (PNG/JPG) com aspect-ratio e contenção */
              <img
                ref={imageRef}
                src={fileBlobUrl || fileUrl}
                alt="Traçado de ECG do Paciente"
                crossOrigin="anonymous"
                style={{
                  filter: cssFilter,
                  imageRendering: renderingMode,
                  maxHeight: 'calc(100vh - 220px)',
                  maxWidth: '100%',
                }}
                className="object-contain rounded-lg border border-[#E3E6E8] shadow-sm bg-white pointer-events-none select-none"
              />
            )}
          </div>
        )}

        {/* Guias Visuais Arrastáveis (Sobrepostas na Área de Visualização) */}
        {showGuides &&
          guides.map((guide) => (
            <div
              key={guide.id}
              onMouseDown={(e) => {
                e.stopPropagation()
                setActiveDraggingGuideId(guide.id)
              }}
              style={
                guide.orientation === 'horizontal'
                  ? { top: `${guide.position}%`, left: 0, right: 0 }
                  : { left: `${guide.position}%`, top: 0, bottom: 0 }
              }
              className={`absolute z-30 group cursor-${
                guide.orientation === 'horizontal' ? 'row-resize' : 'col-resize'
              } ${
                guide.orientation === 'horizontal'
                  ? 'h-3 -translate-y-1.5 flex items-center'
                  : 'w-3 -translate-x-1.5 flex justify-center'
              }`}
            >
              <div
                className={`${
                  guide.orientation === 'horizontal' ? 'w-full h-0.5' : 'h-full w-0.5'
                } bg-[#4A90D9] shadow-xs group-hover:bg-[#2F3942] transition-colors`}
              />
              <span
                className={`absolute text-[9px] font-mono px-1 py-0.2 rounded bg-[#4A90D9] text-white shadow-xs pointer-events-none opacity-80 group-hover:opacity-100 ${
                  guide.orientation === 'horizontal' ? 'right-2 -top-4' : 'top-2 -left-4'
                }`}
              >
                {guide.orientation === 'horizontal' ? 'Guia H' : 'Guia V'}
              </span>
            </div>
          ))}

        {/* Lente da Lupa Nativa 3,5x (Canvas em Amostragem de Pixels Nativa) */}
        {isMagnifierActive && mouseInsideImage && (fileBlobUrl || fileUrl) && (
          <div
            className="pointer-events-none fixed w-[184px] h-[184px] rounded-full border-2 border-[#4A90D9] shadow-2xl overflow-hidden bg-white z-50 flex items-center justify-center"
            style={{
              left: `${magnifierPos.x - 92}px`,
              top: `${magnifierPos.y - 92}px`,
              boxShadow: '0 0 0 3px rgba(74, 144, 217, 0.4), 0 14px 28px rgba(47, 57, 66, 0.35)',
            }}
          >
            <canvas ref={magnifierCanvasRef} className="w-[180px] h-[180px] rounded-full" />
            <div className="absolute bottom-1.5 bg-[#2F3942]/85 text-white font-mono text-[9px] px-1.5 py-0.2 rounded-full backdrop-blur-xs">
              3,5× NATIVO
            </div>
          </div>
        )}
      </div>

      {/* Rodapé com Metadados Clínicos Estritos do Traçado */}
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

        <div className="flex flex-wrap items-center gap-2 text-[#6F7780]">
          <span>
            {calibrationSpeed ? `Velocidade: ${calibrationSpeed}` : 'Velocidade não informada'} •{' '}
            {calibrationGain ? `Ganho: ${calibrationGain}` : 'Ganho não informado'}
          </span>
          {isMagnifierActive && (
            <span className="text-[#4A90D9] font-medium">• Lupa ativa (3,5× nativa)</span>
          )}
          {renderingMode !== 'auto' && (
            <span className="text-[#2F3942] font-mono">• Nitidez: {renderingMode}</span>
          )}
        </div>
      </div>
    </Card>
  )
}
