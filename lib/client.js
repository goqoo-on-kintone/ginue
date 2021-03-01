'use strict'

const axios = require('axios')

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
  const res = await axios.get(createGetUrl(ktn), { headers: createHeaders(ktn) })
  return res.data
}

const sendKintoneInfo = async (method, ktn, kintoneInfo) => {
  const res = await axios({
    method: method,
    url: createUrl(ktn),
    headers: createHeaders(ktn),
    data: kintoneInfo,
  })
  return res
}

const downloadFile = async (ktn, fileKey) => {
  const res = await axios.get(`https://${ktn.domain}/k/v1/file.json?fileKey=${fileKey}`, {
    headers: createHeaders(ktn),
  })
  return res.data
}

module.exports = {
  createUrl,
  createGetUrl,
  createHeaders,
  fetchKintoneInfo,
  sendKintoneInfo,
  downloadFile,
}
