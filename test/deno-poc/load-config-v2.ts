// Deno で .ginuerc.js を動的に読み込めるかの検証
// 実際のユースケース: カレントディレクトリから読み込む

async function loadGinuercFromCwd(filename: string) {
  console.log('\n--- カレントディレクトリから読み込み ---')
  const cwd = Deno.cwd()
  const configPath = `${cwd}/${filename}`
  console.log('CWD:', cwd)
  console.log('設定ファイル:', configPath)

  try {
    const content = await Deno.readTextFile(configPath)
    // CommonJS形式をエミュレート
    const module = { exports: {} }
    const exports = module.exports
    // process.envをエミュレート
    const process = { env: Deno.env.toObject() }

    const fn = new Function('module', 'exports', 'process', content)
    fn(module, exports, process)

    console.log('成功!')
    console.log('読み込んだ設定:', JSON.stringify(module.exports, null, 2))
    return module.exports
  } catch (e) {
    console.log('失敗:', (e as Error).message)
    return null
  }
}

// 環境変数をセットして検証
Deno.env.set('DEV_PASSWORD', 'secret-from-env')

console.log('=== Deno .ginuerc.js 読み込み検証 v2 ===')
console.log('（カレントディレクトリから読み込む方式）')

await loadGinuercFromCwd('test-ginuerc.js')
