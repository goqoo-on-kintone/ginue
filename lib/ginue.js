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

const pretty = obj => JSON.stringify(obj, null, '  ')
const prettyln = obj => pretty(obj) + '\n'
const trim = str => str.replace(/^\n|\n$/g, '')

// TODO: -vは早く実装する！
const usageExit = (returnCode = 0, command) => {
  let message
  switch (command) {
    case 'pull':
      message = trim(`
usage: ginue pull [<target environment>] [<options>]

  -h, --help                    output usage information
  -d, --domain=<DOMAIN>         kintone sub domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password`)
      break
    case 'push':
      message = trim(`
usage: ginue push [<target environment>[:<target environment>]] [<options>]

  -h, --help                    output usage information
  -d, --domain=<DOMAIN>         kintone sub domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password`)
      break
    case 'reset':
      message = trim(`
usage: ginue reset [<target environment>] [<options>]

  -h, --help                    output usage information`)
      break
    case 'deploy':
      message = trim(`
usage: ginue deploy [<target environment>] [<options>]

  -h, --help                    output usage information`)
      break
    default:
      message = trim(`
usage: ginue [-v, --version] [-h, --help]
              pull [<options>]
              push [<options>]
              reset [<options>]
              deploy [<options>]
`)
  }
  console.error(message)
  process.exit(returnCode)
}

const loadJsonFile = async (fileName, dirName) => {
  const file = await promisify(fs.readFile)(path.join(dirName, fileName), 'utf8')
  try {
    const obj = JSON.parse(file)
    return obj
  } catch (e) {
    console.error(`ERROR: Invalid ${fileName}!`)
    process.exit(1)
  }
}

