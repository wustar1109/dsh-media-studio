/**
 * Host smoke test: real HTTP server, real files, no mocked modules.
 *
 * Covers the parts that cannot be eyeballed from the panel: channel merging,
 * the OpenAI image/video wire shapes, job lifecycle, asset persistence,
 * workflow variable binding and the HTTP API including range requests.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-studio-test-'))
process.env.USERPROFILE = root
process.env.HOME = root
process.env.DSH_WORKSPACE = path.join(root, 'workspace')
fs.mkdirSync(process.env.DSH_WORKSPACE, { recursive: true })

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64, 1)])

let imageCalls = 0
let videoCalls = 0
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (req.method === 'POST' && url.pathname === '/v1/images/generations') {
    imageCalls += 1
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ data: [{ b64_json: PNG.toString('base64') }, { b64_json: PNG.toString('base64') }] }))
    return
  }
  if (req.method === 'POST' && url.pathname === '/v1/videos') {
    videoCalls += 1
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ id: 'vid-1', status: 'queued' }))
    return
  }
  if (req.method === 'GET' && url.pathname === '/v1/videos/vid-1') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ id: 'vid-1', status: 'completed' }))
    return
  }
  if (req.method === 'GET' && url.pathname === '/v1/videos/vid-1/content') {
    res.writeHead(200, { 'content-type': 'video/mp4' })
    res.end(MP4)
    return
  }
  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'not found' } }))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${String(server.address().port)}/v1`

const { StudioService, inferSurface, applyVars, mergeConfig, emptyConfig, createRoutes } = await import('../lib/index.js')
const ctx = {
  get: name => name === 'workingDirectory' ? { defaultDirectory: process.env.DSH_WORKSPACE } : undefined,
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}
const studio = new StudioService(ctx, {})
studio.updateConfig({
  channels: [
    { id: 'openai', kind: 'openai', label: 'mock', enabled: true, baseUrl: base, apiKey: 'test-key-123', imageModel: 'gpt-image-1', videoModel: 'sora-2' },
    { id: 'comfyui', kind: 'comfyui', label: 'comfy', baseUrl: 'http://127.0.0.1:1' },
  ],
  defaults: { image: 'openai', video: 'openai' },
})

// ── config merge ────────────────────────────────────────────────────────────
{
  const merged = mergeConfig(emptyConfig(), { channels: [{ id: 'openai', apiKeyEnv: 'MY_KEY' }] })
  const openai = merged.channels.find(channel => channel.id === 'openai')
  assert.equal(openai.baseUrl, 'https://api.openai.com/v1', 'a partial channel patch keeps the built-in endpoint')
  assert.equal(openai.apiKeyEnv, 'MY_KEY')
  assert.equal(merged.channels.length, emptyConfig().channels.length)
  const normalized = mergeConfig(emptyConfig(), { channels: [{ id: 'comfyui', baseUrl: '  comfy-box/ ' }] })
  assert.equal(normalized.channels.find(channel => channel.id === 'comfyui').baseUrl, 'http://comfy-box', 'a bare host gets http:// and loses the trailing slash')
  assert.equal(studio.channels().find(channel => channel.id === 'openai').ready, true)
  assert.match(studio.channels().find(channel => channel.id === 'openai').keyHint, /test/, 'the panel sees a masked key')
}

// ── image job ───────────────────────────────────────────────────────────────
{
  const job = studio.startImage({ prompt: 'a test image', n: 2 })
  const settled = await studio.jobs.wait(job.id, 10_000)
  assert.equal(settled.state, 'succeeded', settled.error)
  assert.equal(settled.assets.length, 2)
  assert.equal(imageCalls, 1)
  for (const asset of settled.assets) {
    assert.equal(asset.kind, 'image')
    assert.equal(asset.origin, 'generated')
    assert.ok(fs.existsSync(asset.path), 'the asset exists on disk')
    assert.ok(fs.existsSync(`${asset.path}.meta.json`), 'the sidecar exists')
    assert.equal(asset.prompt, 'a test image')
  }
  const listed = studio.getLibrary().list({ query: 'test image' })
  assert.ok(listed.total >= 2)
}

// ── video job ───────────────────────────────────────────────────────────────
{
  const job = studio.startVideo({ prompt: 'a test clip', seconds: 4 })
  const settled = await studio.jobs.wait(job.id, 15_000)
  assert.equal(settled.state, 'succeeded', settled.error)
  assert.equal(videoCalls, 1)
  assert.equal(settled.assets[0].kind, 'video')
  assert.ok(settled.assets[0].path.endsWith('.mp4'))
}

// ── workflow surface + vars ─────────────────────────────────────────────────
{
  const workflow = {
    3: { class_type: 'KSampler', inputs: { seed: 1, steps: 20, cfg: 7, positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0], model: ['4', 0] } },
    5: { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: 'a cat', clip: ['4', 1] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: 'blurry', clip: ['4', 1] } },
    9: { class_type: 'SaveImage', inputs: { filename_prefix: 'ComfyUI', images: ['3', 0] } },
  }
  const surface = inferSurface('t', workflow, { title: 'T' })
  const names = surface.slots.map(slot => slot.name)
  assert.ok(names.includes('prompt'), `prompt slot inferred (got ${names.join(',')})`)
  assert.ok(names.includes('negative_prompt'))
  assert.ok(names.includes('width'))
  assert.ok(names.includes('seed'))
  assert.deepEqual(surface.outputs.map(output => output.kind), ['image'])
  const applied = applyVars(workflow, surface, { prompt: 'a dog', seed: 42, width: 768 })
  assert.equal(applied.workflow['6'].inputs.text, 'a dog')
  assert.equal(applied.workflow['3'].inputs.seed, 42)
  assert.equal(applied.workflow['5'].inputs.width, 768)
  assert.equal(applied.workflow['6'].inputs.text, 'a dog')
  assert.equal(workflow['6'].inputs.text, 'a cat', 'the template is not mutated')
  // Image slots are validated by the runner after upload, not by applyVars.
  assert.doesNotThrow(() => applyVars(workflow, surface, {}))
  const placeholder = inferSurface('p', {
    1: { class_type: 'CLIPTextEncode', inputs: { text: '{{subject}}', clip: ['4', 1] } },
  }, {})
  assert.throws(() => applyVars(placeholder.slots.length > 0 ? { 1: { class_type: 'CLIPTextEncode', inputs: { text: '{{subject}}' } } } : {}, placeholder, {}), /必填变量/)
}

// ── HTTP API ────────────────────────────────────────────────────────────────
{
  const routes = createRoutes(studio, ctx)
  const api = http.createServer((req, res) => { void routes.dispatch(req, res) })
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve))
  const apiBase = `http://127.0.0.1:${String(api.address().port)}`
  const config = await fetch(`${apiBase}/media-studio/api/config`).then(response => response.json())
  assert.equal(config.ok, true)
  assert.equal(config.config.channels.find(channel => channel.id === 'openai').apiKey, '••••••••')

  const library = await fetch(`${apiBase}/media-studio/api/library?limit=5`).then(response => response.json())
  assert.equal(library.ok, true)
  assert.ok(library.total >= 3)

  const assetId = library.items[0].id
  const asset = await fetch(`${apiBase}/media-studio/api/asset/${assetId}`, { headers: { range: 'bytes=0-3' } })
  assert.equal(asset.status, 206)
  assert.equal(asset.headers.get('content-range')?.startsWith('bytes 0-3/'), true)

  const submitted = await fetch(`${apiBase}/media-studio/api/generate/image`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'through the api', n: 1 }),
  }).then(response => response.json())
  assert.equal(submitted.ok, true)
  const settled = await studio.jobs.wait(submitted.job.jobId, 10_000)
  assert.equal(settled.state, 'succeeded')

  const missing = await fetch(`${apiBase}/media-studio/api/nope`).then(response => response.json())
  assert.equal(missing.ok, false)
  await new Promise(resolve => api.close(resolve))
}

// ── ffmpeg (optional) ───────────────────────────────────────────────────────
{
  const { detectFfmpeg, concatVideos } = await import('../lib/index.js')
  const info = detectFfmpeg()
  if (info.ffmpeg !== undefined) {
    const a = path.join(root, 'a.mp4')
    const b = path.join(root, 'b.mp4')
    const { execFileSync } = await import('node:child_process')
    for (const [file, color] of [[a, 'red'], [b, 'blue']]) {
      execFileSync(info.ffmpeg, ['-y', '-f', 'lavfi', '-i', `color=c=${color}:s=320x240:d=1`, '-pix_fmt', 'yuv420p', file], { stdio: 'ignore' })
    }
    const result = await concatVideos({ inputs: [a, b], outputDir: path.join(root, 'out') })
    assert.ok(fs.existsSync(result.file))
    assert.ok(fs.statSync(result.file).size > 1000)
    assert.equal(result.width, 320)
    console.log('[test] ffmpeg concat ok:', path.basename(result.file))
  } else {
    console.log('[test] ffmpeg not found, concat path skipped')
  }
}

server.close()
fs.rmSync(root, { recursive: true, force: true })
console.log('[test] host smoke tests passed')
