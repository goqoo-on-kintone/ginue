module.exports = {
  extends: 'standard',
  plugins: ['mocha'],
  env: {
    mocha: true,
  },
  globals: {
    // テスト用のグローバル変数 TODO: 自動的にglobalを認識させたい
    assert: true,
    ginue: true,
  },
  rules: {
    'node/no-missing-require': 'error',
    'comma-dangle': ['error', 'only-multiline'],
    'no-debugger': 'off',
    'no-var': 'error',
    'prefer-const': 'error',
  },
}
