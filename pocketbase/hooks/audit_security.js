// Hooks PocketBase para controle de acesso refinado, operações médicas atômicas e auditoria
// PocketBase v0.23+: e.auth contém o usuário autenticado. Todas as rotas e callbacks devem ter lógica autossuficiente (sem top-level helpers).

// -------------------------------------------------------------
// ROTAS CUSTOMIZADAS ATÔMICAS PARA A FILA MÉDICA (ETAPA 3)
// -------------------------------------------------------------

// 1. Assumir Exame (ATÔMICO - Lock/Transação)
// Transição: pending -> in_analysis (atribui assigned_doctor_id e data)
routerAdd('POST', '/backend/v1/exams/{id}/claim', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isCardiologist = userOrgs.some(
    (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
  )
  if (!isCardiologist) {
    throw new ForbiddenError(
      'Apenas médicos cardiologistas credenciados podem assumir exames na fila.',
    )
  }

  let doctor = null
  try {
    const docs = $app.findRecordsByFilter(
      'doctors',
      `user_id = '${authRecord.id}' && is_active = true`,
      '',
      1,
      0,
    )
    if (docs.length > 0) doctor = docs[0]
  } catch (_) {}

  if (!doctor && !userOrgs.some((uo) => uo.get('role') === 'admin')) {
    throw new ForbiddenError('Cadastro de médico cardiologista ativo não localizado.')
  }

  const examId = e.request.pathValue('id')
  let updatedExam = null

  // Executar em transação atômica do banco para garantir que dois médicos simultâneos não recebam o mesmo exame
  $app.runInTransaction((txApp) => {
    const exam = txApp.findRecordById('exam_requests', examId)
    const currentStatus = exam.getString('status')
    const currentDoctorId = exam.getString('assigned_doctor_id')
    const myDoctorId = doctor ? doctor.id : ''

    // Se já estiver em análise por OUTRO médico, rejeitar imediatamente
    if (currentStatus === 'in_analysis' && currentDoctorId && currentDoctorId !== myDoctorId) {
      throw new BadRequestError('Este exame já foi assumido por outro cardiologista na fila.')
    }

    if (currentStatus === 'waiting_signature' || currentStatus === 'reported') {
      throw new BadRequestError(
        'Este exame já se encontra em elaboração avançada ou laudo concluído.',
      )
    }

    if (currentStatus === 'cancelled') {
      throw new BadRequestError('Exame cancelado não pode ser assumido para interpretação.')
    }

    // Atribuição atômica
    exam.set('status', 'in_analysis')
    if (doctor) {
      exam.set('assigned_doctor_id', doctor.id)
    }
    exam.set('assigned_at', new Date().toISOString())
    txApp.save(exam)
    updatedExam = exam
  })

  // Log de auditoria
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', updatedExam.getString('organization_id'))
    auditRec.set('action', 'EXAM_CLAIMED')
    auditRec.set('target_collection', 'exam_requests')
    auditRec.set('target_id', examId)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Exame assumido pelo cardiologista CRM: ${doctor ? doctor.getString('crm') : 'Admin'}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit claim:', err)
  }

  return e.json(200, {
    success: true,
    message: 'Exame assumido com sucesso para elaboração do laudo.',
    exam: updatedExam,
  })
})

