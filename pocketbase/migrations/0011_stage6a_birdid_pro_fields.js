migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('report_signatures')

    if (!col.fields.getByName('tcn')) {
      col.fields.add(new TextField({ name: 'tcn' }))
    }
    if (!col.fields.getByName('certificate_alias')) {
      col.fields.add(new TextField({ name: 'certificate_alias' }))
    }
    if (!col.fields.getByName('callback_received_at')) {
      col.fields.add(new DateField({ name: 'callback_received_at' }))
    }
    if (!col.fields.getByName('external_status')) {
      col.fields.add(new TextField({ name: 'external_status' }))
    }
    if (!col.fields.getByName('is_simulated')) {
      col.fields.add(new BoolField({ name: 'is_simulated' }))
    }

    app.save(col)

    // Índice idempotente para busca rápida por TCN
    try {
      col.addIndex('idx_repsig_tcn', false, 'tcn', '')
      app.save(col)
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('report_signatures')
      col.removeIndex('idx_repsig_tcn')
      const fieldsToRemove = [
        'tcn',
        'certificate_alias',
        'callback_received_at',
        'external_status',
        'is_simulated',
      ]
      for (const f of fieldsToRemove) {
        const field = col.fields.getByName(f)
        if (field) col.fields.remove(field)
      }
      app.save(col)
    } catch (_) {}
  },
)
