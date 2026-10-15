migrate(
  (app) => {
    const orgsCol = app.findCollectionByNameOrId('organizations')
    const slasCol = app.findCollectionByNameOrId('contract_slas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const examsCol = app.findCollectionByNameOrId('exam_requests')
    const docsCol = app.findCollectionByNameOrId('report_documents')
    const doctorsCol = app.findCollectionByNameOrId('doctors')

    // 1. Coleção: commercial_contracts (Contratos comerciais entre prestadora e clínica)
    const contractsCol = new Collection({
      name: 'commercial_contracts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'provider_org_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'client_org_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'contract_sla_id',
          type: 'relation',
          required: false,
          collectionId: slasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'contract_number', type: 'text', required: true },
        { name: 'start_date', type: 'date', required: true },
        { name: 'end_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['draft', 'active', 'suspended', 'cancelled', 'expired'],
          maxSelect: 1,
        },
        { name: 'modalities', type: 'text', required: true }, // JSON array string: ["ECG_12_DERIVACOES", "ECG_URGENCIA"]
        { name: 'closing_day', type: 'number', required: true }, // Dia de fechamento financeiro (ex: 30, 25)
        { name: 'payment_terms_days', type: 'number', required: true }, // Ex: 15 (dias após fechamento para vencimento)
        { name: 'monthly_minimum_volume', type: 'number' }, // Volume mínimo garantido quando aplicável
        { name: 'monthly_minimum_amount', type: 'number' }, // Valor mínimo em R$ quando aplicável
        { name: 'cancellation_rules', type: 'text' }, // Regras de rescisão e aviso prévio
        { name: 'billing_notes', type: 'text' },
        { name: 'change_history', type: 'text' }, // JSON histórico de alterações contratuais
        { name: 'created_by', type: 'relation', collectionId: usersCol.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_comm_contract_num ON commercial_contracts (contract_number)',
        'CREATE INDEX idx_comm_contract_client ON commercial_contracts (client_org_id)',
        'CREATE INDEX idx_comm_contract_provider ON commercial_contracts (provider_org_id)',
        'CREATE INDEX idx_comm_contract_status ON commercial_contracts (status)',
      ],
    })
    app.save(contractsCol)

    // 2. Coleção: price_tables (Tabelas de preços com vigência por clínica, modalidade e prioridade)
    const priceTablesCol = new Collection({
      name: 'price_tables',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'contract_id',
          type: 'relation',
          required: true,
          collectionId: contractsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'client_org_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'modality',
          type: 'select',
          required: true,
          values: ['ECG_12_DERIVACOES', 'ECG_RITMO', 'OUTRA'],
          maxSelect: 1,
        },
        {
          name: 'urgency',
          type: 'select',
          required: true,
          values: ['routine', 'urgent', 'emergency'],
          maxSelect: 1,
        },
        { name: 'price_amount', type: 'number', required: true }, // Valor unitário em R$
        { name: 'valid_from', type: 'date', required: true },
        { name: 'valid_to', type: 'date' },
        { name: 'is_active', type: 'bool' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_prices_contract ON price_tables (contract_id)',
        'CREATE INDEX idx_prices_client ON price_tables (client_org_id)',
        'CREATE INDEX idx_prices_mod_urg ON price_tables (modality, urgency)',
      ],
    })
    app.save(priceTablesCol)

    // 3. Coleção: monthly_closings (Fechamentos mensais de competência por prestadora e clínica)
    const closingsCol = new Collection({
      name: 'monthly_closings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'provider_org_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'client_org_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'contract_id',
          type: 'relation',
          required: true,
          collectionId: contractsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'competence_period', type: 'text', required: true }, // Ex: "2026-09", "2026-10"
        { name: 'closing_code', type: 'text', required: true }, // Ex: "FECH-202610-ALFA-01"
        { name: 'period_start', type: 'date', required: true },
        { name: 'period_end', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['open', 'closed', 'invoiced_simulated_blocked', 'paid', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'total_exams', type: 'number', required: true },
        { name: 'billable_exams', type: 'number', required: true },
        { name: 'subtotal_amount', type: 'number', required: true },
        { name: 'discounts_adjustments_amount', type: 'number' }, // Ajustes/descontos
        { name: 'final_total_amount', type: 'number', required: true },
        { name: 'summary_by_modality', type: 'text' }, // JSON com contagem e totais por modalidade
        { name: 'summary_by_priority', type: 'text' }, // JSON com contagem e totais por prioridade
        { name: 'is_locked', type: 'bool' }, // Valores consolidados protegidos contra edição direta
        { name: 'closed_at', type: 'date' },
        { name: 'closed_by', type: 'relation', collectionId: usersCol.id, maxSelect: 1 },
        { name: 'payment_due_date', type: 'date' },
        {
          name: 'payment_status',
          type: 'select',
          values: ['pending', 'paid_partial', 'paid', 'overdue'],
          maxSelect: 1,
        },
        { name: 'payment_received_amount', type: 'number' },
        { name: 'payment_received_at', type: 'date' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_closing_code ON monthly_closings (closing_code)',
        'CREATE INDEX idx_closing_comp_client ON monthly_closings (competence_period, client_org_id)',
        'CREATE INDEX idx_closing_provider ON monthly_closings (provider_org_id)',
        'CREATE INDEX idx_closing_status ON monthly_closings (status)',
      ],
    })
    app.save(closingsCol)

    // 4. Coleção: billing_items (Itens de cobrança faturáveis gerados por laudo assinado/liberado)
    const billingItemsCol = new Collection({
      name: 'billing_items',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'exam_request_id',
          type: 'relation',
          required: true,
          collectionId: examsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'report_document_id',
          type: 'relation',
          required: true,
          collectionId: docsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'provider_org_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'client_org_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'contract_id',
          type: 'relation',
          required: true,
          collectionId: contractsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'price_table_id',
          type: 'relation',
          collectionId: priceTablesCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'monthly_closing_id',
          type: 'relation',
          collectionId: closingsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'billing_type',
          type: 'select',
          required: true,
          values: ['LAUDO_PADRAO', 'LAUDO_URGENTE', 'REANÁLISE_CONTRATUAL', 'ADICIONAL_AUTORIZADO'],
          maxSelect: 1,
        },
        { name: 'idempotency_key', type: 'text', required: true }, // ex: "BILLING-<exam_id>-LAUDO_PADRAO"
        { name: 'competence_period', type: 'text', required: true }, // Ex: "2026-10"
        { name: 'modality', type: 'text', required: true },
        { name: 'urgency', type: 'text', required: true },
        { name: 'unit_price_snapshotted', type: 'number', required: true }, // Preço capturado no momento do faturamento
        { name: 'price_snapshot_date', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['draft_prohibited', 'billable', 'closed', 'adjusted', 'cancelled'],
          maxSelect: 1,
        },
        {
          name: 'reporting_doctor_id',
          type: 'relation',
          collectionId: doctorsCol.id,
          maxSelect: 1,
        },
        { name: 'is_rectification', type: 'bool' }, // Flag para retificação (NÃO duplica cobrança)
        { name: 'parent_billing_item_id', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_billing_idempotency ON billing_items (idempotency_key)',
        'CREATE INDEX idx_billing_exam ON billing_items (exam_request_id)',
        'CREATE INDEX idx_billing_client_comp ON billing_items (client_org_id, competence_period)',
        'CREATE INDEX idx_billing_closing ON billing_items (monthly_closing_id)',
        'CREATE INDEX idx_billing_doctor ON billing_items (reporting_doctor_id)',
      ],
    })
    app.save(billingItemsCol)

    // 5. Coleção: billing_adjustments (Ajustes e estornos registrados SEPARADAMENTE sem sobrescrever)
    const adjustmentsCol = new Collection({
      name: 'billing_adjustments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'monthly_closing_id',
          type: 'relation',
          required: true,
          collectionId: closingsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'billing_item_id',
          type: 'relation',
          collectionId: billingItemsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'client_org_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'adjustment_type',
          type: 'select',
          required: true,
          values: [
            'DESCONTO_COMERCIAL',
            'ESTORNO_QUALIDADE',
            'ACRESCIMO_CONTRATUAL',
            'OUTRO_AJUSTE',
          ],
          maxSelect: 1,
        },
        { name: 'amount', type: 'number', required: true }, // Valor (positivo para acréscimo, negativo para desconto/estorno)
        { name: 'justification', type: 'text', required: true }, // Justificativa obrigatória
        { name: 'authorized_by', type: 'relation', collectionId: usersCol.id, maxSelect: 1 },
        { name: 'authorized_at', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_adj_closing ON billing_adjustments (monthly_closing_id)',
        'CREATE INDEX idx_adj_client ON billing_adjustments (client_org_id)',
      ],
    })
    app.save(adjustmentsCol)
  },
  (app) => {
    const list = [
      'billing_adjustments',
      'billing_items',
      'monthly_closings',
      'price_tables',
      'commercial_contracts',
    ]
    for (const name of list) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
