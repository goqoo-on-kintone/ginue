const mocha = require('mocha')
const assert = require('power-assert')
const { example } = require('../lib/example')

const it = mocha.it

const author = 'hoo'
it('is power-assert', function () {
  assert(author === 'hoo') // passing
  // assert(author === 'hoge') // failing
})

it('is plus1', function () {
  assert(example(1) === 2) // passing
  // assert(hoge(1) === 1) // failing
})
