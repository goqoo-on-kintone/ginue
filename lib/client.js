'use strict'

const {
  KintoneRequestConfigBuilder,
} = require('../node_modules/@kintone/rest-api-client/lib/KintoneRequestConfigBuilder')
const { KintoneResponseHandler } = require('../node_modules/@kintone/rest-api-client/lib/KintoneResponseHandler')
const { DefaultHttpClient } = require('../node_modules/@kintone/rest-api-client/lib/http')
const { injectPlatformDeps } = require('../node_modules/@kintone/rest-api-client/lib/platform')
injectPlatformDeps(require('../node_modules/@kintone/rest-api-client/lib/platform/node'))
const https = require('https')
const fs = require('fs')

const createPath = (ktn) => {
  const basePath = ktn.guestSpaceId ? `k/guest/${ktn.guestSpaceId}/v1` : 'k/v1'
  return `/${basePath}/${ktn.command}`
}

const createGetPath = (ktn) => {
  const command = ktn.preview ? `preview/${ktn.command}` : ktn.command
  return createPath({ ...ktn, command })
}

const createHttpClient = (ktn) => {
  const requestConfigBuilder = new KintoneRequestConfigBuilder({
    baseUrl: `https://${ktn.domain}`,
    auth: {
      type: 'password',
      ...ktn.passwordAuth,
    },
  })
  const responseHandler = new KintoneResponseHandler({
    enableAbortSearchError: false,
  })
  const client = new DefaultHttpClient({
    responseHandler,
    requestConfigBuilder,
  })
  return client
}

const createArgent = (ktn) => {
  if (!ktn.pfxFilepath || !ktn.pfxPassword) {
    return
  }

  return new https.Agent({
    pfx: fs.readFileSync(ktn.pfxFilepath),
    passphrase: ktn.pfxPassword,
  })
}

const fetchKintoneInfo = async (ktn) => {
  const client = createHttpClient(ktn)
  const response = await client.get(createGetPath(ktn), { [ktn.appParam]: ktn.appId })
  return response
}

const sendKintoneInfo = async (method, ktn, kintoneInfo) => {
  const client = createHttpClient(ktn)
  const response = await client[method.toLowerCase()](createPath(ktn), kintoneInfo)
  return response
}

const downloadFile = async (ktn, fileKey) => {
  const client = createHttpClient(ktn)
  const response = await client.get('/k/v1/file.json', { fileKey })
  return response
}

module.exports = {
  fetchKintoneInfo,
  sendKintoneInfo,
  downloadFile,
}
