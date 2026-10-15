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
