# Ginue

Ginue is the CLI tool to edit settings of kintone via kintone REST API.

[kintone REST API](https://developer.cybozu.io/hc/ja/articles/201941834)でkintoneアプリの設定情報を編集するためのCLI版ツールです。

## インストール方法

グローバルにインストールする場合

```
$ npm install -g ginue
 or
$ yarn global add ginue
```

プロジェクトごとにインストールする場合

```
$ npm install --save-dev ginue
 or
$ yarn add --dev ginue
```

## 使い方

Gitライクな一連のコマンドを提供します。

* [ginue pull](#ginue-pull) : kintoneの設定情報を取得します。
* [ginue push](#ginue-push) : kintoneの設定情報を送信します。
* [ginue deploy](#ginue-deploy) : kintoneアプリの設定を運用環境へ反映します。
* [ginue reset](#ginue-reset) : kintoneアプリの設定の変更をキャンセルします。

### 共通オプション

#### コマンドライン引数から指定
```
  -v, --version                 Output version information
  -h, --help                    Output usage information
  -d, --domain=<DOMAIN>         kintone domain name
  -u, --user=<USER>             kintone username
  -p, --password=<PASSWORD>     kintone password
  -a, --app=<APP-ID>            kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>  kintone guest space ID
  -b, --basic=<USER[:PASSWORD]> kintone Basic Authentication user and password
  -l, --location=<LOCATION>     Location of settings file
  -t, --fileType                Set file type 'json'(default) or 'js'
```

* `domain` `user` `password` `app`オプションを省略した場合、標準入力を求められます。
* アプリID（`app`オプション or 標準入力）はカンマ区切りで複数指定可能です。
* ゲストスペース内のアプリ情報を取得する場合は`guest`オプションが必須です。
* Basic認証を使用する場合は`basic`オプションが必須です。パスワードを省略した場合、標準入力を求められます。
* `location`オプションを指定すると、kintone設定情報ファイルの保存フォルダを指定できます。（省略時はカレントディレクトリ）
* `js`オプションを指定すると、kintone設定情報ファイルを`.json`ではなく`.js`形式で扱います。
* コマンドライン引数のほか、後述する`.ginuerc`や`.netrc`でもオプション指定が可能です
  * 優先順位は `.netrc < .ginuerc < 引数`

#### .ginuerc

コマンドを実行するディレクトリに`.ginuerc`という設定ファイルを作成すると、`ginue`実行時に自動的に読み込まれてオプション指定を省略できます。プロジェクト単位で`.ginuerc`を作成すると便利です。

* フォーマットはJSON/JS/YAMLの3種類に対応しています。
  * .ginuerc.json
  ```json
  {
    "location": "kintone-settings",
    "domain": "ginue.cybozu.com",
    "username": "Administrator",
    "password": "myKintonePassword",
    "app": [10, 11, 12],
    "guest": 5
  }
  ```
  * .ginuerc.js
  ```js
  module.exports = {
    location: 'kintone-settings',
    domain: 'ginue.cybozu.com',
    username: 'Administrator',
    password: 'myKintonePassword',
    app: [10, 11, 12],
    guest: 5,
  }
  ```
  * .ginuerc.yml
  ```yaml
    location: kintone-settings
    domain: ginue.cybozu.com
    username: Administrator
    password: myKintonePassword
    app:
      - 10
      - 11
      - 12
    guest: 5
  ```
* `env`プロパティを使用すると、異なる環境のアプリをグルーピングできます。
  * 各環境別にオブジェクトを作成し、プロパティは環境名として自由に設定します。(ex. `development`, `production`)
  * `ginue pull`時には各環境ごとにディレクトリが作成され、配下にJSONファイルが保存されます。
    * デフォルトでは環境名＝ディレクトリ名
    * 各環境に`location`プロパティを指定すると、`location`の値＝ディレクトリ名
    * トップレベルに`location`プロパティを指定すると、`location`のディレクトリ配下に、各環境のサブディレクトリを作成
* `app`プロパティにオブジェクトを指定すると、アプリIDではなくアプリ名のディレクトリにJSONが保存されます。

```json
{
  "location": "kintone-settings",
  "env": {
    "development": {
      "domain": "ginue-dev.cybozu.com",
      "username": "Administrator",
      "password": "myKintonePassword",
      "app": {
        "user": 128,
        "order": 129,
        "bill": 130
      },
      "basic": "Administrator:myBasicAuthPassword"
    },
    "production": {
      "location": "__PRODUCTION__",
      "domain": "ginue.cybozu.com",
      "username": "Administrator",
      "password": "myKintonePassword",
      "app": {
        "user": 10,
        "order": 11,
        "bill": 12
      },
      "guest": 5
    }
  }
}
```

## ginue pull

* カレントにアプリID名のディレクトリが作成され、その中に全JSONファイルが保存されます。
* 取得するJSONファイルは`commands.conf`に記載します。`ginue`コマンドファイルと同じディレクトリに格納してください。
* `app/settings.json` `preview/app/settings.json`以外のJSONファイルでは、`revision`要素が無視されます。

実行例

```
$ ginue pull -d ginue.cybozu.com -g 5 -a 10,11,12 -u Administrator
$ ginue pull -d ginue.cybozu.com -b Administrator -a 10,11,12 -u Administrator -l kintone-settings
```

## ginue push
## ginue deploy
## ginue reset
