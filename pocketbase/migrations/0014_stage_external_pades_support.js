migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('report_signatures')
    const statusField = col.fields.getByName('signature_status')
    if (statusField) {
      statusField.values = [
        'NAO_INICIADA',
        'PENDENTE',
        'PROCESSANDO',
        'ASSINADA',
        'VALIDADA',
        'FALHA',
        'REJEITADA',
      ]
    }
    if (!col.fields.getByName('pades_detected')) {
      col.fields.add(new BoolField({ name: 'pades_detected' }))
    }
    if (!col.fields.getByName('signer_cpf')) {
      col.fields.add(new TextField({ name: 'signer_cpf' }))
    }
    if (!col.fields.getByName('signer_name')) {
      col.fields.add(new TextField({ name: 'signer_name' }))
    }
    if (!col.fields.getByName('signer_crm')) {
      col.fields.add(new TextField({ name: 'signer_crm' }))
    }
    if (!col.fields.getByName('validation_pending_reasons')) {
      col.fields.add(new TextField({ name: 'validation_pending_reasons' }))
    }
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('report_signatures')
      const fields = [
        'pades_detected',
        'signer_cpf',
        'signer_name',
        'signer_crm',
        'validation_pending_reasons',
      ]
      for (const f of fields) {
        const field = col.fields.getByName(f)
        if (field) col.fields.remove(field)
      }
      app.save(col)
    } catch (_) {}
  },
)
