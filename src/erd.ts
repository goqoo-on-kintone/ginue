import fs from 'fs'
import path from 'path'
import { createFilePath, createBaseDirPath } from './util'
import type { Opts } from './types'
import type { App, Properties } from '@kintone/rest-api-client/lib/client/types/app'
import type { Lookup } from '@kintone/rest-api-client/lib/KintoneFields/types/property'

export const ginueErd = async (opts: Opts) => {
  const apps = Object.entries(opts.app!)
  const plantumlCode = [
    `@startuml

hide empty members
!define ENTITY_MARK_COLOR B3CFB3
`,
  ]

  const relationMap: Record<string, { name: string; lookupFields: Lookup[] }> = {}
  apps.forEach(async ([appCode, appId]) => {
    const app = require(path.resolve(createFilePath({ appName: appCode, command: 'app_form_fields.json' }, opts))) as {
      properties: Properties
    }
    const { name } = require(path.resolve(createFilePath({ appName: appCode, command: 'app.json' }, opts))) as App
    const lookupFields = Object.values(app.properties).filter((prop): prop is Lookup =>
      Boolean('lookup' in prop && prop.lookup)
    )
    relationMap[appId] = { name, lookupFields }
  })

  Object.entries(relationMap).forEach(([id, prop]) => {
    plantumlCode.push(`entity "${prop.name}" <<E,ENTITY_MARK_COLOR>> {
}`)
  })

  Object.entries(relationMap).forEach(([id, prop]) => {
    const appName = prop.name
    prop.lookupFields.forEach((field) => {
      const relatedAppId = field.lookup.relatedApp.app
      // TODO: 外部キー名を図に入れたい
      // const relatedKeyField = field.lookup.relatedKeyField
      if (relationMap[relatedAppId]) {
        const relatedAppName = relationMap[relatedAppId].name

        const erd = `"${relatedAppName}" --{ "${appName}"`
        plantumlCode.push(erd)
      }
    })
  })

  plantumlCode.push('@enduml')
  const plantumlCodeStr = plantumlCode.join('\n')

  const dirPath = createBaseDirPath(opts)
  const filePath = `${dirPath}/erd.pu`
  fs.writeFileSync(filePath, plantumlCodeStr)
  console.info(filePath)
}
