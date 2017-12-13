# ginue

ginue is the CLI tool to get settings of kintone via kintone REST API.

kintoneアプリの設定情報を取得するCLI版ツールです。[kintone REST API](https://developer.cybozu.io/hc/ja/articles/201941834)で情報を取得します。

以下で動作確認済み
* macOS Sierra (Node.js v8.2.1)
* Windows 10 (Node.js v8.2.1)

## インストール方法
```
$ npm install ginue
```
or
```
$ yarn add ginue
```

## 使い方
現在、全JSONを一括保存する`ginue pull`が使えます。
（標準出力の`ginue show`、kintoneに設定を反映する`ginue push`を今後実装予定）


```
$ ginue pull [OPTIONS]
```

オプション一覧

```
-d, --domain=<domain>         kintone sub domain name
-u, --user=<username>         kintone username
-p, --password=<password>     kintone password
-a, --app=<app-id>            kintone app ids
-g, --guest=<guest-space-id>  kintone app ids
```

## ginue pull
* カレントにアプリID名のディレクトリが作成され、その中に全JSONファイルが保存されます。
* 取得するJSONファイルは`commands.conf`に記載します。`ginue`コマンドファイルと同じディレクトリに格納してください。
* `app/settings.json` `preview/app/settings.json`以外のJSONファイルでは、`revision`要素が無視されます。

実行例

```
$ ginue pull -d ginue.cybozu.com -g 5 -a 10,11,12 -u Administrator
```

## 共通仕様
* オプション引数を指定せずに起動した場合、標準入力を求められます。（`-g`オプション以外）
* ゲストスペース内のアプリ情報を取得する場合は`-g`オプションが必須です。
* アプリID（`-a`オプション or 標準入力）はカンマ区切りで複数指定可能です。

コマンドを実行するディレクトリに`.ginuerc.json`という設定ファイルを作成すると、`ginue`実行時に自動的に読み込まれてオプション指定を省略できます。プロジェクト単位で`.ginuerc.json`を作成すると便利です。

`.ginuerc.json`記述例
```
{
  "domain": "ginue.cybozu.com",
  "username": "Administrator",
  "password": "myKintonePassword",
  "app": [10, 11, 12],
  "guest": 5
}
```
