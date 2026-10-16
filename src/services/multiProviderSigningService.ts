import pb from '@/lib/pocketbase/client'
import type {
  MultiSigningProvider,
  SigningSessionActiveResponse,
  SigningSessionInitResponse,
  SigningSessionCallbackResponse,
  SignDocumentResponse,
  SigningScope,
} from '@/types/telelaudos'

/**
 * Interface Comum de Assinatura Digital (Common Signing Interface - Etapa E1)
 *
 * Padroniza os métodos necessários para a integração de qualquer provedor ICP-Brasil:
 * 1. Listagem de provedores disponíveis
 * 2. Início de autenticação
 * 3. Consulta da sessão autorizada
 * 4. Identificação do certificado
 * 5. Solicitação de assinatura individual de PDF
 * 6. Recuperação do documento assinado
 * 7. Verificação criptográfica
 * 8. Encerramento ou revogação de sessão
 */
export interface ICommonSigningAdapter {
  providerKey: string
  displayName: string
  listProviders(): Promise<MultiSigningProvider[]>
  initAuth(params: {
    pscId?: string
    scope?: SigningScope
    lifetimeSeconds?: number
    redirectUri?: string
  }): Promise<SigningSessionInitResponse>
  getActiveSession(): Promise<SigningSessionActiveResponse>
  processCallback(params: {
    state: string
    token?: string
    isSimulated?: boolean
  }): Promise<SigningSessionCallbackResponse>
  revokeSession(
    sessionId?: string,
  ): Promise<{ success: boolean; revokedCount: number; message: string }>
  signDocument(params: { documentId: string; isSimulated?: boolean }): Promise<SignDocumentResponse>
}

/**
 * Serviço de Assinatura Multiprovedor (Frontend)
 */
export const multiProviderSigningService = {
  /**
   * 1. Lista os provedores configurados e seus PSCs suportados
   */
  async getProviders(): Promise<{
    success: boolean
    providers: MultiSigningProvider[]
    architecture: string
    bryCommercialStatus: string
    birdIdCommercialStatus: string
  }> {
    return await pb.send('/backend/v1/signing/providers', {
      method: 'GET',
    })
  },

  /**
   * 2. Inicia o fluxo de autorização no PSC escolhido (OAuth / Link)
   */
  async initSession(params: {
    providerKey: string
    pscId?: string
    scope?: SigningScope
    lifetimeSeconds?: number
    redirectUri?: string
  }): Promise<SigningSessionInitResponse> {
    return await pb.send('/backend/v1/signing/sessions/init', {
      method: 'POST',
      body: {
        provider_key: params.providerKey,
        psc_id: params.pscId || 'birdid',
        scope: params.scope || 'signature_session',
        lifetime_seconds: params.lifetimeSeconds || 3600,
        redirect_uri: params.redirectUri,
      },
    })
  },

  /**
   * 3. Consulta o estado da sessão de assinatura ativa do médico
   */
  async getActiveSession(): Promise<SigningSessionActiveResponse> {
    return await pb.send('/backend/v1/signing/sessions/active', {
      method: 'GET',
    })
  },

  /**
   * 4. Envia o callback do PSC (uso único do state, criptografia em repouso)
   */
  async processCallback(params: {
    state: string
    token?: string
    isSimulated?: boolean
  }): Promise<SigningSessionCallbackResponse> {
    return await pb.send('/backend/v1/signing/sessions/callback', {
      method: 'POST',
      body: {
        state: params.state,
        token: params.token,
        is_simulated: params.isSimulated,
      },
    })
  },

  /**
   * 5. Revoga ou encerra a sessão ativa do médico
   */
  async revokeSession(sessionId?: string): Promise<{
    success: boolean
    revokedCount: number
    revocationType?: string
    providerDetails?: Array<{
      provider: string
      mechanism: string
      providerEndpoint: string
      note: string
    }>
    message: string
  }> {
    return await pb.send('/backend/v1/signing/sessions/revoke', {
      method: 'POST',
      body: {
        session_id: sessionId,
      },
    })
  },

  /**
   * Executa a bateria de validação criptográfica (AES-256-GCM) no backend (Etapa E1B)
   */
  async runCryptoTestSuite(): Promise<{
    success: boolean
    algorithm: string
    keyVersion: string
    allPassed: boolean
    tests: Array<{
      testId: string
      name: string
      status: 'PASSED' | 'FAILED'
      details: string
    }>
  }> {
    return await pb.send('/backend/v1/signing/crypto-test-suite', {
      method: 'POST',
    })
  },

  /**
   * 6. Solicitação de assinatura individual de PDF via provedor selecionado
   * (Sem lote obrigatório: uma chamada por documento)
   */
  async signDocument(params: {
    documentId: string
    providerKey?: string
    isSimulated?: boolean
  }): Promise<SignDocumentResponse> {
    return await pb.send('/backend/v1/signing/sign-document', {
      method: 'POST',
      body: {
        document_id: params.documentId,
        provider_key: params.providerKey || 'integra_bry',
        is_simulated: params.isSimulated,
      },
    })
  },
}
