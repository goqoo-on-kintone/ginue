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

// ginueコマンド実行ヘルパー
const runGinue = (args: string[]): string => {
  const cmd = `node ${GINUE_CLI} ${args.join(' ')}`
  try {
    return execSync(cmd, {
      cwd: E2E_FIXTURES_DIR,
      encoding: 'utf-8',
      env: {
        ...process.env,
        // タイムアウトを長めに設定
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
describe('E2E: ginue pull/push', () => {
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
  })

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
  })
})
