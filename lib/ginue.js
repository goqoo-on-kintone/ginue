#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const inquirer = require('inquirer')
const minimist = require('minimist')
const mkdirp = require('mkdirp')
const { default: netrc } = require('netrc-parser')
const rcfile = require('rc-config-loader')
const request = require('request-promise')
const requireFromString = require('require-from-string')
const _ = require('lodash')

const prettier = require('prettier')
// .prettierrcがあればそれに沿ってフォーマット
const prettierOptions = prettier.resolveConfig.sync(process.cwd()) || {}
// parserを指定しないと警告が出るのでその対策
prettierOptions.parser = prettierOptions.parser || 'babylon'

const pretty = (obj) => JSON.stringify(obj, null, '  ')
const prettyln = (obj) => pretty(obj) + '\n'
const trim = (str) => str.replace(/^\n|\n$/g, '')

const showVersion = () => {
  const { version } = require('../package.json')
  console.error(`Ginue ${version}`)
  process.exit(0)
}

const usageExit = (returnCode = 0, command) => {
  let message
  switch (command) {
    case 'pull':
      message = trim(`
usage: ginue pull [<target environment>] [<options>]

  -h, --help                    Output usage information
  -d, --domain=<DOMAIN>         kintone domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
  -A, --appName=<APP-NAME>      Set target app name
  -l, --location=<LOCATION>     Location of settings file
  -t, --fileType=<FILE-TYPE>    Set file type 'json'(default) or 'js'
  --preview                     Fetch xxx-preview.json
`)
      break
    case 'push':
      message = trim(`
usage: ginue push [<target environment>[:<target environment>]] [<options>]

  -h, --help                    Output usage information
  -d, --domain=<DOMAIN>         kintone domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
  -A, --appName=<APP-NAME>      Set target app name
  -l, --location=<LOCATION>     Location of settings file
  -t, --fileType=<FILE-TYPE>    Set file type 'json'(default) or 'js'
`)
      break
    case 'deploy':
      message = trim(`
usage: ginue deploy [<target environment>] [<options>]

  -h, --help                    Output usage information
  -d, --domain=<DOMAIN>         kintone domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
  -A, --appName=<APP-NAME>      Set target app name
`)
      break
    case 'reset':
      message = trim(`
usage: ginue reset [<target environment>] [<options>]

  -h, --help                    Output usage information
  -d, --domain=<DOMAIN>         kintone domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
  -A, --appName=<APP-NAME>      Set target app name
`)
      break
    case 'erd':
      message = trim(`
usage: ginue erd [<target environment>] [<options>]

  -h, --help                    Output usage information
`)
      break
    default:
      message = trim(`
usage: ginue [-v, --version] [-h, --help]
              pull [<options>]
              push [<options>]
              deploy [<options>]
              reset [<options>]
              erd [<options>]
`)
  }
  console.error(message)
  process.exit(returnCode)
}

// TODO: 全エラーメッセージをこの関数に統一
const errorExit = (message, returnCode = 1) => {
  console.error(`ERROR: ${message}`)
  process.exit(returnCode)
}

const loadJsonFile = async (fileName, dirName) => {
  const file = await promisify(fs.readFile)(path.join(dirName, fileName), 'utf8')
  try {
    const obj = JSON.parse(file)
    return obj
  } catch (e) {
    errorExit(`Invalid ${fileName}!`)
  }
}

const loadKintoneCommands = async (exclude) => {
  // TODO: ローカルにcommands.jsonが存在したらそれを優先して使いたい
  const kintoneCommands = await loadJsonFile('commands.json', __dirname).catch((e) => {
    console.error(`ERROR: commands.json not found!\n`, e.message)
    process.exit(1)
  })
  if (exclude) {
    // TODO: -aオプションの複数指定もこの仕様に合わせた方が良いかも。。
    const excludeCommands = Array.isArray(exclude) ? exclude : [exclude]
    for (const excludeCommand of excludeCommands) {
      if (!kintoneCommands[excludeCommand]) {
        console.error(`ERROR: '${excludeCommand}' no such command!`)
        process.exit(1)
      }
      delete kintoneCommands[excludeCommand]
    }
  }
  return kintoneCommands
}

