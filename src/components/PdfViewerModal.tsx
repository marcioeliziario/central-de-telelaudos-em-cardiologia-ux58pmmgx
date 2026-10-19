import React, { useEffect, useRef, useState, useCallback } from 'react'
import { pdfjsLib, initPdfWorker } from '@/lib/pdfWorkerConfig'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  FileDown,
} from 'lucide-react'

// Garante worker configurado
initPdfWorker()

export interface PdfViewerModalProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Bytes do PDF fornecidos diretamente (Uint8Array)
   */
  pdfData?: Uint8Array | null
  /**
   * URL de fetch ou data URI (caso não venham bytes diretamente)
   */
  pdfUrl?: string | null
  /**
   * Título principal do documento exibido no cabeçalho
   */
  title?: string
  /**
   * Nome do arquivo para download autorizado local
   */
  fileName?: string
  /**
   * Metadados opcionais para auditoria visual
   */
  metadata?: {
    documentCode?: string
    version?: number
    sha256?: string
    fileSizeBytes?: number
    disclaimer?: string
    isFinal?: boolean
  } | null
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfData,
  pdfUrl,
  title = 'Visualizador de Laudo Médico em PDF',
  fileName = 'Laudo-ECG.pdf',
  metadata,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [numPages, setNumPages] = useState<number>(0)
  const [zoom, setZoom] = useState<number>(1.2) // 120% padrão para leitura nítida
  const [rotation, setRotation] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Carregar documento PDF a partir de bytes ou URL
  useEffect(() => {
    if (!isOpen) {
      setPdfDoc(null)
      setCurrentPage(1)
      setNumPages(0)
      setErrorMessage(null)
      return
    }

    let isCancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    const loadDocument = async () => {
      try {
        let loadingTask: pdfjsLib.PDFDocumentLoadingTask

        if (pdfData && pdfData.length > 0) {
          // Clone do buffer para evitar neutering se o worker consumir o array
          const copy = new Uint8Array(pdfData)
          loadingTask = pdfjsLib.getDocument({
            data: copy,
          })
        } else if (pdfUrl) {
          loadingTask = pdfjsLib.getDocument({
            url: pdfUrl,
          })
        } else {
          throw new Error('Nenhuma fonte de PDF fornecida para renderização.')
        }

        const loadedDoc = await loadingTask.promise
        if (isCancelled) return

        setPdfDoc(loadedDoc)
        setNumPages(loadedDoc.numPages)
        setCurrentPage(1)
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Falha ao carregar PDF via PDF.js:', err)
          setErrorMessage(err.message || 'Erro ao carregar o documento PDF.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadDocument()

    return () => {
      isCancelled = true
    }
  }, [isOpen, pdfData, pdfUrl])

  // Renderizar página no canvas
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return

      try {
        setIsRenderingPage(true)
        const page = await pdfDoc.getPage(pageNum)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        const viewport = page.getViewport({ scale: zoom, rotation })

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
        console.error('Falha ao renderizar página:', err)
      } finally {
        setIsRenderingPage(false)
      }
    },
    [pdfDoc, zoom, rotation],
  )

  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(currentPage)
    }
  }, [pdfDoc, currentPage, zoom, rotation, renderPage])

  // Controles de zoom: limites entre 50% e 200% conforme diretriz
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(2.0, Math.round((prev + 0.15) * 100) / 100))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.5, Math.round((prev - 0.15) * 100) / 100))
  }

  const handleZoomReset = () => {
    setZoom(1.2)
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(numPages, prev + 1))
  }

  // Download local autorizado via Blob (independe de iframe do navegador)
  const handleDownload = () => {
    try {
      let blob: Blob
      if (pdfData && pdfData.length > 0) {
        // Usa buffer para compatibilidade estrita de ArrayBuffer com BlobPart
        const arrayBuffer = pdfData.buffer.slice(
          pdfData.byteOffset,
          pdfData.byteOffset + pdfData.byteLength,
        ) as ArrayBuffer
        blob = new Blob([arrayBuffer], { type: 'application/pdf' })
      } else if (pdfUrl) {
        // Fallback para URL existente
        const a = document.createElement('a')
        a.href = pdfUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        return
      } else {
        alert('Dados do PDF não disponíveis para download.')
        return
      }

      const localBlobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = localBlobUrl
      link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(localBlobUrl), 1000)
    } catch (err: any) {
      alert(`Falha ao iniciar download autorizado: ${err.message}`)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[96vw] max-w-[96vw] h-[94dvh] max-h-[94dvh] flex flex-col p-0 gap-0 overflow-hidden bg-[#F7F6F4] border-[#E3E6E8] rounded-xl shadow-2xl">
        {/* Cabeçalho do Visualizador */}
        <DialogHeader className="px-5 py-3.5 bg-white border-b border-[#E3E6E8] flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4A90D9]/10 border border-[#4A90D9]/20 flex items-center justify-center text-[#4A90D9]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#2F3942] flex items-center gap-2">
                <span>{title}</span>
                {metadata?.isFinal ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 gap-1 font-semibold"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Laudo Concluído</span>
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 gap-1 font-semibold"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Prévia de Rascunho</span>
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6F7780]">
                {metadata?.documentCode
                  ? `Doc: ${metadata.documentCode} • Versão: ${metadata.version || 1}.0`
                  : 'Renderização nativa segura em Canvas (sem sub-iframe do navegador)'}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleDownload}
              className="h-8 text-xs gap-1.5 bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold shadow-xs"
              title="Baixar arquivo PDF autorizado"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Tarja Informativa / Metadados */}
        {metadata && (
          <div
            className={`px-5 py-2 border-b text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 ${
              metadata.isFinal
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950 font-medium'
            }`}
          >
            <div className="flex items-center gap-2">
              {metadata.isFinal ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              )}
              <span>
                {metadata.disclaimer ||
                  (metadata.isFinal
                    ? 'Documento definitivo com hash SHA-256 e assinatura manuscrita ativa registrada.'
                    : 'DOCUMENTO NÃO ASSINADO. SEM VALIDADE COMO LAUDO FINAL.')}
              </span>
            </div>

            {metadata.sha256 && (
              <div className="text-[11px] font-mono text-slate-600 truncate max-w-md">
                SHA-256: <span className="font-bold text-[#2F3942]">{metadata.sha256}</span>
              </div>
            )}
          </div>
        )}

        {/* Barra de Controles do PDF (Zoom, Paginação, Rotação) */}
        <div className="px-5 py-2 bg-white border-b border-[#E3E6E8] flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs text-[#2F3942]">
          {/* Paginação */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || isLoading}
              className="h-7 px-2 text-xs border-[#E3E6E8]"
              title="Página anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="font-medium text-xs px-2 select-none">
              Página <strong>{numPages > 0 ? currentPage : 0}</strong> de{' '}
              <strong>{numPages}</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextPage}
              disabled={currentPage >= numPages || isLoading}
              className="h-7 px-2 text-xs border-[#E3E6E8]"
              title="Próxima página"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Zoom e Orientação */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5 || isLoading}
              className="h-7 px-2 text-xs border-[#E3E6E8]"
              title="Reduzir Zoom (-15%)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="px-2 py-0.5 text-xs font-mono font-semibold bg-[#F7F6F4] rounded border border-[#E3E6E8] hover:bg-slate-100"
              title="Redefinir Zoom para 120%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleZoomIn}
              disabled={zoom >= 2.0 || isLoading}
              className="h-7 px-2 text-xs border-[#E3E6E8]"
              title="Aumentar Zoom (+15%)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>

            <div className="w-[1px] h-4 bg-[#E3E6E8] mx-1" />

            <Button
              size="sm"
              variant="outline"
              onClick={handleRotate}
              disabled={isLoading}
              className="h-7 px-2 text-xs border-[#E3E6E8]"
              title="Girar 90 graus"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#6F7780]" />
            </Button>
          </div>
        </div>

        {/* Área Central de Visualização (Canvas com Rolagem) */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#525659]/10 relative min-h-[300px]"
        >
          {isLoading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex flex-col items-center justify-center gap-2 z-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#4A90D9]" />
              <p className="text-xs text-[#2F3942] font-semibold">Carregando documento em PDF...</p>
            </div>
          )}

          {errorMessage && (
            <div className="p-6 bg-white rounded-xl border border-red-200 text-center max-w-md shadow-sm space-y-3 z-10">
              <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-red-950">Falha na Visualização do Laudo</h4>
                <p className="text-xs text-red-800 mt-1">{errorMessage}</p>
              </div>
              <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
                Fechar
              </Button>
            </div>
          )}

          {!errorMessage && (
            <div className="relative shadow-lg rounded bg-white overflow-hidden transition-all duration-150">
              {isRenderingPage && (
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1 z-10">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Renderizando...</span>
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="block mx-auto max-w-full"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          )}
        </div>

        {/* Rodapé com Informações de Segurança e Ação de Fechamento */}
        <DialogFooter className="px-5 py-3 bg-white border-t border-[#E3E6E8] flex flex-row items-center justify-between shrink-0">
          <div className="text-[11px] text-[#6F7780] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              Renderização direta em Canvas • Sem plug-in externo ou iframe nativo do navegador
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="text-xs border-[#E3E6E8]"
            >
              Fechar Visualizador
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PdfViewerModal
