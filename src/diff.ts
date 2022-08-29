#!/usr/bin/env node

import open from 'open'
import path from 'path'
import { createBaseDirPath } from './util'
import type { Opts } from './types'

const createAbsoluteDirPath = (opts: Opts): string => path.resolve(createBaseDirPath(opts))

export const ginueDiff = (allOpts: Opts[]) => {
  const envs: (string | string[])[] = []
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

  const { spawnSync } = require('child_process')
  spawnSync(path.resolve(__dirname, `../node_modules/.bin/twins-diff`), [], {
    stdio: 'inherit',
  })
}
