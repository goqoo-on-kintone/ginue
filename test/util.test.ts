import { trim, pretty, prettyln, createBase64Account, createBaseDirPath } from '../src/util'
import type { Opts } from '../src/types'

describe('util', () => {
  describe('trim', () => {
    it('先頭・末尾の改行を削る', () => {
      expect(
        trim(`
usage: ginue
<options>
`)
      ).toBe(`usage: ginue
<options>`)
    })

    it('先頭のみに改行がある場合', () => {
      expect(trim('\nhello')).toBe('hello')
    })

    it('末尾のみに改行がある場合', () => {
      expect(trim('hello\n')).toBe('hello')
    })

    it('改行がない場合はそのまま返す', () => {
      expect(trim('hello')).toBe('hello')
    })

    it('中間の改行は残す', () => {
      expect(trim('\nline1\nline2\n')).toBe('line1\nline2')
    })
  })

  describe('pretty', () => {
    it('オブジェクトを整形されたJSON文字列に変換', () => {
      const obj = { a: 1, b: 'test' }
      expect(pretty(obj)).toBe('{\n  "a": 1,\n  "b": "test"\n}')
    })

    it('配列を整形されたJSON文字列に変換', () => {
      const arr = [1, 2, 3]
      expect(pretty(arr)).toBe('[\n  1,\n  2,\n  3\n]')
    })

    it('ネストしたオブジェクトを整形', () => {
      const obj = { outer: { inner: 'value' } }
      expect(pretty(obj)).toBe('{\n  "outer": {\n    "inner": "value"\n  }\n}')
    })
  })

  describe('prettyln', () => {
    it('整形されたJSON文字列の末尾に改行を追加', () => {
      const obj = { key: 'value' }
      expect(prettyln(obj)).toBe('{\n  "key": "value"\n}\n')
    })
  })

  describe('createBase64Account', () => {
    it('ユーザー名:パスワード形式の文字列をBase64エンコード', async () => {
      const result = await createBase64Account('user:pass')
      expect(result).toBe(Buffer.from('user:pass').toString('base64'))
    })

    it('2つの引数をコロンで結合してBase64エンコード', async () => {
      const result = await createBase64Account('user', 'pass')
      expect(result).toBe(Buffer.from('user:pass').toString('base64'))
    })

    it('日本語を含む場合もエンコード可能', async () => {
      const result = await createBase64Account('ユーザー', 'パスワード')
      expect(result).toBe(Buffer.from('ユーザー:パスワード').toString('base64'))
    })
  })

  describe('createBaseDirPath', () => {
    it('locationのみ指定した場合', () => {
      // 注: locationのみの場合、末尾に//が付く（仕様）
      const opts = { location: 'kintone-settings' } as Opts
      expect(createBaseDirPath(opts)).toBe('kintone-settings//')
    })

    it('environmentのみ指定した場合', () => {
      const opts = { environment: 'development' } as Opts
      expect(createBaseDirPath(opts)).toBe('development/')
    })

    it('location + environment指定の場合', () => {
      const opts = { location: 'kintone-settings', environment: 'development' } as Opts
      expect(createBaseDirPath(opts)).toBe('kintone-settings/development/')
    })

    it('envLocationが指定されている場合はenvironmentより優先', () => {
      const opts = { location: 'settings', environment: 'dev', envLocation: 'custom-loc' } as Opts
      expect(createBaseDirPath(opts)).toBe('settings/custom-loc/')
    })

    it('何も指定しない場合は空文字列', () => {
      const opts = {} as Opts
      expect(createBaseDirPath(opts)).toBe('')
    })
  })
})
