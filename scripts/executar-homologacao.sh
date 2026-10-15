#!/bin/bash
# Executa o fluxo real de homologação da assinatura manuscrita.
# Requer: SIGNATURE_EMAIL e SIGNATURE_PASSWORD no ambiente.
# Uso: bash scripts/executar-homologacao.sh
set -e
cd "$(dirname "$0")/.."
export SIGNATURE_BACKEND_URL="${SIGNATURE_BACKEND_URL:-https://central-de-telelaudos-em-cardiologia-7023e.shrd01.internal.goskip.dev}"
node scripts/run-signature-homologation.js
