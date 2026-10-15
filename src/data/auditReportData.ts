export interface AuditItem {
  id: string
  code: string // e.g. "A.1"
  title: string
  category: 'A' | 'B' | 'C' | 'D'
  topic: 'banco' | 'auth' | 'arquivos' | 'operacao' | 'assinatura' | 'integracoes' | 'seguranca'
  topicLabel: string
  statusBadge: string
  summary: string
  evidence: string
  limitations: string
  impact: string
  mitigationOrAction?: string
  technicalDetails?: string[]
}

export interface ArchitectureBlock {
  id: string
  layer: 'frontend' | 'backend' | 'external' | 'security'
  layerLabel: string
  title: string
  subtitle: string
  items: string[]
  tags: string[]
  role: string
}

export const AUDIT_ITEMS: AuditItem[] = [
  // ==========================================
  // SEÇÃO A: RECURSOS DISPONÍVEIS E VERIFICADOS
  // ==========================================
  {
    id: 'a1',
    code: 'A.1',
    title: 'Banco de Dados Relacional e Tipagem de Esquema',
    category: 'A',
    topic: 'banco',
    topicLabel: 'Banco de Dados',
    statusBadge: 'Nativo & Verificado',
    summary:
      'Suporte a coleções relacionais tipadas no SQLite subjacente, com integridade referencial, foreign keys e índices customizados.',
    evidence:
      'Verificado via introspecção de esquema (db_show_schema) e documentação PocketBase v0.36. Permite coleções base com campos tipados (relation, text, number, select, date, bool, json, file) e restrições declarativas como cascadeDelete e maxSelect.',
    limitations:
      'Base de dados baseada em SQLite incorporado. Transações complexas multi-tabela não estão disponíveis via REST API padrão sem uso de hooks ou métodos app.runInTransaction no backend.',
    impact:
      'Viabiliza plenamente a modelagem relacional entre Organizações, Clínicas, Unidades, Médicos, Pacientes, Solicitações de ECG e Laudos.',
    technicalDetails: [
      'Campos RelationField com suporte a cascadeDelete e restrição maxSelect: 1 ou N',
      'Índices SQLite (CREATE [UNIQUE] INDEX ... ON table (cols)) aplicáveis via migrações',
      'Identificadores alfanuméricos únicos gerados automaticamente (15 caracteres base58/nanoid)',
    ],
  },
  {
    id: 'a2',
    code: 'A.2',
    title: 'Autenticação de Usuários e Gestão de Sessões',
    category: 'A',
    topic: 'auth',
    topicLabel: 'Autenticação e Permissões',
    statusBadge: 'Nativo & Verificado',
    summary:
      'Mecanismo nativo de autenticação JWT, validação de credenciais, recuperação de senha por email e gerenciamento de estado de login.',
    evidence:
      'Coleção users (auth) provisionada no banco live, SDK @/lib/pocketbase/client configurado e suporte a requisições de redefinição de senha e verificação de email via PocketBase Mailer nativo.',
    limitations:
      'O mecanismo nativo provê expiração de token JWT baseada em segredo global; a revogação instantânea de uma sessão específica sem invalidar todas exige invalidação manual do tokenKey do usuário.',
    impact:
      'Fornece a base de identidade para os 5 perfis previstos (Admin Geral, Gestor da Clínica, Operador, Cardiologista Laudador e Financeiro).',
    technicalDetails: [
      'Coleção nativa users do tipo "auth" com hash bcrypt/argon2 seguro de senhas',
      'Fluxo de requestPasswordReset e confirmPasswordReset funcional com templates de email',
      'Suporte a rotação de tokenKey para forçar logout de sessões',
    ],
  },
  {
    id: 'a3',
    code: 'A.3',
    title: 'Armazenamento de Arquivos com Proteção e Metadados',
    category: 'A',
    topic: 'arquivos',
    topicLabel: 'Arquivos Médicos',
    statusBadge: 'Nativo & Verificado',
    summary:
      'Upload nativo de arquivos nos formatos PDF, PNG e JPEG através de FileField, com controle estrito de tipo MIME e limite de tamanho em bytes.',
    evidence:
      'Especificação FileField de PocketBase v0.36 aceita propriedades mimeTypes: ["application/pdf", "image/png", "image/jpeg"] e maxSize em bytes por coleção.',
    limitations:
      'Por padrão no PocketBase, se a viewRule for atendida, URLs diretas (/api/files/...) servem o arquivo. Para garantir que exames nunca vazem por link estático, o campo deve ser configurado como protegido (protected: true) ou com rota customizada de streaming de download autenticado.',
    impact:
      'Atende ao requisito inicial de recepção e arquivamento seguro de traçados de ECG enviados pelas clínicas em PDF, PNG e JPEG.',
    technicalDetails: [
      'MIME types permitidos definidos rigidamente no esquema da coleção',
      'Tamanho máximo de upload configurável por campo (ex.: 25 MB para laudos/exames)',
      'Armazenamento isolado no sistema de arquivos do contêiner ou bucket S3 configurado',
    ],
  },
  {
    id: 'a4',
    code: 'A.4',
    title: 'Controle de Acesso Baseado em Regras no Backend (RLS)',
    category: 'A',
    topic: 'seguranca',
    topicLabel: 'Segurança e Permissões',
    statusBadge: 'Nativo & Verificado',
    summary:
      'Filtragem obrigatória executada no servidor para todas as operações (listRule, viewRule, createRule, updateRule, deleteRule).',
    evidence:
      'Mecanismo de API Rules do PocketBase avalia expressões de filtro no servidor antes de qualquer consulta ou mutação (@request.auth.id, @request.auth.role, @request.body.*).',
    limitations:
      'A segurança depende criticamente da correta escrita das expressões de regras; regras omitidas (null) bloqueiam tudo para superusuários, enquanto regras vazias ("") tornam público. Exige testes rigorosos de isolamento.',
    impact:
      'Permite isolar clinicamente os dados entre diferentes organizações contratantes sem risco de bypass pelo frontend.',
    technicalDetails: [
      'Expressão para isolamento: organizacao_id = @request.auth.organizacao_id',
      'Bloqueio de escalação de privilégios com modificador :changed (ex: @request.body.role:changed = false)',
      'Impedimento de injeção ou sobreescrita de campos críticos',
    ],
  },
  {
    id: 'a5',
    code: 'A.5',
    title: 'Ferramenta de Backup e Restauração de Sistema',
    category: 'A',
    topic: 'banco',
    topicLabel: 'Banco de Dados',
    statusBadge: 'Nativo & Verificado',
    summary:
      'Capacidade do motor PocketBase de gerar cópias integrais do banco de dados e arquivos através de backups em formato compactado.',
    evidence:
      'APIs nativas /api/backups e utilitários de snapshot do PocketBase; logs de cron-settings ativos confirmam rotinas de background.',
    limitations:
      'A periodicidade e retenção de snapshots automatizados no Skip Cloud dependem da infraestrutura de hospedagem da plataforma; backups manuais podem ser disparados via API autenticada.',
    impact:
      'Permite formular rotina operacional de contingência para restauração de desastres da base de laudos e cadastros.',
    technicalDetails: [
      'Geração de arquivos ZIP contendo pb_data (banco SQLite) e storage de uploads',
      'Possibilidade de automação via job agendado chamando rotina de snapshot',
      'Restauração exige reinicialização do daemon ou upload em ambiente de recuperação',
    ],
  },
  {
    id: 'a6',
    code: 'A.6',
    title: 'Exportação Estruturada de Dados para Portabilidade',
    category: 'A',
    topic: 'banco',
    topicLabel: 'Banco de Dados',
    statusBadge: 'Nativo & Verificado',
    summary:
      'Extração integral de registros em JSON e CSV via endpoints REST com paginação e ordenação controladas.',
    evidence:
      'SDK nativo suporta getFullList e findRecordsByFilter com parâmetros de ordenação, filtro e paginação para todas as coleções.',
    limitations:
      'Consultas massivas requerem paginação (batching de 200 a 500 registros) para evitar estouro de memória no servidor e no navegador.',
    impact:
      'Atende às exigências de portabilidade da LGPD (Art. 18, V) e viabiliza geração de relatórios de fechamento para faturamento.',
    technicalDetails: [
      'Exportação com paginação determinística via batching com SDK',
      'Formatação JSON estruturada contendo registros, relacionamentos e metadados',
    ],
  },

  // ==========================================
  // SEÇÃO B: RECURSOS IMPLEMENTÁVEIS
  // ==========================================
  {
    id: 'b1',
    code: 'B.1',
    title: 'Fila Centralizada com Atribuição Exclusiva e Trava Atômica (Mutex)',
    category: 'B',
    topic: 'operacao',
    topicLabel: 'Operação de Telelaudos',
    statusBadge: 'Implementável via Hook',
    summary:
      'Algoritmo de reserva exclusiva para impedir que dois cardiologistas assumam ou laudem simultaneamente o mesmo eletrocardiograma.',
    evidence:
      'Ganchos de ciclo de vida (pb_hooks) routerAdd ou onRecordBeforeUpdateRequest com transação app.runInTransaction garantem concorrência segura.',
    limitations:
      'Não existe funcionalidade pronta "out-of-the-box"; a lógica de exclusividade deve ser codificada em JavaScript no backend para checagem atômica de status.',
    impact:
      'Elimina retrabalho médico, duplicidade de laudo e risco clínico de interpretações conflitantes do mesmo traçado.',
    technicalDetails: [
      'Hook onRecordBeforeUpdateRequest verifica: se novo status = "em_analise", status anterior DEVE ser "disponivel"',
      'Atribuição vincula medico_laudador_id = @request.auth.id e timestamp de expiração (lock timeout de 30 min)',
      'Transação atômica SQLite (UPDATE exames SET status="em_analise", medico_id=X WHERE id=Y AND status="disponivel")',
    ],
  },
  {
    id: 'b2',
    code: 'B.2',
    title: 'Máquina de Estados Finita e Segura para o Ciclo do Exame',
    category: 'B',
    topic: 'operacao',
    topicLabel: 'Operação de Telelaudos',
    statusBadge: 'Implementável via Regras/Hooks',
    summary:
      'Validação rígida de transições permitidas: Recebido → Triagem/Fila → Em Análise → Rascunho → Laudado → Assinado Digitalmente → Entregue.',
    evidence:
      'Hooks de validação de registro e regras updateRule com restrições booleanas impedem pulo de etapas ou reversões ilícitas.',
    limitations:
      'Requer disciplina estrita na definição do grafo de transições; estados finais (ex.: "assinado") devem tornar o registro imutável.',
    impact:
      'Assegura a rastreabilidade e a integridade de processo exigidas pelas diretrizes de telemedicina do CFM.',
    technicalDetails: [
      'Grafo de estados formal: recebido -> pendente -> em_analise -> laudado -> assinado -> cancelado',
      'Bloqueio permanente de alteração cadastral do laudo após estado "assinado"',
      'Registro de histórico de transição gravado automaticamente em log auditável',
    ],
  },
  {
    id: 'b3',
    code: 'B.3',
    title: 'Editor Estruturado de Laudos Cardiológicos com Versionamento',
    category: 'B',
    topic: 'operacao',
    topicLabel: 'Operação de Telelaudos',
    statusBadge: 'Implementável no Frontend + PB',
    summary:
      'Interface de laudo com parâmetros padronizados de ECG (ritmo, frequência cardíaca, eixos, intervalos PR/QRS/QTc, conclusão) e histórico de versões.',
    evidence:
      'Coleção laudos e coleção versoes_laudo armazenando instantâneos em campos text/json a cada salvamento ou revisão.',
    limitations:
      'O editor estruturado (com cálculos automáticos de Sokolow-Lyon, Cornell e QTc) deve ser implementado no frontend React; o Skip Cloud fornece persistência.',
    impact:
      'Garante agilidade ao cardiologista, diminui erros de digitação e preserva rascunhos em caso de queda de conexão.',
    technicalDetails: [
      'Autosalvamento em status "rascunho" com debounce',
      'Coleção versoes_laudo alimentada por hook onRecordBeforeUpdateSuccess a cada modificação do parecer',
      'Campos normalizados para métricas quantitativas de ECG e campos livres para conclusão',
    ],
  },
  {
    id: 'b4',
    code: 'B.4',
    title: 'Geração de Documentos Médicos em PDF Padronizados',
    category: 'B',
    topic: 'arquivos',
    topicLabel: 'Arquivos Médicos',
    statusBadge: 'Implementável via Biblioteca/Service',
    summary:
      'Renderização do laudo timbrado com cabeçalho da clínica, dados do paciente, medidas do ECG, conclusão diagnóstica e espaço para assinatura.',
    evidence:
      'Geração de PDF via biblioteca JavaScript client-side (ex: @react-pdf/renderer ou pdfmake) ou microserviço de renderização conectado via hook.',
    limitations:
      'PocketBase não possui conversor nativo de HTML para PDF; laudos em PDF devem ser compilados programaticamente e enviados como arquivo anexo.',
    impact: 'Produz o documento formal de entrega para o paciente e para a clínica solicitante.',
    technicalDetails: [
      'Montagem do layout timbrado seguindo a Resolução CFM 2.314/2022',
      'Inclusão de QR Code para conferência de autenticidade externa',
      'Armazenamento do PDF gerado no FileField da coleção laudos',
    ],
  },
  {
    id: 'b5',
    code: 'B.5',
    title: 'Cálculo e Registro de Hash Criptográfico de Integridade (SHA-256)',
    category: 'B',
    topic: 'seguranca',
    topicLabel: 'Segurança e LGPD',
    statusBadge: 'Implementável via Hook',
    summary:
      'Cálculo automatizado do checksum SHA-256 tanto para o arquivo original do exame quanto para o laudo final emitido.',
    evidence:
      'Função $security.sha256(s) disponível nativamente nas migrações e nos ganchos de servidor pb_hooks do PocketBase.',
    limitations:
      'O cálculo precisa ser disparado no hook de recebimento do upload para extrair os bytes do arquivo e persistir no campo sha256_hash.',
    impact:
      'Garante a não-repudiação do exame e comprova que o traçado analisado não sofreu alteração pós-recebimento.',
    technicalDetails: [
      'Hook onRecordBeforeCreate calcula SHA-256 dos bytes do arquivo anexado',
      'Hash gravado em campo text imutável da coleção exames_ecg',
      'Verificação periódica de integridade para atendimento às normas de auditoria clínica',
    ],
  },
  {
    id: 'b6',
    code: 'B.6',
    title: 'Trilha de Auditoria Operacional Completa (Audit Trail LGPD)',
    category: 'B',
    topic: 'seguranca',
    topicLabel: 'Segurança e LGPD',
    statusBadge: 'Implementável via Hook',
    summary:
      'Registro compulsório de todas as ações sensíveis: quem visualizou o traçado, quem assumiu, quem alterou rascunho, quem assinou e quando.',
    evidence:
      'Coleção dedicada logs_auditoria populada automaticamente por ganchos onRecordAfterCreateSuccess e onRecordAfterUpdateSuccess sem possibilidade de exclusão por usuários.',
    limitations:
      'Gera volume considerável de dados com o passar do tempo, exigindo rotina de arquivamento a frio após o período regulatório.',
    impact:
      'Atende diretamente ao Art. 6º, VIII e Art. 37 da LGPD (registro de operações de tratamento) e exigências do CFM para prontuários eletrônicos.',
    technicalDetails: [
      'Campos: usuario_id, organizacao_id, acao (VIEW, CLAIM, DRAFT, SIGN, EXPORT), recurso, ip_origem, created',
      'Coleção logs_auditoria configurada com createRule restrita e deleteRule: null (imutabilidade total)',
      'Associação do IP e User-Agent capturados do cabeçalho HTTP da requisição',
    ],
  },
  {
    id: 'b7',
    code: 'B.7',
    title: 'Controle de Prazos de Entrega (SLA) e Alertas de Urgência',
    category: 'B',
    topic: 'operacao',
    topicLabel: 'Operação de Telelaudos',
    statusBadge: 'Implementável com Crons/Hooks',
    summary:
      'Monitoramento dinâmico de tempo restante para laudar conforme prioridade (Rotina: 24h, Urgente: 2h, Emergência: 30min) com ordenação automática da fila.',
    evidence:
      'Campos date prazo_limite calculados na criação do exame com base na prioridade; rotinas de checagem periódica suportadas por cronAdd nos hooks do Skip Cloud.',
    limitations:
      'A menor granularidade suportada por cron jobs no PocketBase é baseada em intervalos crontab convencionais; a ordenação visual da fila deve ser em tempo real no frontend.',
    impact:
      'Garante o cumprimento dos contratos de prestação de serviços com as clínicas parceiras e previne desfechos adversos em casos críticos.',
    technicalDetails: [
      'Fórmula automática: prazo_limite = created + tempo_sla(prioridade)',
      'Ordenação de fila: sort: "prioridade_peso,prazo_limite"',
      'Alertas visuais de proximidade de estouro de SLA (verde/amarelo/vermelho)',
    ],
  },
  {
    id: 'b8',
    code: 'B.8',
    title: 'Protocolo de Comunicação Imediata de Achados Críticos',
    category: 'B',
    topic: 'operacao',
    topicLabel: 'Operação de Telelaudos',
    statusBadge: 'Implementável via Lógica Própria',
    summary:
      'Módulo de flag para achados de alto risco (ex: IAM com supra de ST, Bloqueio AV total, Taquicardia Ventricular) com notificação expressa.',
    evidence:
      'Coleção notificacoes_criticas e envio de email transacional via integração de mensageria do Skip Cloud.',
    limitations:
      'Notificações críticas para plantonistas clínicos via WhatsApp/SMS ou ligação de voz exigem gateway de telecomunicação externo (ver C.4).',
    impact:
      'Requisito ético-médico fundamental para intervenção em tempo hábil em casos de risco iminente de morte.',
    technicalDetails: [
      'Checkbox obrigatório de triagem de achado crítico com campo de contato de emergência da clínica',
      'Registro do horário exato do alerta e confirmação de leitura pelo operador de origem',
    ],
  },
  {
    id: 'b9',
    code: 'B.9',
    title: 'Módulo de Fechamento Financeiro e Faturamento por Clínica',
    category: 'B',
    topic: 'operacao',
    topicLabel: 'Operação de Telelaudos',
    statusBadge: 'Implementável no Modelo de Dados',
    summary:
      'Agrupamento e tarifação de exames laudados por período, tipo de convênio, urgência e clínica contratante.',
    evidence:
      'Coleções faturamento_fechamentos e faturamento_itens com relacionamentos para laudos_ecg e organizacoes.',
    limitations:
      'Emissão de Nota Fiscal de Serviço eletrônica (NFS-e) e boleto bancário exigem integração com gateway de pagamento externo.',
    impact:
      'Atende ao perfil "Financeiro" da empresa própria e das contratantes com extratos detalhados de produtividade.',
    technicalDetails: [
      'Cálculo do valor por laudo conforme tabela de preços negociada por organização',
      'Bloqueio de alteração de laudos já faturados no período fechado',
      'Relatórios de produtividade individual por cardiologista laudador',
    ],
  },
  {
    id: 'b10',
    code: 'B.10',
    title: 'Múltiplos Vínculos Organizacionais (Multi-Tenant Híbrido)',
    category: 'B',
    topic: 'auth',
    topicLabel: 'Autenticação e Permissões',
    statusBadge: 'Implementável via Modelagem Relacional',
    summary:
      'Permitir que um mesmo cardiologista atue para mais de uma empresa ou clínica, selecionando o contexto operacional ativo.',
    evidence:
      'Modelagem com coleção intermediária usuarios_organizacoes (tabela de junção n:n com campo papel e status_vinculo).',
    limitations:
      'O PocketBase nativo associa cada usuário a um registro em users; o chaveamento de organização ativa requer controle no frontend e validação das regras baseadas no token ou relação.',
    impact:
      'Viabiliza o modelo de negócio híbrido futuro sem precisar recriar a arquitetura da plataforma.',
    technicalDetails: [
      'Tabela associativa: usuario_id, organizacao_id, perfil, ativo',
      'Regras de RLS validam existência de registro na tabela associativa antes de autorizar acesso',
      'Seleção de contexto operacional no cabeçalho da sessão',
    ],
  },
  {
    id: 'b11',
    code: 'B.11',
    title: 'Download Seguro e Streaming Autorizado de Documentos Médicos',
    category: 'B',
    topic: 'arquivos',
    topicLabel: 'Arquivos Médicos',
    statusBadge: 'Implementável via Custom Route',
    summary:
      'Distribuição dos exames e laudos mediante validação em tempo real de token, verificação de vínculo com a clínica e registro de log de acesso.',
    evidence:
      'Custom route em pb_hooks com routerAdd("GET", "/backend/v1/exames/:id/download", ...) com verificação de autenticação $apis.requireAuth().',
    limitations:
      'Requer desenvolvimento de endpoint customizado para não expor as URLs originais e auditar cada download individual.',
    impact:
      'Impede a exposição de dados clínicos e imagens de pacientes na web pública através de URLs compartilháveis.',
    technicalDetails: [
      'Validação de pertença à clínica proprietária do exame antes de despachar os bytes',
      'Gravação automática de evento no logs_auditoria ao entregar o arquivo',
      'Cabeçalhos HTTP seguros (Content-Disposition, Cache-Control: private, no-store)',
    ],
  },
  {
    id: 'b12',
    code: 'B.12',
    title: 'Controle de Duplicidade de Envios e Idempotência de Upload',
    category: 'B',
    topic: 'integracoes',
    topicLabel: 'Integrações Futuras',
    statusBadge: 'Implementável via Hash e Unique Index',
    summary:
      'Detecção de reenvio inadvertido do mesmo arquivo ou exame por operadores de clínicas com conexões instáveis.',
    evidence:
      'Índice SQLite UNIQUE em coluna calculada (organizacao_id + sha256_hash) ou checagem preventiva em gancho onRecordBeforeCreate.',
    limitations: 'Exige cálculo prévio do hash antes de persistir o registro no banco.',
    impact:
      'Evita cobranças duplicadas para a clínica e poluição da fila de trabalho dos cardiologistas.',
    technicalDetails: [
      'CREATE UNIQUE INDEX idx_exames_hash_org ON exames_ecg (organizacao_id, sha256_hash)',
      'Tratamento amigável de erro 400/409 informando que o exame já se encontra cadastrado',
    ],
  },

  // ==========================================
  // SEÇÃO C: INTEGRAÇÕES EXTERNAS NECESSÁRIAS
  // ==========================================
  {
    id: 'c1',
    code: 'C.1',
    title: 'Assinatura Digital de Laudos Médicos ICP-Brasil (PAdES)',
    category: 'C',
    topic: 'assinatura',
    topicLabel: 'Assinatura Digital',
    statusBadge: 'Exige Provedor Externo',
    summary:
      'Assinatura eletrônica qualificada com certificado digital ICP-Brasil (A1/A3 ou em nuvem: BirdID, SafeID, VIDA) com carimbo do tempo.',
    evidence:
      'A legislação brasileira (Lei 14.063/2020, Resoluções CFM 2.299/2021 e 2.314/2022) exige certificado padrão ICP-Brasil para emissão válida de laudos médicos a distância. O Skip Cloud não opera como Autoridade Certificadora nem possui HSM criptográfico.',
    limitations:
      'Skip Cloud não tem capacidade nativa de assinar documentos com certificados ICP-Brasil. É mandatório integrar via API com provedor especializado (ex.: Bry Tecnologia, Certisign, ArqSign, ZapSign, Clicksign, QualiSign).',
    impact:
      'Sem este componente externo, os laudos médicos emitidos não possuem validade jurídica perante o CFM, operadoras de saúde e tribunais.',
    technicalDetails: [
      'Integração via webhook/API REST com provedor credenciado no ITI',
      'Fluxo: Skip Cloud gera PDF -> Envia hash/documento para Provedor ICP -> Médico autoriza com token/nuvem -> Provedor assina no formato PAdES com carimbo do tempo -> Skip Cloud armazena PDF assinado e evidências',
      'Preservação do pacote de assinaturas e metadados LTV (Long Term Validation)',
    ],
    mitigationOrAction:
      'Contratar serviço homologado no padrão ICP-Brasil com suporte a certificados A1 ou nuvem (PSC).',
  },
  {
    id: 'c2',
    code: 'C.2',
    title: 'Conectores com Fabricantes de Eletrocardiógrafos (ECG Hardware)',
    category: 'C',
    topic: 'integracoes',
    topicLabel: 'Integrações Futuras',
    statusBadge: 'Exige Middleware / Adaptadores',
    summary:
      'Recepção automatizada de traçados gerados diretamente por aparelhos de ECG de fabricantes variados (GE, Philips, Nihon Kohden, Teb, Micromed, etc.).',
    evidence:
      'Fabricantes utilizam protocolos proprietários, exportações em diretório compartilhado (SCP-ECG, PDF proprietário, XML FDA, HL7 aECG). O Skip Cloud disponibiliza apenas endpoints HTTP/REST padrão.',
    limitations:
      'O Skip Cloud não possui drivers nativos para comunicação direta com equipamentos de hardware ou portas seriais/locais.',
    impact:
      'Exige o desenvolvimento de um "Agente de Integração Local" (software gateway instalado na clínica) que lê a pasta de saída do eletrocardiógrafo e faz POST autenticado na API do Skip Cloud.',
    technicalDetails: [
      'Desenvolvimento de conector desktop/serviço leve para clínicas em fase futura',
      'API REST autenticada no Skip Cloud com API Key específica por aparelho/unidade',
      'Tratamento de formatos legados e conversão para visualização na plataforma',
    ],
    mitigationOrAction:
      'Criar especificação de API para agentes locais de captura e priorizar inicialmente upload manual (PDF/PNG/JPEG).',
  },
  {
    id: 'c3',
    code: 'C.3',
    title: 'Interoperabilidade Clínica com Padrões HL7 FHIR e DICOM',
    category: 'C',
    topic: 'integracoes',
    topicLabel: 'Integrações Futuras',
    statusBadge: 'Exige Conversores Especializados',
    summary:
      'Integração de laudos e pedidos com Prontuários Eletrônicos (PEP), sistemas hospitalares (HIS/RIS) e servidores PACS.',
    evidence:
      'Padrões de interoperabilidade em saúde possuem esquemas complexos (recursos FHIR DiagnosticReport, Observation; objetos DICOM Waveform). O Skip Cloud opera com esquemas relacionais JSON genéricos.',
    limitations:
      'Não há servidor PACS ou FHIR nativo dentro do Skip Cloud. Intercâmbio direto com redes hospitalares de grande porte exige adaptadores de protocolo.',
    impact:
      'Para integração com grandes redes de hospitais, será necessário manter um gateway de mensageria HL7 ou servidor DICOM auxiliar.',
    technicalDetails: [
      'Possibilidade de expor endpoints REST estruturados no modelo FHIR DiagnosticReport via routerAdd',
      'Mapeamento bidirecional de mensagens JSON para interoperabilidade externa',
      'Uso de bibliotecas especializadas de parser DICOM em serviço intermediário',
    ],
    mitigationOrAction:
      'Arquitetar o banco de dados interno com nomenclatura alinhada ao FHIR para facilitar tradução futura.',
  },
  {
    id: 'c4',
    code: 'C.4',
    title: 'Notificações Críticas de Alta Disponibilidade (WhatsApp / SMS / Voz)',
    category: 'C',
    topic: 'integracoes',
    topicLabel: 'Integrações Futuras',
    statusBadge: 'Exige Gateway de Telecomunicações',
    summary:
      'Disparo de alertas imediatos de achados eletrocardiográficos com risco iminente de morte diretamente no celular do médico assistente.',
    evidence:
      'Skip Cloud suporta email transacional; telecomunicações de urgência (SMS, WhatsApp Business API, TTS voice call) exigem operadoras homologadas.',
    limitations:
      'O envio de email não é suficiente para emergências médicas devido ao atraso de leitura e taxas de abertura.',
    impact:
      'Essencial para a garantia da segurança do paciente em casos de laudos emergenciais (IAM com supra de ST, arritmias ventriculares instáveis).',
    technicalDetails: [
      'Integração via hook com APIs como Twilio, Z-API ou Meta Cloud API',
      'Disparo condicionado à marcação de "Achado Crítico" pelo cardiologista laudador',
      'Confirmação de recebimento (read receipt) registrada na trilha de auditoria',
    ],
    mitigationOrAction:
      'Contratar gateway de mensagens instantâneas e configurar chamada de webhook no backend.',
  },

  // ==========================================
  // SEÇÃO D: LIMITAÇÕES E PONTOS NÃO COMPROVADOS
  // ==========================================
  {
    id: 'd1',
    code: 'D.1',
    title: 'Autenticação Multifator (MFA/2FA) Não Nativa no Ambiente',
    category: 'D',
    topic: 'auth',
    topicLabel: 'Autenticação e Permissões',
    statusBadge: 'Não Nativo / Requer Desenvolvimento',
    summary:
      'O ambiente PocketBase padrão não disponibiliza mecanismo nativo completo de autenticação TOTP (Authenticator App) ou SMS no fluxo padrão de login.',
    evidence:
      'Inspecionada a configuração de auth do backend: sem suporte a MFA nas regras nativas da coleção users. A rota nativa /api/collections/users/auth-with-password emite o token JWT diretamente com base em email/senha.',
    limitations:
      'Caso o MFA seja exigido obrigatoriamente para cardiologistas e administradores, será necessário desenvolver um fluxo customizado em duas etapas usando rotas dedicadas e tokens intermediários.',
    impact:
      'Ponto crítico de segurança para mitigar invasão de contas médicas que possuem poder de emissão de laudos.',
    mitigationOrAction:
      'Implementar rota intermediária de verificação TOTP em pb_hooks ou usar OAuth2 com provedor que já force MFA (Google Workspace / Microsoft Entra).',
  },
  {
    id: 'd2',
    code: 'D.2',
    title: 'Criptografia em Repouso no SQLite Subjacente Não Comprovada',
    category: 'D',
    topic: 'seguranca',
    topicLabel: 'Segurança e LGPD',
    statusBadge: 'Depende de Infraestrutura do Provedor',
    summary:
      'O PocketBase grava dados no disco como um arquivo de banco de dados SQLite convencional, que não é criptografado a nível de aplicação por padrão.',
    evidence:
      'Estrutura SQLite nativa opera com leitura direta de blocos do arquivo .db; não há extensão SQLCipher habilitada nativamente comprovada no ambiente inspecionado.',
    limitations:
      'A proteção em repouso depende integralmente da criptografia do volume de disco subjacente (EBS/LUKS no host da nuvem Skip Cloud). Não há chave controlada pelo cliente.',
    impact:
      'Exige Acordo de Processamento de Dados (DPA) formal com o provedor Skip Cloud atestando a criptografia física dos discos e dos backups.',
    mitigationOrAction:
      'Solicitar comprovação documental de criptografia em repouso nos volumes de armazenamento do provedor Skip Cloud e, para dados ultra-críticos (CPF, diagnósticos), aplicar criptografia de coluna via $security.encrypt(text, key) antes de salvar.',
  },
  {
    id: 'd3',
    code: 'D.3',
    title: 'Localização Física dos Servidores e Transferência Internacional (LGPD)',
    category: 'D',
    topic: 'seguranca',
    topicLabel: 'Segurança e LGPD',
    statusBadge: 'Ponto Pendente de Confirmação',
    summary:
      'A localização geográfica do datacenter onde os dados dos exames e pacientes residem não está explícita no ambiente.',
    evidence:
      'A URL do backend (*.shrd01.internal.goskip.dev) aponta para infraestrutura gerenciada pelo Skip Cloud. Não há documento acessível via painel informando o país sede dos servidores.',
    limitations:
      'Se os servidores estiverem situados fora do território nacional (ex: EUA ou Europa), aplica-se o Art. 33 da LGPD (Transferência Internacional de Dados).',
    impact:
      'Pode exigir cláusulas contratuais específicas de transferência internacional e adequação dos termos de consentimento e termos de prestação de serviço clínico.',
    mitigationOrAction:
      'Obter do provedor de infraestrutura a confirmação oficial da região de hospedagem (Brasil vs. Exterior) e certidões de conformidade dos datacenters.',
  },
  {
    id: 'd4',
    code: 'D.4',
    title: 'Revogação Seletiva e Imediata de Sessões Ativas',
    category: 'D',
    topic: 'auth',
    topicLabel: 'Autenticação e Permissões',
    statusBadge: 'Limitação Técnica de JWT',
    summary:
      'Como a autenticação opera com JSON Web Tokens auto-contidos emitidos para o cliente, revogar uma sessão sem alterar as credenciais globais do usuário é limitado.',
    evidence:
      'No PocketBase, a invalidação de tokens ocorre via rotação do tokenKey do usuário, o que desconecta todas as sessões ativas daquele usuário de uma só vez.',
    limitations:
      'Não é possível deslogar apenas "o navegador do consultório B" mantendo ativo "o celular do médico" de forma nativa.',
    impact:
      'Impacto operacional moderado; em caso de suspeita de vazamento, todas as sessões do usuário devem ser invalidadas compulsoriamente.',
    mitigationOrAction:
      'Configurar tempo de vida de token JWT curto (ex: 2 a 4 horas) e utilizar rotação de tokenKey quando for solicitado encerramento de acessos.',
  },
  {
    id: 'd5',
    code: 'D.5',
    title: 'Política Automatizada de Retenção e Descarte Seguro de Prontuários',
    category: 'D',
    topic: 'seguranca',
    topicLabel: 'Segurança e LGPD',
    statusBadge: 'Requer Implementação Customizada',
    summary:
      'A legislação médica brasileira (Lei 13.787/2018) exige guarda de prontuários médicos pelo prazo mínimo de 20 anos a partir do último registro.',
    evidence:
      'Skip Cloud não inclui regras nativas de ciclo de vida de dados (data lifecycle management) ou expiração programada de registros médicos.',
    limitations:
      'A governança de expiração e expurgo seguro (quando cabível sob a LGPD) deve ser controlada via rotinas programadas por código.',
    impact:
      'Exige planejamento de capacidade de armazenamento para 20 anos de exames de ECG e laudos assinados.',
    mitigationOrAction:
      'Criar rotina em hook de arquivo a frio ou integração com storage de arquivamento de longo prazo (ex: S3 Glacier) com proteção contra deleção acidental.',
  },
  {
    id: 'd6',
    code: 'D.6',
    title: 'Declaração de Conformidade Regulamentar (LGPD / CFM / SBIS)',
    category: 'D',
    topic: 'seguranca',
    topicLabel: 'Segurança e LGPD',
    statusBadge: 'Não Pode Ser Declarada sem Evidências Formais',
    summary:
      'Conformidade com os padrões SBIS/CFM para Sistemas de Registro Eletrônico em Saúde (S-RES) e conformidade integral com a LGPD.',
    evidence:
      'A conformidade técnica e jurídica não é fornecida de forma automática pela infraestrutura; o sistema de telelaudos precisará passar por auditoria própria.',
    limitations:
      'O uso do Skip Cloud não confere por si só certificado digital SBIS nem isenta os controladores clínicos de suas obrigações legais.',
    impact:
      'É imperativo não veicular ao mercado que a plataforma é "Certificada pelo CFM/SBIS" sem que o processo formal de certificação seja conduzido.',
    mitigationOrAction:
      'Elaborar Relatório de Impacto à Proteção de Dados Pessoais (RIPD/DPIA) e adotar os manuais de segurança da SBIS como guia de desenvolvimento.',
  },
]

