// =====================================================================
// CardioLaudo - Conferência Manual de PDF Assinado Externamente e
// Liberação Clínica (BLOQUEADA por padrão).
//
// Estados (derivados, rótulos distintos):
//   AGUARDANDO_ASSINATURA | PDF_ASSINADO_RECEBIDO | AGUARDANDO_CONFERENCIA
//   CONFERENCIA_MANUAL_REGISTRADA | VALIDADO_CRIPTOGRAFICAMENTE
//   LIBERADO_A_CLINICA | REJEITADO
//
// Regras estritas:
//  - Conferência manual (validação humana) é DIFERENTE de validação
//    criptográfica automática (nunca definida por upload/formulário).
//  - Liberação clínica só ocorre com prova criptográfica completa
//    (pades_detected, validação automática, não simulada, hash íntegro)
//    E com ENABLE_CLINICAL_RELEASE=true no ambiente. Sem isso: 403.
//  - Só o médico dono da assinatura (ou admin) manipula o registro.
//  - Toda operação gera audit_logs.
// =====================================================================

const PDF_MAX_BYTES = 15 * 1024 * 1024

function decodeBase64Hook(data) {
  const normalized = String(data || '')
    .replace(/^data:[^;]*;base64,/, '')
    .replace(/\s+/g, '')
  if (!normalized) return null
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = []
  let buffer = 0
  let bits = 0
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]
    if (c === '=') break
    const v = chars.indexOf(c)
    if (v < 0) return null
    buffer = (buffer << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((buffer >> bits) & 0xff)
    }
  }
  return out
}

function bytesToBinaryString(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

function sha256OrNull(text) {
  try {
    if (typeof $security !== 'undefined' && typeof $security.sha256 === 'function') {
      return $security.sha256(text)
    }
  } catch (_) {}
  return null
}

function readBody(e) {
  try {
    return e.requestInfo().body || {}
  } catch (_) {
    return {}
  }
}

function requireAuth(e) {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }
  return authRecord
}

// Autorização: apenas o médico dono da assinatura ou um admin
// (clínica/gestor/financeiro NUNCA manipula a assinatura do laudo).
function assertSignatureAccess(e, sig) {
  const authRecord = requireAuth(e)

  let doc = null
  let exam = null
  try {
    doc = $app.findRecordById('report_documents', sig.getString('report_document_id'))
  } catch (_) {}
  try {
    exam = $app.findRecordById('exam_requests', sig.getString('exam_request_id'))
  } catch (_) {}
  if (!doc || !exam) {
    throw new NotFoundError('Documento ou exame vinculado à assinatura não foi localizado.')
  }

  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isAdmin = userOrgs.some((uo) => uo.getString('role') === 'admin')

  let isOwnerDoctor = false
  try {
    const own = $app.findRecordsByFilter(
      'doctors',
      `user_id = '${authRecord.id}' && is_active = true && id = '${sig.getString('doctor_id')}'`,
      '',
      1,
      0,
    )
    isOwnerDoctor = own.length > 0
  } catch (_) {}

  if (!isOwnerDoctor && !isAdmin) {
    throw new ForbiddenError(
      'Operação permitida apenas ao médico cardiologista responsável pela assinatura ou ao administrador da Central. Médico, clínica ou versão de outra parte não pode ser associada.',
    )
  }

  return { authRecord, doc, exam, isAdmin }
}

function findSignatureById(id) {
  let sig = null
  try {
    sig = $app.findRecordById('report_signatures', id)
  } catch (_) {}
  if (!sig) {
    throw new NotFoundError('Registro de assinatura não localizado.')
  }
  return sig
}

function writeAudit(authRecord, action, sig, details, status) {
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    if (authRecord) auditRec.set('user_id', authRecord.id)
    auditRec.set('action', action)
    auditRec.set('target_collection', 'report_signatures')
    auditRec.set('target_id', sig.id)
    auditRec.set('status', status || 'SUCCESS')
    auditRec.set('details', details)
    $app.save(auditRec)
  } catch (_) {}
}