const loadKintoneCommands = async exclude => {
  // TODO: ローカルにcommands.jsonが存在したらそれを優先して使いたい
  const kintoneCommands = await loadJsonFile('commands.json', __dirname).catch(e => {
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
  const ginuerc = rcfile('ginue').config
  return Array.isArray(ginuerc) ? ginuerc : [ginuerc]
}

const createDirPath = (ktn, opts) => {
  let dirPath = ''
  if (opts && opts.environment) {
    dirPath += `${opts.environment}`
  }
  if (ktn && ktn.preview) {
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
  if (opts.js) {
    fileName = fileName.replace(/\.json$/, '.js')
  }
  return `${dirPath}/${fileName}`
}

const createUrl = ktn => {
  const basePath = ktn.guestSpaceId ? `k/guest/${ktn.guestSpaceId}/v1` : 'k/v1'
  return `https://${ktn.domain}/${basePath}/${ktn.command}`
}

const createGetUrl = ktn => {
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
const createHeaders = ktn => {
  const header = {
    'X-Cybozu-Authorization': ktn.base64Account,
    Authorization: `Basic ${ktn.base64Basic}`,
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

const convertAppFormFieldsJson = properties => {
  for (const prop of Object.values(properties)) {
    if (prop.lookup) {
      prop.lookup.relatedApp.app = '<APP_ID>'
    }
    if (prop.referenceTable) {
      prop.referenceTable.relatedApp.app = '<APP_ID>'
    }
    if (prop.fields) {
      convertAppFormFieldsJson(prop.fields)
    }
  }
}

const convertFormJson = properties => {
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
      kintoneInfoObj.createdAt = '<CREATED_AT>'
      kintoneInfoObj.modifiedAt = '<MODIFIED_AT>'
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

const fetchKintoneInfo = async ktn => {
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
  if (convertAppIdToName(ktn, kintoneInfoObj)) {
    kintoneInfoAlt = prettyln(kintoneInfoObj)
  }

  return [kintoneInfo, kintoneRevision, kintoneInfoAlt]
}

const inputKintoneInfo = async (name, type = 'input') => {
  const value = await inquirer.prompt([
    {
      name,
      type,
      message: `Enter your kintone ${name}:`,
      validate: value => {
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

const stdInputOptions = async opts => {
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

  opts.username = opts.username || netrcProps.login || (await inputKintoneInfo('username'))
  opts.password = opts.password || netrcProps.password || (await inputKintoneInfo('password', TYPE_PASSWORD))

  opts.app = opts.app || (await inputKintoneInfo('app'))
  console.log()
  // TODO: 「is guest space?(Y/N)」のように問い合わせて、YならguestSpaceIdを入力
  // opts.guestSpaceId = opts.guestSpaceId || await inputKintoneInfo('guestSpaceID')
}

const parseArgumentOptions = () => {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['help', 'preview', 'acl', 'js'],
    string: ['domain', 'username', 'password', 'app', 'guest', 'basic', 'exclude'],
    alias: {
      h: 'help',
      d: 'domain',
      u: 'username',
      p: 'password',
      a: 'app',
      g: 'guest',
      b: 'basic',
      x: 'exclude',
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
    environment: obj.environment,
    domain: obj.domain,
    username: obj.username,
    password: obj.password,
    app: obj.app,
    guestSpaceId: obj.guest,
    pushTarget: obj.pushTarget,
    // TODO: preview|aclオプションを受け付けない場合のエラー処理
    // TODO: ginue diffコマンドを叩くとpreviewと運用環境との差分を表示したい（diffコマンドへのエイリアス？）
    preview: obj.preview,
    acl: obj.acl,
    exclude: obj.exclude,
    js: obj.js,
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

const createAppDic = app => {
  if (typeof app === 'string') {
    app = app.split(',').map(str => str.trim())
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

  if ((!argv.type && !argv.help) || (argv.type && !['pull', 'push', 'reset', 'deploy'].includes(argv.type))) {
    usageExit(1)
  }
  if (argv.help) {
    usageExit(0, argv.type)
  }

  const ginuerc = await loadGinuerc()

  let opts
  if (argv.target) {
    const [target, pushTarget] = argv.target.split(':')

    // push先target(コロンの右側)はginue pushの場合のみ指定可能
    if (pushTarget && argv.type !== 'push') {
      usageExit(1, argv.type)
    }

    const targetGinuercElem = ginuerc.find(g => g.environment === target)
    if (!targetGinuercElem) {
      console.error(`error: environment '${target}' not found.`)
      process.exit(1)
    }
    if (pushTarget) {
      // TODO: コマンドライン引数と組み合わさった場合の各種パターンを要テスト
      const pushTargetGinuercElem = ginuerc.find(g => g.environment === pushTarget)
      if (!pushTargetGinuercElem) {
        console.error(`error: environment '${pushTarget}' not found.`)
        process.exit(1)
      }
      if (Array.isArray(pushTargetGinuercElem.app) || Array.isArray(targetGinuercElem.app)) {
        console.error(`error: 'app' should be Object if 'ginue push <env>:<env>' is specified.`)
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
    // argvにオプションがある場合は、ginuercを無視してargvのオプションだけ使う
    // argvには1種類の環境しか指定できず、ginuercの一部だけ使うことが難しいため
    opts = pluckOpts(argv)
  } else if (['push', 'reset', 'deploy'].includes(argv.type)) {
    // これらは単一環境のみを対象にするため、ここまでの条件に合致しなければエラー
    // 複数環境への一括pushも技術的には難しくないけど、ヒューマンエラー防止のため非対応
    console.error('error: <target environment> is required if .ginuerc has multiple environments.')
    usageExit(1, argv.type)
  } else {
    // argvにオプションがなければ、ginuercの複数環境を全て使用
    opts = ginuerc.map(g => pluckOpts(g))
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
    opts.preview = argv.preview
    opts.exclude = argv.exclude
    opts.js = argv.js
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

const loadKintoneInfo = async filePath => {
  const extension = path.extname(filePath)
  let kintoneInfo
  switch (extension) {
    case '.json':
      kintoneInfo = await loadJsonFile(filePath, '.').catch(e => {})
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
    kintoneInfo = trim(`
// Generated by ginue
module.exports = ${kintoneInfo}
`)
  }
  fs.writeFileSync(filePath, kintoneInfo)
}

const createPutHeaders = ktn => {
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

const ginuePush = async (ktn, opts, pushTarget) => {
  // TODO: push対象アプリ名をコマンドライン引数で絞り込めるように(オプション名は-aか、他か)
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
  const filePath = createFilePath(ktn, opts)
  console.log(filePath)
  const kintoneInfo = await loadKintoneInfo(filePath)
  ktn.command = `preview/${ktn.command}`

  if (pushTarget) {
    // TODO: fields.jsonにルックアップフィールドが混じる場合は参照先アプリIDを自動変更したい
    for (const key of ['domain', 'guestSpaceId', 'base64Basic', 'base64Account', 'appId']) {
      ktn[key] = pushTarget[key]
    }
  }

  kintoneInfo.app = ktn.appId
  await sendKintoneInfo('PUT', ktn, kintoneInfo)
}

const abstractGinueDeploy = async (ktn, opts, isReset) => {
  ktn.command = 'preview/app/deploy.json'
  const resetReqBody = {
    apps: Object.values(opts.apps).map(appId => ({ app: appId })),
    revert: isReset,
  }
  await sendKintoneInfo('POST', ktn, resetReqBody)
  // TODO: 反映状況を確認して終わるまで待機する機能をつけても良いかも
}
const ginueReset = async (ktn, opts) => abstractGinueDeploy(ktn, opts, true)
const ginueDeploy = async (ktn, opts) => abstractGinueDeploy(ktn, opts, false)

const ginuePull = async (ktn, opts) => {
  if (!ktn.methods.includes('GET')) {
    return
  }
  const [kintoneInfo, kintoneRevision, kintoneInfoAlt] = await fetchKintoneInfo(ktn)
  const filePath = createFilePath(ktn, opts)
  console.log(filePath)
  saveKintoneInfo(filePath, kintoneInfo)
  if (kintoneRevision) {
    // TODO: 無駄に何回も上書保存するので、フラグを持たせて1回だけにしたい
    const revisionFilePath = createFilePath(ktn, opts, 'revision.json')
    saveKintoneInfo(revisionFilePath, kintoneRevision)
  }
  if (kintoneInfoAlt) {
    const altFilePath = filePath.replace('.js', '-mask.js') // (.json|.js) どっちにも対応するhack。。。
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
