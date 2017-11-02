#!/usr/bin/env node
'use strict'

const fs = require('mz/fs')
const mkdirp = require('mkdirp')
const request = require('request-promise')
const inquirer = require('inquirer')
const path = require('path')

const pretty = (obj) => JSON.stringify(obj, null, '  ')

const loadKintoneCommands = async () => {
  const file = await fs.readFile(path.join(__dirname, 'commands.conf'), 'utf8')
  return file.replace(/\n+$/, '').split('\n')
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
  return `https://${ktn.subDomain}.cybozu.com/k/v1/${ktn.command}?app=${ktn.appId}`
}

const createHeaders = (ktn) => {
  return {
    'X-Cybozu-Authorization': ktn.base64Account
  }
}

const fetchKintoneInfo = async (ktn) => {
  const options = {
    url: createUrl(ktn),
    headers: createHeaders(ktn),
    json: true,
  }
  return request(options)
}

const inputKintoneAccount = async (name, type) => {
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

const createBase64Account = async (username, password) => {
  if (!username) {
    ({ username } = await inputKintoneAccount('username', 'input'))
  }
  if (!password) {
    ({ password } = await inputKintoneAccount('password', 'password'))
  }
  const base64Account = Buffer.from(`${username}:${password}`).toString('base64')
  return base64Account
}

(async () => {
  const argv = require('minimist')(process.argv.slice(2))
  const type = argv._[0]
  const {
    d: subDomain,
    a: appId,
    u: username,
    p: password,
  } = argv
  const base64Account = await createBase64Account(username, password)

  if (type !== 'pull') {
    console.error('ERROR: Invalid argument!')
    process.exit(1)
  }

  mkdirp.sync(createDirPath(appId))

  const kintoneCommands = await loadKintoneCommands()
  kintoneCommands.forEach(async (command) => {
    const ktn = {
      subDomain,
      appId,
      base64Account,
      command,
    }
    try {
      const kintoneInfo = await fetchKintoneInfo(ktn)
      const filePath = createFilePath(ktn)
      console.log(filePath)
      fs.writeFile(filePath, pretty(kintoneInfo))
    } catch (error) {
      console.error(error)
    }
  })
})()