// 2. Devolver Exame com Problema Técnico (ATÔMICO)
// Transição: in_analysis / pending -> returned (com justificativa obrigatória)
routerAdd('POST', '/backend/v1/exams/{id}/return', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isCardiologist = userOrgs.some(
    (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
  )
  if (!isCardiologist) {
    throw new ForbiddenError(
      'Apenas médicos laudadores podem devolver exames com justificativa técnica.',
    )
  }

  const examId = e.request.pathValue('id')

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const reason = body.reason || ''
  if (!reason || reason.trim().length < 5) {
    throw new BadRequestError(
      'A justificativa da devolução técnica é obrigatória (mínimo de 5 caracteres).',
    )
  }

  let updatedExam = null

  $app.runInTransaction((txApp) => {
    const exam = txApp.findRecordById('exam_requests', examId)
    const currentStatus = exam.getString('status')

    if (currentStatus === 'reported' || currentStatus === 'cancelled') {
      throw new BadRequestError('Não é possível devolver um exame já concluído ou cancelado.')
    }

    exam.set('status', 'returned')
    exam.set('return_reason', reason.trim())
    txApp.save(exam)
    updatedExam = exam
  })

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', updatedExam.getString('organization_id'))
    auditRec.set('action', 'EXAM_RETURNED_TECHNICAL')
    auditRec.set('target_collection', 'exam_requests')
    auditRec.set('target_id', examId)
    auditRec.set('status', 'SUCCESS')
    auditRec.set('details', `Exame devolvido por problema técnico. Justificativa: ${reason.trim()}`)
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit return:', err)
  }

  return e.json(200, {
    success: true,
    message: 'Exame devolvido à clínica solicitante com justificativa registrada.',
    exam: updatedExam,
  })
})

// 3. Salvar Rascunho com Versionamento Automático
routerAdd('POST', '/backend/v1/exams/{id}/draft', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isCardiologist = userOrgs.some(
    (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
  )
  if (!isCardiologist) {
    throw new ForbiddenError(
      'Apenas médicos cardiologistas podem elaborar ou salvar rascunhos de laudo.',
    )
  }

  let doctor = null
  try {
    const docs = $app.findRecordsByFilter(
      'doctors',
      `user_id = '${authRecord.id}' && is_active = true`,
      '',
      1,
      0,
    )
    if (docs.length > 0) doctor = docs[0]
  } catch (_) {}

  const examId = e.request.pathValue('id')

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  let createdDraft = null

  $app.runInTransaction((txApp) => {
    const exam = txApp.findRecordById('exam_requests', examId)

    // Obter última versão existente deste rascunho
    let nextVersion = 1
    try {
      const existingDrafts = txApp.findRecordsByFilter(
        'report_drafts',
        `exam_request_id = '${examId}'`,
        '-version',
        1,
        0,
      )
      if (existingDrafts.length > 0) {
        nextVersion = (existingDrafts[0].getInt('version') || 1) + 1
        for (const ed of existingDrafts) {
          ed.set('is_latest', false)
          txApp.save(ed)
        }
      }
    } catch (_) {}

    const draftCol = txApp.findCollectionByNameOrId('report_drafts')
    const draft = new Record(draftCol)
    draft.set('exam_request_id', examId)
    if (doctor) {
      draft.set('doctor_id', doctor.id)
    }
    draft.set('author_id', authRecord.id)
    draft.set('version', nextVersion)
    draft.set('is_latest', true)

    if (body.heart_rate !== undefined && body.heart_rate !== null && body.heart_rate !== '') {
      draft.set('heart_rate', Number(body.heart_rate))
    }
    draft.set('cardiac_rhythm', body.cardiac_rhythm || '')
    draft.set('electrical_axis', body.electrical_axis || '')
    if (body.pr_interval_ms) draft.set('pr_interval_ms', Number(body.pr_interval_ms))
    if (body.qrs_duration_ms) draft.set('qrs_duration_ms', Number(body.qrs_duration_ms))
    if (body.qt_interval_ms) draft.set('qt_interval_ms', Number(body.qt_interval_ms))
    if (body.qtc_interval_ms) draft.set('qtc_interval_ms', Number(body.qtc_interval_ms))
    draft.set('p_wave_description', body.p_wave_description || '')
    draft.set('av_conduction_alterations', body.av_conduction_alterations || '')
    draft.set('iv_conduction_alterations', body.iv_conduction_alterations || '')
    draft.set('repolarization_alterations', body.repolarization_alterations || '')
    draft.set('q_waves_findings', body.q_waves_findings || '')
    draft.set('free_text_description', body.free_text_description || '')
    draft.set('free_text_conclusion', body.free_text_conclusion || '')
    draft.set('technical_quality_notes', body.technical_quality_notes || '')

    txApp.save(draft)
    createdDraft = draft

    // Se o exame estiver pending, transicionar para in_analysis
    if (exam.getString('status') === 'pending') {
      exam.set('status', 'in_analysis')
      if (doctor) exam.set('assigned_doctor_id', doctor.id)
      exam.set('assigned_at', new Date().toISOString())
      txApp.save(exam)
    }
  })

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('action', 'REPORT_DRAFT_SAVED')
    auditRec.set('target_collection', 'report_drafts')
    auditRec.set('target_id', createdDraft ? createdDraft.id : examId)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Rascunho de laudo salvo versão ${createdDraft ? createdDraft.getInt('version') : 1} para o exame ${examId}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit draft:', err)
  }

  return e.json(200, {
    success: true,
    message: 'Rascunho salvo com sucesso.',
    draft: createdDraft,
  })
})

