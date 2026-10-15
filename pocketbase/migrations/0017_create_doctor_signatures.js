migrate(
  (app) => {
    // Criação da coleção privada doctor_signatures
    // Acesso restrito ao próprio médico (@request.auth.id != '' && user_id = @request.auth.id)
    try {
      app.findCollectionByNameOrId('doctor_signatures')
    } catch (_) {
      const collection = new Collection({
        name: 'doctor_signatures',
        type: 'base',
        listRule: "@request.auth.id != '' && user_id = @request.auth.id",
        viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
        createRule: "@request.auth.id != '' && user_id = @request.auth.id",
        updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
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
          {
            name: 'signature_image',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 5242880, // 5MB max
            mimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
            protected: true, // Arquivo protegido pela regra da coleção
          },
          {
            name: 'file_name',
            type: 'text',
          },
          {
            name: 'file_hash_sha256',
            type: 'text',
          },
          {
            name: 'image_data_uri',
            type: 'text', // Armazena base64 data URI para renderização imediata e carimbo
          },
          {
            name: 'is_active',
            type: 'bool',
          },
          {
            name: 'last_verified_at',
            type: 'date',
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_doc_sig_user ON doctor_signatures (user_id)',
          'CREATE INDEX idx_doc_sig_hash ON doctor_signatures (file_hash_sha256)',
        ],
      })
      app.save(collection)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('doctor_signatures')
      app.delete(col)
    } catch (_) {}
  },
)
