# 外部ツール連携設計（gyuma / scouter）

## 背景

ginue および goqoo ファミリーのツールから gyuma（kintone OAuth）・scouter（差分表示）を利用する際の連携方式を定める。

---

## 方針

### gyuma：外部コマンドとして呼び出す（確定）

OAuthを使うユーザーだけが個別にインストールする。ginue は gyuma に依存しない。

```bash
npm install -g gyuma
# または
brew install gyuma
```

**理由：**
- OAuthを使わないユーザーへの影響をゼロにする
- gyuma のバージョン管理を ginue のリリースサイクルから切り離せる

### scouter：外部コマンド or バンドル（検討中）

`ginue diff` を使うユーザーは全員 scouter が必要になるため、バンドルも選択肢として残している。

**外部コマンド方式（gyuma と同じ扱い）**
```bash
npm install -g scouter
# または
brew install scouter
```
- 他の diff ツール（WinMerge・Kaleidoscope など）への差し替えが容易
- ginue のパッケージサイズへの影響ゼロ

**バンドル方式（optionalDependencies）**
- `ginue diff` がインストール直後から使える
- 代替ツールの選択肢がほぼない（同コンセプトのツールが scouter 以外にほぼ存在しない）ため、バンドルの妥当性が高い
- Go + embedded React のバイナリサイズはプラットフォームあたり 8MB 前後の見込み

### 現行からの変更点

現行の twins-diff（v3 時点の名称）は `node_modules/.bin/` からフルパスで呼んでいる（依存パッケージ前提）。  
v4 では scouter に改名し、PATH から探す方式に変更する（バンドルする場合も同様）。

> **名前について**: twins-diff は the-red（個人リポジトリ）から goqoo ファミリーに移管し、**scouter** に改名する予定。  
> `scouter` という名前のコマンドは既存ツールと競合しないことを確認済み。

```ts
// ❌ 現行（v3）：依存パッケージ前提
spawnSync(path.resolve(__dirname, `../node_modules/.bin/twins-diff`), [], {
  stdio: 'inherit',
})

// ✅ v4：PATH から探す
spawnSync('scouter', [], {
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

// scouter チェック（diff 使用時）
if (!checkCommand('scouter')) {
  console.error('Error: scouter がインストールされていません。')
  console.error('  npm install -g scouter')
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

### scouter / 任意の diff ツール：`[from, to]` を引数として渡す

scouter の最新版（Go 版）は `[from, to]` の位置引数に対応している。  
WinMerge・Kaleidoscope・meld など主要な GUI diff ツールも同じインターフェースなので、**分岐なしで統一できる**。

```ts
import { spawnSync } from 'child_process'

const diffTool = opts.diffTool ?? 'scouter'
spawnSync(diffTool, [from, to], { stdio: 'inherit' })
```

#### 設定例（.ginuerc.js）

```js
module.exports = {
  // デフォルトは scouter
  // diff: { tool: 'scouter' },

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

v3 では scouter を `node_modules/.bin/` からフルパスで呼び、引数なしで起動していた。  
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
| `scouter`（または任意の diff ツール） | `ginue diff` コマンド使用時 |

いずれも「その機能を使わない場合はツールのインストール不要」という設計を維持する。
