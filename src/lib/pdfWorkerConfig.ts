import * as pdfjsLib from 'pdfjs-dist'

/**
 * Configuração centralizada e robusta do worker do PDF.js para o ecossistema Vite + Skip Cloud.
 *
 * Por que `new Worker(new URL(..., import.meta.url), { type: 'module' })` com `workerPort`?
 * 1. O Vite reconhece a sintaxe `new Worker(new URL('...', import.meta.url), { type: 'module' })`
 *    nativamente, agrupando o worker como um arquivo estático próprio servido sob a mesma origem
 *    (`window.location.origin`), sem acionar dynamic import em runtime no thread principal.
 * 2. Em ambientes de preview com CSP restritivo onde CDNs externas (unpkg/cdnjs/jsdelivr) e
 *    módulos dinâmicos remotos são bloqueados, o `workerPort` com Worker nativo evita o fallback
 *    para o fake-worker do PDF.js e previne a exceção "Setting up fake worker failed".
 * 3. `workerPort` reutiliza uma instância do Worker em todo o ciclo de vida do cliente.
 */

let initialized = false
let sharedWorker: Worker | null = null

export function initPdfWorker(): typeof pdfjsLib {
  if (initialized && sharedWorker) {
    return pdfjsLib
  }

  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      if (!sharedWorker) {
        sharedWorker = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), {
          type: 'module',
        })
      }
      pdfjsLib.GlobalWorkerOptions.workerPort = sharedWorker
      initialized = true
    } catch (err) {
      console.warn('Falha ao instanciar Web Worker do PDF.js via workerPort:', err)
    }
  }

  return pdfjsLib
}

// Inicialização imediata ao carregar o módulo
initPdfWorker()

export { pdfjsLib }
