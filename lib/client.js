const request = require('request-promise')

const createUrl = (ktn) => {
  const basePath = ktn.guestSpaceId ? `k/guest/${ktn.guestSpaceId}/v1` : 'k/v1'
  return `https://${ktn.domain}/${basePath}/${ktn.command}`
}

// 今後push機能を実装する場合にPOST/PUT向けの複雑なヘッダーを作成するために用意した関数
// TODO: push作ったけど複雑にはならないかも。一回見直す
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

const createPutHeaders = (ktn) => {
  const headers = createHeaders(ktn)
  // TODO: do something
  return headers
}

const sendKintoneInfo = async (method, ktn, kintoneInfo) => {
  const options = {
    method: method,
    url: createUrl(ktn),
    headers: createPutHeaders(ktn),
    body: kintoneInfo,
    json: true,
  }
  const resp = await request(options)
  return resp
}

module.exports = {
  createUrl,
  createHeaders,
  sendKintoneInfo,
}
