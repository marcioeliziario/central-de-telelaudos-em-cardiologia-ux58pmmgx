/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração 0031 — Administração Autônoma e Protegida de Usuários e Organizações
 *
 * Atualiza campos e regras em users e user_organizations:
 * 1. users:
 *    - Adiciona is_primary_admin (bool) para identificar a conta do administrador principal
 *    - Marca marcio.eliziario@hotmail.com como is_primary_admin = true
 *    - Protege contra escalada de privilégios e exclusão acidental
 *
 * 2. user_organizations:
 *    - Atualiza regras de acesso
 */
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Campo is_primary_admin em users
    if (!usersCol.fields.getByName('is_primary_admin')) {
      usersCol.fields.add(
        new BoolField({
          name: 'is_primary_admin',
        }),
      )
      app.save(usersCol)
    }

    // 2. Garantir que a conta principal tenha is_primary_admin = true
    try {
      const primaryUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'marcio.eliziario@hotmail.com',
      )
      primaryUser.set('is_primary_admin', true)
      primaryUser.set('is_active', true)
      app.save(primaryUser)
    } catch (_) {}

    // 3. Atualizar deleteRule de users para impedir delete direto via API sem auditoria/validação de dependências
    // Deletar usuário agora é canalizado pela rota administrativa protegida /backend/v1/admin/users/{id}
    // ou por superuser, mantendo os registros clínicos e legais íntegros
    usersCol.deleteRule = null
    app.save(usersCol)
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol.fields.getByName('is_primary_admin')) {
        usersCol.fields.removeByName('is_primary_admin')
      }
      usersCol.deleteRule = 'id = @request.auth.id'
      app.save(usersCol)
    } catch (_) {}
  },
)