const loadGinuerc = async () => {
  const ginuercFile = rcfile('ginue')
  if (!ginuercFile) {
    return [{}]
  }
  const { config: ginuerc } = ginuercFile

  if (Array.isArray(ginuerc)) {
    console.error(`ERROR: The top-level structure of .ginuerc must not be array. (Since v2.0)`)
    process.exit(1)
  }

  if (!ginuerc.env) {
    return [ginuerc]
  }

  return Object.entries(ginuerc.env).map(([envName, envGinuerc]) => {
    envGinuerc.environment = envName

    // 内側のlocationはプロパティ名を変更しておく
    envGinuerc.envLocation = envGinuerc.location
    envGinuerc.location = ginuerc.location

    // location以外のプロパティは(外側 < 内側)の優先度で設定
    ;['fileType', 'preview', 'alt'].forEach((prop) => {
      if (ginuerc[prop] && envGinuerc[prop] === undefined) {
        envGinuerc[prop] = ginuerc[prop]
      }
    })

    return envGinuerc
  })
}

const createDirPath = (ktn, opts) => {
  let dirPath = ''

  if (opts.location) {
    dirPath += `${opts.location}/`
  }

  if (opts.envLocation) {
    dirPath += opts.envLocation
  } else if (opts.environment) {
    dirPath += opts.environment
  }

  if (ktn.preview) {
    if (dirPath) {
      dirPath += '-'
    }
    dirPath += 'preview'
  }
  if (dirPath) {
    dirPath += '/'
  }
  return `${dirPath}${ktn.appName}`
}

const createFilePath = (ktn, opts, customFileName) => {
  const dirPath = createDirPath(ktn, opts)
  mkdirp.sync(dirPath)
  let fileName = customFileName || `${ktn.command.replace(/\//g, '_')}`
  if (opts.fileType === 'js') {
    fileName = fileName.replace(/\.json$/, '.js')
  }
  return `${dirPath}/${fileName}`
}

const createUrl = (ktn) => {
  const basePath = ktn.guestSpaceId ? `k/guest/${ktn.guestSpaceId}/v1` : 'k/v1'
  return `https://${ktn.domain}/${basePath}/${ktn.command}`
}

const createGetUrl = (ktn) => {
  // TODO: 保存ファイル名に影響を与えないための処理だけどイマイチ。今後直す。
  ktn = Object.assign({}, ktn)
  if (ktn.preview) {
    ktn.command = `preview/${ktn.command}`
  }
  const baseUrl = createUrl(ktn)
  return `${baseUrl}?${ktn.appParam}=${ktn.appId}`
}

// 今後push機能を実装する場合にPOST/PUT向けの複雑なヘッダーを作成するために用意した関数
// TODO: push作ったけど複雑にはならないかも。一回見直す
const createHeaders = (ktn) => {
  const header = {
    'X-Cybozu-Authorization': ktn.base64Account,
    Authorization: `Basic ${ktn.base64Basic}`,
  }
  // デバッグ時はここのlangをja|en|zhで切り替えて各言語テスト
  // ktn.lang = 'en'
  if (ktn.lang) {
    header['Accept-Language'] = ktn.lang
  }
  return header
}

// ユーザー名・パスワードをBase64エンコードする関数
// 呼び出し方は2通り
// 引数1つ：(ユーザー名:パスワード)コロン区切り文字列
// 引数2つ：(ユーザー名, パスワード)それぞれの文字列
const createBase64Account = async (...account) => {
  const base64Account = Buffer.from(account.join(':')).toString('base64')
  return base64Account
}

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
    case 'app/customize.json':
      kintoneInfoObj.desktop.js = ['<DESKTOP_JS>']
      kintoneInfoObj.desktop.css = ['<DESKTOP_CSS>']
      kintoneInfoObj.mobile.js = ['<MOBILE_JS>']
      return true
    case 'app/settings.json':
      convertAppSettingsJson(kintoneInfoObj)
      return true
    case 'app/form/fields.json':
      convertAppFormFieldsJson(kintoneInfoObj.properties)
      return true
    case 'form.json':
      convertFormJson(kintoneInfoObj.properties)
      return true
    default:
      return false
  }
}

