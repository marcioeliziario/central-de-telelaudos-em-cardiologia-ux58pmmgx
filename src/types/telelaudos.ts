export type UserRole = 'admin' | 'clinic_manager' | 'clinic_operator' | 'cardiologist' | 'financial'

export interface UserOrganization {
  id: string
  user_id: string
  organization_id: string
  role: UserRole
  is_active: boolean
  title_position?: string
  expand?: {
    organization_id?: Organization
    user_id?: AuthUser
  }
}

export interface Organization {
  id: string
  name: string
  trade_name?: string
  cnpj: string
  type: 'provider' | 'client'
  is_active: boolean
  phone?: string
  email?: string
  city?: string
  state?: string
  notes?: string
  created: string
  updated: string
}

export interface Unit {
  id: string
  organization_id: string
  name: string
  code?: string
  cnes?: string
  address?: string
  city?: string
  state?: string
  phone?: string
  is_active: boolean
  created: string
  updated: string
  expand?: {
    organization_id?: Organization
  }
}

export interface Doctor {
  id: string
  user_id: string
  organization_id: string
  crm: string
  crm_state: string
  rqe?: string
  specialty?: string
  is_active: boolean
  notes?: string
  created: string
  updated: string
  expand?: {
    user_id?: AuthUser
    organization_id?: Organization
  }
}

export interface Patient {
  id: string
  organization_id: string
  unit_id?: string
  full_name: string
  birth_date: string
  gender: 'M' | 'F' | 'other'
  cpf?: string
  record_number?: string
  phone?: string
  weight_kg?: number
  height_cm?: number
  clinical_notes?: string
  created: string
  updated: string
  expand?: {
    organization_id?: Organization
    unit_id?: Unit
  }
}

export interface ExamRequest {
  id: string
  organization_id: string
  unit_id?: string
  patient_id: string
  requested_by: string
  assigned_doctor_id?: string
  status: 'pending' | 'in_analysis' | 'reported' | 'cancelled'
  urgency: 'routine' | 'urgent' | 'emergency'
  exam_file: string
  clinical_indication?: string
  symptoms?: string
  medications_in_use?: string
  has_pacemaker?: boolean
  exam_date?: string
  cancellation_reason?: string
  created: string
  updated: string
  expand?: {
    organization_id?: Organization
    unit_id?: Unit
    patient_id?: Patient
    requested_by?: AuthUser
    assigned_doctor_id?: Doctor
  }
}

export interface AuditLog {
  id: string
  user_id?: string
  organization_id?: string
  action: string
  target_collection: string
  target_id?: string
  ip_address?: string
  user_agent?: string
  details?: string
  status?: string
  created: string
  expand?: {
    user_id?: AuthUser
    organization_id?: Organization
  }
}

export interface AuthUser {
  id: string
  email: string
  name?: string
  phone?: string
  avatar?: string
  is_active?: boolean
  created: string
}
