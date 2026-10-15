// Executa o fluxo completo real contra o backend:
// 1) processa a imagem anexada (assinatura cursiva em fundo transparente);
// 2) autentica e grava o binário via rota autenticada sync-initial;
// 3) verifica registro, binário e hash;
// 4) gera PDF fictício pelo fluxo normal do editor;
// 5) executa testes E11-1 a E11-4 e reporta cada resultado.
// Executar com: node scripts/run-signature-homologation.js
import { processSignature } from './process-signature.js'
import { spawnSync } from 'node:child_process'

processSignature()

console.log('\n=== Etapa 2: sincronização da assinatura via rota autenticada ===')
const sync = spawnSync('node', ['scripts/sync-signature.js'], {
  stdio: 'inherit',
  encoding: 'utf8',
})
if (sync.status !== 0) {
  console.error('Sincronização falhou — abortando.')
  process.exit(1)
}

console.log('\n=== Etapa 3: verificação do registro e do binário no storage ===')
const verify = spawnSync('node', ['scripts/verify-signature-storage.js'], {
  stdio: 'inherit',
  encoding: 'utf8',
})
if (verify.status !== 0) {
  console.error('Verificação de armazenamento falhou — abortando.')
  process.exit(1)
}

console.log('\n=== Etapa 4: fluxo completo de homologação e geração do PDF fictício ===')
const flow = spawnSync('node', ['scripts/homologar-signature-flow.js'], {
  stdio: 'inherit',
  encoding: 'utf8',
})
if (flow.status !== 0) {
  console.error('Fluxo de homologação falhou — abortando.')
  process.exit(1)
}

console.log('\n=== Etapa 5: testes E11-1 a E11-4 ===')
const tests = spawnSync('node', ['scripts/run-e11-tests.js'], {
  stdio: 'inherit',
  encoding: 'utf8',
})
if (tests.status !== 0) {
  console.error('Testes E11 falharam (ver detalhes acima).')
}
console.log('Fluxo finalizado. Verifique os relatórios individuais acima.')
