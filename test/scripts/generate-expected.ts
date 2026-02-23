/**
 * expectedディレクトリを生成するスクリプト
 * 実行方法: npx ts-node test/scripts/generate-expected.ts
 */
import fs from 'fs'
import path from 'path'
import { ginuePush } from '../../src/push'
import type { Ktn, Opts, BaseOpts } from '../../src/types'

const BASE_DIR = path.join(__dirname, '..', 'fixtures', 'push-dry-run')
const EXPECTED_DIR = path.join(BASE_DIR, 'expected')

const APP_IDS = {
  dev: { activity: 1, customer: 2, project: 3, contact: 4 },
  prod: { activity: 111, customer: 222, project: 333, contact: 444 },
}

const PUSH_COMMANDS = [
  'app/settings.json',
  'app/form/fields.json',
  'app/form/layout.json',
  'app/views.json',
  'app/reports.json',
  'app/status.json',
]

const createOpts = (appName: string, dryRunOutput: string): Opts => ({
  location: BASE_DIR,
  envLocation: 'input/development',
  environment: 'dev',
  pushTarget: {
    environment: 'dev2prod', // expected出力用のフォルダ名
    app: APP_IDS.prod,
  },
  app: APP_IDS.dev,
  appName,
  dryRunOutput,
})

const createKtn = (appName: keyof typeof APP_IDS.dev, command: string): Ktn => ({
  domain: 'dev.cybozu.com',
  appName,
  appId: APP_IDS.dev[appName],
  command: command as keyof import('../../src/types').Commands,
  methods: ['GET', 'PUT'],
})

const createPushTarget = (appName: keyof typeof APP_IDS.prod): BaseOpts => ({
  domain: 'prod.cybozu.com',
  appId: APP_IDS.prod[appName],
})

const main = async () => {
  const apps = ['activity', 'customer', 'project', 'contact'] as const

  for (const appName of apps) {
    for (const command of PUSH_COMMANDS) {
      const inputFile = path.join(
        BASE_DIR,
        'input',
        'development',
        appName,
        command.replace(/\//g, '_')
      )
      if (!fs.existsSync(inputFile)) {
        continue
      }

      const opts = createOpts(appName, EXPECTED_DIR)
      const ktn = createKtn(appName, command)
      const pushTarget = createPushTarget(appName)

      await ginuePush(ktn, opts, pushTarget)
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Expected files generated in: ${EXPECTED_DIR}`)
}

main().catch(console.error)
