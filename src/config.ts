'use strict'

import path from 'path'
import inquirer from 'inquirer'
import minimist from 'minimist'
import netrc from 'netrc-parser'
import { rcFile } from 'rc-config-loader'
import { pretty, showVersion, usageExit, loadRequiedFile } from './util'
import type { Opts, Ginuerc, EnvGinuerc } from './types'

const loadKintoneCommands = async ({ commands, exclude }) => {
  const kintoneCommands = commands || loadRequiedFile(path.join(__dirname, 'commands'))
  if (exclude) {
    // TODO: -aオプションの複数指定もこの仕様に合わせた方が良いかも。。
    const excludeCommands = Array.isArray(exclude) ? exclude : [exclude]
    for (const excludeCommand of excludeCommands) {
      if (!kintoneCommands[excludeCommand]) {
        console.error(`ERROR: '${excludeCommand}' no such command!`)
        process.exit(1)
      }
      delete kintoneCommands[excludeCommand]
    }
  }
  return kintoneCommands
}

const loadGinuerc = async (): Promise<EnvGinuerc[]> => {
  const ginuercFile = rcFile<Ginuerc>('ginue')
  if (!ginuercFile) {
    return [{}]
  }
  const ginuerc: Ginuerc = ginuercFile.config

  if (Array.isArray(ginuerc)) {
    console.error(`ERROR: The top-level structure of .ginuerc must not be array. (Since v2.0)`)
    process.exit(1)
  }

  const { env, ...root } = ginuerc
  if (!env) {
    return [root]
  }

  return Object.entries(env).map(([envName, envGinuerc]) => {
    envGinuerc.environment = envName

    // 内側のlocationはプロパティ名を変更しておく
    envGinuerc.envLocation = envGinuerc.location
    envGinuerc.location = root.location

    // location以外のプロパティは(外側 < 内側)の優先度で設定
    ;['fileType', 'preview', 'alt', 'oauth', 'commands', 'downloadJs', 'proxy'].forEach((prop) => {
      if (root[prop] && envGinuerc[prop] === undefined) {
        envGinuerc[prop] = root[prop]
      }
    })

    return envGinuerc
  })
}

const inputKintoneInfo = async (name, type = 'input') => {
  const value = await inquirer.prompt([
    {
      name,
      type,
      message: `Enter your kintone ${name}:`,
      validate: (value) => {
        if (value.length) {
          return true
        } else {
          return `Please enter your ${name}`
        }
      },
    },
  ])
  return value[name]
}

const stdInputOptions = async (opts) => {
  const TYPE_PASSWORD = 'password'

  // 標準入力しないオプションを画面表示(複数環境のアカウント情報入力などで間違えないため)
  for (const [optName, optValue] of Object.entries(opts)) {
    if (optValue) {
      // TODO: chalkなど使って色をつけたい
      let dispValue = pretty(optValue)
      switch (optName) {
        case 'password':
        case 'basic':
          dispValue = '[hidden]'
          break
        case 'pushTarget':
          continue
      }
      console.info(`${optName}: ${dispValue}`)
    }
  }

  if (opts.proxy instanceof Object) {
    const netrcProxyProps = netrc.machines[opts.proxy.hostname] || {}
    const netrcProxyAuth = `${netrcProxyProps.login}:${netrcProxyProps.password}`
    opts.proxy.auth = opts.proxy.auth || netrcProxyAuth
  }

  opts.domain = opts.domain || (await inputKintoneInfo('domain'))
  // netrcに保存済みの情報取得
  if (!opts.oauth) {
    netrc.loadSync()
  }
  const netrcProps = (netrc.machines && netrc.machines[opts.domain]) || {}

  const netrcBasic = netrcProps.account
  // TODO: コマンドライン引数のbasic処理と共通化したい
  if (!opts.basic && netrcBasic) {
    if (netrcBasic.includes(':')) {
      opts.basic = netrcBasic
      ;[opts.basic_user, opts.basic_password] = netrcBasic.split(':')
    } else if (!opts.basic_user) {
      opts.basic_user = netrcBasic
    }
  }

  if (opts.basic_user && !opts.basic_password) {
    // Basic認証のパスワードが省略された時だけ標準入力で問い合わせ
    // そもそもbasicオプションが指定されなかった場合は無視
    const basicPassword = await inputKintoneInfo('Basic Authentication password', TYPE_PASSWORD)
    opts.basic = `${opts.basic_user}:${basicPassword}`
  }

  if (!opts.oauth) {
    opts.username =
      opts.username || netrcProps.login || process.env.GINUE_USERNAME || (await inputKintoneInfo('username'))
    opts.password =
      opts.password ||
      netrcProps.password ||
      process.env.GINUE_PASSWORD ||
      (await inputKintoneInfo('password', TYPE_PASSWORD))
    opts.basic = opts.basic || process.env.GINUE_BASIC
  }

  // クライアント認証書のオプション
  opts.pfxFilepath = opts.pfxFilepath || process.env.GINUE_PFX_FILEPATH
  opts.pfxPassword =
    opts.pfxPassword ||
    process.env.GINUE_PFX_PASSWORD ||
    (opts.pfxFilepath && (await inputKintoneInfo('client certificate password', TYPE_PASSWORD)))

  opts.app = opts.app || (await inputKintoneInfo('app'))
  console.info()
  // TODO: 「is guest space?(Y/N)」のように問い合わせて、YならguestSpaceIdを入力
  // opts.guestSpaceId = opts.guestSpaceId || await inputKintoneInfo('guestSpaceID')
}

