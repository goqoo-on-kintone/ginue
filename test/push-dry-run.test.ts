import fs from 'fs'
import path from 'path'
import os from 'os'
import { ginuePush } from '../src/push'
import type { Ktn, Opts, BaseOpts, Commands } from '../src/types'

// テスト用フィクスチャのパス
const BASE_DIR = path.join(__dirname, 'fixtures', 'push-dry-run')
const EXPECTED_DIR = path.join(BASE_DIR, 'expected')

// 一時出力ディレクトリを作成
const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ginue-dry-run-test-'))
}

// JSONファイルを読み込んでパース
const readJson = (filePath: string) => {
  const content = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(content)
}

// expectedファイルが存在するかチェック
const hasExpected = (relativePath: string) => {
  return fs.existsSync(path.join(EXPECTED_DIR, relativePath))
}

// アプリID変換マッピング（dev → prod）
// activity: 1 → 111
// customer: 2 → 222
// project: 3 → 333
// contact: 4 → 444
const APP_IDS = {
  dev: { activity: 1, customer: 2, project: 3, contact: 4 },
  prod: { activity: 111, customer: 222, project: 333, contact: 444 },
}

// 基本のオプション設定
const createOpts = (appName: string, dryRunOutput: string): Opts => ({
  location: BASE_DIR,
  envLocation: 'input/development',
  environment: 'dev',
  pushTarget: {
    environment: 'prod',
    app: APP_IDS.prod,
  },
  app: APP_IDS.dev,
  appName,
  dryRunOutput,
})

// 基本のKtn設定
const createKtn = (appName: keyof typeof APP_IDS.dev, command: string): Ktn => ({
  domain: 'dev.cybozu.com',
  appName,
  appId: APP_IDS.dev[appName],
  command: command as keyof Commands,
  methods: ['GET', 'PUT'],
})

// pushTarget設定
const createPushTarget = (appName: keyof typeof APP_IDS.prod): BaseOpts => ({
  domain: 'prod.cybozu.com',
  appId: APP_IDS.prod[appName],
})

