// TODO: isPushはやめる

import type { App, Properties, ViewForResponse, ReportForResponse } from '@kintone/rest-api-client/lib/client/types/app'
import type { AppCustomize, AppSettings, Ktn, Opts } from './types'

export const convertAppSettingsJson = (settings: Partial<AppSettings>, isPush?: boolean) => {
  if (isPush) {
    delete settings.name
  } else {
    settings.name = '<APP_NAME>'
  }

  if (settings.icon?.type === 'FILE') {
    if (isPush) {
      delete settings.icon
    } else {
      settings.icon.file.fileKey = '<FILE_KEY>'
    }
  }
}

const pluckPushTargetAppId = (pushBaseAppId: string | number, opts?: Opts) => {
  // @ts-expect-error
  const pushBaseApp = Object.entries(opts.app).find(([appName, appId]) => appId === Number(pushBaseAppId))
  if (!pushBaseApp) {
    console.error(`ERROR: App "${pushBaseAppId}" not found in "${opts?.environment}" environment!`)
    process.exit(1)
  }
  const [appName] = pushBaseApp
  // @ts-expect-error
  const pushTargetAppId = opts.pushTarget.app[appName]
  if (!pushTargetAppId) {
    console.error(`ERROR: App "${appName}" not found in "${opts?.pushTarget?.environment}" environment!`)
    process.exit(1)
  }
  return pushTargetAppId
}

export const convertAppFormFieldsJson = (properties: Properties, opts?: Opts) => {
  const isPush = Boolean(opts)
  for (const prop of Object.values(properties)) {
    if ('lookup' in prop && prop.lookup) {
      const relatedApp = prop.lookup.relatedApp
      relatedApp.app = isPush ? pluckPushTargetAppId(relatedApp.app, opts) : '<APP_ID>'
    }
    if ('referenceTable' in prop && prop.referenceTable) {
      const relatedApp = prop.referenceTable.relatedApp
      relatedApp.app = isPush ? pluckPushTargetAppId(relatedApp.app, opts) : '<APP_ID>'
    }
    if ('fields' in prop && prop.fields) {
      convertAppFormFieldsJson(prop.fields, opts)
    }
  }
}

const convertFormJson = (properties: any[]) => {
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
export const convertAppIdToName = (ktn: Ktn, kintoneInfoObj: any) => {
  switch (ktn.command) {
    case 'app.json': {
      const app = kintoneInfoObj as App
      app.appId = '<APP_ID>'
      app.name = '<APP_NAME>'
      app.creator.code = '<CREATOR_CODE>'
      app.creator.name = '<CREATOR_NAME>'
      app.createdAt = '<CREATED_AT>'
      app.modifiedAt = '<MODIFIED_AT>'
      app.modifier.code = '<MODIFIER_CODE>'
      app.modifier.name = '<MODIFIER_NAME>'
      app.spaceId = '<SPACE_ID>'
      app.threadId = '<THREAD_ID>'
      return true
    }
    case 'app/views.json': {
      const { views } = kintoneInfoObj as { views: Record<string, ViewForResponse> }
      for (const prop of Object.values(views)) {
        prop.id = '<VIEW_ID>'
      }
      return true
    }
    case 'app/reports.json': {
      const { reports } = kintoneInfoObj as { reports: Record<string, ReportForResponse> }
      for (const prop of Object.values(reports)) {
        prop.id = '<REPORT_ID>'
      }
      return true
    }
    case 'app/customize.json': {
      const customize = kintoneInfoObj as AppCustomize
      customize.desktop.js = ['<DESKTOP_JS>']
      customize.desktop.css = ['<DESKTOP_CSS>']
      customize.mobile.js = ['<MOBILE_JS>']
      customize.mobile.css = ['<MOBILE_CSS>']
      return true
    }
    case 'app/settings.json': {
      const settings = kintoneInfoObj as AppSettings
      convertAppSettingsJson(settings)
      return true
    }
    case 'app/form/fields.json': {
      const { properties } = kintoneInfoObj as { properties: Properties }
      convertAppFormFieldsJson(properties)
      return true
    }
    case 'form.json':
      // TODO: そもそもform.jsonはpullしない
      convertFormJson(kintoneInfoObj.properties)
      return true
    default:
      return false
  }
}
