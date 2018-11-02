'use strict'

const fs = require('fs')
const path = require('path')

const { createFilePath, createDirPath } = require('./ginue')

module.exports = async opts => {
  const apps = Object.entries(opts.app)
  const plantumlCode = [
    `@startuml

hide empty members
!define ENTITY_MARK_COLOR B3CFB3
`,
  ]

  const relationMap = {}
  apps.forEach(async ([appCode, appId]) => {
    const app = require(path.resolve(createFilePath({ appName: appCode, command: 'app_form_fields.json' }, opts)))
    const { name } = require(path.resolve(createFilePath({ appName: appCode, command: 'app.json' }, opts)))
    const lookupFields = Object.values(app.properties).filter(prop => prop.lookup)
    relationMap[appId] = { name, lookupFields }
  })

  Object.entries(relationMap).forEach(([id, prop]) => {
    plantumlCode.push(`entity "${prop.name}" <<E,ENTITY_MARK_COLOR>> {
}`)
  })

  Object.entries(relationMap).forEach(([id, prop]) => {
    const appName = prop.name
    prop.lookupFields.forEach(field => {
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

  const dirPath = createDirPath({ appName: '' }, opts)
  const filePath = `${dirPath}/erd.pu`
  fs.writeFileSync(filePath, plantumlCodeStr)
  console.log(filePath)
}
