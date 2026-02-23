# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

GinueはkintoneアプリのREST API設定情報をGitライクなワークフローで管理するCLIツール。フィールド、フォーム、ビュー、ACL、カスタマイズなどの設定をローカルJSONファイルとして管理し、複数環境間での設定移行を可能にする。

## 開発コマンド

```bash
# ビルド（TypeScriptをdist/へコンパイル）
yarn build

# ローカル実行（ビルド後）
node dist/cli.js <command>

# Lint
yarn eslint src/

# テスト
yarn test          # Jest実行

# API定義の確認
yarn apis:all      # kintoneから全API取得
yarn apis:ginue    # ginue対応API確認
yarn apis:diff     # 差分確認
```

### テスト構成

```
test/
├── util.test.ts           # trim, pretty, createBase64Account, createBaseDirPath
├── converter.test.ts      # convertAppSettingsJson, convertAppFormFieldsJson, convertAppIdToName
├── e2e/
│   └── commands.e2e.test.ts  # E2Eテスト（pull/push/deploy/reset、24テストケース）
├── fixtures/
│   ├── push/              # push変換テスト用フィクスチャ
│   └── e2e/               # E2Eテスト用設定（.ginuerc.js等）
└── deno-poc/              # Deno移行検証用POC
```

**E2Eテスト実行:**
```bash
yarn test:e2e    # E2Eテストのみ
yarn test:all    # ユニット + E2E
```

## アーキテクチャ

```
src/
├── cli.ts       # エントリポイント: コマンドパース→認証→各機能呼び出し
├── config.ts    # 設定読み込み: CLI引数 > .ginuerc > .netrc > 環境変数
├── client.ts    # kintone HTTP通信: GET/PUT/ファイルダウンロード
├── pull.ts      # kintone設定をJSONファイルへ保存
├── push.ts      # JSONファイルをkintoneへアップロード
├── deploy.ts    # テスト環境→運用環境への反映/キャンセル
├── erd.ts       # ルックアップ関係からER図(PlantUML)生成
├── diff.ts      # twins-diffを起動して環境間差分表示
├── commands.js  # 対応kintone APIの定義（11種類）
├── converter.ts # JSON正規化・変換ユーティリティ
├── types.ts     # 型定義
└── util.ts      # 汎用ヘルパー
```

### 主要な処理フロー

**Pull**: `fetchKintoneInfo()` → JSONソート正規化 → revisionを別ファイルに分離 → Prettier整形 → ファイル保存

**Push**: ローカルJSON読み込み → 環境間のアプリID変換 → `sendKintoneInfo()`でプレビュー環境へ送信 → エラー時のフィールド自動追加/削除

### commands.js の構造

各APIコマンドは以下のプロパティを持つ:
- `appParam`: アプリIDパラメータ名（`id`または`app`）
- `hasPreview`: プレビュー(テスト)環境対応
- `methods`: 対応HTTPメソッド
- `langParam`: 言語パラメータ対応（任意）
- `skipOauth`: OAuth時スキップ（任意）

### 認証方式

Basic認証、ユーザー名/パスワード、OAuth 2.0、クライアント証明書に対応。

### 環境間push

`ginue push dev:prod`形式でdev環境のJSONをprod環境へpush可能。ルックアップフィールドのアプリID参照も自動変換される。

## コーディング規約

- コメントは日本語で記述
- コンソール出力は状況に応じて日英使い分け
