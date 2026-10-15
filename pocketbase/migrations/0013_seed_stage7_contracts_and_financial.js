migrate(
  (app) => {
    // 1. Criar ou Obter Usuário com Perfil Financeiro Fictício
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const userOrgsCol = app.findCollectionByNameOrId('user_organizations')
    const orgsCol = app.findCollectionByNameOrId('organizations')
    const slasCol = app.findCollectionByNameOrId('contract_slas')
    const contractsCol = app.findCollectionByNameOrId('commercial_contracts')
    const pricesCol = app.findCollectionByNameOrId('price_tables')
    const closingsCol = app.findCollectionByNameOrId('monthly_closings')
    const billingCol = app.findCollectionByNameOrId('billing_items')
    const adjCol = app.findCollectionByNameOrId('billing_adjustments')
    const examsCol = app.findCollectionByNameOrId('exam_requests')
    const docsCol = app.findCollectionByNameOrId('report_documents')
    const doctorsCol = app.findCollectionByNameOrId('doctors')

    let userFinanceiro
    try {
      userFinanceiro = app.findAuthRecordByEmail('_pb_users_auth_', 'financeiro@cardiolab.fake')
    } catch (_) {
      userFinanceiro = new Record(usersCol)
      userFinanceiro.setEmail('financeiro@cardiolab.fake')
      userFinanceiro.setPassword('Skip@Pass')
      userFinanceiro.setVerified(true)
      userFinanceiro.set('name', 'Ana Lúcia Financeiro')
      userFinanceiro.set('is_active', true)
      app.save(userFinanceiro)
    }

    // Buscar organizações
    let providerOrg = null
    let alfaOrg = null
    let betaOrg = null
    try {
      providerOrg = app.findFirstRecordByData('organizations', 'cnpj', '11.111.111/0001-11')
      alfaOrg = app.findFirstRecordByData('organizations', 'cnpj', '22.222.222/0001-22')
      betaOrg = app.findFirstRecordByData('organizations', 'cnpj', '33.333.333/0001-33')
    } catch (e) {
      console.log('Orgs não localizadas para seed financeiro:', e)
      return
    }

    // Vincular usuário financeiro à prestadora com role 'financial'
    try {
      const existingUo = app.findRecordsByFilter(
        'user_organizations',
        `user_id = '${userFinanceiro.id}' && organization_id = '${providerOrg.id}'`,
        '',
        1,
        0,
      )
      if (existingUo.length === 0) {
        const uo = new Record(userOrgsCol)
        uo.set('user_id', userFinanceiro.id)
        uo.set('organization_id', providerOrg.id)
        uo.set('role', 'financial')
        uo.set('is_active', true)
        uo.set('title_position', 'Analista Financeiro Pleno')
        app.save(uo)
      }
    } catch (_) {}

    // Buscar contract_slas existentes para relacionar aos contratos comerciais
    let slaAlfa = null
    let slaBeta = null
    try {
      const slasA = app.findRecordsByFilter(
        'contract_slas',
        `organization_id = '${alfaOrg.id}'`,
        '',
        1,
        0,
      )
      if (slasA.length > 0) slaAlfa = slasA[0]
      const slasB = app.findRecordsByFilter(
        'contract_slas',
        `organization_id = '${betaOrg.id}'`,
        '',
        1,
        0,
      )
      if (slasB.length > 0) slaBeta = slasB[0]
    } catch (_) {}

    // 2. Criar Contrato Comercial - Clínica Alfa (Contrato CTR-2026-ALFA)
    let contractAlfa = null
    try {
      const existing = app.findRecordsByFilter(
        'commercial_contracts',
        "contract_number = 'CTR-2026-ALFA'",
        '',
        1,
        0,
      )
      if (existing.length > 0) {
        contractAlfa = existing[0]
      } else {
        const c = new Record(contractsCol)
        c.set('provider_org_id', providerOrg.id)
        c.set('client_org_id', alfaOrg.id)
        if (slaAlfa) c.set('contract_sla_id', slaAlfa.id)
        c.set('contract_number', 'CTR-2026-ALFA')
        c.set('start_date', '2026-01-01 00:00:00.000Z')
        c.set('end_date', '2026-12-31 23:59:59.000Z')
        c.set('status', 'active')
        c.set('modalities', JSON.stringify(['ECG_12_DERIVACOES']))
        c.set('closing_day', 30) // Fechamento no último dia do mês
        c.set('payment_terms_days', 15) // Vencimento 15 dias após fechamento
        c.set('monthly_minimum_volume', 50) // Volume mínimo de 50 exames/mês
        c.set('monthly_minimum_amount', 1250.0) // R$ 1.250,00 mínimo
        c.set(
          'cancellation_rules',
          'Aviso prévio mínimo de 30 dias por escrito. Rescisão sem ônus em caso de descumprimento de SLA reiterado (>5% no mês).',
        )
        c.set(
          'billing_notes',
          'Faturamento mensal consolidado. Pagamento via boleto bancário ou PIX identificado.',
        )
        c.set(
          'change_history',
          JSON.stringify([
            {
              date: '2026-01-01',
              action: 'CONTRACT_CREATED',
              description: 'Início da vigência do contrato comercial e integração de SLA.',
            },
            {
              date: '2026-06-01',
              action: 'PRICE_REVISION_AGREED',
              description: 'Reajuste anual acordado conforme IGPM setorial.',
            },
          ]),
        )
        app.save(c)
        contractAlfa = c
      }
    } catch (err) {
      console.log('Erro ao semear contrato Alfa:', err)
    }

    // 3. Criar Contrato Comercial - Clínica Beta (Contrato CTR-2026-BETA)
    let contractBeta = null
    try {
      const existing = app.findRecordsByFilter(
        'commercial_contracts',
        "contract_number = 'CTR-2026-BETA'",
        '',
        1,
        0,
      )
      if (existing.length > 0) {
        contractBeta = existing[0]
      } else {
        const c = new Record(contractsCol)
        c.set('provider_org_id', providerOrg.id)
        c.set('client_org_id', betaOrg.id)
        if (slaBeta) c.set('contract_sla_id', slaBeta.id)
        c.set('contract_number', 'CTR-2026-BETA')
        c.set('start_date', '2026-02-01 00:00:00.000Z')
        c.set('status', 'active')
        c.set('modalities', JSON.stringify(['ECG_12_DERIVACOES']))
        c.set('closing_day', 25) // Fechamento dia 25
        c.set('payment_terms_days', 10) // 10 dias após fechamento
        c.set('monthly_minimum_volume', 20)
        c.set('monthly_minimum_amount', 560.0)
        c.set('cancellation_rules', 'Aviso prévio de 60 dias. Multa de 1 mês de faturamento médio.')
        c.set('billing_notes', 'Fechamento antecipado dia 25 de cada competência.')
        c.set(
          'change_history',
          JSON.stringify([
            {
              date: '2026-02-01',
              action: 'CONTRACT_CREATED',
              description: 'Contrato comercial formalizado.',
            },
          ]),
        )
        app.save(c)
        contractBeta = c
      }
    } catch (err) {
      console.log('Erro ao semear contrato Beta:', err)
    }

    // 4. Semear Tabelas de Preços com Histórico de Vigência
    // Preços Clínica Alfa:
    // Vigência Histórica Antiga (Jan/2026 a Maio/2026): Rotina = R$ 22,00; Prioritário = R$ 35,00
    // Vigência Atual (Jun/2026 em diante): Rotina = R$ 25,00; Prioritário = R$ 40,00
    if (contractAlfa) {
      try {
        const pricesAlfa = app.findRecordsByFilter(
          'price_tables',
          `contract_id = '${contractAlfa.id}'`,
          '',
          10,
          0,
        )
        if (pricesAlfa.length === 0) {
          // Histórico Passado: Rotina R$ 22,00
          const pOldRot = new Record(pricesCol)
          pOldRot.set('contract_id', contractAlfa.id)
          pOldRot.set('client_org_id', alfaOrg.id)
          pOldRot.set('modality', 'ECG_12_DERIVACOES')
          pOldRot.set('urgency', 'routine')
          pOldRot.set('price_amount', 22.0)
          pOldRot.set('valid_from', '2026-01-01 00:00:00.000Z')
          pOldRot.set('valid_to', '2026-05-31 23:59:59.000Z')
          pOldRot.set('is_active', false)
          pOldRot.set('notes', 'Preço inicial de lançamento 2026.')
          app.save(pOldRot)

          // Atual: Rotina R$ 25,00
          const pCurRot = new Record(pricesCol)
          pCurRot.set('contract_id', contractAlfa.id)
          pCurRot.set('client_org_id', alfaOrg.id)
          pCurRot.set('modality', 'ECG_12_DERIVACOES')
          pCurRot.set('urgency', 'routine')
          pCurRot.set('price_amount', 25.0)
          pCurRot.set('valid_from', '2026-06-01 00:00:00.000Z')
          pCurRot.set('is_active', true)
          pCurRot.set('notes', 'Tabela vigente reajustada em Junho/2026.')
          app.save(pCurRot)

          // Atual: Prioritário R$ 40,00
          const pCurUrg = new Record(pricesCol)
          pCurUrg.set('contract_id', contractAlfa.id)
          pCurUrg.set('client_org_id', alfaOrg.id)
          pCurUrg.set('modality', 'ECG_12_DERIVACOES')
          pCurUrg.set('urgency', 'urgent')
          pCurUrg.set('price_amount', 40.0)
          pCurUrg.set('valid_from', '2026-06-01 00:00:00.000Z')
          pCurUrg.set('is_active', true)
          pCurUrg.set('notes', 'Preço diferenciado para laudos urgentes com SLA 2h.')
          app.save(pCurUrg)
        }
      } catch (err) {
        console.log('Erro ao semear preços Alfa:', err)
      }
    }

    // Preços Clínica Beta:
    if (contractBeta) {
      try {
        const pricesBeta = app.findRecordsByFilter(
          'price_tables',
          `contract_id = '${contractBeta.id}'`,
          '',
          10,
          0,
        )
        if (pricesBeta.length === 0) {
          const pRot = new Record(pricesCol)
          pRot.set('contract_id', contractBeta.id)
          pRot.set('client_org_id', betaOrg.id)
          pRot.set('modality', 'ECG_12_DERIVACOES')
          pRot.set('urgency', 'routine')
          pRot.set('price_amount', 28.0)
          pRot.set('valid_from', '2026-02-01 00:00:00.000Z')
          pRot.set('is_active', true)
          pRot.set('notes', 'Tabela padrão Instituto Beta.')
          app.save(pRot)

          const pUrg = new Record(pricesCol)
          pUrg.set('contract_id', contractBeta.id)
          pUrg.set('client_org_id', betaOrg.id)
          pUrg.set('modality', 'ECG_12_DERIVACOES')
          pUrg.set('urgency', 'urgent')
          pUrg.set('price_amount', 45.0)
          pUrg.set('valid_from', '2026-02-01 00:00:00.000Z')
          pUrg.set('is_active', true)
          pUrg.set('notes', 'Urgência Instituto Beta.')
          app.save(pUrg)
        }
      } catch (err) {
        console.log('Erro ao semear preços Beta:', err)
      }
    }

    // 5. Semear Fechamento Anterior Consolidado (Competência 2026-09) para Clínica Alfa
    let closingAlfaSetembro = null
    try {
      const existingClosings = app.findRecordsByFilter(
        'monthly_closings',
        "closing_code = 'FECH-202609-ALFA-CONSOLIDADO'",
        '',
        1,
        0,
      )
      if (existingClosings.length > 0) {
        closingAlfaSetembro = existingClosings[0]
      } else if (contractAlfa) {
        const cRec = new Record(closingsCol)
        cRec.set('provider_org_id', providerOrg.id)
        cRec.set('client_org_id', alfaOrg.id)
        cRec.set('contract_id', contractAlfa.id)
        cRec.set('competence_period', '2026-09')
        cRec.set('closing_code', 'FECH-202609-ALFA-CONSOLIDADO')
        cRec.set('period_start', '2026-09-01 00:00:00.000Z')
        cRec.set('period_end', '2026-09-30 23:59:59.000Z')
        cRec.set('status', 'paid')
        cRec.set('total_exams', 85)
        cRec.set('billable_exams', 85)
        cRec.set('subtotal_amount', 2225.0) // 75 rotinas (R$ 25) + 10 urgências (R$ 35) = 1875 + 350 = 2225
        cRec.set('discounts_adjustments_amount', -75.0) // Desconto comercial de R$ 75,00
        cRec.set('final_total_amount', 2150.0)
        cRec.set(
          'summary_by_modality',
          JSON.stringify({
            ECG_12_DERIVACOES: { count: 85, total: 2225.0 },
          }),
        )
        cRec.set(
          'summary_by_priority',
          JSON.stringify({
            routine: { count: 75, total: 1875.0 },
            urgent: { count: 10, total: 350.0 },
          }),
        )
        cRec.set('is_locked', true) // Consolidação imutável
        cRec.set('closed_at', '2026-09-30 18:00:00.000Z')
        cRec.set('closed_by', userFinanceiro.id)
        cRec.set('payment_due_date', '2026-10-15 00:00:00.000Z')
        cRec.set('payment_status', 'paid')
        cRec.set('payment_received_amount', 2150.0)
        cRec.set('payment_received_at', '2026-10-14 11:20:00.000Z')
        cRec.set(
          'notes',
          'Competência Setembro/2026 consolidada e quitada integralmente via transferência PIX.',
        )
        app.save(cRec)
        closingAlfaSetembro = cRec

        // Ajuste registrado separadamente
        const adjRec = new Record(adjCol)
        adjRec.set('monthly_closing_id', cRec.id)
        adjRec.set('client_org_id', alfaOrg.id)
        adjRec.set('adjustment_type', 'DESCONTO_COMERCIAL')
        adjRec.set('amount', -75.0)
        adjRec.set(
          'justification',
          'Bonificação de pontualidade contratual conforme cláusula 4.2 do contrato CTR-2026-ALFA.',
        )
        adjRec.set('authorized_by', userFinanceiro.id)
        adjRec.set('authorized_at', '2026-09-30 18:05:00.000Z')
        app.save(adjRec)
      }
    } catch (err) {
      console.log('Erro ao semear fechamento Setembro Alfa:', err)
    }

    // 6. Semear Fechamento da Competência Atual (2026-10) em Aberto
    try {
      const existingOpen = app.findRecordsByFilter(
        'monthly_closings',
        "closing_code = 'FECH-202610-ALFA-PARCIAL'",
        '',
        1,
        0,
      )
      if (existingOpen.length === 0 && contractAlfa) {
        const cRec = new Record(closingsCol)
        cRec.set('provider_org_id', providerOrg.id)
        cRec.set('client_org_id', alfaOrg.id)
        cRec.set('contract_id', contractAlfa.id)
        cRec.set('competence_period', '2026-10')
        cRec.set('closing_code', 'FECH-202610-ALFA-PARCIAL')
        cRec.set('period_start', '2026-10-01 00:00:00.000Z')
        cRec.set('period_end', '2026-10-31 23:59:59.000Z')
        cRec.set('status', 'open')
        cRec.set('total_exams', 42)
        cRec.set('billable_exams', 42)
        cRec.set('subtotal_amount', 1110.0) // 38 rotinas (R$ 25) = 950 + 4 urgências (R$ 40) = 160 -> 1110.0
        cRec.set('discounts_adjustments_amount', 0)
        cRec.set('final_total_amount', 1110.0)
        cRec.set(
          'summary_by_modality',
          JSON.stringify({
            ECG_12_DERIVACOES: { count: 42, total: 1110.0 },
          }),
        )
        cRec.set(
          'summary_by_priority',
          JSON.stringify({
            routine: { count: 38, total: 950.0 },
            urgent: { count: 4, total: 160.0 },
          }),
        )
        cRec.set('is_locked', false)
        cRec.set('payment_due_date', '2026-11-15 00:00:00.000Z')
        cRec.set('payment_status', 'pending')
        cRec.set('payment_received_amount', 0)
        cRec.set('notes', 'Competência de Outubro/2026 em andamento (prévia faturável).')
        app.save(cRec)
      }
    } catch (err) {
      console.log('Erro ao semear fechamento Outubro Alfa:', err)
    }

    // 7. Semear Itens de Cobrança Fictícios em billing_items para a Competência Atual
    try {
      const existingItems = app.findRecordsByFilter('billing_items', '', '', 5, 0)
      if (existingItems.length === 0 && contractAlfa) {
        // Encontrar exames existentes para amarrar amostras
        const allExams = app.findRecordsByFilter('exam_requests', '', '', 10, 0)
        let sampleDoc = null
        try {
          const docs = app.findRecordsByFilter('report_documents', '', '', 1, 0)
          if (docs.length > 0) sampleDoc = docs[0]
        } catch (_) {}

        let doctorAlfa = null
        try {
          const docsMed = app.findRecordsByFilter('doctors', '', '', 1, 0)
          if (docsMed.length > 0) doctorAlfa = docsMed[0]
        } catch (_) {}

        if (allExams.length > 0 && sampleDoc) {
          const it1 = new Record(billingCol)
          it1.set('exam_request_id', allExams[0].id)
          it1.set('report_document_id', sampleDoc.id)
          it1.set('provider_org_id', providerOrg.id)
          it1.set('client_org_id', alfaOrg.id)
          it1.set('contract_id', contractAlfa.id)
          it1.set('billing_type', 'LAUDO_PADRAO')
          it1.set('idempotency_key', `BILLING-${allExams[0].id}-LAUDO_PADRAO`)
          it1.set('competence_period', '2026-10')
          it1.set('modality', 'ECG_12_DERIVACOES')
          it1.set('urgency', 'routine')
          it1.set('unit_price_snapshotted', 25.0)
          it1.set('price_snapshot_date', '2026-10-15 10:00:00.000Z')
          it1.set('status', 'billable')
          if (doctorAlfa) it1.set('reporting_doctor_id', doctorAlfa.id)
          it1.set('is_rectification', false)
          it1.set('notes', 'Cobrança teste homologada.')
          app.save(it1)
        }
      }
    } catch (err) {
      console.log('Erro ao semear billing items:', err)
    }
  },
  (app) => {},
)
