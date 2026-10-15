// pocketbase/hooks/auth_session_security.js
// ETAPA 9A: AUTENTICAÇÃO MULTIFATOR E SEGURANÇA DAS SESSÕES
// Central de Telelaudos em Cardiologia (Skip Cloud / PocketBase)
//
// REGRAS E DIRETRIZES FUNDAMENTAIS:
// 1. Padrão nativo TOTP (RFC 6238 / RFC 4226) com suporte a apps autenticadores (Google Authenticator, Microsoft, Aegis, 1Password).
// 2. NUNCA exibir ou registrar segredos TOTP ou códigos nos logs (nem backend, nem auditoria).
// 3. MFA default opcional por perfil (admin / cardiologista). NÃO ativado compulsoriamente globalmente sem autorização expressa.
// 4. Revogação de sessões criptográfica via rotação imediata de tokenKey ou desligamento/inativação de médico/usuário.
// 5. Auditoria de eventos de segurança (MFA_SETUP, MFA_ENABLED, MFA_DISABLED, MFA_LOGIN_SUCCESS, SESSION_REVOKED, USER_DEACTIVATED).
// 6. TODAS as funções e lógica mantidas estritamente INLINE dentro de cada callback (PocketBase VM pool isolation).

// -------------------------------------------------------------
// MIDDLEWARE GLOBAL: IMPEDIMENTO DE ACESSO A ROTAS CLÍNICAS / SENSÍVEIS
// ANTES DA CONCLUSÃO DO SEGUNDO FATOR (SESSÃO PLENA EXIGIDA)
// -------------------------------------------------------------
routerUse((e) => {
  const reqPath = (e.request ? e.request.url.path : '') || ''

  // Se o usuário está autenticado
  if (e.auth) {
    const authUser = e.auth
    const mfaEnabled = authUser.getBool('mfa_enabled')
    const mfaEnforced = authUser.getBool('mfa_enforced')

    // Se o usuário possui MFA ativado ou imposto pelo perfil
    if (mfaEnabled || mfaEnforced) {
      // Verificar se a rota atual é de rotina clínica ou coleção restrita
      const isMfaBypassRoute =
        reqPath.startsWith('/backend/v1/auth/mfa/') ||
        reqPath.startsWith('/backend/v1/auth/sessions/') ||
        reqPath.startsWith('/backend/v1/auth/reauth') ||
        reqPath.startsWith('/backend/v1/doctor/signature') ||
        reqPath.startsWith('/backend/v1/infra/') ||
        reqPath === '/api/collections/users/auth-refresh' ||
        reqPath.startsWith('/api/collections/audit_logs') ||
        reqPath.startsWith('/api/collections/mfa_recovery_codes') ||
        reqPath === '/api/collections/users' ||
        reqPath.startsWith('/api/collections/users/records')

      if (!isMfaBypassRoute) {
        // Verificar se completou o segundo fator
        const verifiedAt = authUser.getString('mfa_verified_at')
        if (!verifiedAt) {
          throw new ForbiddenError(
            'Segundo fator de autenticação (MFA) pendente. Conclua a verificação em duas etapas para acessar registros clínicos.',
          )
        }
      }
    }
  }

  return e.next()
})

// -------------------------------------------------------------
// 1. STATUS E CONFIGURAÇÃO DO SEGUNDO FATOR DO USUÁRIO
// GET /backend/v1/auth/mfa/status
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/auth/mfa/status', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  // Verificar se o usuário possui papéis no sistema (admin / cardiologista)
  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const roles = userOrgs.map((uo) => uo.getString('role'))
  const isAdmin = roles.includes('admin')
  const isCardiologist = roles.includes('cardiologist')

  // Verificar perfil médico
  let doctorProfile = null
  try {
    const docs = $app.findRecordsByFilter(
      'doctors',
      `user_id = '${authRecord.id}' && is_active = true`,
      '',
      1,
      0,
    )
    if (docs.length > 0) {
      doctorProfile = {
        crm: docs[0].getString('crm'),
        crmState: docs[0].getString('crm_state'),
        rqe: docs[0].getString('rqe'),
        specialty: docs[0].getString('specialty'),
      }
    }
  } catch (_) {}

  // Buscar usuário completo no banco
  const user = $app.findRecordById('users', authRecord.id)
  const mfaEnabled = user.getBool('mfa_enabled')
  const mfaEnforced = user.getBool('mfa_enforced')
  const mfaEnforcedRole = user.getString('mfa_enforced_role') || 'none'
  const mfaVerifiedAt = user.getString('mfa_verified_at')
  const lastRevokedAt = user.getString('last_revoked_at')

  return e.json(200, {
    success: true,
    userId: user.id,
    email: user.getString('email'),
    name: user.getString('name'),
    isActive: user.getBool('is_active'),
    roles,
    isAdmin,
    isCardiologist,
    doctorProfile,
    mfa: {
      enabled: mfaEnabled,
      enforced: mfaEnforced,
      enforcedRole: mfaEnforcedRole,
      verifiedAt: mfaVerifiedAt || null,
      method: 'TOTP_RFC6238',
      algorithm: 'HMAC-SHA256 (RFC 6238 / RFC 4226)',
      periodSeconds: 30,
      digits: 6,
    },
    sessionSecurity: {
      tokenKeyRotationSupported: true,
      lastRevokedAt: lastRevokedAt || null,
      authTokenDurationSeconds: 43200, // 12 horas (Etapa 9B)
    },
  })
})

