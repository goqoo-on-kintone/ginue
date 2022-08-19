#!/usr/bin/env node

const open = require('open')
const path = require('path')

exports.ginueDiff = (allOpts) => {
  const envs = []
  if (allOpts.length === 1) {
    const [opts] = allOpts
    envs.push(opts.environment)
    envs.push(opts.pushTarget?.environment)
  } else {
    envs.push(allOpts.map((_) => _.environment))
  }
  const environments = envs.flat().filter(Boolean)
  console.log(environments)

  open(`http://localhost:3000/?environments=${environments.join(',')}`)

  // TODO: cwdはデフォルト固定で動くようにする
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
  const cwd = process.env.DIFF_SERVER_CWD

  const { spawnSync } = require('child_process')
  spawnSync('next', ['dev'], { cwd, stdio: 'inherit' })
}
