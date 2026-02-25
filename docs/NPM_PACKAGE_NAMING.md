# npm パッケージ名・公開方針

## 暫定方針

### パッケージ名の方針

goqoo ファミリーのツールは **`@goqoo/` スコープ付き**で統一する。  
ただしフラッグシップの `goqoo` コマンドはスコープなしのまま維持する。

| パッケージ名 | コマンド名 | 備考 |
|---|---|---|
| `goqoo` | `goqoo` | フラッグシップ・スコープなしのまま |
| `@goqoo/ginue` | `ginue` | 現行 `ginue` から移行 |
| `@goqoo/gyuma` | `gyuma` | 現行 `gyuma` から移行 |
| `@goqoo/scouter` | `scouter` | 現行 `twins-diff` から移行・改名 |

パッケージ名はスコープ付きでも、`bin` 名はスコープなしなのでユーザーの操作感は変わらない。

### 旧パッケージの扱い

**wrapper は作らない。deprecation notice のみ。**

```bash
npm deprecate ginue "Renamed to @goqoo/ginue. Please run: npm install -g @goqoo/ginue"
npm deprecate gyuma "Renamed to @goqoo/gyuma. Please run: npm install -g @goqoo/gyuma"
```

wrapper を作らない理由：

- CLI ツールは `npm install -g` し直すだけで移行でき、ユーザーのコードへの影響がゼロ
- ライブラリ（例：babel-core）は `require('babel-core')` と書いたコードが大量に存在するため wrapper が必要だったが、CLI ツールにはそのような事情がない
- Babel 自身も `babel-cli`（CLI ツール）には wrapper を作らず、`@babel/cli` への移行を促す deprecation notice のみで対応している

### scouter の npm パッケージ名について

`scouter` という名前は npm に5年放置の別パッケージが存在するため、そのままでは取得不可。  
`@goqoo/scouter` として公開し、コマンド名（bin）は `scouter` とする。

```bash
# インストール
npm install -g @goqoo/scouter

# 使用（コマンド名はスコープなし）
scouter /path/to/old /path/to/new

# npx での使用
npx @goqoo/scouter /path/to/old /path/to/new
```

旧 `twins-diff`（npm）には deprecation notice を出す。

---

## 未決事項

- 移行のタイミング（v4 リリース時か、それ以前か）
- `@goqoo` org の npm への登録
