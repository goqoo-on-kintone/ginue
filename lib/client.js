'use strict'

const fetch = require('node-fetch')
const ProxyAgent = require('proxy-agent')
const https = require('https')
const fs = require('fs')

const createUrl = (ktn) => {
  const basePath = ktn.guestSpaceId ? `k/guest/${ktn.guestSpaceId}/v1` : 'k/v1'
  return `https://${ktn.domain}/${basePath}/${ktn.command}`
}

const createGetUrl = (ktn) => {
  // TODO: 保存ファイル名に影響を与えないための処理だけどイマイチ。今後直す。
  ktn = Object.assign({}, ktn)
  if (ktn.preview) {
    ktn.command = `preview/${ktn.command}`
  }
  const baseUrl = createUrl(ktn)
  return `${baseUrl}?${ktn.appParam}=${ktn.appId}`
}
const createHeaders = (ktn) => {
  const header = {
    'X-Cybozu-Authorization': ktn.base64Account,
    'Authorization': `Basic ${ktn.base64Basic}`,
  }
  // デバッグ時はここのlangをja|en|zhで切り替えて各言語テスト
  // ktn.lang = 'en'
  if (ktn.lang) {
    header['Accept-Language'] = ktn.lang
  }
  return header
}

const createProxyAgent = (ktn) => (ktn.proxy ? new ProxyAgent(ktn.proxy) : undefined)
const createPfxAgent = (ktn) =>
  ktn.pfxFilepath && ktn.pfxPassword
    ? new https.Agent({
        pfx: fs.readFileSync(ktn.pfxFilepath),
        passphrase: ktn.pfxPassword,
      })
    : undefined

const createAgent = (ktn) => {
  const proxyAgent = createProxyAgent(ktn)
  const pfxAgent = createPfxAgent(ktn)

  if (proxyAgent && pfxAgent) {
    throw new Error('Proxy server and client certificate cannot be used at the same time.')
  }

  return proxyAgent ?? pfxAgent
}

const formatFetchError = async (response) => {
  const { status, statusText, type, url } = response
  const bodyText = await response.text()
  let body
  try {
    body = JSON.parse(bodyText)
  } catch (e) {
    body = { text: bodyText }
  }
  return JSON.stringify({ status, statusText, type, url, body })
}

const fetchKintoneInfo = async (ktn) => {
  const response = await fetch(createGetUrl(ktn), { headers: createHeaders(ktn), agent: createAgent(ktn) })
  if (response.ok) {
    return response.json()
  } else {
    throw new Error(await formatFetchError(response))
  }
}

const sendKintoneInfo = async (method, ktn, kintoneInfo) => {
  const response = await fetch(createUrl(ktn), {
    method,
    headers: { ...createHeaders(ktn), 'Content-Type': 'application/json' },
    body: JSON.stringify(kintoneInfo),
    agent: createAgent(ktn),
  })
  if (response.ok) {
    return response.json()
  } else {
    throw new Error(await formatFetchError(response))
  }
}

const downloadFile = async (ktn, fileKey) => {
  const response = await fetch(`https://${ktn.domain}/k/v1/file.json?fileKey=${fileKey}`, {
    headers: createHeaders(ktn),
    agent: createAgent(ktn),
  })
  if (response.ok) {
    return response.text()
  } else {
    throw new Error(await formatFetchError(response))
  }
}

module.exports = {
  createUrl,
  createGetUrl,
  createHeaders,
  fetchKintoneInfo,
  sendKintoneInfo,
  downloadFile,
}
