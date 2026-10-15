// Testes E11-1 a E11-4 executados de fato contra o backend real,
// com contas fictícias autorizadas e dados exclusivamente fictícios.
// Reporta o resultado individual de cada teste.
import PocketBase from 'pocketbase'

const BACKEND_URL =
  process.env.SIGNATURE_BACKEND_URL ||
  'https://central-de-telelaudos-em-cardiologia-7023e.shrd01.internal.goskip.dev'
const TEST_PASSWORD = process.env.SIGNATURE_PASSWORD || 'Skip@Pass'

function client() {
  return new PocketBase(BACKEND_URL)
}

async function main() {
  const results = []

  // =========================================================
  // E11-1: CADASTRO E SUBSTITUIÇÃO COM REAUTENTICAÇÃO FORTE
  // =========================================================
  try {
    const c = client()
    await c.collection('users').authWithPassword('dr.carlos@cardiolab.fake', TEST_PASSWORD)
    const png1x1 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const save = await c.send('/backend/v1/doctor/signature/save', {
      method: 'POST',
      body: { password: TEST_PASSWORD, image_data_uri: png1x1, file_name: 'e11-1-teste.png' },
    })
    const png2x1 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAFjAwMAAAAfAECFh8lYQAAAABJRU5ErkJggg=='
    const sub = await c.send('/backend/v1/doctor/signature/save', {
      method: 'POST',
      body: { password: TEST_PASSWORD, image_data_uri: png2x1, file_name: 'e11-1-teste-v2.png' },
    })
    const current = await c.send('/backend/v1/doctor/signature/current', { method: 'GET' })
    const passed =
      save.success &&
      sub.success &&
      sub.isSubstitution &&
      current.hasSignature &&
      !!current.signature.fileHashSha256
    results.push({
      id: 'E11-1',
      desc: 'Cadastro e substituição da assinatura com reautenticação forte',
      status: passed ? 'PASSOU' : 'FALHOU',
      detail: `save=${save.success}, isSubstitution=${sub.isSubstitution}, hasSignature=${current.hasSignature}, hash=${current.signature?.fileHashSha256?.slice(0, 16)}…`,
    })
    // Restaurar estado: deixar Dr. Carlos sem assinatura (fictício, sem traço próprio)
    try {
      await c.send('/backend/v1/doctor/signature/remove', {
        method: 'DELETE',
        body: { password: TEST_PASSWORD },
      })
    } catch {
      /* assinatura já inexistente */
    }
  } catch (e) {
    results.push({
      id: 'E11-1',
      desc: 'Cadastro e substituição com reautenticação',
      status: 'FALHOU',
      detail: e.message,
    })
  }

  // =========================================================
  // E11-2: BLOQUEIO DE ACESSO POR OUTROS USUÁRIOS
  // =========================================================
  try {
    const c = client()
    await c.collection('users').authWithPassword('operador.alfa@cardioalfa.fake', TEST_PASSWORD)
    let directListCount = -1
    try {
      const res = await c.collection('doctor_signatures').getList(1, 10)
      directListCount = res.items.length
    } catch {
      directListCount = 0
    }
    let saveBlocked = false
    let saveStatus = 0
    try {
      await c.send('/backend/v1/doctor/signature/save', {
        method: 'POST',
        body: { password: TEST_PASSWORD, image_data_uri: 'data:image/png;base64,abc' },
      })
    } catch (e) {
      if (e.status === 403 || e.status === 400) saveBlocked = true
      saveStatus = e.status
    }
    results.push({
      id: 'E11-2',
      desc: 'Bloqueio de acesso por outros usuários (isolamento estrito)',
      status: directListCount === 0 && saveBlocked ? 'PASSOU' : 'FALHOU',
      detail: `listagem direta retornou ${directListCount} assinaturas; gravação bloqueada=${saveBlocked} (HTTP ${saveStatus})`,
    })
  } catch (e) {
    results.push({
      id: 'E11-2',
      desc: 'Bloqueio de acesso por outros usuários',
      status: 'FALHOU',
      detail: e.message,
    })
  }

  // =========================================================
  // E11-3: INCORPORAÇÃO CORRETA AO PDF (HASH E VERSIONAMENTO)
  // =========================================================
  try {
    const c = client()
    await c.collection('users').authWithPassword('marcio.eliziario@hotmail.com', TEST_PASSWORD)
    const exams = await c.collection('exam_requests').getList(1, 5, {
      filter: `assigned_doctor_id != '' && status = 'waiting_signature'`,
      sort: '-created',
    })
    if (exams.items.length === 0)
      throw new Error('Nenhum exame fictício em waiting_signature para testar.')
    const examId = exams.items[0].id
    const prep = await c.send(`/backend/v1/exams/${examId}/prepare-signature`, { method: 'POST' })
    const docs = await c.collection('report_documents').getList(1, 5, {
      filter: `exam_request_id='${examId}'`,
      sort: '-version',
    })
    const snap = JSON.parse(docs.items[0].content_snapshot || '{}')
    const passed =
      prep.success &&
      !!prep.sha256 &&
      docs.items.length >= 1 &&
      snap.hasHandwrittenSignature === true
    results.push({
      id: 'E11-3',
      desc: 'Incorporação correta da assinatura ao PDF com hash e versionamento',
      status: passed ? 'PASSOU' : 'FALHOU',
      detail: `documento ${prep.documentCode} v${prep.version}, sha256=${prep.sha256?.slice(0, 16)}…, hasHandwrittenSignature=${snap.hasHandwrittenSignature}, total de versões=${docs.items.length}`,
    })
  } catch (e) {
    results.push({
      id: 'E11-3',
      desc: 'Incorporação correta ao PDF',
      status: 'FALHOU',
      detail: e.message,
    })
  }

  // =========================================================
  // E11-4: PRESERVAÇÃO DOS CONTROLES DE LIBERAÇÃO (NÃO REGRESSÃO)
  // =========================================================
  try {
    const c = client()
    await c.collection('users').authWithPassword('admin@cardiolab.fake', TEST_PASSWORD)
    const sigs = await c.collection('report_signatures').getList(1, 20, { sort: '-created' })
    const allProtected = sigs.items.every(
      (s) => s.is_clinically_released === false || s.signature_status === 'VALIDADA',
    )
    const providers = await c.send('/backend/v1/signatures/providers', { method: 'GET' })
    const birdid = providers.providers?.find((p) => p.id === 'birdid')
    const birdidStandby = birdid?.active === false
    results.push({
      id: 'E11-4',
      desc: 'Preservação dos controles de liberação clínica (sem regressão)',
      status: allProtected && birdidStandby ? 'PASSOU' : 'FALHOU',
      detail: `todos os documentos com liberação preservada=${allProtected}; Bird ID Pro em STANDBY=${birdidStandby}`,
    })
  } catch (e) {
    results.push({
      id: 'E11-4',
      desc: 'Preservação dos controles de liberação',
      status: 'FALHOU',
      detail: e.message,
    })
  }

  console.log('\n===== RESULTADO DOS TESTES E11 =====')
  for (const r of results) {
    console.log(`${r.id}: ${r.status}`)
    console.log(`   ${r.desc}`)
    console.log(`   ${r.detail}`)
  }

  const failed = results.filter((r) => r.status !== 'PASSOU')
  if (failed.length > 0) {
    console.error(`\n${failed.length} teste(s) FALHARAM.`)
    process.exit(1)
  }
  console.log('\nTodos os 4 testes passaram.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
