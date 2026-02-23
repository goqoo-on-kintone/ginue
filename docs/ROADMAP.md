# Ginue ロードマップ

## バージョン

- **v2**: Node.js（JavaScript）版 - メンテナンスモード
- **v3**: Node.js（TypeScript）版 - 現行、早い段階でv4にアップデート予定
- **v4**: 次世代版（Node.js, Deno, or Golang） - 検討中

## v3.0.x 改善（完了）

- [x] README.md 英語版作成
- [x] README.ja.md 日本語版整備
- [x] 全機能のドキュメント化（ginue diff, --oauth, --preview, --alt, --downloadJs, --proxy）
- [x] テストコード追加（util.ts, converter.ts）
- [x] package.json testスクリプト設定
- [x] バージョン番号を3.0.0に更新
- [x] CHANGELOGまたはリリースノート作成
- [x] `--dry-run`オプション追加（pushせずに変換後JSONを確認）
- [x] E2Eテスト追加（24テストケース、全コマンドをカバー）
- [x] push変換ロジックのユニットテスト追加
- [ ] npm publish

---

## v4の方向性検討

### Go言語への移行（当初の計画）

ginue、gyuma、twins-diff の3ツールをGoで書き直し、単一バイナリ配布を実現する。

**課題:**
- `.ginuerc.js`の動的設定が使えなくなる（JSON/YAMLのみに制限）
- 開発コスト（8-11週間）
- kintone開発者（JS/TS経験者）からのコントリビューションが減少

### Deno移行（代替案）

**検証結果:** `deno compile`でシングルバイナリを生成しつつ、`.ginuerc.js`の動的読み込みが可能であることを確認。

```typescript
// CommonJS形式をeval方式でエミュレート
const content = await Deno.readTextFile(configPath)
const module = { exports: {} }
const process = { env: Deno.env.toObject() }
const fn = new Function('module', 'exports', 'process', content)
fn(module, exports, process)
```

**メリット:**
- シングルバイナリ配布（Go同様）
- `.ginuerc.js`の動的設定を維持可能
- TypeScriptコードの多くを流用可能

**検証用POC:** `test/deno-poc/`

### 結論

Node.js/TypeScriptの開発継続とDeno移行の両方が現実的な選択肢。v4の具体的な方針は今後決定。

---

## Go版の詳細計画（参考）

以下はGo移行を進める場合の詳細計画。

### 概要

ginue、gyuma、twins-diff の3ツールをGoで書き直し、単一バイナリ配布を実現する。

## リポジトリ構成

```
github.com/goqoo-on-kintone/ginue-go/     # 新規作成（メインツール）
github.com/goqoo-on-kintone/gyuma-go/     # 新規作成
github.com/the-red/twins-diff/            # 既存リポジトリでGo化（React維持）

# 既存リポジトリ（TypeScript版）はメンテナンスモードへ
github.com/goqoo-on-kintone/ginue/        # → Go版への移行案内
github.com/goqoo-on-kintone/gyuma/        # → Go版への移行案内
```

| ツール | 現状 | Go化後 |
|--------|------|--------|
| ginue | TypeScript 1,500行 | 単一バイナリ |
| gyuma | TypeScript (OAuth) | Ginueに内蔵 + 単独配布 |
| twins-diff | TypeScript 343行 | Ginueに内蔵 + 単独配布 |

## バージョン

Go版は **v4.0.0** からスタート（v3は欠番）

```
v2.x    JavaScript正式版（メンテナンスモード）
v3.x    TypeScriptベータ版（@next、廃止予定）
v4.x    Go版 ← 新規
```

## 最終成果物

```bash
# npm不要、バイナリ1つで動作
ginue pull development
ginue push dev:prod
ginue diff dev prod
ginue deploy production
```

---

## Phase 0: twins-diff Go化（3-5日）

- [x] Go HTTPサーバー + API実装
- [x] React UIビルド → go:embed組み込み
- [x] 差分ロジック（フロントエンドのreact-diff-viewer-continuedで処理）
- [x] 単独CLI作成
- [x] pkg/diffとしてライブラリ化

## Phase 1: gyuma Go化（1-2週間）

