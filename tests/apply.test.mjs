/** Plugin entrypoint wiring: apply() registers the HTTP prefix and all tools. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-studio-apply-'))
process.env.USERPROFILE = root
process.env.HOME = root
process.env.DSH_WORKSPACE = path.join(root, 'workspace')
fs.mkdirSync(process.env.DSH_WORKSPACE, { recursive: true })

const mod = await import('../lib/index.js')
assert.equal(mod.name, 'dsh-media-studio')
assert.deepEqual(mod.inject, ['webServer', 'tools'])
assert.deepEqual(
  mod.sanitizeToolValue({ a: undefined, b: Number.NaN, c: [undefined, 1], d: { e: undefined, f: 2 } }),
  { b: null, c: [null, 1], d: { f: 2 } },
  'tool results are normalised to lossless JSON',
)

const routes = []
const tools = []
const disposers = []
const ctx = {
  root: {},
  get: name => {
    if (name === 'webServer') return { register: route => { routes.push(route); return () => disposers.push('http') } }
    if (name === 'tools') return { register: spec => { tools.push(spec); return () => disposers.push(spec.name) } }
    if (name === 'workingDirectory') return { defaultDirectory: process.env.DSH_WORKSPACE }
    return undefined
  },
  effect: run => { run() },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}

mod.apply(ctx, {})
assert.equal(routes.length, 1)
assert.equal(routes[0].kind, 'prefix')
assert.equal(routes[0].path, mod.API_BASE)
assert.equal(typeof routes[0].handler, 'function')

const names = tools.map(tool => tool.name).sort()
assert.deepEqual(names, [
  'media_canvas_edit',
  'media_canvas_state',
  'media_channels',
  'media_comfy_run',
  'media_comfy_workflows',
  'media_concat',
  'media_generate_image',
  'media_generate_video',
  'media_job',
  'media_library',
  'media_storyboard',
])
for (const tool of tools) {
  assert.equal(typeof tool.description, 'string')
  assert.equal(tool.parameters.type, 'object')
  assert.equal(typeof tool.execute, 'function')
  assert.equal(typeof tool.output.render, 'function')
}
// Rendering must not mutate the value (the host may freeze it).
{
  const jobTool = tools.find(tool => tool.name === 'media_job')
  const value = Object.freeze({ ok: true, __attachments: [{ type: 'text', text: 'inline' }] })
  const blocks = jobTool.output.render({}, value)
  assert.equal(blocks.length, 2)
  assert.ok(!String(blocks[0].text).includes('__attachments'))
  assert.deepEqual(blocks[1], { type: 'text', text: 'inline' })

  const withAsset = jobTool.output.render({}, Object.freeze({
    ok: true,
    assets: [{ id: 'a1', name: 'x.png', downloadUrl: '/media-studio/api/asset/a1?download=1' }],
  }))
  assert.match(String(withAsset[0].text), /下载原图：\[下载\]\(\/media-studio\/api\/asset\/a1\?download=1\)/)
}

// The handler is the real dispatcher; drive it over a real socket.
const server = http.createServer((req, res) => { void routes[0].handler(req, res) })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${String(server.address().port)}`
const config = await fetch(`${base}/media-studio/api/config`).then(response => response.json())
assert.equal(config.ok, true)
assert.equal(config.diagnostics.plugin, 'dsh-media-studio')
assert.ok(Array.isArray(config.config.channels))
assert.equal(config.config.channels.length, 6)
assert.ok(config.config.channels.every(channel => !('headers' in channel) && !('extraBody' in channel)), 'gateway secrets never reach the browser')

const channels = await fetch(`${base}/media-studio/api/channels`).then(response => response.json())
assert.equal(channels.channels.length, 6)
assert.ok(channels.channels.every(channel => typeof channel.ready === 'boolean'))

// Execute the read-only tools, and check that generation fails loudly when no
// channel is configured (instead of fabricating a job).
{
  const byName = new Map(tools.map(tool => [tool.name, tool]))
  const listed = await byName.get('media_channels').execute({})
  assert.equal(listed.ok, true)
  assert.equal(listed.channels.length, 6)

  const library = await byName.get('media_library').execute({ action: 'list' })
  assert.equal(library.ok, true)
  assert.equal(library.total, 0)

  const jobs = await byName.get('media_job').execute({ action: 'list' })
  assert.equal(jobs.ok, true)

  const workflows = await byName.get('media_comfy_workflows').execute({})
  assert.equal(workflows.ok, true)

  await assert.rejects(() => byName.get('media_generate_image').execute({ prompt: 'x' }), /没有可用|没有可用通道|缺/)
}

await new Promise(resolve => server.close(resolve))
fs.rmSync(root, { recursive: true, force: true })
console.log('[test] apply wiring passed')
