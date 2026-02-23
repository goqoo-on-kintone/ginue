// ginuerc.jsと同様の形式
module.exports = {
  env: {
    dev: {
      domain: 'dev.cybozu.com',
      username: 'dev-user',
      password: process.env.DEV_PASSWORD || 'default-password',
      app: {
        activity: 100,
        customer: 101,
      },
    },
    prod: {
      domain: 'prod.cybozu.com',
      username: 'prod-user',
      password: process.env.PROD_PASSWORD || 'default-password',
      app: {
        activity: 200,
        customer: 201,
      },
    },
  },
}
