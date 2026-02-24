# 外部ツール連携設計（gyuma / twins-diff）

## 背景

ginue および goqoo ファミリーのツールから gyuma（kintone OAuth）・twins-diff（差分表示）を利用する際の連携方式を定める。

---

## 決定事項：外部ツールは依存パッケージではなく外部コマンドとして呼び出す

### 方針

gyuma・twins-diff ともに、使いたいユーザーが個別にインストールする。  
ginue/goqoo 自体はこれらに依存しない。

```bash
# OAuth を使いたいユーザーだけが入れる
npm install -g gyuma
# または
brew install gyuma

# diff を使いたいユーザーだけが入れる
npm install -g twins-diff
# または
brew install twins-diff
```

### 理由

- 機能を使わないユーザーに Goバイナリを押し付けない
- 各ツールのバージョン管理を ginue のリリースサイクルから切り離せる
- Goバイナリを含む optionalDependencies は node_modules のサイズが大きく、不要なユーザーへの影響が大きい

### 現行からの変更点

現行の twins-diff は `node_modules/.bin/` からフルパスで呼んでいる（依存パッケージ前提）。  
v4 ではこれを PATH から探す方式に変更する。

```ts
// ❌ 現行（v3）：依存パッケージ前提
spawnSync(path.resolve(__dirname, `../node_modules/.bin/twins-diff`), [], {
  stdio: 'inherit',
})

// ✅ v4：PATH から探す
spawnSync('twins-diff', [], {
  stdio: 'inherit',
})
```

---

## 実装方針

### 共通：ツールの存在チェック（事前確認）

各機能を使うコマンドの実行前にツールの存在を確認し、わかりやすいエラーを出す。

```ts
import { execSync } from 'child_process'

const checkCommand = (command: string): boolean => {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// gyuma チェック（--oauth 使用時）
if (!checkCommand('gyuma')) {
  console.error('Error: gyuma がインストールされていません。')
  console.error('  npm install -g gyuma')
  process.exit(1)
}

// twins-diff チェック（diff 使用時）
if (!checkCommand('twins-diff')) {
  console.error('Error: twins-diff がインストールされていません。')
  console.error('  npm install -g twins-diff')
  process.exit(1)
}
```

### gyuma：access_token をキャプチャする

```ts
import { spawnSync } from 'child_process'

const result = spawnSync('gyuma', ['--domain', domain, '--scope', scope], {
  stdio: ['inherit', 'pipe', 'inherit'],
  //      ↑ stdin 継承     ↑ stdout キャプチャ  ↑ stderr 継承
})

const accessToken = result.stdout.toString().trim()
```

### twins-diff / 任意の diff ツール：`[from, to]` を引数として渡す

twins-diff の最新版（Go 版）は `[from, to]` の位置引数に対応している。  
WinMerge・Kaleidoscope・meld など主要な GUI diff ツールも同じインターフェースなので、**分岐なしで統一できる**。

```ts
import { spawnSync } from 'child_process'

const diffTool = opts.diffTool ?? 'twins-diff'
spawnSync(diffTool, [from, to], { stdio: 'inherit' })
```

#### 設定例（.ginuerc.js）

```js
module.exports = {
  // デフォルトは twins-diff
  // diff: { tool: 'twins-diff' },

  // macOS：Kaleidoscope
  // diff: { tool: 'ksdiff' },

  // macOS：FileMerge
  // diff: { tool: 'opendiff' },

  // Windows：WinMerge
  // diff: { tool: 'winmerge' },

  // クロスプラットフォーム：meld
  // diff: { tool: 'meld' },
}
```

#### 現行（v3）からの変更点

v3 では twins-diff を `node_modules/.bin/` からフルパスで呼び、引数なしで起動していた。  
v4 では PATH から探す方式に変更し、`[from, to]` を引数として渡す。

```ts
// ❌ v3：node_modules 前提・引数なし・クエリパラメータで渡す独自方式
spawnSync(path.resolve(__dirname, `../node_modules/.bin/twins-diff`), [], {
  stdio: 'inherit',
})

// ✅ v4：PATH から探す・[from, to] を引数として渡す業界標準方式
spawnSync(diffTool, [from, to], { stdio: 'inherit' })
```

---

## 適用範囲

| ツール | 使用タイミング |
|---|---|
| `gyuma` | `--oauth` オプション使用時 |
| `twins-diff`（または任意の diff ツール） | `ginue diff` コマンド使用時 |

いずれも「その機能を使わない場合はツールのインストール不要」という設計を維持する。
