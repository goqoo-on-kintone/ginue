'use strict'

const express = require('express')
const fetch = require('node-fetch')
const qs = require('querystring')
const fs = require('fs')
const https = require('https')
require('dotenv').config()

const PORT = process.env.HTTPS_PORT || 3000
const localhost = `https://localhost:${PORT}`

/* eslint-disable camelcase */
const client_id = process.env.OAUTH2_CLIENT_ID
const client_secret = process.env.OAUTH2_CLIENT_SECRET
const redirect_uri = `${localhost}/oauth2callback`
const state = 'ginue' // TODO: ランダム文字列
const response_type = 'code'
const scope = 'k:app_settings:read k:app_settings:write'
/* eslint-enable camelcase */

const authUri = `https://${process.env.KINTONE_DOMAIN}/oauth2/authorization`
const tokenUri = `https://${process.env.KINTONE_DOMAIN}/oauth2/token`

const app = express()

// 認可要求
app.get('/', (req, res) => {
  const params = qs.stringify({
    client_id,
    redirect_uri,
    state,
    response_type,
    scope,
  })
  res.redirect(302, `${authUri}?${params}`)
})

// アクセストークンの要求・取得
app.get('/oauth2callback', (req, res) => {
  fetch(tokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: qs.stringify({
      client_id,
      client_secret,
      code: req.query.code,
      grant_type: 'authorization_code',
      redirect_uri,
    }),
  })
    .then((res) => res.json())
    .then((json) => {
      const { access_token, refresh_token } = json
      console.log({ access_token, refresh_token })
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.write('Authentication succeeded 🎉' + '</br>')
      res.end('Close the browser and return to the Ginue.')
    })
})

// HTTPSサーバー起動
const options = {
  key: fs.readFileSync(process.env.HTTPS_KEY),
  cert: fs.readFileSync(process.env.HTTPS_CERT),
  passphrase: process.env.HTTPS_PASSPHRASE,
}
const server = https.createServer(options, app)
server.listen(PORT, () => console.log(`listening on ${localhost}`))
