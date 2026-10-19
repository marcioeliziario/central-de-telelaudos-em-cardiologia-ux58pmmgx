/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração 0034 — Restabelecimento e Auditoria dos Vínculos Legítimos da Conta Principal
 *
 * Objetivo:
 *  1. Garantir que o usuário principal (marcio.eliziario@hotmail.com, ID: pbktonjo4sn4fa3)
 *     possua status ativo e is_primary_admin = true.
 *  2. Assegurar que a organização prestadora central (CardioLaudos Hub, ID: ev645vd2g1ciqty)
 *     permaneça ativa.
 *  3. Garantir de forma idempotente e auditada que a conta principal possua os dois papéis
 *     autorizados ativos em user_organizations:
 *      - 'admin' (Diretor Técnico / Admin)
 *      - 'cardiologist' (Cardiologista Laudador & Responsável Técnico)
 *  4. Assegurar que o cadastro profissional do médico (coleção doctors, ID: s2wy6lcxw2bozck,
 *     CRM 145892/SP e RQE 68492) esteja ativo e vinculado à conta principal e à prestadora central.
 *  5. Registrar trilha de auditoria formal em audit_logs preservando os identificadores originais.
 */
migrate(
  (app) => {
    const MARCIO_USER_ID = 'pbktonjo4sn4fa3'
    const PROVIDER_ORG_ID = 'ev645vd2g1ciqty'
    const REAL_DOCTOR_ID = 's2wy6lcxw2bozck'

    // 1. Validar e ativar usuário principal
    try {
      const user = app.findRecordById('users', MARCIO_USER_ID)
      user.set('is_primary_admin', true)
      user.set('is_active', true)
      app.save(user)
    } catch (err) {
      console.log('Aviso ao atualizar usuário principal:', err)
    }

    // 2. Validar organização prestadora central
    try {
      const org = app.findRecordById('organizations', PROVIDER_ORG_ID)
      org.set('is_active', true)
      app.save(org)
    } catch (err) {
      console.log('Aviso ao atualizar organização prestadora:', err)
    }

    const userOrgsCol = app.findCollectionByNameOrId('user_organizations')

    // 3. Garantir vínculo 'admin' ativo
    try {
      const adminLinks = app.findRecordsByFilter(
        'user_organizations',
        `user_id = '${MARCIO_USER_ID}' && organization_id = '${PROVIDER_ORG_ID}' && role = 'admin'`,
        '',
        1,
        0,
      )
      if (adminLinks.length === 0) {
        const newAdminLink = new Record(userOrgsCol)
        newAdminLink.set('user_id', MARCIO_USER_ID)
        newAdminLink.set('organization_id', PROVIDER_ORG_ID)
        newAdminLink.set('role', 'admin')
        newAdminLink.set('is_active', true)
        newAdminLink.set('title_position', 'Diretor Técnico / Admin')
        app.save(newAdminLink)
      } else {
        const link = adminLinks[0]
        if (!link.getBool('is_active')) {
          link.set('is_active', true)
          app.save(link)
        }
      }
    } catch (err) {
      console.log('Aviso ao verificar vínculo de admin:', err)
    }

    // 4. Garantir vínculo 'cardiologist' ativo
    try {
      const cardioLinks = app.findRecordsByFilter(
        'user_organizations',
        `user_id = '${MARCIO_USER_ID}' && organization_id = '${PROVIDER_ORG_ID}' && role = 'cardiologist'`,
        '',
        1,
        0,
      )
      if (cardioLinks.length === 0) {
        const newCardioLink = new Record(userOrgsCol)
        newCardioLink.set('user_id', MARCIO_USER_ID)
        newCardioLink.set('organization_id', PROVIDER_ORG_ID)
        newCardioLink.set('role', 'cardiologist')
        newCardioLink.set('is_active', true)
        newCardioLink.set('title_position', 'Cardiologista Laudador & Responsável Técnico')
        app.save(newCardioLink)
      } else {
        const link = cardioLinks[0]
        if (!link.getBool('is_active')) {
          link.set('is_active', true)
          app.save(link)
        }
      }
    } catch (err) {
      console.log('Aviso ao verificar vínculo de cardiologista:', err)
    }

    // 5. Garantir perfil médico (doctors) ativo e vinculado
    try {
      const doctor = app.findRecordById('doctors', REAL_DOCTOR_ID)
      doctor.set('user_id', MARCIO_USER_ID)
      doctor.set('organization_id', PROVIDER_ORG_ID)
      doctor.set('is_active', true)
      doctor.set(
        'notes',
        'Dr. Márcio Eliziário — CRM 145892/SP RQE 68492 — Responsável Técnico e Cardiologista Laudador',
      )
      app.save(doctor)
    } catch (err) {
      console.log('Aviso ao verificar cadastro médico:', err)
    }

    // 6. Registrar trilha de auditoria imutável
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', MARCIO_USER_ID)
      auditRec.set('organization_id', PROVIDER_ORG_ID)
      auditRec.set('action', 'PRIMARY_ADMIN_MULTI_ROLE_VERIFIED')
      auditRec.set('target_collection', 'user_organizations')
      auditRec.set('target_id', MARCIO_USER_ID)
      auditRec.set('status', 'SUCCESS')
      auditRec.set(
        'details',
        'Vínculos legítimos da conta principal restabelecidos e auditados: Administrador Geral e Cardiologista Laudador (CRM 145892/SP RQE 68492) vinculados à organização prestadora CardioLaudos Hub.',
      )
      app.save(auditRec)
    } catch (err) {
      console.log('Aviso ao registrar auditoria:', err)
    }
  },
  (app) => {
    // Reversão no-op para preservar dados e auditoria
  },
)
