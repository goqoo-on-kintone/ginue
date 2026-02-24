# Gyuma 連携設計

## 背景

ginue および goqoo ファミリーのツールから kintone OAuth を利用する際の、gyuma との連携方式を定める。

---

## 決定事項：gyuma は依存パッケージではなく外部コマンドとして呼び出す

### 方針

OAuth を使う場合のみ、ユーザーが個別に gyuma をインストールする。  
ginue/goqoo 自体は gyuma に依存しない。

```bash
# OAuth を使いたいユーザーだけが入れる
npm install -g gyuma
# または
brew install gyuma
```

### 理由

- OAuth を使わないユーザーに Goバイナリを押し付けない
- gyuma のバージョン管理を gyuma 自身に委ねられる（ginue のリリースサイクルに引きずられない）
- Goバイナリを含む optionalDependencies は node_modules のサイズが大きく、不要なユーザーへの影響が大きい

### 参考：現行の twins-diff の呼び出し方（依存パッケージ方式）

```ts
// src/diff.ts
const { spawnSync } = require('child_process')
spawnSync(path.resolve(__dirname, `../node_modules/.bin/twins-diff`), [], {
  stdio: 'inherit',
})
```

twins-diff は `node_modules/.bin/` からフルパスで呼んでいる（依存パッケージ前提）。  
gyuma はこれとは異なり、PATH から探す方式を採用する。

---

## 実装方針

### gyuma コマンドを PATH から呼び出す

```ts
import { spawnSync } from 'child_process'

const result = spawnSync('gyuma', ['--domain', domain, '--scope', scope], {
  stdio: ['inherit', 'pipe', 'inherit'],
})

if (result.error) {
  // gyuma が見つからない場合
  throw new Error(
    'gyuma がインストールされていません。\n' +
    'OAuth を利用するには gyuma をインストールしてください:\n' +
    '  npm install -g gyuma\n' +
    '  または\n' +
    '  brew install gyuma'
  )
}

const accessToken = result.stdout.toString().trim()
```

### gyuma の存在チェック（事前確認）

OAuth を使うコマンドの実行前に gyuma の存在を確認し、わかりやすいエラーを出す。

```ts
import { execSync } from 'child_process'

const checkGyuma = (): boolean => {
  try {
    execSync('gyuma --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (!checkGyuma()) {
  console.error('Error: gyuma がインストールされていません。')
  console.error('  npm install -g gyuma')
  process.exit(1)
}
```

---

## 適用範囲

- `ginue` の `--oauth` オプション使用時
- `goqoo` ファミリーの OAuth 連携部分

いずれも「OAuth を使わない場合は gyuma は不要」という設計を維持する。
