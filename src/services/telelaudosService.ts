import pb from '@/lib/pocketbase/client'
import {
  Organization,
  Unit,
  Doctor,
  Patient,
  ExamRequest,
  UserOrganization,
  AuditLog,
} from '@/types/telelaudos'

export const organizationService = {
  async getAll(): Promise<Organization[]> {
    return await pb.collection('organizations').getFullList<Organization>({
      sort: 'name',
    })
  },

  async getById(id: string): Promise<Organization> {
    return await pb.collection('organizations').getOne<Organization>(id)
  },

  async create(data: Partial<Organization>): Promise<Organization> {
    return await pb.collection('organizations').create<Organization>(data)
  },

  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    return await pb.collection('organizations').update<Organization>(id, data)
  },
}

export const unitService = {
  async getAll(orgId?: string): Promise<Unit[]> {
    const filter = orgId ? `organization_id = '${orgId}'` : ''
    return await pb.collection('units').getFullList<Unit>({
      filter,
      sort: 'name',
      expand: 'organization_id',
    })
  },

  async create(data: Partial<Unit>): Promise<Unit> {
    return await pb.collection('units').create<Unit>(data)
  },

  async update(id: string, data: Partial<Unit>): Promise<Unit> {
    return await pb.collection('units').update<Unit>(id, data)
  },
}

export const doctorService = {
  async getAll(): Promise<Doctor[]> {
    return await pb.collection('doctors').getFullList<Doctor>({
      sort: 'crm',
      expand: 'user_id,organization_id',
    })
  },

  async create(data: Partial<Doctor>): Promise<Doctor> {
    return await pb.collection('doctors').create<Doctor>(data)
  },
  async update(id: string, data: Partial<Doctor>): Promise<Doctor> {
    return await pb.collection('doctors').update<Doctor>(id, data)
  },
  async getByUserId(userId: string): Promise<Doctor | null> {
    try {
      const res = await pb.collection('doctors').getList<Doctor>(1, 1, {
        filter: `user_id = '${userId}' && is_active = true`,
        expand: 'user_id,organization_id',
      })
      return res.items.length > 0 ? res.items[0] : null
    } catch {
      return null
    }
  },
}

export const patientService = {
  async getAll(orgId?: string): Promise<Patient[]> {
    const filter = orgId ? `organization_id = '${orgId}'` : ''
    return await pb.collection('patients').getFullList<Patient>({
      filter,
      sort: '-created',
      expand: 'organization_id,unit_id',
    })
  },

  async getById(id: string): Promise<Patient> {
    return await pb.collection('patients').getOne<Patient>(id, {
      expand: 'organization_id,unit_id',
    })
  },

  async create(data: Partial<Patient>): Promise<Patient> {
    return await pb.collection('patients').create<Patient>(data)
  },

  async update(id: string, data: Partial<Patient>): Promise<Patient> {
    return await pb.collection('patients').update<Patient>(id, data)
  },
}

