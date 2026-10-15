// src/data/infrastructureAuditData.ts
// Central de Telelaudos em Cardiologia — Etapa 8: Auditoria e Fortalecimento da Infraestrutura
// Dados técnicos consolidados a partir da inspeção ao vivo do ambiente PocketBase / Skip Cloud

export interface InventoryItem {
  component: string
  category: 'banco' | 'rotas' | 'storage' | 'auth' | 'jobs' | 'segredos' | 'backups' | 'auditoria'
  status: 'COMPROVADO' | 'SEM_TESTE_SUFICIENTE' | 'INDISPONIVEL'
  evidence: string
  details: string
}

export interface ComplianceItem {
  id: string
  area:
    | 'Segurança Técnica'
    | 'Dados de Saúde'
    | 'Transferência Internacional'
    | 'Guarda Documental'
    | 'Responsabilidade Técnica'
    | 'Auditoria Clínica'
    | 'Gestão de Incidentes'
    | 'Assinatura Digital'
    | 'Recuperação de Desastres'
  requirement: string
  status:
    | 'Atendido'
    | 'Parcialmente Atendido'
    | 'Pendente de Comprovação'
    | 'Dependente de Decisão Jurídica-Regulatória'
  technicalBase: string
  legalOrRegulatoryRef: string
  actionRequired: string
}

export interface SecurityVulnerabilityItem {
  id: string
  severity: 'CRÍTICA' | 'ALTA' | 'MÉDIA' | 'BAIXA' | 'INFORMATIVA'
  title: string
  status: 'CORRIGIDO_ETAPA_8' | 'MITIGADO' | 'PENDENCIA_PROVEDOR' | 'PENDENCIA_JURIDICA'
  impact: string
  recommendation: string
}