const parseArgumentOptions = () => {
  const argv = minimist(process.argv.slice(2), {
    // booleanを明記するとデフォルトfalseになってginuercとマージしづらいので書かない
    // 有効なオプションが分かるようにコメントとしては残しておく
    // boolean: ['version', 'help', 'preview', 'acl', 'alt', 'oauth'],
    string: [
      'location',
      'domain',
      'username',
      'password',
      'app',
      'guest',
      'basic',
      'exclude',
      'fileType',
      'appName',
      'pfxFilepath',
      'pfxPassword',
    ],
    alias: {
      v: 'version',
      h: 'help',
      l: 'location',
      d: 'domain',
      u: 'username',
      p: 'password',
      a: 'app',
      g: 'guest',
      b: 'basic',
      x: 'exclude',
      t: 'fileType',
      A: 'appName',
      F: 'pfxFilepath',
      P: 'pfxPassword',
    },
  })
  if (argv.domain || argv.username || argv.password || argv.app || argv.guest) {
    argv.priority = true
  }

  if (argv._[0]) {
    argv.type = argv._[0]
  }
  if (argv._[1]) {
    argv.target = argv._[1]
  }

  return argv
}

// TODO: minimistやめて、もっとリッチなライブラリを使う
// 引数や設定ファイルの組み合わせからオプション値を抽出
// firstObjを優先し、firstObjに存在しないプロパティはsecondObjを使用
const pluckOpts = (firstObj: any, secondObj?: any) => {
  // TODO: previewやjsなどのboolean値はfirstObjがfalseでも必ず使われてしまうのを修正
  const obj = Object.assign({}, secondObj, firstObj)
  const opts: Opts = {
    location: obj.location,
    envLocation: obj.envLocation,
    environment: obj.environment,
    // TODO: プロキシ設定のドキュメント書く
    // ginuercに以下のいずれかで定義
    // proxy: {
    //   protocol: 'https',
    //   auth: 'username:password',
    //   hostname: 'proxy.example.com',
    //   port: 443,
    // },
    // proxy: 'https://username:password@proxy.example.com:443'
    // もしくは環境変数に書いてもOK（一般的な設定）
    // HTTPS_PROXY='https://username:password@proxy.example.com:443'
    proxy: obj.proxy,
    domain: obj.domain,
    username: obj.username,
    password: obj.password,
    app: obj.app,
    guestSpaceId: obj.guest,
    pushTarget: obj.pushTarget,
    // TODO: ginue diffコマンドを叩くとpreviewと運用環境との差分を表示したい（diffコマンドへのエイリアス？）
    preview: obj.preview,
    acl: obj.acl,
    field_acl: obj.field_acl,
    exclude: obj.exclude,
    fileType: obj.fileType,
    appName: obj.appName,
    alt: obj.alt,
    oauth: obj.oauth,
    commands: obj.commands,
    downloadJs: obj.downloadJs,
    pfxFilepath: obj.pfxFilepath,
    pfxPassword: obj.pfxPassword,
  }

  // Basic認証のパスワード有無でプロパティ名を変えておく
  const basic = obj.basic
  if (basic) {
    if (basic.includes(':')) {
      opts.basic = basic
    } else {
      opts.basic_user = basic
    }
  }

  return opts
}