- [x] OAuth 2.0 フロー実装
- [x] ローカルコールバックサーバー
- [x] トークン管理
- [x] 単独CLI作成
- [ ] pkg/oauthとしてライブラリ化（ginue統合に必須）

※ プロキシ/クライアント証明書対応 → Phase 3でまとめて対応
※ PKCE対応 → 将来対応（kintone OAuthはPKCE無しでも動作）

## Phase 2: Ginue基盤（1週間）

- [ ] Go モジュール初期化
- [ ] cobra CLIフレームワーク構築
- [ ] .ginuerc 読込（JSON/YAML対応）
- [ ] .netrc 読込
- [ ] 型定義

## Phase 3: Kintoneクライアント（1週間）

- [ ] HTTPクライアント基盤
- [ ] 認証ヘッダー（Basic, X-Cybozu-Authorization）
- [ ] OAuth認証（gyuma統合）
- [ ] プロキシ対応
- [ ] クライアント証明書対応
- [ ] 11エンドポイント定義

## Phase 4: Pull実装（1週間）

- [ ] APIデータ取得
- [ ] JSON正規化（ソート）
- [ ] revision分離
- [ ] preview オプション
- [ ] alt オプション
- [ ] カスタマイズJS/CSSダウンロード

## Phase 5: Push実装（1-2週間）

- [ ] ローカルJSON読込
- [ ] preview API PUT
- [ ] 環境間アプリID変換
- [ ] エラーリカバリ
  - [ ] GAIA_FC01: フィールド自動追加
  - [ ] GAIA_FN11: フィールド自動削除
  - [ ] CB_VA01: サブテーブルフィールド削除
  - [ ] CB_NO02: 権限エラースキップ
- [ ] 確認プロンプト

## Phase 6: Deploy/Reset + ERD（1週間）

- [ ] ginue deploy 実装
- [ ] ginue reset 実装
- [ ] ginue erd 実装（PlantUML出力）

## Phase 7: Diff統合（2-3日）

- [ ] twins-diff-go/pkg/diff をimport
- [ ] ginue diff コマンド実装

## Phase 8: リリース準備（1週間）

- [ ] 統合テスト
- [ ] クロスコンパイル
  - [ ] darwin/amd64
  - [ ] darwin/arm64
  - [ ] linux/amd64
  - [ ] linux/arm64
  - [ ] windows/amd64
- [ ] README更新
- [ ] マイグレーションガイド作成
- [ ] GitHub Releases設定

---

## プロジェクト構造

```
# gyuma（単独配布 + ライブラリ）
gyuma-go/
├── cmd/gyuma/main.go         # スタンドアロンCLI
├── pkg/oauth/                # ライブラリ（Ginueからimport）
│   ├── client.go             # OAuth 2.0 + PKCE
│   ├── server.go             # コールバックサーバー
│   └── token.go              # トークン管理
└── go.mod

# twins-diff（既存リポジトリでGo化）
twins-diff/
├── cmd/twins-diff/main.go    # Go CLI（新規）
├── pkg/diff/                 # ライブラリ（Ginueからimport）
│   ├── server.go
│   ├── handler.go
│   └── diff.go
├── web/dist/                 # Reactビルド成果物 → go:embed
├── frontend/                 # Reactソース（既存のpages/components等を移動）
├── go.mod                    # 新規
└── package.json              # frontendビルド用に残す

# ginue（メインツール）
ginue-go/
├── cmd/ginue/main.go
├── internal/
│   ├── cli/
│   ├── config/
│   ├── kintone/
│   ├── pull/
│   ├── push/
│   ├── deploy/
│   └── erd/
├── go.mod                    # gyuma-go, twins-diff をimport
└── Makefile
```

## 主要ライブラリ

| 用途 | ライブラリ |
|------|-----------|
| CLI | spf13/cobra |
| 設定 | spf13/viper |
| YAML | gopkg.in/yaml.v3 |
| プロンプト | manifoldco/promptui |
| .netrc | bgentry/go-netrc |
| ブラウザ起動 | pkg/browser |

## 注意点

- .ginuerc.js 形式は非対応（JSON/YAMLに移行）
- twins-diffのReact UIはビルド済みをgo:embedで組み込み

## 推定工数

**合計: 8-11週間**
