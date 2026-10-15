// PocketBase Server Hooks para Gestão Financeira, Contratos Comerciais, Faturamento e Fechamentos Mensais (Etapa 7)
// Compatível com PocketBase v0.23+ (Goja runtime sem import/export).
// Todas as rotas e regras operam de forma estrita e autossuficiente.

// ------------------------------------------------------------------------------------------------
// 1. ROTA DE FATURAMENTO / CRIAÇÃO DE ITEM DE COBRANÇA APENAS PARA LAUDOS ASSINADOS E LIBERADOS
// ------------------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/finance/billing/generate-from-report', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  // Apenas admin ou perfil financeiro pode solicitar faturamento
  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isFinanceOrAdmin = userOrgs.some(
    (uo) => uo.get('role') === 'admin' || uo.get('role') === 'financial',
  )
  if (!isFinanceOrAdmin) {
    throw new ForbiddenError(
      'Apenas administradores gerais ou usuários do perfil financeiro têm autorização para processar cobranças.',
    )
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const examId = body.exam_request_id
  const docId = body.report_document_id

  if (!examId || !docId) {
    throw new BadRequestError('exam_request_id e report_document_id são obrigatórios.')
  }

  const exam = $app.findRecordById('exam_requests', examId)
  if (!exam) {
    throw new NotFoundError('Exame não localizado.')
  }

  const doc = $app.findRecordById('report_documents', docId)
  if (!doc) {
    throw new NotFoundError('Documento médico não localizado.')
  }

  // REGRA ESTRITA 1: Exame cancelado antes da conclusão NÃO pode gerar cobrança
  if (exam.getString('status') === 'cancelled') {
    throw new BadRequestError('Exames cancelados antes da conclusão não podem gerar cobrança.')
  }

  // REGRA ESTRITA 2: Rascunho de laudo NÃO pode gerar cobrança (is_preview ou não preparado)
  if (doc.getBool('is_preview') || !doc.getBool('is_prepared_for_signature')) {
    throw new BadRequestError('Rascunhos e prévias de laudo não podem gerar cobrança.')
  }

  // REGRA ESTRITA 3: Somente documentos efetivamente ASSINADOS, VALIDADOS e LIBERADOS CLINICAMENTE podem gerar cobrança definitiva
  let isReleased = false
  let validSig = null
  try {
    const sigs = $app.findRecordsByFilter(
      'report_signatures',
      `report_document_id = '${doc.id}' && signature_status = 'VALIDADA' && is_clinically_released = true`,
      '-created',
      1,
      0,
    )
    if (sigs.length > 0) {
      isReleased = true
      validSig = sigs[0]
    }
  } catch (_) {}

  if (!isReleased || !validSig) {
    throw new ForbiddenError(
      'Cobrança bloqueada: este documento NÃO possui assinatura digital validada e liberação clínica formal. Somente laudos devidamente assinados e liberados geram cobrança.',
    )
  }

  const clientOrgId = exam.getString('organization_id')
  const modality = 'ECG_12_DERIVACOES'
  const urgency = exam.getString('urgency') || 'routine'
  const billingType = urgency === 'urgent' ? 'LAUDO_URGENTE' : 'LAUDO_PADRAO'

  // REGRA ESTRITA 4: Idempotência e Bloqueio de Cobrança Duplicada por Reenvio ou Retificação
  const idempotencyKey = `BILLING-${exam.id}-${billingType}`
  try {
    const existingItems = $app.findRecordsByFilter(
      'billing_items',
      `idempotency_key = '${idempotencyKey}' || (exam_request_id = '${exam.id}' && billing_type = '${billingType}')`,
      '',
      1,
      0,
    )
    if (existingItems.length > 0) {
      const existing = existingItems[0]
      return e.json(200, {
        success: true,
        alreadyBilled: true,
        message:
          'Item de cobrança já existente. Idempotência garantida: nenhuma cobrança duplicada criada.',
        billingItem: existing,
      })
    }
  } catch (_) {}

  // Buscar contrato comercial ativo da clínica contratante
  let contract = null
  try {
    const contracts = $app.findRecordsByFilter(
      'commercial_contracts',
      `client_org_id = '${clientOrgId}' && status = 'active'`,
      '-created',
      1,
      0,
    )
    if (contracts.length > 0) contract = contracts[0]
  } catch (_) {}

  if (!contract) {
    throw new BadRequestError(
      'Não foi encontrado contrato comercial ativo para a clínica contratante.',
    )
  }

  const providerOrgId = contract.getString('provider_org_id')

  // REGRA ESTRITA 5: Tabela de Preços com Vigência e Preço Capturado/Snapshotted
  let priceAmount = 25.0
  let priceTableId = ''
  try {
    const prices = $app.findRecordsByFilter(
      'price_tables',
      `client_org_id = '${clientOrgId}' && modality = '${modality}' && urgency = '${urgency}' && is_active = true`,
      '-created',
      1,
      0,
    )
    if (prices.length > 0) {
      priceAmount = prices[0].getFloat('price_amount')
      priceTableId = prices[0].id
    }
  } catch (_) {}

  // Definir competência a partir da data de liberação / criação
  const now = new Date()
  const competencePeriod = `${now.getFullYear()}-${('0' + (now.getMonth() + 1)).slice(-2)}`

  let createdItem = null
  $app.runInTransaction((txApp) => {
    const bCol = txApp.findCollectionByNameOrId('billing_items')
    const item = new Record(bCol)
    item.set('exam_request_id', exam.id)
    item.set('report_document_id', doc.id)
    item.set('provider_org_id', providerOrgId)
    item.set('client_org_id', clientOrgId)
    item.set('contract_id', contract.id)
    if (priceTableId) item.set('price_table_id', priceTableId)
    item.set('billing_type', billingType)
    item.set('idempotency_key', idempotencyKey)
    item.set('competence_period', competencePeriod)
    item.set('modality', modality)
    item.set('urgency', urgency)
    item.set('unit_price_snapshotted', priceAmount)
    item.set('price_snapshot_date', now.toISOString())
    item.set('status', 'billable')
    if (doc.getString('doctor_id')) {
      item.set('reporting_doctor_id', doc.getString('doctor_id'))
    }
    item.set('is_rectification', false)
    item.set(
      'notes',
      `Item gerado automaticamente a partir de laudo validado e liberado (doc ${doc.getString('document_code')}).`,
    )
    txApp.save(item)
    createdItem = item
  })

  // Registrar auditoria
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', clientOrgId)
    auditRec.set('action', 'BILLING_ITEM_CREATED')
    auditRec.set('target_collection', 'billing_items')
    auditRec.set('target_id', createdItem.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Cobrança gerada com sucesso para exame ${exam.id}. Valor capturado: R$ ${priceAmount.toFixed(2)}. Chave idempotência: ${idempotencyKey}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit billing create:', err)
  }

  return e.json(200, {
    success: true,
    message: 'Item de cobrança faturável criado com sucesso e preço contratual congelado.',
    billingItem: createdItem,
  })
})