export const TECHNICAL_INVENTORY: InventoryItem[] = [
  {
    component: 'Coleções e Relacionamentos no Banco de Dados',
    category: 'banco',
    status: 'COMPROVADO',
    evidence:
      '21 coleções ativas inspecionadas via db_show_schema (organizations, user_organizations, units, doctors, patients, exam_requests, ecg_reports, report_drafts, report_documents, report_signatures, signature_transactions, contract_slas, internal_notifications, sla_job_executions, commercial_contracts, price_tables, billing_items, monthly_closings, billing_adjustments, doctor_production_items, audit_logs).',
    details:
      'Chaves estrangeiras relacionais configuradas, índices únicos (document_code, transaction_code, cnpj, cpf, idempotency_key). Motor SQLite em modo WAL gerenciado pelo PocketBase.',
  },
  {
    component: 'API Rules e Hooks de Segurança (audit_security.js, finance_billing.js)',
    category: 'rotas',
    status: 'COMPROVADO',
    evidence:
      '4 hooks de modelo (onRecordCreateRequest, onRecordUpdateRequest, onRecordDeleteRequest, onRecordAuthRequest) e 29 rotas personalizadas mapeadas via routerAdd.',
    details:
      'Bloqueio estrito de exclusão física em audit_logs e report_documents; bloqueio de adulteração de fechamentos consolidados (is_locked=true); proteção de titularidade de arquivos de ECG.',
  },
  {
    component: 'Rotas Personalizadas de Negócio (/backend/v1/*)',
    category: 'rotas',
    status: 'COMPROVADO',
    evidence:
      'Rotas /claim, /return, /draft, /submit-report, /prepare-signature, /download-secure (HMAC 5min), /finance/closings, /sla/job-status e /infra/health ativas.',
    details:
      'Todas as rotas exigem autenticação prévia com conferência de papéis RBAC e geram registros correspondentes em audit_logs.',
  },
  {
    component: 'Armazenamento de Arquivos Locais (ECG e PDFs)',
    category: 'storage',
    status: 'COMPROVADO',
    evidence:
      'Campos tipo "file" em exam_requests (exam_file) e report_documents (pdf_file); geração de hash SHA-256 no backend ($security.sha256).',
    details:
      'Arquivos são mantidos no volume persistente do contêiner PocketBase. Imutabilidade do traçado do ECG garantida por hook de atualização.',
  },
  {
    component: 'Autenticação e Sessões (Tokens JWT PocketBase)',
    category: 'auth',
    status: 'COMPROVADO',
    evidence:
      'Autenticação via collection "users" com hash bcrypt e tokens JWT. Sessão invalidada ao expirar token ou trocar senha.',
    details:
      'Coleção users padrão. Revogação de sessão ocorre por expiração ou rotação do tokenKey da conta de usuário no PocketBase.',
  },
  {
    component: 'Autenticação Multifator (MFA / 2FA Nativo)',
    category: 'auth',
    status: 'SEM_TESTE_SUFICIENTE',
    evidence:
      'O PocketBase v0.22+ possui suporte arquitetural nativo a MFA (TOTP/Email), porém as coleções atuais estão configuradas em modo senha única de teste (Skip@Pass).',
    details:
      'Não implementada autenticação customizada em respeito à diretriz de segurança. MFA deve ser ativado nas configurações do PocketBase com política institucional na fase de produção.',
  },
  {
    component: 'Tarefas Agendadas (cronAdd sla_monitor_5m)',
    category: 'jobs',
    status: 'COMPROVADO',
    evidence:
      'Tarefa periódica "sla_monitor_5m" agendada nativamente a cada 5 minutos via cronAdd. Histórico gravado em sla_job_executions verificado ao vivo com status SUCCESS.',
    details:
      'Recálculo determinístico de deadline_at, atualização de sla_status (no_prazo, proximo_do_vencimento, atrasado, pausado) e disparo de alertas internos.',
  },
  {
    component: 'Integrações Externas e Segredos de Infraestrutura',
    category: 'segredos',
    status: 'COMPROVADO',
    evidence:
      'Consulta ao vivo via list_secrets retornou 0 segredos confidenciais. Variáveis BIRDID_CLIENT_ID e BIRDID_CLIENT_SECRET NÃO existem.',
    details:
      'Conector Soluti Bird ID Pro mantido em MODO STANDBY SEGURO. Nenhuma credencial real exposta no repositório.',
  },
  {
    component: 'Backups e Recuperação de Desastres do Provedor',
    category: 'backups',
    status: 'SEM_TESTE_SUFICIENTE',
    evidence:
      'Skip Cloud executa snapshots automáticos de infraestrutura da plataforma, porém não há console com restore sob demanda visível no contexto atual.',
    details:
      'Plano de recuperação de desastres estruturado nesta etapa com metas propostas de RPO (< 1h) e RTO (< 4h), pendente de validação operacional conjunta.',
  },
  {
    component: 'Criptografia em Repouso do Banco e Storage',
    category: 'storage',
    status: 'SEM_TESTE_SUFICIENTE',
    evidence:
      'Criptografia em trânsito (TLS 1.3 / HTTPS) comprovada nas requisições. Criptografia em repouso dos blocos de disco depende da infraestrutura subjacente de nuvem.',
    details:
      'Classificado tecnicamente como PENDÊNCIA DOCUMENTAL DO PROVEDOR conforme diretriz de conformidade da LGPD.',
  },
  {
    component: 'Trilha de Auditoria Imutável (audit_logs)',
    category: 'auditoria',
    status: 'COMPROVADO',
    evidence:
      'Coleção audit_logs com mais de 3.000 eventos imutáveis inspecionados. Hooks rejeitam UPDATE e DELETE com HTTP 403 Forbidden.',
    details:
      'Registra logins, geração de prévia de laudos, emissão de tokens HMAC de download, fechamentos mensais e alterações operacionais com carimbo temporal ISO-8601.',
  },
]

