migrate(
  (app) => {
    const orgsCol = app.findCollectionByNameOrId('organizations')
    const doctorsCol = app.findCollectionByNameOrId('doctors')
    const examsCol = app.findCollectionByNameOrId('exam_requests')
    const patientsCol = app.findCollectionByNameOrId('patients')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const ecgReportsCol = app.findCollectionByNameOrId('ecg_reports')

    // 1. Coleção: report_documents (Documentos médicos gerados em PDF com hash SHA-256 e versão exata)
    const reportDocumentsCollection = new Collection({
      name: 'report_documents',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null, // Bloqueado: versões preparadas para assinatura são estritamente imutáveis
      deleteRule: null, // Bloqueado: documentos médicos têm valor probatório e não podem ser excluídos
      fields: [
        {
          name: 'exam_request_id',
          type: 'relation',
          required: true,
          collectionId: examsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'patient_id',
          type: 'relation',
          required: true,
          collectionId: patientsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'doctor_id',
          type: 'relation',
          required: true,
          collectionId: doctorsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'ecg_report_id',
          type: 'relation',
          collectionId: ecgReportsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'document_code', type: 'text', required: true },
        { name: 'version', type: 'number', required: true },
        {
          name: 'pdf_file',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 15728640, // 15MB
          mimeTypes: ['application/pdf'],
          protected: true, // Arquivo estritamente protegido, nunca em URL pública
        },
        { name: 'file_hash_sha256', type: 'text', required: true },
        { name: 'file_size_bytes', type: 'number' },
        { name: 'is_preview', type: 'bool' },
        { name: 'is_prepared_for_signature', type: 'bool' },
        { name: 'is_locked', type: 'bool' }, // Bloqueio lógico de alteração da versão
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'generated_at', type: 'date', required: true },
        { name: 'content_snapshot', type: 'text' }, // Snapshot JSON serializado do laudo
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_repdocs_exam ON report_documents (exam_request_id)',
        'CREATE INDEX idx_repdocs_version ON report_documents (exam_request_id, version DESC)',
        'CREATE UNIQUE INDEX idx_repdocs_code ON report_documents (document_code)',
        'CREATE INDEX idx_repdocs_hash ON report_documents (file_hash_sha256)',
      ],
    })
    app.save(reportDocumentsCollection)
    const reportDocsId = reportDocumentsCollection.id

    // 2. Coleção: report_signatures (Estrutura para futura assinatura PAdES ICP-Brasil)
    const reportSignaturesCollection = new Collection({
      name: 'report_signatures',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null, // Imutabilidade de histórico de assinaturas
      fields: [
        {
          name: 'report_document_id',
          type: 'relation',
          required: true,
          collectionId: reportDocsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'exam_request_id',
          type: 'relation',
          required: true,
          collectionId: examsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'doctor_id',
          type: 'relation',
          required: true,
          collectionId: doctorsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'signing_provider',
          type: 'text', // Ex: 'ICP_BRASIL_LOCAL', 'GOV_BR', 'VIDAAS', 'SAFEWEB' (futuro)
        },
        {
          name: 'transaction_id',
          type: 'text', // Identificador da transação com o provedor
        },
        {
          name: 'signature_status',
          type: 'select',
          required: true,
          values: ['NAO_INICIADA', 'PENDENTE', 'PROCESSANDO', 'ASSINADA', 'VALIDADA', 'FALHA'],
          maxSelect: 1,
        },
        { name: 'requested_at', type: 'date' },
        { name: 'completed_at', type: 'date' },
        {
          name: 'signature_evidence',
          type: 'text', // Metadados técnicos, certificado em x509, carimbo do tempo
        },
        {
          name: 'signed_pdf_file',
          type: 'file',
          maxSelect: 1,
          maxSize: 15728640,
          mimeTypes: ['application/pdf'],
          protected: true,
        },
        { name: 'signed_file_hash_sha256', type: 'text' },
        {
          name: 'cryptographic_validation_result',
          type: 'text', // Resultado da validação do envelope PAdES / ICP-Brasil
        },
        { name: 'is_clinically_released', type: 'bool' }, // Somente true após VALIDADA
        { name: 'rejection_reason', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_repsig_doc ON report_signatures (report_document_id)',
        'CREATE INDEX idx_repsig_exam ON report_signatures (exam_request_id)',
        'CREATE INDEX idx_repsig_doctor ON report_signatures (doctor_id)',
        'CREATE INDEX idx_repsig_status ON report_signatures (signature_status)',
      ],
    })
    app.save(reportSignaturesCollection)
  },
  (app) => {
    const collections = ['report_signatures', 'report_documents']
    for (const name of collections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
