'use strict'

// TODO: isPushはやめる

const convertAppSettingsJson = (kintoneInfoObj, isPush) => {
  if (isPush) {
    delete kintoneInfoObj.name
  } else {
    kintoneInfoObj.name = '<APP_NAME>'
  }

  if (kintoneInfoObj.icon.type === 'FILE') {
    if (isPush) {
      delete kintoneInfoObj.icon
    } else {
      kintoneInfoObj.icon.file.fileKey = ['<FILE_KEY>']
    }
  }
}

const pluckPushTargetAppId = (pushBaseAppId, opts) => {
  const pushBaseApp = Object.entries(opts.app).find(([appName, appId]) => appId === Number(pushBaseAppId))
  if (!pushBaseApp) {
    console.error(`ERROR: App "${pushBaseAppId}" not found in "${opts.environment}" environment!`)
    process.exit(1)
  }
  const [appName] = pushBaseApp
  const pushTargetAppId = opts.pushTarget.app[appName]
  if (!pushTargetAppId) {
    console.error(`ERROR: App "${appName}" not found in "${opts.pushTarget.environment}" environment!`)
    process.exit(1)
  }
  return pushTargetAppId
}

const convertAppFormFieldsJson = (properties, opts) => {
  const isPush = Boolean(opts)
  for (const prop of Object.values(properties)) {
    if (prop.lookup) {
      const relatedApp = prop.lookup.relatedApp
      relatedApp.app = isPush ? pluckPushTargetAppId(relatedApp.app, opts) : '<APP_ID>'
    }
    if (prop.referenceTable) {
      const relatedApp = prop.referenceTable.relatedApp
      relatedApp.app = isPush ? pluckPushTargetAppId(relatedApp.app, opts) : '<APP_ID>'
    }
    if (prop.fields) {
      convertAppFormFieldsJson(prop.fields, opts)
    }
  }
}

const convertFormJson = (properties) => {
  for (const prop of properties) {
    if (prop.relatedApp) {
      prop.relatedApp = '<APP_ID>'
    }
    if (prop.fields) {
      convertFormJson(prop.fields)
    }
  }
}

// 環境依存の情報にマスクをかける
// TODO: マスクだけではなくアプリ名やビュー名を使ってpush時に復元できるように
const convertAppIdToName = (ktn, kintoneInfoObj) => {
  switch (ktn.command) {
    case 'app.json':
      kintoneInfoObj.appId = '<APP_ID>'
      kintoneInfoObj.name = '<APP_NAME>'
      kintoneInfoObj.creator.code = '<CREATOR_CODE>'
      kintoneInfoObj.creator.name = '<CREATOR_NAME>'
      kintoneInfoObj.createdAt = '<CREATED_AT>'
      kintoneInfoObj.modifiedAt = '<MODIFIED_AT>'
      kintoneInfoObj.modifier.code = '<MODIFIER_CODE>'
      kintoneInfoObj.modifier.name = '<MODIFIER_NAME>'
      kintoneInfoObj.spaceId = '<SPACE_ID>'
      kintoneInfoObj.threadId = '<THREAD_ID>'
      return true
    case 'app/views.json':
      for (const prop of Object.values(kintoneInfoObj.views)) {
        prop.id = '<VIEW_ID>'
      }
      return true
    case 'app/reports.json':
      for (const prop of Object.values(kintoneInfoObj.reports)) {
        prop.id = '<REPORT_ID>'
      }
      return true
    case 'app/customize.json':
      kintoneInfoObj.desktop.js = ['<DESKTOP_JS>']
      kintoneInfoObj.desktop.css = ['<DESKTOP_CSS>']
      kintoneInfoObj.mobile.js = ['<MOBILE_JS>']
      kintoneInfoObj.mobile.css = ['<MOBILE_CSS>']
      return true
    case 'app/settings.json':
      convertAppSettingsJson(kintoneInfoObj)
      return true
    case 'app/form/fields.json':
      convertAppFormFieldsJson(kintoneInfoObj.properties)
      return true
    case 'form.json':
      // TODO: そもそもform.jsonはpullしない
      convertFormJson(kintoneInfoObj.properties)
      return true
    default:
      return false
  }
}

module.exports = { convertAppSettingsJson, convertAppFormFieldsJson, convertAppIdToName }
