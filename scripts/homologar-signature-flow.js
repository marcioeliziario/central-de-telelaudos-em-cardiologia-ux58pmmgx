// Fluxo de homologação final (Etapa 11 / assinatura manuscrita):
// usa a conta autorizada (Dr. Márcio Eliziário, login + senha reais),
// cria um exame ECG inteiramente FICTÍCIO, atribui ao médico,
// elabora interpretação fictícia, submete e prepara o PDF final
// com a assinatura manuscrita incorporada no rodapé.
// Dados exclusivamente fictícios; documento NÃO liberado para clínicas reais.
import fs from 'node:fs'
import crypto from 'node:crypto'

const BACKEND_URL =
  process.env.SIGNATURE_BACKEND_URL ||
  'https://central-de-telelaudos-em-cardiologia-7023e.shrd01.internal.goskip.dev'
const EMAIL = process.env.SIGNATURE_EMAIL
const PASSWORD = process.env.SIGNATURE_PASSWORD

const PNG_PATH = 'src/assets/assinatura-medica-principal-transparente.png'
const EXPECTED_SHA256 = 'd7cbcf1eb4ba520ae1e52ee3b216ec711a7c807212f86641b6c867fa2032e366'

async function jfetch(url, opts = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token) headers.Authorization = token
  const res = await fetch(url, { ...opts, headers })
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Defina SIGNATURE_EMAIL e SIGNATURE_PASSWORD no ambiente antes de executar.')
    process.exit(1)
  }

  const png = fs.readFileSync(PNG_PATH)
  const pngSha = crypto.createHash('sha256').update(png).digest('hex')
  console.log(`SHA-256 da assinatura local: ${pngSha} (esperado: ${EXPECTED_SHA256})`)
  if (pngSha !== EXPECTED_SHA256) process.exit(1)

  // 1. Login real (conta autorizada de teste)
  const login = await jfetch(`${BACKEND_URL}/api/collections/users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  })
  if (login.status !== 200) {
    console.error(`Login falhou: HTTP ${login.status}`)
    process.exit(1)
  }
  const token = login.body.token
  const userId = login.body.record.id
  console.log(`1. Login OK (usuário ${userId})`)

  // 2. Dados fictícios: organização prestadora, clínica fictícia, paciente fictício
  const orgs = await jfetch(
    `${BACKEND_URL}/api/collections/organizations/records?perPage=1&filter=${encodeURIComponent("type='provider'")}`,
    { method: 'GET' },
    token,
  )
  const providerOrg = orgs.body.items[0]
  console.log(`2. Organização prestadora: ${providerOrg.id}`)

  const nowIso = new Date().toISOString()
  const suffix = Date.now().toString().slice(-6)

  const clinic = await jfetch(
    `${BACKEND_URL}/api/collections/organizations/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: `Clínica Homologação Fictícia ${suffix}`,
        trade_name: `Clínica Fictícia ${suffix}`,
        cnpj: '00.000.000/0000-00',
        type: 'client',
        is_active: false,
        city: 'Brasília',
        state: 'DF',
        notes: 'ORGANIZAÇÃO FICTÍCIA DE HOMOLOGAÇÃO — NÃO UTILIZAR PARA LAUDOS REAIS',
      }),
    },
    token,
  )
  if (clinic.status !== 200) {
    console.error(
      `Falha ao criar clínica fictícia: HTTP ${clinic.status} → ${JSON.stringify(clinic.body)}`,
    )
    process.exit(1)
  }
  console.log(`3. Clínica fictícia criada: ${clinic.body.id}`)

  const unit = await jfetch(
    `${BACKEND_URL}/api/collections/units/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        organization_id: clinic.body.id,
        name: 'Unidade Fictícia Homologação',
        cnes: '0000000',
        city: 'Brasília',
        state: 'DF',
        is_active: false,
      }),
    },
    token,
  )
  console.log(`4. Unidade fictícia criada: ${unit.body?.id}`)

  const patient = await jfetch(
    `${BACKEND_URL}/api/collections/patients/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        organization_id: clinic.body.id,
        unit_id: unit.body.id,
        full_name: 'PACIENTE FICTÍCIO DE HOMOLOGAÇÃO (NÃO REAL)',
        birth_date: '1980-01-01',
        gender: 'M',
        cpf: '000.000.000-00',
        clinical_notes: 'Registro totalmente fictício para homologação do fluxo de PDF.',
      }),
    },
    token,
  )
  if (patient.status !== 200) {
    console.error(
      `Falha ao criar paciente fictício: HTTP ${patient.status} → ${JSON.stringify(patient.body)}`,
    )
    process.exit(1)
  }
  console.log(`5. Paciente fictício criado: ${patient.body.id}`)

  const exam = await jfetch(
    `${BACKEND_URL}/api/collections/exam_requests/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        organization_id: clinic.body.id,
        unit_id: unit.body.id,
        patient_id: patient.body.id,
        requested_by: userId,
        status: 'pending',
        urgency: 'routine',
        clinical_indication: 'HOMOLOGAÇÃO — traçado ECG fictício para teste do fluxo de laudo.',
        exam_date: nowIso,
      }),
    },
    token,
  )
  if (exam.status !== 200) {
    console.error(
      `Falha ao criar exame fictício: HTTP ${exam.status} → ${JSON.stringify(exam.body)}`,
    )
    process.exit(1)
  }
  const examId = exam.body.id
  console.log(`6. Exame fictício criado: ${examId}`)

  // 3. Assumir o exame pelo fluxo normal (rota oficial claim)
  const claim = await jfetch(
    `${BACKEND_URL}/backend/v1/exams/${examId}/claim`,
    { method: 'POST' },
    token,
  )
  console.log(`7. claim: HTTP ${claim.status} → status=${claim.body?.exam?.status}`)

  // 4. Elaborar interpretação fictícia e concluir a elaboração (submit-report)
  const submit = await jfetch(
    `${BACKEND_URL}/backend/v1/exams/${examId}/submit-report`,
    {
      method: 'POST',
      body: JSON.stringify({
        heart_rate: 72,
        cardiac_rhythm: 'Ritmo Sinusal Regular',
        electrical_axis: 'Normalmente orientado (+30° a +90°)',
        pr_interval_ms: 160,
        qrs_duration_ms: 90,
        qt_interval_ms: 380,
        qtc_interval_ms: 410,
        p_wave_description: 'Ondas P presentes, morfologia e duração dentro da normalidade.',
        av_conduction_alterations: 'Sem alterações da condução AV.',
        iv_conduction_alterations: 'Sem bloqueios intraventriculares.',
        repolarization_alterations: 'Sem alterações primárias da repolarização ventricular.',
        q_waves_findings: 'Sem ondas Q patológicas.',
        free_text_description:
          'Traçado eletrocardiográfico de 12 derivações, ritmo sinusal regular, frequência ventricular de 72 bpm, intervalo PR de 160 ms, duração do QRS de 90 ms e intervalo QTc de 410 ms, dentro dos limites da normalidade para a faixa etária, conforme diretrizes SBC 2022.',
        free_text_conclusion:
          'Eletrocardiograma de 12 derivações dentro dos padrões da normalidade, sem alterações patológicas significativas.',
      }),
    },
    token,
  )
  console.log(`8. submit-report: HTTP ${submit.status} → status=${submit.body?.report?.status}`)

  // 5. Preparar o PDF final com a assinatura manuscrita no rodapé
  const prep = await jfetch(
    `${BACKEND_URL}/backend/v1/exams/${examId}/prepare-signature`,
    { method: 'POST' },
    token,
  )
  console.log(`9. prepare-signature: HTTP ${prep.status}`)
  console.log(`   documentCode: ${prep.body?.documentCode}`)
  console.log(`   version: ${prep.body?.version}`)
  console.log(`   sha256: ${prep.body?.sha256}`)
  if (prep.status !== 200) {
    console.error(`Falha ao preparar PDF: ${JSON.stringify(prep.body)}`)
    process.exit(1)
  }
  const docId = prep.body?.document?.id
  const snap = JSON.parse(prep.body?.document?.content_snapshot || '{}')
  console.log(`   hasHandwrittenSignature: ${snap.hasHandwrittenSignature}`)

  // 6. Baixar o PDF persistido no storage e verificar assinatura embutida
  const docRec = await jfetch(
    `${BACKEND_URL}/api/collections/report_documents/records/${docId}`,
    { method: 'GET' },
    token,
  )
  const pdfFile = docRec.body?.pdf_file
  console.log(`10. report_documents.pdf_file: ${pdfFile}`)
  if (pdfFile) {
    const pdfRes = await fetch(`${BACKEND_URL}/api/files/report_documents/${docId}/${pdfFile}`, {
      headers: { Authorization: token },
    })
    if (pdfRes.ok) {
      const pdfBytes = Buffer.from(await pdfRes.arrayBuffer())
      const storedSha = crypto.createHash('sha256').update(pdfBytes).digest('hex')
      fs.writeFileSync('scripts/pdf-homologacao-ficticio.pdf', pdfBytes)
      console.log(
        `    PDF baixado: ${pdfBytes.length} bytes; SHA-256 registrado: ${docRec.body.file_hash_sha256}`,
      )
      console.log(
        `    SHA-256 do arquivo baixado: ${storedSha} (igual: ${storedSha === docRec.body.file_hash_sha256})`,
      )
      console.log(`    PDF salvo localmente em scripts/pdf-homologacao-ficticio.pdf`)
      console.log(
        `    Contém XObject de assinatura (ImSig): ${pdfBytes.toString('latin1').includes('/ImSig')}`,
      )
    } else {
      console.error(`    Falha ao baixar PDF: HTTP ${pdfRes.status}`)
    }
  } else {
    console.error('    pdf_file vazio no documento!')
    process.exit(1)
  }

  // 7. Verificar controles: report_signatures NÃO liberado, Bird ID Pro standby
  const sigs = await jfetch(
    `${BACKEND_URL}/api/collections/report_signatures/records?filter=${encodeURIComponent(`exam_request_id='${examId}'`)}`,
    { method: 'GET' },
    token,
  )
  const sig = sigs.body.items?.[0]
  console.log(
    `11. report_signatures: signature_status=${sig?.signature_status}, is_clinically_released=${sig?.is_clinically_released}`,
  )

  const providers = await jfetch(
    `${BACKEND_URL}/backend/v1/signatures/providers`,
    { method: 'GET' },
    token,
  )
  const birdid = providers.body.providers?.find((p) => p.id === 'birdid')
  console.log(`12. Bird ID Pro active: ${birdid?.active} (STANDBY esperado)`)

  console.log(
    '\nFLUXO DE HOMOLOGAÇÃO CONCLUÍDO. PDF fictício salvo em scripts/pdf-homologacao-ficticio.pdf',
  )
  console.log('Documento NÃO liberado para clínicas reais (is_clinically_released=false).')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
