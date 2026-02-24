# .netrc 設計

## 概要

ginue および gyuma は `.netrc` / `.netrc.gpg` を認証情報の保存先として使用する。  
**読み込みのみ対応。書き込みはユーザーが自分で行う。**

---

## フォーマット

同一ホストに対して複数の認証情報を `:suffix` で分離して管理する。

```
# kintone ユーザー認証（ginue）
machine example.cybozu.com
  login    kintoneユーザー名
  password kintoneパスワード

# Basic 認証 / リバースプロキシ（ginue）
machine example.cybozu.com:basic
  login    basic_user
  password basic_password

# OAuth アプリ認証（gyuma）
machine example.cybozu.com:oauth
  login    client_id
  password client_secret

# プロキシ認証（ginue）
machine proxy.example.com
  login    proxy_user
  password proxy_password
```

---

## v3 からの変更点

v3 では Basic 認証を同一 machine ブロックの `account` フィールドに格納していた。  
`account` は .netrc の標準仕様外のフィールドであり、v4 では `:basic` suffix に変更する。

```
# ❌ v3：account フィールド（仕様外）
machine example.cybozu.com
  login    kintoneユーザー名
  password kintoneパスワード
  account  basic_user:basic_password

# ✅ v4：:basic suffix（明示的・標準的）
machine example.cybozu.com
  login    kintoneユーザー名
  password kintoneパスワード

machine example.cybozu.com:basic
  login    basic_user
  password basic_password
```

---

## GPG 暗号化

`.netrc.gpg` が存在する場合はそちらを優先して読み込む。  
暗号化・復号はユーザーが自分で行う。

```bash
# 編集手順（.netrc.gpg が既に存在する場合）
gpg --decrypt ~/.netrc.gpg > /tmp/netrc_plain
vi /tmp/netrc_plain
gpg --encrypt --recipient your@email.com /tmp/netrc_plain > ~/.netrc.gpg
rm /tmp/netrc_plain
```

---

## 読み込み優先順位

ginue・gyuma ともに以下の順で探す：

```
1. ~/.netrc.gpg（GPG 復号）
2. ~/.netrc
```

---

## 書き込みについて

ginue・gyuma ともに `.netrc` / `.netrc.gpg` への書き込みはしない。  
ユーザーが自分でエディタで追記・管理する。