function deriveState(sig) {
  const status = sig.getString('signature_status')
  const validationType = sig.getString('validation_type')
  const cryptoResult = (sig.getString('cryptographic_validation_result') || '').toUpperCase()
  const hasSignedFile = Boolean(sig.getString('signed_pdf_file'))

  if (status === 'REJEITADA') return 'REJEITADO'
  if (sig.getBool('is_clinically_released')) return 'LIBERADO_A_CLINICA'
  if (
    validationType === 'AUTOMATIC_CRYPTO' &&
    (cryptoResult === 'VALID' || cryptoResult === 'VALIDA' || cryptoResult === 'VALIDADO')
  ) {
    return 'VALIDADO_CRIPTOGRAFICAMENTE'
  }
  if (validationType === 'MANUAL_CONFERENCE' && sig.getString('manual_conference_timestamp')) {
    return 'CONFERENCIA_MANUAL_REGISTRADA'
  }
  if (hasSignedFile) return 'AGUARDANDO_CONFERENCIA'
  if (status === 'PROCESSANDO' || status === 'ASSINADA') return 'PDF_ASSINADO_RECEBIDO'
  return 'AGUARDANDO_ASSINATURA'
}

function stateResponse(sig, doc, exam) {
  const state = deriveState(sig)
  const labels = {
    AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
    PDF_ASSINADO_RECEBIDO: 'PDF assinado recebido',
    AGUARDANDO_CONFERENCIA: 'Aguardando conferência',
    CONFERENCIA_MANUAL_REGISTRADA: 'CONFERÊNCIA MANUAL REGISTRADA',
    VALIDADO_CRIPTOGRAFICAMENTE: 'ASSINATURA VALIDADA CRIPTOGRAFICAMENTE (AUTOMÁTICA)',
    LIBERADO_A_CLINICA: 'Liberado à clínica',
    REJEITADO: 'Rejeitado',
  }
  return {
    success: true,
    signatureId: sig.id,
    documentId: doc ? doc.id : sig.getString('report_document_id'),
    documentVersion: doc ? doc.getInt('version') : null,
    examRequestId: sig.getString('exam_request_id'),
    state,
    stateLabel: labels[state] || state,
    isClinicallyReleased: sig.getBool('is_clinically_released'),
    padesDetected: sig.getBool('pades_detected'),
    isSimulated: sig.getBool('is_simulated'),
    validationType: sig.getString('validation_type'),
    cryptoValidationResult: sig.getString('cryptographic_validation_result'),
    signedFileHash: sig.getString('signed_file_hash_sha256'),
    originalFileHash: doc ? doc.getString('file_hash_sha256') : '',
    manualConference: {
      responsibleName: sig.getString('manual_conference_responsible_name'),
      responsibleCrm: sig.getString('manual_conference_responsible_crm'),
      timestamp: sig.getString('manual_conference_timestamp'),
      reportRef: sig.getString('manual_conference_report_ref'),
      declaration: sig.getBool('manual_conference_declaration'),
      notes: sig.getString('manual_conference_notes'),
    },
    rejectionReason: sig.getString('rejection_reason'),
  }
}

