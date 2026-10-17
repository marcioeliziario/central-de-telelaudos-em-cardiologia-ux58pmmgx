migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('report_signatures')
    if (!col.fields.getByName('validation_type')) {
      col.fields.add(
        new SelectField({
          name: 'validation_type',
          values: ['MANUAL_CONFERENCE', 'AUTOMATIC_CRYPTO'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('manual_conference_responsible_name')) {
      col.fields.add(new TextField({ name: 'manual_conference_responsible_name' }))
    }
    if (!col.fields.getByName('manual_conference_responsible_crm')) {
      col.fields.add(new TextField({ name: 'manual_conference_responsible_crm' }))
    }
    if (!col.fields.getByName('manual_conference_timestamp')) {
      col.fields.add(new DateField({ name: 'manual_conference_timestamp' }))
    }
    if (!col.fields.getByName('manual_conference_report_ref')) {
      col.fields.add(new TextField({ name: 'manual_conference_report_ref' }))
    }
    if (!col.fields.getByName('manual_conference_declaration')) {
      col.fields.add(new BoolField({ name: 'manual_conference_declaration' }))
    }
    if (!col.fields.getByName('manual_conference_notes')) {
      col.fields.add(new TextField({ name: 'manual_conference_notes' }))
    }
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('report_signatures')
      const fields = [
        'validation_type',
        'manual_conference_responsible_name',
        'manual_conference_responsible_crm',
        'manual_conference_timestamp',
        'manual_conference_report_ref',
        'manual_conference_declaration',
        'manual_conference_notes',
      ]
      for (const f of fields) {
        const field = col.fields.getByName(f)
        if (field) col.fields.remove(field)
      }
      app.save(col)
    } catch (_) {}
  },
)
