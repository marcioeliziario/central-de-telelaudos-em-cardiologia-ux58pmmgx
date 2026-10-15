// Verificação independente: consulta o registro doctor_signatures do Dr. Márcio,
// confirma signature_image preenchido, baixa o binário do storage privado
// e compara o SHA-256 com o valor esperado d7cbcf1e…2e366.
import PocketBase from 'pocketbase'
import crypto from 'node:crypto'

const BACKEND_URL =
  process.env.SIGNATURE_BACKEND_URL ||
  'https://central-de-telelaudos-em-cardiologia-7023e.shrd01.internal.goskip.dev'
const EMAIL = process.env.SIGNATURE_EMAIL
const PASSWORD = process.env.SIGNATURE_PASSWORD
const EXPECTED_SHA256 = 'd7cbcf1eb4ba520ae1e52ee3b216ec711a7c807212f86641b6c867fa2032e366'

async function main() {
  const c = new PocketBase(BACKEND_URL)
  await c.collection('users').authWithPassword(EMAIL, PASSWORD)

  const sig = await c.send('/backend/v1/doctor/signature/current', { method: 'GET' })
  if (!sig.hasSignature) {
    console.error('Nenhuma assinatura ativa registrada para o médico autenticado.')
    process.exit(1)
  }

  console.log(`Registro doctor_signatures: id=${sig.signature.id}`)
  console.log(`  fileName: ${sig.signature.fileName}`)
  console.log(`  fileHashSha256 (campo): ${sig.signature.fileHashSha256}`)
  console.log(`  signature_image (storage): ${sig.signature.signatureFile || '(VAZIO)'}`)
  console.log(`  isActive: ${sig.signature.isActive}`)

  if (!sig.signature.signatureFile) {
    console.error('signature_image VAZIO — binário não persistido no storage privado.')
    process.exit(1)
  }

  const fileUrl = `${BACKEND_URL}/api/files/doctor_signatures/${sig.signature.id}/${sig.signature.signatureFile}`
  const fileRes = await fetch(fileUrl, { headers: { Authorization: c.authStore.token } })
  if (!fileRes.ok) {
    console.error(`Falha ao recuperar binário: HTTP ${fileRes.status}`)
    process.exit(1)
  }
  const bytes = Buffer.from(await fileRes.arrayBuffer())
  const sha = crypto.createHash('sha256').update(bytes).digest('hex')
  console.log(`Binário recuperado do storage privado: ${bytes.length} bytes`)
  console.log(`SHA-256 do arquivo armazenado: ${sha}`)
  console.log(`IGUAL ao esperado (d7cbcf1e…2e366): ${sha === EXPECTED_SHA256}`)

  if (sha !== EXPECTED_SHA256) process.exit(1)
  console.log('Verificação de armazenamento: OK.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