// ---------------------------------------------------------------
// 1. Upload do PDF assinado externamente (base64, JSON)
// ---------------------------------------------------------------
routerAdd('POST', '/backend/v1/signatures/signed-pdf', (e) => {
  const authRecord = requireAuth(e)
  const body = readBody(e)
  const sig = findSignatureById(body.signature_id)
  const ctx = assertSignatureAccess(e, sig)

  if (sig.getBool('is_clinically_released')) {
    throw new BadRequestError('Laudo já liberado à clínica: custódia encerrada.')
  }
  if (sig.getString('signature_status') === 'REJEITADA') {
    throw new BadRequestError(
      'Assinatura rejeitada: gere uma nova versão do documento para reimportar o PDF assinado.',
    )
  }
  if (sig.getString('signed_pdf_file')) {
    throw new BadRequestError(
      'Já existe um PDF assinado registrado para esta versão. Rejeite-o para substituir.',
    )
  }

  const reportVersion = parseInt(body.report_version, 10)
  if (!isNaN(reportVersion) && reportVersion !== ctx.doc.getInt('version')) {
    throw new BadRequestError(
      `Versão informada (${body.report_version}) não corresponde à versão aprovada do documento (${ctx.doc.getInt('version')}).`,
    )
  }

  const originalHashProvided = String(body.original_pdf_hash || '').toLowerCase()
  const docHash = (ctx.doc.getString('file_hash_sha256') || '').toLowerCase()
  if (docHash && originalHashProvided && originalHashProvided !== docHash) {
    throw new BadRequestError(
      'Hash do PDF original informado não corresponde ao documento aprovado nesta versão.',
    )
  }

  const bytes = decodeBase64Hook(body.pdf_base64)
  if (!bytes || bytes.length === 0) {
    throw new BadRequestError('Conteúdo do PDF assinado ausente ou Base64 inválido.')
  }
  if (bytes.length > PDF_MAX_BYTES) {
    throw new BadRequestError('PDF assinado excede o limite de 15 MB.')
  }
  const binary = bytesToBinaryString(bytes)
  if (binary.slice(0, 5) !== '%PDF-') {
    throw new BadRequestError('Arquivo rejeitado: não é um PDF válido (cabeçalho %PDF- ausente).')
  }

  const serverHash = sha256OrNull(binary) || null
  const signedHash = String(body.signed_pdf_hash || '').toLowerCase()
  if (serverHash && signedHash && serverHash !== signedHash) {
    throw new BadRequestError(
      'Hash SHA-256 do arquivo recebido não corresponde ao hash calculado no cliente.',
    )
  }

  if (typeof $filesystem === 'undefined' || typeof $filesystem.fileFromBytes !== 'function') {
    throw new BadRequestError('Armazenamento de arquivos indisponível neste ambiente.')
  }
  const fileName = `assinado-${ctx.doc.getString('document_code')}-v${ctx.doc.getInt('version')}.pdf`
  sig.set('signed_pdf_file', $filesystem.fileFromBytes(bytes, fileName))
  sig.set('signed_file_hash_sha256', serverHash || signedHash)
  sig.set('signature_status', 'ASSINADA')
  sig.set('external_status', 'SIGNED_EXTERNAL')
  sig.set('pades_detected', false)
  sig.set('completed_at', new Date().toISOString())

  let evidence = {}
  try {
    evidence = JSON.parse(sig.getString('signature_evidence') || '{}') || {}
  } catch (_) {}
  evidence.signed_pdf_upload = {
    uploadedBy: authRecord.id,
    uploadedAt: new Date().toISOString(),
    fileName,
    sizeBytes: bytes.length,
    hashOrigin: serverHash ? 'SERVER_SHA256' : 'CLIENT_REPORTED',
  }
  sig.set('signature_evidence', JSON.stringify(evidence))

  $app.save(sig)
  writeAudit(
    authRecord,
    'SIGNED_PDF_UPLOADED',
    sig,
    `PDF assinado importado: ${fileName} (${bytes.length} bytes). Estado: AGUARDANDO_CONFERENCIA.`,
  )

  return e.json(200, {
    success: true,
    state: deriveState(sig),
    signedFileHash: sig.getString('signed_file_hash_sha256'),
    hashOrigin: serverHash ? 'SERVER_SHA256' : 'CLIENT_REPORTED',
    message: 'PDF assinado registrado. Aguardando conferência manual.',
  })
})

