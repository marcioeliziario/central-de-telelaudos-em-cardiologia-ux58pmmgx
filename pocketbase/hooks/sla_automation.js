// pocketbase/hooks/sla_automation.js
// Automação nativa de monitoramento de SLA e Gestão de Prazos
// Executada a cada 5 minutos via cronAdd nativo do PocketBase e exposta para inspeção admin

// -------------------------------------------------------------
// AGENDAMENTO NATIVO VIA cronAdd (PocketBase pb_hooks)
// Frequência: a cada 5 minutos ("*/5 * * * *")
// -------------------------------------------------------------
cronAdd('sla_monitor_5m', '*/5 * * * *', () => {
  const startedAt = new Date()
  const jobId = 'sla_monitor_5m'
  const warningThresholdMin = 30 // Alerta a 30 minutos do vencimento

  let examsEvaluated = 0
  let examsUpdated = 0
  let nearDeadlineCount = 0
  let overdueCount = 0
  let pausedCount = 0
  let notificationsCreated = 0
  let errorMessage = ''
  let status = 'SUCCESS'

  try {
    const activeExams = $app.findRecordsByFilter(
      'exam_requests',
      "status = 'pending' || status = 'in_analysis' || status = 'waiting_signature' || status = 'rejected'",
      '-created',
      500,
      0,
    )

    examsEvaluated = activeExams.length
    const slaConfigCache = {}

    for (const ex of activeExams) {
      const orgId = ex.getString('organization_id')
      const examStatus = ex.getString('status')
      const urgency = ex.getString('urgency') || 'routine'
      const isUrgent = urgency === 'urgent'

      // Se exame foi devolvido por qualidade insuficiente (rejected), SLA fica pausado
      if (examStatus === 'rejected') {
        pausedCount++
        if (ex.getString('sla_status') !== 'pausado') {
          ex.set('sla_status', 'pausado')
          $app.save(ex)
          examsUpdated++
        }
        continue
      }

      if (!slaConfigCache[orgId]) {
        try {
          const slas = $app.findRecordsByFilter(
            'contract_slas',
            `organization_id = '${orgId}' && is_active = true`,
            '',
            1,
            0,
          )
          if (slas.length > 0) {
            const sc = slas[0]
            slaConfigCache[orgId] = {
              routine_sla_hours: sc.getInt('routine_sla_hours') || 24,
              urgent_sla_hours: sc.getInt('urgent_sla_hours') || 2,
              business_hours_only: sc.getBool('business_hours_only'),
              business_start_hour: sc.getInt('business_start_hour') || 8,
              business_end_hour: sc.getInt('business_end_hour') || 18,
            }
          } else {
            slaConfigCache[orgId] = {
              routine_sla_hours: 24,
              urgent_sla_hours: 2,
              business_hours_only: false,
              business_start_hour: 8,
              business_end_hour: 18,
            }
          }
        } catch (_) {
          slaConfigCache[orgId] = {
            routine_sla_hours: 24,
            urgent_sla_hours: 2,
            business_hours_only: false,
          }
        }
      }

      const slaCfg = slaConfigCache[orgId]
      const targetHours = isUrgent ? slaCfg.urgent_sla_hours : slaCfg.routine_sla_hours

      // Calcular prazo determinístico se não preenchido
      let deadlineStr = ex.getString('deadline_at')
      if (!deadlineStr) {
        const createdDate = new Date(ex.getString('created'))
        if (!slaCfg.business_hours_only) {
          const dl = new Date(createdDate.getTime() + targetHours * 3600 * 1000)
          deadlineStr = dl.toISOString()
        } else {
          // Horário comercial
          let cur = new Date(createdDate.getTime())
          let remHours = targetHours
          const sH = slaCfg.business_start_hour !== undefined ? slaCfg.business_start_hour : 8
          const eH = slaCfg.business_end_hour !== undefined ? slaCfg.business_end_hour : 18

          const isWknd = (d) => d.getDay() === 0 || d.getDay() === 6
          const advMorning = (d) => {
            d.setDate(d.getDate() + 1)
            d.setHours(sH, 0, 0, 0)
            while (isWknd(d)) {
              d.setDate(d.getDate() + 1)
              d.setHours(sH, 0, 0, 0)
            }
          }

          if (isWknd(cur)) {
            advMorning(cur)
          } else {
            const h = cur.getHours() + cur.getMinutes() / 60
            if (h < sH) {
              cur.setHours(sH, 0, 0, 0)
            } else if (h >= eH) {
              advMorning(cur)
            }
          }

          while (remHours > 0) {
            if (isWknd(cur)) {
              advMorning(cur)
              continue
            }
            const curH = cur.getHours() + cur.getMinutes() / 60
            const leftToday = eH - curH
            if (remHours <= leftToday) {
              cur = new Date(cur.getTime() + remHours * 3600 * 1000)
              break
            } else {
              remHours -= leftToday
              advMorning(cur)
            }
          }
          deadlineStr = cur.toISOString()
        }
        ex.set('deadline_at', deadlineStr)
      }

      const deadlineDate = new Date(deadlineStr)
      const diffMs = deadlineDate.getTime() - startedAt.getTime()
      const diffMin = Math.round(diffMs / (60 * 1000))

      let newSlaStatus = 'no_prazo'
      if (diffMs <= 0) {
        newSlaStatus = 'atrasado'
        overdueCount++
      } else if (diffMin <= warningThresholdMin) {
        newSlaStatus = 'proximo_do_vencimento'
        nearDeadlineCount++
      }

      const currentSlaStatus = ex.getString('sla_status')
      let needSave = false

      if (currentSlaStatus !== newSlaStatus) {
        ex.set('sla_status', newSlaStatus)
        needSave = true
      }

      if (needSave) {
        $app.save(ex)
        examsUpdated++

        // Emissão de notificações sem duplicidade
        try {
          const notifCol = $app.findCollectionByNameOrId('internal_notifications')

          if (newSlaStatus === 'atrasado') {
            const existing = $app.findRecordsByFilter(
              'internal_notifications',
              `exam_request_id = '${ex.id}' && notification_type = 'EXAME_ATRASADO'`,
              '',
              1,
              0,
            )
            if (existing.length === 0) {
              const notif = new Record(notifCol)
              notif.set('organization_id', orgId)
              notif.set('exam_request_id', ex.id)
              notif.set('notification_type', 'EXAME_ATRASADO')
              notif.set('title', 'Alerta: Exame com prazo de SLA extrapolado')
              notif.set(
                'message',
                `O ECG protocolo ${ex.id.slice(-6).toUpperCase()} ultrapassou o tempo contratual estabelecido.`,
              )
              notif.set('target_role', 'all')
              notif.set('is_read', false)
              $app.save(notif)
              notificationsCreated++
            }
          } else if (newSlaStatus === 'proximo_do_vencimento') {
            const existing = $app.findRecordsByFilter(
              'internal_notifications',
              `exam_request_id = '${ex.id}' && notification_type = 'EXAME_PROXIMO_DO_PRAZO'`,
              '',
              1,
              0,
            )
            if (existing.length === 0) {
              const notif = new Record(notifCol)
              notif.set('organization_id', orgId)
              notif.set('exam_request_id', ex.id)
              notif.set('notification_type', 'EXAME_PROXIMO_DO_PRAZO')
              notif.set('title', 'Aviso: Exame próximo do vencimento de SLA')
              notif.set(
                'message',
                `O ECG protocolo ${ex.id.slice(-6).toUpperCase()} possui menos de ${warningThresholdMin} min para encerramento do prazo contratual.`,
              )
              notif.set('target_role', 'cardiologist')
              notif.set('is_read', false)
              $app.save(notif)
              notificationsCreated++
            }
          }
        } catch (notifErr) {
          console.log('[SLA_CRON] Erro ao emitir notificação:', notifErr)
        }
      }
    }
  } catch (err) {
    status = 'ERROR'
    errorMessage = String(err && err.message ? err.message : err)
    console.log('[SLA_CRON] Falha no processamento:', errorMessage)
  }

  const completedAt = new Date()
  const durationMs = completedAt.getTime() - startedAt.getTime()

  // Registrar histórico em sla_job_executions
  try {
    const execCol = $app.findCollectionByNameOrId('sla_job_executions')
    const execRec = new Record(execCol)
    execRec.set('job_id', jobId)
    execRec.set('started_at', startedAt.toISOString())
    execRec.set('completed_at', completedAt.toISOString())
    execRec.set('duration_ms', durationMs)
    execRec.set('status', status)
    execRec.set('exams_evaluated', examsEvaluated)
    execRec.set('exams_updated', examsUpdated)
    execRec.set('near_deadline_count', nearDeadlineCount)
    execRec.set('overdue_count', overdueCount)
    execRec.set('paused_count', pausedCount)
    execRec.set('notifications_created', notificationsCreated)
    execRec.set('error_message', errorMessage || '')
    execRec.set(
      'execution_summary',
      `Trigger: CRON_PERIODIC_5M. Avaliados: ${examsEvaluated}, Atualizados: ${examsUpdated}, Próximos: ${nearDeadlineCount}, Atrasados: ${overdueCount}, Pausados: ${pausedCount}, Notificações: ${notificationsCreated}. Duração: ${durationMs}ms.`,
    )
    $app.save(execRec)
  } catch (saveErr) {
    console.log('[SLA_CRON] Erro ao gravar sla_job_executions:', saveErr)
  }
})

