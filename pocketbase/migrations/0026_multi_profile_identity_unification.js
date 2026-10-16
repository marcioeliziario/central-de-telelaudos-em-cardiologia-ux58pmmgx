/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração 0026 — Múltiplos Perfis Funcionais para a Mesma Identidade Autenticada
 *
 * Objetivo:
 *  1. Recriar índice único de user_organizations como (user_id, organization_id, role)
 *     para permitir múltiplos papéis na mesma organização prestadora.
 *  2. Vincular o usuário real do Dr. Márcio Eliziário (id: pbktonjo4sn4fa3) com o papel
 *     adicional de 'cardiologist' na organização prestadora (ev645vd2g1ciqty), de forma idempotente.
 *  3. Unificar o registro médico real: apontar o registro de doctors com CRM 145892/SP e RQE 68492
 *     (id: s2wy6lcxw2bozck) para o user_id real do Dr. Márcio (pbktonjo4sn4fa3).
 *  4. Neutralizar o registro temporário de doctors (id: p853hav83jrm392, CRM 998877/SP):
 *     marcar is_active = false e notas explicativas, garantindo não quebrar referências nem histórico.
 *  5. Auditar o evento de unificação em audit_logs.
 */
migrate(
  (app) => {
    // 1. Recriar índice único em user_organizations: (user_id, organization_id, role)
    const userOrgsCol = app.findCollectionByNameOrId('user_organizations')
    try {
      userOrgsCol.removeIndex('idx_user_org_unique')
    } catch (_) {}

    userOrgsCol.addIndex('idx_user_org_role_unique', true, 'user_id, organization_id, role', '')
    app.save(userOrgsCol)

    // IDs verificados da instância Skip Cloud
    const MARCIO_USER_ID = 'pbktonjo4sn4fa3'
    const PROVIDER_ORG_ID = 'ev645vd2g1ciqty'
    const REAL_DOCTOR_ID = 's2wy6lcxw2bozck'
    const TEMP_DOCTOR_ID = 'p853hav83jrm392'

    // 2. Garantir vínculo 'cardiologist' para Dr. Márcio em user_organizations
    const existingCardioLink = app.findRecordsByFilter(
      'user_organizations',
      `user_id = '${MARCIO_USER_ID}' && organization_id = '${PROVIDER_ORG_ID}' && role = 'cardiologist'`,
      '',
      1,
      0,
    )

    if (existingCardioLink.length === 0) {
      const newCardioRecord = new Record(userOrgsCol)
      newCardioRecord.set('user_id', MARCIO_USER_ID)
      newCardioRecord.set('organization_id', PROVIDER_ORG_ID)
      newCardioRecord.set('role', 'cardiologist')
      newCardioRecord.set('is_active', true)
      newCardioRecord.set('title_position', 'Cardiologista Laudador & Responsável Técnico')
      app.save(newCardioRecord)
    }

    // 3. Unificar o registro médico real (s2wy6lcxw2bozck) apontando para pbktonjo4sn4fa3
    try {
      const realDocRecord = app.findRecordById('doctors', REAL_DOCTOR_ID)
      realDocRecord.set('user_id', MARCIO_USER_ID)
      realDocRecord.set('is_active', true)
      realDocRecord.set(
        'notes',
        'Dr. Márcio Eliziário — CRM 145892/SP RQE 68492 — Responsável Técnico e Cardiologista Laudador',
      )
      app.save(realDocRecord)
    } catch (err) {
      console.log('Aviso ao atualizar perfil médico real:', err)
    }

    // 4. Neutralizar o registro temporário (p853hav83jrm392)
    try {
      const tempDocRecord = app.findRecordById('doctors', TEMP_DOCTOR_ID)
      tempDocRecord.set('is_active', false)
      tempDocRecord.set(
        'notes',
        'Registro temporário 998877/SP neutralizado na migração 0026. Unificado no perfil real CRM 145892/SP (s2wy6lcxw2bozck).',
      )
      app.save(tempDocRecord)
    } catch (err) {
      console.log('Aviso ao neutralizar perfil médico temporário:', err)
    }

    // 5. Garantir que autor em rascunhos vinculados ao exame do Dr. Márcio aponte para o usuário unificado
    try {
      const drafts = app.findRecordsByFilter(
        'report_drafts',
        `doctor_id = '${REAL_DOCTOR_ID}'`,
        '',
        50,
        0,
      )
      for (const d of drafts) {
        if (d.getString('author_id') === '62gqen1s1xuxyba') {
          d.set('author_id', MARCIO_USER_ID)
          app.save(d)
        }
      }
    } catch (_) {}

    // 6. Registrar trilha de auditoria
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', MARCIO_USER_ID)
      auditRec.set('organization_id', PROVIDER_ORG_ID)
      auditRec.set('action', 'MULTI_ROLE_DOCTOR_PROFILE_UNIFIED')
      auditRec.set('target_collection', 'doctors')
      auditRec.set('target_id', REAL_DOCTOR_ID)
      auditRec.set('status', 'SUCCESS')
      auditRec.set(
        'details',
        'Unificação de identidade médica concluída na migração 0026. Dr. Márcio Eliziário habilitado como Admin e Cardiologista (CRM 145892/SP, RQE 68492) com mesma identidade de login.',
      )
      app.save(auditRec)
    } catch (_) {}
  },
  (app) => {
    // Reversão defensiva do índice
    const userOrgsCol = app.findCollectionByNameOrId('user_organizations')
    try {
      userOrgsCol.removeIndex('idx_user_org_role_unique')
    } catch (_) {}
    userOrgsCol.addIndex('idx_user_org_unique', true, 'user_id, organization_id', '')
    app.save(userOrgsCol)
  },
)
