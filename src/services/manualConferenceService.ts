import pb from '@/lib/pocketbase/client'

// Cliente de conferência manual da assinatura externa (CardioLaudo).
// Estados derivados do backend; rótulos distintos entre conferência manual
// e validação criptográfica automática.

export type SignatureExternalState =
  | 'AGUARDANDO_ASSINATURA'
  | 'PDF_ASSINADO_RECEBIDO'
  | 'AGUARDANDO_CONFERENCIA'
  | 'CONFERENCIA_MANUAL_REGISTRADA'
  | 'VALIDADO_CRIPTOGRAFICAMENTE'
  | 'LIBERADO_A_CLINICA'
  | 'REJEITADO'

export const SIGNATURE_STATE_LABELS: Record<SignatureExternalState, string> = {
  AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
  PDF_ASSINADO_RECEBIDO: 'PDF assinado recebido',
  AGUARDANDO_CONFERENCIA: 'Aguardando conferência',
  CONFERENCIA_MANUAL_REGISTRADA: 'CONFERÊNCIA MANUAL REGISTRADA',
  VALIDADO_CRIPTOGRAFICAMENTE: 'ASSINATURA VALIDADA CRIPTOGRAFICAMENTE (AUTOMÁTICA)',
  LIBERADO_A_CLINICA: 'Liberado à clínica',
  REJEITADO: 'Rejeitado',
}

export interface SignatureStateResponse {
  success: boolean
  found?: boolean
  signatureId?: string
  documentId?: string
  documentVersion?: number | null
  examRequestId?: string
  state: SignatureExternalState
  stateLabel?: string
  isClinicallyReleased?: boolean
  padesDetected?: boolean
  isSimulated?: boolean
  validationType?: string
  cryptoValidationResult?: string
  signedFileHash?: string
  originalFileHash?: string
  manualConference?: {
    responsibleName?: string
    responsibleCrm?: string
    timestamp?: string
    reportRef?: string
    declaration?: boolean
    notes?: string
  }
  rejectionReason?: string
  message?: string
  blockers?: string[]
}

function extractMessage(err: any): string {
  return (
    err?.response?.message || err?.message || 'Não foi possível concluir a operação de assinatura.'
  )
}

export const manualConferenceService = {
  async fetchState(documentId: string): Promise<SignatureStateResponse> {
    try {
      return (await pb.send(`/backend/v1/signatures/conference-state/${documentId}`, {
        method: 'GET',
      })) as SignatureStateResponse
    } catch (err: any) {
      throw new Error(extractMessage(err))
    }
  },

  async uploadSignedPdf(params: {
    signatureId: string
    pdfBase64: string
    reportVersion?: number
    originalPdfHash?: string
    signedPdfHash?: string
  }): Promise<SignatureStateResponse> {
    try {
      return (await pb.send('/backend/v1/signatures/signed-pdf', {
        method: 'POST',
        body: params,
      })) as SignatureStateResponse
    } catch (err: any) {
      throw new Error(extractMessage(err))
    }
  },

  async registerConference(params: {
    signatureId: string
    declaration: boolean
    responsibleName?: string
    responsibleCrm?: string
    originalPdfHash?: string
    signedPdfHash?: string
    signerName?: string
    signerCrm?: string
    validarItiResult?: string
    validarItiReference?: string
    validarItiEvidence?: string
    notes?: string
  }): Promise<SignatureStateResponse> {
    try {
      return (await pb.send('/backend/v1/signatures/manual-conference', {
        method: 'POST',
        body: params,
      })) as SignatureStateResponse
    } catch (err: any) {
      throw new Error(extractMessage(err))
    }
  },

  async rejectSignedPdf(
    signatureId: string,
    rejectionReason: string,
  ): Promise<SignatureStateResponse> {
    try {
      return (await pb.send('/backend/v1/signatures/manual-conference/reject', {
        method: 'POST',
        body: { signatureId, rejection_reason: rejectionReason },
      })) as SignatureStateResponse
    } catch (err: any) {
      throw new Error(extractMessage(err))
    }
  },

  async requestClinicalRelease(signatureId: string): Promise<SignatureStateResponse> {
    try {
      return (await pb.send('/backend/v1/signatures/clinical-release', {
        method: 'POST',
        body: { signatureId },
      })) as SignatureStateResponse
    } catch (err: any) {
      throw new Error(extractMessage(err))
    }
  },
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const idx = result.indexOf('base64,')
      resolve(idx >= 0 ? result.slice(idx + 7) : result)
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo do PDF assinado.'))
    reader.readAsDataURL(file)
  })
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
