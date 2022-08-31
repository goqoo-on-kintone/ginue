#!/usr/bin/env node

import { inspect } from 'util'
import { createBase64Account } from './util'
import { createOptionValues, loadKintoneCommands } from './config'
import { getOauthToken } from './oauth'
import { ginuePull } from './pull'
import { ginuePush } from './push'
import { ginueDeploy, ginueReset } from './deploy'
import { ginueErd } from './erd'
import { ginueDiff } from './diff'

const main = async () => {
  const allOpts = await createOptionValues()

  if (allOpts[0].type === 'diff') {
    ginueDiff(allOpts)
    return
  }

  // 環境単位ループ
  allOpts.forEach(async (opts) => {
    try {
      const agentOptions = {
        proxy: opts.proxy,
        pfx: { filepath: opts.pfxFilepath, password: opts.pfxPassword },
      }
      let base64Account, base64Basic, accessToken
      if (opts.oauth) {
        accessToken = await getOauthToken(opts.domain, agentOptions)
      } else {
        base64Basic = await createBase64Account(opts.basic)
        base64Account = await createBase64Account(opts.username, opts.password)
      }

      if (['reset', 'deploy'].includes(opts.type)) {
        const ktn = {
          proxy: opts.proxy,
          domain: opts.domain,
          guestSpaceId: opts.guestSpaceId,
          base64Account,
          base64Basic,
          accessToken,
          apps: opts.apps,
          pfxFilepath: opts.pfxFilepath,
          pfxPassword: opts.pfxPassword,
        }
        switch (opts.type) {
          case 'reset':
            await ginueReset(ktn, opts)
            break
          case 'deploy':
            await ginueDeploy(ktn, opts)
            break
        }
        return
      }

      if (opts.type === 'erd') {
        ginueErd(opts)
        return
      }

      let pushTargetKtn
      if (opts.pushTarget) {
        pushTargetKtn = {
          domain: opts.pushTarget.domain,
          guestSpaceId: opts.pushTarget.guestSpaceId,
        }
        if (opts.pushTarget.oauth) {
          pushTargetKtn.accessToken = await getOauthToken(opts.pushTarget.domain, agentOptions)
        } else {
          pushTargetKtn.base64Basic = await createBase64Account(opts.pushTarget.basic)
          pushTargetKtn.base64Account = await createBase64Account(opts.pushTarget.username, opts.pushTarget.password)
          pushTargetKtn.pfxFilepath = opts.pushTarget.pfxFilepath
          pushTargetKtn.pfxPassword = opts.pushTarget.pfxPassword
        }
      }

      // TODO: スペース単位ループを可能にする(スペース内全アプリをpull)
      // アプリ単位ループ
      for (const [appName, appId] of Object.entries(opts.apps)) {
        if (opts.appName && opts.appName !== appName) {
          continue
        }
        const environment = opts.pushTarget ? opts.pushTarget.environment : opts.environment
        const target = `----------${environment}/${appName}----------`
        console.info(target)

        const kintoneCommands = await loadKintoneCommands({ commands: opts.commands, exclude: opts.exclude })
        const requestPromises = []
        // APIコマンド単位ループ
        for (const [commName, commProp] of Object.entries(kintoneCommands)) {
          // OAuthに対応していないコマンドはスキップ
          if (accessToken && commProp.skipOauth) {
            console.info(`[SKIP] ${commName} (Forbidden via OAuth)`)
            continue
          }

          const preview = Boolean(commProp.hasPreview && opts.preview)
          const ktn = {
            proxy: opts.proxy,
            domain: opts.domain,
            guestSpaceId: opts.guestSpaceId,
            base64Account,
            base64Basic,
            accessToken,
            appName,
            appId,
            command: commName,
            appParam: commProp.appParam,
            methods: commProp.methods,
            pfxFilepath: opts.pfxFilepath,
            pfxPassword: opts.pfxPassword,
          }
          switch (opts.type) {
            case 'pull':
              requestPromises.push(ginuePull({ ...ktn, preview }, opts))
              break
            case 'push':
              if (commName.includes('/acl.json') && !opts.acl) {
                console.info(`[SKIP] ${commName}`)
                break
              }
              if (commName === 'field/acl.json' && !opts.field_acl) {
                console.info(`[SKIP] ${commName}`)
                break
              }
              if (pushTargetKtn) {
                pushTargetKtn.appId = opts.pushTarget.app[ktn.appName]
              }
              await ginuePush(ktn, opts, pushTargetKtn)
              break
          }
        }
        await Promise.all(requestPromises)
      }
    } catch (error) {
      try {
        const message = JSON.parse(error.message)
        console.error(inspect(message, { depth: Infinity, colors: true }))
        delete error.message
      } finally {
        console.error(error)
      }
    }
  })
}

main()
