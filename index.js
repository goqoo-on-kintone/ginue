#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const promisify = require('util').promisify
const inquirer = require('inquirer')
const minimist = require('minimist')
const mkdirp = require('mkdirp')
const request = require('request-promise')

const pretty = obj => JSON.stringify(obj, null, '  ') + '\n'
const trim = str => str.replace(/^\n|\n$/g, '')

const usageExit = (returnCode = 0) => {
  const message = trim(`
usage: ginue [-v, --version] [-h, --help]
             show <command.json> [<options>]
             pull [<optons>]

options:
  -d, --domain=<domain>         kintone sub domain name
  -u, --user=<username>         kintone username
  -p, --password=<password>     kintone password
  -a, --app=<app-id>            kintone app ids
  -g, --guest=<guest-space-id>  kintone app ids
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

const createDirPath = (appId, opts) => {
  let envPath = ''
  if (opts && opts.environment) {
    envPath = `${opts.environment}/`
  }
  return `${envPath}${appId}`
}

const createFilePath = (ktn, opts) => {
  const dirPath = createDirPath(ktn.appId, opts)
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
  return pretty(kintoneInfo)
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
      const dispValue = optName === 'password' ? '[hidden]' : optValue
      console.log(`${optName}: ${dispValue}`)
    }
  }

  opts.domain = opts.domain || (await inputKintoneInfo('domain', 'input')).domain
  opts.username = opts.username || (await inputKintoneInfo('username', 'input')).username
  opts.password = opts.password || (await inputKintoneInfo('password', 'password')).password
  opts.appId = opts.appId || (await inputKintoneInfo('appID', 'input')).appID
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
    appId: obj.app,
    guestSpaceId: obj.guest,
  }
}

const createAppDic = (appId) => {
  // TODO: .ginuerc.jsonでアプリ名が定義されていればIDではなくアプリ名にする
  // TODO: .ginuerc.jsonでゲストスペースIDが定義されていればゲストスペースから取得する
  // TODO: appがオブジェクトの場合もそうでない場合も以下の形式に整えて、ディレクトリ作成処理など統一する
  // "app": [
  //   {
  //     "name": "order",
  //     "id": 10,
  //     "guest": 5
  //   },
  //   {
  //     "name": "bill",
  //     "id": 11
  //   }
  // ]
  return Array.isArray(appId) ? appId : appId.split(',')
}

const createOptionValues = async () => {
  const argv = parseArgumentOptions()
  if (argv.type !== 'pull') {
    usageExit(1)
  }

  const ginuerc = await loadGinuerc()

  let allOpts
  if (argv.priority) {
    // argvにオプションが指定された場合はginurecよりも優先するが、
    // 条件によりginuercを「無視する」「一部だけ使う」を変化させる
    if (ginuerc.length === 1) {
      // ginuercに単一環境だけ指定されている場合は、
      // argvを優先し、argvに存在しないオプションだけginuercを使う
      allOpts = [pluckOpts(argv, ginuerc[0])]
    } else {
      // ginuercに複数環境が指定されている場合は、ginuercを無視してargvのオプションだけ使う
      // argvには1種類の環境しか指定できず、ginuercの一部だけ使うことが難しいため
      allOpts = [pluckOpts(argv)]
    }
  } else {
    allOpts = ginuerc.map(g => pluckOpts(g))
  }

  for (const opts of allOpts) {
    await stdInputOptions(opts)
    opts.appIds = createAppDic(opts.appId)
  }
  return allOpts
}

const main = async () => {
  const allOpts = await createOptionValues()
  allOpts.forEach(async opts => {
    const base64Account = await createBase64Account(opts.username, opts.password)
    // TODO: グループ単位ループを可能にする(グループ内全アプリをpull)
    // アプリ単位ループ
    opts.appIds.forEach(async appId => {
      mkdirp.sync(createDirPath(appId, opts))
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
    })
  })
}

main()
