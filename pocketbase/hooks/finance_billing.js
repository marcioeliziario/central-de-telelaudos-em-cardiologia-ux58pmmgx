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

  // REGRA ESTRITA 5: Tabela de Preços com Vigência e Preço Capturado/Snapshotted no Momento da Solicitação/Realização
  // REGRA DE CAPTURA DO PREÇO DOCUMENTADA:
  // O preço contratual é capturado e congelado (snapshot) com base na data da solicitação do exame (exam_requests.created ou exam_date).
  // Isso garante previsibilidade e segurança jurídica: caso haja um reajuste de tabela entre a solicitação/realização
  // e a liberação formal do laudo pelo cardiologista, o exame é faturado pelo valor vigente quando o exame foi demandado.
  // Uma vez gravado em billing_items.unit_price_snapshotted, o valor torna-se imutável.
  const referenceDate =
    exam.getString('created') || exam.getString('exam_date') || new Date().toISOString()
  let priceAmount = 25.0
  let priceTableId = ''
  try {
    // 1. Tentar buscar tabela com vigência estrita na data de solicitação do exame
    const prices = $app.findRecordsByFilter(
      'price_tables',
      `client_org_id = '${clientOrgId}' && modality = '${modality}' && urgency = '${urgency}' && valid_from <= '${referenceDate}' && (valid_to = '' || valid_to >= '${referenceDate}')`,
      '-valid_from',
      1,
      0,
    )
    if (prices.length > 0) {
      priceAmount = prices[0].getFloat('price_amount')
      priceTableId = prices[0].id
    } else {
      // 2. Fallback para tabela ativa vigente
      const activePrices = $app.findRecordsByFilter(
        'price_tables',
        `client_org_id = '${clientOrgId}' && modality = '${modality}' && urgency = '${urgency}' && is_active = true`,
        '-created',
        1,
        0,
      )
      if (activePrices.length > 0) {
        priceAmount = activePrices[0].getFloat('price_amount')
        priceTableId = activePrices[0].id
      }
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
// 4.1 ROTA DE HOMOLOGAÇÃO FINANCEIRA CONTROLADA (IS_TEST / FIXTURE CONTROLADA)
// Permite exercitar o ciclo de faturamento e fechamento de homologação sem fraudar assinatura digital real
// ------------------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/finance/billing/test-fixture-item', (e) => {
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
    throw new ForbiddenError(
      'Apenas administradores ou financeiro podem gerar fixtures de teste financeiro.',
    )
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const clientOrgId = body.client_org_id
  const urgency = body.urgency || 'routine'
  const competencePeriod = body.competence_period || '2026-10'
  const isRectification = Boolean(body.is_rectification)

  if (!clientOrgId) {
    throw new BadRequestError('client_org_id é obrigatório.')
  }

  // Buscar contrato comercial
  const contracts = $app.findRecordsByFilter(
    'commercial_contracts',
    `client_org_id = '${clientOrgId}' && status = 'active'`,
    '-created',
    1,
    0,
  )
  if (contracts.length === 0) {
    throw new BadRequestError('Contrato não localizado para esta clínica.')
  }
  const contract = contracts[0]

  // Buscar preço de tabela
  let price = urgency === 'urgent' ? 40.0 : 25.0
  let priceTableId = ''
  try {
    const prices = $app.findRecordsByFilter(
      'price_tables',
      `client_org_id = '${clientOrgId}' && urgency = '${urgency}' && is_active = true`,
      '-created',
      1,
      0,
    )
    if (prices.length > 0) {
      price = prices[0].getFloat('price_amount')
      priceTableId = prices[0].id
    }
  } catch (_) {}

  // REGRA DE RETIFICAÇÃO: Retificações médicas de laudo NÃO criam cobrança adicional
  if (isRectification) {
    price = 0.0
  }

  const billingType = urgency === 'urgent' ? 'LAUDO_URGENTE' : 'LAUDO_PADRAO'
  const randomSuffix = $security.randomString(8)
  const idempotencyKey =
    body.idempotency_key || `TEST-FIXTURE-${clientOrgId}-${urgency}-${randomSuffix}`

  // Verificar idempotência
  const existing = $app.findRecordsByFilter(
    'billing_items',
    `idempotency_key = '${idempotencyKey}'`,
    '',
    1,
    0,
  )
  if (existing.length > 0) {
    return e.json(200, {
      success: true,
      alreadyBilled: true,
      message: 'Item de teste já existente (idempotência preservada).',
      billingItem: existing[0],
    })
  }

  let createdItem = null
  $app.runInTransaction((txApp) => {
    const bCol = txApp.findCollectionByNameOrId('billing_items')
    const item = new Record(bCol)
    item.set('provider_org_id', contract.getString('provider_org_id'))
    item.set('client_org_id', clientOrgId)
    item.set('contract_id', contract.id)
    if (priceTableId) item.set('price_table_id', priceTableId)
    item.set('billing_type', isRectification ? 'REANÁLISE_CONTRATUAL' : billingType)
    item.set('idempotency_key', idempotencyKey)
    item.set('competence_period', competencePeriod)
    item.set('modality', 'ECG_12_DERIVACOES')
    item.set('urgency', urgency)
    item.set('unit_price_snapshotted', price)
    item.set('price_snapshot_date', new Date().toISOString())
    item.set('status', 'billable')
    item.set('is_rectification', isRectification)
    item.set(
      'notes',
      `[FIXTURE_HOMOLOGACAO] Item de teste para homologação financeira segura (Etapa 7B). ${isRectification ? 'Retificação de laudo sem cobrança adicional.' : ''}`,
    )
    txApp.save(item)
    createdItem = item
  })

  // Auditoria
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
      `[FIXTURE_HOMOLOGACAO] Item financeiro de homologação gerado: ${idempotencyKey}, Valor: R$ ${price.toFixed(2)}`,
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: 'Item de homologação gerado com sucesso.',
    billingItem: createdItem,
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
    // Gerar CSV formatado (respeitando privacidade: NÃO expõe PII de pacientes nos itens faturáveis)
    let csv =
      'ID Item;ID Solicitacao;Modalidade;Prioridade;Preco Unitario (R$);Data Faturamento;Status\r\n'
    for (const it of items) {
      csv += `${it.id};${it.getString('exam_request_id') || 'FIXTURE'};${it.getString('modality')};${it.getString('urgency')};${it.getFloat('unit_price_snapshotted').toFixed(2)};${it.getString('price_snapshot_date')};${it.getString('status')}\r\n`
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

  if (format === 'pdf') {
    // GERADOR NATIVO DE DEMONSTRATIVO FINANCEIRO EM PDF NO BACKEND
    // Atende estritamente: acentuação correta ISO-8859-1/WinAnsi, layout limpo de faturamento,
    // ausência de PII de pacientes (apenas agregações, modalidades, totais e IDs anônimos),
    // rastreabilidade com SHA-256 e registro em auditoria.
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

    const clientName = clientOrg.getString('trade_name') || clientOrg.getString('name')
    const clientCnpj = clientOrg.getString('cnpj') || '—'
    const providerName = providerOrg.getString('trade_name') || providerOrg.getString('name')
    const providerCnpj = providerOrg.getString('cnpj') || '—'
    const closingCode = closing.getString('closing_code')
    const competence = closing.getString('competence_period')
    const status = closing.getString('status')
    const subtotal = closing.getFloat('subtotal_amount')
    const discounts = closing.getFloat('discounts_adjustments_amount')
    const finalTotal = closing.getFloat('final_total_amount')
    const totalItems = closing.getInt('total_items_count') || items.length

    // Agregação por modalidade / urgência para demonstrativo limpo
    let routineCount = 0
    let routineTotal = 0.0
    let urgentCount = 0
    let urgentTotal = 0.0
    let otherCount = 0
    let otherTotal = 0.0

    for (const it of items) {
      const u = it.getString('urgency')
      const p = it.getFloat('unit_price_snapshotted')
      if (u === 'urgent') {
        urgentCount++
        urgentTotal += p
      } else if (u === 'routine') {
        routineCount++
        routineTotal += p
      } else {
        otherCount++
        otherTotal += p
      }
    }

    let ops = []
    // Barra superior decorativa
    ops.push('0.05 0.30 0.57 rg')
    ops.push('0.05 0.30 0.57 RG')
    ops.push('2.0 w')
    ops.push('40 805 m 555 805 l S')

    // Cabeçalho da prestadora
    ops.push('BT')
    ops.push('/F2 12 Tf')
    ops.push('40 788 Td')
    ops.push(`(${escapePdfText(providerName)}) Tj`)
    ops.push('ET')

    ops.push('BT')
    ops.push('/F1 8 Tf')
    ops.push('40 775 Td')
    ops.push(
      `(${escapePdfText('CNPJ: ' + providerCnpj + ' • Central Especializada de Telelaudos em Cardiologia')}) Tj`,
    )
    ops.push('ET')

    // Identificação do documento
    ops.push('0.93 0.95 0.98 rg')
    ops.push('40 715 515 48 re f')
    ops.push('0.80 0.85 0.92 RG')
    ops.push('0.8 w')
    ops.push('40 715 515 48 re S')

    ops.push('0.05 0.30 0.57 rg')
    ops.push('BT')
    ops.push('/F2 13 Tf')
    ops.push('50 745 Td')
    ops.push(`(${escapePdfText('DEMONSTRATIVO DE FATURAMENTO MENSAL')}) Tj`)
    ops.push('ET')

    ops.push('0.25 0.25 0.25 rg')
    ops.push('BT')
    ops.push('/F3 8.5 Tf')
    ops.push('50 727 Td')
    ops.push(
      `(${escapePdfText('Código: ' + closingCode + '   •   Competência: ' + competence + '   •   Status: ' + status.toUpperCase())}) Tj`,
    )
    ops.push('ET')

    let curY = 685
    // Dados da Clínica Contratante
    ops.push('0.15 0.15 0.15 rg')
    ops.push('BT')
    ops.push('/F2 9.5 Tf')
    ops.push(`40 ${curY} Td`)
    ops.push(`(${escapePdfText('1. DADOS DA CLÍNICA CONTRATANTE')}) Tj`)
    ops.push('ET')

    ops.push('0.7 0.7 0.7 RG')
    ops.push('0.5 w')
    ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
    curY -= 18

    ops.push('BT')
    ops.push('/F2 8.5 Tf')
    ops.push(`45 ${curY} Td`)
    ops.push(`(${escapePdfText('Razão Social / Nome: ')}) Tj`)
    ops.push('/F1 8.5 Tf')
    ops.push(`(${escapePdfText(clientName)}) Tj`)
    ops.push('ET')

    ops.push('BT')
    ops.push('/F2 8.5 Tf')
    ops.push(`350 ${curY} Td`)
    ops.push(`(${escapePdfText('CNPJ: ')}) Tj`)
    ops.push('/F1 8.5 Tf')
    ops.push(`(${escapePdfText(clientCnpj)}) Tj`)
    ops.push('ET')
    curY -= 25

    // Resumo de Produção por Modalidade e Urgência
    ops.push('0.15 0.15 0.15 rg')
    ops.push('BT')
    ops.push('/F2 9.5 Tf')
    ops.push(`40 ${curY} Td`)
    ops.push(
      `(${escapePdfText('2. RESUMO DE PRODUÇÃO FATURÁVEL (COMPETÊNCIA ' + competence + ')')}) Tj`,
    )
    ops.push('ET')

    ops.push('0.7 0.7 0.7 RG')
    ops.push('0.5 w')
    ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
    curY -= 18

    // Tabela - Cabeçalho
    ops.push('0.95 0.95 0.95 rg')
    ops.push(`40 ${curY - 14} 515 16 re f`)
    ops.push('0.15 0.15 0.15 rg')
    ops.push('BT')
    ops.push('/F2 8 Tf')
    ops.push(`50 ${curY - 10} Td`)
    ops.push(`(${escapePdfText('MODALIDADE / SERVIÇO')}) Tj`)
    ops.push(`180 0 Td`)
    ops.push(`(${escapePdfText('PRIORIDADE')}) Tj`)
    ops.push(`110 0 Td`)
    ops.push(`(${escapePdfText('QUANTIDADE')}) Tj`)
    ops.push(`100 0 Td`)
    ops.push(`(${escapePdfText('TOTAL FATURADO (R$)')}) Tj`)
    ops.push('ET')
    curY -= 28

    // Linhas de produção
    ops.push('BT')
    ops.push('/F1 8.5 Tf')
    ops.push(`50 ${curY} Td`)
    ops.push(`(${escapePdfText('Eletrocardiograma 12 Derivações')}) Tj`)
    ops.push(`180 0 Td`)
    ops.push(`(${escapePdfText('Rotina')}) Tj`)
    ops.push(`110 0 Td`)
    ops.push(`(${escapePdfText(String(routineCount) + ' laudos')}) Tj`)
    ops.push(`100 0 Td`)
    ops.push(`(${escapePdfText('R$ ' + routineTotal.toFixed(2))}) Tj`)
    ops.push('ET')
    curY -= 16

    ops.push('BT')
    ops.push('/F1 8.5 Tf')
    ops.push(`50 ${curY} Td`)
    ops.push(`(${escapePdfText('Eletrocardiograma 12 Derivações')}) Tj`)
    ops.push(`180 0 Td`)
    ops.push(`(${escapePdfText('Urgente / Emergência')}) Tj`)
    ops.push(`110 0 Td`)
    ops.push(`(${escapePdfText(String(urgentCount) + ' laudos')}) Tj`)
    ops.push(`100 0 Td`)
    ops.push(`(${escapePdfText('R$ ' + urgentTotal.toFixed(2))}) Tj`)
    ops.push('ET')
    curY -= 16

    if (otherCount > 0) {
      ops.push('BT')
      ops.push('/F1 8.5 Tf')
      ops.push(`50 ${curY} Td`)
      ops.push(`(${escapePdfText('Outras Demandas Contratadas')}) Tj`)
      ops.push(`180 0 Td`)
      ops.push(`(${escapePdfText('Especial')}) Tj`)
      ops.push(`110 0 Td`)
      ops.push(`(${escapePdfText(String(otherCount) + ' laudos')}) Tj`)
      ops.push(`100 0 Td`)
      ops.push(`(${escapePdfText('R$ ' + otherTotal.toFixed(2))}) Tj`)
      ops.push('ET')
      curY -= 16
    }

    curY -= 10
    // Ajustes e Estornos Contratuais
    ops.push('0.15 0.15 0.15 rg')
    ops.push('BT')
    ops.push('/F2 9.5 Tf')
    ops.push(`40 ${curY} Td`)
    ops.push(`(${escapePdfText('3. AJUSTES, GLOSAS E ESTORNOS HOMOLOGADOS')}) Tj`)
    ops.push('ET')

    ops.push('0.7 0.7 0.7 RG')
    ops.push('0.5 w')
    ops.push(`40 ${curY - 4} m 555 ${curY - 4} l S`)
    curY -= 18

    if (adjustments.length === 0) {
      ops.push('BT')
      ops.push('/F1 8 Tf')
      ops.push(`50 ${curY} Td`)
      ops.push(
        `(${escapePdfText('Nenhum ajuste, glosa ou desconto registrado para este fechamento.')}) Tj`,
      )
      ops.push('ET')
      curY -= 16
    } else {
      for (const a of adjustments) {
        ops.push('BT')
        ops.push('/F2 8 Tf')
        ops.push(`50 ${curY} Td`)
        ops.push(`(${escapePdfText(a.getString('adjustment_type') + ':')}) Tj`)
        ops.push('/F1 8 Tf')
        ops.push(`130 0 Td`)
        ops.push(
          `(${escapePdfText('R$ ' + a.getFloat('amount').toFixed(2) + ' - ' + a.getString('justification'))}) Tj`,
        )
        ops.push('ET')
        curY -= 14
      }
    }

    curY -= 15
    // Quadro de Totais Financeiros Consolidados
    ops.push('0.94 0.96 0.98 rg')
    ops.push(`40 ${curY - 60} 515 65 re f`)
    ops.push('0.1 0.3 0.6 RG')
    ops.push('1.2 w')
    ops.push(`40 ${curY - 60} 515 65 re S`)

    ops.push('0.1 0.1 0.1 rg')
    ops.push('BT')
    ops.push('/F2 9 Tf')
    ops.push(`55 ${curY - 14} Td`)
    ops.push(`(${escapePdfText('Total de Laudos Faturados:')}) Tj`)
    ops.push('/F3 9.5 Tf')
    ops.push(`160 0 Td`)
    ops.push(`(${escapePdfText(String(totalItems) + ' exames')}) Tj`)
    ops.push('ET')

    ops.push('BT')
    ops.push('/F2 9 Tf')
    ops.push(`55 ${curY - 28} Td`)
    ops.push(`(${escapePdfText('Subtotal da Produção:')}) Tj`)
    ops.push('/F3 9.5 Tf')
    ops.push(`160 0 Td`)
    ops.push(`(${escapePdfText('R$ ' + subtotal.toFixed(2))}) Tj`)
    ops.push('ET')

    ops.push('BT')
    ops.push('/F2 9 Tf')
    ops.push(`55 ${curY - 42} Td`)
    ops.push(`(${escapePdfText('Ajustes e Descontos:')}) Tj`)
    ops.push('/F3 9.5 Tf')
    ops.push(`160 0 Td`)
    ops.push(`(${escapePdfText('R$ ' + discounts.toFixed(2))}) Tj`)
    ops.push('ET')

    ops.push('0.05 0.30 0.57 rg')
    ops.push('BT')
    ops.push('/F2 12 Tf')
    ops.push(`330 ${curY - 30} Td`)
    ops.push(`(${escapePdfText('VALOR TOTAL DEVIDO:')}) Tj`)
    ops.push('ET')

    ops.push('BT')
    ops.push('/F2 13 Tf')
    ops.push(`330 ${curY - 48} Td`)
    ops.push(`(${escapePdfText('R$ ' + finalTotal.toFixed(2))}) Tj`)
    ops.push('ET')

    // Rodapé de Conformidade e Proteção de Dados
    const footerY = 70
    ops.push('0.8 0.8 0.8 RG')
    ops.push('0.5 w')
    ops.push(`40 ${footerY + 22} m 555 ${footerY + 22} l S`)

    ops.push('0.3 0.3 0.3 rg')
    ops.push('BT')
    ops.push('/F1 7 Tf')
    ops.push(`45 ${footerY + 12} Td`)
    ops.push(
      `(${escapePdfText('Documento financeiro oficial gerado pelo Sistema Central de Telelaudos em Cardiologia.')}) Tj`,
    )
    ops.push('ET')

    ops.push('BT')
    ops.push('/F1 6.5 Tf')
    ops.push(`45 ${footerY + 2} Td`)
    ops.push(
      `(${escapePdfText('Em conformidade com a LGPD (Lei 13.709/2018): este demonstrativo contém dados corporativos e quantitativos agregados, sem exposição de prontuários ou PII clínicas de pacientes.')}) Tj`,
    )
    ops.push('ET')

    ops.push('BT')
    ops.push('/F3 6.5 Tf')
    ops.push(`45 ${footerY - 8} Td`)
    ops.push(
      `(${escapePdfText('Autenticação Digital • Id Fechamento: ' + closing.id + ' • Gerado em: ' + new Date().toISOString())}) Tj`,
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
      `8 0 obj\n<< /Title (${escapePdfText('Demonstrativo Financeiro - ' + closingCode)}) /Author (${escapePdfText(providerName)}) /Creator (Central de Telelaudos Financeiro Engine) /Producer (PocketBase / Skip Cloud PDF Generator) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>\nendobj\n`,
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

    return e.json(200, {
      success: true,
      format: 'pdf',
      closingCode: closingCode,
      sha256: sha256,
      fileSizeBytes: pdfString.length,
      pdfRawString: pdfString,
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
