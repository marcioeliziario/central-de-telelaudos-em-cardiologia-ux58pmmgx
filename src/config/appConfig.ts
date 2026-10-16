/**
 * Configuração central da versão e metadados da aplicação.
 * Evita strings fixas desatualizadas espalhadas pelos componentes.
 */
export const APP_CONFIG = {
  version: '0.0.35',
  versionLabel: 'v0.0.35',
  stageName:
    'Visualizador Nativo de PDF (Canvas/PDF.js) e Fluxo Unificado de Conclusão e Assinatura',
  sessionDurationLabel: '12 horas (43.200s)',
  sessionDurationSecs: 43200,
  idleTimeoutLabel: '30 minutos',
  normativeNotice: 'Em processo de homologação regulatória contínua (SBC, CFM e LGPD)',
} as const
