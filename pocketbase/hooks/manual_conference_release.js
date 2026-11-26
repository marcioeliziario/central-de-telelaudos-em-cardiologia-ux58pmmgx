// =====================================================================
// CardioLaudo - Conferência Manual de PDF Assinado Externamente e
// Liberação Clínica (BLOQUEADA por padrão).
//
// IMPORTANTE (Goja/PocketBase): o runtime JavaScript do PocketBase NÃO
// compartilha declarações de topo entre callbacks — qualquer helper ou
// constante de topo usada dentro de um callback gera ReferenceError em
// runtime (histórico: "resolveAdminContext is not defined"). Portanto
// TODA a lógica abaixo vive DENTRO de cada callback de rota, inclusive
// helpers locais, seguindo o padrão comprovado de audit_security.js.
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
//    (pades_detected, validação AUTOMATIC_CRYPTO = VALID, não simulada)
//    E com ENABLE_CLINICAL_RELEASE=true no ambiente. Sem isso: 403.
//  - Só o médico dono da assinatura (doctors.user_id) ou um admin
//    manipula o registro; clínica NUNCA altera assinaturas.
//  - O PDF original em report_documents NUNCA é sobrescrito; o PDF
//    assinado vai para signed_pdf_file em report_signatures com hash.
//  - Toda operação gera audit_logs.
// =====================================================================

// ---------------------------------------------------------------
// 0. Estado consolidado (sete estados distintos)
// ---------------------------------------------------------------
routerAdd('GET', '/backend/v1/signatures/conference-state/{documentId}', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  let documentId = ''
  try {
    documentId = e.request.pathValue('documentId') || ''
  } catch (_) {
    documentId = ''
  }
  if (!documentId) {
    try {
      documentId = (e.requestInfo().query && e.requestInfo().query.document_id) || ''
    } catch (_) {
      documentId = ''
    }
  }
  if (!documentId) {
    throw new BadRequestError('Identificador do documento (documentId) é obrigatório.')
  }

  let sig = null
  try {
    const sigs = $app.findRecordsByFilter(
      'report_signatures',
      `report_document_id = '${documentId}'`,
      '-created',
      1,
      0,
    )
    if (sigs.length > 0) sig = sigs[0]
  } catch (findErr) {
    console.log('conference-state: falha ao buscar assinatura:', findErr)
  }

  if (!sig) {
    return e.json(200, {
      success: true,
      found: false,
      documentId,
      state: 'AGUARDANDO_ASSINATURA',
      stateLabel: 'Aguardando assinatura',
      isClinicallyReleased: false,
    })
  }

  let doc = null
  let exam = null
  try {
    doc = $app.findRecordById('report_documents', sig.getString('report_document_id'))
  } catch (_) {}
  try {
    exam = $app.findRecordById('exam_requests', sig.getString('exam_request_id'))
  } catch (_) {}

  // Visualização: admin, médico dono da assinatura ou membro da organização do exame
  let canView = false
  const userOrgsView = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isAdminView = userOrgsView.some((uo) => uo.get('role') === 'admin')
  const isMemberOfExamOrg = exam
    ? userOrgsView.some((uo) => uo.get('organization_id') === exam.getString('organization_id'))
    : false
  let isOwnerDoctorView = false
  try {
    const own = $app.findRecordsByFilter(
      'doctors',
      `user_id = '${authRecord.id}' && is_active = true && id = '${sig.getString('doctor_id')}'`,
      '',
      1,
      0,
    )
    isOwnerDoctorView = own.length > 0
  } catch (_) {}
  canView = isAdminView || isOwnerDoctorView || isMemberOfExamOrg
  if (!canView) {
    throw new ForbiddenError(
      'Acesso negado: documento pertence a outra organização (isolamento entre clínicas).',
    )
  }

  const deriveStateView = (s) => {
    const status = s.getString('signature_status')
    const validationType = s.getString('validation_type')
    const cryptoResult = (s.getString('cryptographic_validation_result') || '').toUpperCase()
    const hasSignedFile = Boolean(s.getString('signed_pdf_file'))
    if (status === 'REJEITADA') return 'REJEITADO'
    if (s.getBool('is_clinically_released')) return 'LIBERADO_A_CLINICA'
    if (
      validationType === 'AUTOMATIC_CRYPTO' &&
      (cryptoResult === 'VALID' || cryptoResult === 'VALIDA' || cryptoResult === 'VALIDADO')
    ) {
      return 'VALIDADO_CRIPTOGRAFICAMENTE'
    }
    if (validationType === 'MANUAL_CONFERENCE' && s.getString('manual_conference_timestamp')) {
      return 'CONFERENCIA_MANUAL_REGISTRADA'
    }
    if (hasSignedFile) return 'AGUARDANDO_CONFERENCIA'
    if (status === 'PROCESSANDO' || status === 'ASSINADA') return 'PDF_ASSINADO_RECEBIDO'
    return 'AGUARDANDO_ASSINATURA'
  }
  const labelsView = {
    AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
    PDF_ASSINADO_RECEBIDO: 'PDF assinado recebido',
    AGUARDANDO_CONFERENCIA: 'Aguardando conferência',
    CONFERENCIA_MANUAL_REGISTRADA: 'CONFERÊNCIA MANUAL REGISTRADA',
    VALIDADO_CRIPTOGRAFICAMENTE: 'ASSINATURA VALIDADA CRIPTOGRAFICAMENTE (AUTOMÁTICA)',
    LIBERADO_A_CLINICA: 'Liberado à clínica',
    REJEITADO: 'Rejeitado',
  }
  const state = deriveStateView(sig)

  return e.json(200, {
    success: true,
    found: true,
    signatureId: sig.id,
    documentId: doc ? doc.id : sig.getString('report_document_id'),
    documentVersion: doc ? doc.getInt('version') : null,
    examRequestId: sig.getString('exam_request_id'),
    state,
    stateLabel: labelsView[state] || state,
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
  })
})

