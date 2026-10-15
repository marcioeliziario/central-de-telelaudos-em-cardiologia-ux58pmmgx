import pb from '@/lib/pocketbase/client'
import type {
  BirdIdInitTransactionResponse,
  BirdIdProviderInfo,
  BirdIdStatusResponse,
} from '@/types/telelaudos'

/**
 * Conector de Assinatura Digital Bird ID Pro (Soluti CESS)
 * ETAPA 6A da Central de Telelaudos em Cardiologia
 *
 * Mapeamento e fluxo oficial conforme documentação Soluti:
 * - https://docs.vaultid.com.br/workspace/cess
 * - https://docs.vaultid.com.br/workspace/cess/api/assinatura-de-documento-s
 * - https://docs.vaultid.com.br/workspace/cess/instalacao-e-configuracao
 *
 * IMPORTANTE:
 * 1. O conector opera com conexão externa desativada (standby) até o recebimento
 *    das credenciais comerciais e de homologação da Soluti.
 * 2. Em hipótese alguma armazena PIN, OTP, senhas ou chaves privadas.
 * 3. Suporta PAdES (PDFSignature) com hash SHA-256 e transações assíncronas via TCN.
 * 4. A resposta de sucesso do provedor NÃO equivale a assinatura validada; a liberação clínica
 *    permanece estritamente condicionada aos 7 critérios de conformidade criptográfica.
 */