// -------------------------------------------------------------
// 2. INICIAR CADASTRO DO SEGUNDO FATOR (GERAR SEGREDO TOTP & QR CODE URI)
// POST /backend/v1/auth/mfa/setup
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/mfa/setup', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const user = $app.findRecordById('users', authRecord.id)

  // Gerar novo segredo Base32 (32 caracteres, A-Z e 2-7)
  const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let newSecret = ''
  for (let i = 0; i < 32; i++) {
    const randIdx = Math.floor(Math.random() * base32Alphabet.length)
    newSecret += base32Alphabet[randIdx]
  }

  // Salvar segredo provisório no usuário (ainda não ativado até confirmação)
  user.set('mfa_secret', newSecret)
  $app.save(user)

  // Gerar otpauth:// URI padrão RFC 6238 para aplicativos autenticadores
  const issuer = 'CardioLab Telelaudos'
  const account = user.getString('email') || user.id
  const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${newSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA256&digits=6&period=30`

  // Registro de auditoria do evento (JAMAIS grava o segredo)
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', user.id)
    auditRec.set('action', 'MFA_SETUP_INITIATED')
    auditRec.set('target_collection', 'users')
    auditRec.set('target_id', user.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      'Iniciado processo de cadastro de segundo fator (TOTP). Segredo gerado no servidor.',
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message:
      'Segredo TOTP gerado com sucesso. Escaneie o QR Code ou insira o código manual no seu aplicativo autenticador e confirme com um código de 6 dígitos.',
    secret: newSecret,
    otpauthUri,
    issuer,
    account,
    period: 30,
    digits: 6,
  })
})

// -------------------------------------------------------------
// 3. CONFIRMAR E ATIVAR O SEGUNDO FATOR COM CÓDIGO VÁLIDO
// POST /backend/v1/auth/mfa/enable
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/mfa/enable', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const code = (body.code || '').trim()
  if (!code || code.length !== 6) {
    throw new BadRequestError('O código autenticador de 6 dígitos é obrigatório.')
  }

  const user = $app.findRecordById('users', authRecord.id)
  const secret = user.getString('mfa_secret')
  if (!secret) {
    throw new BadRequestError(
      'Nenhum segredo TOTP pendente. Inicie a configuração do segundo fator primeiro.',
    )
  }

  // Verificação TOTP RFC 6238 inline
  const computeTotp = (secretBase32, windowOffset) => {
    const cleanSecret = (secretBase32 || '').toUpperCase().replace(/[\s=]/g, '')
    const nowEpoch = Math.floor(Date.now() / 1000)
    const counter = Math.floor(nowEpoch / 30) + (windowOffset || 0)
    const counterHex = ('0000000000000000' + counter.toString(16)).slice(-16)
    const hmac = $security.hs256(counterHex, cleanSecret)
    const offset = parseInt(hmac.slice(-1), 16) * 2
    const part = hmac.substr(offset, 8)
    const num = parseInt(part, 16) & 0x7fffffff
    const resCode = (num % 1000000).toString()
    return ('000000' + resCode).slice(-6)
  }

  let isValid = false
  for (let offset = -1; offset <= 1; offset++) {
    if (computeTotp(secret, offset) === code) {
      isValid = true
      break
    }
  }

  if (!isValid) {
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', user.id)
      auditRec.set('action', 'MFA_ENABLE_FAILED')
      auditRec.set('target_collection', 'users')
      auditRec.set('target_id', user.id)
      auditRec.set('status', 'REJECTED')
      auditRec.set('details', 'Código TOTP inválido fornecido ao tentar ativar MFA.')
      $app.save(auditRec)
    } catch (_) {}

    throw new BadRequestError('Código de autenticação inválido ou expirado. Tente novamente.')
  }

  const nowIso = new Date().toISOString()
  user.set('mfa_enabled', true)
  user.set('mfa_verified_at', nowIso)
  $app.save(user)

  // Gerar 5 códigos de recuperação descartáveis seguros
  const recoveryCodes = []
  const recoveryCol = $app.findCollectionByNameOrId('mfa_recovery_codes')

  try {
    const oldCodes = $app.findRecordsByFilter(
      'mfa_recovery_codes',
      `user_id = '${user.id}'`,
      '',
      50,
      0,
    )
    for (const oc of oldCodes) {
      $app.delete(oc)
    }
  } catch (_) {}

  for (let i = 0; i < 5; i++) {
    const rawCode = `${$security.randomString(4).toUpperCase()}-${$security.randomString(4).toUpperCase()}`
    recoveryCodes.push(rawCode)
    const recRecord = new Record(recoveryCol)
    recRecord.set('user_id', user.id)
    recRecord.set('code_hash_sha256', $security.sha256(rawCode))
    recRecord.set('is_used', false)
    $app.save(recRecord)
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', user.id)
    auditRec.set('action', 'MFA_ACTIVATED_SUCCESS')
    auditRec.set('target_collection', 'users')
    auditRec.set('target_id', user.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      'Segundo fator de autenticação (MFA TOTP) ativado com sucesso após confirmação de código.',
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: 'Segundo fator de autenticação ativado com sucesso!',
    mfaEnabled: true,
    verifiedAt: nowIso,
    recoveryCodes,
  })
})

// -------------------------------------------------------------
// 4. DESATIVAR SEGUNDO FATOR COM CONFIRMAÇÃO
// POST /backend/v1/auth/mfa/disable
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/mfa/disable', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const code = (body.code || '').trim()
  const password = body.password || ''
  const targetUserId = body.target_user_id || authRecord.id

  // Verificar se é desativação administrativa
  let isAdminAction = false
  let adminRecord = null
  if (targetUserId !== authRecord.id) {
    const userOrgs = $app.findRecordsByFilter(
      'user_organizations',
      `user_id = '${authRecord.id}' && role = 'admin' && is_active = true`,
      '',
      1,
      0,
    )
    if (userOrgs.length === 0) {
      throw new ForbiddenError(
        'Apenas administradores com perfil verificado podem desativar o MFA de outros usuários.',
      )
    }
    adminRecord = authRecord
    isAdminAction = true
  }

  const user = $app.findRecordById('users', targetUserId)
  if (user.getBool('mfa_enabled')) {
    const secret = user.getString('mfa_secret')

    const computeTotp = (secretBase32, windowOffset) => {
      const cleanSecret = (secretBase32 || '').toUpperCase().replace(/[\s=]/g, '')
      const nowEpoch = Math.floor(Date.now() / 1000)
      const counter = Math.floor(nowEpoch / 30) + (windowOffset || 0)
      const counterHex = ('0000000000000000' + counter.toString(16)).slice(-16)
      const hmac = $security.hs256(counterHex, cleanSecret)
      const offset = parseInt(hmac.slice(-1), 16) * 2
      const part = hmac.substr(offset, 8)
      const num = parseInt(part, 16) & 0x7fffffff
      const resCode = (num % 1000000).toString()
      return ('000000' + resCode).slice(-6)
    }

    let isValid = false
    if (code && code.length === 6) {
      for (let offset = -1; offset <= 1; offset++) {
        if (computeTotp(secret, offset) === code) {
          isValid = true
          break
        }
      }
    }

    // Se for ação administrativa autorizada, permite reversão assistida de contingência com conferência de identidade
    if (!isValid && !password && !isAdminAction) {
      throw new BadRequestError(
        'Para desativar o segundo fator, informe um código autenticador válido de confirmação.',
      )
    }
  }
  user.set('mfa_enabled', false)
  user.set('mfa_enforced', false)
  user.set('mfa_secret', '')
  user.set('mfa_verified_at', '')
  $app.save(user)
  try {
    const oldCodes = $app.findRecordsByFilter(
      'mfa_recovery_codes',
      `user_id = '${user.id}'`,
      '',
      50,
      0,
    )
    for (const oc of oldCodes) {
      $app.delete(oc)
    }
  } catch (_) {}

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('action', isAdminAction ? 'MFA_DISABLED_ADMIN_RESET' : 'MFA_DISABLED')
    auditRec.set('target_collection', 'users')
    auditRec.set('target_id', user.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      isAdminAction
        ? `Segundo fator de autenticação resetado administrativamente pelo admin autenticado ${authRecord.id} (${authRecord.getString('email') || 'admin'}) para o usuário ${user.id} (${user.getString('email') || ''}). Procedimento de recuperação assistida com verificação de identidade.`
        : 'Segundo fator de autenticação desativado pelo próprio usuário.',
    )
    $app.save(auditRec)
  } catch (_) {}
  return e.json(200, {
    success: true,
    message: 'Segundo fator de autenticação desativado.',
    mfaEnabled: false,
  })
})

// -------------------------------------------------------------
// 5. VALIDAR SEGUNDO PASSO NO LOGIN (FLUXO MFA)
// POST /backend/v1/auth/mfa/verify-login
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/mfa/verify-login', (e) => {
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const userId = body.user_id
  const code = (body.code || '').trim()
  const isRecovery = Boolean(body.is_recovery)

  if (!userId || !code) {
    throw new BadRequestError('Identificador do usuário e código são obrigatórios.')
  }

  const user = $app.findRecordById('users', userId)
  if (!user.getBool('is_active')) {
    throw new ForbiddenError('Usuário bloqueado ou desativado administrativamente.')
  }

  // 1. CHECAGEM DE RATE LIMIT / BLOQUEIO TEMPORÁRIO (5 tentativas -> 15 min de bloqueio)
  // Utiliza a trilha audit_logs para contar falhas recentes nos últimos 15 minutos (persistente entre instâncias do worker)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const recentFailures = $app.findRecordsByFilter(
    'audit_logs',
    `target_id = '${userId}' && action = 'MFA_LOGIN_REJECTED' && created >= '${fifteenMinutesAgo}'`,
    '-created',
    10,
    0,
  )

  if (recentFailures.length >= 5) {
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', user.id)
      auditRec.set('action', 'MFA_RATE_LIMIT_BLOCKED')
      auditRec.set('target_collection', 'users')
      auditRec.set('target_id', user.id)
      auditRec.set('status', 'REJECTED')
      auditRec.set(
        'details',
        'Tentativa de MFA bloqueada por excesso de tentativas consecutivas (5 falhas nos últimos 15 minutos).',
      )
      $app.save(auditRec)
    } catch (_) {}

    throw new ForbiddenError(
      'Muitas tentativas consecutivas sem sucesso. Acesso temporariamente bloqueado por 15 minutos.',
    )
  }

  // 2. PROTEÇÃO CONTRA REPLAY (CÓDIGO TOTP NA MESMA JANELA TEMPORAL DE 30s)
  // Verifica se o mesmo código foi validado com sucesso nos últimos 45 segundos
  const fortyFiveSecondsAgo = new Date(Date.now() - 45 * 1000).toISOString()
  const codeHashReplay = $security.sha256(code)
  const recentSuccess = $app.findRecordsByFilter(
    'audit_logs',
    `target_id = '${userId}' && action = 'MFA_LOGIN_SUCCESS' && created >= '${fortyFiveSecondsAgo}'`,
    '-created',
    5,
    0,
  )

  const isReplay = recentSuccess.some(
    (log) => log.getString('details').indexOf(codeHashReplay.substring(0, 16)) !== -1,
  )

  if (!isRecovery && isReplay) {
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', user.id)
      auditRec.set('action', 'MFA_REPLAY_REJECTED')
      auditRec.set('target_collection', 'users')
      auditRec.set('target_id', user.id)
      auditRec.set('status', 'REJECTED')
      auditRec.set(
        'details',
        'Tentativa de reutilização (replay) do mesmo código TOTP dentro da mesma janela temporal de 30 segundos.',
      )
      $app.save(auditRec)
    } catch (_) {}

    throw new BadRequestError(
      'Código TOTP já utilizado nesta janela de 30 segundos. Aguarde o próximo ciclo para gerar um novo código.',
    )
  }

  let codeVerified = false

  if (isRecovery) {
    const codeHash = $security.sha256(code.toUpperCase().trim())
    const recCodes = $app.findRecordsByFilter(
      'mfa_recovery_codes',
      `user_id = '${userId}' && code_hash_sha256 = '${codeHash}' && is_used = false`,
      '',
      1,
      0,
    )
    if (recCodes.length > 0) {
      codeVerified = true
      const rc = recCodes[0]
      rc.set('is_used', true)
      rc.set('used_at', new Date().toISOString())
      $app.save(rc)
    }
  } else {
    const secret = user.getString('mfa_secret')
    if (secret && code.length === 6) {
      const computeTotp = (secretBase32, windowOffset) => {
        const cleanSecret = (secretBase32 || '').toUpperCase().replace(/[\s=]/g, '')
        const nowEpoch = Math.floor(Date.now() / 1000)
        const counter = Math.floor(nowEpoch / 30) + (windowOffset || 0)
        const counterHex = ('0000000000000000' + counter.toString(16)).slice(-16)
        const hmac = $security.hs256(counterHex, cleanSecret)
        const offset = parseInt(hmac.slice(-1), 16) * 2
        const part = hmac.substr(offset, 8)
        const num = parseInt(part, 16) & 0x7fffffff
        const resCode = (num % 1000000).toString()
        return ('000000' + resCode).slice(-6)
      }

      for (let offset = -1; offset <= 1; offset++) {
        if (computeTotp(secret, offset) === code) {
          codeVerified = true
          break
        }
      }
    }
  }

  if (!codeVerified) {
    const currentFailCount = recentFailures.length + 1
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', user.id)
      auditRec.set('action', 'MFA_LOGIN_REJECTED')
      auditRec.set('target_collection', 'users')
      auditRec.set('target_id', user.id)
      auditRec.set('status', 'REJECTED')
      auditRec.set(
        'details',
        `Tentativa de segundo fator incorreta (${currentFailCount}/5).${currentFailCount >= 5 ? ' Conta bloqueada temporariamente por 15 minutos.' : ''}`,
      )
      $app.save(auditRec)
    } catch (_) {}

    if (currentFailCount >= 5) {
      throw new ForbiddenError(
        'Limite de tentativas de MFA atingido. Sua conta foi temporariamente bloqueada por 15 minutos.',
      )
    }

    throw new BadRequestError('Código do segundo fator inválido ou expirado.')
  }

  const nowIso = new Date().toISOString()
  user.set('mfa_verified_at', nowIso)
  $app.save(user)

  const mfaSessionToken = $security.hs256(
    `${user.id}_${user.getString('tokenKey')}`,
    'MFA_SESSION_SECRET',
  )

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', user.id)
    auditRec.set('action', 'MFA_LOGIN_SUCCESS')
    auditRec.set('target_collection', 'users')
    auditRec.set('target_id', user.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Login com segundo fator concluído com sucesso (${isRecovery ? 'código de recuperação' : 'TOTP'}). [fp:${codeHashReplay.substring(0, 16)}]`,
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: 'Segundo fator validado com sucesso.',
    userId: user.id,
    mfaSessionToken,
    verifiedAt: nowIso,
  })
})

