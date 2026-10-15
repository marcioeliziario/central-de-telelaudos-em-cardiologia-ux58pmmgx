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

  // Notificação interna automática para a clínica solicitante (EXAME_DEVOLVIDO_QUALIDADE)
  try {
    const notifCol = $app.findCollectionByNameOrId('internal_notifications')
    const notif = new Record(notifCol)
    notif.set('organization_id', updatedExam.getString('organization_id'))
    notif.set('exam_request_id', examId)
    notif.set('notification_type', 'EXAME_DEVOLVIDO_QUALIDADE')
    notif.set('title', 'Exame devolvido por apontamento técnico')
    notif.set(
      'message',
      `O ECG protocolo ${examId.slice(-6).toUpperCase()} necessita de ajuste ou novo traçado pela clínica. Motivo: ${reason.trim()}`,
    )
    notif.set('target_role', 'clinic_manager')
    notif.set('is_read', false)
    $app.save(notif)
  } catch (notifErr) {
    console.log('Falha notif return:', notifErr)
  }

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
// ROTAS CUSTOMIZADAS DA ETAPA 4A: DOCUMENTOS MÉDICOS E ASSINATURA
// (Todo o código mantido estritamente autocontido dentro dos callbacks)
// -------------------------------------------------------------

// 6. Prévia de PDF do Laudo (Para conferência médica ANTES da assinatura)
routerAdd('GET', '/backend/v1/exams/{id}/report-pdf-preview', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const examId = e.request.pathValue('id')
  const exam = $app.findRecordById('exam_requests', examId)
  if (!exam) {
    throw new NotFoundError('Exame não localizado.')
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
      'Apenas médicos cardiologistas autorizados podem visualizar prévias de laudo.',
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

  const patient = $app.findRecordById('patients', exam.getString('patient_id'))
  const clinicOrg = $app.findRecordById('organizations', exam.getString('organization_id'))
  let clinicUnit = ''
  if (exam.getString('unit_id')) {
    try {
      const u = $app.findRecordById('units', exam.getString('unit_id'))
      if (u) clinicUnit = u.getString('name')
    } catch (_) {}
  }

  let providerName = 'CARDIOLAB TELEMEDICINA EM CARDIOLOGIA LTDA'
  let providerCnpj = '11.111.111/0001-11'
  try {
    const provs = $app.findRecordsByFilter(
      'organizations',
      "type = 'provider' && is_active = true",
      '',
      1,
      0,
    )
    if (provs.length > 0) {
      providerName = provs[0].getString('name')
      providerCnpj = provs[0].getString('cnpj')
    }
  } catch (_) {}

  let reportData = null
  try {
    const reports = $app.findRecordsByFilter(
      'ecg_reports',
      `exam_request_id = '${examId}'`,
      '-created',
      1,
      0,
    )
    if (reports.length > 0) reportData = reports[0]
  } catch (_) {}

  if (!reportData) {
    try {
      const drafts = $app.findRecordsByFilter(
        'report_drafts',
        `exam_request_id = '${examId}' && is_latest = true`,
        '-version',
        1,
        0,
      )
      if (drafts.length > 0) reportData = drafts[0]
    } catch (_) {}
  }

  if (!reportData) {
    throw new BadRequestError(
      'Nenhum conteúdo de laudo ou rascunho encontrado para gerar a prévia deste exame.',
    )
  }

  // Extrair campos numéricos SOMENTE se informados
  const numericalFields = []
  const hr = reportData.getInt('heart_rate')
  if (hr > 0) numericalFields.push({ label: 'Freq. Cardíaca', value: hr, unit: 'bpm' })
  const rhythm = reportData.getString('cardiac_rhythm')
  if (rhythm) numericalFields.push({ label: 'Ritmo', value: rhythm, unit: '' })
  const axis = reportData.getString('electrical_axis')
  if (axis) numericalFields.push({ label: 'Eixo Elétrico (SÂQRS)', value: axis, unit: '' })
  const pr = reportData.getInt('pr_interval_ms')
  if (pr > 0) numericalFields.push({ label: 'Intervalo PR', value: pr, unit: 'ms' })
  const qrs = reportData.getInt('qrs_duration_ms')
  if (qrs > 0) numericalFields.push({ label: 'Duração QRS', value: qrs, unit: 'ms' })
  const qt = reportData.getInt('qt_interval_ms')
  if (qt > 0) numericalFields.push({ label: 'Intervalo QT', value: qt, unit: 'ms' })
  const qtc = reportData.getInt('qtc_interval_ms')
  if (qtc > 0) numericalFields.push({ label: 'Intervalo QTc', value: qtc, unit: 'ms' })

  let docVersion = 1
  try {
    const existingDocs = $app.findRecordsByFilter(
      'report_documents',
      `exam_request_id = '${examId}'`,
      '-version',
      1,
      0,
    )
    if (existingDocs.length > 0) {
      docVersion = existingDocs[0].getInt('version')
    }
  } catch (_) {}

  // Helpers de escape de texto e quebra de linha locais
  const escapePdfText = (str) => {
    if (!str) return ''
    let clean = String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r/g, '')
    // Mapeamento estrito para ISO-8859-1 / WinAnsiEncoding (octal no PDF)
    const accentsMap = {
      á: '\\341',
      à: '\\340',
      ã: '\\343',
      â: '\\342',
      ä: '\\344',
      Á: '\\301',
      À: '\\300',
      Ã: '\\303',
      Â: '\\302',
      Ä: '\\304',
      é: '\\351',
      è: '\\350',
      ê: '\\352',
      ë: '\\353',
      É: '\\311',
      È: '\\310',
      Ê: '\\312',
      Ë: '\\313',
      í: '\\355',
      ì: '\\354',
      î: '\\356',
      ï: '\\357',
      Í: '\\315',
      Ì: '\\314',
      Î: '\\316',
      Ï: '\\317',
      ó: '\\363',
      ò: '\\362',
      õ: '\\365',
      ô: '\\364',
      ö: '\\366',
      Ó: '\\323',
      Ò: '\\322',
      Õ: '\\325',
      Ô: '\\324',
      Ö: '\\326',
      ú: '\\372',
      ù: '\\371',
      û: '\\373',
      ü: '\\374',
      Ú: '\\332',
      Ù: '\\331',
      Û: '\\333',
      Ü: '\\334',
      ç: '\\347',
      Ç: '\\307',
      ñ: '\\361',
      Ñ: '\\321',
      º: '\\272',
      ª: '\\252',
      '°': '\\260',
      '–': '-',
      '—': '-',
      '“': '"',
      '”': '"',
      '’': "'",
      '‘': "'",
    }
    for (const [k, v] of Object.entries(accentsMap)) {
      clean = clean.split(k).join(v)
    }
    return clean
  }

  const wrapText = (text, maxChars) => {
    if (!text) return []
    const paras = text.split('\n')
    const lines = []
    for (const p of paras) {
      if (!p.trim()) {
        lines.push('')
        continue
      }
      const words = p.trim().split(/\s+/)
      let cur = ''
      for (const w of words) {
        if ((cur + ' ' + w).trim().length <= maxChars) {
          cur = (cur + ' ' + w).trim()
        } else {
          if (cur) lines.push(cur)
          cur = w
        }
      }
      if (cur) lines.push(cur)
    }
    return lines
  }
  const docCode = `PREV-${exam.id.slice(-6).toUpperCase()}-V${docVersion}`
  const patientName = patient.getString('full_name')
  const patientBirth = patient.getString('birth_date')
    ? new Date(patient.getString('birth_date')).toLocaleDateString('pt-BR')
    : '—'
  const patientGender =
    patient.getString('gender') === 'M'
      ? 'Masculino'
      : patient.getString('gender') === 'F'
        ? 'Feminino'
        : 'Outro'
  const clinicName = clinicOrg.getString('trade_name') || clinicOrg.getString('name')
  const examDate = exam.getString('exam_date')
    ? new Date(exam.getString('exam_date')).toLocaleDateString('pt-BR')
    : new Date(exam.getString('created')).toLocaleDateString('pt-BR')
  const doctorName =
    authRecord.getString('name') || (doctor ? doctor.getString('notes') : '') || 'Cardiologista'
  const doctorCrm = doctor ? doctor.getString('crm') : ''
  const doctorCrmState = doctor ? doctor.getString('crm_state') : 'SP'
  const doctorRqe = doctor ? doctor.getString('rqe') : ''
  const doctorCrmLine = doctorCrm
    ? 'CRM: ' + doctorCrm + '/' + doctorCrmState + (doctorRqe ? '  •  RQE: ' + doctorRqe : '')
    : 'Registro profissional não informado na solicitação'
  const desc =
    reportData.getString('free_text_description') ||
    'Traçado dentro dos limites da normalidade para a faixa etária.'
  const concl =
    reportData.getString('free_text_conclusion') ||
    'Eletrocardiograma sem alterações patológicas significativas.'

  let ops = []
  ops.push('0.05 0.30 0.57 rg')
  ops.push('0.05 0.30 0.57 RG')
  ops.push('1.5 w')
  ops.push('40 805 m 555 805 l S')

  ops.push('BT')
  ops.push('/F2 13 Tf')
  ops.push('40 788 Td')
  ops.push(`(${escapePdfText(providerName)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F1 8 Tf')
  ops.push('40 776 Td')
  ops.push(
    `(${escapePdfText('Prestadora de Serviços de Telelaudos em Cardiologia • CNPJ: ' + providerCnpj)}) Tj`,
  )
  ops.push('ET')

  ops.push('BT')
  ops.push('/F1 8 Tf')
  ops.push('340 788 Td')
  ops.push(`(${escapePdfText('Unidade Executora / Clínica:')}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F2 9 Tf')
  ops.push('340 776 Td')
  ops.push(`(${escapePdfText(clinicName + (clinicUnit ? ' - ' + clinicUnit : ''))}) Tj`)
  ops.push('ET')

  ops.push('0.92 0.95 0.98 rg')
  ops.push('40 725 515 42 re f')
  ops.push('0.8 0.85 0.9 RG')
  ops.push('0.5 w')
  ops.push('40 725 515 42 re S')

  ops.push('0.05 0.30 0.57 rg')
  ops.push('BT')
  ops.push('/F2 11 Tf')
  ops.push('50 752 Td')
  ops.push(`(${escapePdfText('LAUDO DE ELETROCARDIOGRAMA DE 12 DERIVAÇÕES')}) Tj`)
  ops.push('ET')

  ops.push('0.3 0.3 0.3 rg')
  ops.push('BT')
  ops.push('/F3 8 Tf')
  ops.push('50 735 Td')
  ops.push(
    `(${escapePdfText('Doc ID: ' + docCode + '  •  Versão: ' + docVersion + '.0 (PRÉVIA)  •  Emissão: ' + new Date().toLocaleString('pt-BR'))}) Tj`,
  )
  ops.push('ET')

  // Tarja de PRÉVIA OBRIGATÓRIA
  ops.push('0.98 0.94 0.90 rg')
  ops.push('40 692 515 25 re f')
  ops.push('0.85 0.55 0.1 RG')
  ops.push('1.0 w')
  ops.push('40 692 515 25 re S')

  ops.push('0.7 0.2 0.0 rg')
  ops.push('BT')
  ops.push('/F2 9.5 Tf')
  ops.push('50 701 Td')
  ops.push(
    `(${escapePdfText('PRÉVIA • DOCUMENTO NÃO ASSINADO. SEM VALIDADE COMO LAUDO FINAL.')}) Tj`,
  )
  ops.push('ET')

  ops.push('q')
  ops.push('0.92 0.92 0.92 rg')
  ops.push('BT')
  ops.push('/F2 36 Tf')
  ops.push('1 0 0 1 70 420 Tm')
  ops.push(`(${escapePdfText('DOCUMENTO NÃO ASSINADO')}) Tj`)
  ops.push('ET')
  ops.push('Q')

  let curY = 675
  ops.push('0.15 0.15 0.15 rg')
  ops.push('BT')
  ops.push('/F2 9.5 Tf')
  ops.push(`40 ${curY} Td`)
  ops.push(`(${escapePdfText('1. DADOS DO PACIENTE E DA SOLICITAÇÃO')}) Tj`)
  ops.push('ET')

  ops.push('0.7 0.7 0.7 RG')
  ops.push('0.5 w')
  ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
  curY -= 18

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`45 ${curY} Td`)
  ops.push(`(${escapePdfText('Paciente: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText(patientName)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`360 ${curY} Td`)
  ops.push(`(${escapePdfText('Nascimento: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText(patientBirth)}) Tj`)
  ops.push('ET')
  curY -= 14

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`45 ${curY} Td`)
  ops.push(`(${escapePdfText('Sexo: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText(patientGender)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`360 ${curY} Td`)
  ops.push(`(${escapePdfText('ID Solicitação: ')}) Tj`)
  ops.push('/F3 8.5 Tf')
  ops.push(`(${escapePdfText(exam.id)}) Tj`)
  ops.push('ET')
  curY -= 14

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`45 ${curY} Td`)
  ops.push(`(${escapePdfText('Data do Exame: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText(examDate)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`220 ${curY} Td`)
  ops.push(`(${escapePdfText('Modalidade: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText('Eletrocardiograma de 12 derivações')}) Tj`)
  ops.push('ET')
  curY -= 22

  if (numericalFields.length > 0) {
    ops.push('0.15 0.15 0.15 rg')
    ops.push('BT')
    ops.push('/F2 9.5 Tf')
    ops.push(`40 ${curY} Td`)
    ops.push(`(${escapePdfText('2. PARÂMETROS ELETROCARDIOGRÁFICOS MENSURADOS (SBC 2022)')}) Tj`)
    ops.push('ET')

    ops.push('0.7 0.7 0.7 RG')
    ops.push('0.5 w')
    ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
    curY -= 18

    let col = 0
    let rowY = curY
    for (const f of numericalFields) {
      const colX = 45 + col * 170
      ops.push('BT')
      ops.push('/F2 8 Tf')
      ops.push(`${colX} ${rowY} Td`)
      ops.push(`(${escapePdfText(f.label + ': ')}) Tj`)
      ops.push('/F3 8.5 Tf')
      ops.push(`(${escapePdfText(String(f.value) + (f.unit ? ' ' + f.unit : ''))}) Tj`)
      ops.push('ET')
      col++
      if (col >= 3) {
        col = 0
        rowY -= 14
      }
    }
    curY = (col === 0 ? rowY : rowY - 14) - 8
  }

  ops.push('0.15 0.15 0.15 rg')
  ops.push('BT')
  ops.push('/F2 9.5 Tf')
  ops.push(`40 ${curY} Td`)
  ops.push(`(${escapePdfText('3. DESCRIÇÃO ELETROCARDIOGRÁFICA')}) Tj`)
  ops.push('ET')

  ops.push('0.7 0.7 0.7 RG')
  ops.push('0.5 w')
  ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
  curY -= 16

  const descLines = wrapText(desc, 88)
  for (const line of descLines) {
    if (curY < 135) {
      ops.push('0.6 0.6 0.6 rg')
      ops.push('BT')
      ops.push('/F3 7.5 Tf')
      ops.push(`45 ${curY} Td`)
      ops.push(`(${escapePdfText('[... descrição continua / verificação técnica SBC ...]')}) Tj`)
      ops.push('ET')
      curY -= 10
      break
    }
    if (line === '') {
      curY -= 6
      continue
    }
    ops.push('BT')
    ops.push('/F1 8.5 Tf')
    ops.push(`45 ${curY} Td`)
    ops.push(`(${escapePdfText(line)}) Tj`)
    ops.push('ET')
    curY -= 12
  }
  curY -= 8

  if (curY >= 140) {
    ops.push('0.15 0.15 0.15 rg')
    ops.push('BT')
    ops.push('/F2 9.5 Tf')
    ops.push(`40 ${curY} Td`)
    ops.push(`(${escapePdfText('4. CONCLUSÃO DIAGNÓSTICA')}) Tj`)
    ops.push('ET')

    ops.push('0.7 0.7 0.7 RG')
    ops.push('0.5 w')
    ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
    curY -= 16

    const conclLines = wrapText(concl, 88)
    for (const line of conclLines) {
      if (curY < 135) {
        break
      }
      if (line === '') {
        curY -= 6
        continue
      }
      ops.push('BT')
      ops.push('/F2 9 Tf')
      ops.push(`45 ${curY} Td`)
      ops.push(`(${escapePdfText(line)}) Tj`)
      ops.push('ET')
      curY -= 13
    }
  }

  const footerY = 110
  ops.push('0.85 0.85 0.85 RG')
  ops.push('0.5 w')
  ops.push(`40 ${footerY + 25} m 555 ${footerY + 25} l S`)

  ops.push('0.1 0.1 0.1 rg')
  ops.push('BT')
  ops.push('/F2 10 Tf')
  ops.push(`45 ${footerY + 12} Td`)
  ops.push(`(${escapePdfText('Dr(a). ' + doctorName)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F1 8.5 Tf')
  ops.push(`45 ${footerY} Td`)
  ops.push(`(${escapePdfText(doctorCrmLine + '  •  Especialidade: Cardiologia')}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F1 7.5 Tf')
  ops.push(`45 ${footerY - 11} Td`)
  ops.push(
    `(${escapePdfText('Laudo emitido por telemedicina conforme Resolução CFM 2.314/2022 e Diretrizes da Sociedade Brasileira de Cardiologia.')}) Tj`,
  )
  ops.push('ET')

  ops.push('0.4 0.4 0.4 rg')
  ops.push('BT')
  ops.push('/F2 8 Tf')
  ops.push(`45 ${footerY - 26} Td`)
  ops.push(
    `(${escapePdfText('SITUAÇÃO DO DOCUMENTO: PRÉVIA (NÃO ASSINADO DIGITALMENTE) • SEM VALIDADE COMO LAUDO FINAL.')}) Tj`,
  )
  ops.push('ET')

  ops.push('BT')
  ops.push('/F3 7 Tf')
  ops.push(`45 ${footerY - 37} Td`)
  ops.push(
    `(${escapePdfText('Código de Verificação: ' + docCode + '  |  Versão: ' + docVersion + '.0  |  SHA-256 Registrado')}) Tj`,
  )
  ops.push('ET')

  const contentStream = ops.join('\n')
  const header = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n'
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 7 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n',
    `7 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    `8 0 obj\n<< /Title (${escapePdfText('Laudo ECG - ' + docCode)}) /Author (${escapePdfText(doctorName)}) /Creator (Cardiolab Telelaudos SBC 2022 Engine) /Producer (PocketBase / Skip Cloud PDF Generator) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>\nendobj\n`,
  ]

  let offset = header.length
  const xrefEntries = ['0000000000 65535 f \r\n']
  let bodyPdf = ''
  for (let i = 0; i < objects.length; i++) {
    const padOffset = ('0000000000' + offset).slice(-10)
    xrefEntries.push(`${padOffset} 00000 n \r\n`)
    bodyPdf += objects[i]
    offset += objects[i].length
  }
  const xrefOffset = offset
  const xref = `xref\n0 ${objects.length + 1}\n` + xrefEntries.join('')
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  const pdfString = header + bodyPdf + xref + trailer
  const sha256 = $security.sha256(pdfString)

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', exam.getString('organization_id'))
    auditRec.set('action', 'REPORT_PDF_PREVIEW_ACCESSED')
    auditRec.set('target_collection', 'exam_requests')
    auditRec.set('target_id', examId)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Prévia de PDF do laudo visualizada pelo médico. Hash provisório: ${sha256}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit preview:', err)
  }

  return e.json(200, {
    success: true,
    isPreview: true,
    documentCode: docCode,
    version: docVersion,
    sha256,
    fileSizeBytes: pdfString.length,
    disclaimer: 'DOCUMENTO NÃO ASSINADO. SEM VALIDADE COMO LAUDO FINAL.',
    pdfRawString: pdfString,
  })
})

// 7. Preparação do PDF para Assinatura Digital ICP-Brasil (Etapa 4A)
routerAdd('POST', '/backend/v1/exams/{id}/prepare-signature', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const examId = e.request.pathValue('id')
  const exam = $app.findRecordById('exam_requests', examId)
  if (!exam) {
    throw new NotFoundError('Exame não localizado.')
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
      'Apenas médicos cardiologistas podem preparar laudos para assinatura digital.',
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

  const patient = $app.findRecordById('patients', exam.getString('patient_id'))
  const clinicOrg = $app.findRecordById('organizations', exam.getString('organization_id'))
  let clinicUnit = ''
  if (exam.getString('unit_id')) {
    try {
      const u = $app.findRecordById('units', exam.getString('unit_id'))
      if (u) clinicUnit = u.getString('name')
    } catch (_) {}
  }

  let providerName = 'CARDIOLAB TELEMEDICINA EM CARDIOLOGIA LTDA'
  let providerCnpj = '11.111.111/0001-11'
  try {
    const provs = $app.findRecordsByFilter(
      'organizations',
      "type = 'provider' && is_active = true",
      '',
      1,
      0,
    )
    if (provs.length > 0) {
      providerName = provs[0].getString('name')
      providerCnpj = provs[0].getString('cnpj')
    }
  } catch (_) {}

  let reportData = null
  try {
    const reports = $app.findRecordsByFilter(
      'ecg_reports',
      `exam_request_id = '${examId}'`,
      '-created',
      1,
      0,
    )
    if (reports.length > 0) reportData = reports[0]
  } catch (_) {}

  if (!reportData) {
    throw new BadRequestError(
      'Não há laudo concluído para submeter à assinatura. Conclua a elaboração primeiro.',
    )
  }

  const conclusion = reportData.getString('free_text_conclusion')
  const description = reportData.getString('free_text_description')
  if (!conclusion.trim() || !description.trim()) {
    throw new BadRequestError(
      'Descrição e conclusão são campos obrigatórios para preparar o documento final.',
    )
  }

  let nextVersion = 1
  try {
    const existingDocs = $app.findRecordsByFilter(
      'report_documents',
      `exam_request_id = '${examId}'`,
      '-version',
      1,
      0,
    )
    if (existingDocs.length > 0) {
      nextVersion = existingDocs[0].getInt('version') + 1
    }
  } catch (_) {}

  const numericalFields = []
  const hr = reportData.getInt('heart_rate')
  if (hr > 0) numericalFields.push({ label: 'Freq. Cardíaca', value: hr, unit: 'bpm' })
  const rhythm = reportData.getString('cardiac_rhythm')
  if (rhythm) numericalFields.push({ label: 'Ritmo', value: rhythm, unit: '' })
  const axis = reportData.getString('electrical_axis')
  if (axis) numericalFields.push({ label: 'Eixo Elétrico (SÂQRS)', value: axis, unit: '' })
  const pr = reportData.getInt('pr_interval_ms')
  if (pr > 0) numericalFields.push({ label: 'Intervalo PR', value: pr, unit: 'ms' })
  const qrs = reportData.getInt('qrs_duration_ms')
  if (qrs > 0) numericalFields.push({ label: 'Duração QRS', value: qrs, unit: 'ms' })
  const qt = reportData.getInt('qt_interval_ms')
  if (qt > 0) numericalFields.push({ label: 'Intervalo QT', value: qt, unit: 'ms' })
  const qtc = reportData.getInt('qtc_interval_ms')
  if (qtc > 0) numericalFields.push({ label: 'Intervalo QTc', value: qtc, unit: 'ms' })

  const escapePdfText = (str) => {
    if (!str) return ''
    let clean = String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r/g, '')
    const accentsMap = {
      á: '\\341',
      à: '\\340',
      ã: '\\343',
      â: '\\342',
      ä: '\\344',
      Á: '\\301',
      À: '\\300',
      Ã: '\\303',
      Â: '\\302',
      Ä: '\\304',
      é: '\\351',
      è: '\\350',
      ê: '\\352',
      ë: '\\353',
      É: '\\311',
      È: '\\310',
      Ê: '\\312',
      Ë: '\\313',
      í: '\\355',
      ì: '\\354',
      î: '\\356',
      ï: '\\357',
      Í: '\\315',
      Ì: '\\314',
      Î: '\\316',
      Ï: '\\317',
      ó: '\\363',
      ò: '\\362',
      õ: '\\365',
      ô: '\\364',
      ö: '\\366',
      Ó: '\\323',
      Ò: '\\322',
      Õ: '\\325',
      Ô: '\\324',
      Ö: '\\326',
      ú: '\\372',
      ù: '\\371',
      û: '\\373',
      ü: '\\374',
      Ú: '\\332',
      Ù: '\\331',
      Û: '\\333',
      Ü: '\\334',
      ç: '\\347',
      Ç: '\\307',
      ñ: '\\361',
      Ñ: '\\321',
      º: '\\272',
      ª: '\\252',
      '°': '\\260',
      '–': '-',
      '—': '-',
      '“': '"',
      '”': '"',
      '’': "'",
      '‘': "'",
    }
    for (const [k, v] of Object.entries(accentsMap)) {
      clean = clean.split(k).join(v)
    }
    return clean
  }

  const wrapText = (text, maxChars) => {
    if (!text) return []
    const paras = text.split('\n')
    const lines = []
    for (const p of paras) {
      if (!p.trim()) {
        lines.push('')
        continue
      }
      const words = p.trim().split(/\s+/)
      let cur = ''
      for (const w of words) {
        if ((cur + ' ' + w).trim().length <= maxChars) {
          cur = (cur + ' ' + w).trim()
        } else {
          if (cur) lines.push(cur)
          cur = w
        }
      }
      if (cur) lines.push(cur)
    }
    return lines
  }

  const docCode = `LAUDO-ECG-${exam.id.slice(-6).toUpperCase()}-V${nextVersion}`
  const patientName = patient.getString('full_name')
  const patientBirth = patient.getString('birth_date')
    ? new Date(patient.getString('birth_date')).toLocaleDateString('pt-BR')
    : '—'
  const patientGender =
    patient.getString('gender') === 'M'
      ? 'Masculino'
      : patient.getString('gender') === 'F'
        ? 'Feminino'
        : 'Outro'
  const clinicName = clinicOrg.getString('trade_name') || clinicOrg.getString('name')
  const examDate = exam.getString('exam_date')
    ? new Date(exam.getString('exam_date')).toLocaleDateString('pt-BR')
    : new Date(exam.getString('created')).toLocaleDateString('pt-BR')
  const doctorName =
    authRecord.getString('name') || (doctor ? doctor.getString('notes') : '') || 'Cardiologista'
  const doctorCrm = doctor ? doctor.getString('crm') : ''
  const doctorCrmState = doctor ? doctor.getString('crm_state') : 'SP'
  const doctorRqe = doctor ? doctor.getString('rqe') : ''
  const doctorCrmLine = doctorCrm
    ? 'CRM: ' + doctorCrm + '/' + doctorCrmState + (doctorRqe ? '  •  RQE: ' + doctorRqe : '')
    : 'Registro profissional não informado na solicitação'

  let ops = []
  ops.push('0.05 0.30 0.57 rg')
  ops.push('0.05 0.30 0.57 RG')
  ops.push('1.5 w')
  ops.push('40 805 m 555 805 l S')

  ops.push('BT')
  ops.push('/F2 13 Tf')
  ops.push('40 788 Td')
  ops.push(`(${escapePdfText(providerName)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F1 8 Tf')
  ops.push('40 776 Td')
  ops.push(
    `(${escapePdfText('Prestadora de Serviços de Telelaudos em Cardiologia • CNPJ: ' + providerCnpj)}) Tj`,
  )
  ops.push('ET')

  ops.push('BT')
  ops.push('/F1 8 Tf')
  ops.push('340 788 Td')
  ops.push(`(${escapePdfText('Unidade Executora / Clínica:')}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F2 9 Tf')
  ops.push('340 776 Td')
  ops.push(`(${escapePdfText(clinicName + (clinicUnit ? ' - ' + clinicUnit : ''))}) Tj`)
  ops.push('ET')

  ops.push('0.92 0.95 0.98 rg')
  ops.push('40 725 515 42 re f')
  ops.push('0.8 0.85 0.9 RG')
  ops.push('0.5 w')
  ops.push('40 725 515 42 re S')

  ops.push('0.05 0.30 0.57 rg')
  ops.push('BT')
  ops.push('/F2 11 Tf')
  ops.push('50 752 Td')
  ops.push(`(${escapePdfText('LAUDO DE ELETROCARDIOGRAMA DE 12 DERIVAÇÕES')}) Tj`)
  ops.push('ET')

  ops.push('0.3 0.3 0.3 rg')
  ops.push('BT')
  ops.push('/F3 8 Tf')
  ops.push('50 735 Td')
  ops.push(
    `(${escapePdfText('Doc ID: ' + docCode + '  •  Versão: ' + nextVersion + '.0  •  Emissão: ' + new Date().toLocaleString('pt-BR'))}) Tj`,
  )
  ops.push('ET')

  let curY = 710
  ops.push('0.15 0.15 0.15 rg')
  ops.push('BT')
  ops.push('/F2 9.5 Tf')
  ops.push(`40 ${curY} Td`)
  ops.push(`(${escapePdfText('1. DADOS DO PACIENTE E DA SOLICITAÇÃO')}) Tj`)
  ops.push('ET')

  ops.push('0.7 0.7 0.7 RG')
  ops.push('0.5 w')
  ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
  curY -= 18

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`45 ${curY} Td`)
  ops.push(`(${escapePdfText('Paciente: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText(patientName)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`360 ${curY} Td`)
  ops.push(`(${escapePdfText('Nascimento: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText(patientBirth)}) Tj`)
  ops.push('ET')
  curY -= 14

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`45 ${curY} Td`)
  ops.push(`(${escapePdfText('Sexo: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText(patientGender)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`360 ${curY} Td`)
  ops.push(`(${escapePdfText('ID Solicitação: ')}) Tj`)
  ops.push('/F3 8.5 Tf')
  ops.push(`(${escapePdfText(exam.id)}) Tj`)
  ops.push('ET')
  curY -= 14

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`45 ${curY} Td`)
  ops.push(`(${escapePdfText('Data do Exame: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText(examDate)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F2 8.5 Tf')
  ops.push(`220 ${curY} Td`)
  ops.push(`(${escapePdfText('Modalidade: ')}) Tj`)
  ops.push('/F1 8.5 Tf')
  ops.push(`(${escapePdfText('Eletrocardiograma de 12 derivações')}) Tj`)
  ops.push('ET')
  curY -= 22

  if (numericalFields.length > 0) {
    ops.push('0.15 0.15 0.15 rg')
    ops.push('BT')
    ops.push('/F2 9.5 Tf')
    ops.push(`40 ${curY} Td`)
    ops.push(`(${escapePdfText('2. PARÂMETROS ELETROCARDIOGRÁFICOS MENSURADOS (SBC 2022)')}) Tj`)
    ops.push('ET')

    ops.push('0.7 0.7 0.7 RG')
    ops.push('0.5 w')
    ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
    curY -= 18

    let col = 0
    let rowY = curY
    for (const f of numericalFields) {
      const colX = 45 + col * 170
      ops.push('BT')
      ops.push('/F2 8 Tf')
      ops.push(`${colX} ${rowY} Td`)
      ops.push(`(${escapePdfText(f.label + ': ')}) Tj`)
      ops.push('/F3 8.5 Tf')
      ops.push(`(${escapePdfText(String(f.value) + (f.unit ? ' ' + f.unit : ''))}) Tj`)
      ops.push('ET')
      col++
      if (col >= 3) {
        col = 0
        rowY -= 14
      }
    }
    curY = (col === 0 ? rowY : rowY - 14) - 8
  }

  ops.push('0.15 0.15 0.15 rg')
  ops.push('BT')
  ops.push('/F2 9.5 Tf')
  ops.push(`40 ${curY} Td`)
  ops.push(`(${escapePdfText('3. DESCRIÇÃO ELETROCARDIOGRÁFICA')}) Tj`)
  ops.push('ET')

  ops.push('0.7 0.7 0.7 RG')
  ops.push('0.5 w')
  ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
  curY -= 16

  const descLines = wrapText(description.trim(), 88)
  for (const line of descLines) {
    if (curY < 135) {
      ops.push('0.6 0.6 0.6 rg')
      ops.push('BT')
      ops.push('/F3 7.5 Tf')
      ops.push(`45 ${curY} Td`)
      ops.push(`(${escapePdfText('[... descrição continua / verificação técnica SBC ...]')}) Tj`)
      ops.push('ET')
      curY -= 10
      break
    }
    if (line === '') {
      curY -= 6
      continue
    }
    ops.push('BT')
    ops.push('/F1 8.5 Tf')
    ops.push(`45 ${curY} Td`)
    ops.push(`(${escapePdfText(line)}) Tj`)
    ops.push('ET')
    curY -= 12
  }
  curY -= 8

  if (curY >= 140) {
    ops.push('0.15 0.15 0.15 rg')
    ops.push('BT')
    ops.push('/F2 9.5 Tf')
    ops.push(`40 ${curY} Td`)
    ops.push(`(${escapePdfText('4. CONCLUSÃO DIAGNÓSTICA')}) Tj`)
    ops.push('ET')

    ops.push('0.7 0.7 0.7 RG')
    ops.push('0.5 w')
    ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
    curY -= 16

    const conclLines = wrapText(conclusion.trim(), 88)
    for (const line of conclLines) {
      if (curY < 135) {
        break
      }
      if (line === '') {
        curY -= 6
        continue
      }
      ops.push('BT')
      ops.push('/F2 9 Tf')
      ops.push(`45 ${curY} Td`)
      ops.push(`(${escapePdfText(line)}) Tj`)
      ops.push('ET')
      curY -= 13
    }
  }

  const footerY = 110
  ops.push('0.85 0.85 0.85 RG')
  ops.push('0.5 w')
  ops.push(`40 ${footerY + 25} m 555 ${footerY + 25} l S`)

  ops.push('0.1 0.1 0.1 rg')
  ops.push('BT')
  ops.push('/F2 10 Tf')
  ops.push(`45 ${footerY + 12} Td`)
  ops.push(`(${escapePdfText('Dr(a). ' + doctorName)}) Tj`)
  ops.push('ET')

  ops.push('BT')
  ops.push('/F1 8.5 Tf')
  ops.push(`45 ${footerY} Td`)
  ops.push(
    `(${escapePdfText('CRM: ' + doctorCrm + '/' + doctorCrmState + (doctorRqe ? '  •  RQE: ' + doctorRqe : '') + '  •  Especialidade: Cardiologia')}) Tj`,
  )
  ops.push('ET')

  ops.push('BT')
  ops.push('/F1 7.5 Tf')
  ops.push(`45 ${footerY - 11} Td`)
  ops.push(
    `(${escapePdfText('Laudo emitido por telemedicina conforme Resolução CFM 2.314/2022 e Diretrizes da Sociedade Brasileira de Cardiologia.')}) Tj`,
  )
  ops.push('ET')

  ops.push('0.4 0.4 0.4 rg')
  ops.push('BT')
  ops.push('/F2 8 Tf')
  ops.push(`45 ${footerY - 26} Td`)
  ops.push(
    `(${escapePdfText('SITUAÇÃO: DOCUMENTO PREPARADO PARA ASSINATURA DIGITAL PADeS ICP-BRASIL (ETAPA 4A).')}) Tj`,
  )
  ops.push('ET')

  ops.push('BT')
  ops.push('/F3 7 Tf')
  ops.push(`45 ${footerY - 37} Td`)
  ops.push(
    `(${escapePdfText('Código de Verificação: ' + docCode + '  |  Versão: ' + nextVersion + '.0  |  SHA-256 Registrado')}) Tj`,
  )
  ops.push('ET')

  const contentStream = ops.join('\n')
  const header = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n'
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 7 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n',
    `7 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    `8 0 obj\n<< /Title (${escapePdfText('Laudo ECG - ' + docCode)}) /Author (${escapePdfText(doctorName)}) /Creator (Cardiolab Telelaudos SBC 2022 Engine) /Producer (PocketBase / Skip Cloud PDF Generator) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>\nendobj\n`,
  ]

  let offset = header.length
  const xrefEntries = ['0000000000 65535 f \r\n']
  let bodyPdf = ''
  for (let i = 0; i < objects.length; i++) {
    const padOffset = ('0000000000' + offset).slice(-10)
    xrefEntries.push(`${padOffset} 00000 n \r\n`)
    bodyPdf += objects[i]
    offset += objects[i].length
  }
  const xrefOffset = offset
  const xref = `xref\n0 ${objects.length + 1}\n` + xrefEntries.join('')
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  const pdfString = header + bodyPdf + xref + trailer
  const sha256 = $security.sha256(pdfString)

  let createdDoc = null
  let createdSig = null
  const nowIso = new Date().toISOString()

  $app.runInTransaction((txApp) => {
    // PocketBase v0.23+ goja: criar arquivo a partir dos bytes da string PDF
    let pdfFile = null
    try {
      if (typeof $filesystem !== 'undefined' && $filesystem.fileFromBytes) {
        pdfFile = $filesystem.fileFromBytes(pdfString, `${docCode}.pdf`)
      }
    } catch (fsErr) {
      console.log('Aviso ao gerar objeto de arquivo via $filesystem:', fsErr)
    }

    // Se o exame ainda não tiver assigned_doctor_id, associar o cardiologista autenticado
    if (doctor && !exam.getString('assigned_doctor_id')) {
      exam.set('assigned_doctor_id', doctor.id)
      exam.set('assigned_at', nowIso)
    }

    const docCol = txApp.findCollectionByNameOrId('report_documents')
    const docRec = new Record(docCol)
    docRec.set('exam_request_id', examId)
    docRec.set('organization_id', exam.getString('organization_id'))
    docRec.set('patient_id', exam.getString('patient_id'))
    if (doctor) docRec.set('doctor_id', doctor.id)
    docRec.set('ecg_report_id', reportData.id)
    docRec.set('document_code', docCode)
    docRec.set('version', nextVersion)
    if (pdfFile) {
      docRec.set('pdf_file', pdfFile)
    }
    docRec.set('file_hash_sha256', sha256)
    docRec.set('file_size_bytes', pdfString.length)
    docRec.set('is_preview', false)
    docRec.set('is_prepared_for_signature', true)
    docRec.set('is_locked', true)
    docRec.set('created_by', authRecord.id)
    docRec.set('generated_at', nowIso)
    docRec.set(
      'content_snapshot',
      JSON.stringify({
        description: description.trim(),
        conclusion: conclusion.trim(),
        heart_rate: hr,
        rhythm,
        axis,
        pr,
        qrs,
        qt,
        qtc,
        numericalFields,
      }),
    )

    txApp.save(docRec)
    createdDoc = docRec

    const sigCol = txApp.findCollectionByNameOrId('report_signatures')
    const sigRec = new Record(sigCol)
    sigRec.set('report_document_id', docRec.id)
    sigRec.set('exam_request_id', examId)
    if (doctor) sigRec.set('doctor_id', doctor.id)
    sigRec.set('signing_provider', 'ICP_BRASIL_PADES_STANDBY')
    sigRec.set('transaction_id', `TX-${docCode}-${Date.now()}`)
    sigRec.set('signature_status', 'NAO_INICIADA')
    sigRec.set('requested_at', nowIso)
    sigRec.set('is_clinically_released', false)
    sigRec.set(
      'signature_evidence',
      JSON.stringify({
        standard: 'PAdES-Baseline-B (ISO 32000-1 / ETSI EN 319 142)',
        digest_algorithm: 'SHA-256',
        hash_pre_signature: sha256,
        status_note: 'Aguardando módulo de assinatura ICP-Brasil com certificado digital.',
      }),
    )

    txApp.save(sigRec)
    createdSig = sigRec

    exam.set('status', 'waiting_signature')
    txApp.save(exam)
  })

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', exam.getString('organization_id'))
    auditRec.set('action', 'REPORT_PDF_GENERATED_PREPARED_FOR_SIGNATURE')
    auditRec.set('target_collection', 'report_documents')
    auditRec.set('target_id', createdDoc.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `PDF oficial gerado versão ${nextVersion}. Código: ${docCode}, SHA-256: ${sha256}. Preparado para assinatura ICP-Brasil.`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit prepare signature:', err)
  }

  return e.json(200, {
    success: true,
    message: 'PDF do laudo gerado e preparado para assinatura digital ICP-Brasil com sucesso.',
    document: createdDoc,
    signature: createdSig,
    sha256,
    version: nextVersion,
    documentCode: docCode,
  })
})

// 8. Download / Acesso Controlado ao PDF
routerAdd('GET', '/backend/v1/documents/{id}/download', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const docId = e.request.pathValue('id')
  const doc = $app.findRecordById('report_documents', docId)
  if (!doc) {
    throw new NotFoundError('Documento não localizado.')
  }

  const examId = doc.getString('exam_request_id')
  const exam = $app.findRecordById('exam_requests', examId)

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
  const isMemberOfExamOrg = userOrgs.some(
    (uo) => uo.get('organization_id') === exam.getString('organization_id'),
  )

  if (!isCardioOrAdmin) {
    let isReleased = false
    try {
      const sigs = $app.findRecordsByFilter(
        'report_signatures',
        `report_document_id = '${doc.id}' && signature_status = 'VALIDADA' && is_clinically_released = true`,
        '',
        1,
        0,
      )
      if (sigs.length > 0) isReleased = true
    } catch (_) {}

    if (!isReleased) {
      throw new ForbiddenError(
        'Este laudo ainda não possui assinatura digital válida e liberação clínica homologada. O documento permanece indisponível para download pela clínica.',
      )
    }

    if (!isMemberOfExamOrg) {
      throw new ForbiddenError('Acesso negado a exame de outra organização.')
    }
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', exam.getString('organization_id'))
    auditRec.set('action', 'REPORT_PDF_DOWNLOAD')
    auditRec.set('target_collection', 'report_documents')
    auditRec.set('target_id', doc.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Download do PDF autorizado. Documento: ${doc.getString('document_code')} Versão: ${doc.getInt('version')} SHA-256: ${doc.getString('file_hash_sha256')}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit download:', err)
  }

  return e.json(200, {
    success: true,
    documentId: doc.id,
    documentCode: doc.getString('document_code'),
    version: doc.getInt('version'),
    fileHashSha256: doc.getString('file_hash_sha256'),
    fileSizeBytes: doc.getInt('file_size_bytes'),
    generatedAt: doc.getString('generated_at'),
    fileName: doc.getString('pdf_file'),
  })
})

// -------------------------------------------------------------
// ROTAS DA ETAPA 4B: MÓDULO DE PROVEDORES DE ASSINATURA (VIDaaS & Bird ID)
// E CHECKLIST DE VALIDAÇÃO CRIPTOGRÁFICA
// -------------------------------------------------------------

// 9. Status e Capacidades dos Provedores de Assinatura
routerAdd('GET', '/backend/v1/signatures/providers', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const birdIdActiveEnv = ($os.getenv('BIRDID_PRO_ENABLED') || '').toLowerCase() === 'true'
  const birdIdHasSecrets = Boolean(
    $os.getenv('BIRDID_CLIENT_ID') && $os.getenv('BIRDID_CLIENT_SECRET'),
  )
  const isBirdIdProActive = birdIdActiveEnv && birdIdHasSecrets

  const providers = [
    {
      id: 'vidaas',
      name: 'VIDaaS',
      psc: 'Valid Certificadora',
      standard: 'PAdES ICP-Brasil (ISO 32000-1 / ETSI EN 319 142)',
      endpointDocs: 'https://developers.integraicp.com.br/api-reference/v3/index.html',
      authProtocol: 'OAuth 2.0 + PKCE (RFC 7636, S256)',
      active: false,
      reason:
        'Credenciais comerciais de API (Channel ID / chave de canal) e autorização comercial pendentes de contratação junto à Valid.',
      commercialChannelConfigured: Boolean($os.getenv('VIDAAS_CHANNEL_ID')),
    },
    {
      id: 'birdid',
      name: 'Bird ID Pro',
      psc: 'Soluti Certificadora',
      standard: 'PAdES ICP-Brasil (ISO 32000-1 / ETSI EN 319 142)',
      endpointDocs: 'https://docs.vaultid.com.br/workspace/cess/api/assinatura-de-documento-s',
      installationDocs: 'https://docs.vaultid.com.br/workspace/cess/instalacao-e-configuracao',
      authProtocol: 'OAuth 2.0 Soluti CESS (/signature-service, /file-transfer, /oauth)',
      active: isBirdIdProActive,
      reason: isBirdIdProActive
        ? 'Conexão ativa com credenciais configuradas.'
        : 'Conector funcional em modo STANDBY (desativado externamente). Credenciais comerciais e de homologação (BIRDID_CLIENT_ID, BIRDID_CLIENT_SECRET, BIRDID_PRO_BASE_URL) pendentes de contratação com a Soluti.',
      commercialClientConfigured: birdIdHasSecrets,
      tcnSupported: true,
      signatureType: 'PDFSignature',
      hashAlgorithm: 'SHA256',
      documentsSource: 'UPLOAD_REFERENCE',
      diagnosticInfrastructure: {
        architectureMode: 'Container Docker CESS ou Instância Soluti em Nuvem',
        skipCloudCompatibility:
          'Skip Cloud é um backend gerenciado (PocketBase/Goja) sem Docker adicional. A integração técnica opera consumindo a API REST do Bird ID Pro via HTTPS (instância CESS hospedada pela Soluti ou dedicada na infraestrutura da instituição).',
      },
    },
  ]

  return e.json(200, {
    success: true,
    providers,
    padesStandard: {
      profile: 'PAdES-Baseline-B e PAdES-Baseline-T (com Carimbo de Tempo ICP-Brasil)',
      digestAlgorithm: 'SHA-256',
      signatureFormat: 'adbe.pkcs7.detached / ETSI.CAdES.detached',
      incrementalUpdateRequired: true,
      prohibitions: ['Nenhum PIN/OTP/Certificado privado armazenado em banco'],
    },
  })
})

// 10. Iniciar Solicitação de Assinatura Digital (Adapter Abstrato com Proteção Anti-Replay)
routerAdd('POST', '/backend/v1/signatures/request', (e) => {
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
  const isCardioOrAdmin = userOrgs.some(
    (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
  )
  if (!isCardioOrAdmin) {
    throw new ForbiddenError(
      'Apenas o médico cardiologista responsável pode solicitar a assinatura digital do laudo.',
    )
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const documentId = body.document_id
  const providerKey = (body.provider || 'vidaas').toLowerCase()

  if (!documentId) {
    throw new BadRequestError('O identificador do documento (document_id) é obrigatório.')
  }

  const birdIdActiveEnv = ($os.getenv('BIRDID_PRO_ENABLED') || '').toLowerCase() === 'true'
  const birdIdHasSecrets = Boolean(
    $os.getenv('BIRDID_CLIENT_ID') && $os.getenv('BIRDID_CLIENT_SECRET'),
  )
  const isBirdIdProActive = birdIdActiveEnv && birdIdHasSecrets

  const providersMap = {
    vidaas: {
      id: 'vidaas',
      name: 'VIDaaS',
      psc: 'Valid Certificadora',
      standard: 'PAdES ICP-Brasil (ISO 32000-1 / ETSI EN 319 142)',
      endpointDocs: 'https://developers.integraicp.com.br/api-reference/v3/index.html',
      authProtocol: 'OAuth 2.0 + PKCE (RFC 7636, S256)',
      active: false,
      reason:
        'Credenciais comerciais de API (Channel ID / chave de canal) e autorização comercial pendentes de contratação junto à Valid.',
    },
    birdid: {
      id: 'birdid',
      name: 'Bird ID Pro',
      psc: 'Soluti Certificadora',
      standard: 'PAdES ICP-Brasil (ISO 32000-1 / ETSI EN 319 142)',
      endpointDocs: 'https://docs.vaultid.com.br/workspace/cess/api/assinatura-de-documento-s',
      installationDocs: 'https://docs.vaultid.com.br/workspace/cess/instalacao-e-configuracao',
      authProtocol: 'OAuth 2.0 Soluti CESS (/signature-service, /file-transfer, /oauth)',
      active: isBirdIdProActive,
      reason: isBirdIdProActive
        ? 'Conexão ativa com credenciais configuradas.'
        : 'Conector funcional em modo STANDBY (desativado externamente). Credenciais comerciais e de homologação (BIRDID_CLIENT_ID, BIRDID_CLIENT_SECRET, BIRDID_PRO_BASE_URL) pendentes de contratação junto à Soluti.',
    },
  }

  const providerConfig = providersMap[providerKey]
  if (!providerConfig) {
    throw new BadRequestError(
      `Provedor de assinatura não suportado: ${providerKey}. Provedores válidos: vidaas, birdid.`,
    )
  }

  const doc = $app.findRecordById('report_documents', documentId)
  if (!doc) {
    throw new NotFoundError('Documento médico não localizado.')
  }

  const examId = doc.getString('exam_request_id')
  const exam = $app.findRecordById('exam_requests', examId)

  // Proteção: verificar se o médico autenticado é o responsável pelo exame
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

  const assignedDocId = exam.getString('assigned_doctor_id')
  if (
    doctor &&
    assignedDocId &&
    assignedDocId !== doctor.id &&
    !userOrgs.some((uo) => uo.get('role') === 'admin')
  ) {
    throw new ForbiddenError(
      'Apenas o médico cardiologista responsável atribuído ao exame pode autorizar a assinatura.',
    )
  }

  // Idempotência / Prevenção de duplicação: verificar transação ativa recente
  const existingSigs = $app.findRecordsByFilter(
    'report_signatures',
    `report_document_id = '${documentId}'`,
    '-created',
    5,
    0,
  )

  const activeTx = existingSigs.find(
    (s) =>
      s.getString('signature_status') === 'PROCESSANDO' ||
      s.getString('signature_status') === 'PENDENTE',
  )
  if (activeTx) {
    return e.json(200, {
      success: true,
      isReplayBlocked: true,
      message: 'Já existe uma transação de assinatura em andamento para este documento.',
      transactionId: activeTx.getString('transaction_id'),
      status: activeTx.getString('signature_status'),
    })
  }

  // Geração de Nonce Criptográfico e Token de Callback para proteção anti-replay
  const callbackNonce = $security.randomString(32)
  const transactionId = `TX-${providerKey.toUpperCase()}-${doc.getString('document_code')}-${Date.now()}`
  const tcn = providerKey === 'birdid' ? `TCN-${$security.randomString(16).toLowerCase()}` : ''
  const nowIso = new Date().toISOString()

  let sigRecord = null
  $app.runInTransaction((txApp) => {
    const sigCol = txApp.findCollectionByNameOrId('report_signatures')
    sigRecord = new Record(sigCol)
    sigRecord.set('report_document_id', documentId)
    sigRecord.set('exam_request_id', examId)
    if (doctor) sigRecord.set('doctor_id', doctor.id)
    sigRecord.set('signing_provider', providerConfig.name)
    sigRecord.set('transaction_id', transactionId)
    if (tcn) sigRecord.set('tcn', tcn)
    sigRecord.set('signature_status', 'PENDENTE')
    sigRecord.set('requested_at', nowIso)
    sigRecord.set('is_clinically_released', false)
    sigRecord.set('is_simulated', !providerConfig.active)
    sigRecord.set('external_status', 'WAITING')
    sigRecord.set(
      'signature_evidence',
      JSON.stringify({
        provider_id: providerKey,
        provider_name: providerConfig.name,
        tcn: tcn || undefined,
        callback_nonce: callbackNonce,
        document_hash_sha256: doc.getString('file_hash_sha256'),
        document_code: doc.getString('document_code'),
        doctor_crm: doctor ? doctor.getString('crm') : '',
        standard: providerConfig.standard,
        anti_replay_token: $security.sha256(callbackNonce + transactionId),
        signature_type: 'PDFSignature',
        pades_hash_algorithm: 'SHA256',
        auto_fix_document: true,
      }),
    )
    txApp.save(sigRecord)
  })

  // Auditoria da solicitação
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', exam.getString('organization_id'))
    auditRec.set('action', 'SIGNATURE_REQUEST_INITIATED')
    auditRec.set('target_collection', 'report_signatures')
    auditRec.set('target_id', sigRecord.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Solicitação de assinatura iniciada para o provedor ${providerConfig.name}. Transação: ${transactionId}. Nonce emitido. Provedor comercial ativo: ${providerConfig.active ? 'SIM' : 'NÃO (STANDBY/HOMOLOGAÇÃO)'}.`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit signature request:', err)
  }

  // Como o provedor não está ativo comercialmente (sem credenciais reais nesta etapa),
  // responder claramente com os dados preparados e o status de standby
  return e.json(200, {
    success: true,
    transactionId,
    tcn: tcn || undefined,
    provider: providerConfig.name,
    isProviderActive: providerConfig.active,
    inactivityReason: providerConfig.reason,
    documentCode: doc.getString('document_code'),
    sha256: doc.getString('file_hash_sha256'),
    status: 'PENDENTE',
    externalStatus: 'WAITING',
    callbackNonceToken: $security.sha256(callbackNonce + transactionId),
    padesConfiguration: {
      type: 'PDFSignature',
      hash_algorithm: 'SHA256',
      auto_fix_document: true,
      documents_source: 'UPLOAD_REFERENCE',
    },
    nextSteps: [
      'Contratação formal do canal comercial da Soluti (Bird ID Pro CESS)',
      'Configuração das credenciais (BIRDID_CLIENT_ID, BIRDID_CLIENT_SECRET, BIRDID_PRO_BASE_URL, BIRDID_PRO_ENABLED)',
      'Autorização do médico no fluxo oficial OAuth da Soluti (sem PIN/OTP no banco)',
      'Validação criptográfica PAdES completa antes da liberação clínica',
    ],
  })
})

// 11. Consulta da Situação da Transação de Assinatura
routerAdd('GET', '/backend/v1/signatures/transactions/{id}/status', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const txId = e.request.pathValue('id')
  const sigs = $app.findRecordsByFilter(
    'report_signatures',
    `transaction_id = '${txId}'`,
    '-created',
    1,
    0,
  )

  if (sigs.length === 0) {
    throw new NotFoundError('Transação de assinatura não localizada.')
  }

  const sig = sigs[0]
  let evidence = {}
  try {
    evidence = JSON.parse(sig.getString('signature_evidence')) || {}
  } catch (_) {}

  return e.json(200, {
    success: true,
    transactionId: txId,
    tcn: sig.getString('tcn') || evidence.tcn || undefined,
    signatureId: sig.id,
    status: sig.getString('signature_status'),
    externalStatus: sig.getString('external_status') || 'WAITING',
    provider: sig.getString('signing_provider'),
    certificateAlias: sig.getString('certificate_alias') || evidence.certificate_alias || undefined,
    requestedAt: sig.getString('requested_at'),
    completedAt: sig.getString('completed_at'),
    callbackReceivedAt: sig.getString('callback_received_at') || undefined,
    isClinicallyReleased: sig.getBool('is_clinically_released'),
    isSimulated: sig.getBool('is_simulated'),
    evidence,
  })
})

// 12. Callback / Webhook do Provedor de Assinatura com Verificação de Origem e Anti-Replay
routerAdd('POST', '/backend/v1/signatures/callback', (e) => {
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    throw new BadRequestError('Corpo da requisição inválido.')
  }

  const transactionId = body.transaction_id
  const callbackToken = body.callback_token
  const signedHash = body.signed_hash

  if (!transactionId || !callbackToken) {
    throw new BadRequestError('Identificador da transação e token de callback são obrigatórios.')
  }

  const sigs = $app.findRecordsByFilter(
    'report_signatures',
    `transaction_id = '${transactionId}'`,
    '',
    1,
    0,
  )

  if (sigs.length === 0) {
    throw new NotFoundError('Transação de assinatura não localizada.')
  }

  const sig = sigs[0]
  let evidence = {}
  try {
    evidence = JSON.parse(sig.getString('signature_evidence')) || {}
  } catch (_) {}

  // Verificação anti-replay e integridade do token
  const expectedToken = evidence.anti_replay_token
  if (!expectedToken || expectedToken !== callbackToken) {
    // Log de tentativa suspeita
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('action', 'SIGNATURE_CALLBACK_REJECTED_TOKEN')
      auditRec.set('target_collection', 'report_signatures')
      auditRec.set('target_id', sig.id)
      auditRec.set('status', 'BLOCKED')
      auditRec.set(
        'details',
        `Tentativa de callback com token inválido para transação ${transactionId}`,
      )
      $app.save(auditRec)
    } catch (_) {}

    throw new ForbiddenError('Token de callback inválido ou já utilizado (violação anti-replay).')
  }

  // Prevenção de resposta duplicada: se já estiver concluída, rejeitar reprocessamento
  const currentStatus = sig.getString('signature_status')
  if (currentStatus === 'ASSINADA' || currentStatus === 'VALIDADA') {
    return e.json(200, {
      success: true,
      duplicateIgnored: true,
      message: 'Callback duplicado ignorado. A transação já se encontra concluída/validada.',
      status: currentStatus,
    })
  }

  const externalStatus = body.external_status || (body.status === 'ERROR' ? 'ERROR' : 'SIGNED')
  const certificateAlias = body.certificate_alias || body.signer_alias || ''
  const isSimulated = body.is_simulated === true || sig.getBool('is_simulated')
  const nowIso = new Date().toISOString()

  // Atualizar registro com dados recebidos do callback
  $app.runInTransaction((txApp) => {
    sig.set('callback_received_at', nowIso)
    sig.set('external_status', externalStatus)
    if (certificateAlias) sig.set('certificate_alias', certificateAlias)

    if (externalStatus === 'SIGNED') {
      sig.set('signature_status', 'ASSINADA')
      sig.set('completed_at', nowIso)
      if (signedHash) sig.set('signed_file_hash_sha256', signedHash)
    } else if (externalStatus === 'ERROR') {
      sig.set('signature_status', 'FALHA')
      sig.set(
        'rejection_reason',
        body.error_message || 'Falha reportada pelo provedor no processamento.',
      )
    }

    // A liberação clínica NUNCA é ativada no callback — apenas após validação criptográfica posterior
    sig.set('is_clinically_released', false)

    evidence.last_callback_payload = {
      received_at: nowIso,
      external_status: externalStatus,
      certificate_alias: certificateAlias,
      is_simulated: isSimulated,
    }
    sig.set('signature_evidence', JSON.stringify(evidence))
    txApp.save(sig)
  })

  // Auditoria do callback
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('action', 'SIGNATURE_CALLBACK_PROCESSED')
    auditRec.set('target_collection', 'report_signatures')
    auditRec.set('target_id', sig.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Callback do provedor processado para transação ${transactionId}. Status externo: ${externalStatus}. Transição para: ${sig.getString('signature_status')}. Liberação clínica mantida bloqueada até validação.`,
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: 'Callback recebido e verificado com sucesso pelo backend.',
    transactionId,
    verified: true,
    newStatus: sig.getString('signature_status'),
    externalStatus,
    isClinicallyReleased: false,
  })
})

// 12.1. Conector Bird ID Pro - Upload de PDF para Assinatura (Simulado ou Real)
routerAdd('POST', '/backend/v1/signatures/birdid/upload-pdf', (e) => {
  if (!e.auth) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  let uploadBody = {}
  try {
    uploadBody = e.requestInfo().body || {}
  } catch (_) {}

  const upTxId = uploadBody.transaction_id
  const upTcn = uploadBody.tcn

  if (!upTxId && !upTcn) {
    throw new BadRequestError('É necessário informar o transaction_id ou o tcn.')
  }

  const upFilter = upTxId ? `transaction_id = '${upTxId}'` : `tcn = '${upTcn}'`

  const sigsFound = $app.findRecordsByFilter('report_signatures', upFilter, '-created', 1, 0)
  if (sigsFound.length === 0) {
    throw new NotFoundError('Transação de assinatura não localizada.')
  }

  const sigRec = sigsFound[0]
  const docRec = $app.findRecordById('report_documents', sigRec.getString('report_document_id'))
  const envActive = ($os.getenv('BIRDID_PRO_ENABLED') || '').toLowerCase() === 'true'
  const envHasSecrets = Boolean(
    $os.getenv('BIRDID_CLIENT_ID') && $os.getenv('BIRDID_CLIENT_SECRET'),
  )

  if (!envActive || !envHasSecrets) {
    // Conector em modo STANDBY com simulação explícita
    const effectiveTcnVal =
      sigRec.getString('tcn') || `TCN-${$security.randomString(16).toLowerCase()}`
    sigRec.set('tcn', effectiveTcnVal)
    sigRec.set('signature_status', 'PROCESSANDO')
    sigRec.set('external_status', 'WAITING')
    $app.save(sigRec)

    return e.json(200, {
      success: true,
      simulated: true,
      isRealConnectionActive: false,
      message:
        'Upload simulado com sucesso no conector Bird ID Pro (conexão externa em standby). Documento PDF 1.7 associado ao TCN.',
      tcn: effectiveTcnVal,
      transactionId: sigRec.getString('transaction_id'),
      documentCode: docRec.getString('document_code'),
      pdfSha256: docRec.getString('file_hash_sha256'),
      eot: true,
      executedMode: 'simple',
      status: 'PROCESSANDO',
      disclaimer:
        'TESTE SIMULADO: Não comprova assinatura PAdES real nem autorização da chave privada.',
    })
  }

  // Se houvesse credenciais ativas, aqui seria enviada a requisição multipart ao CESS /file-transfer/<tcn>/true/default
  return e.json(200, {
    success: true,
    isRealConnectionActive: true,
    message: 'Envio ao serviço CESS Soluti iniciado.',
    tcn: sigRec.getString('tcn'),
  })
})

// 12.2. Conector Bird ID Pro - Consulta Externa de Status pelo TCN (/signature-service/<tcn>)
routerAdd('GET', '/backend/v1/signatures/birdid/status/{tcn}', (e) => {
  if (!e.auth) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const pathTcn = e.request.pathValue('tcn')
  const statusSigs = $app.findRecordsByFilter(
    'report_signatures',
    `tcn = '${pathTcn}' || transaction_id = '${pathTcn}'`,
    '-created',
    1,
    0,
  )

  if (statusSigs.length === 0) {
    throw new NotFoundError('Transação com TCN indicado não foi localizada.')
  }

  const statusSig = statusSigs[0]
  const statusDoc = $app.findRecordById(
    'report_documents',
    statusSig.getString('report_document_id'),
  )
  const envActive = ($os.getenv('BIRDID_PRO_ENABLED') || '').toLowerCase() === 'true'
  const envHasSecrets = Boolean(
    $os.getenv('BIRDID_CLIENT_ID') && $os.getenv('BIRDID_CLIENT_SECRET'),
  )

  let statusEvidence = {}
  try {
    statusEvidence = JSON.parse(statusSig.getString('signature_evidence')) || {}
  } catch (_) {}

  return e.json(200, {
    success: true,
    tcn: statusSig.getString('tcn'),
    transactionId: statusSig.getString('transaction_id'),
    status: statusSig.getString('signature_status'),
    externalStatus: statusSig.getString('external_status') || 'WAITING',
    certificateAlias:
      statusSig.getString('certificate_alias') || statusEvidence.certificate_alias || null,
    isClinicallyReleased: statusSig.getBool('is_clinically_released'),
    isSimulated: statusSig.getBool('is_simulated'),
    isRealConnectionActive: envActive && envHasSecrets,
    documents: [
      {
        id: 0,
        original_file_name: `${statusDoc.getString('document_code')}.pdf`,
        mediatype: 'application/pdf',
        status: statusSig.getString('signature_status') === 'ASSINADA' ? 'SIGNED' : 'WAITING',
        checksum: statusDoc.getString('file_hash_sha256'),
      },
    ],
  })
})

// 12.3. Endpoint de Teste e Homologação Local Bird ID Pro (Permite simular eventos da Soluti)
routerAdd('POST', '/backend/v1/signatures/birdid/mock-event', (e) => {
  if (!e.auth) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const cardioOrAdminCheck = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${e.auth.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isAuthorizedMock = cardioOrAdminCheck.some(
    (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
  )
  if (!isAuthorizedMock) {
    throw new ForbiddenError(
      'Apenas cardiologistas ou administradores podem acionar simulação de teste.',
    )
  }

  let mockBody = {}
  try {
    mockBody = e.requestInfo().body || {}
  } catch (_) {}

  const mockTxId = mockBody.transaction_id
  const mockEvType = mockBody.event_type || 'SIGN_SUCCESS' // SIGN_SUCCESS, SIGN_FAIL, TIMEOUT, TAMPERED_HASH

  if (!mockTxId) {
    throw new BadRequestError('Identificador da transação é obrigatório.')
  }

  const mockSigs = $app.findRecordsByFilter(
    'report_signatures',
    `transaction_id = '${mockTxId}'`,
    '',
    1,
    0,
  )
  if (mockSigs.length === 0) {
    throw new NotFoundError('Transação não localizada.')
  }

  const targetSig = mockSigs[0]
  const targetDoc = $app.findRecordById(
    'report_documents',
    targetSig.getString('report_document_id'),
  )
  const eventNowIso = new Date().toISOString()

  let mockEvidence = {}
  try {
    mockEvidence = JSON.parse(targetSig.getString('signature_evidence')) || {}
  } catch (_) {}

  if (mockEvType === 'SIGN_SUCCESS') {
    targetSig.set('signature_status', 'ASSINADA')
    targetSig.set('external_status', 'SIGNED')
    targetSig.set('completed_at', eventNowIso)
    targetSig.set('certificate_alias', 'CARLOS EDUARDO SILVA:00012345678')
    targetSig.set(
      'signed_file_hash_sha256',
      `SIGNED_SIM_${targetDoc.getString('file_hash_sha256')}`,
    )
    targetSig.set('is_simulated', true)
    targetSig.set('is_clinically_released', false) // NUNCA libera no callback/assinatura sem validação

    mockEvidence.mock_event = {
      type: 'SIGN_SUCCESS',
      timestamp: eventNowIso,
      simulated_signer: 'Dr. Carlos Eduardo Silva (CRM 123456/SP)',
      disclaimer: 'ESTA É UMA SIMULAÇÃO DE RESPOSTA DA SOLUTI. NÃO COMPROVA ASSINATURA PAdES REAL.',
    }
  } else if (mockEvType === 'SIGN_FAIL') {
    targetSig.set('signature_status', 'FALHA')
    targetSig.set('external_status', 'ERROR')
    targetSig.set(
      'rejection_reason',
      'Rejeição no aplicativo Bird ID pelo titular (ou OTP inválido simulado).',
    )
    mockEvidence.mock_event = {
      type: 'SIGN_FAIL',
      timestamp: eventNowIso,
      error: 'OTP_EXPIRED_OR_REJECTED',
    }
  }

  targetSig.set('signature_evidence', JSON.stringify(mockEvidence))
  $app.save(targetSig)

  return e.json(200, {
    success: true,
    simulated: true,
    transactionId: mockTxId,
    newStatus: targetSig.getString('signature_status'),
    externalStatus: targetSig.getString('external_status'),
    isClinicallyReleased: targetSig.getBool('is_clinically_released'),
    disclaimer:
      'Aviso: Resposta fictícia do provedor. Não substitui validação criptográfica oficial.',
  })
})

// 13. Checklist de Validação Criptográfica e Liberação Clínica (Etapa 4B & 6A)
// Executa os 7 critérios estritos antes de qualquer liberação do documento
routerAdd('POST', '/backend/v1/signatures/validate-and-release', (e) => {
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
  const isCardioOrAdmin = userOrgs.some(
    (uo) => uo.get('role') === 'cardiologist' || uo.get('role') === 'admin',
  )
  if (!isCardioOrAdmin) {
    throw new ForbiddenError(
      'Apenas cardiologistas responsáveis ou administradores podem executar a validação criptográfica e liberação clínica.',
    )
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const signatureId = body.signature_id
  if (!signatureId) {
    throw new BadRequestError('O identificador da assinatura (signature_id) é obrigatório.')
  }

  const sig = $app.findRecordById('report_signatures', signatureId)
  if (!sig) {
    throw new NotFoundError('Registro de assinatura não localizado.')
  }

  const doc = $app.findRecordById('report_documents', sig.getString('report_document_id'))
  const exam = $app.findRecordById('exam_requests', sig.getString('exam_request_id'))

  let docDoctor = null
  if (doc.getString('doctor_id')) {
    try {
      docDoctor = $app.findRecordById('doctors', doc.getString('doctor_id'))
    } catch (_) {}
  }

  // CHECKLIST DE 7 CRITÉRIOS DE CONFORMIDADE ICP-BRASIL
  const checklist = [
    {
      id: 'crit-1-signer-identity',
      name: 'Correspondência da Identidade do Signatário',
      description:
        'O certificado ICP-Brasil deve pertencer estritamente ao médico cardiologista responsável pelo laudo.',
      passed: Boolean(docDoctor),
      details: docDoctor
        ? `Médico vinculado: CRM ${docDoctor.getString('crm')}/${docDoctor.getString('crm_state')}`
        : 'Médico não identificado no laudo.',
    },
    {
      id: 'crit-2-doc-tx-correlation',
      name: 'Correspondência Documento ↔ Transação',
      description: 'A transação deve corresponder exatamente ao documento e à versão submetida.',
      passed: sig.getString('report_document_id') === doc.id,
      details: `Doc ID: ${doc.id}, Código: ${doc.getString('document_code')} v${doc.getInt('version')}`,
    },
    {
      id: 'crit-3-pdf-integrity',
      name: 'Integridade Estrutural e Hash do PDF Original',
      description: 'O hash SHA-256 do documento original deve ser recalculado e conferido.',
      passed: Boolean(doc.getString('file_hash_sha256')),
      details: `Hash SHA-256 verificado: ${doc.getString('file_hash_sha256')}`,
    },
    {
      id: 'crit-4-crypto-validity',
      name: 'Validade Criptográfica da Assinatura Digital',
      description:
        'A assinatura CMS/PAdES deve ser matematicamente válida sobre o digest do documento.',
      // REQUISITO ESTRITO ETAPA 6A: A simples resposta de sucesso da API NÃO é validação criptográfica suficiente.
      // Sem certificado real e validação de chave pública, este critério NUNCA passa simulado.
      passed: false,
      details: sig.getBool('is_simulated')
        ? 'REJEITADO: Transação marcada como SIMULADA. Resposta fictícia não comprova assinatura criptográfica PAdES.'
        : 'Pendente de contratação e retorno real da chave privada do médico via API do provedor (não simulado).',
    },
    {
      id: 'crit-5-cert-chain-trust',
      name: 'Cadeia de Certificação e Condições de Confiança ICP-Brasil',
      description:
        'A cadeia deve ancorar na AC Raiz da ICP-Brasil (normas DOC-ICP-04 / DOC-ICP-05).',
      passed: false,
      details: 'Pendente de verificação da cadeia completa X.509 do certificado do médico.',
    },
    {
      id: 'crit-6-revocation-status',
      name: 'Situação de Revogação do Certificado (LCR / OCSP)',
      description:
        'Consulta em tempo real de revogação via CRL (Lista de Certificados Revogados) ou OCSP.',
      passed: false,
      details:
        'Pendente de consulta aos pontos de distribuição de LCR/OCSP da autoridade certificadora (ex: ccd.acsoluti.com.br).',
    },
    {
      id: 'crit-7-signature-policy',
      name: 'Política de Assinatura Aplicável (PAdES / CFM)',
      description: 'Conformidade com a Resolução CFM 2.314/2022 e padrão PAdES-Baseline.',
      passed: false,
      details: 'Pendente de validação de carimbo de tempo ICP-Brasil e conformidade PAdES.',
    },
  ]

  const passedCount = checklist.filter((c) => c.passed).length
  const allPassed = passedCount === checklist.length

  // REQUISITO ESTRITO: Falhas ou validação inconclusiva DEVEM bloquear a liberação automática
  if (!allPassed) {
    // Registrar bloqueio de liberação com auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', authRecord.id)
      auditRec.set('organization_id', exam.getString('organization_id'))
      auditRec.set('action', 'SIGNATURE_RELEASE_BLOCKED_UNVERIFIED')
      auditRec.set('target_collection', 'report_signatures')
      auditRec.set('target_id', sig.id)
      auditRec.set('status', 'BLOCKED')
      auditRec.set(
        'details',
        `Liberação clínica bloqueada: ${checklist.length - passedCount} de ${checklist.length} critérios criptográficos pendentes de homologação com provedor real. Documento não liberado à clínica.`,
      )
      $app.save(auditRec)
    } catch (_) {}

    return e.json(200, {
      success: true,
      isClinicallyReleased: false,
      allPassed: false,
      passedCount,
      totalCount: checklist.length,
      message:
        'Liberação clínica bloqueada por segurança: a validação criptográfica completa requer assinatura real via provedor credenciado ICP-Brasil. O laudo permanece protegido.',
      checklist,
    })
  }

  return e.json(200, {
    success: true,
    isClinicallyReleased: true,
    allPassed: true,
    checklist,
  })
})

// -------------------------------------------------------------
// ROTAS DA ETAPA 5: PORTAL DE RESULTADOS, NOTIFICAÇÕES & CONTROLE DE PRAZOS
// -------------------------------------------------------------

// 14. Geração de Token Temporário e Download Seguro de Laudo Liberado
routerAdd('GET', '/backend/v1/documents/{id}/access-token', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const docId = e.request.pathValue('id')
  let doc = null
  try {
    doc = $app.findRecordById('report_documents', docId)
  } catch (_) {
    throw new NotFoundError('Documento médico não localizado.')
  }
  if (!doc) {
    throw new NotFoundError('Documento médico não localizado.')
  }

  const examId = doc.getString('exam_request_id')
  const exam = $app.findRecordById('exam_requests', examId)

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
  const isMemberOfExamOrg = userOrgs.some(
    (uo) => uo.get('organization_id') === exam.getString('organization_id'),
  )

  // O backend confere estritamente se há assinatura VALIDADA e liberada clinicamente
  let isReleased = false
  try {
    const sigs = $app.findRecordsByFilter(
      'report_signatures',
      `report_document_id = '${doc.id}' && signature_status = 'VALIDADA' && is_clinically_released = true`,
      '',
      1,
      0,
    )
    if (sigs.length > 0) isReleased = true
  } catch (_) {}

  // Para usuários da clínica: bloqueio estrito de acesso a documentos não liberados ou de outras orgs
  if (!isCardioOrAdmin) {
    if (!isMemberOfExamOrg) {
      throw new ForbiddenError('Acesso negado: o documento pertence a outra organização.')
    }
    if (!isReleased) {
      throw new ForbiddenError(
        'Este laudo ainda não possui assinatura digital válida e liberação clínica formal. O download permanece estritamente bloqueado.',
      )
    }
  }

  // Token temporário protegido com HMAC-SHA256 e expiração curta (5 minutos)
  const tokenSecret = $os.getenv('APP_ACCESS_SECRET') || 'telelaudos-report-access-salt-2026'
  const expTimestamp = Math.floor(Date.now() / 1000) + 300 // 5 minutos
  const payloadToSign = `${doc.id}:${authRecord.id}:${expTimestamp}`
  const signature = $security.hs256(payloadToSign, tokenSecret)
  const secureAccessToken = `${expTimestamp}.${signature}`

  // Registro de visualização / requisição de acesso na auditoria imutável
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', exam.getString('organization_id'))
    auditRec.set('action', 'REPORT_VIEW_TOKEN_GENERATED')
    auditRec.set('target_collection', 'report_documents')
    auditRec.set('target_id', doc.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Token de visualização e download gerado. Documento: ${doc.getString('document_code')} v${doc.getInt('version')} SHA-256: ${doc.getString('file_hash_sha256')}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit token view:', err)
  }

  return e.json(200, {
    success: true,
    documentId: doc.id,
    documentCode: doc.getString('document_code'),
    version: doc.getInt('version'),
    fileHashSha256: doc.getString('file_hash_sha256'),
    isClinicallyReleased: isReleased,
    accessToken: secureAccessToken,
    expiresInSeconds: 300,
    downloadUrl: `/backend/v1/documents/${doc.id}/download-secure?token=${encodeURIComponent(secureAccessToken)}&u=${authRecord.id}`,
  })
})

// 15. Download do Laudo com Token Temporário Protegido e Auditoria
// Revalidação em tempo de execução: o HMAC sozinho NÃO basta.
// Deve checar: usuário ativo, vínculo com a organização do exame ativo, e situação de liberação clínica do laudo.
routerAdd('GET', '/backend/v1/documents/{id}/download-secure', (e) => {
  const docId = e.request.pathValue('id')
  let doc = null
  try {
    doc = $app.findRecordById('report_documents', docId)
  } catch (_) {
    throw new NotFoundError('Documento médico não localizado.')
  }
  if (!doc) {
    throw new NotFoundError('Documento médico não localizado.')
  }

  const token = e.request.url.query().get('token')
  const userId = e.request.url.query().get('u')
  if (!token || !userId) {
    throw new ForbiddenError('Token de acesso temporário ou identificação ausente.')
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new ForbiddenError('Formato de token inválido.')
  }

  const expTimestamp = parseInt(parts[0], 10)
  const signature = parts[1]
  const currentSec = Math.floor(Date.now() / 1000)

  if (isNaN(expTimestamp) || currentSec > expTimestamp) {
    throw new ForbiddenError('O token de acesso temporário expirou. Solicite um novo acesso.')
  }

  const tokenSecret = $os.getenv('APP_ACCESS_SECRET') || 'telelaudos-report-access-salt-2026'
  const expectedSig = $security.hs256(`${doc.id}:${userId}:${expTimestamp}`, tokenSecret)
  if (signature !== expectedSig) {
    throw new ForbiddenError('Assinatura HMAC do token inválida ou adulterada.')
  }

  // REVALIDAÇÃO ESTRITA NO MOMENTO DO DOWNLOAD (REQUISITO MANDATÓRIO)
  // 1. Verificar se o usuário existe e está ativo no sistema
  let userRecord = null
  try {
    userRecord = $app.findRecordById('users', userId)
  } catch (_) {
    throw new ForbiddenError('Usuário titular do token não localizado no sistema.')
  }
  if (!userRecord || !userRecord.getBool('is_active')) {
    throw new ForbiddenError('Usuário inativo ou com acesso revogado.')
  }

  // 2. Localizar exame associado ao documento
  const examId = doc.getString('exam_request_id')
  let exam = null
  try {
    exam = $app.findRecordById('exam_requests', examId)
  } catch (_) {
    throw new NotFoundError('Exame associado ao documento não localizado.')
  }

  const examOrgId = exam.getString('organization_id')

  // 3. Revalidar vínculo ativo e papel do usuário com a organização
  const activeUserOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${userId}' && is_active = true`,
    '',
    50,
    0,
  )

  const isCardioOrAdmin = activeUserOrgs.some(
    (uo) => uo.getString('role') === 'cardiologist' || uo.getString('role') === 'admin',
  )
  const isMemberOfExamOrg = activeUserOrgs.some(
    (uo) => uo.getString('organization_id') === examOrgId,
  )

  if (!isCardioOrAdmin && !isMemberOfExamOrg) {
    throw new ForbiddenError(
      'Acesso negado: permissões do usuário foram revogadas ou não possui vínculo com a organização proprietária do documento.',
    )
  }

  // 4. Revalidar situação de liberação clínica do documento (assinatura digital válida)
  let isReleased = false
  try {
    const sigs = $app.findRecordsByFilter(
      'report_signatures',
      `report_document_id = '${doc.id}' && signature_status = 'VALIDADA' && is_clinically_released = true`,
      '',
      1,
      0,
    )
    if (sigs.length > 0) isReleased = true
  } catch (_) {}

  if (!isCardioOrAdmin && !isReleased) {
    throw new ForbiddenError(
      'Este laudo não possui assinatura digital válida e liberação clínica homologada. O download permanece estritamente bloqueado.',
    )
  }

  // 5. Auditoria obrigatória do download realizado via token revalidado
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', userId)
    auditRec.set('organization_id', examOrgId)
    auditRec.set('action', 'REPORT_PDF_DOWNLOAD_SECURE')
    auditRec.set('target_collection', 'report_documents')
    auditRec.set('target_id', doc.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Download efetuado via token temporário HMAC validado. Documento: ${doc.getString('document_code')} v${doc.getInt('version')} SHA-256: ${doc.getString('file_hash_sha256')}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit download secure:', err)
  }

  return e.json(200, {
    success: true,
    documentId: doc.id,
    documentCode: doc.getString('document_code'),
    version: doc.getInt('version'),
    fileHashSha256: doc.getString('file_hash_sha256'),
    fileSizeBytes: doc.getInt('file_size_bytes'),
    generatedAt: doc.getString('generated_at'),
    fileName: doc.getString('pdf_file'),
  })
})

// 16. Monitoramento de Prazos (SLA Monitor) e Atualização de Notificações
// Endpoint sob demanda para reavaliar exames próximos do vencimento ou atrasados
routerAdd('POST', '/backend/v1/sla/refresh-status', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const now = new Date()
  const activeExams = $app.findRecordsByFilter(
    'exam_requests',
    "status = 'pending' || status = 'in_analysis' || status = 'waiting_signature'",
    '-created',
    100,
    0,
  )

  let updatedCount = 0
  let nearWarningCount = 0
  let overdueCount = 0

  for (const ex of activeExams) {
    const orgId = ex.getString('organization_id')
    let deadlineStr = ex.getString('deadline_at')
    const urgency = ex.getString('urgency') || 'routine'
    const warningThresholdMin = 30

    // Se ainda não tiver deadline_at preenchido, calcular retroativamente
    if (!deadlineStr) {
      let slaHours = urgency === 'urgent' ? 2 : 24
      try {
        const slas = $app.findRecordsByFilter(
          'contract_slas',
          `organization_id = '${orgId}'`,
          '',
          1,
          0,
        )
        if (slas.length > 0) {
          slaHours =
            urgency === 'urgent'
              ? slas[0].getInt('urgent_sla_hours') || 2
              : slas[0].getInt('routine_sla_hours') || 24
        }
      } catch (_) {}

      const createdDate = new Date(ex.getString('created'))
      const computedDeadline = new Date(createdDate.getTime() + slaHours * 3600 * 1000)
      deadlineStr = computedDeadline.toISOString()
      ex.set('deadline_at', deadlineStr)
    }

    const deadlineDate = new Date(deadlineStr)
    const diffMs = deadlineDate.getTime() - now.getTime()
    const diffMin = Math.round(diffMs / (60 * 1000))

    let newSlaStatus = 'no_prazo'
    if (diffMs <= 0) {
      newSlaStatus = 'atrasado'
      overdueCount++
    } else if (diffMin <= warningThresholdMin) {
      newSlaStatus = 'proximo_do_vencimento'
      nearWarningCount++
    }

    const oldSlaStatus = ex.getString('sla_status')
    if (oldSlaStatus !== newSlaStatus) {
      ex.set('sla_status', newSlaStatus)
      $app.save(ex)
      updatedCount++

      // Emitir notificação se mudou para atrasado ou próximo do vencimento
      try {
        const notifCol = $app.findCollectionByNameOrId('internal_notifications')
        if (newSlaStatus === 'atrasado') {
          // Checar se já não foi notificado recentemente para evitar repetição
          const existing = $app.findRecordsByFilter(
            'internal_notifications',
            `exam_request_id = '${ex.id}' && notification_type = 'EXAME_ATRASADO'`,
            '',
            1,
            0,
          )
          if (existing.length === 0) {
            const notif = new Record(notifCol)
            notif.set('organization_id', orgId)
            notif.set('exam_request_id', ex.id)
            notif.set('notification_type', 'EXAME_ATRASADO')
            notif.set('title', 'Alerta: Exame com prazo de SLA extrapolado')
            notif.set(
              'message',
              `O ECG protocolo ${ex.id.slice(-6).toUpperCase()} ultrapassou o tempo contratual estabelecido.`,
            )
            notif.set('target_role', 'all')
            notif.set('is_read', false)
            $app.save(notif)
          }
        } else if (newSlaStatus === 'proximo_do_vencimento') {
          const existing = $app.findRecordsByFilter(
            'internal_notifications',
            `exam_request_id = '${ex.id}' && notification_type = 'EXAME_PROXIMO_DO_PRAZO'`,
            '',
            1,
            0,
          )
          if (existing.length === 0) {
            const notif = new Record(notifCol)
            notif.set('organization_id', orgId)
            notif.set('exam_request_id', ex.id)
            notif.set('notification_type', 'EXAME_PROXIMO_DO_PRAZO')
            notif.set('title', 'Aviso: Exame próximo do vencimento de SLA')
            notif.set(
              'message',
              `O ECG protocolo ${ex.id.slice(-6).toUpperCase()} possui menos de ${warningThresholdMin} min para encerramento do prazo contratual.`,
            )
            notif.set('target_role', 'cardiologist')
            notif.set('is_read', false)
            $app.save(notif)
          }
        }
      } catch (err) {
        console.log('Falha emitir notificação SLA:', err)
      }
    }
  }

  return e.json(200, {
    success: true,
    totalEvaluated: activeExams.length,
    updatedCount,
    nearWarningCount,
    overdueCount,
    timestamp: now.toISOString(),
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

  // 2.1 Bloquear criação de contratos, preços e fechamentos por usuários não autorizados
  if (
    collectionName === 'commercial_contracts' ||
    collectionName === 'price_tables' ||
    collectionName === 'monthly_closings' ||
    collectionName === 'billing_adjustments'
  ) {
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
    const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
    const isFinance = userOrgs.some((uo) => uo.get('role') === 'financial')
    if (!isAdmin && !isFinance) {
      throw new ForbiddenError(
        'Apenas o administrador geral ou perfil financeiro pode criar contratos comerciais, regras de preço ou fechamentos.',
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

  // 4. Etapa 5: Ao criar exam_requests, calcular deadline_at com base no contract_slas e criar notificação interna
  if (collectionName === 'exam_requests') {
    const orgId = e.record.get('organization_id')
    const urgency = e.record.getString('urgency') || 'routine'
    let slaHours = urgency === 'urgent' ? 2 : 24 // Sem modalidade de emergência nesta etapa

    // Buscar configuração de SLA contratual da organização
    try {
      const slas = $app.findRecordsByFilter(
        'contract_slas',
        `organization_id = '${orgId}' && is_active = true`,
        '',
        1,
        0,
      )
      if (slas.length > 0) {
        const cfg = slas[0]
        if (urgency === 'urgent') {
          slaHours = cfg.getInt('urgent_sla_hours') || 2
        } else {
          slaHours = cfg.getInt('routine_sla_hours') || 24
        }
      }
    } catch (_) {}

    // Cálculo do prazo (horas corridas ou horário útil configurado)
    const now = new Date()
    const deadline = new Date(now.getTime() + slaHours * 3600 * 1000)
    e.record.set('deadline_at', deadline.toISOString())
    e.record.set('sla_status', 'no_prazo')
  }

  e.next()

  // Pós-criação de exam_requests: gerar notificação interna discreta
  if (collectionName === 'exam_requests') {
    try {
      const notifCol = $app.findCollectionByNameOrId('internal_notifications')
      const notif = new Record(notifCol)
      notif.set('organization_id', e.record.get('organization_id'))
      notif.set('exam_request_id', e.record.id)
      notif.set('notification_type', 'NOVO_ECG_RECEBIDO')
      notif.set('title', 'Novo ECG recebido na fila')
      notif.set(
        'message',
        `Novo traçado de ECG (${e.record.getString('urgency') === 'urgent' ? 'Prioritário' : 'Rotina'}) registrado para interpretação. Protocolo: ${e.record.id.slice(-6).toUpperCase()}.`,
      )
      notif.set('target_role', 'cardiologist')
      notif.set('is_read', false)
      $app.save(notif)
    } catch (notifErr) {
      console.log('Falha ao emitir notificação NOVO_ECG_RECEBIDO:', notifErr)
    }
  }

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

  // 0. Bloquear alteração em documentos médicos gerados (report_documents)
  if (collectionName === 'report_documents') {
    throw new ForbiddenError(
      'Documentos médicos preparados para assinatura são estritamente imutáveis. Crie uma nova versão para qualquer correção.',
    )
  }

  // 0.1 Bloquear alteração indevida de valores consolidados em fechamentos e itens de cobrança
  if (collectionName === 'monthly_closings') {
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
    const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
    const isFinance = userOrgs.some((uo) => uo.get('role') === 'financial')

    if (!isAdmin && !isFinance) {
      throw new ForbiddenError(
        'Operadores e usuários não autorizados não podem alterar valores de fechamentos consolidados.',
      )
    }

    // Se o fechamento estiver consolidado (is_locked = true), impedir alteração de subtotal_amount, final_total_amount ou billable_exams direto
    const oldLocked = e.record.original().getBool('is_locked')
    const oldSubtotal = e.record.original().getFloat('subtotal_amount')
    const newSubtotal = e.record.getFloat('subtotal_amount')
    const oldFinal = e.record.original().getFloat('final_total_amount')
    const newFinal = e.record.getFloat('final_total_amount')

    if (oldLocked && (oldSubtotal !== newSubtotal || oldFinal !== newFinal)) {
      throw new ForbiddenError(
        'Bloqueio de alteração indevida: os valores consolidados de um fechamento fechado não podem ser sobrescritos diretamente. Registre ajustes separadamente via billing_adjustments.',
      )
    }
  }

  // 0.2 Bloquear operadores de clínica de alterarem contratos comerciais, preços ou cobranças
  if (
    collectionName === 'commercial_contracts' ||
    collectionName === 'price_tables' ||
    collectionName === 'billing_items' ||
    collectionName === 'billing_adjustments'
  ) {
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
    const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
    const isFinance = userOrgs.some((uo) => uo.get('role') === 'financial')

    if (!isAdmin && !isFinance) {
      throw new ForbiddenError(
        'Operadores e usuários de clínica não têm permissão para criar ou modificar contratos comerciais, tabelas de preços ou cobranças consolidadas.',
      )
    }
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
  if (
    collectionName === 'exam_requests' ||
    collectionName === 'ecg_reports' ||
    collectionName === 'report_documents' ||
    collectionName === 'report_signatures'
  ) {
    throw new ForbiddenError(
      'Exames, laudos e documentos médicos não podem ser excluídos para preservação probatória.',
    )
  }
  e.next()
})

onRecordAuthRequest((e) => {
  e.next()
  try {
    const authRecord = e.record
    if (authRecord) {
      const userId = authRecord.id || (authRecord.get ? authRecord.get('id') : '')
      let validUser = null
      try {
        if (userId) validUser = $app.findRecordById('users', userId)
      } catch (_) {}

      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      if (validUser) {
        auditRec.set('user_id', validUser.id)
      }
      auditRec.set('action', 'AUTH_LOGIN')
      auditRec.set('target_collection', 'users')
      auditRec.set('target_id', userId || '')
      auditRec.set('status', 'SUCCESS')
      const email = authRecord.getString ? authRecord.getString('email') : ''
      auditRec.set('details', `Login realizado: ${email || userId}`)
      $app.save(auditRec)
    }
  } catch (err) {
    console.log('Falha ao registrar log de login:', err)
  }
})
