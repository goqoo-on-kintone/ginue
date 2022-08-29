const { trim } = require('../lib/util')

it('trimで先頭・末尾の改行が正しく削られる', () => {
  expect(
    trim(`
usage: ginue
<options>
`)
  ).toBe(`usage: ginue
<options>`)
})