// -------------------------------------------------------------
// ROTAS HTTP ADMIN PARA MONITORAMENTO E HISTÓRICO DO CRON DE SLA
// -------------------------------------------------------------

// Obter a última execução e resumo de integridade operacional
routerAdd('GET', '/backend/v1/sla/job-status', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    throw new ForbiddenError('Acesso restrito a usuários autenticados.')
  }

  // Verificar se o usuário autenticado é admin
  const userOrgs = $app.findRecordsByFilter(
    'user_organizations',
    `user_id = '${authRecord.id}' && role = 'admin' && is_active = true`,
    '',
    1,
    0,
  )

  if (userOrgs.length === 0) {
    throw new ForbiddenError(
      'Apenas administradores podem consultar a telemetria do agendador de SLA.',
    )
  }

  let latestExecution = null
  let totalExecutions = 0
  let recentExecutions = []

  try {
    const list = $app.findRecordsByFilter('sla_job_executions', '', '-started_at', 10, 0)
    totalExecutions = list.length
    if (list.length > 0) {
      latestExecution = {
        id: list[0].id,
        jobId: list[0].getString('job_id'),
        startedAt: list[0].getString('started_at'),
        completedAt: list[0].getString('completed_at'),
        durationMs: list[0].getInt('duration_ms'),
        status: list[0].getString('status'),
        examsEvaluated: list[0].getInt('exams_evaluated'),
        examsUpdated: list[0].getInt('exams_updated'),
        nearDeadlineCount: list[0].getInt('near_deadline_count'),
        overdueCount: list[0].getInt('overdue_count'),
        pausedCount: list[0].getInt('paused_count'),
        notificationsCreated: list[0].getInt('notifications_created'),
        errorMessage: list[0].getString('error_message'),
        executionSummary: list[0].getString('execution_summary'),
      }

      recentExecutions = list.map((item) => ({
        id: item.id,
        startedAt: item.getString('started_at'),
        status: item.getString('status'),
        durationMs: item.getInt('duration_ms'),
        examsEvaluated: item.getInt('exams_evaluated'),
        notificationsCreated: item.getInt('notifications_created'),
      }))
    }
  } catch (err) {
    console.log('[SLA_JOB_STATUS] Erro ao buscar execuções:', err)
  }

  return e.json(200, {
    success: true,
    cronJob: {
      id: 'sla_monitor_5m',
      schedule: '*/5 * * * *',
      frequency: 'A cada 5 minutos',
      description:
        'Recálculo periódico determinístico de deadline_at, sla_status e emissão de alertas internos sem duplicidade',
    },
    latestExecution,
    totalHistoryCount: totalExecutions,
    recentExecutions,
  })
})