export const ARCHITECTURE_BLOCKS: ArchitectureBlock[] = [
  {
    id: 'frontend',
    layer: 'frontend',
    layerLabel: 'Camada de Apresentação',
    title: 'Aplicação Web Responsiva (React + Vite)',
    subtitle: 'Ambiente SPA clínico para operadores, cardiologistas e gestores',
    role: 'Interface rica de triagem, fila de exames com priorização por SLA, visualizador de traçado de ECG (PDF/imagens), editor estruturado de laudo e extrato de faturamento.',
    items: [
      'Dashboard Operacional com separação de contexto por clínica',
      'Fila de Eletrocardiogramas com indicadores de SLA e emergência',
      'Visualizador de Traçados de ECG em alta resolução com ferramentas de medição',
      'Editor de Laudos Cardiológicos com rascunho automático',
      'Integração com Widget de Assinatura Digital ICP-Brasil',
    ],
    tags: ['React 19', 'Tailwind CSS', 'Shadcn UI', 'SPA', 'TLS Client'],
  },
  {
    id: 'backend',
    layer: 'backend',
    layerLabel: 'Camada de Backend (Skip Cloud)',
    title: 'Núcleo Operacional e Lógica de Negócios (PocketBase v0.36)',
    subtitle: 'Banco relacional, motor de regras, armazenamento e webhooks',
    role: 'Centralização de dados de clientes, pacientes e exames; isolamento multi-tenant por regras de RLS; ganchos de transição de estado atômica e fila central com mutex.',
    items: [
      'Autenticação e Sessões com RBAC (5 perfis de acesso clínicos/administrativos)',
      'Coleções Relacionais: Organizacoes, Clinicas, Unidades, Medicos, Pacientes, Exames, Laudos, Faturas',
      'API Rules estritas com filtro de isolamento: organizacao_id = @request.auth.organizacao_id',
      'Ganchos (pb_hooks): Atribuição exclusiva de exames, máquina de estados e cálculo de SHA-256',
      'File Storage com rotas autorizadas de streaming de exames e laudos médicos',
    ],
    tags: ['PocketBase v0.36', 'SQLite', 'JS Hooks', 'RLS Engine', 'API REST'],
  },
  {
    id: 'external',
    layer: 'external',
    layerLabel: 'Camada de Integrações Externas',
    title: 'Serviços Especializados Credenciados e Gateways',
    subtitle: 'Validade jurídica nacional, interoperabilidade e telecomunicações',
    role: 'Delegação de funções que ultrapassam as capacidades nativas do Skip Cloud para agentes credenciados e autoridades oficiais.',
    items: [
      'Provedor de Assinatura ICP-Brasil (PAdES com carimbo do tempo e PSC nuvem)',
      'Conectores e Agentes Locais de Eletrocardiógrafos para captura em clínicas',
      'Gateway de Mensageria de Emergência (WhatsApp Business API / SMS para achados críticos)',
      'Conversores futuros para protocolos HL7 FHIR e barramentos hospitalares',
    ],
    tags: ['ICP-Brasil', 'PAdES / LTV', 'Webhooks', 'REST Gateways', 'Agente Local'],
  },
  {
    id: 'security',
    layer: 'security',
    layerLabel: 'Camada de Governança e Segurança',
    title: 'Políticas de Proteção, Integridade e Conformidade LGPD',
    subtitle: 'Garantias transversais a todas as camadas da plataforma',
    role: 'Garantir a integridade do ato médico a distância, confidencialidade dos dados sensíveis de saúde e rastreabilidade irrefutável de acessos.',
    items: [
      'Criptografia em trânsito com TLS 1.3 obrigatório em todas as comunicações',
      'Hash SHA-256 gravado na recepção do exame e na emissão do laudo para não-repudiação',
      'Trilha de Auditoria imutável (Audit Trail) de todas as visualizações e ações clínicas',
      'Isolamento lógico estrito entre empresas contratantes na mesma base (multi-tenant seguro)',
    ],
    tags: ['LGPD Art. 6/37', 'Resolução CFM 2.314', 'SHA-256', 'Trilha Auditável', 'TLS 1.3'],
  },
]

export const SUMMARY_STATS = {
  totalItems: AUDIT_ITEMS.length,
  categoryA: AUDIT_ITEMS.filter((i) => i.category === 'A').length,
  categoryB: AUDIT_ITEMS.filter((i) => i.category === 'B').length,
  categoryC: AUDIT_ITEMS.filter((i) => i.category === 'C').length,
  categoryD: AUDIT_ITEMS.filter((i) => i.category === 'D').length,
}
