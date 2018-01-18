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
             pull [<optons>]

options:
  -d, --domain=<domain>         kintone sub domain name
  -u, --user=<username>         kintone username
  -p, --password=<password>     kintone password
  -a, --app=<app-id>            kintone app ids
  -g, --guest=<guest-space-id>  kintone guest space id
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
  return `https://${ktn.domain}/${basePath}/${ktn.command}?${ktn.appParam}=${ktn.appId}`
}

// 今後push機能を実装する場合にPOST/PUT向けの複雑なヘッダーを作成するために用意した関数
const createHeaders = (ktn) => {
  return {
    'X-Cybozu-Authorization': ktn.base64Account
  }
}

const createBase64Account = async (username, password) => {
  const base64Account = Buffer.from(`${username}:${password}`).toString('base64')
  return base64Account
}

const fetchKintoneInfo = async (ktn) => {
  const options = {
    url: createUrl(ktn),
    headers: createHeaders(ktn),
    json: true,
  }
  const kintoneInfo = await request(options)
  if (ktn.skipRevision) {
    delete kintoneInfo.revision
  }
  return prettyln(kintoneInfo)
}

const inputKintoneInfo = async (name, type) => {
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
  return value
}

const stdInputOptions = async (opts) => {
  // 標準入力しないオプションを画面表示(複数環境のアカウント情報入力などで間違えないため)
  for (const [optName, optValue] of Object.entries(opts)) {
    if (optValue) {
      // TODO: chalkなど使って色をつけたい
      const dispValue = optName === 'password' ? '[hidden]' : pretty(optValue)
      console.log(`${optName}: ${dispValue}`)
    }
  }

  opts.domain = opts.domain || (await inputKintoneInfo('domain', 'input')).domain
  opts.username = opts.username || (await inputKintoneInfo('username', 'input')).username
  opts.password = opts.password || (await inputKintoneInfo('password', 'password')).password
  opts.app = opts.app || (await inputKintoneInfo('app', 'input')).app
  console.log()
  // TODO: 「is guest space?(Y/N)」のように問い合わせて、YならguestSpaceIdを入力
  // opts.guestSpaceId = opts.guestSpaceId || (await inputKintoneInfo('guestSpaceID', 'input')).guestSpaceID
}

const parseArgumentOptions = () => {
  const argv = minimist(process.argv.slice(2), {
    string: [
      'domain',
      'username',
      'password',
      'app',
      'guest',
    ],
    alias: {
      d: 'domain',
      u: 'username',
      p: 'password',
      a: 'app',
      g: 'guest',
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
  return {
    environment: obj.environment,
    domain: obj.domain,
    username: obj.username,
    password: obj.password,
    app: obj.app,
    guestSpaceId: obj.guest,
  }
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
  if (argv.type !== 'pull') {
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
  }
  return allOpts
}

const main = async () => {
  const allOpts = await createOptionValues()
  allOpts.forEach(async opts => {
    const base64Account = await createBase64Account(opts.username, opts.password)
    // TODO: グループ単位ループを可能にする(グループ内全アプリをpull)
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
            appName,
            appId,
            command,
            appParam: commProp.appParam,
            skipRevision: commProp.skipRevision,
          }
          try {
            const kintoneInfo = await fetchKintoneInfo(ktn)
            const filePath = createFilePath(ktn, opts)
            console.log(filePath)
            fs.writeFileSync(filePath, kintoneInfo)
          } catch (error) {
            console.error(error)
          }
        })
      }
    }
  })
}

main()
