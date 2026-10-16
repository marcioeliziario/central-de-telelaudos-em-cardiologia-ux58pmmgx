/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('doctor_signatures')
    const field = col.fields.getByName('image_data_uri')
    if (field) {
      field.max = 2097152 // 2MB em caracteres para suportar Base64 data URIs
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('doctor_signatures')
    const field = col.fields.getByName('image_data_uri')
    if (field) {
      field.max = 5000
      app.save(col)
    }
  },
)
