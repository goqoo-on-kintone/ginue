module.exports = {
  // NOTE: kintoneアプリストアの「SFA（営業支援）パック」内の4アプリ
  env: {
    dev: {
      domain: 'dev.cybozu.com',
      username: 'dummy-user',
      password: 'dummy-pass',
      app: {
        activity: 1, // 活動履歴
        customer: 2, // 顧客管理
        project: 3, // 案件管理
        contact: 4, // 担当者管理
      },
    },
    prod: {
      domain: 'prod.cybozu.com',
      username: 'dummy-user',
      password: 'dummy-pass',
      app: {
        activity: 111,
        customer: 222,
        project: 333,
        contact: 444,
      },
    },
  },
}
