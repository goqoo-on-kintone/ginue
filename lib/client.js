'use strict'

const fetch = require('node-fetch-with-proxy')

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

const fetchKintoneInfo = async (ktn) => {
  const res = await fetch(createGetUrl(ktn), { headers: createHeaders(ktn) })
  if (res.ok) {
    return res.json()
  } else {
    throw new Error(await res.text())
  }
}

const sendKintoneInfo = async (method, ktn, kintoneInfo) => {
  const res = await fetch(createUrl(ktn), {
    method,
    headers: { ...createHeaders(ktn), 'Content-Type': 'application/json' },
    body: JSON.stringify(kintoneInfo),
  })
  if (res.ok) {
    return res.json()
  } else {
    throw new Error(await res.text())
  }
}

const downloadFile = async (ktn, fileKey) => {
  const res = await fetch(`https://${ktn.domain}/k/v1/file.json?fileKey=${fileKey}`, {
    headers: createHeaders(ktn),
  })
  if (res.ok) {
    return res.text()
  } else {
    throw new Error(await res.text())
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
