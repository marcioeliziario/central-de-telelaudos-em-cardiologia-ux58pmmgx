/**
 * Configuração central da versão e metadados da aplicação.
 * Evita strings fixas desatualizadas espalhadas pelos componentes.
 */
export const APP_CONFIG = {
  version: '0.0.40',
  versionLabel: 'v0.0.40',
  stageName: 'MVP Telelaudos de ECG — Assinatura Digital Externa ICP-Brasil & Fluxo Simplificado',
  sessionDurationLabel: '12 horas (43.200s)',
  sessionDurationSecs: 43200,
  idleTimeoutLabel: '30 minutos',
  normativeNotice: 'Em processo de homologação regulatória contínua (SBC, CFM e LGPD)',
  // Decisão definitiva MVP: Assinatura externa ICP-Brasil individual pelo médico
  features: {
    autoSigningProvidersEnabled: false,
    externalSigningOnly: true,
  },
} as const