const compare = (i, j) => {
  if (i < j) {
    return -1
  } else if (i > j) {
    return 1
  }
  return 0
}

const sortObj = (ktn, kintoneInfoObj) => {
  switch (ktn.command) {
    case 'app/form/fields.json': {
      const keys = Object.keys(kintoneInfoObj.properties)
      keys.sort()
      return keys.reduce((obj, key) => {
        const property = _.cloneDeep(kintoneInfoObj.properties[key])
        if (property.lookup) {
          property.lookup.fieldMappings.sort((i, j) => compare(i.field, j.field))
        }
        obj[key] = property
        return obj
      }, {})
    }
    case 'field/acl.json': {
      const rights = _.cloneDeep(kintoneInfoObj.rights)
      rights.sort((i, j) => compare(i.code, j.code))
      return { rights }
    }
    case 'form.json': {
      const properties = _.cloneDeep(kintoneInfoObj.properties)
      const compareFormJson = (i, j) => {
        // 要素によって存在しないプロパティがあるので、3種類の優先順位付けでソート
        if (i.code && j.code) {
          return compare(i.code, j.code)
        } else if (i.code) {
          return -1
        } else if (j.code) {
          return 1
        } else if (i.label && j.label) {
          return compare(i.label, j.label)
        } else if (i.label) {
          return -1
        } else if (j.label) {
          return 1
        } else if (i.elementId && j.elementId) {
          return compare(i.elementId, j.elementId)
        } else if (i.elementId) {
          return -1
        } else if (j.elementId) {
          return 1
        }
        return 0
      }
      properties.sort(compareFormJson)
      properties.forEach((property) => {
        if (property.type === 'SUBTABLE') {
          property.fields.sort(compareFormJson)
        }
      })
      return { properties }
    }
  }
  return kintoneInfoObj
}

const fetchKintoneInfo = async (ktn, opts) => {
  const options = {
    url: createGetUrl(ktn),
    headers: createHeaders(ktn),
    json: true,
  }
  const kintoneInfoObj = await request(options)

  let kintoneRevision
  if (kintoneInfoObj.revision) {
    kintoneRevision = prettyln({ revision: kintoneInfoObj.revision })
    delete kintoneInfoObj.revision
  }
  const kintoneInfo = prettyln(kintoneInfoObj)

  let kintoneInfoAlt
  if (opts.alt && (convertAppIdToName(ktn, kintoneInfoObj) || ktn.command === 'field/acl.json')) {
    const sortedObj = sortObj(ktn, kintoneInfoObj)
    kintoneInfoAlt = prettyln(sortedObj)
  }

  return [kintoneInfo, kintoneRevision, kintoneInfoAlt]
}

const inputKintoneInfo = async (name, type = 'input') => {
  const value = await inquirer.prompt([
    {
      name,
      type,
      message: `Enter your kintone ${name}:`,
      validate: (value) => {
        if (value.length) {
          return true
        } else {
          return `Please enter your ${name}`
        }
      },
    },
  ])
  return value[name]
}

