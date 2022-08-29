module.exports = {
  extends: ['standard', 'prettier'],
  env: { 'jest/globals': true },
  plugins: ['jest'],
  parserOptions: { ecmaVersion: 2022 },
  rules: {
    'n/no-missing-require': 'error',
    'comma-dangle': ['error', 'only-multiline'],
    'no-debugger': 'off',
    'no-var': 'error',
    'prefer-const': 'error',
    'camelcase': 'off',
  },
}
