# ginue v4 リファクタリング計画

## 概要

v3からv4へのアップデートにおいて、コードベース全体を見直し、保守性・型安全性・テスタビリティを向上させる。

---

## 1. 高優先度（バグの温床）

### 1.1 forEach + async/await の誤用

**箇所**: `cli.ts:23`, `erd.ts:19`

```typescript
// ❌ 現状: Promiseが待たれない
allOpts.forEach(async (opts) => {
  await someAsyncOperation()
})

// ✅ 改善: for...of または Promise.all
for (const opts of allOpts) {
  await someAsyncOperation()
}
// または
await Promise.all(allOpts.map(async (opts) => { ... }))
```

**影響**: 非同期処理の完了を待たずに次の処理に進む重大バグ

---

### 1.2 @ts-expect-error の過剰使用（12箇所）

**箇所**:
- `cli.ts:132`
- `config.ts:59, 158`
- `push.ts:32, 34, 39, 123, 227`
- `converter.ts:23, 30`
- `agent.ts:6`

**改善案**: 型定義を厳密化し、@ts-expect-errorを削除

```typescript
// ❌ 現状
// @ts-expect-error
pushTargetKtn.appId = opts.pushTarget.app[ktn.appName]

// ✅ 改善: 型を明示的に定義
type KtnWithAppId = Ktn & { appId: number }
```

---

### 1.3 JSON.parse の無防備な使用

**箇所**: `cli.ts:144`, `client.ts:48`, `push.ts:161`

```typescript
// ❌ 現状
const message = JSON.parse(error.message!)

// ✅ 改善: 安全なパース関数
function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}
```

---

## 2. 中優先度（保守性）

### 2.1 lodash依存の削除

**箇所**: `pull.ts:3`

```typescript
// ❌ 現状
import { cloneDeep } from 'lodash'
const property = cloneDeep(obj)

// ✅ 改善: 標準APIを使用
const property = structuredClone(obj)
// または
const property = JSON.parse(JSON.stringify(obj))
```

**効果**: バンドルサイズ削減、依存関係簡素化

---

### 2.2 require() 混在の解消

**箇所**: `util.ts:10`, `erd.ts:20-23`, `diff.ts:26`

```typescript
// ❌ 現状
const { version } = require('../package.json')
const { spawnSync } = require('child_process')

// ✅ 改善: ESM import
import { spawnSync } from 'child_process'
import packageJson from '../package.json' assert { type: 'json' }
```

---

### 2.3 エラーハンドリングの統一

**箇所**: `push.ts` 全体

```typescript
// ❌ 現状: .catch() と try-catch の混在
await sendKintoneInfo(...).catch((e) => console.info(e.message))

// ✅ 改善: try-catch で統一
try {
  await sendKintoneInfo(...)
} catch (error) {
  if (isRecoverableError(error)) {
    await handleRecoverableError(error)
  } else {
    throw error
  }
}
```

---

### 2.4 config.ts の責務分割

**箇所**: `config.ts:286-378` (92行の複雑な関数)

```typescript
// ✅ 改善: 責務を分割
class ConfigLoader {
  load(path: string): RawConfig { ... }
}

class ConfigMerger {
  merge(cli: CliOpts, file: FileOpts, env: EnvOpts): Config { ... }
}

class InteractiveInput {
  prompt(questions: Question[]): Promise<Answers> { ... }
}
```

---

### 2.5 Partial<T> の過度な使用

**箇所**: `types.ts:7-45`

```typescript
// ❌ 現状: すべてがoptional
export type BaseOpts = Partial<{
  type: string
  location: string
  domain: string
  // ...
}>

// ✅ 改善: 必須/optionalを明示
export type BaseOptsRequired = {
  domain: string
  apps: AppDic
}

export type BaseOptsOptional = Partial<{
  location: string
  environment: string
}>

export type BaseOpts = BaseOptsRequired & BaseOptsOptional
```

---

## 3. 低優先度（改善推奨）

### 3.1 commands.js のTypeScript化

```typescript
// ✅ commands.ts
export const commands = {
  'app.json': {
    appParam: 'id',
    hasPreview: false,
    methods: ['GET'] as const,
  },
  // ...
} satisfies Record<string, CommandProps>
```

