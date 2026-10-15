migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // Reduzir para 12 horas (12 * 3600 = 43200 segundos) a validade do authToken
    if (usersCol.authToken) {
      usersCol.authToken.duration = 43200
    }

    app.save(usersCol)
  },
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (usersCol.authToken) {
      usersCol.authToken.duration = 604800 // Reverter para 7 dias
    }
    app.save(usersCol)
  },
)
