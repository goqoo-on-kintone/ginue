const gyuma = require('gyuma')

exports.getOauthToken = async (domain) => {
  const scope = 'k:app_settings:read k:app_settings:write'
  const token = await gyuma({ domain, scope }, true)
  return token
}
