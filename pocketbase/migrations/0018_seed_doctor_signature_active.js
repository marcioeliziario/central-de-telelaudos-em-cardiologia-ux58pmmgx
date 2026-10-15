migrate(
  (app) => {
    // 1. Atualizar o schema de doctor_signatures para signature_image required: false
    const collection = app.findCollectionByNameOrId('doctor_signatures')
    const field = collection.fields.getByName('signature_image')
    if (field) {
      field.required = false
      app.save(collection)
    }

    // 2. Agora cadastrar a assinatura para o Dr. Márcio Eliziário (admin e médico)
    let adminUser = null
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'marcio.eliziario@hotmail.com')
    } catch (_) {}

    if (!adminUser) {
      try {
        const users = app.findRecordsByFilter('users', "id = 'pbktonjo4sn4fa3'", '', 1, 0)
        if (users.length > 0) adminUser = users[0]
      } catch (_) {}
    }

    if (!adminUser) return

    const fileName = 'assinatura-medica-principal-transparente.png'
    const sha256 = 'd7cbcf1eb4ba520ae1e52ee3b216ec711a7c807212f86641b6c867fa2032e366'

    const existing = app.findRecordsByFilter(
      'doctor_signatures',
      `user_id = '${adminUser.id}'`,
      '-created',
      1,
      0,
    )

    let sigRec
    let isSubst = false
    if (existing.length > 0) {
      sigRec = existing[0]
      isSubst = true
    } else {
      const col = app.findCollectionByNameOrId('doctor_signatures')
      sigRec = new Record(col)
      sigRec.set('user_id', adminUser.id)
    }

    sigRec.set('file_name', fileName)
    sigRec.set('file_hash_sha256', sha256)
    sigRec.set('is_active', true)
    sigRec.set('last_verified_at', new Date().toISOString())

    app.save(sigRec)

    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', adminUser.id)
      auditRec.set(
        'action',
        isSubst ? 'DOCTOR_SIGNATURE_SUBSTITUTED' : 'DOCTOR_SIGNATURE_REGISTERED',
      )
      auditRec.set('target_collection', 'doctor_signatures')
      auditRec.set('target_id', sigRec.id)
      auditRec.set('status', 'SUCCESS')
      auditRec.set(
        'details',
        `Assinatura manuscrita oficial ativada para Dr. Márcio Eliziário. Arquivo: ${fileName}, SHA-256: ${sha256}`,
      )
      app.save(auditRec)
    } catch (_) {}

    // Cadastrar também para Dr. Carlos (médico padrão da central)
    try {
      const cardioUser = app.findAuthRecordByEmail('_pb_users_auth_', 'dr.carlos@cardiolab.fake')
      if (cardioUser) {
        const existingCardio = app.findRecordsByFilter(
          'doctor_signatures',
          `user_id = '${cardioUser.id}'`,
          '-created',
          1,
          0,
        )
        let cSig
        if (existingCardio.length > 0) {
          cSig = existingCardio[0]
        } else {
          const col = app.findCollectionByNameOrId('doctor_signatures')
          cSig = new Record(col)
          cSig.set('user_id', cardioUser.id)
        }
        cSig.set('file_name', fileName)
        cSig.set('file_hash_sha256', sha256)
        cSig.set('is_active', true)
        cSig.set('last_verified_at', new Date().toISOString())
        app.save(cSig)
      }
    } catch (_) {}
  },
  (app) => {
    // Reversão
  },
)