export const birdIdProConnector = {
  /**
   * Consulta os provedores de assinatura cadastrados e o status de ativação do Bird ID Pro
   */
  async getProvidersStatus(): Promise<{
    success: boolean
    providers: BirdIdProviderInfo[]
    instructions: string[]
  }> {
    const res = await pb.send('/backend/v1/signatures/providers', {
      method: 'GET',
    })
    return res
  },

  /**
   * ETAPA 6B: Consulta detalhada de status de configuração e secrets do Bird ID Pro
   * Acessível apenas a administradores com perfil médico cadastrado.
   */
  async getConfigStatus(): Promise<{
    success: boolean
    userContext: {
      userId: string
      name: string
      email: string
      isAdmin: boolean
      isDoctor: boolean
      crm: string
      crmState: string
      rqe?: string
      specialty?: string
    }
    provider: {
      id: string
      name: string
      type: string
      officialDocs: string
      homologationEndpoint: string
      productionEndpoint: string
      activeBaseUrl: string
    }
    secretsStatus: {
      BIRDID_CLIENT_ID: 'CONFIGURADO' | 'AUSENTE'
      BIRDID_CLIENT_SECRET: 'CONFIGURADO' | 'AUSENTE'
      BIRDID_PRO_ENABLED: 'HABILITADO' | 'DESABILITADO_OU_AUSENTE'
      BIRDID_PRO_BASE_URL: string
      isFullyConfigured: boolean
      canExecuteRealSigning: boolean
      blockReason: string | null
    }
    officialRequirements: {
      architecture: string
      signatureServicePath: string
      uploadPath: string
      statusPath: string
      downloadPath: string
      authPath: string
      callbackPath: string
      prohibitions: string[]
    }
  }> {
    const res = await pb.send('/backend/v1/signatures/birdid/config-status', {
      method: 'GET',
    })
    return res
  },

  /**
   * ETAPA 6B: Teste de conectividade pública de rede com o host oficial de homologação
   * Sem exigir credenciais (reachability/TLS honesto de rede).
   */
  async checkHomologationConnectivity(): Promise<{
    success: boolean
    testType: string
    classification: string
    endpointTested: string
    reachability: string
    httpStatusCode: number
    latencyMs: number
    details: string
    testedAt: string
  }> {
    const res = await pb.send('/backend/v1/signatures/birdid/check-connectivity', {
      method: 'POST',
    })
    return res
  },

  /**
   * ETAPA 6B: Geração de PDF fictício de teste com tarja clara mandatória e isolamento
   */
  async generateTestPdf(): Promise<{
    success: boolean
    testId: string
    generatedAt: string
    originalSha256: string
    fileSizeBytes: number
    doctor: {
      name: string
      crm: string
      crmState: string
      rqe?: string
      specialty: string
    }
    patient: {
      name: string
      cpf: string
      birth: string
      isFictional: boolean
    }
    disclaimer: string
    pdfRawString: string
  }> {
    const res = await pb.send('/backend/v1/signatures/birdid/generate-test-pdf', {
      method: 'POST',
    })
    return res
  },

  /**
   * Inicia uma transação de assinatura Bird ID Pro para o documento especificado
   */
  async initTransaction(documentId: string): Promise<BirdIdInitTransactionResponse> {
    const res = await pb.send('/backend/v1/signatures/request', {
      method: 'POST',
      body: {
        document_id: documentId,
        provider: 'birdid',
      },
    })
    return res
  },

  /**
   * Envia o PDF para assinatura associando-o ao TCN da transação
   */
  async uploadPdfForSigning(params: { transactionId?: string; tcn?: string }): Promise<{
    success: boolean
    simulated: boolean
    isRealConnectionActive: boolean
    message: string
    tcn: string
    transactionId: string
    documentCode: string
    pdfSha256: string
    status: string
    disclaimer: string
  }> {
    const res = await pb.send('/backend/v1/signatures/birdid/upload-pdf', {
      method: 'POST',
      body: {
        transaction_id: params.transactionId,
        tcn: params.tcn,
      },
    })
    return res
  },

  /**
   * Consulta o status externo da transação pelo TCN ou transactionId
   */
  async queryStatus(tcnOrTxId: string): Promise<BirdIdStatusResponse> {
    const res = await pb.send(
      `/backend/v1/signatures/birdid/status/${encodeURIComponent(tcnOrTxId)}`,
      {
        method: 'GET',
      },
    )
    return res
  },

  /**
   * Dispara um evento de simulação de homologação (exclusivo para testes locais e homologação 6A)
   */
  async triggerMockEvent(params: {
    transactionId: string
    eventType: 'SIGN_SUCCESS' | 'SIGN_FAIL'
  }): Promise<{
    success: boolean
    simulated: boolean
    transactionId: string
    newStatus: string
    externalStatus: string
    isClinicallyReleased: boolean
    disclaimer: string
  }> {
    const res = await pb.send('/backend/v1/signatures/birdid/mock-event', {
      method: 'POST',
      body: {
        transaction_id: params.transactionId,
        event_type: params.eventType,
      },
    })
    return res
  },

  /**
   * Envia callback (usado para testes de integração de webhook)
   */
  async postCallback(payload: {
    transaction_id: string
    signed_hash_sha256?: string
    status?: string
    external_status?: string
    certificate_alias?: string
    error_message?: string
    is_simulated?: boolean
    anti_replay_token?: string
  }): Promise<{
    success: boolean
    message: string
    transactionId: string
    verified: boolean
    newStatus: string
    externalStatus: string
    isClinicallyReleased: boolean
    duplicateIgnored?: boolean
  }> {
    const res = await pb.send('/backend/v1/signatures/callback', {
      method: 'POST',
      body: payload,
    })
    return res
  },

  /**
   * Submete a transação ao checklist estrito de 7 critérios de conformidade ICP-Brasil
   */
  async validateAndRelease(signatureId: string): Promise<{
    success: boolean
    isClinicallyReleased: boolean
    allPassed: boolean
    passedCount: number
    totalCount: number
    message?: string
    checklist: Array<{
      id: string
      name: string
      description: string
      passed: boolean
      details: string
    }>
  }> {
    const res = await pb.send('/backend/v1/signatures/validate-and-release', {
      method: 'POST',
      body: {
        signature_id: signatureId,
      },
    })
    return res
  },
}
