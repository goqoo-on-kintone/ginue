#!/usr/bin/env node

const open = require('open')
const path = require('path')

exports.ginueDiff = () => {
  open('http://localhost:3000/')

  // TODO: cwdはデフォルト固定で動くようにする
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
  const cwd = process.env.DIFF_SERVER_CWD

  const { spawnSync } = require('child_process')
  spawnSync('next', ['dev'], { cwd, stdio: 'inherit' })
}
