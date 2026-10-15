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
  deadline_at?: string
  sla_status?: 'no_prazo' | 'proximo_do_vencimento' | 'atrasado' | 'concluido'
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

// -------------------------------------------------------------
// ETAPA 5: CONTRATOS, SLA, NOTIFICAÇÕES E PORTAL DE RESULTADOS
// -------------------------------------------------------------

export interface ContractSLA {
  id: string
  organization_id: string
  contract_name: string
  routine_sla_hours: number
  urgent_sla_hours: number
  emergency_enabled: boolean
  business_hours_start?: string
  business_hours_end?: string
  operates_on_weekends?: boolean
  warning_threshold_minutes?: number
  is_active: boolean
  notes?: string
  created: string
  updated: string
  expand?: {
    organization_id?: Organization
  }
}

export type NotificationType =
  | 'NOVO_ECG_RECEBIDO'
  | 'EXAME_DEVOLVIDO_QUALIDADE'
  | 'EXAME_PROXIMO_DO_PRAZO'
  | 'EXAME_ATRASADO'
  | 'LAUDO_VALIDADO_LIBERADO'
  | 'AVISO_SISTEMA'

export interface InternalNotification {
  id: string
  organization_id?: string
  user_id?: string
  exam_request_id?: string
  notification_type: NotificationType
  title: string
  message: string
  target_role?: 'all' | 'admin' | 'cardiologist' | 'clinic_manager' | 'clinic_operator'
  is_read: boolean
  read_at?: string
  created: string
  updated: string
  expand?: {
    organization_id?: Organization
    exam_request_id?: ExamRequest
    user_id?: AuthUser
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
  mfa_enabled?: boolean
  mfa_enforced?: boolean
  mfa_enforced_role?: 'none' | 'admin' | 'cardiologist' | 'all'
  mfa_verified_at?: string
  last_revoked_at?: string
  created: string
}

export interface MfaRecoveryCode {
  id: string
  user_id: string
  code_hash_sha256: string
  is_used: boolean
  used_at?: string
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
  tcn?: string
  certificate_alias?: string
  callback_received_at?: string
  external_status?: string
  is_simulated?: boolean
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

// -------------------------------------------------------------
// ETAPA 6A: CONECTOR BIRD ID PRO (SOLUTI CESS)
// -------------------------------------------------------------

export type BirdIdExternalStatus =
  | 'WAITING'
  | 'PROCESSING'
  | 'SIGNED'
  | 'ERROR'
  | 'CANCELED'
  | 'EXPIRED'

export interface BirdIdProviderDiagnostic {
  architectureMode: string
  skipCloudCompatibility: string
}

export interface BirdIdProviderInfo {
  id: string
  name: string
  psc: string
  standard: string
  endpointDocs: string
  installationDocs?: string
  authProtocol: string
  active: boolean
  reason: string
  commercialClientConfigured: boolean
  tcnSupported?: boolean
  signatureType?: string
  hashAlgorithm?: string
  documentsSource?: string
  diagnosticInfrastructure?: BirdIdProviderDiagnostic
}

export interface BirdIdInitTransactionResponse {
  success: boolean
  transactionId: string
  tcn?: string
  provider: string
  isProviderActive: boolean
  inactivityReason?: string
  documentCode: string
  sha256: string
  status: SignatureStatus
  externalStatus: string
  callbackNonceToken: string
  padesConfiguration?: {
    type: string
    hash_algorithm: string
    auto_fix_document: boolean
    documents_source: string
  }
  nextSteps: string[]
}

export interface BirdIdStatusResponse {
  success: boolean
  tcn?: string
  transactionId: string
  status: SignatureStatus
  externalStatus: string
  certificateAlias?: string | null
  isClinicallyReleased: boolean
  isSimulated?: boolean
  isRealConnectionActive: boolean
  documents?: Array<{
    id: number
    original_file_name: string
    mediatype: string
    status: string
    checksum: string
  }>
}

// -------------------------------------------------------------
// ETAPA 7: GESTÃO FINANCEIRA, CONTRATOS E FATURAMENTO
// -------------------------------------------------------------

export type CommercialContractStatus = 'draft' | 'active' | 'suspended' | 'cancelled' | 'expired'

export interface CommercialContract {
  id: string
  provider_org_id: string
  client_org_id: string
  contract_sla_id?: string
  contract_number: string
  start_date: string
  end_date?: string
  status: CommercialContractStatus
  modalities: string // JSON string array
  closing_day: number
  payment_terms_days: number
  monthly_minimum_volume?: number
  monthly_minimum_amount?: number
  cancellation_rules?: string
  billing_notes?: string
  change_history?: string // JSON string
  created_by?: string
  created: string
  updated: string
  expand?: {
    provider_org_id?: Organization
    client_org_id?: Organization
    contract_sla_id?: ContractSLA
  }
}

export interface PriceTable {
  id: string
  contract_id: string
  client_org_id: string
  modality: 'ECG_12_DERIVACOES' | 'ECG_RITMO' | 'OUTRA'
  urgency: 'routine' | 'urgent' | 'emergency'
  price_amount: number
  valid_from: string
  valid_to?: string
  is_active: boolean
  notes?: string
  created: string
  updated: string
  expand?: {
    contract_id?: CommercialContract
    client_org_id?: Organization
  }
}

export type MonthlyClosingStatus =
  | 'open'
  | 'closed'
  | 'invoiced_simulated_blocked'
  | 'paid'
  | 'cancelled'

export type ClosingPaymentStatus = 'pending' | 'paid_partial' | 'paid' | 'overdue'

export interface MonthlyClosing {
  id: string
  provider_org_id: string
  client_org_id: string
  contract_id: string
  competence_period: string // "2026-10"
  closing_code: string
  period_start: string
  period_end: string
  status: MonthlyClosingStatus
  total_exams: number
  billable_exams: number
  subtotal_amount: number
  discounts_adjustments_amount?: number
  final_total_amount: number
  summary_by_modality?: string // JSON string
  summary_by_priority?: string // JSON string
  is_locked: boolean
  closed_at?: string
  closed_by?: string
  payment_due_date?: string
  payment_status?: ClosingPaymentStatus
  payment_received_amount?: number
  payment_received_at?: string
  notes?: string
  created: string
  updated: string
  expand?: {
    provider_org_id?: Organization
    client_org_id?: Organization
    contract_id?: CommercialContract
  }
}

export type BillingType =
  | 'LAUDO_PADRAO'
  | 'LAUDO_URGENTE'
  | 'REANÁLISE_CONTRATUAL'
  | 'ADICIONAL_AUTORIZADO'

export type BillingItemStatus =
  | 'draft_prohibited'
  | 'billable'
  | 'closed'
  | 'adjusted'
  | 'cancelled'

export interface BillingItem {
  id: string
  exam_request_id: string
  report_document_id: string
  provider_org_id: string
  client_org_id: string
  contract_id: string
  price_table_id?: string
  monthly_closing_id?: string
  billing_type: BillingType
  idempotency_key: string
  competence_period: string
  modality: string
  urgency: string
  unit_price_snapshotted: number
  price_snapshot_date: string
  status: BillingItemStatus
  reporting_doctor_id?: string
  is_rectification?: boolean
  parent_billing_item_id?: string
  notes?: string
  created: string
  updated: string
  expand?: {
    exam_request_id?: ExamRequest
    report_document_id?: ReportDocument
    client_org_id?: Organization
    contract_id?: CommercialContract
    reporting_doctor_id?: Doctor
  }
}

export type AdjustmentType =
  | 'DESCONTO_COMERCIAL'
  | 'ESTORNO_QUALIDADE'
  | 'ACRESCIMO_CONTRATUAL'
  | 'OUTRO_AJUSTE'

export interface BillingAdjustment {
  id: string
  monthly_closing_id: string
  billing_item_id?: string
  client_org_id: string
  adjustment_type: AdjustmentType
  amount: number
  justification: string
  authorized_by?: string
  authorized_at: string
  created: string
  updated: string
  expand?: {
    monthly_closing_id?: MonthlyClosing
    client_org_id?: Organization
  }
}

export interface MedicalProductionItem {
  doctorId: string
  doctorName: string
  crm: string
  specialty: string
  reportsIssuedCount: number
  remunerationRuleStatus: string
  financialTransferAmount: number | null
}
