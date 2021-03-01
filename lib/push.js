'use strict'

const inquirer = require('inquirer')
const { loadRequiedFile, createFilePath } = require('./util')
const { sendKintoneInfo, fetchKintoneInfo } = require('./client')
const { convertAppSettingsJson, convertAppFormFieldsJson } = require('./converter')

const pluckFieldCodeFromMessage = (message, regexps) => {
  const found = regexps.map((regexp) => message.match(regexp)).find((found) => Array.isArray(found))
  return found && found[1]
}

const addField = async (message, ktn, kintoneInfo) => {
  const fieldCode = pluckFieldCodeFromMessage(message, [
    /指定されたフィールド（code: (.+)）が見つかりません/,
    /The field \(code: (.+)\) not found/,
    /未找到相应的字段（code: (.+)）/,
  ])
  if (!fieldCode) {
    return Promise.reject(new Error())
  }

  let property = kintoneInfo.properties[fieldCode]
  let keyFieldCode = fieldCode
  let messageFieldCode = fieldCode
  if (!property) {
    // サブテーブル内フィールドを追加する場合
    const outerProperty = Object.values(kintoneInfo.properties)
      .filter((_) => _.type === 'SUBTABLE')
      .find((_) => Object.keys(_.fields).some((code) => code === fieldCode))
    const innerProperty = Object.values(outerProperty.fields).find((_) => _.code === fieldCode)

    property = {
      ...outerProperty,
      fields: {
        [fieldCode]: innerProperty,
      },
    }
    keyFieldCode = outerProperty.code
    messageFieldCode = `${outerProperty.code}.${fieldCode}`
  }

  const { isConfirmed } = await inquirer.prompt([
    {
      name: 'isConfirmed',
      type: 'confirm',
      message: `Add field [${messageFieldCode}] to ${ktn.environment}.${ktn.appName}?`,
    },
  ])
  if (!isConfirmed) {
    process.exit(0)
  }
  const postingInfo = {
    app: kintoneInfo.app,
    properties: { [keyFieldCode]: property },
  }
  // TODO: ここでメッセージ出力はあんまり良くないので奇麗にしたい
  await sendKintoneInfo('POST', ktn, postingInfo).catch((e) => console.log(e.message))
}

const deleteFields = async (ktn, kintoneInfo, fields) => {
  const deletingKtn = {
    ...ktn,
    command: 'preview/app/form/fields.json',
  }
  const deletingInfo = {
    app: kintoneInfo.app,
    fields,
  }
  // TODO: ここでメッセージ出力はあんまり良くないので奇麗にしたい
  await sendKintoneInfo('DELETE', deletingKtn, deletingInfo).catch((e) => console.log(e.message))
}

const confirmDeleteFieldsInRoot = async (message, ktn) => {
  const fieldCodes = pluckFieldCodeFromMessage(message, [
    /フォームの更新に失敗しました。一部のフィールド（code: (.+)）のレイアウトを指定していません/,
    /Failed to update form\. Field \(code: (.+)\) is missing in the layout parameter/,
    /表单更新失败。部分字段（code: (.+)）未指定布局/,
  ])
  if (!fieldCodes) {
    return Promise.reject(new Error())
  }

  const fields = fieldCodes.split(',')
  const { isConfirmed } = await inquirer.prompt([
    {
      name: 'isConfirmed',
      type: 'confirm',
      message: `Delete fields [${fields.join(', ')}] from ${ktn.environment}.${ktn.appName}?`,
    },
  ])
  if (!isConfirmed) {
    process.exit(0)
  }
  return fields
}

