#!/usr/bin/env node
'use strict'

const rp = require('request-promise')

const pretty = (obj) => JSON.stringify(obj, null, '    ')

const main = async () => {
  const argv = process.argv.slice(2)
  const url = argv[0]
  const base64account = argv[1]
  const headers = {
    'X-Cybozu-Authorization': base64account
  }
  const options = { url, headers, json: true }
  try {
    const resp = await rp(options)
    console.log(pretty(resp))
  } catch (error) {
    console.error(error)
  }
}
main()
