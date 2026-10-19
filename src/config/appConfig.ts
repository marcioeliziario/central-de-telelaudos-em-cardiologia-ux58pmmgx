/**
 * Configuração central da versão e metadados da aplicação.
 * Evita strings fixas desatualizadas espalhadas pelos componentes.
 */
export const APP_CONFIG = {
  version: '0.0.48',
  versionLabel: 'v0.0.48',
  stageName: 'Central de Telelaudos de ECG — Acesso Limpo, Seguro e Identidade Institucional',
  sessionDurationLabel: '12 horas (43.200s)',
  sessionDurationSecs: 43200,
  idleTimeoutLabel: '30 minutos',
  normativeNotice: 'Em processo de homologação regulatória contínua (SBC, CFM e LGPD)',
  // Decisão definitiva MVP: Assinatura externa ICP-Brasil individual pelo médico
  features: {
    autoSigningProvidersEnabled: false,
    externalSigningOnly: true,
    // Segurança: desativação estrita de autenticação simulada e perfis de teste no ambiente operacional
    allowTestProfilesQuickLogin: false,
    enforcePasswordChangeOnDefaultCredentials: true,
  },
} as const
