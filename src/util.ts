import type { Opts, Ktn } from './types'
import mkdirp from 'mkdirp'
import { rcFile } from 'rc-config-loader'

export const pretty = (obj: any) => JSON.stringify(obj, null, '  ')
export const prettyln = (obj: any) => pretty(obj) + '\n'
export const trim = (str: string) => str.replace(/^\n|\n$/g, '')

export const showVersion = () => {
  const { version } = require('../package.json')
  console.error(`Ginue ${version}`)
  process.exit(0)
}

export const usageExit = (returnCode = 0, command?: string) => {
  let message
  switch (command) {
    case 'pull':
      message = trim(`
usage: ginue pull [<target environment>] [<options>]

  -h, --help                    Output usage information
  -d, --domain=<DOMAIN>         kintone domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
  -A, --appName=<APP-NAME>      Set target app name
  -l, --location=<LOCATION>     Location of settings file
  -t, --fileType=<FILE-TYPE>    Set file type 'json'(default) or 'js'
  --preview                     Fetch xxx-preview.json
`)
      break
    case 'push':
      message = trim(`
usage: ginue push [<target environment>[:<target environment>]] [<options>]

  -h, --help                    Output usage information
  -d, --domain=<DOMAIN>         kintone domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
  -A, --appName=<APP-NAME>      Set target app name
  -l, --location=<LOCATION>     Location of settings file
  -t, --fileType=<FILE-TYPE>    Set file type 'json'(default) or 'js'
`)
      break
    case 'deploy':
      message = trim(`
usage: ginue deploy [<target environment>] [<options>]

  -h, --help                    Output usage information
  -d, --domain=<DOMAIN>         kintone domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
  -A, --appName=<APP-NAME>      Set target app name
`)
      break
    case 'reset':
      message = trim(`
usage: ginue reset [<target environment>] [<options>]

  -h, --help                    Output usage information
  -d, --domain=<DOMAIN>         kintone domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
  -A, --appName=<APP-NAME>      Set target app name
`)
      break
    case 'erd':
      message = trim(`
usage: ginue erd [<target environment>] [<options>]

  -h, --help                    Output usage information
`)
      break
    default:
      message = trim(`
usage: ginue [-v, --version] [-h, --help]
              pull [<options>]
              push [<options>]
              deploy [<options>]
              reset [<options>]
              erd [<options>]
`)
  }
  console.error(message)
  process.exit(returnCode)
}

// TODO: 全エラーメッセージをこの関数に統一
export const errorExit = (message: string, returnCode = 1) => {
  console.error(`ERROR: ${message}`)
  process.exit(returnCode)
}

// ユーザー名・パスワードをBase64エンコードする関数
// 呼び出し方は2通り
// 引数1つ：(ユーザー名:パスワード)コロン区切り文字列
// 引数2つ：(ユーザー名, パスワード)それぞれの文字列
export const createBase64Account = async (...account: [string, string]) => {
  const base64Account = Buffer.from(account.join(':')).toString('base64')
  return base64Account
}

export const loadRequiedFile = (configFileName: string) => {
  try {
    const config = rcFile('config', { configFileName })
    if (!config) {
      return errorExit(`${configFileName}: file not found!`)
    }
    const { config: obj } = config
    return obj
  } catch (e) {
    errorExit(`Invalid ${configFileName} !`)
  }
}

const createBaseDirPath = (opts: Opts) => {
  let dirPath = ''

  if (opts.location) {
    dirPath += `${opts.location}/`
  }

  if (opts.envLocation) {
    dirPath += opts.envLocation
  } else if (opts.environment) {
    dirPath += opts.environment
  }

  if (dirPath) {
    dirPath += '/'
  }

  return dirPath
}

export const createDirPath = (ktn: Ktn, opts: Opts) => {
  return `${createBaseDirPath(opts)}${ktn.appName}`
}

export const createFilePath = (ktn: Ktn, opts: Opts, customFileName: string) => {
  const dirPath = createDirPath(ktn, opts)
  mkdirp.sync(dirPath)
  let fileName = customFileName || `${ktn.command.replace(/\//g, '_')}`
  if (opts.fileType === 'js') {
    fileName = fileName.replace(/\.json$/, '.js')
  }
  return `${dirPath}/${fileName}`
}