---

### 3.2 依存関係の更新

| 現在 | 更新先 | 理由 |
|------|--------|------|
| minimist | commander/yargs | サブコマンド対応、型サポート |
| inquirer v8 | inquirer v9+ | ESM対応、最新API |
| prettier v2 | prettier v3+ | 最新機能 |
| mkdirp | fs.promises.mkdir | Node.js標準で十分 |

---

### 3.3 テストカバレッジ拡大

**現在のテスト**:
- `util.test.ts`
- `converter.test.ts`
- `e2e/commands.e2e.test.ts`

**追加すべきテスト**:
- `cli.test.ts` - CLIエントリポイント
- `config.test.ts` - 設定マージロジック
- `push.test.ts` - エラーハンドリング

---

## 4. モジュール構造の再編成

### 現在の構造
```
src/
├── cli.ts       # エントリポイント（複雑）
├── config.ts    # 設定（複雑）
├── client.ts
├── pull.ts
├── push.ts      # エラー処理複雑
├── deploy.ts
├── erd.ts
├── diff.ts
├── converter.ts
├── oauth.ts
├── agent.ts
├── util.ts
├── types.ts
└── commands.js
```

### 推奨構造
```
src/
├── cli.ts                    # エントリポイント（最小化）
├── core/
│   ├── Application.ts        # メイン実行エンジン
│   ├── Config.ts             # 設定管理
│   └── Auth.ts               # 認証戦略
├── commands/
│   ├── PullCommand.ts
│   ├── PushCommand.ts
│   ├── DeployCommand.ts
│   ├── ResetCommand.ts
│   ├── ErdCommand.ts
│   └── DiffCommand.ts
├── kintone/
│   ├── Client.ts             # HTTP通信
│   ├── ErrorHandler.ts       # エラーハンドリング
│   └── CommandRegistry.ts    # API定義
├── converter/
│   ├── AppSettingsConverter.ts
│   ├── FormFieldsConverter.ts
│   └── AppIdConverter.ts
├── utils/
│   ├── file.ts
│   ├── logger.ts
│   ├── validation.ts
│   └── format.ts
├── types.ts
└── constants.ts
```

---

## 5. コード内TODO一覧（主要なもの）

| ファイル | 行 | 内容 |
|---------|-----|------|
| `pull.ts` | 3 | lodash 削除 |
| `pull.ts` | 129 | revisionの重複保存対策 |
| `config.ts` | 18 | オプション複数指定の統一 |
| `config.ts` | 96 | chalkでの色付け |
| `config.ts` | 123 | basic処理の共通化 |
| `config.ts` | 216 | minimistの置き換え |
| `push.ts` | 207 | カスタマイズファイルのアップロード |
| `converter.ts` | 68 | アプリ名での復元機能 |
| `util.ts` | 100 | エラーメッセージの統一 |

---

## 6. 移行戦略

### Phase 1: 基盤整備
- [ ] forEach + async の修正
- [ ] @ts-expect-error の削減
- [ ] 型定義の厳密化

### Phase 2: 依存関係整理
- [ ] lodash 削除
- [ ] require → import 統一
- [ ] 依存パッケージ更新

### Phase 3: 構造改善
- [ ] エラーハンドリング統一
- [ ] config.ts 分割
- [ ] commands.js TypeScript化

### Phase 4: テスト強化
- [ ] cli.test.ts 追加
- [ ] config.test.ts 追加
- [ ] カバレッジ目標設定

### Phase 5: モジュール再編成
- [ ] 新構造への段階的移行
- [ ] 後方互換性の確認

---

## 7. 破壊的変更の候補

v4では以下の破壊的変更を検討:

1. **Node.js最低バージョン**: 18 → 20
2. **設定ファイル**: `.ginuerc.js` のCommonJS形式を維持しつつ、ESM形式もサポート
3. **CLI引数**: minimist → commander/yargs でサブコマンド体系を整理
4. **出力形式**: エラーメッセージの統一、色付け対応

---

*作成日: 2024年*
*対象バージョン: v3.x → v4.0*