export const COMPLIANCE_MATRIX: ComplianceItem[] = [
  {
    id: 'COMP-01',
    area: 'Segurança Técnica',
    requirement:
      'Controle estrito de acesso RBAC, isolamento multi-tenant entre clínicas e proteção contra elevação de privilégios.',
    status: 'Atendido',
    technicalBase:
      'Implementado via coleções user_organizations, API Rules no PocketBase e hooks onRecordCreate/Update/Delete que barram acesso cruzado.',
    legalOrRegulatoryRef: 'LGPD Art. 46 (Medidas de Segurança Técnicas e Administrativas)',
    actionRequired: 'Manter bateria de testes de regressão automatizada ativa.',
  },
  {
    id: 'COMP-02',
    area: 'Segurança Técnica',
    requirement:
      'Autenticação multifator (MFA/2FA) para acesso de médicos laudadores e administradores.',
    status: 'Parcialmente Atendido',
    technicalBase:
      'PocketBase suporta TOTP nativo na versão v0.22+, mas o ambiente de homologação utiliza autenticação por login/senha simplificada.',
    legalOrRegulatoryRef:
      'Resolução CFM nº 2.314/2022 Art. 5º e Padrões SBIS-CFM de Segurança em Saúde',
    actionRequired:
      'Ativar e homologar TOTP institucional antes de qualquer implantação com usuários reais.',
  },
  {
    id: 'COMP-03',
    area: 'Dados de Saúde',
    requirement:
      'Tratamento de dados pessoais sensíveis de saúde com base legal definida e ausência de dados reais em ambientes de teste.',
    status: 'Atendido',
    technicalBase:
      'Ambiente opera 100% com dados fictícios (CPFs fictícios, traçados sintéticos). Logs operacionais não expõem PII médica.',
    legalOrRegulatoryRef: 'LGPD Art. 11 (Tratamento de Dados Pessoais Sensíveis de Saúde)',
    actionRequired:
      'Estabelecer Termo de Uso e Política de Privacidade formal para clínicas parceiras.',
  },
  {
    id: 'COMP-04',
    area: 'Transferência Internacional',
    requirement:
      'Conformidade com a Resolução CD/ANPD nº 19/2024 caso servidores de nuvem estejam localizados no exterior.',
    status: 'Dependente de Decisão Jurídica-Regulatória',
    technicalBase:
      'O Skip Cloud / PocketBase é hospedado em provedor de nuvem cuja jurisdição de data center requer formalização contratual.',
    legalOrRegulatoryRef:
      'Resolução CD/ANPD nº 19/2024 (Regulamento de Transferência Internacional de Dados e Cláusulas-Padrão Contratuais - SCCs)',
    actionRequired:
      'Incorporar Cláusulas-Padrão Contratuais da ANPD (Anexo II da Resolução 19/2024) ou comprovar localização dos servidores no território brasileiro.',
  },
  {
    id: 'COMP-05',
    area: 'Guarda Documental',
    requirement:
      'Guarda e preservação documental de laudos e exames pelo período mínimo de 20 anos.',
    status: 'Parcialmente Atendido',
    technicalBase:
      'Imutabilidade física garantida por hooks (sem DELETE em laudos/documentos). Versionamento monotônico sequencial implementado.',
    legalOrRegulatoryRef: 'Lei Federal nº 13.787/2018 Art. 6º e Resolução CFM nº 1.821/2007',
    actionRequired:
      'Implementar política formal de arquivo frio de longo prazo (cold storage imutável) e rotina de conferência de integridade de hashes periódica.',
  },
  {
    id: 'COMP-06',
    area: 'Responsabilidade Técnica',
    requirement:
      'Responsabilidade técnica médica explícita com CRM, UF e RQE do cardiologista laudador registrado em cada documento.',
    status: 'Atendido',
    technicalBase:
      'Coleção doctors e report_documents gravam o snapshot profissional (CRM, CRM-UF, RQE, Especialidade SBC) de forma imutável no laudo.',
    legalOrRegulatoryRef: 'Resolução CFM nº 2.314/2022 Art. 3º e Código de Ética Médica',
    actionRequired:
      'Integrar consulta automatizada aos cadastros dos Conselhos Regionais de Medicina (CFM/CRM) na admissão médica.',
  },
  {
    id: 'COMP-07',
    area: 'Auditoria Clínica',
    requirement:
      'Rastreabilidade total das ações médicas (reivindicação, rascunho, devolução técnica, emissão, download).',
    status: 'Atendido',
    technicalBase:
      'audit_logs registra todas as mutações com data/hora UTC, ID do médico, ID da clínica e hash SHA-256 dos documentos manipulados.',
    legalOrRegulatoryRef: 'Padrão SBIS/CFM de Sistema de Registro Eletrônico em Saúde (S-RES)',
    actionRequired: 'Manter rotina de exportação periódica da trilha para custódia externa.',
  },
  {
    id: 'COMP-08',
    area: 'Gestão de Incidentes',
    requirement:
      'Capacidade de detecção e plano formal de notificação de incidentes de segurança à ANPD e aos titulares.',
    status: 'Pendente de Comprovação',
    technicalBase:
      'A infraestrutura registra logs de erro e tentativas de acesso indevido no backend, mas não possui ferramenta SIEM nem procedimento operacional padrão (POP) publicado.',
    legalOrRegulatoryRef: 'LGPD Art. 48 e Resolução CD/ANPD nº 15/2024 (Comunicação de Incidentes)',
    actionRequired:
      'Redigir POP de Resposta a Incidentes de Segurança com prazos legais de comunicação (3 dias úteis).',
  },
  {
    id: 'COMP-09',
    area: 'Assinatura Digital',
    requirement:
      'Assinatura digital ICP-Brasil com certificados de médicos reais e validação criptográfica estrita antes da liberação clínica.',
    status: 'Dependente de Decisão Jurídica-Regulatória',
    technicalBase:
      'Conector Soluti Bird ID Pro construído e desativado com segurança. Portão de 7 critérios criptográficos impede liberação de assinaturas simuladas.',
    legalOrRegulatoryRef:
      'MP 2.200-2/2001, Lei nº 14.063/2020 e Resolução CFM nº 2.299/2021 (Assinatura Qualificada)',
    actionRequired:
      'Formalizar contratação de lote comercial do Bird ID Pro com a Soluti e registrar chaves de produção nos segredos do backend.',
  },
  {
    id: 'COMP-10',
    area: 'Recuperação de Desastres',
    requirement:
      'Plano de continuidade de negócios com RPO (Recovery Point Objective) e RTO (Recovery Time Objective) definidos e testados.',
    status: 'Pendente de Comprovação',
    technicalBase:
      'Metas propostas nesta etapa: RPO < 1 hora e RTO < 4 horas. Ainda não foi realizado teste de restauração em ambiente isolado.',
    legalOrRegulatoryRef: 'Norma ISO/IEC 27001 (A.12.3 - Backups) e ISO 22301 (Continuidade)',
    actionRequired:
      'Executar simulação de restauração (DR Drill) em ambiente espelho antes de atingir status de produção.',
  },
]

