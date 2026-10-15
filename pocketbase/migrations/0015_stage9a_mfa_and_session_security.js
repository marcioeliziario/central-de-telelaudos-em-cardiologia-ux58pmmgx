migrate(
  (app) => {
    // 1. Ampliar campos de MFA e controle de segurança de sessão na coleção users
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // mfa_enabled: flag de ativação do 2º fator (default false)
    if (!usersCol.fields.getByName('mfa_enabled')) {
      usersCol.fields.add(new BoolField({ name: 'mfa_enabled' }))
    }

    // mfa_secret: segredo Base32 para TOTP (armazenado de forma protegida, não retornado na API pública de users)
    if (!usersCol.fields.getByName('mfa_secret')) {
      usersCol.fields.add(
        new TextField({
          name: 'mfa_secret',
          hidden: true, // oculta na resposta padrão da API
        }),
      )
    }

    // mfa_enforced: se este usuário tem obrigatoriedade de 2FA configurada por perfil
    if (!usersCol.fields.getByName('mfa_enforced')) {
      usersCol.fields.add(new BoolField({ name: 'mfa_enforced' }))
    }

    // mfa_enforced_role: se a exigência decorre do perfil ('admin', 'cardiologist', 'none')
    if (!usersCol.fields.getByName('mfa_enforced_role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'mfa_enforced_role',
          values: ['none', 'admin', 'cardiologist', 'all'],
          maxSelect: 1,
        }),
      )
    }

    // mfa_verified_at: data da última validação do 2FA
    if (!usersCol.fields.getByName('mfa_verified_at')) {
      usersCol.fields.add(new DateField({ name: 'mfa_verified_at' }))
    }

    // last_revoked_at: data/hora da última revogação de sessão (desligamento/bloqueio)
    if (!usersCol.fields.getByName('last_revoked_at')) {
      usersCol.fields.add(new DateField({ name: 'last_revoked_at' }))
    }

    app.save(usersCol)

    // 2. Coleção de Códigos de Recuperação Seguros (Hash SHA-256 de uso único)
    // mfa_recovery_codes
    try {
      app.findCollectionByNameOrId('mfa_recovery_codes')
    } catch (_) {
      const recoveryCol = new Collection({
        name: 'mfa_recovery_codes',
        type: 'base',
        listRule: "@request.auth.id != '' && user_id = @request.auth.id",
        viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
        createRule: "@request.auth.id != ''",
        updateRule: null, // imutável (apenas marcar used)
        deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'code_hash_sha256', type: 'text', required: true },
          { name: 'is_used', type: 'bool' },
          { name: 'used_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_recov_user ON mfa_recovery_codes (user_id)',
          'CREATE INDEX idx_recov_hash ON mfa_recovery_codes (code_hash_sha256)',
        ],
      })
      app.save(recoveryCol)
    }
  },
  (app) => {
    try {
      const recCol = app.findCollectionByNameOrId('mfa_recovery_codes')
      app.delete(recCol)
    } catch (_) {}

    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol.fields.getByName('mfa_enabled')) usersCol.fields.removeByName('mfa_enabled')
      if (usersCol.fields.getByName('mfa_secret')) usersCol.fields.removeByName('mfa_secret')
      if (usersCol.fields.getByName('mfa_enforced')) usersCol.fields.removeByName('mfa_enforced')
      if (usersCol.fields.getByName('mfa_enforced_role'))
        usersCol.fields.removeByName('mfa_enforced_role')
      if (usersCol.fields.getByName('mfa_verified_at'))
        usersCol.fields.removeByName('mfa_verified_at')
      if (usersCol.fields.getByName('last_revoked_at'))
        usersCol.fields.removeByName('last_revoked_at')
      app.save(usersCol)
    } catch (_) {}
  },
)