const createAppDic = (app) => {
  if (typeof app === 'string') {
    app = app.split(',').map((str) => str.trim())
  }
  if (Array.isArray(app)) {
    return app.reduce((obj, id) => {
      obj[id.toString()] = id
      return obj
    }, {})
  }
  return app
}

const createOptionValues = async () => {
  const argv = parseArgumentOptions()

  if (argv.version) {
    showVersion()
  }

  if (argv.help) {
    usageExit(0, argv.type)
  }

  if (!argv.type || !['pull', 'push', 'reset', 'deploy', 'erd', 'diff'].includes(argv.type)) {
    usageExit(1)
  }

  const ginuerc = await loadGinuerc()

  let opts
  if (argv.target) {
    const [target, pushTarget] = argv.target.split(':')

    // push先target(コロンの右側)はginue pushの場合のみ指定可能
    if (pushTarget && !['push', 'diff'].includes(argv.type)) {
      usageExit(1, argv.type)
    }

    type TargetGinuerc = EnvGinuerc & { pushTarget?: EnvGinuerc }
    const targetGinuercElem = ginuerc.find((g): g is TargetGinuerc => g.environment === target)
    if (!targetGinuercElem) {
      console.error(`ERROR: environment '${target}' not found.`)
      process.exit(1)
    }
    if (pushTarget) {
      // TODO: コマンドライン引数と組み合わさった場合の各種パターンを要テスト
      const pushTargetGinuercElem = ginuerc.find((g) => g.environment === pushTarget)
      if (!pushTargetGinuercElem) {
        console.error(`ERROR: environment '${pushTarget}' not found.`)
        process.exit(1)
      }
      if (Array.isArray(pushTargetGinuercElem.app) || Array.isArray(targetGinuercElem.app)) {
        console.error(`ERROR: 'app' should be Object if 'ginue push <env>:<env>' is specified.`)
        usageExit(1, 'push')
      }
      targetGinuercElem.pushTarget = pushTargetGinuercElem
    }
    opts = pluckOpts(argv, targetGinuercElem)
  } else if (ginuerc.length === 1) {
    // ginuercに単一環境だけ指定されている場合は、
    // argvを優先し、argvに存在しないオプションだけginuercを使う
    opts = pluckOpts(argv, ginuerc[0])
  } else if (argv.priority) {
    // ginuercに複数環境が指定され、argvにpriorityなオプションがある場合は、
    // ginuercを無視してargvのオプションだけ使う
    // argvには1種類の環境しか指定できず、ginuercの一部だけ使うことが難しいため
    opts = pluckOpts(argv)
  } else if (['push', 'reset', 'deploy'].includes(argv.type)) {
    // 送信系のコマンドは単一環境のみを対象にするため、ここまでの条件に合致しなければエラー
    // 複数環境への一括pushも技術的には難しくないけど、ヒューマンエラー防止のため非対応
    console.error('ERROR: <target environment> is required if .ginuerc has multiple environments.')
    usageExit(1, argv.type)
  } else {
    // 複数環境対応コマンドでargvにpriorityなオプションがなければ
    // ginuercの複数環境を全て使用
    // argvに何かしらオプションがあれば全環境でargvを優先
    opts = ginuerc.map((g) => pluckOpts(argv, g))
  }
  const allOpts = Array.isArray(opts) ? opts : [opts]

  for (const opts of allOpts) {
    await stdInputOptions(opts)
    if (opts.pushTarget) {
      await stdInputOptions(opts.pushTarget)
    }
    opts.apps = createAppDic(opts.app)
    opts.type = argv.type
  }

  if (['push', 'reset', 'deploy'].includes(argv.type)) {
    const { isConfirmed } = await inquirer.prompt([
      {
        name: 'isConfirmed',
        type: 'confirm',
        message: `[${argv.type}] Are you sure?`,
      },
    ])
    if (!isConfirmed) {
      process.exit(0)
    }
  }

  return allOpts
}

module.exports = { createOptionValues, loadKintoneCommands }