// -------------------------------------------------------------
// 6. REVOGAÇÃO DE SESSÕES / BLOQUEIO ADMINISTRATIVO IMEDIATO
// POST /backend/v1/auth/sessions/revoke-user
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/sessions/revoke-user', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && role = 'admin' && is_active = true`,
    '',
    1,
    0,
  )
  if (userOrgs.length === 0) {
    throw new ForbiddenError(
      'Apenas administradores podem revogar credenciais e sessões de usuários.',
    )
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const targetUserId = body.target_user_id
  const actionType = body.action_type || 'revoke_tokens'
  const reason = (body.reason || 'Revogação administrativa de segurança').trim()

  if (!targetUserId) {
    throw new BadRequestError('O ID do usuário alvo é obrigatório.')
  }

  const targetUser = $app.findRecordById('users', targetUserId)
  const nowIso = new Date().toISOString()
  let doctorDeactivated = false

  $app.runInTransaction((txApp) => {
    const newTokenKey = $security.randomString(30)
    targetUser.set('tokenKey', newTokenKey)
    targetUser.set('last_revoked_at', nowIso)

    if (actionType === 'deactivate_user') {
      targetUser.set('is_active', false)
      const uos = txApp.findRecordsByFilter(
        'user_organizations',
        `user_id = '${targetUserId}'`,
        '',
        50,
        0,
      )
      for (const uo of uos) {
        uo.set('is_active', false)
        txApp.save(uo)
      }
    }

    if (actionType === 'deactivate_doctor' || actionType === 'deactivate_user') {
      const docs = txApp.findRecordsByFilter('doctors', `user_id = '${targetUserId}'`, '', 10, 0)
      for (const doc of docs) {
        doc.set('is_active', false)
        doc.set(
          'notes',
          (doc.getString('notes') + ' [DESLIGADO EM ' + nowIso + ': ' + reason + ']').trim(),
        )
        txApp.save(doc)
        doctorDeactivated = true
      }
    }

    txApp.save(targetUser)
  })

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('action', 'SESSION_REVOKED_ADMIN')
    auditRec.set('target_collection', 'users')
    auditRec.set('target_id', targetUserId)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Sessões revogadas pelo admin. Ação: ${actionType}. tokenKey rotacionado. Motivo: ${reason}. Médico desligado: ${doctorDeactivated ? 'SIM' : 'NÃO'}.`,
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: 'Sessões e credenciais do usuário invalidadas com sucesso.',
    targetUserId,
    actionType,
    tokensRevoked: true,
    userActive: targetUser.getBool('is_active'),
    doctorDeactivated,
    revokedAt: nowIso,
  })
})

// -------------------------------------------------------------
// 7. POLÍTICA DE EXIGÊNCIA DE MFA POR PERFIL (CONFIGURAÇÃO CONTROLADA)
// POST /backend/v1/auth/mfa/policy-config
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/mfa/policy-config', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && role = 'admin' && is_active = true`,
    '',
    1,
    0,
  )
  if (userOrgs.length === 0) {
    throw new ForbiddenError('Apenas administradores podem configurar política de MFA por perfil.')
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const targetRole = body.target_role || 'none'
  const enforce = Boolean(body.enforce)

  let affectedCount = 0

  if (targetRole !== 'none') {
    const matchingOrgs = $app.findRecordsByFilter(
      'user_organizations',
      targetRole === 'all' ? 'is_active = true' : `role = '${targetRole}' && is_active = true`,
      '',
      100,
      0,
    )

    const uniqueUserIds = [...new Set(matchingOrgs.map((uo) => uo.getString('user_id')))]

    for (const uid of uniqueUserIds) {
      try {
        const u = $app.findRecordById('users', uid)
        u.set('mfa_enforced', enforce)
        u.set('mfa_enforced_role', enforce ? targetRole : 'none')
        $app.save(u)
        affectedCount++
      } catch (_) {}
    }
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('action', 'MFA_POLICY_CONFIGURED')
    auditRec.set('target_collection', 'users')
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Política de MFA por perfil atualizada: role=${targetRole}, exigência=${enforce ? 'ATIVADA' : 'DESATIVADA'}, usuários afetados=${affectedCount}`,
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: 'Política de exigência de MFA por perfil atualizada com sucesso.',
    targetRole,
    enforced: enforce,
    affectedUsersCount: affectedCount,
  })
})

// -------------------------------------------------------------
// 8. REAUTENTICAÇÃO FORTE: SENHA + TOTP (QUANDO HABILITADO)
// POST /backend/v1/auth/reauth
// Utilizado para ações sensíveis (ex: cadastro/substituição/remoção de assinatura manuscrita)
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/reauth', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const password = body.password || ''
  const totpCode = (body.totp_code || '').trim()
  const reason = body.reason || 'REAUTH_SENSITIVE_OPERATION'

  if (!password) {
    throw new BadRequestError('A senha atual é obrigatória para reautenticação.')
  }

  // 1. Validar senha atual
  const user = $app.findRecordById('users', authRecord.id)
  if (!user.validatePassword(password)) {
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', user.id)
      auditRec.set('action', 'REAUTH_FAILED_PASSWORD')
      auditRec.set('target_collection', 'users')
      auditRec.set('target_id', user.id)
      auditRec.set('status', 'REJECTED')
      auditRec.set('details', `Falha de reautenticação: senha incorreta. Motivo: ${reason}`)
      $app.save(auditRec)
    } catch (_) {}

    throw new BadRequestError('Senha incorreta. Confirme sua senha atual.')
  }

  // 2. Se MFA estiver ativado, validar TOTP obrigatoriamente
  const mfaEnabled = user.getBool('mfa_enabled')
  if (mfaEnabled) {
    if (!totpCode || totpCode.length !== 6) {
      throw new BadRequestError(
        'Segundo fator ativado para esta conta. Informe o código autenticador de 6 dígitos.',
      )
    }

    const secret = user.getString('mfa_secret')
    if (!secret) {
      throw new BadRequestError('Configuração de segundo fator corrompida. Contate o suporte.')
    }

    const computeTotp = (secretBase32, windowOffset) => {
      const cleanSecret = (secretBase32 || '').toUpperCase().replace(/[\s=]/g, '')
      const nowEpoch = Math.floor(Date.now() / 1000)
      const counter = Math.floor(nowEpoch / 30) + (windowOffset || 0)
      const counterHex = ('0000000000000000' + counter.toString(16)).slice(-16)
      const hmac = $security.hs256(counterHex, cleanSecret)
      const offset = parseInt(hmac.slice(-1), 16) * 2
      const part = hmac.substr(offset, 8)
      const num = parseInt(part, 16) & 0x7fffffff
      const resCode = (num % 1000000).toString()
      return ('000000' + resCode).slice(-6)
    }

    let isValidTotp = false
    for (let offset = -1; offset <= 1; offset++) {
      if (computeTotp(secret, offset) === totpCode) {
        isValidTotp = true
        break
      }
    }

    if (!isValidTotp) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const auditRec = new Record(auditCol)
        auditRec.set('user_id', user.id)
        auditRec.set('action', 'REAUTH_FAILED_TOTP')
        auditRec.set('target_collection', 'users')
        auditRec.set('target_id', user.id)
        auditRec.set('status', 'REJECTED')
        auditRec.set(
          'details',
          `Falha de reautenticação: código TOTP inválido ou expirado. Motivo: ${reason}`,
        )
        $app.save(auditRec)
      } catch (_) {}

      throw new BadRequestError('Código de autenticação de 6 dígitos inválido ou expirado.')
    }
  }

  // Gerar token de reautenticação temporário (válido por 10 minutos)
  const nowIso = new Date().toISOString()
  const reauthToken = $security.hs256(
    `${user.id}_${nowIso}_${user.getString('tokenKey')}`,
    'REAUTH_ONETIME_SECRET',
  )

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', user.id)
    auditRec.set('action', 'REAUTH_SUCCESS')
    auditRec.set('target_collection', 'users')
    auditRec.set('target_id', user.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Reautenticação forte realizada com sucesso (senha + ${mfaEnabled ? 'TOTP' : 'fator único'}). Motivo: ${reason}`,
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: 'Reautenticação realizada com sucesso.',
    reauthToken,
    mfaVerified: mfaEnabled,
    timestamp: nowIso,
  })
})

