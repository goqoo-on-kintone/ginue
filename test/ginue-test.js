const { it } = require('mocha')
const assert = require('power-assert')
const ginue = require('../lib/ginue')

it('trimで先頭・末尾の改行が正しく削られる', function () {
  const newlineIncludedStr = `
usage: ginue
<options>
`
  assert.notEqual(ginue.trim(newlineIncludedStr), newlineIncludedStr)
  assert.equal(ginue.trim(newlineIncludedStr), `usage: ginue
<options>`
  )
})
