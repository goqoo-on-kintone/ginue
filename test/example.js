const mocha = require('mocha')
const assert = require('power-assert')

const it = mocha.it

const author = 'hoo'
it('is power-assert', function () {
  assert(author === 'hoo') // passing
  // assert(author === 'hoge') // failing
})
