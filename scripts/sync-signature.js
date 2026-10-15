// Sincronização real da assinatura manuscrita do Dr. Márcio Eliziário.
// Lê o PNG processado, calcula o SHA-256 e chama a rota autenticada
// /backend/v1/doctor/signature/sync-initial do backend PocketBase (Skip Cloud).
// Credenciais apenas via variáveis de ambiente (nunca hardcode).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const BACKEND_URL =
  process.env.SIGNATURE_BACKEND_URL ||
  'https://central-de-telelaudos-em-cardiologia-7023e.shrd01.internal.goskip.dev'
const EMAIL = process.env.SIGNATURE_EMAIL
const PASSWORD = process.env.SIGNATURE_PASSWORD
const FILE_NAME = 'assinatura-medica-principal-transparente.png'
const EXPECTED_SHA256 = 'd7cbcf1eb4ba520ae1e52ee3b216ec711a7c807212f86641b6c867fa2032e366'

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Defina SIGNATURE_EMAIL e SIGNATURE_PASSWORD no ambiente antes de executar.')
    process.exit(1)
  }

  const assetPath = path.resolve('src/assets/assinatura-medica-principal-transparente.png')
  const png = fs.readFileSync(assetPath)
  const sha256 = crypto.createHash('sha256').update(png).digest('hex')

  console.log(`Arquivo: ${assetPath} (${png.length} bytes)`)
  console.log(`SHA-256 local: ${sha256}`)
  console.log(`SHA-256 esperado: ${EXPECTED_SHA256}`)
  if (sha256 !== EXPECTED_SHA256) {
    console.error('O arquivo processado difere do hash esperado. Abortando.')
    process.exit(1)
  }

  const dataUri = `data:image/png;base64,${png.toString('base64')}`

  // 1. Login real (respeita senha; MFA é respeitado pelo backend caso habilitado)
  const loginRes = await fetch(`${BACKEND_URL}/api/collections/users/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  })
  if (!loginRes.ok) {
    console.error(`Login falhou: HTTP ${loginRes.status}`)
    process.exit(1)
  }
  const loginJson = await loginRes.json()
  const token = loginJson.token
  console.log(`Login OK (usuário: ${loginJson.record?.id})`)

  // 2. Chamada EFETIVA à rota autenticada de sincronização da assinatura
  const syncRes = await fetch(`${BACKEND_URL}/backend/v1/doctor/signature/sync-initial`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({
      user_id: loginJson.record.id,
      image_data_uri: dataUri,
      file_name: FILE_NAME,
      file_hash_sha256: sha256,
    }),
  })
  const syncText = await syncRes.text()
  console.log(`sync-initial: HTTP ${syncRes.status} → ${syncText}`)
  if (!syncRes.ok) process.exit(1)

  // 3. Verificação: buscar a assinatura do médico autenticado
  const checkRes = await fetch(`${BACKEND_URL}/backend/v1/doctor/signature/current`, {
    method: 'GET',
    headers: { Authorization: token },
  })
  const checkJson = await checkRes.json()
  console.log(`current: HTTP ${checkRes.status} → ${JSON.stringify(checkJson)}`)

  // 4. Download do binário persistido no storage privado e conferência do SHA-256
  const sig = checkJson.signature
  if (sig && sig.signatureFile) {
    const fileUrl = `${BACKEND_URL}/api/files/doctor_signatures/${sig.id}/${sig.signatureFile}`
    const fileRes = await fetch(fileUrl, {
      headers: { Authorization: token },
    })
    if (fileRes.ok) {
      const stored = Buffer.from(await fileRes.arrayBuffer())
      const storedSha = crypto.createHash('sha256').update(stored).digest('hex')
      console.log(`Binário recuperado do storage: ${stored.length} bytes`)
      console.log(`SHA-256 do arquivo armazenado: ${storedSha}`)
      console.log(`IGUAL ao esperado: ${storedSha === EXPECTED_SHA256}`)
    } else {
      console.error(`Falha ao recuperar binário: HTTP ${fileRes.status}`)
    }
  } else {
    console.error('signature_image vazio — binário não persistido!')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
