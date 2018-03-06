#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const promisify = require('util').promisify
const inquirer = require('inquirer')
const minimist = require('minimist')
const mkdirp = require('mkdirp')
const request = require('request-promise')

const pretty = obj => JSON.stringify(obj, null, '  ')
const prettyln = obj => pretty(obj) + '\n'
const trim = str => str.replace(/^\n|\n$/g, '')

// TODO: -vと-hは早く実装する！
const usageExit = (returnCode = 0) => {
  const message = trim(`
usage: ginue [-v, --version] [-h, --help]
             pull [<OPTIONS>]
             push [<OPTIONS>]

OPTIONS:
  -d, --domain=<DOMAIN>         kintone sub domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
`)
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
  const ginuerc = await loadJsonFile('.ginuerc.json', '.').catch((e) => {})
  return Array.isArray(ginuerc) ? ginuerc : [ginuerc]
}

const createDirPath = (appName, opts) => {
  let envPath = ''
  if (opts && opts.environment) {
    envPath = `${opts.environment}/`
  }
  return `${envPath}${appName}`
}

const createFilePath = (ktn, opts) => {
  const dirPath = createDirPath(ktn.appName, opts)
  const fileName = `${ktn.command.replace(/\//g, '_')}`
  return `${dirPath}/${fileName}`
}

const createUrl = (ktn) => {
  const basePath = ktn.guestSpaceId ? `k/guest/${ktn.guestSpaceId}/v1` : 'k/v1'
  return `https://${ktn.domain}/${basePath}/${ktn.command}`
}

const createGetUrl = (ktn) => {
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
  const kintoneInfo = await request(options)
  if (ktn.skipRevision) {
    delete kintoneInfo.revision
  }
  return prettyln(kintoneInfo)
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
      }
      console.log(`${optName}: ${dispValue}`)
    }
  }
  const TYPE_PASSWORD = 'password'
  opts.domain = opts.domain || await inputKintoneInfo('domain')
  if (opts.basic_user) {
    // Basic認証のパスワードが省略された時だけ標準入力で問い合わせ
    // そもそもbasicオプションが指定されなかった場合は無視
    const basicPassword = await inputKintoneInfo('Basic Authentication password', TYPE_PASSWORD)
    opts.basic = `${opts.basic_user}:${basicPassword}`
  }
  opts.username = opts.username || await inputKintoneInfo('username')
  opts.password = opts.password || await inputKintoneInfo('password', TYPE_PASSWORD)
  opts.app = opts.app || await inputKintoneInfo('app')
  console.log()
  // TODO: 「is guest space?(Y/N)」のように問い合わせて、YならguestSpaceIdを入力
  // opts.guestSpaceId = opts.guestSpaceId || await inputKintoneInfo('guestSpaceID')
}

const parseArgumentOptions = () => {
  const argv = minimist(process.argv.slice(2), {
    string: [
      'domain',
      'username',
      'password',
      'app',
      'guest',
      'basic',
    ],
    alias: {
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
  if (!['pull', 'push'].includes(argv.type)) {
    usageExit(1)
  }

  const ginuerc = await loadGinuerc()

  let allOpts
  if (ginuerc.length === 1) {
    // ginuercに単一環境だけ指定されている場合は、
    // argvを優先し、argvに存在しないオプションだけginuercを使う
    allOpts = [pluckOpts(argv, ginuerc[0])]
  } else if (argv.priority) {
    // argvにオプションがある場合は、ginuercを無視してargvのオプションだけ使う
    // argvには1種類の環境しか指定できず、ginuercの一部だけ使うことが難しいため
    allOpts = [pluckOpts(argv)]
  } else {
    // argvにオプションがなければ、ginuercの複数環境を全て使用
    allOpts = ginuerc.map(g => pluckOpts(g))
  }

  for (const opts of allOpts) {
    await stdInputOptions(opts)
    opts.apps = createAppDic(opts.app)
    opts.type = argv.type
  }
  return allOpts
}

const loadKintoneJson = async (filePath, appId) => {
  const kintoneJson = await loadJsonFile(filePath, '.').catch((e) => { })
  kintoneJson.app = appId
  return kintoneJson
}

const createPutHeaders = (ktn) => {
  const headers = createHeaders(ktn)
  // TODO: do something
  return headers
}

// TODO: このメソッドでPUTリクエストを送信
const sendKintoneInfo = async (ktn, kintoneJson) => {
  const options = {
    method: 'PUT',
    url: createUrl(ktn),
    headers: createPutHeaders(ktn),
    body: kintoneJson,
    json: true,
  }
  const kintoneInfo = await request(options)
  if (ktn.skipRevision) {
    delete kintoneInfo.revision
  }
  return prettyln(kintoneInfo)
}

const ginuePush = async (ktn, opts) => {
  if (ktn.command !== 'app/form/fields.json') {
    return
  }
  const filePath = createFilePath(ktn, opts)
  const kintoneJson = await loadKintoneJson(filePath, ktn.appId)
  ktn.command = 'preview/app/form/fields.json'
  console.log('Exec push!', ktn.appId, ktn.command, filePath)
  await sendKintoneInfo(ktn, kintoneJson)
}

const ginuePull = async (ktn, opts) => {
  const kintoneInfo = await fetchKintoneInfo(ktn)
  const filePath = createFilePath(ktn, opts)
  console.log(filePath)
  fs.writeFileSync(filePath, kintoneInfo)
}

const main = async () => {
  const allOpts = await createOptionValues()
  allOpts.forEach(async opts => {
    const base64Basic = await createBase64Account(opts.basic)
    const base64Account = await createBase64Account(opts.username, opts.password)
    // TODO: スペース単位ループを可能にする(スペース内全アプリをpull)
    // アプリ単位ループ
    for (const [appName, appId] of Object.entries(opts.apps)) {
      mkdirp.sync(createDirPath(appName, opts))
      const kintoneCommands = await loadKintoneCommands()
      // APIコマンド単位ループ
      for (const [commName, commProp] of Object.entries(kintoneCommands)) {
        const commands = [commName]
        if (commProp.hasPreview) {
          commands.push(`preview/${commName}`)
        }
        // 運用環境・テスト環境単位ループ
        commands.forEach(async command => {
          const ktn = {
            domain: opts.domain,
            guestSpaceId: opts.guestSpaceId,
            base64Account,
            base64Basic,
            appName,
            appId,
            command,
            appParam: commProp.appParam,
            skipRevision: commProp.skipRevision,
          }
          try {
            switch (opts.type) {
              case 'pull':
                await ginuePull(ktn, opts)
                break
              case 'push':
                await ginuePush(ktn, opts)
                break
            }
          } catch (error) {
            console.error(error)
          }
        })
      }
    }
  })
}

main()
