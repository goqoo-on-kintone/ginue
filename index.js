#!/usr/bin/env node
'use strict'

const request = require('request')

const argv = process.argv.slice(2)
const url = argv[0]
const base64account = argv[1]
const headers = {
  'X-Cybozu-Authorization': base64account
}
const options = { url, headers }
request.get(options, (error, res, body) => {
  if (error) {
    console.error(error)
    return
  }
  console.log(body)
})