// ---------------------------------------------------------------
// 1. Upload do PDF assinado externamente (base64, JSON)
// ---------------------------------------------------------------
routerAdd('POST', '/backend/v1/signatures/signed-pdf', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }
  const sigId = body.signature_id || body.signatureId
  if (!sigId) {
    throw new BadRequestError('O identificador da assinatura (signature_id) é obrigatório.')
  }

  let sig = null
  try {
    sig = $app.findRecordById('report_signatures', sigId)
  } catch (_) {}
  if (!sig) {
    throw new NotFoundError('Registro de assinatura não localizado.')
  }

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
  const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
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
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', authRecord.id)
      auditRec.set('organization_id', exam.getString('organization_id'))
      auditRec.set('action', 'SIGNED_PDF_UPLOAD_DENIED')
      auditRec.set('target_collection', 'report_signatures')
      auditRec.set('target_id', sig.id)
      auditRec.set('status', 'DENIED')
      auditRec.set('details', 'Upload de PDF assinado negado por falta de autorização.')
      $app.save(auditRec)
    } catch (auditErr) {
      console.log('Falha audit signed-pdf denied:', auditErr)
    }
    throw new ForbiddenError(
      'Operação permitida apenas ao médico cardiologista responsável pela assinatura ou ao administrador da Central. A clínica não altera assinaturas.',
    )
  }

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
      'Já existe um PDF assinado registrado para esta versão. Rejeite-o para substituir (o documento original não é sobrescrito).',
    )
  }

  const reportVersionRaw =
    body.report_version !== undefined ? body.report_version : body.reportVersion
  const reportVersion = parseInt(reportVersionRaw, 10)
  if (!isNaN(reportVersion) && reportVersion !== doc.getInt('version')) {
    throw new BadRequestError(
      `Versão informada (${reportVersionRaw}) não corresponde à versão aprovada do documento (${doc.getInt('version')}).`,
    )
  }

  const originalHashProvided = String(
    body.original_pdf_hash !== undefined ? body.original_pdf_hash : body.originalPdfHash || '',
  )
    .toLowerCase()
    .trim()
  const docHash = (doc.getString('file_hash_sha256') || '').toLowerCase()
  if (docHash && originalHashProvided && originalHashProvided !== docHash) {
    throw new BadRequestError(
      'Hash do PDF original informado não corresponde ao documento aprovado nesta versão.',
    )
  }

  const dataRaw = body.pdf_base64 !== undefined ? body.pdf_base64 : body.pdfBase64
  const normalized = String(dataRaw || '')
    .replace(/^data:[^;]*;base64,/, '')
    .replace(/\s+/g, '')
  if (!normalized) {
    throw new BadRequestError('Conteúdo do PDF assinado ausente (pdf_base64) ou Base64 inválido.')
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes = []
  let buffer = 0
  let bits = 0
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.charAt(i)
    if (c === '=') break
    const v = chars.indexOf(c)
    if (v < 0) {
      throw new BadRequestError('Conteúdo do PDF assinado não está em Base64 válido.')
    }
    buffer = (buffer << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  if (bytes.length === 0) {
    throw new BadRequestError('Conteúdo do PDF assinado ausente ou Base64 inválido.')
  }
  if (bytes.length > 15 * 1024 * 1024) {
    throw new BadRequestError('PDF assinado excede o limite de 15 MB.')
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  if (binary.slice(0, 5) !== '%PDF-') {
    throw new BadRequestError('Arquivo rejeitado: não é um PDF válido (cabeçalho %PDF- ausente).')
  }

  let serverHash = null
  try {
    serverHash = $security.sha256(binary)
  } catch (hashErr) {
    console.log('signed-pdf: falha ao calcular SHA-256 no servidor:', hashErr)
  }
  const signedHash = String(
    body.signed_pdf_hash !== undefined ? body.signed_pdf_hash : body.signedPdfHash || '',
  )
    .toLowerCase()
    .trim()
  if (serverHash && signedHash && serverHash !== signedHash) {
    throw new BadRequestError(
      'Hash SHA-256 do arquivo recebido não corresponde ao hash calculado no cliente.',
    )
  }

  const fileName = `assinado-${doc.getString('document_code')}-v${doc.getInt('version')}.pdf`
  let pdfFile = null
  try {
    if (typeof $filesystem !== 'undefined' && $filesystem.fileFromBytes) {
      pdfFile = $filesystem.fileFromBytes(binary, fileName)
    }
  } catch (fsErr) {
    console.log('signed-pdf: falha ao criar arquivo:', fsErr)
  }
  if (!pdfFile) {
    throw new BadRequestError('Armazenamento de arquivos indisponível neste ambiente.')
  }

  sig.set('signed_pdf_file', pdfFile)
  sig.set('signed_file_hash_sha256', serverHash || signedHash || '')
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

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', exam.getString('organization_id'))
    auditRec.set('action', 'SIGNED_PDF_UPLOADED')
    auditRec.set('target_collection', 'report_signatures')
    auditRec.set('target_id', sig.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `PDF assinado importado: ${fileName} (${bytes.length} bytes). Estado: AGUARDANDO_CONFERENCIA. Documento original preservado.`,
    )
    $app.save(auditRec)
  } catch (auditErr) {
    console.log('Falha audit signed-pdf:', auditErr)
  }

  return e.json(200, {
    success: true,
    signatureId: sig.id,
    state: 'AGUARDANDO_CONFERENCIA',
    stateLabel: 'Aguardando conferência',
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
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }
  const sigId = body.signature_id || body.signatureId
  if (!sigId) {
    throw new BadRequestError('O identificador da assinatura (signature_id) é obrigatório.')
  }

  let sig = null
  try {
    sig = $app.findRecordById('report_signatures', sigId)
  } catch (_) {}
  if (!sig) {
    throw new NotFoundError('Registro de assinatura não localizado.')
  }

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
  const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
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
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', authRecord.id)
      auditRec.set('organization_id', exam.getString('organization_id'))
      auditRec.set('action', 'MANUAL_CONFERENCE_DENIED')
      auditRec.set('target_collection', 'report_signatures')
      auditRec.set('target_id', sig.id)
      auditRec.set('status', 'DENIED')
      auditRec.set('details', 'Registro de conferência manual negado por falta de autorização.')
      $app.save(auditRec)
    } catch (auditErr) {
      console.log('Falha audit conference denied:', auditErr)
    }
    throw new ForbiddenError(
      'Operação permitida apenas ao médico cardiologista responsável pela assinatura ou ao administrador da Central. A clínica não altera assinaturas.',
    )
  }

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
  const declaration = body.declaration
  if (declaration !== true && declaration !== 'true') {
    throw new BadRequestError(
      'Declaração formal de conferência (declaration=true) é obrigatória para registrar a conferência manual.',
    )
  }

  const originalHash = String(
    body.original_pdf_hash !== undefined ? body.original_pdf_hash : body.originalPdfHash || '',
  )
    .toLowerCase()
    .trim()
  const docHash = (doc.getString('file_hash_sha256') || '').toLowerCase()
  if (docHash && originalHash && originalHash !== docHash) {
    throw new BadRequestError('Hash do PDF original não corresponde à versão aprovada do laudo.')
  }

  const storedSignedHash = (sig.getString('signed_file_hash_sha256') || '').toLowerCase()
  const signedHash = String(
    body.signed_pdf_hash !== undefined ? body.signed_pdf_hash : body.signedPdfHash || '',
  )
    .toLowerCase()
    .trim()
  if (storedSignedHash && signedHash && storedSignedHash !== signedHash) {
    throw new BadRequestError(
      'Hash do PDF assinado informado diverge do hash registrado na importação do arquivo.',
    )
  }

  const nowIso = new Date().toISOString()
  const responsibleName = String(
    body.responsible_name !== undefined ? body.responsible_name : body.responsibleName || '',
  )
  const responsibleCrm = String(
    body.responsible_crm !== undefined ? body.responsible_crm : body.responsibleCrm || '',
  )
  sig.set('validation_type', 'MANUAL_CONFERENCE')
  sig.set(
    'manual_conference_responsible_name',
    responsibleName || authRecord.getString('name') || '',
  )
  sig.set('manual_conference_responsible_crm', responsibleCrm)
  sig.set('manual_conference_timestamp', nowIso)
  sig.set(
    'manual_conference_report_ref',
    String(
      body.validar_iti_reference !== undefined
        ? body.validar_iti_reference
        : body.validarItiReference || '',
    ),
  )
  sig.set('manual_conference_declaration', true)
  sig.set('manual_conference_notes', String(body.notes || ''))
  sig.set(
    'signer_name',
    String(body.signer_name !== undefined ? body.signer_name : sig.getString('signer_name') || ''),
  )
  sig.set(
    'signer_crm',
    String(body.signer_crm !== undefined ? body.signer_crm : sig.getString('signer_crm') || ''),
  )

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
    validarItiResult: String(
      body.validar_iti_result !== undefined
        ? body.validar_iti_result
        : body.validarItiResult || 'NAO_CONSULTADO',
    ),
    validarItiReference: sig.getString('manual_conference_report_ref'),
    validarItiEvidence: String(
      body.validar_iti_evidence !== undefined
        ? body.validar_iti_evidence
        : body.validarItiEvidence || '',
    ),
  }
  sig.set('signature_evidence', JSON.stringify(evidence))

  $app.save(sig)

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', exam.getString('organization_id'))
    auditRec.set('action', 'MANUAL_CONFERENCE_REGISTERED')
    auditRec.set('target_collection', 'report_signatures')
    auditRec.set('target_id', sig.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Conferência manual registrada por ${sig.getString('manual_conference_responsible_name')}. VALIDAR/ITI: ${evidence.manual_conference.validarItiResult}. Estado: CONFERENCIA_MANUAL_REGISTRADA (liberação continua bloqueada; conferência manual NÃO é validação criptográfica).`,
    )
    $app.save(auditRec)
  } catch (auditErr) {
    console.log('Falha audit manual-conference:', auditErr)
  }

  return e.json(200, {
    success: true,
    signatureId: sig.id,
    documentId: doc.id,
    documentVersion: doc.getInt('version'),
    examRequestId: sig.getString('exam_request_id'),
    state: 'CONFERENCIA_MANUAL_REGISTRADA',
    stateLabel: 'CONFERÊNCIA MANUAL REGISTRADA',
    isClinicallyReleased: false,
    validationType: 'MANUAL_CONFERENCE',
    message:
      'CONFERÊNCIA MANUAL REGISTRADA. Isto NÃO equivale a validação criptográfica automática; a liberação clínica permanece bloqueada.',
  })
})

// ---------------------------------------------------------------
// 3. Rejeição do PDF assinado
// ---------------------------------------------------------------
routerAdd('POST', '/backend/v1/signatures/manual-conference/reject', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }
  const sigId = body.signature_id || body.signatureId
  if (!sigId) {
    throw new BadRequestError('O identificador da assinatura (signature_id) é obrigatório.')
  }

  let sig = null
  try {
    sig = $app.findRecordById('report_signatures', sigId)
  } catch (_) {}
  if (!sig) {
    throw new NotFoundError('Registro de assinatura não localizado.')
  }

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
  const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
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
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', authRecord.id)
      auditRec.set('organization_id', exam.getString('organization_id'))
      auditRec.set('action', 'SIGNED_PDF_REJECT_DENIED')
      auditRec.set('target_collection', 'report_signatures')
      auditRec.set('target_id', sig.id)
      auditRec.set('status', 'DENIED')
      auditRec.set('details', 'Rejeição de PDF assinado negada por falta de autorização.')
      $app.save(auditRec)
    } catch (auditErr) {
      console.log('Falha audit reject denied:', auditErr)
    }
    throw new ForbiddenError(
      'Operação permitida apenas ao médico cardiologista responsável pela assinatura ou ao administrador da Central. A clínica não altera assinaturas.',
    )
  }

  if (sig.getBool('is_clinically_released')) {
    throw new ForbiddenError('Laudo já liberado à clínica: não pode ser rejeitado.')
  }
  const reason = String(
    body.rejection_reason !== undefined ? body.rejection_reason : body.rejectionReason || '',
  ).trim()
  if (!reason) {
    throw new BadRequestError('Informe o motivo da rejeição.')
  }

  sig.set('signature_status', 'REJEITADA')
  sig.set('rejection_reason', reason)
  $app.save(sig)

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', exam.getString('organization_id'))
    auditRec.set('action', 'SIGNED_PDF_REJECTED')
    auditRec.set('target_collection', 'report_signatures')
    auditRec.set('target_id', sig.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set('details', `PDF assinado rejeitado. Motivo: ${reason}`)
    $app.save(auditRec)
  } catch (auditErr) {
    console.log('Falha audit reject:', auditErr)
  }

  return e.json(200, {
    success: true,
    signatureId: sig.id,
    documentId: doc.id,
    documentVersion: doc.getInt('version'),
    state: 'REJEITADO',
    stateLabel: 'Rejeitado',
    isClinicallyReleased: false,
    rejectionReason: reason,
  })
})

// ---------------------------------------------------------------
// 4. Liberação clínica - EFETIVAMENTE BLOQUEADA sem prova completa
// ---------------------------------------------------------------
routerAdd('POST', '/backend/v1/signatures/clinical-release', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }
  const sigId = body.signature_id || body.signatureId
  if (!sigId) {
    throw new BadRequestError('O identificador da assinatura (signature_id) é obrigatório.')
  }

  let sig = null
  try {
    sig = $app.findRecordById('report_signatures', sigId)
  } catch (_) {}
  if (!sig) {
    throw new NotFoundError('Registro de assinatura não localizado.')
  }

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
  const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
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
      'Operação permitida apenas ao médico cardiologista responsável pela assinatura ou ao administrador da Central.',
    )
  }

  if (sig.getBool('is_clinically_released')) {
    return e.json(200, {
      success: true,
      signatureId: sig.id,
      state: 'LIBERADO_A_CLINICA',
      stateLabel: 'Liberado à clínica',
      isClinicallyReleased: true,
      message: 'Laudo já liberado à clínica anteriormente.',
    })
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
  if (cryptoResult !== 'VALID' && cryptoResult !== 'VALIDA' && cryptoResult !== 'VALIDADO') {
    blockers.push(
      'Sem validação criptográfica automática (AUTOMATIC_CRYPTO) aprovada (cadeia ICP-Brasil, LCR/OCSP e carimbo de tempo).',
    )
  }
  if (sig.getString('validation_type') !== 'AUTOMATIC_CRYPTO') {
    blockers.push('A conferência manual não comprova a criptografia da assinatura.')
  }
  if (sig.getString('validation_pending_reasons')) {
    blockers.push(`Pendências registradas: ${sig.getString('validation_pending_reasons')}`)
  }

  if (blockers.length > 0) {
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', authRecord.id)
      auditRec.set('organization_id', exam.getString('organization_id'))
      auditRec.set('action', 'CLINICAL_RELEASE_BLOCKED')
      auditRec.set('target_collection', 'report_signatures')
      auditRec.set('target_id', sig.id)
      auditRec.set('status', 'BLOCKED')
      auditRec.set('details', `Tentativa de liberação clínica BLOQUEADA: ${blockers.join(' ')}`)
      $app.save(auditRec)
    } catch (auditErr) {
      console.log('Falha audit clinical-release blocked:', auditErr)
    }
    throw new ForbiddenError(
      `Liberação clínica negada. Comprovação insuficiente da assinatura, identidade do signatário ou correspondência com a versão aprovada. Motivos: ${blockers.join(' ')}`,
    )
  }

  sig.set('is_clinically_released', true)
  $app.save(sig)

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', exam.getString('organization_id'))
    auditRec.set('action', 'CLINICAL_RELEASED')
    auditRec.set('target_collection', 'report_signatures')
    auditRec.set('target_id', sig.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set('details', 'Laudo liberado à clínica após comprovação completa de assinatura.')
    $app.save(auditRec)
  } catch (auditErr) {
    console.log('Falha audit clinical-release:', auditErr)
  }

  return e.json(200, {
    success: true,
    signatureId: sig.id,
    state: 'LIBERADO_A_CLINICA',
    stateLabel: 'Liberado à clínica',
    isClinicallyReleased: true,
  })
})
