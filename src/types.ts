import type { KintoneRestAPIClient } from '@kintone/rest-api-client'
import type { Properties } from '@kintone/rest-api-client/lib/client/types/app'

export type Ginuerc = { env?: Record<string, BaseOpts> } & BaseOpts
export type Opts = BaseOpts & { pushTarget?: BaseOpts }

export type BaseOpts = Partial<{
  type: string // push, pullなど

  location: string
  envLocation: string
  environment: string

  domain: string
  username: string
  oauth: boolean
  password: string
  basic: string
  basic_user: string
  basic_password: string
  pfxFilepath: string
  pfxPassword: string
  proxy: ProxyOption

  app: number[] | Record<string, number>
  apps: AppDic
  appName: string
  guestSpaceId: string
  fileType: 'json' | 'js'

  preview: boolean
  alt: boolean
  acl: boolean
  field_acl: boolean
  downloadJs: boolean

  commands: Commands
  exclude: keyof Commands | (keyof Commands)[]

  base64Account?: string
  base64Basic?: string
  accessToken?: string
}>

export type Ktn = Pick<Opts, 'proxy' | 'domain' | 'guestSpaceId' | 'apps' | 'pfxFilepath' | 'pfxPassword' | 'preview'> &
  Partial<{
    base64Account: string
    base64Basic: string
    accessToken: string
    appName: string
    appId: string
    command: keyof Commands
    appParam: CommandProps['appParam']
    methods: CommandProps['methods']
    lang: 'ja' | 'en' | 'zh' // デバッグ用

    environment: string
  }>

export type ProxyOption =
  | string
  | {
      protocol: string
      auth: string
      hostname: string
      port: number
    }
export type PfxOption = { filepath: string; password: string }
export type AgentOptions = { proxy?: ProxyOption; pfx?: PfxOption }

type CommandProps = {
  appParam: string
  hasPreview: boolean
  langParam?: 'lang'
  methods: ('GET' | 'PUT')[]
  skipOauth?: boolean
}
export type Commands = Record<string, CommandProps>

export type AppDic = Record<string, string | number>

export type FormFields = Awaited<ReturnType<KintoneRestAPIClient['app']['getFormFields']>>
export type FormLayout = Awaited<ReturnType<KintoneRestAPIClient['app']['getFormLayout']>>
export type AppSettings = Awaited<ReturnType<KintoneRestAPIClient['app']['getAppSettings']>>
export type AppCustomize = {
  desktop: { js: any[]; css: any[] }
  mobile: { js: any[]; css: any[] }
  revision: string
}

export type KintoneInfo = {
  properties?: Properties
  app: string
  revision: string
}
