#!/usr/bin/env node
'use strict'

const fs = require('mz/fs')
const mkdirp = require('mkdirp')
const request = require('request-promise')

const pretty = (obj) => JSON.stringify(obj, null, '  ')

const loadKintoneCommands = async () => {
  const file = await fs.readFile('./commands.conf', 'utf8')
  return file.replace(/\n+$/, '').split('\n')
}

const createDirPath = (appId) => {
  return `tmp/kintone_jsons/${appId}`
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

(async () => {
  const argv = process.argv.slice(2)
  const [type, subDomain, appId, base64Account] = argv

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
