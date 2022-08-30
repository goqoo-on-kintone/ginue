import ProxyAgent from 'proxy-agent'
import https from 'https'
import fs from 'fs'
import type { ProxyOption } from './types'

// @ts-expect-error
const createProxyAgent = (proxy?: ProxyOption) => (proxy ? new ProxyAgent(proxy) : undefined)
const createPfxAgent = (pfxFilepath?: string, pfxPassword?: string) =>
  pfxFilepath && pfxPassword
    ? new https.Agent({
        pfx: fs.readFileSync(pfxFilepath),
        passphrase: pfxPassword,
      })
    : undefined

export const createAgent = (proxy?: ProxyOption, pfxFilepath?: string, pfxPassword?: string) => {
  const proxyAgent = createProxyAgent(proxy)
  const pfxAgent = createPfxAgent(pfxFilepath, pfxPassword)

  if (proxyAgent && pfxAgent) {
    throw new Error('Proxy server and client certificate cannot be used at the same time.')
  }

  return proxyAgent ?? pfxAgent
}
