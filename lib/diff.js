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
  if (from) query += `?oldDir=${from}`
  if (to) query += `&newDir=${to}`

  open(`http://localhost:3000/${query}`)

  // TODO: cwdはデフォルト固定で動くようにする
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
  const cwd = process.env.DIFF_SERVER_CWD

  const { spawnSync } = require('child_process')
  spawnSync('next', ['dev'], { cwd, stdio: 'inherit' })
}