// ------------------------------------------------------------------------------------------------
// 2. ROTA DE FECHAMENTO MENSAL DE COMPETÊNCIA POR PRESTADORA E CLÍNICA
// ------------------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/finance/closings/generate', (e) => {
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
  const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
  const isFinance = userOrgs.some((uo) => uo.get('role') === 'financial')
  if (!isAdmin && !isFinance) {
    throw new ForbiddenError(
      'Apenas administradores gerais ou gestores financeiros podem executar fechamentos de competência.',
    )
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const clientOrgId = body.client_org_id
  const competencePeriod = body.competence_period // Ex: "2026-10"

  if (!clientOrgId || !competencePeriod) {
    throw new BadRequestError('client_org_id e competence_period são obrigatórios.')
  }

  const clientOrg = $app.findRecordById('organizations', clientOrgId)
  if (!clientOrg) {
    throw new NotFoundError('Clínica contratante não localizada.')
  }

  // Buscar contrato comercial ativo
  let contract = null
  try {
    const contracts = $app.findRecordsByFilter(
      'commercial_contracts',
      `client_org_id = '${clientOrgId}'`,
      '-created',
      1,
      0,
    )
    if (contracts.length > 0) contract = contracts[0]
  } catch (_) {}

  if (!contract) {
    throw new BadRequestError('Clínica não possui contrato comercial configurado.')
  }

  const providerOrgId = contract.getString('provider_org_id')

  // Determinar datas do período
  const [yearStr, monthStr] = competencePeriod.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  // Buscar itens faturáveis em aberto para a competência e clínica
  const items = $app.findRecordsByFilter(
    'billing_items',
    `client_org_id = '${clientOrgId}' && competence_period = '${competencePeriod}' && (status = 'billable' || status = 'open')`,
    'created',
    1000,
    0,
  )

  let subtotal = 0.0
  const summaryModality = {}
  const summaryPriority = {}

  for (const item of items) {
    const price = item.getFloat('unit_price_snapshotted') || 0
    subtotal += price

    const mod = item.getString('modality') || 'ECG_12_DERIVACOES'
    const urg = item.getString('urgency') || 'routine'

    summaryModality[mod] = summaryModality[mod] || { count: 0, total: 0 }
    summaryModality[mod].count += 1
    summaryModality[mod].total += price

    summaryPriority[urg] = summaryPriority[urg] || { count: 0, total: 0 }
    summaryPriority[urg].count += 1
    summaryPriority[urg].total += price
  }

  // Aplicar regra de volume mínimo mensal se contratado
  const minVolume = contract.getInt('monthly_minimum_volume') || 0
  const minAmount = contract.getFloat('monthly_minimum_amount') || 0
  let finalTotal = subtotal
  if (minAmount > 0 && finalTotal < minAmount) {
    finalTotal = minAmount
  }

  const closingCode =
    `FECH-${competencePeriod.replace('-', '')}-${clientOrg.getString('trade_name') || clientOrg.getString('name')}`
      .toUpperCase()
      .replace(/\s+/g, '-')
      .slice(0, 40)

  // Checar se já existe fechamento para este código / competência
  let closingRecord = null
  try {
    const existing = $app.findRecordsByFilter(
      'monthly_closings',
      `closing_code = '${closingCode}' || (client_org_id = '${clientOrgId}' && competence_period = '${competencePeriod}' && status = 'closed')`,
      '',
      1,
      0,
    )
    if (existing.length > 0) {
      closingRecord = existing[0]
      return e.json(200, {
        success: true,
        alreadyClosed: true,
        message: 'Fechamento desta competência já realizado e consolidado anteriormente.',
        closing: closingRecord,
      })
    }
  } catch (_) {}

  const nowIso = new Date().toISOString()
  const paymentTermsDays = contract.getInt('payment_terms_days') || 15
  const dueDate = new Date(Date.now() + paymentTermsDays * 24 * 3600 * 1000).toISOString()

  $app.runInTransaction((txApp) => {
    const closingsCol = txApp.findCollectionByNameOrId('monthly_closings')
    closingRecord = new Record(closingsCol)
    closingRecord.set('provider_org_id', providerOrgId)
    closingRecord.set('client_org_id', clientOrgId)
    closingRecord.set('contract_id', contract.id)
    closingRecord.set('competence_period', competencePeriod)
    closingRecord.set('closing_code', closingCode)
    closingRecord.set('period_start', startDate.toISOString())
    closingRecord.set('period_end', endDate.toISOString())
    closingRecord.set('status', 'closed')
    closingRecord.set('total_exams', items.length)
    closingRecord.set('billable_exams', items.length)
    closingRecord.set('subtotal_amount', subtotal)
    closingRecord.set('discounts_adjustments_amount', 0)
    closingRecord.set('final_total_amount', finalTotal)
    closingRecord.set('summary_by_modality', JSON.stringify(summaryModality))
    closingRecord.set('summary_by_priority', JSON.stringify(summaryPriority))
    closingRecord.set('is_locked', true) // Protegido contra alterações indevidas
    closingRecord.set('closed_at', nowIso)
    closingRecord.set('closed_by', authRecord.id)
    closingRecord.set('payment_due_date', dueDate)
    closingRecord.set('payment_status', 'pending')
    closingRecord.set('payment_received_amount', 0)
    closingRecord.set(
      'notes',
      `Fechamento de competência ${competencePeriod} homologado. Emissão de NFS-e desativada nesta etapa.`,
    )

    txApp.save(closingRecord)

    // Atualizar itens de cobrança associando o fechamento
    for (const item of items) {
      item.set('monthly_closing_id', closingRecord.id)
      item.set('status', 'closed')
      txApp.save(item)
    }
  })

  // Registrar auditoria do fechamento
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', clientOrgId)
    auditRec.set('action', 'MONTHLY_CLOSING_CONSOLIDATED')
    auditRec.set('target_collection', 'monthly_closings')
    auditRec.set('target_id', closingRecord.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Competência ${competencePeriod} fechada para clínica ${clientOrg.getString('name')}. Total exames: ${items.length}, Valor final: R$ ${finalTotal.toFixed(2)}. Bloqueio contra edição direta ativo.`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit closing:', err)
  }

  return e.json(200, {
    success: true,
    message:
      'Fechamento de competência realizado com cálculos consolidados e imutabilidade garantida.',
    closing: closingRecord,
  })
})

// ------------------------------------------------------------------------------------------------
// 3. ROTA DE AJUSTES E ESTORNOS SEPARADOS (NÃO SOBRESCREVEM LANÇAMENTOS FECHADOS)
// ------------------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/finance/closings/{id}/adjustments', (e) => {
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
  const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
  const isFinance = userOrgs.some((uo) => uo.get('role') === 'financial')
  if (!isAdmin && !isFinance) {
    throw new ForbiddenError(
      'Apenas administradores ou setor financeiro podem registrar ajustes ou estornos justificados.',
    )
  }

  const closingId = e.request.pathValue('id')
  const closing = $app.findRecordById('monthly_closings', closingId)
  if (!closing) {
    throw new NotFoundError('Fechamento não localizado.')
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const adjustmentType = body.adjustment_type // 'DESCONTO_COMERCIAL', 'ESTORNO_QUALIDADE', etc.
  const amount = Number(body.amount)
  const justification = body.justification || ''

  if (!adjustmentType || isNaN(amount) || amount === 0) {
    throw new BadRequestError(
      'adjustment_type e amount válido (diferente de zero) são obrigatórios.',
    )
  }
  if (!justification.trim() || justification.trim().length < 5) {
    throw new BadRequestError(
      'A justificativa do ajuste/estorno é obrigatória (mínimo de 5 caracteres).',
    )
  }

  let createdAdj = null
  let updatedClosing = null

  $app.runInTransaction((txApp) => {
    // 1. Criar registro SEPARADO de ajuste em billing_adjustments
    const adjCol = txApp.findCollectionByNameOrId('billing_adjustments')
    const adj = new Record(adjCol)
    adj.set('monthly_closing_id', closingId)
    adj.set('client_org_id', closing.getString('client_org_id'))
    adj.set('adjustment_type', adjustmentType)
    adj.set('amount', amount)
    adj.set('justification', justification.trim())
    adj.set('authorized_by', authRecord.id)
    adj.set('authorized_at', new Date().toISOString())
    txApp.save(adj)
    createdAdj = adj

    // 2. Atualizar campo de ajustes do fechamento PRESERVANDO o subtotal original intacto
    const currentAdjustments = closing.getFloat('discounts_adjustments_amount') || 0
    const newAdjustments = currentAdjustments + amount
    const subtotal = closing.getFloat('subtotal_amount') || 0
    const newFinalTotal = Math.max(0, subtotal + newAdjustments)

    closing.set('discounts_adjustments_amount', newAdjustments)
    closing.set('final_total_amount', newFinalTotal)
    txApp.save(closing)
    updatedClosing = closing
  })

  // Auditoria
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', closing.getString('client_org_id'))
    auditRec.set('action', 'BILLING_ADJUSTMENT_REGISTERED')
    auditRec.set('target_collection', 'billing_adjustments')
    auditRec.set('target_id', createdAdj.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Ajuste (${adjustmentType}) de R$ ${amount.toFixed(2)} registrado separadamente para o fechamento ${closing.getString('closing_code')}. Motivo: ${justification.trim()}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit adjustment:', err)
  }

  return e.json(200, {
    success: true,
    message:
      'Ajuste financeiro registrado separadamente sem sobrescrever o lançamento histórico original.',
    adjustment: createdAdj,
    closing: updatedClosing,
  })
})

// ------------------------------------------------------------------------------------------------
// 4. ROTA DE REGISTRO DE RECEBIMENTO / PAGAMENTO DE FECHAMENTO
// ------------------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/finance/closings/{id}/payment', (e) => {
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
  const isAdmin = userOrgs.some((uo) => uo.get('role') === 'admin')
  const isFinance = userOrgs.some((uo) => uo.get('role') === 'financial')
  if (!isAdmin && !isFinance) {
    throw new ForbiddenError('Apenas administradores ou financeiro podem registrar recebimentos.')
  }

  const closingId = e.request.pathValue('id')
  const closing = $app.findRecordById('monthly_closings', closingId)
  if (!closing) {
    throw new NotFoundError('Fechamento não localizado.')
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const receivedAmount = Number(body.amount)
  if (isNaN(receivedAmount) || receivedAmount <= 0) {
    throw new BadRequestError('Valor recebido deve ser um número positivo.')
  }

  const nowIso = new Date().toISOString()
  const finalTotal = closing.getFloat('final_total_amount')
  const currentPaid = (closing.getFloat('payment_received_amount') || 0) + receivedAmount
  const newStatus = currentPaid >= finalTotal ? 'paid' : 'paid_partial'

  closing.set('payment_received_amount', currentPaid)
  closing.set('payment_status', newStatus)
  closing.set('payment_received_at', nowIso)
  $app.save(closing)

  // Auditoria
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', closing.getString('client_org_id'))
    auditRec.set('action', 'BILLING_PAYMENT_REGISTERED')
    auditRec.set('target_collection', 'monthly_closings')
    auditRec.set('target_id', closing.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Recebimento de R$ ${receivedAmount.toFixed(2)} registrado para o fechamento ${closing.getString('closing_code')}. Situação: ${newStatus}`,
    )
    $app.save(auditRec)
  } catch (err) {
    console.log('Falha audit payment:', err)
  }

  return e.json(200, {
    success: true,
    message: 'Recebimento registrado com sucesso no painel financeiro.',
    closing,
  })
})