describe('ginue push --dry-run', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('activity アプリ', () => {
    test('app/form/fields.json: lookupのアプリIDをprod環境向けに変換', async () => {
      const opts = createOpts('activity', tempDir)
      const ktn = createKtn('activity', 'app/form/fields.json')
      const pushTarget = createPushTarget('activity')

      await ginuePush(ktn, opts, pushTarget)

      const outputPath = path.join(tempDir, 'prod', 'activity', 'app_form_fields.json')
      expect(fs.existsSync(outputPath)).toBe(true)

      const output = readJson(outputPath)

      // アプリIDが正しく変換されていることを確認
      expect(output.app).toBe(111)
      // 会社名フィールド（customer lookup: 2 → 222）
      expect(output.properties['会社名'].lookup.relatedApp.app).toBe(222)
      // 案件名フィールド（project lookup: 3 → 333）
      expect(output.properties['案件名'].lookup.relatedApp.app).toBe(333)
      // 案件情報フィールド（project referenceTable: 3 → 333）
      expect(output.properties['案件情報'].referenceTable.relatedApp.app).toBe(333)
      // 関連活動履歴フィールド（activity referenceTable: 1 → 111）
      expect(output.properties['関連活動履歴'].referenceTable.relatedApp.app).toBe(111)
    })

    test('app/settings.json: nameを削除してprod環境向けに変換', async () => {
      const opts = createOpts('activity', tempDir)
      const ktn = createKtn('activity', 'app/settings.json')
      const pushTarget = createPushTarget('activity')

      await ginuePush(ktn, opts, pushTarget)

      const outputPath = path.join(tempDir, 'prod', 'activity', 'app_settings.json')
      expect(fs.existsSync(outputPath)).toBe(true)

      const output = readJson(outputPath)

      // nameが削除されていることを確認
      expect(output.name).toBeUndefined()
      // appIdが設定されていることを確認
      expect(output.app).toBe(111)
    })

    test('app/form/layout.json: そのままprod環境向けに変換', async () => {
      const opts = createOpts('activity', tempDir)
      const ktn = createKtn('activity', 'app/form/layout.json')
      const pushTarget = createPushTarget('activity')

      await ginuePush(ktn, opts, pushTarget)

      const outputPath = path.join(tempDir, 'prod', 'activity', 'app_form_layout.json')
      expect(fs.existsSync(outputPath)).toBe(true)

      const output = readJson(outputPath)
      expect(output.app).toBe(111)
    })

    test('app/views.json: そのままprod環境向けに変換', async () => {
      const opts = createOpts('activity', tempDir)
      const ktn = createKtn('activity', 'app/views.json')
      const pushTarget = createPushTarget('activity')

      await ginuePush(ktn, opts, pushTarget)

      const outputPath = path.join(tempDir, 'prod', 'activity', 'app_views.json')
      expect(fs.existsSync(outputPath)).toBe(true)

      const output = readJson(outputPath)
      expect(output.app).toBe(111)
    })
  })

  describe('customer アプリ', () => {
    test('app/form/fields.json: referenceTableのアプリIDをprod環境向けに変換', async () => {
      const opts = createOpts('customer', tempDir)
      const ktn = createKtn('customer', 'app/form/fields.json')
      const pushTarget = createPushTarget('customer')

      await ginuePush(ktn, opts, pushTarget)

      const outputPath = path.join(tempDir, 'prod', 'customer', 'app_form_fields.json')
      expect(fs.existsSync(outputPath)).toBe(true)

      const output = readJson(outputPath)
      expect(output.app).toBe(222)
      // 担当者一覧（contact referenceTable: 4 → 444）
      expect(output.properties['担当者一覧'].referenceTable.relatedApp.app).toBe(444)
      // 案件一覧（project referenceTable: 3 → 333）
      expect(output.properties['案件一覧'].referenceTable.relatedApp.app).toBe(333)
      // 活動履歴一覧（activity referenceTable: 1 → 111）
      expect(output.properties['活動履歴一覧'].referenceTable.relatedApp.app).toBe(111)
    })
  })

  describe('project アプリ', () => {
    test('app/form/fields.json: lookupのアプリIDをprod環境向けに変換', async () => {
      const opts = createOpts('project', tempDir)
      const ktn = createKtn('project', 'app/form/fields.json')
      const pushTarget = createPushTarget('project')

      await ginuePush(ktn, opts, pushTarget)

      const outputPath = path.join(tempDir, 'prod', 'project', 'app_form_fields.json')
      expect(fs.existsSync(outputPath)).toBe(true)

      const output = readJson(outputPath)
      expect(output.app).toBe(333)
    })
  })

  describe('contact アプリ', () => {
    test('app/form/fields.json: lookupとreferenceTableのアプリIDをprod環境向けに変換', async () => {
      const opts = createOpts('contact', tempDir)
      const ktn = createKtn('contact', 'app/form/fields.json')
      const pushTarget = createPushTarget('contact')

      await ginuePush(ktn, opts, pushTarget)

      const outputPath = path.join(tempDir, 'prod', 'contact', 'app_form_fields.json')
      expect(fs.existsSync(outputPath)).toBe(true)

      const output = readJson(outputPath)
      expect(output.app).toBe(444)
      // 顧客名フィールド（customer lookup: 2 → 222）
      expect(output.properties['顧客名'].lookup.relatedApp.app).toBe(222)
      // 同一企業担当者フィールド（contact referenceTable: 4 → 444）
      expect(output.properties['同一企業担当者'].referenceTable.relatedApp.app).toBe(444)
    })
  })
})

// expectedファイルとの完全一致を確認するテスト
// npx ts-node test/scripts/generate-expected.ts でexpectedを生成後に有効
describe('スナップショット比較', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  const testCases = [
    { app: 'activity', command: 'app/form/fields.json' },
    { app: 'activity', command: 'app/settings.json' },
    { app: 'activity', command: 'app/form/layout.json' },
    { app: 'activity', command: 'app/views.json' },
    { app: 'customer', command: 'app/form/fields.json' },
    { app: 'project', command: 'app/form/fields.json' },
    { app: 'contact', command: 'app/form/fields.json' },
  ] as const

  test.each(testCases)('$app/$command: expectedと一致', async ({ app, command }) => {
    const fileName = command.replace(/\//g, '_')
    const expectedRelPath = `dev2prod/${app}/${fileName}`

    // expectedファイルがなければスキップ
    if (!hasExpected(expectedRelPath)) {
      return
    }

    const opts = createOpts(app, tempDir)
    const ktn = createKtn(app, command)
    const pushTarget = createPushTarget(app)

    await ginuePush(ktn, opts, pushTarget)

    // 実際の出力は prod/ に出力される
    const outputPath = path.join(tempDir, 'prod', app, fileName)
    const expectedPath = path.join(EXPECTED_DIR, expectedRelPath)

    expect(readJson(outputPath)).toEqual(readJson(expectedPath))
  })
})
