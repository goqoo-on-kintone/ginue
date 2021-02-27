const mkdirp = require('mkdirp')
const { rcFile } = require('rc-config-loader')
const request = require('request-promise')

const pretty = (obj) => JSON.stringify(obj, null, '  ')
const prettyln = (obj) => pretty(obj) + '\n'
const trim = (str) => str.replace(/^\n|\n$/g, '')

const showVersion = () => {
  const { version } = require('../package.json')
  console.error(`Ginue ${version}`)
  process.exit(0)
}

const usageExit = (returnCode = 0, command) => {
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
const errorExit = (message, returnCode = 1) => {
  console.error(`ERROR: ${message}`)
  process.exit(returnCode)
}

// ユーザー名・パスワードをBase64エンコードする関数
// 呼び出し方は2通り
// 引数1つ：(ユーザー名:パスワード)コロン区切り文字列
// 引数2つ：(ユーザー名, パスワード)それぞれの文字列
const createBase64Account = async (...account) => {
  const base64Account = Buffer.from(account.join(':')).toString('base64')
  return base64Account
}

const loadRequiedFile = (configFileName) => {
  try {
    const { config: obj } = rcFile('config', { configFileName })
    return obj
  } catch (e) {
    errorExit(`Invalid ${configFileName} !`)
  }
}

const createDirPath = (ktn, opts) => {
  let dirPath = ''

  if (opts.location) {
    dirPath += `${opts.location}/`
  }

  if (opts.envLocation) {
    dirPath += opts.envLocation
  } else if (opts.environment) {
    dirPath += opts.environment
  }

  if (ktn.preview) {
    if (dirPath) {
      dirPath += '-'
    }
    dirPath += 'preview'
  }
  if (dirPath) {
    dirPath += '/'
  }
  return `${dirPath}${ktn.appName}`
}

const createFilePath = (ktn, opts, customFileName) => {
  const dirPath = createDirPath(ktn, opts)
  mkdirp.sync(dirPath)
  let fileName = customFileName || `${ktn.command.replace(/\//g, '_')}`
  if (opts.fileType === 'js') {
    fileName = fileName.replace(/\.json$/, '.js')
  }
  return `${dirPath}/${fileName}`
}

const createUrl = (ktn) => {
  const basePath = ktn.guestSpaceId ? `k/guest/${ktn.guestSpaceId}/v1` : 'k/v1'
  return `https://${ktn.domain}/${basePath}/${ktn.command}`
}

// 今後push機能を実装する場合にPOST/PUT向けの複雑なヘッダーを作成するために用意した関数
// TODO: push作ったけど複雑にはならないかも。一回見直す
const createHeaders = (ktn) => {
  const header = {
    'X-Cybozu-Authorization': ktn.base64Account,
    'Authorization': `Basic ${ktn.base64Basic}`,
  }
  // デバッグ時はここのlangをja|en|zhで切り替えて各言語テスト
  // ktn.lang = 'en'
  if (ktn.lang) {
    header['Accept-Language'] = ktn.lang
  }
  return header
}

const createPutHeaders = (ktn) => {
  const headers = createHeaders(ktn)
  // TODO: do something
  return headers
}

const sendKintoneInfo = async (method, ktn, kintoneInfo) => {
  const options = {
    method: method,
    url: createUrl(ktn),
    headers: createPutHeaders(ktn),
    body: kintoneInfo,
    json: true,
  }
  const resp = await request(options)
  return resp
}

module.exports = {
  pretty,
  prettyln,
  trim,
  showVersion,
  usageExit,
  errorExit,
  createBase64Account,
  loadRequiedFile,
  createDirPath,
  createFilePath,
  createUrl,
  createHeaders,
  sendKintoneInfo,
}
