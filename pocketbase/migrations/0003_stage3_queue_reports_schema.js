migrate(
  (app) => {
    const orgsCol = app.findCollectionByNameOrId('organizations')
    const doctorsCol = app.findCollectionByNameOrId('doctors')
    const examsCol = app.findCollectionByNameOrId('exam_requests')
    const patientsCol = app.findCollectionByNameOrId('patients')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Atualizar valores permitidos do status em exam_requests
    // Adicionar 'waiting_signature' e 'returned' ao select de status caso não existam
    const statusField = examsCol.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'pending',
        'in_analysis',
        'waiting_signature',
        'returned',
        'reported',
        'cancelled',
      ]
    }
    // Adicionar campo return_reason se não existir
    if (!examsCol.fields.getByName('return_reason')) {
      examsCol.fields.add(new TextField({ name: 'return_reason' }))
    }
    // Adicionar campo assigned_at se não existir
    if (!examsCol.fields.getByName('assigned_at')) {
      examsCol.fields.add(new DateField({ name: 'assigned_at' }))
    }
    // Adicionar campo priority_score se não existir (para ordenação)
    if (!examsCol.fields.getByName('priority_score')) {
      examsCol.fields.add(new NumberField({ name: 'priority_score' }))
    }
    app.save(examsCol)

    // 2. Coleção: report_templates (modelos de redação SBC editáveis)
    const reportTemplatesCollection = new Collection({
      name: 'report_templates',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'category', type: 'text', required: true },
        { name: 'rhythm', type: 'text' },
        { name: 'p_wave_description', type: 'text' },
        { name: 'av_conduction', type: 'text' },
        { name: 'iv_conduction', type: 'text' },
        { name: 'repolarization', type: 'text' },
        { name: 'q_waves', type: 'text' },
        { name: 'description', type: 'text', required: true },
        { name: 'conclusion', type: 'text', required: true },
        { name: 'is_active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_templates_title ON report_templates (title)',
        'CREATE INDEX idx_templates_category ON report_templates (category)',
      ],
    })
    app.save(reportTemplatesCollection)

    // 3. Coleção: report_drafts (rascunhos com auto-save e histórico de versão)
    const reportDraftsCollection = new Collection({
      name: 'report_drafts',
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
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'doctor_id',
          type: 'relation',
          required: true,
          collectionId: doctorsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'author_id',
          type: 'relation',
          required: true,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'version', type: 'number', required: true },
        { name: 'heart_rate', type: 'number' },
        { name: 'cardiac_rhythm', type: 'text' },
        { name: 'electrical_axis', type: 'text' },
        { name: 'pr_interval_ms', type: 'number' },
        { name: 'qrs_duration_ms', type: 'number' },
        { name: 'qt_interval_ms', type: 'number' },
        { name: 'qtc_interval_ms', type: 'number' },
        { name: 'p_wave_description', type: 'text' },
        { name: 'av_conduction_alterations', type: 'text' },
        { name: 'iv_conduction_alterations', type: 'text' },
        { name: 'repolarization_alterations', type: 'text' },
        { name: 'q_waves_findings', type: 'text' },
        { name: 'free_text_description', type: 'text' },
        { name: 'free_text_conclusion', type: 'text' },
        { name: 'technical_quality_notes', type: 'text' },
        { name: 'is_latest', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_drafts_exam ON report_drafts (exam_request_id)',
        'CREATE INDEX idx_drafts_doctor ON report_drafts (doctor_id)',
        'CREATE INDEX idx_drafts_version ON report_drafts (exam_request_id, version DESC)',
      ],
    })
    app.save(reportDraftsCollection)
    const reportDraftsId = reportDraftsCollection.id

    // 4. Coleção: ecg_reports (laudos médicos elaborados aguardando assinatura na etapa 3)
    const ecgReportsCollection = new Collection({
      name: 'ecg_reports',
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
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'patient_id',
          type: 'relation',
          required: true,
          collectionId: patientsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'doctor_id',
          type: 'relation',
          required: true,
          collectionId: doctorsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['draft', 'waiting_signature', 'signed_mock_prohibited', 'archived'],
          maxSelect: 1,
        },
        { name: 'heart_rate', type: 'number' },
        { name: 'cardiac_rhythm', type: 'text' },
        { name: 'electrical_axis', type: 'text' },
        { name: 'pr_interval_ms', type: 'number' },
        { name: 'qrs_duration_ms', type: 'number' },
        { name: 'qt_interval_ms', type: 'number' },
        { name: 'qtc_interval_ms', type: 'number' },
        { name: 'p_wave_description', type: 'text' },
        { name: 'av_conduction_alterations', type: 'text' },
        { name: 'iv_conduction_alterations', type: 'text' },
        { name: 'repolarization_alterations', type: 'text' },
        { name: 'q_waves_findings', type: 'text' },
        { name: 'free_text_description', type: 'text', required: true },
        { name: 'free_text_conclusion', type: 'text', required: true },
        { name: 'technical_quality_notes', type: 'text' },
        { name: 'has_critical_findings', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_reports_exam_unique ON ecg_reports (exam_request_id)',
        'CREATE INDEX idx_reports_org ON ecg_reports (organization_id)',
        'CREATE INDEX idx_reports_doctor ON ecg_reports (doctor_id)',
        'CREATE INDEX idx_reports_status ON ecg_reports (status)',
      ],
    })
    app.save(ecgReportsCollection)

    // 5. Coleção: critical_findings (registro formal de comunicação de achados potencialmente críticos)
    const criticalFindingsCollection = new Collection({
      name: 'critical_findings',
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
          name: 'doctor_id',
          type: 'relation',
          required: true,
          collectionId: doctorsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'classification',
          type: 'select',
          required: true,
          values: [
            'infarto_agudo_supra_st',
            'bloqueio_av_avancado_total',
            'taquicardia_ventricular',
            'bradicardia_grave_sintomatica',
            'intervalo_qt_muito_prolongado',
            'pausa_sinusal_prolongada',
            'outro_achado_critico',
          ],
          maxSelect: 1,
        },
        { name: 'justification', type: 'text', required: true },
        { name: 'contact_recipient', type: 'text', required: true },
        {
          name: 'contact_channel',
          type: 'select',
          required: true,
          values: [
            'telefone_plantao',
            'telefone_medico_assistente',
            'telefone_enfermagem',
            'whatsapp_institucional',
            'comunicador_clinico_direto',
          ],
          maxSelect: 1,
        },
        { name: 'contact_timestamp', type: 'date', required: true },
        { name: 'confirmed_by_recipient', type: 'bool' },
        { name: 'confirmation_notes', type: 'text' },
        { name: 'confirmation_timestamp', type: 'date' },
        { name: 'clinical_disclaimer', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_critical_exam ON critical_findings (exam_request_id)',
        'CREATE INDEX idx_critical_doctor ON critical_findings (doctor_id)',
      ],
    })
    app.save(criticalFindingsCollection)
  },
  (app) => {
    const collections = ['critical_findings', 'ecg_reports', 'report_drafts', 'report_templates']
    for (const name of collections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
