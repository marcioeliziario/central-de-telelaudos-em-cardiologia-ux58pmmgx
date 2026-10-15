import pb from '@/lib/pocketbase/client'

export interface MfaStatusResponse {
  success: boolean
  userId: string
  email: string
  name?: string
  isActive: boolean
  roles: string[]
  isAdmin: boolean
  isCardiologist: boolean
  doctorProfile?: {
    crm: string
    crmState: string
    rqe?: string
    specialty?: string
  } | null
  mfa: {
    enabled: boolean
    enforced: boolean
    enforcedRole: string
    verifiedAt?: string | null
    method: string
    algorithm: string
    periodSeconds: number
    digits: number
  }
  sessionSecurity: {
    tokenKeyRotationSupported: boolean
    lastRevokedAt?: string | null
    authTokenDurationSeconds: number
  }
}

export interface MfaSetupResponse {
  success: boolean
  message: string
  secret: string
  otpauthUri: string
  issuer: string
  account: string
  period: number
  digits: number
}

export interface MfaEnableResponse {
  success: boolean
  message: string
  mfaEnabled: boolean
  verifiedAt: string
  recoveryCodes: string[]
}

export interface MfaDisableResponse {
  success: boolean
  message: string
  mfaEnabled: boolean
}

export interface MfaVerifyLoginResponse {
  success: boolean
  message: string
  userId: string
  mfaSessionToken: string
  verifiedAt: string
}

export interface SessionRevocationResponse {
  success: boolean
  message: string
  targetUserId: string
  actionType: string
  tokensRevoked: boolean
  userActive: boolean
  doctorDeactivated: boolean
  revokedAt: string
}

export const mfaSecurityService = {
  // Obter status de MFA e sessão do usuário autenticado
  async getStatus(): Promise<MfaStatusResponse> {
    return await pb.send('/backend/v1/auth/mfa/status', { method: 'GET' })
  },

  // Iniciar cadastro de segundo fator (gerar segredo TOTP e QR code URI)
  async setupMfa(): Promise<MfaSetupResponse> {
    return await pb.send('/backend/v1/auth/mfa/setup', { method: 'POST' })
  },

  // Ativar segundo fator com código válido do autenticador
  async enableMfa(code: string): Promise<MfaEnableResponse> {
    return await pb.send('/backend/v1/auth/mfa/enable', {
      method: 'POST',
      body: { code },
    })
  },

  // Desativar segundo fator com código ou senha
  async disableMfa(code?: string, password?: string): Promise<MfaDisableResponse> {
    return await pb.send('/backend/v1/auth/mfa/disable', {
      method: 'POST',
      body: { code, password },
    })
  },

  // Validar segundo passo no login
  async verifyLogin(
    userId: string,
    code: string,
    isRecovery = false,
  ): Promise<MfaVerifyLoginResponse> {
    return await pb.send('/backend/v1/auth/mfa/verify-login', {
      method: 'POST',
      body: { user_id: userId, code, is_recovery: isRecovery },
    })
  },

  // Revogar sessões / bloquear usuário (Admin)
  async revokeUserSessions(params: {
    targetUserId: string
    actionType: 'revoke_tokens' | 'deactivate_user' | 'deactivate_doctor'
    reason?: string
  }): Promise<SessionRevocationResponse> {
    return await pb.send('/backend/v1/auth/sessions/revoke-user', {
      method: 'POST',
      body: {
        target_user_id: params.targetUserId,
        action_type: params.actionType,
        reason: params.reason,
      },
    })
  },

  // Configurar política de exigência por perfil (Admin)
  async configurePolicy(targetRole: 'none' | 'admin' | 'cardiologist' | 'all', enforce: boolean) {
    return await pb.send('/backend/v1/auth/mfa/policy-config', {
      method: 'POST',
      body: { target_role: targetRole, enforce },
    })
  },
}