const stdInputOptions = async (opts) => {
  const TYPE_PASSWORD = 'password'

  // 標準入力しないオプションを画面表示(複数環境のアカウント情報入力などで間違えないため)
  for (const [optName, optValue] of Object.entries(opts)) {
    if (optValue) {
      // TODO: chalkなど使って色をつけたい
      let dispValue = pretty(optValue)
      switch (optName) {
        case 'password':
        case 'basic':
          dispValue = '[hidden]'
          break
        case 'pushTarget':
          continue
      }
      console.log(`${optName}: ${dispValue}`)
    }
  }
  opts.domain = opts.domain || (await inputKintoneInfo('domain'))
  const netrcProps = netrc.machines[opts.domain] || {}

  const netrcBasic = netrcProps.account
  // TODO: コマンドライン引数のbasic処理と共通化したい
  if (!opts.basic && netrcBasic) {
    if (netrcBasic.includes(':')) {
      opts.basic = netrcBasic
    } else if (!opts.basic_user) {
      opts.basic_user = netrcBasic
    }
  }

  if (opts.basic_user) {
    // Basic認証のパスワードが省略された時だけ標準入力で問い合わせ
    // そもそもbasicオプションが指定されなかった場合は無視
    const basicPassword = await inputKintoneInfo('Basic Authentication password', TYPE_PASSWORD)
    opts.basic = `${opts.basic_user}:${basicPassword}`
  }

  opts.username =
    opts.username || netrcProps.login || process.env.GINUE_USERNAME || (await inputKintoneInfo('username'))
  opts.password =
    opts.password ||
    netrcProps.password ||
    process.env.GINUE_PASSWORD ||
    (await inputKintoneInfo('password', TYPE_PASSWORD))
  opts.basic = opts.basic || process.env.GINUE_BASIC

  opts.app = opts.app || (await inputKintoneInfo('app'))
  console.log()
  // TODO: 「is guest space?(Y/N)」のように問い合わせて、YならguestSpaceIdを入力
  // opts.guestSpaceId = opts.guestSpaceId || await inputKintoneInfo('guestSpaceID')
}

const parseArgumentOptions = () => {
  const argv = minimist(process.argv.slice(2), {
    // booleanを明記するとデフォルトfalseになってginuercとマージしづらいので書かない
    // 有効なオプションが分かるようにコメントとしては残しておく
    // boolean: ['version', 'help', 'preview', 'acl', 'alt'],
    string: ['location', 'domain', 'username', 'password', 'app', 'guest', 'basic', 'exclude', 'fileType', 'appName'],
    alias: {
      v: 'version',
      h: 'help',
      l: 'location',
      d: 'domain',
      u: 'username',
      p: 'password',
      a: 'app',
      g: 'guest',
      b: 'basic',
      x: 'exclude',
      t: 'fileType',
      A: 'appName',
    },
  })
  if (argv.domain || argv.username || argv.password || argv.app || argv.guest) {
    argv.priority = true
  }

  if (argv._[0]) {
    argv.type = argv._[0]
  }
  if (argv._[1]) {
    argv.target = argv._[1]
  }

  return argv
}

// TODO: minimistやめて、もっとリッチなライブラリを使う
// 引数や設定ファイルの組み合わせからオプション値を抽出
// firstObjを優先し、firstObjに存在しないプロパティはsecondObjを使用
const pluckOpts = (firstObj, secondObj) => {
  // TODO: previewやjsなどのboolean値はfirstObjがfalseでも必ず使われてしまうのを修正
  const obj = Object.assign({}, secondObj, firstObj)
  const opts = {
    location: obj.location,
    envLocation: obj.envLocation,
    environment: obj.environment,
    domain: obj.domain,
    username: obj.username,
    password: obj.password,
    app: obj.app,
    guestSpaceId: obj.guest,
    pushTarget: obj.pushTarget,
    // TODO: ginue diffコマンドを叩くとpreviewと運用環境との差分を表示したい（diffコマンドへのエイリアス？）
    preview: obj.preview,
    acl: obj.acl,
    field_acl: obj.field_acl,
    exclude: obj.exclude,
    fileType: obj.fileType,
    appName: obj.appName,
    alt: obj.alt,
  }

  // Basic認証のパスワード有無でプロパティ名を変えておく
  const basic = obj.basic
  if (basic) {
    if (basic.includes(':')) {
      opts.basic = basic
    } else {
      opts.basic_user = basic
    }
  }

  return opts
}

const createAppDic = (app) => {
  if (typeof app === 'string') {
    app = app.split(',').map((str) => str.trim())
  }
  if (Array.isArray(app)) {
    return app.reduce((obj, id) => {
      obj[id.toString()] = id
      return obj
    }, {})
  }
  return app
}

