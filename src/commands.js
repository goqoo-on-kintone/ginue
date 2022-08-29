module.exports = {
  'app.json': {
    appParam: 'id',
    hasPreview: false,
    methods: ['GET'],
  },
  'app/acl.json': {
    appParam: 'app',
    hasPreview: true,
    methods: ['GET', 'PUT'],
  },
  'app/customize.json': {
    appParam: 'app',
    hasPreview: true,
    methods: ['GET', 'PUT'],
  },
  'app/form/fields.json': {
    appParam: 'app',
    hasPreview: true,
    langParam: 'lang',
    methods: ['GET', 'PUT'],
  },
  'app/form/layout.json': {
    appParam: 'app',
    hasPreview: true,
    methods: ['GET', 'PUT'],
  },
  'app/reports.json': {
    appParam: 'app',
    hasPreview: true,
    langParam: 'lang',
    methods: ['GET', 'PUT'],
    skipOauth: true,
  },
  'app/settings.json': {
    appParam: 'app',
    hasPreview: true,
    langParam: 'lang',
    methods: ['GET', 'PUT'],
  },
  'app/status.json': {
    appParam: 'app',
    hasPreview: true,
    langParam: 'lang',
    methods: ['GET', 'PUT'],
  },
  'app/views.json': {
    appParam: 'app',
    hasPreview: true,
    langParam: 'lang',
    methods: ['GET', 'PUT'],
  },
  'field/acl.json': {
    appParam: 'app',
    hasPreview: true,
    methods: ['GET', 'PUT'],
  },
  'record/acl.json': {
    appParam: 'app',
    hasPreview: true,
    langParam: 'lang',
    methods: ['GET', 'PUT'],
  },
}