// Trigger sob demanda administrativo (reavalia imediatamente e registra em sla_job_executions)
routerAdd('POST', '/backend/v1/sla/run-now', (e) => {
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
      'Apenas administradores podem acionar manualmente o ciclo de monitoramento de SLA.',
    )
  }

  const startedAt = new Date()
  const jobId = 'sla_monitor_5m'
  const warningThresholdMin = 30

  let examsEvaluated = 0
  let examsUpdated = 0
  let nearDeadlineCount = 0
  let overdueCount = 0
  let pausedCount = 0
  let notificationsCreated = 0
  let errorMessage = ''
  let status = 'SUCCESS'

  try {
    const activeExams = $app.findRecordsByFilter(
      'exam_requests',
      "status = 'pending' || status = 'in_analysis' || status = 'waiting_signature' || status = 'rejected'",
      '-created',
      500,
      0,
    )

    examsEvaluated = activeExams.length
    const slaConfigCache = {}

    for (const ex of activeExams) {
      const orgId = ex.getString('organization_id')
      const examStatus = ex.getString('status')
      const urgency = ex.getString('urgency') || 'routine'
      const isUrgent = urgency === 'urgent'

      if (examStatus === 'rejected') {
        pausedCount++
        if (ex.getString('sla_status') !== 'pausado') {
          ex.set('sla_status', 'pausado')
          $app.save(ex)
          examsUpdated++
        }
        continue
      }

      if (!slaConfigCache[orgId]) {
        try {
          const slas = $app.findRecordsByFilter(
            'contract_slas',
            `organization_id = '${orgId}' && is_active = true`,
            '',
            1,
            0,
          )
          if (slas.length > 0) {
            const sc = slas[0]
            slaConfigCache[orgId] = {
              routine_sla_hours: sc.getInt('routine_sla_hours') || 24,
              urgent_sla_hours: sc.getInt('urgent_sla_hours') || 2,
              business_hours_only: sc.getBool('business_hours_only'),
              business_start_hour: sc.getInt('business_start_hour') || 8,
              business_end_hour: sc.getInt('business_end_hour') || 18,
            }
          } else {
            slaConfigCache[orgId] = {
              routine_sla_hours: 24,
              urgent_sla_hours: 2,
              business_hours_only: false,
              business_start_hour: 8,
              business_end_hour: 18,
            }
          }
        } catch (_) {
          slaConfigCache[orgId] = {
            routine_sla_hours: 24,
            urgent_sla_hours: 2,
            business_hours_only: false,
          }
        }
      }

      const slaCfg = slaConfigCache[orgId]
      const targetHours = isUrgent ? slaCfg.urgent_sla_hours : slaCfg.routine_sla_hours

      let deadlineStr = ex.getString('deadline_at')
      if (!deadlineStr) {
        const createdDate = new Date(ex.getString('created'))
        if (!slaCfg.business_hours_only) {
          const dl = new Date(createdDate.getTime() + targetHours * 3600 * 1000)
          deadlineStr = dl.toISOString()
        } else {
          let cur = new Date(createdDate.getTime())
          let remHours = targetHours
          const sH = slaCfg.business_start_hour !== undefined ? slaCfg.business_start_hour : 8
          const eH = slaCfg.business_end_hour !== undefined ? slaCfg.business_end_hour : 18

          const isWknd = (d) => d.getDay() === 0 || d.getDay() === 6
          const advMorning = (d) => {
            d.setDate(d.getDate() + 1)
            d.setHours(sH, 0, 0, 0)
            while (isWknd(d)) {
              d.setDate(d.getDate() + 1)
              d.setHours(sH, 0, 0, 0)
            }
          }

          if (isWknd(cur)) {
            advMorning(cur)
          } else {
            const h = cur.getHours() + cur.getMinutes() / 60
            if (h < sH) {
              cur.setHours(sH, 0, 0, 0)
            } else if (h >= eH) {
              advMorning(cur)
            }
          }

          while (remHours > 0) {
            if (isWknd(cur)) {
              advMorning(cur)
              continue
            }
            const curH = cur.getHours() + cur.getMinutes() / 60
            const leftToday = eH - curH
            if (remHours <= leftToday) {
              cur = new Date(cur.getTime() + remHours * 3600 * 1000)
              break
            } else {
              remHours -= leftToday
              advMorning(cur)
            }
          }
          deadlineStr = cur.toISOString()
        }
        ex.set('deadline_at', deadlineStr)
      }

      const deadlineDate = new Date(deadlineStr)
      const diffMs = deadlineDate.getTime() - startedAt.getTime()
      const diffMin = Math.round(diffMs / (60 * 1000))

      let newSlaStatus = 'no_prazo'
      if (diffMs <= 0) {
        newSlaStatus = 'atrasado'
        overdueCount++
      } else if (diffMin <= warningThresholdMin) {
        newSlaStatus = 'proximo_do_vencimento'
        nearDeadlineCount++
      }

      const currentSlaStatus = ex.getString('sla_status')
      let needSave = false

      if (currentSlaStatus !== newSlaStatus) {
        ex.set('sla_status', newSlaStatus)
        needSave = true
      }

      if (needSave) {
        $app.save(ex)
        examsUpdated++

        try {
          const notifCol = $app.findCollectionByNameOrId('internal_notifications')

          if (newSlaStatus === 'atrasado') {
            const existing = $app.findRecordsByFilter(
              'internal_notifications',
              `exam_request_id = '${ex.id}' && notification_type = 'EXAME_ATRASADO'`,
              '',
              1,
              0,
            )
            if (existing.length === 0) {
              const notif = new Record(notifCol)
              notif.set('organization_id', orgId)
              notif.set('exam_request_id', ex.id)
              notif.set('notification_type', 'EXAME_ATRASADO')
              notif.set('title', 'Alerta: Exame com prazo de SLA extrapolado')
              notif.set(
                'message',
                `O ECG protocolo ${ex.id.slice(-6).toUpperCase()} ultrapassou o tempo contratual estabelecido.`,
              )
              notif.set('target_role', 'all')
              notif.set('is_read', false)
              $app.save(notif)
              notificationsCreated++
            }
          } else if (newSlaStatus === 'proximo_do_vencimento') {
            const existing = $app.findRecordsByFilter(
              'internal_notifications',
              `exam_request_id = '${ex.id}' && notification_type = 'EXAME_PROXIMO_DO_PRAZO'`,
              '',
              1,
              0,
            )
            if (existing.length === 0) {
              const notif = new Record(notifCol)
              notif.set('organization_id', orgId)
              notif.set('exam_request_id', ex.id)
              notif.set('notification_type', 'EXAME_PROXIMO_DO_PRAZO')
              notif.set('title', 'Aviso: Exame próximo do vencimento de SLA')
              notif.set(
                'message',
                `O ECG protocolo ${ex.id.slice(-6).toUpperCase()} possui menos de ${warningThresholdMin} min para encerramento do prazo contratual.`,
              )
              notif.set('target_role', 'cardiologist')
              notif.set('is_read', false)
              $app.save(notif)
              notificationsCreated++
            }
          }
        } catch (notifErr) {
          console.log('[SLA_RUN_NOW] Erro ao emitir notificação:', notifErr)
        }
      }
    }
  } catch (err) {
    status = 'ERROR'
    errorMessage = String(err && err.message ? err.message : err)
    console.log('[SLA_RUN_NOW] Falha no processamento:', errorMessage)
  }

  const completedAt = new Date()
  const durationMs = completedAt.getTime() - startedAt.getTime()

  try {
    const execCol = $app.findCollectionByNameOrId('sla_job_executions')
    const execRec = new Record(execCol)
    execRec.set('job_id', jobId)
    execRec.set('started_at', startedAt.toISOString())
    execRec.set('completed_at', completedAt.toISOString())
    execRec.set('duration_ms', durationMs)
    execRec.set('status', status)
    execRec.set('exams_evaluated', examsEvaluated)
    execRec.set('exams_updated', examsUpdated)
    execRec.set('near_deadline_count', nearDeadlineCount)
    execRec.set('overdue_count', overdueCount)
    execRec.set('paused_count', pausedCount)
    execRec.set('notifications_created', notificationsCreated)
    execRec.set('error_message', errorMessage || '')
    execRec.set(
      'execution_summary',
      `Trigger: MANUAL_ADMIN_${authRecord.id}. Avaliados: ${examsEvaluated}, Atualizados: ${examsUpdated}, Próximos: ${nearDeadlineCount}, Atrasados: ${overdueCount}, Pausados: ${pausedCount}, Notificações: ${notificationsCreated}. Duração: ${durationMs}ms.`,
    )
    $app.save(execRec)
  } catch (saveErr) {
    console.log('[SLA_RUN_NOW] Erro ao gravar histórico:', saveErr)
  }

  return e.json(200, {
    success: true,
    result: {
      jobId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      status,
      examsEvaluated,
      examsUpdated,
      nearDeadlineCount,
      overdueCount,
      pausedCount,
      notificationsCreated,
      errorMessage,
    },
  })
})

