import type https from 'https'

export type Ginuerc = { env?: Record<string, EnvGinuerc> } & EnvGinuerc
export type EnvGinuerc = Partial<{
  environment: string
  envLocation: string
  location: string
  domain: string
  app: number[] | Record<string, number>
  downloadJs: boolean
  username: string
  password: string
  pfxFilepath: string
  pfxPassword: string
  proxy?: string | https.AgentOptions
}>

export type Opts = {
  location: string
  envLocation: string
  environment: string
  proxy: string
  domain: string
  username: string
  password: string
  app: string
  guestSpaceId: string
  pushTarget: string
  preview: string
  acl: string
  field_acl: string
  exclude: string
  fileType: string
  appName: string
  alt: string
  oauth: string
  commands: string
  downloadJs: string
  pfxFilepath: string
  pfxPassword: string

  basic?: string
  basic_user?: string
}

export type Ktn = any