const createOptionValues = async () => {
  const argv = parseArgumentOptions()

  if (argv.version) {
    showVersion()
  }

  if (argv.help) {
    usageExit(0, argv.type)
  }

  if (!argv.type || !['pull', 'push', 'reset', 'deploy', 'erd'].includes(argv.type)) {
    usageExit(1)
  }

  const ginuerc = await loadGinuerc()

  let opts
  if (argv.target) {
    const [target, pushTarget] = argv.target.split(':')

    // push先target(コロンの右側)はginue pushの場合のみ指定可能
    if (pushTarget && argv.type !== 'push') {
      usageExit(1, argv.type)
    }

    const targetGinuercElem = ginuerc.find((g) => g.environment === target)
    if (!targetGinuercElem) {
      console.error(`ERROR: environment '${target}' not found.`)
      process.exit(1)
    }
    if (pushTarget) {
      // TODO: コマンドライン引数と組み合わさった場合の各種パターンを要テスト
      const pushTargetGinuercElem = ginuerc.find((g) => g.environment === pushTarget)
      if (!pushTargetGinuercElem) {
        console.error(`ERROR: environment '${pushTarget}' not found.`)
        process.exit(1)
      }
      if (Array.isArray(pushTargetGinuercElem.app) || Array.isArray(targetGinuercElem.app)) {
        console.error(`ERROR: 'app' should be Object if 'ginue push <env>:<env>' is specified.`)
        usageExit(1, 'push')
      }
      targetGinuercElem.pushTarget = pushTargetGinuercElem
    }
    opts = pluckOpts(argv, targetGinuercElem)
  } else if (ginuerc.length === 1) {
    // ginuercに単一環境だけ指定されている場合は、
    // argvを優先し、argvに存在しないオプションだけginuercを使う
    opts = pluckOpts(argv, ginuerc[0])
  } else if (argv.priority) {
    // ginuercに複数環境が指定され、argvにpriorityなオプションがある場合は、
    // ginuercを無視してargvのオプションだけ使う
    // argvには1種類の環境しか指定できず、ginuercの一部だけ使うことが難しいため
    opts = pluckOpts(argv)
  } else if (['push', 'reset', 'deploy'].includes(argv.type)) {
    // 送信系のコマンドは単一環境のみを対象にするため、ここまでの条件に合致しなければエラー
    // 複数環境への一括pushも技術的には難しくないけど、ヒューマンエラー防止のため非対応
    console.error('ERROR: <target environment> is required if .ginuerc has multiple environments.')
    usageExit(1, argv.type)
  } else {
    // 複数環境対応コマンドでargvにpriorityなオプションがなければ
    // ginuercの複数環境を全て使用
    // argvに何かしらオプションがあれば全環境でargvを優先
    opts = ginuerc.map((g) => pluckOpts(argv, g))
  }
  const allOpts = Array.isArray(opts) ? opts : [opts]

  // netrcに保存済みの情報取得
  netrc.loadSync()

  for (const opts of allOpts) {
    await stdInputOptions(opts)
    if (opts.pushTarget) {
      await stdInputOptions(opts.pushTarget)
    }
    opts.apps = createAppDic(opts.app)
    opts.type = argv.type
  }

  if (['push', 'reset', 'deploy'].includes(argv.type)) {
    const { isConfirmed } = await inquirer.prompt([
      {
        name: 'isConfirmed',
        type: 'confirm',
        message: `[${argv.type}] Are you sure?`,
      },
    ])
    if (!isConfirmed) {
      process.exit(0)
    }
  }

  return allOpts
}

const loadKintoneInfo = async (filePath) => {
  const extension = path.extname(filePath)
  let kintoneInfo
  switch (extension) {
    case '.json':
      kintoneInfo = await loadJsonFile(filePath, '.').catch((e) => {})
      break
    case '.js':
      const content = fs.readFileSync(filePath, 'utf-8')
      kintoneInfo = requireFromString(content, filePath)
      break
  }
  return kintoneInfo
}

const saveKintoneInfo = async (filePath, kintoneInfo) => {
  const extension = path.extname(filePath)
  if (extension === '.js') {
    kintoneInfo = prettier.format(
      trim(`
// Generated by ginue
module.exports = ${kintoneInfo}
`),
      prettierOptions
    )
  }
  fs.writeFileSync(filePath, kintoneInfo)
}

const createPutHeaders = (ktn) => {
  const headers = createHeaders(ktn)
  // TODO: do something
  return headers
}