export const VULNERABILITIES_AND_LIMITATIONS: SecurityVulnerabilityItem[] = [
  {
    id: 'VULN-01',
    severity: 'BAIXA',
    title: 'Exceção não-bloqueante no hook audit_security ao verificar campos em runtime',
    status: 'CORRIGIDO_ETAPA_8',
    impact:
      'Em algumas requisições de atualização de exames sem vínculo de organização preenchido, o hook logava "Object has no member has", poluindo logs.',
    recommendation:
      'Corrigido cirurgicamente na Etapa 8 utilizando leitura defensiva (try/catch e e.record.get).',
  },
  {
    id: 'VULN-02',
    severity: 'MÉDIA',
    title: 'Ausência de Autenticação Multifator (MFA/TOTP) obrigatória',
    status: 'MITIGADO',
    impact:
      'Contas médicas e administrativas poderiam ser vulneráveis a ataques de força bruta caso senhas fracas fossem empregadas em produção.',
    recommendation:
      'Ativar MFA nativo do PocketBase v0.22+ e política de expiração de senhas na etapa pré-operacional.',
  },
  {
    id: 'VULN-03',
    severity: 'ALTA',
    title: 'Pendência Documental da Localização Física dos Dados e Cláusulas-Padrão ANPD',
    status: 'PENDENCIA_JURIDICA',
    impact:
      'Se os servidores de banco e arquivos estiverem fora do Brasil sem SCCs (Cláusulas-Padrão Contratuais), incorre em infração à Resolução CD/ANPD nº 19/2024.',
    recommendation:
      'Solicitar comprovação documental de localização dos data centers do Skip Cloud e formalizar anexo contratual da ANPD.',
  },
  {
    id: 'VULN-04',
    severity: 'ALTA',
    title: 'Criptografia em Repouso do Volume de Armazenamento Não Verificada Diretamente',
    status: 'PENDENCIA_PROVEDOR',
    impact:
      'Impossibilidade de auditar no código do cliente se o volume em bloco do SQLite e os arquivos de ECG estão criptografados via AES-256 ou LUKS.',
    recommendation:
      'Classificado como PENDÊNCIA DOCUMENTAL DO PROVEDOR até envio de declaração técnica de segurança de repouso.',
  },
  {
    id: 'VULN-05',
    severity: 'CRÍTICA',
    title: 'Assinatura Digital ICP-Brasil Real Inativa (Aguardando Credenciais Comerciais)',
    status: 'MITIGADO',
    impact:
      'Laudos médicos não possuem validade jurídica definitiva sem assinatura digital qualificada ICP-Brasil.',
    recommendation:
      'Mitigado: O sistema impede estritamente a liberação clínica definitiva e mantém tarjas de PRÉVIA/SEM VALIDADE LEGAL até contratação da Soluti.',
  },
]

