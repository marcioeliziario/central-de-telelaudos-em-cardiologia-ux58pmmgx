/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração 0030 — Editor Flexível de Laudos (Texto Livre, Modelos Pessoais e Preferências Médicas)
 *
 * Cria:
 * 1. doctor_preferences:
 *    - user_id (relation -> users, cascadeDelete, maxSelect: 1, required)
 *    - doctor_id (relation -> doctors, cascadeDelete, maxSelect: 1)
 *    - default_report_mode (select: 'structured' | 'free_text', default: 'structured')
 *    - auto_generate_proposal_enabled (bool, default: false)
 *    - created, updated (autodate)
 *    - RLS: proprietário (@request.auth.id != '' && user_id = @request.auth.id)
 *    - Unique index em user_id
 *
 * 2. personal_report_templates:
 *    - user_id (relation -> users, cascadeDelete, maxSelect: 1, required)
 *    - doctor_id (relation -> doctors, cascadeDelete, maxSelect: 1)
 *    - title (text, required)
 *    - category (text, required)
 *    - description (text, required) - descrição eletrocardiográfica livre
 *    - conclusion (text, required) - síntese diagnóstica livre
 *    - is_active (bool, default: true)
 *    - created, updated (autodate)
 *    - RLS: proprietário (@request.auth.id != '' && user_id = @request.auth.id)
 *    - Index em user_id, title
 *
 * 3. Campos adicionais em ecg_reports e report_drafts:
 *    - report_mode (select: 'structured' | 'free_text', default: 'structured')
 */
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const doctorsCol = app.findCollectionByNameOrId('doctors')

    // 1. Coleção doctor_preferences
    try {
      app.findCollectionByNameOrId('doctor_preferences')
    } catch (_) {
      const docPrefs = new Collection({
        name: 'doctor_preferences',
        type: 'base',
        listRule: "@request.auth.id != '' && user_id = @request.auth.id",
        viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
        createRule: "@request.auth.id != '' && @request.body.user_id = @request.auth.id",
        updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'doctor_id',
            type: 'relation',
            collectionId: doctorsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'default_report_mode',
            type: 'select',
            required: true,
            values: ['structured', 'free_text'],
            maxSelect: 1,
          },
          {
            name: 'auto_generate_proposal_enabled',
            type: 'bool',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_doc_prefs_user ON doctor_preferences (user_id)'],
      })
      app.save(docPrefs)
    }

    // 2. Coleção personal_report_templates
    try {
      app.findCollectionByNameOrId('personal_report_templates')
    } catch (_) {
      const personalTpls = new Collection({
        name: 'personal_report_templates',
        type: 'base',
        listRule: "@request.auth.id != '' && user_id = @request.auth.id",
        viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
        createRule: "@request.auth.id != '' && @request.body.user_id = @request.auth.id",
        updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'doctor_id',
            type: 'relation',
            collectionId: doctorsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'title', type: 'text', required: true },
          { name: 'category', type: 'text', required: true },
          { name: 'description', type: 'text', required: true },
          { name: 'conclusion', type: 'text', required: true },
          { name: 'is_active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_personal_tpl_user ON personal_report_templates (user_id)',
          'CREATE INDEX idx_personal_tpl_title ON personal_report_templates (title)',
        ],
      })
      app.save(personalTpls)
    }

    // 3. Adicionar campo report_mode em ecg_reports e report_drafts caso não existam
    const reportsCol = app.findCollectionByNameOrId('ecg_reports')
    if (!reportsCol.fields.getByName('report_mode')) {
      reportsCol.fields.add(
        new SelectField({
          name: 'report_mode',
          values: ['structured', 'free_text'],
          maxSelect: 1,
        }),
      )
      app.save(reportsCol)
    }

    const draftsCol = app.findCollectionByNameOrId('report_drafts')
    if (!draftsCol.fields.getByName('report_mode')) {
      draftsCol.fields.add(
        new SelectField({
          name: 'report_mode',
          values: ['structured', 'free_text'],
          maxSelect: 1,
        }),
      )
      app.save(draftsCol)
    }
  },
  (app) => {
    try {
      const personalTpls = app.findCollectionByNameOrId('personal_report_templates')
      app.delete(personalTpls)
    } catch (_) {}

    try {
      const docPrefs = app.findCollectionByNameOrId('doctor_preferences')
      app.delete(docPrefs)
    } catch (_) {}

    try {
      const reportsCol = app.findCollectionByNameOrId('ecg_reports')
      const f1 = reportsCol.fields.getByName('report_mode')
      if (f1) {
        reportsCol.fields.removeByName('report_mode')
        app.save(reportsCol)
      }
    } catch (_) {}

    try {
      const draftsCol = app.findCollectionByNameOrId('report_drafts')
      const f2 = draftsCol.fields.getByName('report_mode')
      if (f2) {
        draftsCol.fields.removeByName('report_mode')
        app.save(draftsCol)
      }
    } catch (_) {}
  },
)