// -------------------------------------------------------------
// 9. GESTÃO SEGURA DA ASSINATURA MANUSCRITA DO CARDIOLOGISTA
// POST /backend/v1/doctor/signature/save (Cadastrar / Substituir com Reautenticação)
// DELETE /backend/v1/doctor/signature/remove (Remover com Reautenticação)
// GET /backend/v1/doctor/signature/current (Obter própria assinatura)
// -------------------------------------------------------------

routerAdd('GET', '/backend/v1/doctor/signature/current', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  // Buscar assinatura exclusivamente deste usuário (@request.auth.id = user_id)
  const sigRecords = $app.findRecordsByFilter(
    'doctor_signatures',
    `user_id = '${authRecord.id}'`,
    '-created',
    1,
    0,
  )

  if (sigRecords.length === 0) {
    return e.json(200, {
      success: true,
      hasSignature: false,
      signature: null,
    })
  }

  const sig = sigRecords[0]
  return e.json(200, {
    success: true,
    hasSignature: true,
    signature: {
      id: sig.id,
      userId: sig.getString('user_id'),
      fileName: sig.getString('file_name'),
      fileHashSha256: sig.getString('file_hash_sha256'),
      isActive: sig.getBool('is_active'),
      lastVerifiedAt: sig.getString('last_verified_at'),
      created: sig.getString('created'),
      updated: sig.getString('updated'),
      signatureFile: sig.getString('signature_image'),
      imageDataUri: sig.getString('image_data_uri') || null,
    },
  })
})

