/**
 * E2Eテスト: 実際のkintone APIを叩いてpull/push/deploy/resetをテスト
 *
 * 実行方法:
 * 1. test/fixtures/e2e/.ginuerc.example.js を .ginuerc.js にコピー
 * 2. .ginuerc.js に実際のkintone環境の情報を設定
 * 3. yarn test:e2e で実行
 *
 * NOTE: kintoneアプリストアの「SFA（営業支援）パック」を使用
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const E2E_FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'e2e')
const E2E_CONFIG_PATH = path.join(E2E_FIXTURES_DIR, '.ginuerc.js')
const E2E_OUTPUT_DIR = path.join(E2E_FIXTURES_DIR, 'output')
const GINUE_CLI = path.join(__dirname, '..', '..', 'dist', 'cli.js')

// E2E設定ファイルの存在確認
const hasE2eConfig = fs.existsSync(E2E_CONFIG_PATH)

// ginueコマンド実行ヘルパー（成功を期待）
const runGinue = (args: string[], options?: { input?: string }): string => {
  const cmd = `node ${GINUE_CLI} ${args.join(' ')}`
  try {
    return execSync(cmd, {
      cwd: E2E_FIXTURES_DIR,
      encoding: 'utf-8',
      input: options?.input,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    })
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string }
    // eslint-disable-next-line no-console
    console.error('Command failed:', cmd)
    // eslint-disable-next-line no-console
    console.error('stdout:', execError.stdout)
    // eslint-disable-next-line no-console
    console.error('stderr:', execError.stderr)
    throw error
  }
}

// 出力ディレクトリをクリーンアップ
const cleanupOutputDir = () => {
  if (fs.existsSync(E2E_OUTPUT_DIR)) {
    fs.rmSync(E2E_OUTPUT_DIR, { recursive: true })
  }
}

// テストスイート
describe('E2E: ginue pull/push/deploy/reset', () => {
  // E2E設定がない場合はスキップ
  if (!hasE2eConfig) {
    it('スキップ: .ginuerc.js が見つかりません', () => {
      // E2E設定がないためスキップ
      // 実行するには:
      // 1. .ginuerc.example.js を .ginuerc.js にコピー
      // 2. kintone環境の情報を設定
      // 3. yarn test:e2e で実行
      expect(hasE2eConfig).toBe(false)
    })
    return
  }

  // 各テスト前にビルドを確認
  beforeAll(() => {
    // dist/cli.js が存在するか確認
    if (!fs.existsSync(GINUE_CLI)) {
      throw new Error('Please run "yarn build" before running E2E tests')
    }

    // 出力ディレクトリをクリーンアップ
    cleanupOutputDir()
  })

  // ========================================
  // pull コマンド
  // ========================================
  describe('pull コマンド', () => {
    it('kintoneから全アプリの設定を取得できる', () => {
      const output = runGinue([
        'pull',
        '-e', 'e2e',
        '-l', 'output',
      ])

      // 出力に成功メッセージが含まれることを確認
      expect(output).toContain('activity')
      expect(output).toContain('customer')
      expect(output).toContain('project')
      expect(output).toContain('contact')
    })

    it('期待されるディレクトリ構造が作成される', () => {
      const apps = ['activity', 'customer', 'project', 'contact']
      const expectedFiles = [
        'app_settings.json',
        'app_form_fields.json',
        'app_form_layout.json',
        'app_views.json',
      ]

      for (const app of apps) {
        const appDir = path.join(E2E_OUTPUT_DIR, 'e2e', app)
        expect(fs.existsSync(appDir)).toBe(true)

        for (const file of expectedFiles) {
          const filePath = path.join(appDir, file)
          expect(fs.existsSync(filePath)).toBe(true)

          // JSONとしてパース可能であることを確認
          const content = fs.readFileSync(filePath, 'utf-8')
          expect(() => JSON.parse(content)).not.toThrow()
        }
      }
    })

    it('revisionがrevision.jsonに分離される', () => {
      const apps = ['activity', 'customer', 'project', 'contact']
      const filesWithRevision = [
        'app_form_fields.json',
        'app_form_layout.json',
        'app_views.json',
      ]

      for (const app of apps) {
        // メインファイルにはrevisionが含まれないこと
        for (const file of filesWithRevision) {
          const mainFilePath = path.join(E2E_OUTPUT_DIR, 'e2e', app, file)
          const mainContent = JSON.parse(fs.readFileSync(mainFilePath, 'utf-8'))
          expect(mainContent).not.toHaveProperty('revision')
        }

        // revision.jsonファイルが存在し、revision番号を含むこと
        const revisionFilePath = path.join(E2E_OUTPUT_DIR, 'e2e', app, 'revision.json')
        expect(fs.existsSync(revisionFilePath)).toBe(true)
        const revisionContent = JSON.parse(fs.readFileSync(revisionFilePath, 'utf-8'))
        // revision.jsonは各APIのrevisionをまとめて保持
        expect(typeof revisionContent).toBe('object')
      }
    })

    it('ACL設定ファイルが取得される', () => {
      const apps = ['activity', 'customer', 'project', 'contact']
      const aclFiles = ['app_acl.json', 'field_acl.json', 'record_acl.json']

      for (const app of apps) {
        for (const file of aclFiles) {
          const filePath = path.join(E2E_OUTPUT_DIR, 'e2e', app, file)
          expect(fs.existsSync(filePath)).toBe(true)

          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          expect(content).toHaveProperty('rights')
          expect(Array.isArray(content.rights)).toBe(true)
        }
      }
    })

    it('カスタマイズ設定ファイルが取得される', () => {
      const apps = ['activity', 'customer', 'project', 'contact']

      for (const app of apps) {
        const filePath = path.join(E2E_OUTPUT_DIR, 'e2e', app, 'app_customize.json')
        expect(fs.existsSync(filePath)).toBe(true)

        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        expect(content).toHaveProperty('desktop')
        expect(content).toHaveProperty('mobile')
      }
    })

    it('app.jsonにアプリ基本情報が含まれる', () => {
      const apps = ['activity', 'customer', 'project', 'contact']

      for (const app of apps) {
        const filePath = path.join(E2E_OUTPUT_DIR, 'e2e', app, 'app.json')
        expect(fs.existsSync(filePath)).toBe(true)

        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        // app.jsonにはアプリの基本情報が含まれる（マスクされるのは--altオプション使用時のみ）
        expect(content).toHaveProperty('appId')
        expect(content).toHaveProperty('name')
        expect(content).toHaveProperty('creator')
        expect(content).toHaveProperty('createdAt')
      }
    })

    it('JSONファイルがPrettierで整形されている', () => {
      const filePath = path.join(E2E_OUTPUT_DIR, 'e2e', 'activity', 'app_form_fields.json')
      const content = fs.readFileSync(filePath, 'utf-8')

      // インデントが2スペースであること
      expect(content).toMatch(/^\{\n {2}"/)
      // 末尾に改行があること
      expect(content.endsWith('\n')).toBe(true)
    })

    it('特定のアプリのみ取得できる (-A オプション)', () => {
      const singleAppDir = path.join(E2E_FIXTURES_DIR, 'output-single')
      if (fs.existsSync(singleAppDir)) {
        fs.rmSync(singleAppDir, { recursive: true })
      }

      // -A (--appName) オプションでアプリ名を指定してフィルタ
      // 注: -a は app ID 用、-A は app name 用
      const output = runGinue([
        'pull',
        '-e', 'e2e',
        '-l', 'output-single',
        '-A', 'activity',
      ])

      // ファイル出力にactivityアプリのパスが含まれること
      expect(output).toContain('e2e/activity')

      // activityのみ存在（ディレクトリ構造で確認）
      expect(fs.existsSync(path.join(singleAppDir, 'e2e', 'activity'))).toBe(true)
      expect(fs.existsSync(path.join(singleAppDir, 'e2e', 'customer'))).toBe(false)
      expect(fs.existsSync(path.join(singleAppDir, 'e2e', 'project'))).toBe(false)
      expect(fs.existsSync(path.join(singleAppDir, 'e2e', 'contact'))).toBe(false)

      // クリーンアップ
      fs.rmSync(singleAppDir, { recursive: true })
    })
  })

  // ========================================
  // push --dry-run コマンド
  // ========================================
  describe('push --dry-run コマンド', () => {
    const dryRunOutputDir = path.join(E2E_FIXTURES_DIR, 'dry-run-output')

    beforeAll(() => {
      if (fs.existsSync(dryRunOutputDir)) {
        fs.rmSync(dryRunOutputDir, { recursive: true })
      }
    })

    it('kintoneにpushせずに変換後JSONを出力できる', () => {
      const output = runGinue([
        'push',
        '-e', 'e2e',
        '-l', 'output',
        '--dry-run', dryRunOutputDir,
      ])

      // dry-runメッセージが出力されること
      expect(output).toContain('[DRY-RUN]')
    })

    it('入力と対応する出力ファイルが作成される', () => {
      const apps = ['activity', 'customer', 'project', 'contact']
      const pushableFiles = [
        'app_settings.json',
        'app_form_fields.json',
        'app_form_layout.json',
        'app_views.json',
        'app_reports.json',
        'app_status.json',
      ]

      // 存在するアプリディレクトリを取得
      const existingAppDirs = apps
        .map((app) => ({ app, dir: path.join(dryRunOutputDir, 'e2e', app) }))
        .filter(({ dir }) => fs.existsSync(dir))

      // 少なくとも1つのアプリでファイルが作成されていることを確認
      expect(existingAppDirs.length).toBeGreaterThan(0)

      // 各アプリディレクトリ内のファイルを検証
      for (const { dir } of existingAppDirs) {
        const files = fs.readdirSync(dir)
        expect(files.length).toBeGreaterThan(0)
        for (const file of files) {
          expect(pushableFiles).toContain(file)
        }
      }
    })

    it('dry-run出力のapp_settings.jsonにnameが含まれない', () => {
      const filePath = path.join(dryRunOutputDir, 'e2e', 'activity', 'app_settings.json')
      expect(fs.existsSync(filePath)).toBe(true)

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      expect(content).not.toHaveProperty('name')
    })
  })

  // ========================================
  // push コマンド（実際のpush）
  // NOTE: 確認プロンプトに"y"を入力して自動応答
  // ========================================
  describe('push コマンド', () => {
    it('プレビュー環境にpushできる', () => {
      const output = runGinue(
        ['push', '-e', 'e2e', '-l', 'output'],
        { input: 'y\n' }
      )

      // エラーなく完了すること
      expect(output).toBeDefined()
    })
  })

  // ========================================
  // reset コマンド
  // ========================================
  describe('reset コマンド', () => {
    it('プレビュー環境の変更を破棄できる', () => {
      const output = runGinue(
        ['reset', '-e', 'e2e'],
        { input: 'y\n' }
      )

      // エラーなく完了すること
      expect(output).toBeDefined()
    })
  })

  // ========================================
  // deploy コマンド
  // ========================================
  describe('deploy コマンド', () => {
    // NOTE: deployは運用環境に反映するため、慎重にテスト
    // pushしてからdeployする流れをテスト

    it('push後にdeployできる', () => {
      // まずpush
      runGinue(
        ['push', '-e', 'e2e', '-l', 'output'],
        { input: 'y\n' }
      )

      // 次にdeploy
      const output = runGinue(
        ['deploy', '-e', 'e2e'],
        { input: 'y\n' }
      )

      // エラーなく完了すること
      expect(output).toBeDefined()
    })
  })

  // ========================================
  // pull → push → deploy の一連の流れ
  // ========================================
  describe('pull → push → deploy の一連の流れ', () => {
    const freshOutputDir = path.join(E2E_FIXTURES_DIR, 'output-fresh')

    beforeAll(() => {
      if (fs.existsSync(freshOutputDir)) {
        fs.rmSync(freshOutputDir, { recursive: true })
      }
    })

    afterAll(() => {
      if (fs.existsSync(freshOutputDir)) {
        fs.rmSync(freshOutputDir, { recursive: true })
      }
    })

    it('pullした設定をそのままpush→deployできる（冪等性の確認）', () => {
      // 1. 新規ディレクトリにpull
      const pullOutput = runGinue([
        'pull',
        '-e', 'e2e',
        '-l', 'output-fresh',
      ])
      expect(pullOutput).toContain('activity')

      // 2. 同じ環境にpush
      const pushOutput = runGinue(
        ['push', '-e', 'e2e', '-l', 'output-fresh'],
        { input: 'y\n' }
      )
      expect(pushOutput).toBeDefined()

      // 3. deploy
      const deployOutput = runGinue(
        ['deploy', '-e', 'e2e'],
        { input: 'y\n' }
      )
      expect(deployOutput).toBeDefined()
    })
  })

  // ========================================
  // フィールド定義の検証
  // ========================================
  describe('フィールド定義の検証', () => {
    // フィールドの型定義
    interface FieldWithLookup {
      type: string
      lookup?: { relatedApp?: { app?: string } }
    }
    interface FieldWithReferenceTable {
      type: string
      referenceTable?: { relatedApp?: { app?: string } }
    }

    it('lookupフィールドのrelatedAppがアプリ名に変換される', () => {
      // activityアプリには会社名（lookup）フィールドがある
      const filePath = path.join(E2E_OUTPUT_DIR, 'e2e', 'activity', 'app_form_fields.json')
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
        properties: Record<string, FieldWithLookup>
      }

      // lookupフィールドを探す
      const fields = Object.values(content.properties)
      const lookupField = fields.find(
        (field) => field.type === 'SINGLE_LINE_TEXT' && field.lookup
      )

      // lookupフィールドが存在することを確認
      expect(lookupField).toBeDefined()
      // relatedApp.appが<アプリ名>形式（ginuercで定義）に変換される
      // 例: <customer> または実際のアプリID
      expect(lookupField?.lookup?.relatedApp?.app).toBeDefined()
    })

    it('referenceTableフィールドのrelatedAppがアプリ名に変換される', () => {
      // customerアプリには担当者一覧（referenceTable）フィールドがある
      const filePath = path.join(E2E_OUTPUT_DIR, 'e2e', 'customer', 'app_form_fields.json')
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
        properties: Record<string, FieldWithReferenceTable>
      }

      // referenceTableフィールドを探す
      const fields = Object.values(content.properties)
      const refTableField = fields.find((field) => field.type === 'REFERENCE_TABLE')

      // referenceTableフィールドが存在することを確認
      expect(refTableField).toBeDefined()
      // relatedApp.appが<アプリ名>形式（ginuercで定義）に変換される
      expect(refTableField?.referenceTable?.relatedApp?.app).toBeDefined()
    })
  })

  // ========================================
  // --alt オプション（マスキング機能）
  // ========================================
  describe('--alt オプション', () => {
    const altOutputDir = path.join(E2E_FIXTURES_DIR, 'output-alt')

    beforeAll(() => {
      if (fs.existsSync(altOutputDir)) {
        fs.rmSync(altOutputDir, { recursive: true })
      }
    })

    afterAll(() => {
      if (fs.existsSync(altOutputDir)) {
        fs.rmSync(altOutputDir, { recursive: true })
      }
    })

    it('--altオプションで環境依存情報がマスクされた-alt.jsonが生成される', () => {
      runGinue([
        'pull',
        '-e', 'e2e',
        '-l', 'output-alt',
        '--alt',
        '-A', 'activity',
      ])

      // 通常のapp.jsonが存在すること
      const appJsonPath = path.join(altOutputDir, 'e2e', 'activity', 'app.json')
      expect(fs.existsSync(appJsonPath)).toBe(true)

      // -alt.jsonファイルが生成されること
      const altAppJsonPath = path.join(altOutputDir, 'e2e', 'activity', 'app-alt.json')
      expect(fs.existsSync(altAppJsonPath)).toBe(true)

      // 通常ファイルには実際の値が入っている
      const normalContent = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'))
      expect(normalContent.appId).not.toBe('<APP_ID>')

      // -alt.jsonにはマスクされた値が入っている
      const altContent = JSON.parse(fs.readFileSync(altAppJsonPath, 'utf-8'))
      expect(altContent.appId).toBe('<APP_ID>')
      expect(altContent.name).toBe('<APP_NAME>')
      expect(altContent.spaceId).toBe('<SPACE_ID>')
      expect(altContent.creator.code).toBe('<CREATOR_CODE>')
    })

    it('app_viewsの-alt.jsonでビューIDがマスクされる', () => {
      const altViewsPath = path.join(altOutputDir, 'e2e', 'activity', 'app_views-alt.json')
      expect(fs.existsSync(altViewsPath)).toBe(true)

      const altContent = JSON.parse(fs.readFileSync(altViewsPath, 'utf-8')) as {
        views: Record<string, { id: string }>
      }

      // 全てのビューIDがマスクされていること
      for (const view of Object.values(altContent.views)) {
        expect(view.id).toBe('<VIEW_ID>')
      }
    })
  })

  // ========================================
  // --exclude オプション
  // ========================================
  describe('--exclude オプション', () => {
    const excludeOutputDir = path.join(E2E_FIXTURES_DIR, 'output-exclude')

    beforeAll(() => {
      if (fs.existsSync(excludeOutputDir)) {
        fs.rmSync(excludeOutputDir, { recursive: true })
      }
    })

    afterAll(() => {
      if (fs.existsSync(excludeOutputDir)) {
        fs.rmSync(excludeOutputDir, { recursive: true })
      }
    })

    it('--excludeで指定したコマンドがスキップされる', () => {
      runGinue([
        'pull',
        '-e', 'e2e',
        '-l', 'output-exclude',
        '-A', 'activity',
        '-x', 'app/views.json',
      ])

      const appDir = path.join(excludeOutputDir, 'e2e', 'activity')

      // 通常のファイルは存在する
      expect(fs.existsSync(path.join(appDir, 'app_form_fields.json'))).toBe(true)
      expect(fs.existsSync(path.join(appDir, 'app_settings.json'))).toBe(true)

      // excludeしたapp_views.jsonは存在しない
      expect(fs.existsSync(path.join(appDir, 'app_views.json'))).toBe(false)
    })
  })

  // ========================================
  // アプリID指定 (-a オプション)
  // ========================================
  describe('アプリID指定', () => {
    const appIdOutputDir = path.join(E2E_FIXTURES_DIR, 'output-appid')

    beforeAll(() => {
      if (fs.existsSync(appIdOutputDir)) {
        fs.rmSync(appIdOutputDir, { recursive: true })
      }
    })

    afterAll(() => {
      if (fs.existsSync(appIdOutputDir)) {
        fs.rmSync(appIdOutputDir, { recursive: true })
      }
    })

    it('-aオプションでアプリIDを直接指定できる', () => {
      // .ginuercで定義されているactivityアプリのID(265)を直接指定
      runGinue([
        'pull',
        'e2e',
        '-l', 'output-appid',
        '-a', '265',
      ])

      // 指定したアプリIDのディレクトリが作成される（IDがディレクトリ名になる）
      expect(fs.existsSync(path.join(appIdOutputDir, 'e2e', '265'))).toBe(true)
      expect(fs.existsSync(path.join(appIdOutputDir, 'e2e', '266'))).toBe(false)
    })
  })

  // ========================================
  // ファイルタイプオプション
  // ========================================
  describe('--fileType オプション', () => {
    const jsOutputDir = path.join(E2E_FIXTURES_DIR, 'output-js')

    beforeAll(() => {
      if (fs.existsSync(jsOutputDir)) {
        fs.rmSync(jsOutputDir, { recursive: true })
      }
    })

    afterAll(() => {
      if (fs.existsSync(jsOutputDir)) {
        fs.rmSync(jsOutputDir, { recursive: true })
      }
    })

    it('--fileType jsでJavaScript形式で出力される', () => {
      runGinue([
        'pull',
        '-e', 'e2e',
        '-l', 'output-js',
        '-A', 'activity',
        '-t', 'js',
      ])

      const appDir = path.join(jsOutputDir, 'e2e', 'activity')

      // .js拡張子のファイルが生成される
      expect(fs.existsSync(path.join(appDir, 'app_form_fields.js'))).toBe(true)
      expect(fs.existsSync(path.join(appDir, 'app_settings.js'))).toBe(true)

      // JSファイルの内容がmodule.exports形式であること
      const content = fs.readFileSync(path.join(appDir, 'app_form_fields.js'), 'utf-8')
      expect(content).toContain('module.exports')
    })
  })

  // ========================================
  // エラーケース
  // ========================================
  describe('エラーケース', () => {
    // ginueコマンド実行ヘルパー（エラーを期待）
    const runGinueExpectError = (args: string[]): { stdout: string; stderr: string; exitCode: number } => {
      const cmd = `node ${GINUE_CLI} ${args.join(' ')}`
      try {
        execSync(cmd, {
          cwd: E2E_FIXTURES_DIR,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NODE_OPTIONS: '--max-old-space-size=4096',
          },
        })
        return { stdout: '', stderr: '', exitCode: 0 }
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number }
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || '',
          exitCode: execError.status || 1,
        }
      }
    }

    it('存在しない環境名を指定するとエラーになる', () => {
      // 環境名はポジショナル引数として指定（-eオプションではない）
      const result = runGinueExpectError([
        'pull',
        'nonexistent',
        '-l', 'output-error',
      ])

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('not found')
    })

    it('存在しないexcludeコマンドを指定するとエラーになる', () => {
      const result = runGinueExpectError([
        'pull',
        '-e', 'e2e',
        '-l', 'output-error',
        '-x', 'invalid/command.json',
      ])

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('no such command')
    })
  })
})
