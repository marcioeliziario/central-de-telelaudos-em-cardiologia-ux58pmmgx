migrate(
  (app) => {
    // 1. Atualizar coleção users com campos de controle
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('phone')) {
      usersCol.fields.add(new TextField({ name: 'phone' }))
    }
    if (!usersCol.fields.getByName('is_active')) {
      usersCol.fields.add(new BoolField({ name: 'is_active' }))
    }
    usersCol.listRule = "@request.auth.id != ''"
    usersCol.viewRule = "@request.auth.id != ''"
    usersCol.updateRule = "@request.auth.id != '' && id = @request.auth.id"
    app.save(usersCol)

    // 2. Coleção: organizations (prestadoras vs contratantes)
    const orgsCollection = new Collection({
      name: 'organizations',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'trade_name', type: 'text' },
        { name: 'cnpj', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['provider', 'client'],
          maxSelect: 1,
        },
        { name: 'is_active', type: 'bool' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_orgs_cnpj ON organizations (cnpj)'],
    })
    app.save(orgsCollection)
    const orgsId = orgsCollection.id

    // 3. Coleção: user_organizations (vínculo usuário <-> organização com perfil)
    const userOrgsCollection = new Collection({
      name: 'user_organizations',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['admin', 'clinic_manager', 'clinic_operator', 'cardiologist', 'financial'],
          maxSelect: 1,
        },
        { name: 'is_active', type: 'bool' },
        { name: 'title_position', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_user_org_unique ON user_organizations (user_id, organization_id)',
      ],
    })
    app.save(userOrgsCollection)
    const userOrgsId = userOrgsCollection.id

    // 4. Coleção: units (unidades físicas de uma clínica)
    const unitsCollection = new Collection({
      name: 'units',
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
          collectionId: orgsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'code', type: 'text' },
        { name: 'cnes', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'is_active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(unitsCollection)
    const unitsId = unitsCollection.id

    // 5. Coleção: doctors (cardiologistas da prestadora)
    const doctorsCollection = new Collection({
      name: 'doctors',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'crm', type: 'text', required: true },
        { name: 'crm_state', type: 'text', required: true },
        { name: 'rqe', type: 'text' },
        { name: 'specialty', type: 'text' },
        { name: 'is_active', type: 'bool' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_doctors_crm ON doctors (crm, crm_state)'],
    })
    app.save(doctorsCollection)
    const doctorsId = doctorsCollection.id

    // 6. Coleção: patients (pacientes vinculados a uma clínica contratante)
    const patientsCollection = new Collection({
      name: 'patients',
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
          collectionId: orgsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'unit_id',
          type: 'relation',
          collectionId: unitsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'full_name', type: 'text', required: true },
        { name: 'birth_date', type: 'date', required: true },
        {
          name: 'gender',
          type: 'select',
          required: true,
          values: ['M', 'F', 'other'],
          maxSelect: 1,
        },
        { name: 'cpf', type: 'text' },
        { name: 'record_number', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'weight_kg', type: 'number' },
        { name: 'height_cm', type: 'number' },
        { name: 'clinical_notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_patients_org ON patients (organization_id)',
        'CREATE INDEX idx_patients_cpf ON patients (cpf)',
      ],
    })
    app.save(patientsCollection)
    const patientsId = patientsCollection.id

    // 7. Coleção: exam_requests (solicitações de ECG)
    const examsCollection = new Collection({
      name: 'exam_requests',
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
          collectionId: orgsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'unit_id',
          type: 'relation',
          collectionId: unitsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'patient_id',
          type: 'relation',
          required: true,
          collectionId: patientsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'requested_by',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'assigned_doctor_id',
          type: 'relation',
          collectionId: doctorsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pending', 'in_analysis', 'reported', 'cancelled'],
          maxSelect: 1,
        },
        {
          name: 'urgency',
          type: 'select',
          required: true,
          values: ['routine', 'urgent', 'emergency'],
          maxSelect: 1,
        },
        {
          name: 'exam_file',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 15728640, // 15MB
          mimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
          protected: true,
        },
        { name: 'clinical_indication', type: 'text' },
        { name: 'symptoms', type: 'text' },
        { name: 'medications_in_use', type: 'text' },
        { name: 'has_pacemaker', type: 'bool' },
        { name: 'exam_date', type: 'date' },
        { name: 'cancellation_reason', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_exams_org ON exam_requests (organization_id)',
        'CREATE INDEX idx_exams_status ON exam_requests (status)',
        'CREATE INDEX idx_exams_patient ON exam_requests (patient_id)',
      ],
    })
    app.save(examsCollection)

    // 8. Coleção: audit_logs (registro imutável de eventos)
    const auditLogsCollection = new Collection({
      name: 'audit_logs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null, // imutável
      deleteRule: null, // não pode ser excluído
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'organization_id',
          type: 'relation',
          collectionId: orgsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'action', type: 'text', required: true },
        { name: 'target_collection', type: 'text', required: true },
        { name: 'target_id', type: 'text' },
        { name: 'ip_address', type: 'text' },
        { name: 'user_agent', type: 'text' },
        { name: 'details', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_action ON audit_logs (action)',
        'CREATE INDEX idx_audit_created ON audit_logs (created DESC)',
      ],
    })
    app.save(auditLogsCollection)
  },
  (app) => {
    const collections = [
      'audit_logs',
      'exam_requests',
      'patients',
      'doctors',
      'units',
      'user_organizations',
      'organizations',
    ]
    for (const name of collections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