// 4. Concluir Elaboração do Laudo -> Encaminhar para AGUARDANDO_ASSINATURA (Transição Estrita)
routerAdd('POST', '/backend/v1/exams/{id}/submit-report', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isCardiologist = userOrgs.some(
    (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
  )
  if (!isCardiologist) {
    throw new ForbiddenError('Apenas médicos cardiologistas podem concluir a elaboração do laudo.')
  }

  let doctor = null
  try {
    const docs = $app.findRecordsByFilter(
      'doctors',
      `user_id = '${authRecord.id}' && is_active = true`,
      '',
      1,
      0,
    )
    if (docs.length > 0) doctor = docs[0]
  } catch (_) {}

  const examId = e.request.pathValue('id')

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const conclusion = body.free_text_conclusion || ''
  const description = body.free_text_description || ''

  if (!conclusion.trim()) {
    throw new BadRequestError('A conclusão eletrocardiográfica é obrigatória.')
  }
  if (!description.trim()) {
    throw new BadRequestError('A descrição do traçado eletrocardiográfico é obrigatória.')
  }

  let createdReport = null

  $app.runInTransaction((txApp) => {
    const exam = txApp.findRecordById('exam_requests', examId)
    const orgId = exam.getString('organization_id')
    const patientId = exam.getString('patient_id')

    let reportRecord = null
    try {
      const existingReports = txApp.findRecordsByFilter(
        'ecg_reports',
        `exam_request_id = '${examId}'`,
        '',
        1,
        0,
      )
      if (existingReports.length > 0) {
        reportRecord = existingReports[0]
      }
    } catch (_) {}

    if (!reportRecord) {
      const reportsCol = txApp.findCollectionByNameOrId('ecg_reports')
      reportRecord = new Record(reportsCol)
      reportRecord.set('exam_request_id', examId)
      reportRecord.set('organization_id', orgId)
      reportRecord.set('patient_id', patientId)
      if (doctor) reportRecord.set('doctor_id', doctor.id)
    }

    reportRecord.set('status', 'waiting_signature')
    if (body.heart_rate) reportRecord.set('heart_rate', Number(body.heart_rate))
    reportRecord.set('cardiac_rhythm', body.cardiac_rhythm || '')
    reportRecord.set('electrical_axis', body.electrical_axis || '')
    if (body.pr_interval_ms) reportRecord.set('pr_interval_ms', Number(body.pr_interval_ms))
    if (body.qrs_duration_ms) reportRecord.set('qrs_duration_ms', Number(body.qrs_duration_ms))
    if (body.qt_interval_ms) reportRecord.set('qt_interval_ms', Number(body.qt_interval_ms))
    if (body.qtc_interval_ms) reportRecord.set('qtc_interval_ms', Number(body.qtc_interval_ms))
    reportRecord.set('p_wave_description', body.p_wave_description || '')
    reportRecord.set('av_conduction_alterations', body.av_conduction_alterations || '')
    reportRecord.set('iv_conduction_alterations', body.iv_conduction_alterations || '')
    reportRecord.set('repolarization_alterations', body.repolarization_alterations || '')
    reportRecord.set('q_waves_findings', body.q_waves_findings || '')
    reportRecord.set('free_text_description', description.trim())
    reportRecord.set('free_text_conclusion', conclusion.trim())
    reportRecord.set('technical_quality_notes', body.technical_quality_notes || '')
    reportRecord.set('has_critical_findings', Boolean(body.has_critical_findings))

    txApp.save(reportRecord)
    createdReport = reportRecord

    // Transição de estado validada do exame para waiting_signature
    exam.set('status', 'waiting_signature')
    if (doctor) exam.set('assigned_doctor_id', doctor.id)
    txApp.save(exam)
  })

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('action', 'REPORT_SUBMITTED_WAITING_SIGNATURE')
    auditRec.set('target_collection', 'ecg_reports')
    auditRec.set('target_id', createdReport.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Laudo estruturado concluído pelo cardiologista e movido para AGUARDANDO_ASSINATURA (não liberado clinicamente). Exame: ${examId}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit submit report:', err)
  }

  return e.json(200, {
    success: true,
    message:
      'Laudo elaborado com sucesso e enviado para a etapa de conferência/aguardando assinatura.',
    report: createdReport,
  })
})

