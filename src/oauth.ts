// @ts-expect-error
import gyuma from 'gyuma'

export const getOauthToken = async (domain: string) => {
  const scope = 'k:app_settings:read k:app_settings:write'
  const token = await gyuma({ domain, scope }, true)
  return token
}
