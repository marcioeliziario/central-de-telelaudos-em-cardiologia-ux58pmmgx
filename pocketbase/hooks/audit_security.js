// Hooks PocketBase para controle de acesso refinado e auditoria de segurança
// Em PocketBase v0.23+, o usuário logado está em e.auth

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

    // Verificar se o usuário autenticado pertence à organização solicitante ou é admin geral
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

  e.next()

  // Registro de Auditoria pós-criação bem-sucedida
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

  // 2. Bloquear troca de organização em pacientes ou exames
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

    // Verificar se o usuário pertence à organização dona do registro ou é admin
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
      // Se for cardiologista, pode atualizar status de exame, mas não paciente
      if (collectionName === 'exam_requests' && isCardiologist) {
        // Permitido para cardiologista laudador
      } else {
        throw new ForbiddenError('Acesso negado: registro pertence a outra organização.')
      }
    }
  }

  e.next()

  // Log de auditoria para updates
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
  e.next()
})

onRecordAuthRequest((e) => {
  e.next()
  try {
    const authRecord = e.record
    if (authRecord) {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', authRecord.id)
      auditRec.set('action', 'AUTH_LOGIN')
      auditRec.set('target_collection', 'users')
      auditRec.set('target_id', authRecord.id)
      auditRec.set('status', 'SUCCESS')
      auditRec.set('details', `Login realizado: ${authRecord.getString('email')}`)
      $app.save(auditRec)
    }
  } catch (err) {
    console.log('Falha ao registrar log de login:', err)
  }
})
