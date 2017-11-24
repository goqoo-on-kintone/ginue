#!/usr/bin/env node
'use strict'

const fs = require('fs')
const mkdirp = require('mkdirp')
const request = require('request-promise')
const inquirer = require('inquirer')
const path = require('path')
const minimist = require('minimist')

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

const loadJsonFile = (fileName, dirName, callback) => {
  let file
  try {
    file = fs.readFileSync(path.join(dirName, fileName), 'utf8')
  } catch (e) {
    return callback(e)
  }

  try {
    const obj = JSON.parse(file)
    return obj
  } catch (e) {
    console.error(`ERROR: Invalid ${fileName}!`)
    process.exit(1)
  }
}

const loadKintoneCommands = () => {
  return loadJsonFile('commands.json', __dirname, (e) => {
    console.error(`ERROR: commands.json not found!`, e)
    process.exit(1)
  })
}

const loadGinuerc = () => {
  return loadJsonFile('.ginuerc.json', '.', (e) => {
    console.error('NOTE: .ginuerc.json is not found.')
    return {}
  })
}

const createDirPath = (appId) => {
  // TODO: .ginuerc.jsonでアプリ名が定義されていればIDではなくアプリ名にする
  return `${appId}`
}

const createFilePath = (ktn) => {
  const dirPath = createDirPath(ktn.appId)
  const fileName = `${ktn.command.replace(/\//g, '_')}`
  return `${dirPath}/${fileName}`
}

const createUrl = (ktn) => {
  const basePath = ktn.guestSpaceId ? `k/guest/${ktn.guestSpaceId}/v1` : 'k/v1'
  return `https://${ktn.subDomain}.cybozu.com/${basePath}/${ktn.command}?${ktn.appParam}=${ktn.appId}`
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
  opts.subDomain = opts.subDomain || (await inputKintoneInfo('subdomain', 'input')).subdomain
  opts.username = opts.username || (await inputKintoneInfo('username', 'input')).username
  opts.password = opts.password || (await inputKintoneInfo('password', 'password')).password
  opts.appId = opts.appId || (await inputKintoneInfo('appID', 'input')).appID
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

  if (argv._[0]) { argv.type = argv._[0] }
  return argv
}

const createOptionValues = async () => {
  const argv = parseArgumentOptions()
  if (argv.type !== 'pull') {
    usageExit(1)
  }

  const ginuerc = loadGinuerc()
  const opts = {
    subDomain: argv.domain || ginuerc.domain,
    username: argv.username || ginuerc.username,
    password: argv.password || ginuerc.password,
    appId: argv.app || ginuerc.app,
    guestSpaceId: argv.guest || ginuerc.guest,
  }

  await stdInputOptions(opts)
  opts.appIds = (opts.appId instanceof Array) ? opts.appId : opts.appId.split(' ')

  return opts
}

const main = async () => {
  const opts = await createOptionValues()
  const base64Account = await createBase64Account(opts.username, opts.password)

  // TODO: グループ単位ループを可能にする(グループ内全アプリをpull)
  // アプリ単位ループ
  opts.appIds.forEach(appId => {
    mkdirp.sync(createDirPath(appId))
    const kintoneCommands = loadKintoneCommands()
    // APIコマンド単位ループ
    for (const [commName, commProp] of Object.entries(kintoneCommands)) {
      const commands = [commName]
      if (commProp.hasPreview) {
        commands.push(`preview/${commName}`)
      }
      // 運用環境・テスト環境単位ループ
      commands.forEach(async command => {
        const ktn = {
          subDomain: opts.subDomain,
          guestSpaceId: opts.guestSpaceId,
          base64Account,
          appId,
          command,
          appParam: commProp.appParam,
          skipRevision: commProp.skipRevision,
        }
        try {
          const kintoneInfo = await fetchKintoneInfo(ktn)
          const filePath = createFilePath(ktn)
          console.log(filePath)
          fs.writeFileSync(filePath, kintoneInfo)
        } catch (error) {
          console.error(error)
        }
      })
    }
  })
}

main()
