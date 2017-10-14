#!/usr/bin/env node
'use strict'

const fs = require('mz/fs')
const mkdirp = require('mkdirp')
const rp = require('request-promise')

const pretty = (obj) => JSON.stringify(obj, null, '  ')

const loadKintoneCommands = async () => {
  const file = await fs.readFile('./commands.conf', 'utf8')
  return file.replace(/\n$/, '').split('\n')
}

const createUrl = (kSubDomain, kCommand, kAppId) => {
  return `https://${kSubDomain}.cybozu.com/k/v1/${kCommand}?app=${kAppId}`
}

const createDirPath = (kAppId) => {
  return `tmp/kintone_jsons/${kAppId}`
}

const createFilePath = (kCommand, kAppId) => {
  const dirPath = createDirPath(kAppId)
  const fileName = `${kCommand.replace(/\//g, '_')}`
  return `${dirPath}/${fileName}`
}

;(async () => {
  const argv = process.argv.slice(2)
  const [type, kSubDomain, kAppId, kBase64Account] = argv

  if (type !== 'pull') {
    return
  }

  mkdirp.sync(createDirPath(kAppId))

  const kCommands = await loadKintoneCommands()
  kCommands.forEach(async (kCommand) => {
    const url = createUrl(kSubDomain, kCommand, kAppId)
    const headers = {
      'X-Cybozu-Authorization': kBase64Account
    }
    const options = { url, headers, json: true }
    try {
      const resp = await rp(options)
      const filename = createFilePath(kCommand, kAppId)
      console.log(filename)
      fs.writeFile(filename, pretty(resp))
    } catch (error) {
      console.error(error)
    }
  })
})()
