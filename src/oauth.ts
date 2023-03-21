import { gyuma } from 'gyuma'
import { AgentOptions } from './types'

export const getOauthToken = async (domain: string, agentOptions: AgentOptions) => {
  const scope = 'k:app_settings:read k:app_settings:write'
  const token = await gyuma({ domain, scope, ...agentOptions }, true)
  return token
}
