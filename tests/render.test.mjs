/** SSR smoke test: the client bundle loads through __ModuleLoader__ and renders. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'package.json'))

let factoryResult
globalThis.window = {
  __ModuleLoader__: {
    load: definition => { factoryResult = definition },
  },
}
globalThis.document = {
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} },
}

await import('../lib/client.js')
assert.ok(factoryResult !== undefined, 'the bundle called __ModuleLoader__.load')
assert.equal(factoryResult.id, 'dsh-media-studio')

const mod = factoryResult.factory(require)
assert.equal(typeof mod.apply, 'function')
assert.equal(mod.name, 'dsh-media-studio')
assert.equal(typeof mod.__test.Studio, 'function')

const React = require('react')
const { renderToString } = require('react-dom/server')
const html = renderToString(React.createElement(mod.__test.Studio, { visible: true }))
assert.match(html, /媒体工作台/)
assert.match(html, /正在载入配置/)
assert.ok(html.length > 200)

const iconHtml = renderToString(React.createElement(mod.__test.PanelIcon, { size: 18 }))
assert.match(iconHtml, /<svg/)

// Slot registration: fake host client context with a slots service.
{
  const registered = []
  const slots = {
    inject: (name, register) => { registered.push(name); register() },
    register: (options, component) => { registered.push(options.id ?? options.name ?? options.key); assert.equal(typeof component, 'function'); return () => {} },
  }
  const injected = []
  const ctx = {
    get: name => name === 'slots' ? slots : undefined,
    inject: (names, run) => { injected.push(...names) },
  }
  mod.apply(ctx)
  assert.deepEqual(injected, ['betterSidebar'])
  assert.ok(registered.includes('sidebar.panellist'))
  assert.ok(registered.includes('main'))
  assert.equal(registered.filter(item => item === 'media-studio').length, 1)
}

console.log('[test] client renders:', html.length, 'bytes')