export const BACKUP_AND_DR_PLAN = {
  rpoProposed: '1 hora (RPO Máximo Aceitável Proposto)',
  rtoProposed: '4 horas (RTO Máximo Aceitável Proposto)',
  backupDatabaseFrequency: 'Diário automatizado + WAL archiving contínuo da infraestrutura',
  backupFilesFrequency: 'Sincronização incremental contínua do diretório pb_data/storage',
  retentionPolicy: '30 dias operacionais + snapshots mensais por 5 anos (proposto)',
  encryptionStandard: 'AES-256 em repouso e TLS 1.3 em trânsito (exigência técnica)',
  restorationStatus:
    'NÃO EXECUTADA restauração sobre o ambiente atual (preservação estrita dos dados de teste)',
  drDrillProcedure: [
    '1. Exportar snapshot do banco de dados e arquivos para bucket de isolamento temporário.',
    '2. Provisionar instância PocketBase de teste em ambiente isolado (staging isolado).',
    '3. Aplicar restauração completa do SQLite e verificar integridade de índices.',
    '4. Conferir integridade SHA-256 de 100% dos laudos cadastrados contra a tabela report_documents.',
    '5. Executar a bateria de 44 testes de segurança e validar isolamento multi-tenant.',
    '6. Destruir o ambiente de teste e emitir Relatório de Auditoria de Restauração.',
  ],
}

export const NEXT_STAGE_RECOMMENDED_PLAN = [
  {
    step: '1. Formalização Jurídica e Resolução ANPD nº 19/2024',
    action:
      'Obter certificado de localização dos servidores de nuvem e assinar Cláusulas-Padrão Contratuais (SCCs) aprovadas pela ANPD.',
    priority: 'ALTA',
  },
  {
    step: '2. Contratação Comercial Soluti Bird ID Pro',
    action:
      'Adquirir lote de certificados em nuvem e cadastrar BIRDID_CLIENT_ID e BIRDID_CLIENT_SECRET com segurança nos segredos.',
    priority: 'ALTA',
  },
  {
    step: '3. Ativação de MFA / TOTP Nativo para Médicos e Administradores',
    action:
      'Configurar autenticação em dois fatores obrigatória no PocketBase antes do onboarding do corpo clínico.',
    priority: 'MÉDIA',
  },
  {
    step: '4. Teste de Restauração de Backup em Ambiente Isolado (DR Drill)',
    action:
      'Comprovar na prática o RTO (< 4h) e RPO (< 1h) em um ambiente espelho sem tocar o ambiente homologado.',
    priority: 'MÉDIA',
  },
  {
    step: '5. Piloto Clínico Controlado',
    action:
      'Iniciar operação assistida com volume restrito de exames após aprovação do Diretor Técnico Médico e Encarregado de Dados (DPO).',
    priority: 'ESTRATÉGICA',
  },
]
