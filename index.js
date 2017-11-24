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

const loadKintoneCommands = () => {
  let file
  let obj = {}
  try {
    file = fs.readFileSync(path.join(__dirname, 'commands.json'), 'utf8')
  } catch (e) {
    console.error('ERROR: commands.json not found!')
    process.exit(1)
  }

  try {
    obj = JSON.parse(file)
  } catch (e) {
    console.error('ERROR: Invalid commands.json!')
    process.exit(1)
  }
  return obj
}

const loadGinuerc = () => {
  let file
  let obj = {}
  try {
    file = fs.readFileSync('./.ginuerc.json', 'utf8')
  } catch (e) {
    console.error('NOTE: .ginuerc.json is not found.')
    return obj
  }

  try {
    obj = JSON.parse(file)
  } catch (e) {
    console.error('ERROR: Invalid .ginuerc.json!')
    process.exit(1)
  }
  return obj
}

const createDirPath = (appId) => {
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

const parseArgumentOptions = (opts) => {
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

  // TODO: もっとスマートに書けないものか・・・
  if (argv._[0]) { opts.type = argv._[0] }
  if (argv.domain) { opts.subDomain = argv.domain }
  if (argv.username) { opts.username = argv.username }
  if (argv.password) { opts.password = argv.password }
  if (argv.app) { opts.appId = argv.app }
  if (argv.guest) { opts.guestSpaceId = argv.guest }
}

const createOptionValues = async () => {
  const opts = loadGinuerc()
  parseArgumentOptions(opts)
  await stdInputOptions(opts)
  opts.appIds = (opts.appId instanceof Array) ? opts.appId : opts.appId.split(' ')

  return opts
}

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

const main = async () => {
  const {
    type,
    subDomain,
    username,
    password,
    appIds,
    guestSpaceId,
  } = await createOptionValues()

  if (type !== 'pull') {
    usageExit(1)
  }

  const base64Account = await createBase64Account(username, password)

  appIds.forEach(appId => {
    mkdirp.sync(createDirPath(appId))

    const kintoneCommands = loadKintoneCommands()
    for (const [commName, commProp] of Object.entries(kintoneCommands)) {
      const commands = commProp.hasPreview ? [`preview/${commName}`, commName] : [commName]
      commands.forEach(async command => {
        const ktn = {
          subDomain,
          base64Account,
          appId,
          guestSpaceId,
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
