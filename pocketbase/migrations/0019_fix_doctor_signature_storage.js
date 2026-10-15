/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração 0019 — Correção do armazenamento da assinatura manuscrita.
 * Estado anterior: registros de doctor_signatures com file_name e file_hash_sha256
 * preenchidos, mas signature_image e image_data_uri VAZIOS, porque o hook gravava
 * a string Base64 diretamente em $filesystem.fileFromBytes (que exige binário).
 * Ação:
 *  - Desativa e limpa o registro do cardiologista FICTÍCIO Dr. Carlos Eduardo
 *    (licg7j8qve8sblh, user 62gqen1s1xuxyba) — ele NÃO deve usar a assinatura
 *    de outro médico. Fica pendente do envio do arquivo próprio dele.
 *  - O binário do PNG do Dr. Márcio Eliziário (registro kdvmo04fbrhvzvd) é gravado
 *    no storage privado pelo hook de sincronização (/backend/v1/doctor/signature/sync-initial),
 *    pois $filesystem não está exposto a migrations — apenas a hooks de rota.
 */
migrate(
  (app) => {
    const signatures = app.findRecordsByFilter('doctor_signatures', '', '', 100, 0)

    for (const sig of signatures) {
      const userId = sig.getString('user_id')

      if (userId === '62gqen1s1xuxyba') {
        // Dr. Carlos Eduardo (FICTÍCIO) — não pode apontar para assinatura de outro médico.
        sig.set('is_active', false)
        sig.set('signature_image', '')
        sig.set('image_data_uri', '')
        sig.set('file_name', '')
        sig.set('file_hash_sha256', '')
        app.save(sig)
        continue
      }

      if (userId === 'pbktonjo4sn4fa3') {
        // Dr. Márcio Eliziário — apenas marca como ativo; o binário físico é gravado
        // via rota de sincronização do hook (auth_session_security.js), que possui
        // acesso a $filesystem.
        if (!sig.getBool('is_active')) {
          sig.set('is_active', true)
          app.save(sig)
        }
        continue
      }
    }
  },
  (app) => {
    // Reversão: retorna o registro do Dr. Carlos ao estado anterior documentado
    // (ativo, sem arquivo) e mantém o registro do Dr. Márcio como estava.
    const reverts = app.findRecordsByFilter(
      'doctor_signatures',
      "user_id = '62gqen1s1xuxyba'",
      '',
      1,
      0,
    )
    if (reverts.length > 0) {
      reverts[0].set('is_active', true)
      app.save(reverts[0])
    }
  },
)
