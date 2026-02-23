/**
 * E2Eテスト用の設定ファイルテンプレート
 *
 * 使用方法:
 * 1. このファイルを .ginuerc.js にコピー
 * 2. 実際のkintone環境の情報を設定
 * 3. .ginuerc.js は .gitignore に追加済み
 *
 * NOTE: kintoneアプリストアの「SFA（営業支援）パック」を使用
 */
module.exports = {
  env: {
    e2e: {
      // テスト用kintone環境
      domain: 'your-subdomain.cybozu.com',
      username: 'your-username',
      password: 'your-password',
      app: {
        activity: 1, // 活動履歴
        customer: 2, // 顧客管理
        project: 3, // 案件管理
        contact: 4, // 顧客担当者
      },
    },
  },
}