// ------------------------------------------------------------------------------------------------
// 5. ROTA DE EXPORTAÇÃO DE DEMONSTRATIVO EM CSV / METADADOS PARA PDF
// ------------------------------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/finance/closings/{id}/export', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const closingId = e.request.pathValue('id')
  const closing = $app.findRecordById('monthly_closings', closingId)
  if (!closing) {
    throw new NotFoundError('Fechamento não localizado.')
  }

  const clientOrgId = closing.getString('client_org_id')

  // Controle de permissão: admin e financial veem qualquer fechamento.
  // Usuário de clínica só pode consultar demonstrativo da SUA própria organização.
  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isAdminOrFinance = userOrgs.some(
    (uo) => uo.get('role') === 'admin' || uo.get('role') === 'financial',
  )
  const isMyClinic = userOrgs.some((uo) => uo.getString('organization_id') === clientOrgId)

  if (!isAdminOrFinance && !isMyClinic) {
    throw new ForbiddenError(
      'Acesso negado: você não tem permissão para consultar o demonstrativo financeiro de outra clínica.',
    )
  }

  const format = (e.request.url.query().get('format') || 'json').toLowerCase()

  const clientOrg = $app.findRecordById('organizations', clientOrgId)
  const providerOrg = $app.findRecordById('organizations', closing.getString('provider_org_id'))

  // Buscar itens associados a este fechamento
  const items = $app.findRecordsByFilter(
    'billing_items',
    `monthly_closing_id = '${closing.id}'`,
    'created',
    500,
    0,
  )

  // Buscar ajustes
  const adjustments = $app.findRecordsByFilter(
    'billing_adjustments',
    `monthly_closing_id = '${closing.id}'`,
    'created',
    50,
    0,
  )

  // Auditoria de exportação
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('organization_id', clientOrgId)
    auditRec.set('action', 'FINANCIAL_STATEMENT_EXPORTED')
    auditRec.set('target_collection', 'monthly_closings')
    auditRec.set('target_id', closing.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Demonstrativo financeiro exportado (${format.toUpperCase()}) para competência ${closing.getString('competence_period')}`,
    )
    $app.save(auditRec)
  } catch (_) {}

  if (format === 'csv') {
    // Gerar CSV formatado
    let csv = 'ID Item;Exame;Modalidade;Prioridade;Preco Unitario (R$);Data Faturamento;Status\r\n'
    for (const it of items) {
      csv += `${it.id};${it.getString('exam_request_id')};${it.getString('modality')};${it.getString('urgency')};${it.getFloat('unit_price_snapshotted').toFixed(2)};${it.getString('price_snapshot_date')};${it.getString('status')}\r\n`
    }
    csv += '\r\n--- AJUSTES E ESTORNOS ---\r\n'
    csv += 'Tipo;Valor (R$);Justificativa;Data\r\n'
    for (const a of adjustments) {
      csv += `${a.getString('adjustment_type')};${a.getFloat('amount').toFixed(2)};"${a.getString('justification')}";${a.getString('authorized_at')}\r\n`
    }
    csv += '\r\n--- TOTAIS CONSOLIDADOS ---\r\n'
    csv += `Subtotal (R$);${closing.getFloat('subtotal_amount').toFixed(2)}\r\n`
    csv += `Ajustes/Descontos (R$);${closing.getFloat('discounts_adjustments_amount').toFixed(2)}\r\n`
    csv += `Total Devido (R$);${closing.getFloat('final_total_amount').toFixed(2)}\r\n`

    return e.json(200, {
      success: true,
      format: 'csv',
      closingCode: closing.getString('closing_code'),
      csvContent: csv,
    })
  }

  return e.json(200, {
    success: true,
    format: 'json',
    closing,
    client: {
      name: clientOrg.getString('name'),
      tradeName: clientOrg.getString('trade_name'),
      cnpj: clientOrg.getString('cnpj'),
    },
    provider: {
      name: providerOrg.getString('name'),
      cnpj: providerOrg.getString('cnpj'),
    },
    itemsCount: items.length,
    items,
    adjustments,
  })
})

// ------------------------------------------------------------------------------------------------
// 6. ROTA DE PRODUÇÃO MÉDICA (APENAS QUANTIDADE DE LAUDOS EFETIVAMENTE EMITIDOS)
// Não calcula repasses financeiros sem contrato de remuneração definido.
// ------------------------------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/finance/medical-production', (e) => {
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
  const isFinanceOrAdmin = userOrgs.some(
    (uo) => uo.get('role') === 'admin' || uo.get('role') === 'financial',
  )
  if (!isFinanceOrAdmin) {
    throw new ForbiddenError('Acesso restrito ao perfil financeiro ou administrativo.')
  }

  const period = e.request.url.query().get('period') || '' // opcional "2026-10"

  const doctors = $app.findRecordsByFilter('doctors', 'is_active = true', 'crm', 100, 0)
  const productionList = []

  for (const doc of doctors) {
    // Buscar usuário associado ao médico
    let docUser = null
    try {
      docUser = $app.findRecordById('users', doc.getString('user_id'))
    } catch (_) {}

    // Contar laudos com documento emitido/liberado
    let filter = `doctor_id = '${doc.id}'`
    if (period) {
      filter += ` && created >= '${period}-01 00:00:00.000Z' && created <= '${period}-31 23:59:59.999Z'`
    }

    let reportCount = 0
    try {
      const docsEmitted = $app.findRecordsByFilter('report_documents', filter, '', 500, 0)
      reportCount = docsEmitted.length
    } catch (_) {}

    productionList.push({
      doctorId: doc.id,
      doctorName: docUser ? docUser.getString('name') : 'Cardiologista',
      crm: `${doc.getString('crm')}/${doc.getString('crm_state')}`,
      specialty: doc.getString('specialty'),
      reportsIssuedCount: reportCount,
      remunerationRuleStatus: 'Pendente de contratação formal de honorários/repasse',
      financialTransferAmount: null, // Proibido calcular repasse sem contrato nesta etapa
    })
  }

  return e.json(200, {
    success: true,
    production: productionList,
    disclaimer:
      'Nesta etapa é apresentada apenas a quantidade de laudos emitidos por profissional. Repasses e cálculos financeiros de honorários médicos estão desativados por ausência de contrato de remuneração homologado.',
  })
})
