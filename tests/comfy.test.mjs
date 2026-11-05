/**
 * ComfyUI integration against a fake server: upload, submit, poll, download,
 * persist. Also covers workflow import/surface/placeholder binding.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-studio-comfy-'))
process.env.USERPROFILE = root
process.env.HOME = root
process.env.DSH_WORKSPACE = path.join(root, 'workspace')
fs.mkdirSync(process.env.DSH_WORKSPACE, { recursive: true })

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let historyCalls = 0
let uploads = 0
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const json = value => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
  if (url.pathname === '/system_stats') return json({ devices: [{ name: 'fake-gpu', vram_total: 8 * 1024 * 1024 * 1024 }] })
  if (url.pathname === '/upload/image' && req.method === 'POST') { uploads += 1; return json({ name: 'uploaded.png', subfolder: '' }) }
  if (url.pathname === '/prompt' && req.method === 'POST') return json({ prompt_id: 'p1' })
  if (url.pathname === '/history/p1') {
    historyCalls += 1
    if (historyCalls < 2) return json({})
    return json({ p1: { status: { status_str: 'success', completed: true }, outputs: { 9: { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] } } } })
  }
  if (url.pathname === '/view') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG) }
  res.writeHead(404); res.end('no')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const comfyBase = `http://127.0.0.1:${String(server.address().port)}`

const { StudioService, saveWorkflow, inferSurface, applyVars, assertApiWorkflow } = await import('../lib/index.js')
const ctx = {
  get: name => name === 'workingDirectory' ? { defaultDirectory: process.env.DSH_WORKSPACE } : undefined,
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}
const studio = new StudioService(ctx, {})
studio.updateConfig({
  channels: [{ id: 'comfyui', kind: 'comfyui', label: 'fake', baseUrl: comfyBase }],
  comfyTimeoutMs: 20_000,
})

const workflow = {
  3: { class_type: 'KSampler', inputs: { seed: 1, steps: 20, cfg: 7, positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0], model: ['4', 0] } },
  5: { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
  6: { class_type: 'CLIPTextEncode', inputs: { text: '{{prompt}}', clip: ['4', 1] } },
  7: { class_type: 'CLIPTextEncode', inputs: { text: 'low quality', clip: ['4', 1] } },
  8: { class_type: 'LoadImage', inputs: { image: '' } },
  9: { class_type: 'SaveImage', inputs: { filename_prefix: 'out', images: ['3', 0] } },
}

const surface = inferSurface('demo', workflow, { title: '演示' })
assert.ok(surface.slots.some(slot => slot.name === 'prompt'))
// UI-format exports are rejected with a fixable message, not a stack trace.
assert.throws(() => assertApiWorkflow({ nodes: [], links: [] }), /UI 格式/)
assert.throws(() => assertApiWorkflow({}), /没有任何 class_type/)
assert.ok(surface.slots.some(slot => slot.name === 'image' && slot.required))
const applied = applyVars(workflow, surface, { prompt: 'hello', seed: 7 })
assert.equal(applied.workflow['6'].inputs.text, 'hello')
assert.equal(applied.workflow['3'].inputs.seed, 7)
assert.equal(applied.workflow['6'].inputs.text, 'hello')
assert.ok(applied.workflow['6'].inputs.text !== '{{prompt}}')

saveWorkflow('demo', workflow, { title: '演示', enabled: true })
const listed = studio.comfyWorkflows().workflows
assert.equal(listed.length, 1)
assert.equal(listed[0].title, '演示')

// A video workflow without a KSampler positive/negative pair (MiniMax style):
// the prompt is a primitive consumed by a conditioning node, and baked-in
// images must not be forced.
{
  const mini = {
    266: { class_type: 'PrimitiveStringMultiline', inputs: { value: 'a silver ribbon' }, _meta: { title: 'Input Text (Prompt)' } },
    277: { class_type: 'PrimitiveFloat', inputs: { value: 8 }, _meta: { title: 'Float (Duration)' } },
    310: { class_type: 'MiniMaxH3AudioConditioningT8', inputs: { prompt: ['266', 0] } },
    329: { class_type: 'LoadImage', inputs: { image: 'first.png' } },
    306: { class_type: 'VHS_VideoCombine', inputs: { images: ['329', 0] } },
  }
  const surface = inferSurface('mini', mini, {})
  const prompt = surface.slots.find(slot => slot.name === 'prompt')
  assert.equal(prompt?.value, 'a silver ribbon')
  assert.equal(surface.slots.find(slot => slot.name === 'duration')?.value, 8)
  assert.equal(surface.slots.find(slot => slot.type === 'image')?.required, false)
}

// A reference image for the LoadImage slot.
const refFile = path.join(process.env.DSH_WORKSPACE, 'ref.png')
fs.writeFileSync(refFile, PNG)

const job = studio.startComfy({ workflowId: 'demo', vars: { prompt: 'a robot', seed: 3 }, images: [refFile] })
const settled = await studio.jobs.wait(job.id, 25_000)
assert.equal(settled.state, 'succeeded', settled.error)
assert.equal(settled.assets.length, 1)
assert.equal(settled.assets[0].origin, 'comfy')
assert.ok(fs.existsSync(settled.assets[0].path))
assert.equal(uploads, 1, 'the reference image was uploaded')

// Offline ComfyUI fails instead of pretending to queue.
studio.updateConfig({ channels: [{ id: 'comfyui', kind: 'comfyui', baseUrl: 'http://127.0.0.1:1' }] })
const offline = studio.startComfy({ workflowId: 'demo', vars: { prompt: 'x' }, images: [refFile] })
const failed = await studio.jobs.wait(offline.id, 15_000)
assert.equal(failed.state, 'failed')
assert.match(failed.error ?? '', /连不上 ComfyUI/)

server.close()
fs.rmSync(root, { recursive: true, force: true })
console.log('[test] comfy tests passed')
