import fetch, { Response } from 'node-fetch'
import { createAgent as _createAgent } from './agent'
import type { Ktn } from './types'

const createAgent = (ktn: Ktn) =>
  _createAgent({ proxy: ktn.proxy, pfx: { filepath: ktn.pfxFilepath!, password: ktn.pfxPassword! } })

export const createUrl = (ktn: Ktn) => {
  const basePath = ktn.guestSpaceId ? `k/guest/${ktn.guestSpaceId}/v1` : 'k/v1'
  return `https://${ktn.domain}/${basePath}/${ktn.command}`
}

export const createGetUrl = (ktn: Ktn) => {
  // TODO: 保存ファイル名に影響を与えないための処理だけどイマイチ。今後直す。
  ktn = Object.assign({}, ktn)
  if (ktn.preview) {
    ktn.command = `preview/${ktn.command}`
  }
  const baseUrl = createUrl(ktn)
  return `${baseUrl}?${ktn.appParam}=${ktn.appId}`
}
export const createHeaders = (ktn: Ktn) => {
  let header: Record<string, any>
  if (ktn.accessToken) {
    header = {
      Authorization: `Bearer ${ktn.accessToken}`,
    }
  } else {
    header = {
      'X-Cybozu-Authorization': ktn.base64Account,
      'Authorization': `Basic ${ktn.base64Basic}`,
    }
  }

  // デバッグ時はここのlangをja|en|zhで切り替えて各言語テスト
  // ktn.lang = 'en'
  if (ktn.lang) {
    header['Accept-Language'] = ktn.lang
  }
  return header
}

const formatFetchError = async (response: Response) => {
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

export const fetchKintoneInfo = async (ktn: Ktn) => {
  const response = await fetch(createGetUrl(ktn), { headers: createHeaders(ktn), agent: createAgent(ktn) })
  if (response.ok) {
    return response.json()
  } else {
    throw new Error(await formatFetchError(response))
  }
}

export const sendKintoneInfo = async (method: string, ktn: Ktn, kintoneInfo: any) => {
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

export const downloadFile = async (ktn: Ktn, fileKey: string) => {
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
