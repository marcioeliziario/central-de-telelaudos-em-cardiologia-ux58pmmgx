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
