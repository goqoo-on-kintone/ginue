#!/usr/bin/env node
'use strict'

const {
  loadKintoneCommands,
  createBase64Account,
  createOptionValues,
  ginuePush,
  ginuePull,
  ginueReset,
} =
 require('./lib/ginue')

const main = async () => {
  const allOpts = await createOptionValues()
  // 環境単位ループ
  allOpts.forEach(async opts => {
    try {
      const base64Basic = await createBase64Account(opts.basic)
      const base64Account = await createBase64Account(opts.username, opts.password)

      if (opts.type === 'reset') {
        const ktn = {
          domain: opts.domain,
          guestSpaceId: opts.guestSpaceId,
          base64Account,
          base64Basic,
          apps: opts.apps,
        }
        await ginueReset(ktn, opts)
        return
      }

      const pushTargetKtn = opts.pushTarget && {
        domain: opts.pushTarget.domain,
        guestSpaceId: opts.pushTarget.guestSpaceId,
        base64Basic: await createBase64Account(opts.pushTarget.basic),
        base64Account: await createBase64Account(opts.pushTarget.username, opts.pushTarget.password),
      }

      // TODO: スペース単位ループを可能にする(スペース内全アプリをpull)
      // アプリ単位ループ
      for (const [appName, appId] of Object.entries(opts.apps)) {
        const kintoneCommands = await loadKintoneCommands(opts.exclude)
        const requestPromises = []
        // APIコマンド単位ループ
        for (const [commName, commProp] of Object.entries(kintoneCommands)) {
          const preview = Boolean(commProp.hasPreview && opts.preview)
          const ktn = {
            domain: opts.domain,
            guestSpaceId: opts.guestSpaceId,
            base64Account,
            base64Basic,
            appName,
            appId,
            command: commName,
            preview: false,
            appParam: commProp.appParam,
            methods: commProp.methods,
          }
          switch (opts.type) {
            case 'pull':
              requestPromises.push(ginuePull(ktn, opts))
              if (preview) {
                const ktnPreview = Object.assign({}, ktn)
                ktnPreview.preview = true
                requestPromises.push(ginuePull(ktnPreview, opts))
              }
              break
            case 'push':
              if (commName.includes('/acl.json') && !opts.acl) {
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
      console.error(error)
    }
  })
}

main()
