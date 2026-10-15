migrate(
  (app) => {
    const examsCol = app.findCollectionByNameOrId('exam_requests')
    const fileField = examsCol.fields.getByName('exam_file')
    if (fileField) {
      fileField.required = false
      app.save(examsCol)
    }

    let pAlfa, pBeta, orgAlfa, orgBeta, unitAlfa, unitBeta, userAlfaOp, userBetaGestor
    try {
      pAlfa = app.findFirstRecordByData('patients', 'cpf', '111.222.333-44')
      pBeta = app.findFirstRecordByData('patients', 'cpf', '555.666.777-88')
      orgAlfa = app.findFirstRecordByData('organizations', 'cnpj', '22.222.222/0001-22')
      orgBeta = app.findFirstRecordByData('organizations', 'cnpj', '33.333.333/0001-33')
      unitAlfa = app.findFirstRecordByData('units', 'code', 'ALFA-01')
      unitBeta = app.findFirstRecordByData('units', 'code', 'BETA-01')
      userAlfaOp = app.findAuthRecordByEmail('_pb_users_auth_', 'operador.alfa@cardioalfa.fake')
      userBetaGestor = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'gestora.beta@clinica-beta.fake',
      )
    } catch (e) {
      console.log('Erro ao buscar entidades:', e)
    }

    if (pAlfa && orgAlfa && userAlfaOp) {
      try {
        const ex1 = new Record(examsCol)
        ex1.set('organization_id', orgAlfa.id)
        if (unitAlfa) ex1.set('unit_id', unitAlfa.id)
        ex1.set('patient_id', pAlfa.id)
        ex1.set('requested_by', userAlfaOp.id)
        ex1.set('status', 'pending')
        ex1.set('urgency', 'routine')
        ex1.set('clinical_indication', 'Avaliação de palpitações e síncope prévia em repouso')
        ex1.set('symptoms', 'Palpitações esporádicas aos médios esforços')
        ex1.set('medications_in_use', 'Losartana 50mg 1x ao dia')
        ex1.set('has_pacemaker', false)
        ex1.set('exam_date', new Date().toISOString())
        ex1.set('priority_score', 10)
        app.save(ex1)
      } catch (e) {
        console.log('Erro ao salvar ex1:', e)
      }

      try {
        const ex2 = new Record(examsCol)
        ex2.set('organization_id', orgAlfa.id)
        if (unitAlfa) ex2.set('unit_id', unitAlfa.id)
        ex2.set('patient_id', pAlfa.id)
        ex2.set('requested_by', userAlfaOp.id)
        ex2.set('status', 'pending')
        ex2.set('urgency', 'urgent')
        ex2.set('clinical_indication', 'Dor torácica atípica e dispneia aos esforços moderados')
        ex2.set('symptoms', 'Desconforto precordial com irradiação para membro superior')
        ex2.set('medications_in_use', 'AAS 100mg, Atorvastatina 20mg')
        ex2.set('has_pacemaker', false)
        ex2.set('exam_date', new Date().toISOString())
        ex2.set('priority_score', 50)
        app.save(ex2)
      } catch (e) {
        console.log('Erro ao salvar ex2:', e)
      }
    }

    if (pBeta && orgBeta && userBetaGestor) {
      try {
        const ex3 = new Record(examsCol)
        ex3.set('organization_id', orgBeta.id)
        if (unitBeta) ex3.set('unit_id', unitBeta.id)
        ex3.set('patient_id', pBeta.id)
        ex3.set('requested_by', userBetaGestor.id)
        ex3.set('status', 'pending')
        ex3.set('urgency', 'emergency')
        ex3.set('clinical_indication', 'Suspeita de Bloqueio AV de alto grau / Bradiarritmia grave')
        ex3.set('symptoms', 'Tontura intensa, pré-síncope e palidez cutânea súbita')
        ex3.set('medications_in_use', 'Metoprolol 50mg 2x ao dia')
        ex3.set('has_pacemaker', false)
        ex3.set('exam_date', new Date().toISOString())
        ex3.set('priority_score', 100)
        app.save(ex3)
      } catch (e) {
        console.log('Erro ao salvar ex3:', e)
      }
    }
  },
  (app) => {},
)
