'use strict'

const inquirer = require('inquirer')
const { loadRequiedFile, createFilePath } = require('./util')
const { sendKintoneInfo, fetchKintoneInfo } = require('./client')
const { convertAppSettingsJson, convertAppFormFieldsJson } = require('./converter')

const addField = async (ktn, kintoneInfo, message) => {
  const jaRegexp = /指定されたフィールド（code: (.+)）が見つかりません/
  const enRegexp = /The field \(code: (.+)\) not found/
  const zhRegexp = /未找到相应的字段（code: (.+)）/
  const found = message.match(jaRegexp) || message.match(enRegexp) || message.match(zhRegexp)
  const fieldCode = found && found[1]
  if (!fieldCode) {
    return Promise.reject(new Error())
  }

  const { isConfirmed } = await inquirer.prompt([
    {
      name: 'isConfirmed',
      type: 'confirm',
      message: `Add field [${fieldCode}] to ${ktn.environment}.${ktn.appName}?`,
    },
  ])
  if (!isConfirmed) {
    process.exit(0)
  }
  const postingInfo = {
    app: kintoneInfo.app,
    properties: { [fieldCode]: kintoneInfo.properties[fieldCode] },
  }
  await sendKintoneInfo('POST', ktn, postingInfo)
}

const deleteField = async (ktn, kintoneInfo, message) => {
  const jaRegexp = /フォームの更新に失敗しました。一部のフィールド（code: (.+)）のレイアウトを指定していません/
  const enRegexp = /Failed to update form\. Field \(code: (.+)\) is missing in the layout parameter/
  const zhRegexp = /表单更新失败。部分字段（code: (.+)）未指定布局/
  const found = message.match(jaRegexp) || message.match(enRegexp) || message.match(zhRegexp)
  const fieldCodes = found && found[1]
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
  const deletingKtn = {
    ...ktn,
    command: 'preview/app/form/fields.json',
  }
  const deletingInfo = {
    app: kintoneInfo.app,
    fields,
  }
  await sendKintoneInfo('DELETE', deletingKtn, deletingInfo)
}

const deleteFieldInSubtable = async (ktn, kintoneInfo, message) => {
  const jaRegexp = /フォームの更新に失敗しました。テーブル「(.+)」の指定が正しくありません。指定するフィールドに不足がある、またはテーブルにないフィールドを指定しています/
  const enRegexp = /The format of table (.+) is not valid. Some fields may be missing or the specified fields may not exist in the table/
  const zhRegexp = /表格“(.+)”的指定不正确。原有字段缺失或添加了原表格中不存在的字段/
  const found = message.match(jaRegexp) || message.match(enRegexp) || message.match(zhRegexp)
  const subtableField = found && found[1]
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
  const deletingKtn = {
    ...ktn,
    command: 'preview/app/form/fields.json',
  }
  const deletingInfo = {
    app: kintoneInfo.app,
    fields,
  }
  await sendKintoneInfo('DELETE', deletingKtn, deletingInfo)
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
    const { message, errors } = e.error
    if (ktn.command === 'preview/app/form/fields.json' && e.error.code === 'GAIA_FC01') {
      await addField(ktn, kintoneInfo, message).catch(() => {
        throw e
      })
      await execPush(ktn, kintoneInfo)
    } else if (ktn.command === 'preview/app/form/layout.json') {
      if (e.error.code === 'GAIA_FN11') {
        // アプリ直下フィールドの削除(指定したフィールドが見つかりません)
        await deleteField(ktn, kintoneInfo, message).catch(() => {
          throw e
        })
        await execPush(ktn, kintoneInfo)
      } else if (e.error.code === 'CB_VA01') {
        // サブテーブルフィールドの削除(指定するフィールドに不足がある、またはテーブルにないフィールドを指定しています)
        await deleteFieldInSubtable(ktn, kintoneInfo, JSON.stringify(errors)).catch(() => {
          throw e
        })
        await execPush(ktn, kintoneInfo)
      } else {
        throw e
      }
    } else if (ktn.command === 'preview/app/views.json' && e.error.code === 'CB_NO02') {
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