const sendKintoneInfo = async (method, ktn, kintoneInfo) => {
  const options = {
    method: method,
    url: createUrl(ktn),
    headers: createPutHeaders(ktn),
    body: kintoneInfo,
    json: true,
  }
  const resp = await request(options)
  return resp
}

const addField = async (ktn, kintoneInfo, message) => {
  const jaRegexp = /The field \(code: (.+)\) not found/
  const enRegexp = /指定されたフィールド（code: (.+)）が見つかりません/
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
      message: `Add field "${fieldCode}" to ${ktn.environment}.${ktn.appName}?`,
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
  const jaRegexp = /Failed to update form\. Field \(code: (.+)\) is missing in the layout parameter/
  const enRegexp = /フォームの更新に失敗しました。一部のフィールド（code: (.+)）のレイアウトを指定していません/
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
      message: `Delete fields "${fields}" from ${ktn.environment}.${ktn.appName}?`,
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

const execPush = async (ktn, kintoneInfo) => {
  try {
    await sendKintoneInfo('PUT', ktn, kintoneInfo)
  } catch (e) {
    const { message } = e.error
    if (ktn.command === 'preview/app/form/fields.json' && e.error.code === 'GAIA_FC01') {
      await addField(ktn, kintoneInfo, message).catch(() => {
        throw e
      })
      await execPush(ktn, kintoneInfo)
    } else if (ktn.command === 'preview/app/form/layout.json' && e.error.code === 'GAIA_FN11') {
      await deleteField(ktn, kintoneInfo, message).catch(() => {
        throw e
      })
      await execPush(ktn, kintoneInfo)
    } else {
      throw e
    }
  }
}

const ginuePush = async (ktn, opts, pushTarget) => {
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
  const kintoneInfo = await loadKintoneInfo(filePath)
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

const abstractGinueDeploy = async (ktn, opts, isReset) => {
  ktn.command = 'preview/app/deploy.json'
  const requestBody = {
    apps: Object.entries(opts.apps)
      .filter(([appName, appId]) => !opts.appName || appName === opts.appName)
      .map(([appName, appId]) => ({ app: appId })),
    revert: isReset,
  }
  await sendKintoneInfo('POST', ktn, requestBody)
  // TODO: 反映状況を確認して終わるまで待機する機能をつけても良いかも
}
const ginueReset = async (ktn, opts) => abstractGinueDeploy(ktn, opts, true)
const ginueDeploy = async (ktn, opts) => abstractGinueDeploy(ktn, opts, false)

const ginuePull = async (ktn, opts) => {
  if (!ktn.methods.includes('GET')) {
    return
  }
  const [kintoneInfo, kintoneRevision, kintoneInfoAlt] = await fetchKintoneInfo(ktn, opts)
  const filePath = createFilePath(ktn, opts)
  console.log(filePath)
  saveKintoneInfo(filePath, kintoneInfo)
  if (kintoneRevision) {
    // TODO: 無駄に何回も上書保存するので、フラグを持たせて1回だけにしたい
    const revisionFilePath = createFilePath(ktn, opts, 'revision.json')
    saveKintoneInfo(revisionFilePath, kintoneRevision)
  }
  if (kintoneInfoAlt) {
    const altFilePath = filePath.replace('.js', '-alt.js') // (.json|.js) どっちにも対応するhack。。。
    console.log(altFilePath)
    saveKintoneInfo(altFilePath, kintoneInfoAlt)
  }
}

module.exports = {
  pretty,
  prettyln,
  trim,
  usageExit,
  loadJsonFile,
  loadKintoneCommands,
  loadGinuerc,
  createDirPath,
  createFilePath,
  createUrl,
  createGetUrl,
  createHeaders,
  createBase64Account,
  fetchKintoneInfo,
  inputKintoneInfo,
  stdInputOptions,
  parseArgumentOptions,
  pluckOpts,
  createAppDic,
  createOptionValues,
  loadKintoneInfo,
  createPutHeaders,
  sendKintoneInfo,
  ginuePush,
  ginuePull,
  ginueReset,
  ginueDeploy,
}
