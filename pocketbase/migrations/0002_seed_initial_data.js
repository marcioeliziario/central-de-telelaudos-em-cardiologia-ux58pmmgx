migrate(
  (app) => {
    // Usuários de teste fictícios
    // 1. Admin Geral da Prestadora: marcio.eliziario@hotmail.com e admin@cardiolab.fake
    // 2. Cardiologista Laudador: dr.carlos@cardiolab.fake
    // 3. Gestor da Clínica Alfa: gestor.alfa@cardioalfa.fake
    // 4. Operador da Clínica Alfa: operador.alfa@cardioalfa.fake
    // 5. Gestor da Clínica Beta: gestora.beta@clinica-beta.fake

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const orgsCol = app.findCollectionByNameOrId('organizations')
    const userOrgsCol = app.findCollectionByNameOrId('user_organizations')
    const unitsCol = app.findCollectionByNameOrId('units')
    const doctorsCol = app.findCollectionByNameOrId('doctors')
    const patientsCol = app.findCollectionByNameOrId('patients')

    function getOrCreateUser(email, name, role) {
      try {
        return app.findAuthRecordByEmail('_pb_users_auth_', email)
      } catch (_) {
        const u = new Record(usersCol)
        u.setEmail(email)
        u.setPassword('Skip@Pass')
        u.setVerified(true)
        u.set('name', name)
        u.set('is_active', true)
        app.save(u)
        return u
      }
    }

    // 1. Criar Usuários
    const userMarcio = getOrCreateUser(
      'marcio.eliziario@hotmail.com',
      'Dr. Márcio Eliziário (Admin)',
      'admin',
    )
    const userAdmin = getOrCreateUser('admin@cardiolab.fake', 'Administrador Central', 'admin')
    const userCardio = getOrCreateUser(
      'dr.carlos@cardiolab.fake',
      'Dr. Carlos Eduardo Cardiologista',
      'cardiologist',
    )
    const userAlfaGestor = getOrCreateUser(
      'gestor.alfa@cardioalfa.fake',
      'Roberto Silva (Gestor Alfa)',
      'clinic_manager',
    )
    const userAlfaOp = getOrCreateUser(
      'operador.alfa@cardioalfa.fake',
      'Mariana Costa (Operadora Alfa)',
      'clinic_operator',
    )
    const userBetaGestor = getOrCreateUser(
      'gestora.beta@clinica-beta.fake',
      'Dra. Beatriz Mendes (Gestora Beta)',
      'clinic_manager',
    )

    // 2. Criar Organizações
    // Org 1: Prestadora Telelaudos
    let orgProvider
    try {
      orgProvider = app.findFirstRecordByData('organizations', 'cnpj', '11.111.111/0001-11')
    } catch (_) {
      orgProvider = new Record(orgsCol)
      orgProvider.set('name', 'CardioLaudos Central Telemedicina Ltda')
      orgProvider.set('trade_name', 'CardioLaudos Hub')
      orgProvider.set('cnpj', '11.111.111/0001-11')
      orgProvider.set('type', 'provider')
      orgProvider.set('is_active', true)
      orgProvider.set('city', 'São Paulo')
      orgProvider.set('state', 'SP')
      orgProvider.set('email', 'contato@cardiolab.fake')
      app.save(orgProvider)
    }

    // Org 2: Clínica Alfa (Contratante)
    let orgAlfa
    try {
      orgAlfa = app.findFirstRecordByData('organizations', 'cnpj', '22.222.222/0001-22')
    } catch (_) {
      orgAlfa = new Record(orgsCol)
      orgAlfa.set('name', 'Clínica Cardiológica Alfa S/S')
      orgAlfa.set('trade_name', 'Cardio Alfa Diagnósticos')
      orgAlfa.set('cnpj', '22.222.222/0001-22')
      orgAlfa.set('type', 'client')
      orgAlfa.set('is_active', true)
      orgAlfa.set('city', 'Campinas')
      orgAlfa.set('state', 'SP')
      orgAlfa.set('email', 'atendimento@cardioalfa.fake')
      app.save(orgAlfa)
    }

    // Org 3: Clínica Beta (Contratante)
    let orgBeta
    try {
      orgBeta = app.findFirstRecordByData('organizations', 'cnpj', '33.333.333/0001-33')
    } catch (_) {
      orgBeta = new Record(orgsCol)
      orgBeta.set('name', 'Instituto de Saúde Beta Ltda')
      orgBeta.set('trade_name', 'Beta Medicina Integrada')
      orgBeta.set('cnpj', '33.333.333/0001-33')
      orgBeta.set('type', 'client')
      orgBeta.set('is_active', true)
      orgBeta.set('city', 'Ribeirão Preto')
      orgBeta.set('state', 'SP')
      orgBeta.set('email', 'diretoria@clinica-beta.fake')
      app.save(orgBeta)
    }

    // 3. Vínculos user_organizations
    function linkUserOrg(userId, orgId, role, title) {
      try {
        const records = app.findRecordsByFilter(
          'user_organizations',
          `user_id = '${userId}' && organization_id = '${orgId}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) return records[0]
      } catch (_) {}
      const uo = new Record(userOrgsCol)
      uo.set('user_id', userId)
      uo.set('organization_id', orgId)
      uo.set('role', role)
      uo.set('is_active', true)
      uo.set('title_position', title)
      app.save(uo)
      return uo
    }

    linkUserOrg(userMarcio.id, orgProvider.id, 'admin', 'Diretor Técnico / Admin')
    linkUserOrg(userAdmin.id, orgProvider.id, 'admin', 'Administrador de Sistemas')
    linkUserOrg(userCardio.id, orgProvider.id, 'cardiologist', 'Cardiologista Laudador')
    linkUserOrg(userAlfaGestor.id, orgAlfa.id, 'clinic_manager', 'Diretor Clínico Alfa')
    linkUserOrg(userAlfaOp.id, orgAlfa.id, 'clinic_operator', 'Técnico em Enfermagem / ECG')
    linkUserOrg(userBetaGestor.id, orgBeta.id, 'clinic_manager', 'Responsável Técnica Beta')

    // 4. Unidades de Clínicas
    let unitAlfaMatriz
    try {
      unitAlfaMatriz = app.findFirstRecordByData('units', 'code', 'ALFA-01')
    } catch (_) {
      unitAlfaMatriz = new Record(unitsCol)
      unitAlfaMatriz.set('organization_id', orgAlfa.id)
      unitAlfaMatriz.set('name', 'Cardio Alfa - Unidade Centro')
      unitAlfaMatriz.set('code', 'ALFA-01')
      unitAlfaMatriz.set('cnes', '1234567')
      unitAlfaMatriz.set('address', 'Av. Barão de Itapura, 1200')
      unitAlfaMatriz.set('city', 'Campinas')
      unitAlfaMatriz.set('state', 'SP')
      unitAlfaMatriz.set('is_active', true)
      app.save(unitAlfaMatriz)
    }

    let unitBetaCentro
    try {
      unitBetaCentro = app.findFirstRecordByData('units', 'code', 'BETA-01')
    } catch (_) {
      unitBetaCentro = new Record(unitsCol)
      unitBetaCentro.set('organization_id', orgBeta.id)
      unitBetaCentro.set('name', 'Beta Saúde - Unidade Principal')
      unitBetaCentro.set('code', 'BETA-01')
      unitBetaCentro.set('cnes', '7654321')
      unitBetaCentro.set('address', 'Rua General Osório, 450')
      unitBetaCentro.set('city', 'Ribeirão Preto')
      unitBetaCentro.set('state', 'SP')
      unitBetaCentro.set('is_active', true)
      app.save(unitBetaCentro)
    }

    // 5. Cadastro de Médico da Prestadora
    try {
      app.findFirstRecordByData('doctors', 'crm', '145892')
    } catch (_) {
      const doc = new Record(doctorsCol)
      doc.set('user_id', userCardio.id)
      doc.set('organization_id', orgProvider.id)
      doc.set('crm', '145892')
      doc.set('crm_state', 'SP')
      doc.set('rqe', '68492')
      doc.set('specialty', 'Cardiologia Clínica e Eletrocardiografia')
      doc.set('is_active', true)
      doc.set('notes', 'Cardiologista titulado pela SBC, especialista em arritmias')
      app.save(doc)
    }

    // 6. Pacientes de Amostra (Clínica Alfa e Clínica Beta)
    try {
      app.findFirstRecordByData('patients', 'cpf', '111.222.333-44')
    } catch (_) {
      const p1 = new Record(patientsCol)
      p1.set('organization_id', orgAlfa.id)
      p1.set('unit_id', unitAlfaMatriz.id)
      p1.set('full_name', 'João Batista da Silva (Paciente Alfa)')
      p1.set('birth_date', '1968-04-15 00:00:00.000Z')
      p1.set('gender', 'M')
      p1.set('cpf', '111.222.333-44')
      p1.set('record_number', 'PRONT-ALFA-001')
      p1.set('phone', '(19) 99876-1122')
      p1.set('clinical_notes', 'Hipertenso, em uso de Losartana. Queixa de palpitação.')
      app.save(p1)
    }

    try {
      app.findFirstRecordByData('patients', 'cpf', '555.666.777-88')
    } catch (_) {
      const p2 = new Record(patientsCol)
      p2.set('organization_id', orgBeta.id)
      p2.set('unit_id', unitBetaCentro.id)
      p2.set('full_name', 'Helena Maria dos Santos (Paciente Beta)')
      p2.set('birth_date', '1975-09-22 00:00:00.000Z')
      p2.set('gender', 'F')
      p2.set('cpf', '555.666.777-88')
      p2.set('record_number', 'PRONT-BETA-889')
      p2.set('phone', '(16) 98711-4455')
      p2.set('clinical_notes', 'Avaliação pré-operatória de cirurgia eletiva de catarata.')
      app.save(p2)
    }
  },
  (app) => {
    // Rollback opcional
  },
)
