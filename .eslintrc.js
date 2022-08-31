module.exports = {
  env: {
    'node': true,
    'jest/globals': true,
  },
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:jest/recommended', 'prettier'],
  parserOptions: { ecmaVersion: 2022 },
  rules: {
    'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
    'no-irregular-whitespace': ['error', { skipTemplates: true }],
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
  },
}
