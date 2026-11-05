/**
 * Build both halves of the plugin.
 *
 *   src/host/index.ts    -> lib/index.js   (host process, ESM, node)
 *   src/client/index.tsx -> lib/client.js  (browser, CJS factory wrapped in
 *                                          window.__ModuleLoader__.load)
 *
 * The build shells out to the esbuild CLI with inherited stdio instead of using
 * the JavaScript API: the API spawns the binary with piped stdio, which some
 * sandboxed environments refuse (EPERM). Inherited stdio works everywhere the
 * binary itself can run.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const watch = process.argv.includes('--watch')

const PLATFORM_PACKAGES = {
  'win32-x64': '@esbuild/win32-x64',
  'win32-arm64': '@esbuild/win32-arm64',
  'win32-ia32': '@esbuild/win32-ia32',
  'linux-x64': '@esbuild/linux-x64',
  'linux-arm64': '@esbuild/linux-arm64',
  'darwin-x64': '@esbuild/darwin-x64',
  'darwin-arm64': '@esbuild/darwin-arm64',
}

function esbuildBinary() {
  if (process.env.ESBUILD_BINARY_PATH !== undefined) return process.env.ESBUILD_BINARY_PATH
  const key = `${process.platform}-${process.arch}`
  const pkg = PLATFORM_PACKAGES[key]
  const executable = process.platform === 'win32' ? 'esbuild.exe' : 'esbuild'
  const candidates = [
    pkg === undefined ? '' : path.join('node_modules', ...pkg.split('/'), executable),
    path.join('node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild'),
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return process.platform === 'win32' ? 'esbuild.exe' : 'esbuild'
}

const BANNER = 'window.__ModuleLoader__.load({ id: "dsh-media-studio", factory: (require) => { var module = { exports: {} }; var exports = module.exports;'
const FOOTER = 'return module.exports; } });'

const hostArgs = [
  'src/host/index.ts',
  '--bundle',
  '--format=esm',
  '--platform=node',
  '--target=node20',
  '--external:node:*',
  '--outfile=lib/index.js',
  '--log-level=info',
]

const clientArgs = [
  'src/client/index.tsx',
  '--bundle',
  '--format=cjs',
  '--platform=browser',
  '--target=chrome120',
  '--jsx=automatic',
  '--external:react',
  '--external:react-dom',
  '--external:react/jsx-runtime',
  '--loader:.css=text',
  '--outfile=lib/client.js',
  `--banner:js=${BANNER}`,
  `--footer:js=${FOOTER}`,
  '--log-level=info',
]

const binary = esbuildBinary()
fs.mkdirSync('lib', { recursive: true })

function runOnce(args) {
  const result = spawnSync(binary, args, { stdio: 'inherit' })
  if (result.error !== undefined) {
    console.error(`[build] 无法启动 esbuild（${binary}）：${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (!watch) {
  runOnce(hostArgs)
  runOnce(clientArgs)
} else {
  for (const args of [hostArgs, clientArgs]) {
    const child = spawn(binary, [...args, '--watch'], { stdio: 'inherit' })
    child.on('exit', code => { if (code !== 0) process.exit(code ?? 1) })
  }
  console.log(`[build] watching with ${binary}`)
}
