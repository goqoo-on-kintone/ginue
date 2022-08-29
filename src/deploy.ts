import { sendKintoneInfo } from './client'
import { Opts, Ktn } from './types'

const abstractGinueDeploy = async (ktn: Ktn, opts: Opts, isReset: boolean) => {
  ktn.command = 'preview/app/deploy.json'
  const requestBody = {
    apps: Object.entries(opts.apps!)
      .filter(([appName, appId]) => !opts.appName || appName === opts.appName)
      .map(([appName, appId]) => ({ app: appId })),
    revert: isReset,
  }
  await sendKintoneInfo('POST', ktn, requestBody)
  // TODO: 反映状況を確認して終わるまで待機する機能をつけても良いかも
}
export const ginueReset = async (ktn: Ktn, opts: Opts) => abstractGinueDeploy(ktn, opts, true)
export const ginueDeploy = async (ktn: Ktn, opts: Opts) => abstractGinueDeploy(ktn, opts, false)
