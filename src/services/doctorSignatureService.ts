import pb from '@/lib/pocketbase/client'

export interface DoctorSignatureResponse {
  success: boolean
  hasSignature: boolean
  signature: {
    id: string
    userId: string
    fileName: string
    fileHashSha256: string
    isActive: boolean
    lastVerifiedAt: string
    created: string
    updated: string
    signatureFile?: string
    imageDataUri?: string | null
  } | null
}

export interface SaveSignatureResponse {
  success: boolean
  message: string
  isSubstitution: boolean
  signatureId: string
  fileHashSha256: string
  fileName: string
  verifiedAt: string
}

export interface RemoveSignatureResponse {
  success: boolean
  message: string
  removedId: string
}

export interface ReauthResponse {
  success: boolean
  message: string
  reauthToken: string
  mfaVerified: boolean
  timestamp: string
}

export const doctorSignatureService = {
  // Reautenticação forte (senha + TOTP se ativo)
  async reauthenticate(params: {
    password: string
    totp_code?: string
    reason?: string
  }): Promise<ReauthResponse> {
    return await pb.send('/backend/v1/auth/reauth', {
      method: 'POST',
      body: params,
    })
  },

  // Obter assinatura cadastrada do médico atual
  async getCurrentSignature(): Promise<DoctorSignatureResponse> {
    return await pb.send('/backend/v1/doctor/signature/current', {
      method: 'GET',
    })
  },

  // Salvar / Substituir assinatura manuscrita com reautenticação
  async saveSignature(params: {
    password: string
    totp_code?: string
    image_data_uri: string
    file_name?: string
  }): Promise<SaveSignatureResponse> {
    return await pb.send('/backend/v1/doctor/signature/save', {
      method: 'POST',
      body: params,
    })
  },

  // Remover assinatura manuscrita com reautenticação
  async removeSignature(params: {
    password: string
    totp_code?: string
  }): Promise<RemoveSignatureResponse> {
    return await pb.send('/backend/v1/doctor/signature/remove', {
      method: 'DELETE',
      body: params,
    })
  },
}
