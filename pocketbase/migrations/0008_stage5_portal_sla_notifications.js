migrate(
  (app) => {
    const orgsCol = app.findCollectionByNameOrId('organizations')
    const examsCol = app.findCollectionByNameOrId('exam_requests')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Coleção: contract_slas (Configuração de prazos/SLA por contrato/organização)
    const contractSlasCollection = new Collection({
      name: 'contract_slas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'contract_name', type: 'text', required: true },
        { name: 'routine_sla_hours', type: 'number', required: true }, // Padrão: 24h
        { name: 'urgent_sla_hours', type: 'number', required: true }, // Padrão: 2h
        { name: 'emergency_enabled', type: 'bool' }, // Sempre false nesta etapa
        { name: 'business_hours_start', type: 'text' }, // Ex: "08:00"
        { name: 'business_hours_end', type: 'text' }, // Ex: "18:00"
        { name: 'operates_on_weekends', type: 'bool' }, // Sáb/Dom
        { name: 'warning_threshold_minutes', type: 'number' }, // Alerta de proximidade (ex: 30 min)
        { name: 'is_active', type: 'bool' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_sla_org ON contract_slas (organization_id)'],
    })
    app.save(contractSlasCollection)

    // 2. Coleção: internal_notifications (Notificações internas da central e clínicas)
    const internalNotificationsCollection = new Collection({
      name: 'internal_notifications',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: false,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'exam_request_id',
          type: 'relation',
          required: false,
          collectionId: examsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'notification_type',
          type: 'select',
          required: true,
          values: [
            'NOVO_ECG_RECEBIDO',
            'EXAME_DEVOLVIDO_QUALIDADE',
            'EXAME_PROXIMO_DO_PRAZO',
            'EXAME_ATRASADO',
            'LAUDO_VALIDADO_LIBERADO',
            'AVISO_SISTEMA',
          ],
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'message', type: 'text', required: true },
        {
          name: 'target_role',
          type: 'select',
          required: false,
          values: ['all', 'admin', 'cardiologist', 'clinic_manager', 'clinic_operator'],
          maxSelect: 1,
        },
        { name: 'is_read', type: 'bool' },
        { name: 'read_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_notif_org ON internal_notifications (organization_id)',
        'CREATE INDEX idx_notif_user ON internal_notifications (user_id)',
        'CREATE INDEX idx_notif_exam ON internal_notifications (exam_request_id)',
        'CREATE INDEX idx_notif_type ON internal_notifications (notification_type)',
        'CREATE INDEX idx_notif_read ON internal_notifications (is_read)',
      ],
    })
    app.save(internalNotificationsCollection)

    // 3. Adicionar campos de controle de prazo em exam_requests (deadline_at, sla_status)
    const exams = app.findCollectionByNameOrId('exam_requests')
    if (!exams.fields.getByName('deadline_at')) {
      exams.fields.add(new DateField({ name: 'deadline_at' }))
    }
    if (!exams.fields.getByName('sla_status')) {
      exams.fields.add(
        new SelectField({
          name: 'sla_status',
          values: ['no_prazo', 'proximo_do_vencimento', 'atrasado', 'concluido'],
          maxSelect: 1,
        }),
      )
    }
    app.save(exams)

    // 4. Seed de contratos SLA padrão para as organizações existentes
    try {
      const orgs = app.findRecordsByFilter('organizations', '', '', 50, 0)
      const slasCol = app.findCollectionByNameOrId('contract_slas')

      for (const org of orgs) {
        try {
          const existing = app.findRecordsByFilter(
            'contract_slas',
            `organization_id = '${org.id}'`,
            '',
            1,
            0,
          )
          if (existing.length === 0) {
            const rec = new Record(slasCol)
            rec.set('organization_id', org.id)
            rec.set('contract_name', `Contrato Padrão - ${org.getString('name')}`)
            rec.set('routine_sla_hours', 24)
            rec.set('urgent_sla_hours', 2)
            rec.set('emergency_enabled', false)
            rec.set('business_hours_start', '08:00')
            rec.set('business_hours_end', '18:00')
            rec.set('operates_on_weekends', false)
            rec.set('warning_threshold_minutes', 30)
            rec.set('is_active', true)
            rec.set(
              'notes',
              'SLA padrão inicial: Rotina 24h, Prioritário 2h. Modalidade de emergência desabilitada nesta etapa.',
            )
            app.save(rec)
          }
        } catch (_) {}
      }
    } catch (seedErr) {
      console.log('Aviso ao semear contract_slas:', seedErr)
    }
  },
  (app) => {
    const collections = ['internal_notifications', 'contract_slas']
    for (const name of collections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