// ---------------------------------------------------------------
// 2. Registro da conferência manual (médico responsável, hashes,
//    resultado VALIDAR/ITI, evidência, data/hora)
// ---------------------------------------------------------------
routerAdd('POST', '/backend/v1/signatures/manual-conference', (e) => {
  const authRecord = requireAuth(e)
  const body = readBody(e)
  const sig = findSignatureById(body.signature_id)
  const ctx = assertSignatureAccess(e, sig)

  if (!sig.getString('signed_pdf_file')) {
    throw new BadRequestError(
      'Nenhum PDF assinado registrado para conferir. Importe o arquivo antes da conferência.',
    )
  }
  if (sig.getBool('is_clinically_released')) {
    throw new BadRequestError('Laudo já liberado à clínica.')
  }
  if (sig.getString('signature_status') === 'REJEITADA') {
    throw new BadRequestError('Assinatura rejeitada: não é possível registrar conferência.')
  }
  if (
    sig.getString('validation_type') === 'MANUAL_CONFERENCE' &&
    sig.getString('manual_conference_timestamp')
  ) {
    throw new BadRequestError('Conferência manual já registrada para esta versão.')
  }
  if (sig.getString('validation_type') === 'AUTOMATIC_CRYPTO') {
    throw new BadRequestError(
      'Esta assinatura pertence ao fluxo de validação criptográfica automática.',
    )
  }
  if (body.declaration !== true && body.declaration !== 'true') {
    throw new BadRequestError(
      'Declaração formal de conferência (declaration=true) é obrigatória para registrar a conferência manual.',
    )
  }

  const originalHash = String(body.original_pdf_hash || '').toLowerCase()
  const docHash = (ctx.doc.getString('file_hash_sha256') || '').toLowerCase()
  if (docHash && originalHash && originalHash !== docHash) {
    throw new BadRequestError('Hash do PDF original não corresponde à versão aprovada do laudo.')
  }

  const storedSignedHash = (sig.getString('signed_file_hash_sha256') || '').toLowerCase()
  const signedHash = String(body.signed_pdf_hash || '').toLowerCase()
  if (storedSignedHash && signedHash && storedSignedHash !== signedHash) {
    throw new BadRequestError(
      'Hash do PDF assinado informado diverge do hash registrado na importação do arquivo.',
    )
  }

  const nowIso = new Date().toISOString()
  sig.set('validation_type', 'MANUAL_CONFERENCE')
  sig.set(
    'manual_conference_responsible_name',
    String(body.responsible_name || ctx.authRecord.getString('name') || ''),
  )
  sig.set('manual_conference_responsible_crm', String(body.responsible_crm || ''))
  sig.set('manual_conference_timestamp', nowIso)
  sig.set('manual_conference_report_ref', String(body.validar_iti_reference || ''))
  sig.set('manual_conference_declaration', true)
  sig.set('manual_conference_notes', String(body.notes || ''))
  sig.set('signer_name', String(body.signer_name || sig.getString('signer_name') || ''))
  sig.set('signer_crm', String(body.signer_crm || sig.getString('signer_crm') || ''))

  let evidence = {}
  try {
    evidence = JSON.parse(sig.getString('signature_evidence') || '{}') || {}
  } catch (_) {}
  evidence.manual_conference = {
    performedBy: authRecord.id,
    performedAt: nowIso,
    responsibleName: sig.getString('manual_conference_responsible_name'),
    responsibleCrm: sig.getString('manual_conference_responsible_crm'),
    originalPdfHash: originalHash || docHash,
    signedPdfHash: signedHash || storedSignedHash,
    validarItiResult: String(body.validar_iti_result || 'NAO_CONSULTADO'),
    validarItiReference: String(body.validar_iti_reference || ''),
    validarItiEvidence: String(body.validar_iti_evidence || ''),
  }
  sig.set('signature_evidence', JSON.stringify(evidence))

  $app.save(sig)
  writeAudit(
    authRecord,
    'MANUAL_CONFERENCE_REGISTERED',
    sig,
    `Conferência manual registrada por ${sig.getString('manual_conference_responsible_name')}. VALIDAR/ITI: ${body.validar_iti_result || 'NAO_CONSULTADO'}. Estado: CONFERENCIA_MANUAL_REGISTRADA (liberação continua bloqueada).`,
  )

  return e.json(200, {
    success: true,
    ...stateResponse(sig, ctx.doc, ctx.exam),
    message:
      'CONFERÊNCIA MANUAL REGISTRADA. Isto NÃO equivale a validação criptográfica automática; a liberação clínica permanece bloqueada.',
  })
})

// ---------------------------------------------------------------
// 3. Rejeição do PDF assinado
// ---------------------------------------------------------------
routerAdd('POST', '/backend/v1/signatures/manual-conference/reject', (e) => {
  const authRecord = requireAuth(e)
  const body = readBody(e)
  const sig = findSignatureById(body.signature_id)
  const ctx = assertSignatureAccess(e, sig)

  if (sig.getBool('is_clinically_released')) {
    throw new ForbiddenError('Laudo já liberado à clínica: não pode ser rejeitado.')
  }
  const reason = String(body.rejection_reason || '').trim()
  if (!reason) {
    throw new BadRequestError('Informe o motivo da rejeição.')
  }

  sig.set('signature_status', 'REJEITADA')
  sig.set('rejection_reason', reason)
  $app.save(sig)
  writeAudit(authRecord, 'SIGNED_PDF_REJECTED', sig, `PDF assinado rejeitado. Motivo: ${reason}`)

  return e.json(200, { success: true, ...stateResponse(sig, ctx.doc, ctx.exam) })
})