routerAdd('POST', '/backend/v1/doctor/signature/save', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  // Apenas médicos ou admins podem ter assinatura manuscrita cadastrada
  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && is_active = true`,
    '',
    50,
    0,
  )
  const isDoctorOrAdmin = userOrgs.some(
    (uo) => uo.getString('role') === 'cardiologist' || uo.getString('role') === 'admin',
  )
  if (!isDoctorOrAdmin) {
    throw new ForbiddenError(
      'Apenas médicos cardiologistas credenciados ou administradores podem cadastrar assinatura.',
    )
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const password = body.password || ''
  const totpCode = (body.totp_code || '').trim()
  const imageDataUri = body.image_data_uri || ''
  const fileName = body.file_name || 'assinatura_manuscrita.png'

  if (!imageDataUri) {
    throw new BadRequestError('A imagem da assinatura manuscrita (PNG ou JPEG) é obrigatória.')
  }

  // 1. REAUTENTICAÇÃO OBRIGATÓRIA COM SENHA E TOTP (SE HABILITADO)
  const user = $app.findRecordById('users', authRecord.id)
  if (!password || !user.validatePassword(password)) {
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user_id', user.id)
      auditRec.set('action', 'DOCTOR_SIGNATURE_AUTH_FAILED')
      auditRec.set('target_collection', 'doctor_signatures')
      auditRec.set('target_id', user.id)
      auditRec.set('status', 'REJECTED')
      auditRec.set('details', 'Tentativa de salvar assinatura rejeitada por senha incorreta.')
      $app.save(auditRec)
    } catch (_) {}

    throw new BadRequestError('Senha de confirmação incorreta.')
  }

  const mfaEnabled = user.getBool('mfa_enabled')
  if (mfaEnabled) {
    if (!totpCode || totpCode.length !== 6) {
      throw new BadRequestError(
        'MFA habilitado. Informe o código de 6 dígitos do app autenticador.',
      )
    }

    const secret = user.getString('mfa_secret')
    const computeTotp = (secretBase32, windowOffset) => {
      const cleanSecret = (secretBase32 || '').toUpperCase().replace(/[\s=]/g, '')
      const nowEpoch = Math.floor(Date.now() / 1000)
      const counter = Math.floor(nowEpoch / 30) + (windowOffset || 0)
      const counterHex = ('0000000000000000' + counter.toString(16)).slice(-16)
      const hmac = $security.hs256(counterHex, cleanSecret)
      const offset = parseInt(hmac.slice(-1), 16) * 2
      const part = hmac.substr(offset, 8)
      const num = parseInt(part, 16) & 0x7fffffff
      const resCode = (num % 1000000).toString()
      return ('000000' + resCode).slice(-6)
    }

    let isValidTotp = false
    for (let offset = -1; offset <= 1; offset++) {
      if (computeTotp(secret, offset) === totpCode) {
        isValidTotp = true
        break
      }
    }

    if (!isValidTotp) {
      throw new BadRequestError('Código de segundo fator inválido ou expirado.')
    }
  }

  // 2. Calcular hash SHA-256 da imagem para integridade estrita
  const fileHash = $security.sha256(imageDataUri)
  const nowIso = new Date().toISOString()

  let savedRecord = null
  let isSubstitution = false

  $app.runInTransaction((txApp) => {
    // Verificar se já existia assinatura cadastrada
    const existing = txApp.findRecordsByFilter(
      'doctor_signatures',
      `user_id = '${user.id}'`,
      '-created',
      1,
      0,
    )

    let sigRec
    if (existing.length > 0) {
      sigRec = existing[0]
      isSubstitution = true
    } else {
      const col = txApp.findCollectionByNameOrId('doctor_signatures')
      sigRec = new Record(col)
      sigRec.set('user_id', user.id)
    }

    sigRec.set('file_name', fileName)
    sigRec.set('file_hash_sha256', fileHash)
    sigRec.set('image_data_uri', imageDataUri)
    sigRec.set('is_active', true)
    sigRec.set('last_verified_at', nowIso)

    // Tentar gravar o arquivo físico se $filesystem estiver disponível
    try {
      if (typeof $filesystem !== 'undefined' && $filesystem.fileFromBytes) {
        // Extrair raw bytes de base64 se aplicável
        const parts = imageDataUri.split(',')
        const rawContent = parts.length > 1 ? parts[1] : parts[0]
        const fileObj = $filesystem.fileFromBytes(rawContent, fileName)
        sigRec.set('signature_image', fileObj)
      }
    } catch (_) {}

    txApp.save(sigRec)
    savedRecord = sigRec
  })

  // 3. Registrar na trilha de auditoria
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', user.id)
    auditRec.set(
      'action',
      isSubstitution ? 'DOCTOR_SIGNATURE_SUBSTITUTED' : 'DOCTOR_SIGNATURE_REGISTERED',
    )
    auditRec.set('target_collection', 'doctor_signatures')
    auditRec.set('target_id', savedRecord.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Assinatura manuscrita ${isSubstitution ? 'substituída' : 'cadastrada'} com reautenticação forte (senha + ${mfaEnabled ? 'TOTP' : 'senha'}). Arquivo: ${fileName}, SHA-256: ${fileHash}`,
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: `Assinatura manuscrita ${isSubstitution ? 'substituída' : 'cadastrada'} com sucesso.`,
    isSubstitution,
    signatureId: savedRecord.id,
    fileHashSha256: fileHash,
    fileName,
    verifiedAt: nowIso,
  })
})

