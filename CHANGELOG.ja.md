# Changelog

[English](/CHANGELOG.md) | 日本語

このプロジェクトの注目すべき変更点をこのファイルに記録します。

## [3.0.0] - 2024-XX-XX

TypeScript版の最初で最後のリリース。v4以降はGo言語で書き直す予定。

### Breaking Changes

- **Node.js要件**: Node.js 7.6+ → **16+** に引き上げ
- **コードベース**: JavaScript → TypeScript に完全移行
- **エントリポイント**: `./index.js` → `./dist/cli.js` に変更
- **テストフレームワーク**: Mocha/power-assert → Jest に変更
- **form.json**: 実用性が低いためpull対象から除外

### New Features

#### 認証
- **OAuth 2.0認証** (`--oauth`): gyumaを使用したOAuth認証に対応
- **クライアント証明書** (`--pfxFilepath`, `--pfxPassword`): クライアント証明書認証に対応

#### ネットワーク
- **プロキシサポート** (`--proxy`): プロキシサーバー経由でのアクセスに対応
- プロキシ認証情報を`.netrc`から読み取り可能

#### 新コマンド
- **ginue diff**: [twins-diff](https://github.com/the-red/twins-diff)を使用した環境間の視覚的差分比較

#### Pull機能強化
- **JS/CSSダウンロード** (`--downloadJs`): カスタマイズファイルのダウンロードに対応
- **代替フォーマット** (`--alt`): 環境依存の値をマスクした形式で保存
- **グラフ設定API** (`reports.json`): レポート設定の取得に対応
- **ソート済みJSON出力**: views.json、ドロップダウン項目を自動ソート
- `--preview`指定時も同じフォルダにpull（別フォルダ不要に）

#### Push機能強化
- **サブテーブルフィールド対話的追加/削除**: push時にフィールド差分を対話的に解決
- **カスタマイズビュースキップ**: views.jsonにカスタマイズビューが含まれる場合、対話的にスキップ可能
- 処理中の環境/アプリ名を標準出力に表示

### Bug Fixes

- プロキシ認証情報を`.netrc`から読み取れないバグを修正
- OAuthのときはJSダウンロードをスキップ（API制限対応）
- layout.jsonの通常エラー時の処理を修正
- views.jsonのカスタマイズビュースキップが正しく動作しないバグを修正
- サブテーブルフィールド追加が正しくされないバグを修正
- `--preview`と非previewが不定に混在するバグを修正
- 各種nullエラーを修正
- fileKeyが配列として扱われるバグを修正
- 型の誤り修正（AppAcl → FieldAcl）

### Internal Changes

- 全ソースコードをTypeScriptに移行
- `@kintone/rest-api-client`の型定義を活用
- ESLintをTypeScript対応に更新
- Jestによるユニットテスト追加（util.ts, converter.ts）
- Prettier 1.x → 2.x にアップグレード
- 依存関係の整理（request/request-promise → node-fetch）

### Dependencies

#### Added
- `gyuma`: OAuth 2.0認証
- `twins-diff`: 環境間差分表示
- `proxy-agent`: プロキシサポート
- `open`: ブラウザ起動
- TypeScript関連パッケージ

#### Removed
- `request` / `request-promise`: node-fetchに置き換え
- `require-from-string`: 不要になったため削除
- `tslib`: TypeScript移行により不要

---

## [2.2.1] - 2020-05-07

### Features

- 環境変数によるBasic認証設定をサポート (`GINUE_BASIC`)

### Security

- minimist 1.2.0 → 1.2.3 にアップグレード

---

## [2.2.0] - 2020-05-07

### Features

- **環境変数対応**: `GINUE_USERNAME`, `GINUE_PASSWORD`, `GINUE_BASIC`等の環境変数から認証情報を設定可能に

### Bug Fixes

- form-alt.jsonでサブテーブル内フィールドも自動ソートされるように修正
- push時の「App not found in environment」エラーが不適切に表示されるバグを修正

### Security

- 複数の依存関係のセキュリティアップデート

---

## [2.1.0] - 2019-02-19

### Features

- **対話的フィールド追加**: push時にフィールドが不足している場合、対話的に新規フィールドを追加可能
- **対話的フィールド削除**: push時に余分なフィールドがある場合、対話的に削除可能
- **言語切り替え**: kintone APIレスポンスの言語を切り替え可能
- OAuth 2.0認証の基盤処理を作成

### Bug Fixes

- push時にenvironment名が誤表記されるバグを修正
- エラーメッセージの表示を改善

---

## [2.0.0] - 2018-11-26

v1からの大規模アップデート。push機能の追加とginuercフォーマットの刷新。

### Breaking Changes

- **ginuerc形式変更**: 配列形式 → `env`オブジェクト形式に変更
- **outputオプション廃止**: `location`オプションに名称変更

### New Features

#### 新コマンド
- **ginue push**: ローカルJSONファイルをkintoneにアップロード
- **ginue deploy**: テスト環境の設定を運用環境へ反映
- **ginue reset**: テスト環境の変更をキャンセル
- **ginue erd**: ルックアップ関係からPlantUML形式のER図を生成

#### 環境間連携
- **別環境へのpush**: `ginue push dev:prod`形式で別環境へpush可能
- ルックアップフィールドのアプリID参照を自動変換

#### Pull機能強化
- **--alt オプション**: 環境依存の値をマスクした代替フォーマットで保存
- **--preview オプション**: テスト環境のJSONを取得
- **--js オプション**: JS形式でkintone情報を保存
- アプリ名の自動マスク

#### 認証強化
- **.netrc対応**: ユーザー名・パスワードを.netrcから読み取り可能
- Basic認証情報も.netrcから読み取り可能

#### 設定ファイル
- **ginuerc拡張**: YAML, JS形式に対応（rc-config-loader使用）
- **excludeオプション**: 特定のAPIを除外可能
- **-l/--location オプション**: コマンドラインからlocationを設定可能

#### その他
- バージョン情報出力 (-v/--version)
- コマンドごとのヘルプ表示 (-h/--help)
- アプリ個別の処理 (-A/--appName)

### Bug Fixes

- --previewをつけるとpreview版だけ2重でpullされるバグを修正
- excludeが1つの時に動かないバグを修正
- ginuercが存在しないときのpush/deploy/resetの動作を修正

### Internal Changes

- Prettierによるコードフォーマット導入
- Mocha + power-assertによるテスト環境構築
- ソースコードをlibディレクトリに整理

---

## [1.2.0] - 2018-01-19

### Features

- **Basic認証対応** (`-b/--basic`): Basic認証のユーザー名・パスワードを指定可能
- **アプリ名ディレクトリ**: アプリIDではなくアプリ名でディレクトリを作成可能

### Bug Fixes

- コマンドライン引数から複数アプリIDを渡せなくなったデグレを修正
- 標準出力の表示を修正

---

## [1.1.0] - 2018-01-18

### Features

- **複数環境対応**: ginuercに複数環境を配列で指定し、environmentでディレクトリを分ける機能を追加
- 複数環境の標準入力が綺麗にできるように改善

### Bug Fixes

- オプション処理で引数の組み合わせによって全体の挙動が異なるバグを修正

---

## [1.0.0] - 2017-12-01

初回リリース。kintoneアプリの設定情報をローカルJSONファイルとして取得する機能を提供。

### Features

- **ginue pull**: kintoneアプリの設定情報をJSONファイルとして保存
- 対応API: app, form, fields, layout, views, acl, field_acl, customize, settings, status
- **複数アプリ対応**: カンマ区切りで複数アプリIDを指定可能
- **ゲストスペース対応** (`-g/--guest`)
- **.ginuerc設定ファイル**: JSON形式の設定ファイルに対応
- revisionを別ファイル（revision.json）に分離
