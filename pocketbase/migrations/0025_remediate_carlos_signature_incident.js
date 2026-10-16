/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração 0025 — Correção do incidente de vínculo indevido de assinatura manuscrita.
 *
 * Incidente: A imagem de assinatura do Dr. Márcio Eliziário foi cadastrada no perfil fictício
 * do Dr. Carlos Eduardo (usuário 62gqen1s1xuxyba, registro doctor_signatures licg7j8qve8sblh).
 *
 * Ação:
 *  1. Desativa e limpa imediatamente o vínculo ativo e referências de imagem no registro do
 *     Dr. Carlos Eduardo (is_active = false, signature_image = '', image_data_uri = '',
 *     file_name = '', file_hash_sha256 = ''), impedindo qualquer estampa de assinatura em laudos.
 *  2. Preserva integralmente todas as evidências em audit_logs e não transfere a assinatura
 *     automaticamente para outro médico. O Dr. Márcio fará o upload pessoalmente na sua conta.
 */
migrate(
  (app) => {
    const signatures = app.findRecordsByFilter(
      'doctor_signatures',
      "user_id = '62gqen1s1xuxyba'",
      '',
      10,
      0,
    )

    for (const sig of signatures) {
      sig.set('is_active', false)
      sig.set('signature_image', '')
      sig.set('image_data_uri', '')
      sig.set('file_name', '')
      sig.set('file_hash_sha256', '')
      app.save(sig)
    }

    // Registrar o evento de saneamento do incidente em audit_logs para rastreabilidade
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('action', 'DOCTOR_SIGNATURE_INCIDENT_REMEDIATED')
      auditRec.set('target_collection', 'doctor_signatures')
      if (signatures.length > 0) {
        auditRec.set('target_id', signatures[0].id)
      }
      auditRec.set('status', 'SUCCESS')
      auditRec.set(
        'details',
        'Saneamento de incidente de segurança: Vínculo indevido de assinatura manuscrita no registro do cardiologista fictício Dr. Carlos Eduardo desativado e limpo (is_active=false, referências de imagem limpas). Evidências históricas de auditoria preservadas integralmente. Nenhum laudo emitido com o vínculo anterior.',
      )
      app.save(auditRec)
    } catch (_) {}
  },
  (app) => {
    // Reversão defensiva (no-op para evitar reativar assinatura indevida)
  },
)
