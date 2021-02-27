const { sendKintoneInfo } = require('./util')

const abstractGinueDeploy = async (ktn, opts, isReset) => {
  ktn.command = 'preview/app/deploy.json'
  const requestBody = {
    apps: Object.entries(opts.apps)
      .filter(([appName, appId]) => !opts.appName || appName === opts.appName)
      .map(([appName, appId]) => ({ app: appId })),
    revert: isReset,
  }
  await sendKintoneInfo('POST', ktn, requestBody)
  // TODO: 反映状況を確認して終わるまで待機する機能をつけても良いかも
}
exports.ginueReset = async (ktn, opts) => abstractGinueDeploy(ktn, opts, true)
exports.ginueDeploy = async (ktn, opts) => abstractGinueDeploy(ktn, opts, false)