// Rota para cálculo e validação determinística de regras de SLA (usada em testes internos e produção)
routerAdd('POST', '/backend/v1/sla/calculate-deadline', (e) => {
  const body = e.requestInfo().body || {}
  const receivedAtStr = body.received_at || new Date().toISOString()
  const slaHours = typeof body.sla_hours === 'number' ? body.sla_hours : 24
  const businessHoursOnly = !!body.business_hours_only
  const businessStartHour =
    typeof body.business_start_hour === 'number' ? body.business_start_hour : 8
  const businessEndHour = typeof body.business_end_hour === 'number' ? body.business_end_hour : 18
  const examStatus = body.status || 'pending'

  // Regra de Pausa de SLA:
  // Se exame devolvido por qualidade insuficiente (rejected), SLA permanece pausado/congelado.
  if (examStatus === 'rejected') {
    return e.json(200, {
      success: true,
      isPaused: true,
      slaStatus: 'pausado',
      message: 'SLA pausado/congelado: exame devolvido por qualidade técnica inadequada.',
      deadlineAt: null,
    })
  }

  const baseDate = new Date(receivedAtStr)
  let calculatedDeadline = null

  if (!businessHoursOnly) {
    calculatedDeadline = new Date(baseDate.getTime() + slaHours * 3600 * 1000)
  } else {
    let cur = new Date(baseDate.getTime())
    let remHours = slaHours
    const sH = businessStartHour
    const eH = businessEndHour

    const isWknd = (d) => d.getDay() === 0 || d.getDay() === 6
    const advMorning = (d) => {
      d.setDate(d.getDate() + 1)
      d.setHours(sH, 0, 0, 0)
      while (isWknd(d)) {
        d.setDate(d.getDate() + 1)
        d.setHours(sH, 0, 0, 0)
      }
    }

    if (isWknd(cur)) {
      advMorning(cur)
    } else {
      const h = cur.getHours() + cur.getMinutes() / 60
      if (h < sH) {
        cur.setHours(sH, 0, 0, 0)
      } else if (h >= eH) {
        advMorning(cur)
      }
    }

    while (remHours > 0) {
      if (isWknd(cur)) {
        advMorning(cur)
        continue
      }
      const curH = cur.getHours() + cur.getMinutes() / 60
      const leftToday = eH - curH
      if (remHours <= leftToday) {
        cur = new Date(cur.getTime() + remHours * 3600 * 1000)
        break
      } else {
        remHours -= leftToday
        advMorning(cur)
      }
    }
    calculatedDeadline = cur
  }

  return e.json(200, {
    success: true,
    isPaused: false,
    slaStatus: 'no_prazo',
    receivedAt: baseDate.toISOString(),
    slaHours,
    businessHoursOnly,
    businessStartHour,
    businessEndHour,
    deadlineAt: calculatedDeadline.toISOString(),
  })
})
