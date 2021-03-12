#!/usr/bin/env node
'use strict'

const { inspect } = require('util')
const { createBase64Account } = require('./lib/util')
const { createOptionValues, loadKintoneCommands } = require('./lib/config')
const { ginuePull } = require('./lib/pull')
const { ginuePush } = require('./lib/push')
const { ginueDeploy, ginueReset } = require('./lib/deploy')
const { ginueErd } = require('./lib/erd')

const main = async () => {
  const allOpts = await createOptionValues()
  // 環境単位ループ
  allOpts.forEach(async (opts) => {
    try {
      const base64Basic = await createBase64Account(opts.basic)
      const base64Account = await createBase64Account(opts.username, opts.password)

      if (['reset', 'deploy'].includes(opts.type)) {
        const ktn = {
          proxy: opts.proxy,
          domain: opts.domain,
          guestSpaceId: opts.guestSpaceId,
          base64Account,
          base64Basic,
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

      const pushTargetKtn = opts.pushTarget && {
        domain: opts.pushTarget.domain,
        guestSpaceId: opts.pushTarget.guestSpaceId,
        base64Basic: await createBase64Account(opts.pushTarget.basic),
        base64Account: await createBase64Account(opts.pushTarget.username, opts.pushTarget.password),
        pfxFilepath: opts.pushTarget.pfxFilepath,
        pfxPassword: opts.pushTarget.pfxPassword,
      }

      // TODO: スペース単位ループを可能にする(スペース内全アプリをpull)
      // アプリ単位ループ
      for (const [appName, appId] of Object.entries(opts.apps)) {
        if (opts.appName && opts.appName !== appName) {
          continue
        }
        const environment = opts.pushTarget ? opts.pushTarget.environment : opts.environment
        const target = `----------${environment}/${appName}----------`
        console.log(target)

        const kintoneCommands = await loadKintoneCommands({ commands: opts.commands, exclude: opts.exclude })
        const requestPromises = []
        // APIコマンド単位ループ
        for (const [commName, commProp] of Object.entries(kintoneCommands)) {
          const preview = Boolean(commProp.hasPreview && opts.preview)
          const ktn = {
            proxy: opts.proxy,
            domain: opts.domain,
            guestSpaceId: opts.guestSpaceId,
            base64Account,
            base64Basic,
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
                console.log(`[SKIP] ${commName}`)
                break
              }
              if (commName === 'field/acl.json' && !opts.field_acl) {
                console.log(`[SKIP] ${commName}`)
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
      } catch (e) {
      } finally {
        console.error(error)
      }
    }
  })
}

main()