const confirmDeleteFieldsInSubtable = async (message, ktn, kintoneInfo) => {
  const subtableField = pluckFieldCodeFromMessage(message, [
    /フォームの更新に失敗しました。テーブル「(.+)」の指定が正しくありません。指定するフィールドに不足がある、またはテーブルにないフィールドを指定しています/,
    /The format of table (.+) is not valid. Some fields may be missing or the specified fields may not exist in the table/,
    /表格“(.+)”的指定不正确。原有字段缺失或添加了原表格中不存在的字段/,
  ])
  if (!subtableField) {
    return Promise.reject(new Error())
  }

  const kintoneInfoOfTarget = await fetchKintoneInfo({ ...ktn, command: 'app/form/layout.json', preview: true })
  const innerFieldCodes = (_) => _.layout.find((_) => _.code === subtableField).fields.map((_) => _.code)
  const fieldsOfTarget = innerFieldCodes(kintoneInfoOfTarget)
  const fieldsToSend = innerFieldCodes(kintoneInfo)
  const fields = fieldsOfTarget.filter((code) => !fieldsToSend.includes(code))

  const { isConfirmed } = await inquirer.prompt([
    {
      name: 'isConfirmed',
      type: 'confirm',
      message: `Delete fields [${fields.map((_) => `${subtableField}.${_}`).join(', ')}] in from ${ktn.environment}.${
        ktn.appName
      }?`,
    },
  ])
  if (!isConfirmed) {
    process.exit(0)
  }
  return fields
}

const isSkipRequest = async (command, message) => {
  const { isConfirmed } = await inquirer.prompt([
    {
      name: 'isConfirmed',
      type: 'confirm',
      message: `[${command}] ${message} Skip request?`,
    },
  ])
  if (!isConfirmed) {
    process.exit(0)
  }
}

const execPush = async (ktn, kintoneInfo) => {
  try {
    await sendKintoneInfo('PUT', ktn, kintoneInfo)
  } catch (e) {
    const { code, message, errors } = JSON.parse(e.message)
    if (ktn.command === 'preview/app/form/fields.json' && code === 'GAIA_FC01') {
      await addField(message, ktn, kintoneInfo).catch(() => {
        throw e
      })
      await execPush(ktn, kintoneInfo)
    } else if (ktn.command === 'preview/app/form/layout.json') {
      const confirmDeleteFields = {
        GAIA_FN11: () => confirmDeleteFieldsInRoot(message, ktn),
        CB_VA01: () => confirmDeleteFieldsInSubtable(JSON.stringify(errors), ktn, kintoneInfo),
      }[code]
      if (!confirmDeleteFields) throw e

      const fields = await confirmDeleteFields()
      if (fields) {
        await deleteFields(ktn, kintoneInfo, fields).catch(() => {
          throw e
        })
        await execPush(ktn, kintoneInfo)
      } else {
        throw e
      }
    } else if (ktn.command === 'preview/app/views.json' && status === 'CB_NO02') {
      await isSkipRequest('app/views.json', 'Permission denied.').catch(() => {
        throw e
      })
      console.log(`[SKIP] app/views.json`)
    } else {
      throw e
    }
  }
}

exports.ginuePush = async (ktn, opts, pushTarget) => {
  if (!ktn.methods.includes('PUT')) {
    return
  }
  if (
    [
      'app/customize.json', // TODO: ファイルアップロードが伴うので除外。今後工夫する
    ].includes(ktn.command)
  ) {
    return
  }
  console.log(ktn.command)
  const filePath = createFilePath(ktn, opts)
  const kintoneInfo = loadRequiedFile(filePath)
  ktn.command = `preview/${ktn.command}`

  if (ktn.command === 'preview/app/settings.json') {
    convertAppSettingsJson(kintoneInfo, true)
  }

  if (pushTarget) {
    if (ktn.command === 'preview/app/form/fields.json') {
      convertAppFormFieldsJson(kintoneInfo.properties, opts)
    }
    for (const key of ['domain', 'guestSpaceId', 'base64Basic', 'base64Account', 'appId']) {
      ktn[key] = pushTarget[key]
    }
  }

  kintoneInfo.app = ktn.appId
  ktn.environment = opts.pushTarget ? opts.pushTarget.environment : opts.environment
  await execPush(ktn, kintoneInfo)
}
