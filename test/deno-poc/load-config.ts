// Deno で .ginuerc.js を動的に読み込めるかの検証

// 方法1: 動的import（ESM形式の場合）
async function tryDynamicImport(path: string) {
  console.log('\n--- 方法1: 動的import ---')
  try {
    const config = await import(path)
    console.log('成功:', config.default || config)
    return true
  } catch (e) {
    console.log('失敗:', (e as Error).message)
    return false
  }
}

// 方法2: ファイル読み込み + eval（CommonJS形式の場合）
async function tryEvalLoad(path: string) {
  console.log('\n--- 方法2: eval読み込み ---')
  try {
    const content = await Deno.readTextFile(path)
    // CommonJS形式をエミュレート
    const module = { exports: {} }
    const exports = module.exports
    // process.envをエミュレート
    const process = { env: Deno.env.toObject() }

    const fn = new Function('module', 'exports', 'process', content)
    fn(module, exports, process)

    console.log('成功:', module.exports)
    return true
  } catch (e) {
    console.log('失敗:', (e as Error).message)
    return false
  }
}

// 実行
const configPath = new URL('./test-ginuerc.js', import.meta.url).pathname

console.log('=== Deno .ginuerc.js 読み込み検証 ===')
console.log('設定ファイル:', configPath)

// 環境変数をセットして検証
Deno.env.set('DEV_PASSWORD', 'secret-from-env')

await tryDynamicImport('./test-ginuerc.js')
await tryEvalLoad(configPath)
