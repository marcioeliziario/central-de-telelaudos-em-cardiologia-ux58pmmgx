/**
 * Configuração central da versão e metadados da aplicação.
 * Evita strings fixas desatualizadas espalhadas pelos componentes.
 */
export const APP_CONFIG = {
  version: '0.0.33',
  versionLabel: 'v0.0.33',
  stageName: 'Múltiplos Perfis Funcionais para a Mesma Identidade Autenticada',
  sessionDurationLabel: '12 horas (43.200s)',
  sessionDurationSecs: 43200,
  idleTimeoutLabel: '30 minutos',
  normativeNotice: 'Em processo de homologação regulatória contínua (SBC, CFM e LGPD)',
} as const
