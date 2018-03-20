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
usage: ginue reset [<target environment> [<options>]

  -h, --help                    output usage information`)
      break
    default:
      message = trim(`
usage: ginue [-v, --version] [-h, --help]
              pull [<options>]
              push [<options>]
              reset [<options>]`)
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

const loadKintoneCommands = async () => {
  // TODO: ローカルにcommands.jsonが存在したらそれを優先して使いたい
  return loadJsonFile('commands.json', __dirname).catch((e) => {
    console.error(`ERROR: commands.json not found!\n`, e.message)
    process.exit(1)
  })
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
    if (dirPath) { dirPath += '-' }
    dirPath += 'preview'
  }
  if (dirPath) { dirPath += '/' }
  return `${dirPath}${ktn.appName}`
}

const createFilePath = (ktn, opts, customFileName) => {
  const dirPath = createDirPath(ktn, opts)
  mkdirp.sync(dirPath)
  const fileName = customFileName || `${ktn.command.replace(/\//g, '_')}`
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
const createHeaders = (ktn) => {
  const header = {
    'X-Cybozu-Authorization': ktn.base64Account,
    'Authorization': `Basic ${ktn.base64Basic}`
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

const fetchKintoneInfo = async (ktn) => {
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

  return [kintoneInfo, kintoneRevision]
}

const inputKintoneInfo = async (name, type = 'input') => {
  const value = await inquirer.prompt([{
    name,
    type,
    message: `Enter your kintone ${name}:`,
    validate: (value) => {
      if (value.length) {
        return true
      } else {
        return `Please enter your ${name}`
      }
    }
  }])
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
  opts.domain = opts.domain || await inputKintoneInfo('domain')
  if (opts.basic_user) {
    // Basic認証のパスワードが省略された時だけ標準入力で問い合わせ
    // そもそもbasicオプションが指定されなかった場合は無視
    const basicPassword = await inputKintoneInfo('Basic Authentication password', TYPE_PASSWORD)
    opts.basic = `${opts.basic_user}:${basicPassword}`
  }

  const netrcProps = netrc.machines[opts.domain] || {}
  opts.username = opts.username || netrcProps.login || await inputKintoneInfo('username')
  opts.password = opts.password || netrcProps.password || await inputKintoneInfo('password', TYPE_PASSWORD)

  opts.app = opts.app || await inputKintoneInfo('app')
  console.log()
  // TODO: 「is guest space?(Y/N)」のように問い合わせて、YならguestSpaceIdを入力
  // opts.guestSpaceId = opts.guestSpaceId || await inputKintoneInfo('guestSpaceID')
}

const parseArgumentOptions = () => {
  const argv = minimist(process.argv.slice(2), {
    boolean: [
      'help',
      'preview',
      'acl',
    ],
    string: [
      'domain',
      'username',
      'password',
      'app',
      'guest',
      'basic',
    ],
    alias: {
      h: 'help',
      d: 'domain',
      u: 'username',
      p: 'password',
      a: 'app',
      g: 'guest',
      b: 'basic',
    }
  })
  if (argv.domain || argv.username || argv.password || argv.app || argv.guest) {
    argv.priority = true
  }

  if (argv._[0]) { argv.type = argv._[0] }
  if (argv._[1]) { argv.target = argv._[1] }

  return argv
}

// 引数や設定ファイルの組み合わせからオプション値を抽出
// firstObjを優先し、firstObjに存在しないプロパティはsecondObjを使用
const pluckOpts = (firstObj, secondObj) => {
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

  if (
    (!argv.type && !argv.help) ||
    (argv.type && !['pull', 'push', 'reset'].includes(argv.type))
  ) {
    usageExit(1)
  }
  if (argv.help) {
    usageExit(0, argv.type)
  }

  const ginuerc = await loadGinuerc()

  let allOpts
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
    allOpts = [pluckOpts(argv, targetGinuercElem)]
  } else if (ginuerc.length === 1) {
    // ginuercに単一環境だけ指定されている場合は、
    // argvを優先し、argvに存在しないオプションだけginuercを使う
    allOpts = [pluckOpts(argv, ginuerc[0])]
  } else if (argv.priority) {
    // argvにオプションがある場合は、ginuercを無視してargvのオプションだけ使う
    // argvには1種類の環境しか指定できず、ginuercの一部だけ使うことが難しいため
    allOpts = [pluckOpts(argv)]
  } else if (['push', 'reset'].includes(argv.type)) {
    // push|resetは単一環境のみを対象にするため、ここまでの条件に合致しなければエラー
    // 複数環境への一括pushも技術的には難しくないけど、ヒューマンエラー防止のため非対応
    console.error('error: <target environment> is required if .ginuerc has multiple environments.')
    usageExit(1, argv.type)
  } else {
    // argvにオプションがなければ、ginuercの複数環境を全て使用
    allOpts = ginuerc.map(g => pluckOpts(g))
  }

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
  }

  if (['push', 'reset'].includes(argv.type)) {
    const { isConfirmed } = await inquirer.prompt([{
      name: 'isConfirmed',
      type: 'confirm',
      message: `[${argv.type}] Are you sure?`,
    }])
    if (!isConfirmed) {
      process.exit(0)
    }
  }

  return allOpts
}

const loadKintoneJson = async (filePath) => {
  const kintoneJson = await loadJsonFile(filePath, '.').catch((e) => { })
  return kintoneJson
}

const createPutHeaders = (ktn) => {
  const headers = createHeaders(ktn)
  // TODO: do something
  return headers
}

const sendKintoneInfo = async (method, ktn, kintoneJson) => {
  const options = {
    method: method,
    url: createUrl(ktn),
    headers: createPutHeaders(ktn),
    body: kintoneJson,
    json: true,
  }
  const kintoneInfo = await request(options)
  return prettyln(kintoneInfo)
}

const ginuePush = async (ktn, opts, pushTarget) => {
  if (!ktn.methods.includes('PUT')) {
    return
  }
  if ([
    'app/customize.json', // TODO: ファイルアップロードが伴うので除外。今後工夫する
  ].includes(ktn.command)) {
    return
  }
  const filePath = createFilePath(ktn, opts)
  console.log(filePath)
  const kintoneJson = await loadKintoneJson(filePath)
  ktn.command = `preview/${ktn.command}`

  if (pushTarget) {
    for (const key of ['domain', 'guestSpaceId', 'base64Basic', 'base64Account', 'appId']) {
      ktn[key] = pushTarget[key]
    }
  }

  kintoneJson.app = ktn.appId
  await sendKintoneInfo('PUT', ktn, kintoneJson)
}

const ginueReset = async (ktn, opts) => {
  ktn.command = 'preview/app/deploy.json'
  const resetReqBody = {
    apps: Object.values(opts.apps).map(appId => ({ app: appId })),
    revert: true
  }
  await sendKintoneInfo('POST', ktn, resetReqBody)
  // TODO: 反映状況を確認して終わるまで待機する機能をつけても良いかも
}

const ginuePull = async (ktn, opts) => {
  if (!ktn.methods.includes('GET')) {
    return
  }
  const [kintoneInfo, kintoneRevision] = await fetchKintoneInfo(ktn)
  const filePath = createFilePath(ktn, opts)
  console.log(filePath)
  fs.writeFileSync(filePath, kintoneInfo)
  if (kintoneRevision) {
    const revisionFilePath = createFilePath(ktn, opts, 'revision.json')
    fs.writeFileSync(revisionFilePath, kintoneRevision)
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
  loadKintoneJson,
  createPutHeaders,
  sendKintoneInfo,
  ginuePush,
  ginuePull,
  ginueReset,
}
