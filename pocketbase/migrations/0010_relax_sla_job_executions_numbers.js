migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('sla_job_executions')

    // Atualizar campos numéricos para não exigirem obrigatoriedade estrita de non-zero
    const fields = col.fields
    for (let f of fields) {
      if (
        f.name === 'near_deadline_count' ||
        f.name === 'overdue_count' ||
        f.name === 'paused_count' ||
        f.name === 'notifications_created' ||
        f.name === 'exams_updated' ||
        f.name === 'exams_evaluated' ||
        f.name === 'duration_ms'
      ) {
        f.required = false
      }
    }
    app.save(col)
  },
  (app) => {},
)
