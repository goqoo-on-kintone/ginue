import ProxyAgent from 'proxy-agent'
import https from 'https'
import fs from 'fs'
import type { Ktn } from './types'

// @ts-expect-error
const createProxyAgent = (ktn: Ktn) => (ktn.proxy ? new ProxyAgent(ktn.proxy) : undefined)
const createPfxAgent = (ktn: Ktn) =>
  ktn.pfxFilepath && ktn.pfxPassword
    ? new https.Agent({
        pfx: fs.readFileSync(ktn.pfxFilepath),
        passphrase: ktn.pfxPassword,
      })
    : undefined

export const createAgent = (ktn: Ktn) => {
  const proxyAgent = createProxyAgent(ktn)
  const pfxAgent = createPfxAgent(ktn)

  if (proxyAgent && pfxAgent) {
    throw new Error('Proxy server and client certificate cannot be used at the same time.')
  }

  return proxyAgent ?? pfxAgent
}
