migrate(
  (app) => {
    // 1. Coleção signing_providers: Registro dos provedores de assinatura digital e adaptadores
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!app.hasTable('signing_providers')) {
      const providersCol = new Collection({
        name: 'signing_providers',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: null, // Apenas superuser / admin via hooks
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'provider_key', type: 'text', required: true }, // 'integra_bry', 'birdid_pro'
          { name: 'display_name', type: 'text', required: true },
          { name: 'adapter_type', type: 'text', required: true }, // 'INTEGRA_BRY', 'BIRDID_CESS'
          { name: 'standard', type: 'text', required: true }, // 'PAdES ICP-Brasil'
          { name: 'is_active', type: 'bool' },
          { name: 'is_multiplexed', type: 'bool' }, // Integra Bry multiplexa múltiplos PSCs
          { name: 'supported_pscs', type: 'json' }, // ['birdid', 'safeid', 'serproid', 'remoteid', 'vidaas', 'dscloud', 'syn']
          { name: 'supported_scopes', type: 'json' }, // ['single_signature', 'multi_signature', 'signature_session']
          { name: 'min_lifetime_seconds', type: 'number' }, // 180
          { name: 'max_lifetime_seconds', type: 'number' }, // 604800 (7 dias)
          { name: 'base_url', type: 'text' },
          { name: 'documentation_url', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_sign_prov_key ON signing_providers (provider_key)'],
      })
      app.save(providersCol)

      // Seed dos provedores estruturados da arquitetura multiprovedor
      const provRecord1 = new Record(providersCol)
      provRecord1.set('provider_key', 'integra_bry')
      provRecord1.set('display_name', 'Integra Bry (Multiplexador PSC ICP-Brasil)')
      provRecord1.set('adapter_type', 'INTEGRA_BRY')
      provRecord1.set('standard', 'PAdES ICP-Brasil (ISO 32000-1 / ETSI EN 319 142)')
      provRecord1.set('is_active', false) // Standby aguardando credenciais comerciais Bry
      provRecord1.set('is_multiplexed', true)
      provRecord1.set(
        'supported_pscs',
        JSON.stringify([
          { id: 'birdid', name: 'Bird ID (Soluti)' },
          { id: 'safeid', name: 'SafeID (Safeweb)' },
          { id: 'serproid', name: 'SerproID (SERPRO)' },
          { id: 'remoteid', name: 'RemoteID (Certisign)' },
          { id: 'vidaas', name: 'VIDaaS (Valid)' },
          { id: 'dscloud', name: 'DS Cloud' },
          { id: 'syn', name: 'Syn' },
        ]),
      )
      provRecord1.set(
        'supported_scopes',
        JSON.stringify(['single_signature', 'multi_signature', 'signature_session']),
      )
      provRecord1.set('min_lifetime_seconds', 180)
      provRecord1.set('max_lifetime_seconds', 604800)
      provRecord1.set('base_url', 'https://hub2.bry.com.br')
      provRecord1.set('documentation_url', 'https://api.bry.com.br/docs/integra-bry')
      provRecord1.set(
        'notes',
        'Adaptador unificado SaaS/HTTPS que multiplexa múltiplos PSCs homologados ICP-Brasil.',
      )
      app.save(provRecord1)

      const provRecord2 = new Record(providersCol)
      provRecord2.set('provider_key', 'birdid_pro')
      provRecord2.set('display_name', 'Bird ID Pro (Soluti CESS Direto)')
      provRecord2.set('adapter_type', 'BIRDID_CESS')
      provRecord2.set('standard', 'PAdES ICP-Brasil (ISO 32000-1 / ETSI EN 319 142)')
      provRecord2.set('is_active', false) // Standby mantido
      provRecord2.set('is_multiplexed', false)
      provRecord2.set(
        'supported_pscs',
        JSON.stringify([{ id: 'birdid_soluti', name: 'Bird ID Soluti Direto' }]),
      )
      provRecord2.set('supported_scopes', JSON.stringify(['single_signature']))
      provRecord2.set('min_lifetime_seconds', 300)
      provRecord2.set('max_lifetime_seconds', 3600)
      provRecord2.set('base_url', 'https://cess.lab.vaultid.com.br')
      provRecord2.set('documentation_url', 'https://docs.vaultid.com.br/workspace/cess')
      provRecord2.set(
        'notes',
        'Conector direto Soluti CESS preservado com transação assíncrona TCN.',
      )
      app.save(provRecord2)
    }

    // 2. Coleção signing_sessions: Sessões temporárias autorizadas de assinatura dos médicos
    if (!app.hasTable('signing_sessions')) {
      const sessionsCol = new Collection({
        name: 'signing_sessions',
        type: 'base',
        listRule: '@request.auth.id != "" && user_id = @request.auth.id',
        viewRule: '@request.auth.id != "" && user_id = @request.auth.id',
        createRule: null, // Gestão estritamente controlada via backend pb_hooks
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'doctor_id',
            type: 'relation',
            required: false,
            collectionId: app.findCollectionByNameOrId('doctors').id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'provider_key', type: 'text', required: true }, // 'integra_bry' ou 'birdid_pro'
          { name: 'psc_id', type: 'text' }, // e.g. 'birdid', 'vidaas', 'safeid', 'serproid'
          { name: 'state_hash', type: 'text', required: true }, // Hash SHA-256 do state OAuth aleatório gerado
          { name: 'state_used', type: 'bool' }, // Prevenção estrita de reutilização (replay)
          { name: 'state_expires_at', type: 'date', required: true },
          { name: 'session_token_ciphertext', type: 'text' }, // Token temporário do PSC com criptografia autenticada AES-GCM em repouso
          { name: 'session_token_tag', type: 'text' }, // Tag de autenticação ou checksum do ciphertext
          {
            name: 'scope',
            type: 'select',
            values: ['single_signature', 'multi_signature', 'signature_session'],
            maxSelect: 1,
          },
          { name: 'lifetime_seconds', type: 'number' },
          { name: 'expires_at', type: 'date' },
          { name: 'signature_ready', type: 'bool' },
          { name: 'certificate_cn', type: 'text' },
          { name: 'certificate_issuer', type: 'text' },
          { name: 'certificate_subject_cpf', type: 'text' },
          { name: 'certificate_raw_base64', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['STATE_EMITTED', 'AUTHORIZED', 'REVOKED', 'EXPIRED', 'FAILED'],
            maxSelect: 1,
          },
          { name: 'is_simulated', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_sign_sess_user ON signing_sessions (user_id)',
          'CREATE INDEX idx_sign_sess_state ON signing_sessions (state_hash)',
          'CREATE INDEX idx_sign_sess_status ON signing_sessions (status)',
        ],
      })
      app.save(sessionsCol)
    }
  },
  (app) => {
    try {
      const sessCol = app.findCollectionByNameOrId('signing_sessions')
      app.delete(sessCol)
    } catch (_) {}
    try {
      const provCol = app.findCollectionByNameOrId('signing_providers')
      app.delete(provCol)
    } catch (_) {}
  },
)