// 5. Registrar Comunicação de Achado Crítico
routerAdd('POST', '/backend/v1/exams/{id}/critical-finding', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isCardiologist = userOrgs.some(
    (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
  )
  if (!isCardiologist) {
    throw new ForbiddenError('Apenas médicos cardiologistas podem formalizar achados críticos.')
  }

  let doctor = null
  try {
    const docs = $app.findRecordsByFilter(
      'doctors',
      `user_id = '${authRecord.id}' && is_active = true`,
      '',
      1,
      0,
    )
    if (docs.length > 0) doctor = docs[0]
  } catch (_) {}

  const examId = e.request.pathValue('id')

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const classification = body.classification
  const justification = body.justification || ''
  const contactRecipient = body.contact_recipient || ''
  const contactChannel = body.contact_channel
  const confirmedByRecipient = Boolean(body.confirmed_by_recipient)

  if (!classification) {
    throw new BadRequestError('A classificação do achado crítico é obrigatória.')
  }
  if (!justification.trim()) {
    throw new BadRequestError('A justificativa clínica do achado crítico é obrigatória.')
  }
  if (!contactRecipient.trim()) {
    throw new BadRequestError('O destinatário do contato na unidade solicitante é obrigatório.')
  }
  if (!contactChannel) {
    throw new BadRequestError('O meio de contato clínico utilizado é obrigatório.')
  }

  let findingRecord = null

  $app.runInTransaction((txApp) => {
    const col = txApp.findCollectionByNameOrId('critical_findings')
    findingRecord = new Record(col)
    findingRecord.set('exam_request_id', examId)
    if (doctor) findingRecord.set('doctor_id', doctor.id)
    findingRecord.set('classification', classification)
    findingRecord.set('justification', justification.trim())
    findingRecord.set('contact_recipient', contactRecipient.trim())
    findingRecord.set('contact_channel', contactChannel)
    findingRecord.set('contact_timestamp', new Date().toISOString())
    findingRecord.set('confirmed_by_recipient', confirmedByRecipient)
    findingRecord.set('confirmation_notes', body.confirmation_notes || '')
    if (confirmedByRecipient) {
      findingRecord.set('confirmation_timestamp', new Date().toISOString())
    }
    findingRecord.set(
      'clinical_disclaimer',
      'Registro formal de comunicação médica. O presente registro não substitui o atendimento emergencial in loco e a notificação de tela não constitui confirmação clínica de recebimento.',
    )
    txApp.save(findingRecord)
  })

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('action', 'CRITICAL_FINDING_REGISTERED')
    auditRec.set('target_collection', 'critical_findings')
    auditRec.set('target_id', findingRecord.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Achado potencialmente crítico (${classification}) comunicado a ${contactRecipient} via ${contactChannel}. Confirmação: ${confirmedByRecipient ? 'SIM' : 'NÃO'}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit critical finding:', err)
  }

  return e.json(200, {
    success: true,
    message: 'Comunicação de achado potencialmente crítico registrada em trilha de auditoria.',
    finding: findingRecord,
  })
})

// -------------------------------------------------------------
// REGRAS DE INTEGRIDADE EM RECORD HOOKS (CREATE / UPDATE / DELETE)
// -------------------------------------------------------------

