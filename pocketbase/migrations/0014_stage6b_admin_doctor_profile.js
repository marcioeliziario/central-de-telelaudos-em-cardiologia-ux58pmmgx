migrate(
  (app) => {
    // Garantir que o usuário admin principal (marcio.eliziario@hotmail.com)
    // possua registro em 'doctors', atendendo ao requisito:
    // "acessível APENAS a administrador que também possua perfil médico habilitado (validar no backend)"
    let adminUser = null
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'marcio.eliziario@hotmail.com')
    } catch (_) {
      return
    }

    const provOrgs = app.findRecordsByFilter('organizations', "type = 'provider'", '', 1, 0)
    if (provOrgs.length === 0) return
    const providerOrg = provOrgs[0]

    // 1. Cadastrar registro em 'doctors' se não existir
    let existingDoctor = null
    try {
      const docs = app.findRecordsByFilter('doctors', `user_id = '${adminUser.id}'`, '', 1, 0)
      if (docs.length > 0) existingDoctor = docs[0]
    } catch (_) {}

    if (!existingDoctor) {
      const doctorsCol = app.findCollectionByNameOrId('doctors')
      const doctorRecord = new Record(doctorsCol)
      doctorRecord.set('user_id', adminUser.id)
      doctorRecord.set('organization_id', providerOrg.id)
      doctorRecord.set('crm', '998877')
      doctorRecord.set('crm_state', 'SP')
      doctorRecord.set('rqe', '88990')
      doctorRecord.set('specialty', 'Cardiologia e Eletrofisiologia Clínica')
      doctorRecord.set('is_active', true)
      doctorRecord.set(
        'notes',
        'Dr. Márcio Eliziário - Responsável Técnico e Administrador da Central',
      )
      app.save(doctorRecord)
    }
  },
  (app) => {
    // Reversão
    try {
      const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'marcio.eliziario@hotmail.com')
      const docs = app.findRecordsByFilter(
        'doctors',
        `user_id = '${adminUser.id}' && crm = '998877'`,
        '',
        1,
        0,
      )
      if (docs.length > 0) app.delete(docs[0])
    } catch (_) {}
  },
)
