#!/usr/bin/env node

const open = require('open')
const path = require('path')
const { createBaseDirPath } = require('./util')
const createAbsoluteDirPath = (opts) => path.resolve(createBaseDirPath(opts))

exports.ginueDiff = (allOpts) => {
  const envs = []
  if (allOpts.length === 1) {
    const [opts] = allOpts
    envs.push(createAbsoluteDirPath(opts))
    opts.pushTarget && envs.push(createAbsoluteDirPath(opts.pushTarget))
  } else {
    envs.push(allOpts.map(createAbsoluteDirPath))
  }
  const [from, to] = envs.flat()
  let query = ''
  if (from) query += `?from=${from}`
  if (to) query += `&to=${to}`

  open(`http://localhost:3000/${query}`)

  // TODO: パッケージ名を直指定
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
  const command = process.env.DIFF_SERVER_COMMAND

  const { spawnSync } = require('child_process')
  spawnSync(path.resolve(__dirname, `../node_modules/.bin/${command}`), [], {
    stdio: 'inherit',
  })
}
