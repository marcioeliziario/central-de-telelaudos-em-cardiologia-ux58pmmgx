migrate(
  (app) => {
    // Criar coleção: sla_job_executions
    // Registra cada ciclo de execução periódica do SLA para observabilidade do administrador
    const slaExecutionsCollection = new Collection({
      name: 'sla_job_executions',
      type: 'base',
      // list e view: apenas administradores credenciados podem ler o histórico
      listRule:
        "@request.auth.id != '' && @collection.user_organizations.user_id ?= @request.auth.id && @collection.user_organizations.role ?= 'admin' && @collection.user_organizations.is_active ?= true",
      viewRule:
        "@request.auth.id != '' && @collection.user_organizations.user_id ?= @request.auth.id && @collection.user_organizations.role ?= 'admin' && @collection.user_organizations.is_active ?= true",
      // create/update/delete: null (apenas o sistema / admin-side escreve, sem exposição a chamadas de usuário)
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'job_id', type: 'text', required: true }, // ex: "sla_monitor_5m"
        { name: 'started_at', type: 'date', required: true },
        { name: 'completed_at', type: 'date', required: true },
        { name: 'duration_ms', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['SUCCESS', 'ERROR', 'PARTIAL_WARNING'],
          maxSelect: 1,
        },
        { name: 'exams_evaluated', type: 'number', required: true },
        { name: 'exams_updated', type: 'number', required: true },
        { name: 'near_deadline_count', type: 'number', required: true },
        { name: 'overdue_count', type: 'number', required: true },
        { name: 'paused_count', type: 'number', required: true },
        { name: 'notifications_created', type: 'number', required: true },
        { name: 'error_message', type: 'text' },
        { name: 'execution_summary', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sla_exec_job ON sla_job_executions (job_id)',
        'CREATE INDEX idx_sla_exec_status ON sla_job_executions (status)',
        'CREATE INDEX idx_sla_exec_started ON sla_job_executions (started_at DESC)',
      ],
    })
    app.save(slaExecutionsCollection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('sla_job_executions')
      app.delete(col)
    } catch (_) {}
  },
)