export const examService = {
  async getAll(filter?: string): Promise<ExamRequest[]> {
    return await pb.collection('exam_requests').getFullList<ExamRequest>({
      filter,
      sort: '-created',
      expand: 'patient_id,organization_id,unit_id,requested_by,assigned_doctor_id',
    })
  },

  async getById(id: string): Promise<ExamRequest> {
    return await pb.collection('exam_requests').getOne<ExamRequest>(id, {
      expand: 'patient_id,organization_id,unit_id,requested_by,assigned_doctor_id',
    })
  },

  async create(formData: FormData): Promise<ExamRequest> {
    return await pb.collection('exam_requests').create<ExamRequest>(formData)
  },

  async updateStatus(
    id: string,
    status: ExamRequest['status'],
    doctorId?: string,
  ): Promise<ExamRequest> {
    const payload: Partial<ExamRequest> = { status }
    if (doctorId) payload.assigned_doctor_id = doctorId
    return await pb.collection('exam_requests').update<ExamRequest>(id, payload)
  },

  // Chamada atômica ao backend para assumir exame (com lock no banco)
  async claimExam(id: string): Promise<{ success: boolean; message: string; exam: ExamRequest }> {
    return await pb.send(`/backend/v1/exams/${id}/claim`, {
      method: 'POST',
    })
  },

  // Chamada atômica ao backend para devolver exame com justificativa técnica
  async returnExam(
    id: string,
    reason: string,
  ): Promise<{ success: boolean; message: string; exam: ExamRequest }> {
    return await pb.send(`/backend/v1/exams/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },

  // Salvar rascunho de laudo com versionamento automático no backend
  async saveDraft(
    id: string,
    data: any,
  ): Promise<{ success: boolean; message: string; draft: any }> {
    return await pb.send(`/backend/v1/exams/${id}/draft`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Concluir elaboração do laudo e avançar para aguardando assinatura (SEM liberação direta)
  async submitReport(
    id: string,
    data: any,
  ): Promise<{ success: boolean; message: string; report: any }> {
    return await pb.send(`/backend/v1/exams/${id}/submit-report`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Registrar comunicação de achado potencialmente crítico
  async registerCriticalFinding(
    id: string,
    data: any,
  ): Promise<{ success: boolean; message: string; finding: any }> {
    return await pb.send(`/backend/v1/exams/${id}/critical-finding`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}

export const userOrgService = {
  async getForUser(userId: string): Promise<UserOrganization[]> {
    return await pb.collection('user_organizations').getFullList<UserOrganization>({
      filter: `user_id = '${userId}' && is_active = true`,
      expand: 'organization_id,user_id',
    })
  },

  async getAll(): Promise<UserOrganization[]> {
    return await pb.collection('user_organizations').getFullList<UserOrganization>({
      sort: '-created',
      expand: 'organization_id,user_id',
    })
  },
}

export const auditService = {
  async getRecent(limit = 50): Promise<AuditLog[]> {
    return await pb
      .collection('audit_logs')
      .getList<AuditLog>(1, limit, {
        sort: '-created',
        expand: 'user_id,organization_id',
      })
      .then((res) => res.items)
  },
}

export const templateService = {
  async getAll(): Promise<any[]> {
    return await pb.collection('report_templates').getFullList({
      filter: 'is_active = true',
      sort: 'category,title',
    })
  },
}

export const personalTemplateService = {
  async getForUser(userId: string): Promise<any[]> {
    try {
      return await pb.collection('personal_report_templates').getFullList({
        filter: `user_id = '${userId}' && is_active = true`,
        sort: 'category,title',
      })
    } catch {
      return []
    }
  },

  async create(data: {
    user_id: string
    doctor_id?: string
    title: string
    category: string
    description: string
    conclusion: string
  }): Promise<any> {
    return await pb.collection('personal_report_templates').create({
      ...data,
      is_active: true,
    })
  },

  async update(
    id: string,
    data: Partial<{
      title: string
      category: string
      description: string
      conclusion: string
      is_active: boolean
    }>,
  ): Promise<any> {
    return await pb.collection('personal_report_templates').update(id, data)
  },

  async remove(id: string): Promise<boolean> {
    try {
      await pb.collection('personal_report_templates').delete(id)
      return true
    } catch {
      return false
    }
  },
}

export const doctorPreferenceService = {
  async getForUser(userId: string): Promise<{
    default_report_mode: 'structured' | 'free_text'
    auto_generate_proposal_enabled?: boolean
    id?: string
  } | null> {
    try {
      const records = await pb.collection('doctor_preferences').getList(1, 1, {
        filter: `user_id = '${userId}'`,
      })
      if (records.items.length > 0) {
        const item: any = records.items[0]
        return {
          id: item.id,
          default_report_mode: item.default_report_mode || 'structured',
          auto_generate_proposal_enabled: Boolean(item.auto_generate_proposal_enabled),
        }
      }
      return null
    } catch {
      return null
    }
  },

  async savePreference(
    userId: string,
    mode: 'structured' | 'free_text',
    doctorId?: string,
  ): Promise<any> {
    try {
      const existing = await this.getForUser(userId)
      if (existing && existing.id) {
        return await pb.collection('doctor_preferences').update(existing.id, {
          default_report_mode: mode,
          ...(doctorId ? { doctor_id: doctorId } : {}),
        })
      } else {
        return await pb.collection('doctor_preferences').create({
          user_id: userId,
          doctor_id: doctorId || null,
          default_report_mode: mode,
          auto_generate_proposal_enabled: false,
        })
      }
    } catch (err) {
      console.error('Erro ao persistir preferência do médico:', err)
      throw err
    }
  },
}

export const draftService = {
  async getLatestForExam(examId: string): Promise<any | null> {
    try {
      const drafts = await pb.collection('report_drafts').getList(1, 1, {
        filter: `exam_request_id = '${examId}' && is_latest = true`,
        sort: '-version',
        expand: 'author_id,doctor_id',
      })
      return drafts.items.length > 0 ? drafts.items[0] : null
    } catch {
      return null
    }
  },

  async getHistoryForExam(examId: string): Promise<any[]> {
    return await pb.collection('report_drafts').getFullList({
      filter: `exam_request_id = '${examId}'`,
      sort: '-version',
      expand: 'author_id,doctor_id',
    })
  },
}

export const reportService = {
  async getForExam(examId: string): Promise<any | null> {
    try {
      const list = await pb.collection('ecg_reports').getList(1, 1, {
        filter: `exam_request_id = '${examId}'`,
        expand: 'doctor_id,patient_id,organization_id',
      })
      return list.items.length > 0 ? list.items[0] : null
    } catch {
      return null
    }
  },

  async getAllWaitingSignature(): Promise<any[]> {
    return await pb.collection('ecg_reports').getFullList({
      filter: "status = 'waiting_signature'",
      sort: '-created',
      expand: 'exam_request_id,doctor_id,patient_id,organization_id',
    })
  },
}

export const criticalFindingService = {
  async getForExam(examId: string): Promise<any[]> {
    return await pb.collection('critical_findings').getFullList({
      filter: `exam_request_id = '${examId}'`,
      sort: '-created',
      expand: 'doctor_id',
    })
  },
}

// -------------------------------------------------------------
// ETAPA 4A: DOCUMENTOS MÉDICOS (PDF) E PREPARAÇÃO PARA ASSINATURA
// -------------------------------------------------------------

export const documentService = {
  // Gera prévia do PDF (com tarja "DOCUMENTO NÃO ASSINADO") — somente cardiologista/admin
  async getPreview(examId: string): Promise<{
    success: boolean
    isPreview: boolean
    documentCode: string
    version: number
    sha256: string
    fileSizeBytes: number
    disclaimer: string
    pdfRawString: string
  }> {
    return await pb.send(`/backend/v1/exams/${examId}/report-pdf-preview`, {
      method: 'GET',
    })
  },

  // Gera PDF definitivo, grava SHA-256, bloqueia a versão e cria registro de assinatura (NAO_INICIADA)
  async prepareForSignature(examId: string): Promise<{
    success: boolean
    message: string
    document: any
    signature: any
    sha256: string
    version: number
    documentCode: string
  }> {
    return await pb.send(`/backend/v1/exams/${examId}/prepare-signature`, {
      method: 'POST',
    })
  },

  // Solicita metadados de download (auditoria de acesso registrada no backend)
  async requestDownload(docId: string): Promise<{
    success: boolean
    documentId: string
    documentCode: string
    version: number
    fileHashSha256: string
    fileSizeBytes: number
    generatedAt: string
    fileName: string
  }> {
    return await pb.send(`/backend/v1/documents/${docId}/download`, {
      method: 'GET',
    })
  },

  // Lista documentos (versões) gerados para um exame
  async getDocumentsForExam(examId: string): Promise<any[]> {
    return await pb.collection('report_documents').getFullList({
      filter: `exam_request_id = '${examId}'`,
      sort: '-version',
      expand: 'doctor_id,exam_request_id',
    })
  },

  // Consulta status da assinatura de um documento
  async getSignatureForDocument(documentId: string): Promise<any | null> {
    try {
      const list = await pb.collection('report_signatures').getList(1, 1, {
        filter: `report_document_id = '${documentId}'`,
        sort: '-created',
        expand: 'report_document_id,doctor_id',
      })
      return list.items.length > 0 ? list.items[0] : null
    } catch {
      return null
    }
  },

  // Consulta todas as assinaturas de um exame
  async getSignaturesForExam(examId: string): Promise<any[]> {
    return await pb.collection('report_signatures').getFullList({
      filter: `exam_request_id = '${examId}'`,
      sort: '-created',
      expand: 'report_document_id,doctor_id',
    })
  },

  // Consulta histórico completo de assinaturas de um documento (Etapa 6A)
  async getSignaturesByDocument(documentId: string): Promise<any[]> {
    return await pb.collection('report_signatures').getFullList({
      filter: `report_document_id = '${documentId}'`,
      sort: '-created',
      expand: 'report_document_id,doctor_id',
    })
  },

  // Etapa 5: Geração de Token Temporário Seguro para Visualização e Download de Laudo Liberado
  async getSecureAccessToken(docId: string): Promise<{
    success: boolean
    documentId: string
    documentCode: string
    version: number
    fileHashSha256: string
    isClinicallyReleased: boolean
    accessToken: string
    expiresInSeconds: number
    downloadUrl: string
  }> {
    return await pb.send(`/backend/v1/documents/${docId}/access-token`, {
      method: 'GET',
    })
  },

  // Etapa 5: Executar download via token temporário seguro (auditado no backend)
  async downloadWithSecureToken(docId: string, token: string, userId: string): Promise<any> {
    return await pb.send(
      `/backend/v1/documents/${docId}/download-secure?token=${encodeURIComponent(token)}&u=${userId}`,
      { method: 'GET' },
    )
  },

  // v0.0.35: Obter bytes de PDF protegido do PocketBase via requisição autenticada
  async fetchDocumentFileBytes(docId: string, fileName: string): Promise<Uint8Array> {
    const fileUrl = pb.files.getURL(
      { id: docId, collectionName: 'report_documents' } as any,
      fileName,
    )
    const token = pb.authStore.token
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = token
    }
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers,
    })
    if (!response.ok) {
      throw new Error(`Falha ao carregar arquivo de PDF protegido (${response.status})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  },
}

// -------------------------------------------------------------
// ETAPA 5: SERVIÇOS DE SLA E NOTIFICAÇÕES INTERNAS
// -------------------------------------------------------------

export const slaService = {
  async getAll(): Promise<any[]> {
    return await pb.collection('contract_slas').getFullList({
      sort: 'contract_name',
      expand: 'organization_id',
    })
  },

  async getForOrg(orgId: string): Promise<any | null> {
    try {
      const list = await pb.collection('contract_slas').getList(1, 1, {
        filter: `organization_id = '${orgId}'`,
        expand: 'organization_id',
      })
      return list.items.length > 0 ? list.items[0] : null
    } catch {
      return null
    }
  },

  async update(id: string, data: any): Promise<any> {
    return await pb.collection('contract_slas').update(id, data)
  },

  // Recalcular prazos de SLA sob demanda no backend
  async refreshSlaStatus(): Promise<{
    success: boolean
    totalEvaluated: number
    updatedCount: number
    nearWarningCount: number
    overdueCount: number
    timestamp: string
  }> {
    return await pb.send('/backend/v1/sla/refresh-status', {
      method: 'POST',
    })
  },

  // Obter status e histórico da tarefa agendada (cron) de SLA
  async getJobStatus(): Promise<any> {
    return await pb.send('/backend/v1/sla/job-status', {
      method: 'GET',
    })
  },

  // Executar ciclo de SLA sob demanda e registrar em sla_job_executions
  async runNow(): Promise<any> {
    return await pb.send('/backend/v1/sla/run-now', {
      method: 'POST',
    })
  },

  // Testar cálculo de deadline
  async calculateDeadline(params: {
    received_at: string
    sla_hours: number
    business_hours_only?: boolean
    business_start_hour?: number
    business_end_hour?: number
    status?: string
  }): Promise<any> {
    return await pb.send('/backend/v1/sla/calculate-deadline', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },
}

export const notificationService = {
  async getForUser(orgId?: string, role?: string): Promise<any[]> {
    let filter = ''
    if (orgId) {
      filter = `organization_id = '' || organization_id = '${orgId}'`
    }
    return await pb.collection('internal_notifications').getFullList({
      filter,
      sort: '-created',
      expand: 'exam_request_id,organization_id',
    })
  },

  async markAsRead(id: string): Promise<any> {
    return await pb.collection('internal_notifications').update(id, {
      is_read: true,
      read_at: new Date().toISOString(),
    })
  },

  async markAllAsRead(notifications: any[]): Promise<void> {
    const unread = notifications.filter((n) => !n.is_read)
    for (const notif of unread) {
      try {
        await pb.collection('internal_notifications').update(notif.id, {
          is_read: true,
          read_at: new Date().toISOString(),
        })
      } catch {
        /* intentionally ignored */
      }
    }
  },

  async create(data: {
    organization_id?: string
    user_id?: string
    exam_request_id?: string
    notification_type: string
    title: string
    message: string
    target_role?: string
  }): Promise<any> {
    return await pb.collection('internal_notifications').create({
      ...data,
      is_read: false,
    })
  },
}

// -------------------------------------------------------------
// SERVIÇOS FINANCEIROS (ETAPA 7)
// -------------------------------------------------------------

export const commercialContractService = {
  async getAll(filter = ''): Promise<any[]> {
    return await pb.collection('commercial_contracts').getFullList({
      filter,
      sort: '-created',
      expand: 'provider_org_id,client_org_id,contract_sla_id',
    })
  },

  async getById(id: string): Promise<any> {
    return await pb.collection('commercial_contracts').getOne(id, {
      expand: 'provider_org_id,client_org_id,contract_sla_id',
    })
  },

  async create(data: Record<string, any>): Promise<any> {
    return await pb.collection('commercial_contracts').create(data)
  },

  async update(id: string, data: Record<string, any>): Promise<any> {
    return await pb.collection('commercial_contracts').update(id, data)
  },
}

export const priceTableService = {
  async getAll(filter = ''): Promise<any[]> {
    return await pb.collection('price_tables').getFullList({
      filter,
      sort: '-created',
      expand: 'contract_id,client_org_id',
    })
  },

  async create(data: Record<string, any>): Promise<any> {
    return await pb.collection('price_tables').create(data)
  },

  async update(id: string, data: Record<string, any>): Promise<any> {
    return await pb.collection('price_tables').update(id, data)
  },
}

export const monthlyClosingService = {
  async getAll(filter = ''): Promise<any[]> {
    return await pb.collection('monthly_closings').getFullList({
      filter,
      sort: '-competence_period,-created',
      expand: 'provider_org_id,client_org_id,contract_id',
    })
  },

  async getById(id: string): Promise<any> {
    return await pb.collection('monthly_closings').getOne(id, {
      expand: 'provider_org_id,client_org_id,contract_id',
    })
  },

  async generateClosing(clientOrgId: string, competencePeriod: string): Promise<any> {
    return await pb.send('/backend/v1/finance/closings/generate', {
      method: 'POST',
      body: {
        client_org_id: clientOrgId,
        competence_period: competencePeriod,
      },
    })
  },

  async addAdjustment(
    closingId: string,
    data: {
      adjustment_type: string
      amount: number
      justification: string
    },
  ): Promise<any> {
    return await pb.send(`/backend/v1/finance/closings/${closingId}/adjustments`, {
      method: 'POST',
      body: data,
    })
  },

  async registerPayment(closingId: string, amount: number): Promise<any> {
    return await pb.send(`/backend/v1/finance/closings/${closingId}/payment`, {
      method: 'POST',
      body: { amount },
    })
  },

  async exportStatement(closingId: string, format: 'json' | 'csv' | 'pdf' = 'json'): Promise<any> {
    return await pb.send(`/backend/v1/finance/closings/${closingId}/export?format=${format}`, {
      method: 'GET',
    })
  },

  async createHomologationBillingItem(data: {
    client_org_id: string
    urgency?: 'routine' | 'urgent'
    competence_period?: string
    is_rectification?: boolean
    idempotency_key?: string
  }): Promise<any> {
    return await pb.send('/backend/v1/finance/billing/test-fixture-item', {
      method: 'POST',
      body: data,
    })
  },
}

export const billingService = {
  async getAll(filter = ''): Promise<any[]> {
    return await pb.collection('billing_items').getFullList({
      filter,
      sort: '-created',
      expand: 'exam_request_id,report_document_id,client_org_id,reporting_doctor_id',
    })
  },

  async generateFromReport(examRequestId: string, reportDocumentId: string): Promise<any> {
    return await pb.send('/backend/v1/finance/billing/generate-from-report', {
      method: 'POST',
      body: {
        exam_request_id: examRequestId,
        report_document_id: reportDocumentId,
      },
    })
  },

  async getMedicalProduction(period = ''): Promise<any> {
    const url = period
      ? `/backend/v1/finance/medical-production?period=${encodeURIComponent(period)}`
      : '/backend/v1/finance/medical-production'
    return await pb.send(url, { method: 'GET' })
  },
}