onRecordCreateRequest((e) => {
  const authRecord = e.auth
  const collectionName = e.record.collection().name

  if (collectionName === 'audit_logs') {
    e.next()
    return
  }

  // 1. Proteger integridade da organização em pacientes e exames
  if (collectionName === 'patients' || collectionName === 'exam_requests') {
    if (!authRecord) {
      throw new ForbiddenError('Acesso restrito a usuários autenticados.')
    }

    const orgId = e.record.get('organization_id')
    if (!orgId) {
      throw new BadRequestError('A organização solicitante é obrigatória.')
    }

    const userOrgs = $app.findRecordsByFilter(
      'user_organizations',
      `user_id = '${authRecord.id}' && is_active = true`,
      '',
      50,
      0,
    )
    const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
    const isMemberOfOrg = userOrgs.some((uo) => uo.get('organization_id') === orgId)

    if (!isAdmin && !isMemberOfOrg) {
      throw new ForbiddenError('Tentativa de cadastrar registro para organização não vinculada.')
    }
  }

  // 2. Proteção contra alteração de perfis por usuários não-admin
  if (collectionName === 'user_organizations') {
    if (!authRecord) {
      throw new ForbiddenError('Acesso restrito a usuários autenticados.')
    }

    const userOrgs = $app.findRecordsByFilter(
      'user_organizations',
      `user_id = '${authRecord.id}' && role = 'admin' && is_active = true`,
      '',
      1,
      0,
    )

    if (userOrgs.length === 0) {
      throw new ForbiddenError(
        'Apenas administradores podem atribuir perfis e vincular organizações.',
      )
    }
  }

  // 3. Usuários de clínicas NÃO podem criar laudos ou rascunhos de laudo
  if (collectionName === 'ecg_reports' || collectionName === 'report_drafts') {
    if (!authRecord) {
      throw new ForbiddenError('Acesso restrito a usuários autenticados.')
    }
    const userOrgs = $app.findRecordsByFilter(
      'user_organizations',
      `user_id = '${authRecord.id}' && is_active = true`,
      '',
      50,
      0,
    )
    const isCardioOrAdmin = userOrgs.some(
      (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
    )
    if (!isCardioOrAdmin) {
      throw new ForbiddenError(
        'Usuários de clínicas contratantes não possuem permissão para elaborar laudos médicos ou rascunhos.',
      )
    }
  }

  e.next()

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    if (authRecord) {
      auditRec.set('user_id', authRecord.id)
    }
    if (e.record.has('organization_id')) {
      auditRec.set('organization_id', e.record.get('organization_id'))
    }
    auditRec.set('action', 'CREATE')
    auditRec.set('target_collection', collectionName)
    auditRec.set('target_id', e.record.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set('details', `Registro criado na coleção ${collectionName} id=${e.record.id}`)
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha ao registrar log de auditoria no create:', err)
  }
})

onRecordUpdateRequest((e) => {
  const authRecord = e.auth
  const collectionName = e.record.collection().name

  if (collectionName === 'audit_logs') {
    throw new ForbiddenError('Registros de auditoria são imutáveis.')
  }

  // 1. Proteger alteração de role e organização em user_organizations
  if (collectionName === 'user_organizations') {
    if (!authRecord) {
      throw new ForbiddenError('Acesso não autorizado.')
    }

    const userOrgs = $app.findRecordsByFilter(
      'user_organizations',
      `user_id = '${authRecord.id}' && role = 'admin' && is_active = true`,
      '',
      1,
      0,
    )

    if (userOrgs.length === 0) {
      throw new ForbiddenError(
        'Apenas administradores podem alterar vínculos de perfil e organização.',
      )
    }
  }

  // 2. Bloquear troca de organização em pacientes ou exames E preservar arquivo original
  if (collectionName === 'patients' || collectionName === 'exam_requests') {
    if (!authRecord) {
      throw new ForbiddenError('Acesso não autorizado.')
    }

    const oldOrgId = e.record.original().getString('organization_id')
    const newOrgId = e.record.getString('organization_id')

    if (oldOrgId && newOrgId && oldOrgId !== newOrgId) {
      throw new ForbiddenError(
        'Não é permitido transferir a titularidade de organização de um paciente ou exame.',
      )
    }

    // Preservar o arquivo original e seus metadados — NUNCA alterar o exame enviado pela clínica
    if (collectionName === 'exam_requests') {
      const oldFile = e.record.original().getString('exam_file')
      const newFile = e.record.getString('exam_file')
      if (oldFile && newFile && oldFile !== newFile) {
        throw new ForbiddenError(
          'O arquivo original do traçado de ECG enviado pela clínica é imutável e protegido contra alterações.',
        )
      }

      // Validar transições de status no update direto
      const oldStatus = e.record.original().getString('status')
      const newStatus = e.record.getString('status')
      if (oldStatus !== newStatus) {
        // Bloquear transições inválidas (ex: reported sem passar pelas rotas validadas)
        if (newStatus === 'reported') {
          throw new ForbiddenError(
            'A liberação definitiva de laudo (reported) está bloqueada nesta etapa.',
          )
        }
      }
    }

    const userOrgs = $app.findRecordsByFilter(
      'user_organizations',
      `user_id = '${authRecord.id}' && is_active = true`,
      '',
      50,
      0,
    )
    const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
    const isMemberOfOrg = userOrgs.some((uo) => uo.get('organization_id') === oldOrgId)
    const isCardiologist = userOrgs.some((uo) => uo.get('role') === 'cardiologist')

    if (!isAdmin && !isMemberOfOrg) {
      if (collectionName === 'exam_requests' && isCardiologist) {
        // Permitido para cardiologista laudador atualizar status conforme fluxo
      } else {
        throw new ForbiddenError('Acesso negado: registro pertence a outra organização.')
      }
    }
  }

  // 3. Usuários de clínicas NÃO podem modificar a interpretação médica (ecg_reports ou report_drafts)
  if (collectionName === 'ecg_reports' || collectionName === 'report_drafts') {
    if (!authRecord) {
      throw new ForbiddenError('Acesso não autorizado.')
    }
    const userOrgs = $app.findRecordsByFilter(
      'user_organizations',
      `user_id = '${authRecord.id}' && is_active = true`,
      '',
      50,
      0,
    )
    const isCardioOrAdmin = userOrgs.some(
      (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
    )
    if (!isCardioOrAdmin) {
      throw new ForbiddenError(
        'Usuários de clínicas contratantes não têm permissão para alterar laudos ou interpretações médicas.',
      )
    }
  }

  e.next()

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    if (authRecord) {
      auditRec.set('user_id', authRecord.id)
    }
    if (e.record.has('organization_id')) {
      auditRec.set('organization_id', e.record.get('organization_id'))
    }
    auditRec.set('action', 'UPDATE')
    auditRec.set('target_collection', collectionName)
    auditRec.set('target_id', e.record.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set('details', `Registro atualizado na coleção ${collectionName} id=${e.record.id}`)
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha ao registrar log de auditoria no update:', err)
  }
})

onRecordDeleteRequest((e) => {
  const collectionName = e.record.collection().name
  if (collectionName === 'audit_logs') {
    throw new ForbiddenError('Registros de auditoria não podem ser excluídos.')
  }
  if (collectionName === 'exam_requests' || collectionName === 'ecg_reports') {
    throw new ForbiddenError(
      'Exames e laudos médicos não podem ser excluídos por usuários comuns para preservação probatória.',
    )
  }
  e.next()
})

onRecordAuthRequest((e) => {
  e.next()
  try {
    const authRecord = e.record
    if (authRecord) {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', authRecord.id)
      auditRec.set('action', 'AUTH_LOGIN')
      auditRec.set('target_collection', 'users')
      auditRec.set('target_id', authRecord.id)
      auditRec.set('status', 'SUCCESS')
      auditRec.set('details', `Login realizado: ${authRecord.getString('email')}`)
      $app.save(auditRec)
    }
  } catch (err) {
    console.log('Falha ao registrar log de login:', err)
  }
})
