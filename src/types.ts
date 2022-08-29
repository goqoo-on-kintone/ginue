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
  proxy:
    | string
    | {
        protocol: string
        auth: string
        hostname: string
        port: number
      }

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
  exclude: ExcludedCommands
}>

export type Ktn = any

export type Commands = {
  appParam: string
  hasPreview: boolean
  langParam?: 'lang'
  methods: ('GET' | 'PUT')[]
  skipOauth?: boolean
}
export type ExcludedCommands = keyof Commands | (keyof Commands)[]

export type AppDic = Record<string, string | number>
