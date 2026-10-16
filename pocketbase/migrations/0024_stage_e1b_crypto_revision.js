migrate(
  (app) => {
    // 1. Enriquecer signing_sessions com campos para envelope criptográfico padronizado AES-256-GCM
    const sessCol = app.findCollectionByNameOrId('signing_sessions')

    if (!sessCol.fields.getByName('encryption_algorithm')) {
      sessCol.fields.add(
        new TextField({
          name: 'encryption_algorithm',
          required: false,
        }),
      )
    }

    if (!sessCol.fields.getByName('key_version')) {
      sessCol.fields.add(
        new TextField({
          name: 'key_version',
          required: false,
        }),
      )
    }

    if (!sessCol.fields.getByName('crypto_envelope_json')) {
      sessCol.fields.add(
        new JSONField({
          name: 'crypto_envelope_json',
          maxSize: 65536,
        }),
      )
    }

    app.save(sessCol)
  },
  (app) => {
    try {
      const sessCol = app.findCollectionByNameOrId('signing_sessions')
      const algField = sessCol.fields.getByName('encryption_algorithm')
      if (algField) sessCol.fields.remove(algField.id)
      const verField = sessCol.fields.getByName('key_version')
      if (verField) sessCol.fields.remove(verField.id)
      const envField = sessCol.fields.getByName('crypto_envelope_json')
      if (envField) sessCol.fields.remove(envField.id)
      app.save(sessCol)
    } catch (_) {}
  },
)