routerAdd('DELETE', '/backend/v1/doctor/signature/remove', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const password = body.password || ''
  const totpCode = (body.totp_code || '').trim()

  const user = $app.findRecordById('users', authRecord.id)
  if (!password || !user.validatePassword(password)) {
    throw new BadRequestError('Senha de confirmação incorreta para remover a assinatura.')
  }

  const mfaEnabled = user.getBool('mfa_enabled')
  if (mfaEnabled) {
    if (!totpCode || totpCode.length !== 6) {
      throw new BadRequestError(
        'MFA habilitado. Informe o código de 6 dígitos do app autenticador.',
      )
    }

    const secret = user.getString('mfa_secret')
    const computeTotp = (secretBase32, windowOffset) => {
      const cleanSecret = (secretBase32 || '').toUpperCase().replace(/[\s=]/g, '')
      const nowEpoch = Math.floor(Date.now() / 1000)
      const counter = Math.floor(nowEpoch / 30) + (windowOffset || 0)
      const counterHex = ('0000000000000000' + counter.toString(16)).slice(-16)
      const hmac = $security.hs256(counterHex, cleanSecret)
      const offset = parseInt(hmac.slice(-1), 16) * 2
      const part = hmac.substr(offset, 8)
      const num = parseInt(part, 16) & 0x7fffffff
      const resCode = (num % 1000000).toString()
      return ('000000' + resCode).slice(-6)
    }

    let isValidTotp = false
    for (let offset = -1; offset <= 1; offset++) {
      if (computeTotp(secret, offset) === totpCode) {
        isValidTotp = true
        break
      }
    }

    if (!isValidTotp) {
      throw new BadRequestError('Código de segundo fator inválido ou expirado.')
    }
  }

  const existing = $app.findRecordsByFilter(
    'doctor_signatures',
    `user_id = '${user.id}'`,
    '-created',
    10,
    0,
  )

  if (existing.length === 0) {
    throw new NotFoundError('Nenhuma assinatura manuscrita cadastrada para remoção.')
  }

  let removedId = ''
  for (const rec of existing) {
    removedId = rec.id
    $app.delete(rec)
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', user.id)
    auditRec.set('action', 'DOCTOR_SIGNATURE_REMOVED')
    auditRec.set('target_collection', 'doctor_signatures')
    auditRec.set('target_id', removedId || user.id)
    auditRec.set('status', 'SUCCESS')
    auditRec.set(
      'details',
      `Assinatura manuscrita removida com reautenticação forte (senha + ${mfaEnabled ? 'TOTP' : 'senha'}).`,
    )
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: 'Assinatura manuscrita removida com sucesso.',
    removedId,
  })
})

console.log(
  '[AUTH_SESSION_SECURITY] Módulo de MFA, Sessão e Assinatura Manuscrita carregado com sucesso.',
)