// ---------------------------------------------------------------
// 4. Liberação clínica - EFETIVAMENTE BLOQUEADA sem prova completa
// ---------------------------------------------------------------
routerAdd('POST', '/backend/v1/signatures/clinical-release', (e) => {
  const authRecord = requireAuth(e)
  const body = readBody(e)
  const sig = findSignatureById(body.signature_id)
  const ctx = assertSignatureAccess(e, sig)

  if (sig.getBool('is_clinically_released')) {
    return e.json(200, { success: true, ...stateResponse(sig, ctx.doc, ctx.exam) })
  }

  const blockers = []
  const releaseGate = ($os.getenv('ENABLE_CLINICAL_RELEASE') || '').toLowerCase() === 'true'
  if (!releaseGate) {
    blockers.push('Gate mestre ENABLE_CLINICAL_RELEASE não está ativo no ambiente.')
  }
  if (!sig.getString('signed_pdf_file')) {
    blockers.push('Nenhum PDF assinado registrado.')
  }
  if (!sig.getBool('pades_detected')) {
    blockers.push('Assinatura PAdES não detectada/comprovada no arquivo.')
  }
  if (sig.getBool('is_simulated')) {
    blockers.push('Assinatura marcada como simulada (teste).')
  }
  const cryptoResult = (sig.getString('cryptographic_validation_result') || '').toUpperCase()
  if (!['VALID', 'VALIDA', 'VALIDADO'].includes(cryptoResult)) {
    blockers.push(
      'Sem validação criptográfica automática aprovada (cadeia ICP-Brasil, LCR/OCSP e carimbo de tempo).',
    )
  }
  if (sig.getString('validation_type') !== 'AUTOMATIC_CRYPTO') {
    blockers.push('A conferência manual não comprova a criptografia da assinatura.')
  }
  if (sig.getString('validation_pending_reasons')) {
    blockers.push(`Pendências registradas: ${sig.getString('validation_pending_reasons')}`)
  }

  if (blockers.length > 0) {
    writeAudit(
      authRecord,
      'CLINICAL_RELEASE_BLOCKED',
      sig,
      `Tentativa de liberação clínica BLOQUEADA: ${blockers.join(' ')}`,
      'BLOCKED',
    )
    throw new ForbiddenError(
      `Liberação clínica negada. Comprovação insuficiente da assinatura, identidade do signatário ou correspondência com a versão aprovada. Motivos: ${blockers.join(' ')}`,
    )
  }

  sig.set('is_clinically_released', true)
  $app.save(sig)
  writeAudit(
    authRecord,
    'CLINICAL_RELEASED',
    sig,
    'Laudo liberado à clínica após comprovação completa de assinatura.',
  )
  return e.json(200, { success: true, ...stateResponse(sig, ctx.doc, ctx.exam) })
})

// ---------------------------------------------------------------
// 5. Estado consolidado (sete estados distintos)
// ---------------------------------------------------------------
routerAdd('GET', '/backend/v1/signatures/conference-state/{documentId}', (e) => {
  requireAuth(e)
  const documentId = e.request.pathValue('documentId')
  const sigs = $app.findRecordsByFilter(
    'report_signatures',
    `report_document_id = '${documentId}'`,
    '-created',
    1,
    0,
  )
  if (sigs.length === 0) {
    return e.json(200, { success: true, found: false, state: 'AGUARDANDO_ASSINATURA' })
  }
  const sig = sigs[0]
  let doc = null
  try {
    doc = $app.findRecordById('report_documents', sig.getString('report_document_id'))
  } catch (_) {}
  let exam = null
  try {
    exam = $app.findRecordById('exam_requests', sig.getString('exam_request_id'))
  } catch (_) {}
  return e.json(200, { success: true, found: true, ...stateResponse(sig, doc, exam) })
})
