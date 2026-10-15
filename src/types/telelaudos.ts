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

export type ExamStatus =
  | 'pending'
  | 'in_analysis'
  | 'waiting_signature'
  | 'returned'
  | 'reported'
  | 'cancelled'

export interface ExamRequest {
  id: string
  organization_id: string
  unit_id?: string
  patient_id: string
  requested_by: string
  assigned_doctor_id?: string
  status: ExamStatus
  urgency: 'routine' | 'urgent' | 'emergency'
  exam_file: string
  clinical_indication?: string
  symptoms?: string
  medications_in_use?: string
  has_pacemaker?: boolean
  exam_date?: string
  cancellation_reason?: string
  return_reason?: string
  assigned_at?: string
  priority_score?: number
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

export interface ReportTemplate {
  id: string
  title: string
  category: string
  rhythm?: string
  p_wave_description?: string
  av_conduction?: string
  iv_conduction?: string
  repolarization?: string
  q_waves?: string
  description: string
  conclusion: string
  is_active: boolean
  created: string
  updated: string
}

export interface ReportDraft {
  id: string
  exam_request_id: string
  doctor_id?: string
  author_id: string
  version: number
  is_latest: boolean
  heart_rate?: number | null
  cardiac_rhythm?: string
  electrical_axis?: string
  pr_interval_ms?: number | null
  qrs_duration_ms?: number | null
  qt_interval_ms?: number | null
  qtc_interval_ms?: number | null
  p_wave_description?: string
  av_conduction_alterations?: string
  iv_conduction_alterations?: string
  repolarization_alterations?: string
  q_waves_findings?: string
  free_text_description?: string
  free_text_conclusion?: string
  technical_quality_notes?: string
  created: string
  updated: string
  expand?: {
    exam_request_id?: ExamRequest
    doctor_id?: Doctor
    author_id?: AuthUser
  }
}

export interface ECGReport {
  id: string
  exam_request_id: string
  organization_id: string
  patient_id: string
  doctor_id?: string
  status: 'draft' | 'waiting_signature' | 'signed_mock_prohibited' | 'archived'
  heart_rate?: number | null
  cardiac_rhythm?: string
  electrical_axis?: string
  pr_interval_ms?: number | null
  qrs_duration_ms?: number | null
  qt_interval_ms?: number | null
  qtc_interval_ms?: number | null
  p_wave_description?: string
  av_conduction_alterations?: string
  iv_conduction_alterations?: string
  repolarization_alterations?: string
  q_waves_findings?: string
  free_text_description: string
  free_text_conclusion: string
  technical_quality_notes?: string
  has_critical_findings?: boolean
  created: string
  updated: string
  expand?: {
    exam_request_id?: ExamRequest
    organization_id?: Organization
    patient_id?: Patient
    doctor_id?: Doctor
  }
}

export type CriticalFindingClassification =
  | 'infarto_agudo_supra_st'
  | 'bloqueio_av_avancado_total'
  | 'taquicardia_ventricular'
  | 'bradicardia_grave_sintomatica'
  | 'intervalo_qt_muito_prolongado'
  | 'pausa_sinusal_prolongada'
  | 'outro_achado_critico'

export type CriticalFindingChannel =
  | 'telefone_plantao'
  | 'telefone_medico_assistente'
  | 'telefone_enfermagem'
  | 'whatsapp_institucional'
  | 'comunicador_clinico_direto'

export interface CriticalFinding {
  id: string
  exam_request_id: string
  doctor_id?: string
  classification: CriticalFindingClassification
  justification: string
  contact_recipient: string
  contact_channel: CriticalFindingChannel
  contact_timestamp: string
  confirmed_by_recipient: boolean
  confirmation_notes?: string
  confirmation_timestamp?: string
  clinical_disclaimer?: string
  created: string
  updated: string
  expand?: {
    exam_request_id?: ExamRequest
    doctor_id?: Doctor
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

// -------------------------------------------------------------
// ETAPA 4A: DOCUMENTOS MÉDICOS E ASSINATURA DIGITAL
// -------------------------------------------------------------

export interface ReportDocument {
  id: string
  exam_request_id: string
  organization_id: string
  patient_id: string
  doctor_id?: string
  ecg_report_id?: string
  document_code: string
  version: number
  pdf_file: string
  file_hash_sha256: string
  file_size_bytes?: number
  is_preview?: boolean
  is_prepared_for_signature?: boolean
  is_locked?: boolean
  created_by?: string
  generated_at: string
  content_snapshot?: string
  created: string
  updated: string
  expand?: {
    exam_request_id?: ExamRequest
    organization_id?: Organization
    patient_id?: Patient
    doctor_id?: Doctor
    ecg_report_id?: ECGReport
  }
}

export type SignatureStatus =
  | 'NAO_INICIADA'
  | 'PENDENTE'
  | 'PROCESSANDO'
  | 'ASSINADA'
  | 'VALIDADA'
  | 'FALHA'

export interface ReportSignature {
  id: string
  report_document_id: string
  exam_request_id: string
  doctor_id?: string
  signing_provider?: string
  transaction_id?: string
  signature_status: SignatureStatus
  requested_at?: string
  completed_at?: string
  signature_evidence?: string
  signed_pdf_file?: string
  signed_file_hash_sha256?: string
  cryptographic_validation_result?: string
  is_clinically_released?: boolean
  rejection_reason?: string
  created: string
  updated: string
  expand?: {
    report_document_id?: ReportDocument
    exam_request_id?: ExamRequest
    doctor_id?: Doctor
  }
}
