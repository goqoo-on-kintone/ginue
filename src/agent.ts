import ProxyAgent from 'proxy-agent'
import https from 'https'
import fs from 'fs'
import type { AgentOptions, PfxOption, ProxyOption } from './types'

// @ts-expect-error
const createProxyAgent = (proxy?: ProxyOption) => (proxy ? new ProxyAgent(proxy) : undefined)
const createPfxAgent = (pfx?: PfxOption) =>
  pfx && pfx.filepath && pfx.password
    ? new https.Agent({
        pfx: fs.readFileSync(pfx.filepath),
        passphrase: pfx.password,
      })
    : undefined

// 戻り値型をanyにして、proxy-agentの型エクスポート問題を回避
export const createAgent = ({ proxy, pfx }: AgentOptions = {}): any => {
  const proxyAgent = createProxyAgent(proxy)
  const pfxAgent = createPfxAgent(pfx)

  if (proxyAgent && pfxAgent) {
    throw new Error('Proxy server and client certificate cannot be used at the same time.')
  }

  return proxyAgent ?? pfxAgent
}
