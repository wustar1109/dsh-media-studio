/** HTTP API for the panel (and anything else on the same origin). */
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

import type { HostContext } from './types.js'
import { API_BASE, type StudioService } from './studio.js'
import { assertImportable } from './config.js'
import { detectFfmpeg } from './ffmpeg.js'
import { jobView, assetView } from './tools.js'
import { mimeOf, readJson } from './util.js'

const MAX_BODY = 32 * 1024 * 1024

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > MAX_BODY) throw new Error('请求体太大')
    chunks.push(buffer)
  }
  if (bytes === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    throw new Error('请求体不是合法 JSON')
  }
}

/** Serve one asset with byte-range support (videos need it to seek). */
function serveFile(req: IncomingMessage, res: ServerResponse, file: string, downloadName?: string): void {
  let stat: fs.Stats
  try {
    stat = fs.statSync(file)
  } catch {
    sendJson(res, 404, { ok: false, message: '文件已不在磁盘上' })
    return
  }
  const mime = mimeOf(file)
  const range = req.headers.range
  const baseHeaders: Record<string, string | number> = {
    'content-type': mime,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=60',
    ...(downloadName === undefined ? {} : { 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` }),
  }
  if (range === undefined || downloadName !== undefined) {
    res.writeHead(200, { ...baseHeaders, 'content-length': stat.size })
    if (req.method === 'HEAD') { res.end(); return }
    fs.createReadStream(file).pipe(res)
    return
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  if (match === null) {
    res.writeHead(416, { ...baseHeaders, 'content-range': `bytes */${String(stat.size)}` })
    res.end()
    return
  }
  const start = match[1] === '' ? undefined : Number(match[1])
  const end = match[2] === '' ? undefined : Number(match[2])
  const from = start ?? Math.max(0, stat.size - (end ?? 0))
  const to = start === undefined ? stat.size - 1 : Math.min(end ?? stat.size - 1, stat.size - 1)
  if (from > to || from >= stat.size) {
    res.writeHead(416, { ...baseHeaders, 'content-range': `bytes */${String(stat.size)}` })
    res.end()
    return
  }
  res.writeHead(206, {
    ...baseHeaders,
    'content-range': `bytes ${String(from)}-${String(to)}/${String(stat.size)}`,
    'content-length': to - from + 1,
  })
  if (req.method === 'HEAD') { res.end(); return }
  fs.createReadStream(file, { start: from, end: to }).pipe(res)
}

interface Route {
  method: string
  pattern: RegExp
  handler: (context: { params: string[]; body: Record<string, unknown>; url: URL; req: IncomingMessage; res: ServerResponse }) => Promise<unknown> | unknown
}

interface RouteResult {
  status?: number
  json?: unknown
  file?: string
  /** Set to force a Save-As response with this filename. */
  downloadName?: string
}

export function createRoutes(studio: StudioService, ctx: HostContext): { dispatch: (req: IncomingMessage, res: ServerResponse) => Promise<void> } {
  const guard = (handler: (context: Parameters<Route['handler']>[0]) => Promise<unknown> | unknown) => handler

  const routes: Route[] = [
    { method: 'GET', pattern: /^\/$/, handler: () => ({ ok: true, plugin: 'dsh-media-studio', version: '0.1.0' }) },
    {
      method: 'GET',
      pattern: /^\/config$/,
      handler: () => ({
        ok: true,
        config: publicConfig(studio),
        outputDir: studio.getOutputDir(),
        diagnostics: studio.diagnostics(),
      }),
    },
    {
      method: 'POST',
      pattern: /^\/config$/,
      handler: async ({ body }) => {
        const patch = { ...body }
        patch.channels = studio.maskIncomingChannels(patch.channels)
        studio.updateConfig(patch)
        return { ok: true, config: publicConfig(studio) }
      },
    },
    { method: 'GET', pattern: /^\/channels$/, handler: () => ({ ok: true, channels: studio.channels() }) },
    {
      method: 'POST',
      pattern: /^\/channels\/test$/,
      handler: async ({ body }) => {
        const id = typeof body.id === 'string' ? body.id : ''
        const result = await studio.testChannel(id, {
          ...(typeof body.apiKey === 'string' ? { apiKey: body.apiKey } : {}),
          ...(typeof body.baseUrl === 'string' ? { baseUrl: body.baseUrl } : {}),
        })
        return { ok: result.ok, detail: result.detail, message: result.detail, latencyMs: result.latencyMs }
      },
    },
    {
      method: 'POST',
      pattern: /^\/channels\/models$/,
      handler: async ({ body }) => {
        const id = typeof body.id === 'string' ? body.id : ''
        return await studio.listModels(id, {
          ...(typeof body.apiKey === 'string' ? { apiKey: body.apiKey } : {}),
          ...(typeof body.baseUrl === 'string' ? { baseUrl: body.baseUrl } : {}),
        })
      },
    },
    {
      method: 'GET',
      pattern: /^\/jobs$/,
      handler: ({ url }) => {
        const state = url.searchParams.get('state') ?? undefined
        const kind = url.searchParams.get('kind') ?? undefined
        const limit = Number.parseInt(url.searchParams.get('limit') ?? '30', 10)
        return { ok: true, jobs: studio.jobs.list({ ...(state === undefined ? {} : { state }), ...(kind === undefined ? {} : { kind }), limit: Number.isFinite(limit) ? limit : 30 }).map(jobView) }
      },
    },
    {
      method: 'GET',
      pattern: /^\/jobs\/([^/]+)$/,
      handler: ({ params }) => {
        const job = studio.jobs.get(params[0]!)
        if (job === undefined) return { status: 404, json: { ok: false, message: '任务不存在' } }
        return { ok: true, job: jobView(job), raw: publicJob(job) }
      },
    },
    {
      method: 'POST',
      pattern: /^\/jobs\/([^/]+)\/cancel$/,
      handler: ({ params }) => ({ ok: studio.jobs.cancel(params[0]!), state: studio.jobs.stateOf(params[0]!) }),
    },
    {
      method: 'POST',
      pattern: /^\/jobs\/([^/]+)\/collect$/,
      handler: async ({ params }) => {
        const job = await studio.collectComfyJob(params[0]!)
        return { ok: true, job: jobView(job) }
      },
    },
    {
      method: 'POST',
      pattern: /^\/generate\/image$/,
      handler: async ({ body }) => {
        const job = studio.startImage({
          prompt: String(body.prompt ?? ''),
          channel: optional(body.channel),
          model: optional(body.model),
          negative: optional(body.negative),
          size: optional(body.size),
          aspectRatio: optional(body.aspectRatio),
          quality: optional(body.quality),
          n: typeof body.n === 'number' ? body.n : undefined,
          refs: stringArray(body.refs),
          ...(typeof body.watermark === 'boolean' ? { watermark: body.watermark } : {}),
        })
        return { ok: true, job: jobView(job) }
      },
    },
    {
      method: 'POST',
      pattern: /^\/generate\/video$/,
      handler: async ({ body }) => {
        const job = studio.startVideo({
          prompt: String(body.prompt ?? ''),
          channel: optional(body.channel),
          model: optional(body.model),
          mode: optional(body.mode) as 'text' | 'image' | 'keyframe' | 'reference' | undefined,
          refs: stringArray(body.refs),
          seconds: typeof body.seconds === 'number' ? body.seconds : undefined,
          resolution: optional(body.resolution),
          aspectRatio: optional(body.aspectRatio),
          negative: optional(body.negative),
        })
        return { ok: true, job: jobView(job) }
      },
    },
    {
      method: 'POST',
      pattern: /^\/canvas\/edit$/,
      handler: async ({ body }) => {
        const region = body.region !== null && typeof body.region === 'object'
          ? {
              x: Number((body.region as Record<string, unknown>).x),
              y: Number((body.region as Record<string, unknown>).y),
              w: Number((body.region as Record<string, unknown>).w),
              h: Number((body.region as Record<string, unknown>).h),
            }
          : undefined
        const expand = body.expand !== null && typeof body.expand === 'object'
          ? {
              direction: String((body.expand as Record<string, unknown>).direction ?? 'right') as 'left' | 'right' | 'top' | 'bottom' | 'all',
              amount: Number((body.expand as Record<string, unknown>).amount),
            }
          : undefined
        const job = await studio.startCanvasEdit({
          prompt: String(body.prompt ?? ''),
          mode: body.mode === 'outpaint' ? 'outpaint' : body.mode === 'annotate' ? 'annotate' : 'inpaint',
          source: optional(body.source),
          composite: optional(body.composite),
          image: optional(body.image),
          mask: optional(body.mask),
          region,
          expand,
          channel: optional(body.channel),
          model: optional(body.model),
          size: optional(body.size),
          aspectRatio: optional(body.aspectRatio),
          n: typeof body.n === 'number' ? body.n : undefined,
          ...(typeof body.watermark === 'boolean' ? { watermark: body.watermark } : {}),
        })
        return { ok: true, job: jobView(job) }
      },
    },
    {
      method: 'GET',
      pattern: /^\/canvas\/state$/,
      handler: () => ({ ok: true, ...studio.getCanvasState() }),
    },
    {
      method: 'PUT',
      pattern: /^\/canvas\/state$/,
      handler: async ({ body }) => {
        const patch = body !== null && typeof body === 'object' ? body as Record<string, unknown> : {}
        const { state, revision } = studio.setCanvasState(patch as never)
        return { ok: true, state, revision }
      },
    },
    {
      method: 'POST',
      pattern: /^\/storyboard$/,
      handler: async ({ body }) => {
        const shots = Array.isArray(body.shots)
          ? body.shots.flatMap(item => {
              if (item === null || typeof item !== 'object') return []
              const shot = item as Record<string, unknown>
              const prompt = String(shot.prompt ?? '').trim()
              if (prompt === '') return []
              return [{ prompt, ...(typeof shot.seconds === 'number' ? { seconds: shot.seconds } : {}), ...(typeof shot.ref === 'string' && shot.ref !== '' ? { ref: shot.ref } : {}) }]
            })
          : []
        const job = studio.startStoryboard({
          shots,
          style: optional(body.style),
          chain: body.chain === true,
          concat: body.concat !== false,
          seconds: typeof body.seconds === 'number' ? body.seconds : undefined,
          resolution: optional(body.resolution),
          aspectRatio: optional(body.aspectRatio),
          channel: optional(body.channel),
          model: optional(body.model),
        })
        return { ok: true, job: jobView(job) }
      },
    },
    {
      method: 'POST',
      pattern: /^\/concat$/,
      handler: async ({ body }) => {
        const job = studio.startConcat({ ids: stringArray(body.ids), ...(optional(body.size) === undefined ? {} : { size: optional(body.size) }) })
        return { ok: true, job: jobView(job) }
      },
    },
    {
      method: 'POST',
      pattern: /^\/comfy\/run$/,
      handler: async ({ body }) => {
        const images: Array<string | { slot?: string; path: string }> = []
        if (Array.isArray(body.images)) {
          for (const item of body.images) {
            if (typeof item === 'string') { images.push(item); continue }
            if (item !== null && typeof item === 'object' && typeof (item as { path?: unknown }).path === 'string') {
              const slot = (item as { slot?: unknown }).slot
              images.push({ path: (item as { path: string }).path, ...(typeof slot === 'string' ? { slot } : {}) })
            }
          }
        }
        const job = studio.startComfy({
          workflowId: String(body.workflowId ?? ''),
          vars: body.vars !== null && typeof body.vars === 'object' ? body.vars as Record<string, unknown> : {},
          overrides: body.overrides !== null && typeof body.overrides === 'object' ? body.overrides as Record<string, unknown> : {},
          images,
        })
        return { ok: true, job: jobView(job) }
      },
    },
    { method: 'GET', pattern: /^\/comfy\/status$/, handler: async () => ({ ok: true, status: await studio.comfyOnline() }) },
    {
      method: 'GET',
      pattern: /^\/comfy\/workflows$/,
      handler: async () => {
        const listed = studio.comfyWorkflows()
        const online = await studio.comfyOnline()
        return { ok: true, workflows: listed.workflows, broken: listed.broken, online: online.online, detail: online.detail }
      },
    },
    {
      method: 'POST',
      pattern: /^\/comfy\/import$/,
      handler: async ({ body }) => {
        const json = typeof body.json === 'string' ? body.json : ''
        const file = typeof body.path === 'string' ? body.path : ''
        if (json !== '') {
          const surface = studio.importWorkflow({
            json,
            ...(typeof body.id === 'string' ? { id: body.id } : {}),
            ...(typeof body.title === 'string' ? { title: body.title } : {}),
            ...(typeof body.description === 'string' ? { description: typeof body.description === 'string' ? body.description : '' } : {}),
          })
          return { ok: true, workflow: surface }
        }
        if (file !== '') return { ok: true, workflow: studio.importWorkflowFile(file, typeof body.title === 'string' ? body.title : undefined) }
        return { status: 400, json: { ok: false, message: '需要 json 或 path' } }
      },
    },
    {
      method: 'POST',
      pattern: /^\/comfy\/workflows\/([^/]+)$/,
      handler: ({ params, body }) => ({
        ok: true,
        workflow: studio.setWorkflowMeta(decodeURIComponent(params[0]!), {
          ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
          ...(typeof body.title === 'string' ? { title: body.title } : {}),
          ...(typeof body.description === 'string' ? { description: body.description } : {}),
        }),
      }),
    },
    {
      method: 'DELETE',
      pattern: /^\/comfy\/workflows\/([^/]+)$/,
      handler: ({ params }) => ({ ok: studio.removeWorkflow(decodeURIComponent(params[0]!)) }),
    },
    {
      method: 'GET',
      pattern: /^\/library$/,
      handler: ({ url }) => {
        const limit = Number.parseInt(url.searchParams.get('limit') ?? '60', 10)
        const offset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10)
        const favorite = url.searchParams.get('favorite')
        const listed = studio.getLibrary().list({
          query: url.searchParams.get('query') ?? undefined,
          kind: url.searchParams.get('kind') ?? undefined,
          favorite: favorite === '1' || favorite === 'true' ? true : undefined,
          limit: Number.isFinite(limit) ? limit : 60,
          offset: Number.isFinite(offset) ? offset : 0,
        })
        return { ok: true, total: listed.total, items: listed.items.map(assetView) }
      },
    },
    {
      method: 'POST',
      pattern: /^\/library\/scan$/,
      handler: () => ({ ok: true, added: studio.getLibrary().scan(1000) }),
    },
    {
      method: 'POST',
      pattern: /^\/library\/import$/,
      handler: async ({ body }) => {
        if (typeof body.dataUrl === 'string') {
          return { ok: true, asset: assetView(studio.importBase64(body.dataUrl, typeof body.name === 'string' ? body.name : undefined)) }
        }
        const file = typeof body.path === 'string' ? body.path : ''
        if (file === '') return { status: 400, json: { ok: false, message: '需要 path 或 dataUrl' } }
        return { ok: true, asset: assetView(studio.importAsset(file)) }
      },
    },
    {
      method: 'POST',
      pattern: /^\/library\/([^/]+)\/favorite$/,
      handler: ({ params, body }) => {
        const asset = studio.getLibrary().setFavorite(decodeURIComponent(params[0]!), body.favorite !== false)
        if (asset === undefined) return { status: 404, json: { ok: false, message: '素材不存在' } }
        return { ok: true, asset: assetView(asset) }
      },
    },
    {
      method: 'DELETE',
      pattern: /^\/library\/([^/]+)$/,
      handler: ({ params }) => ({ ok: studio.getLibrary().remove(decodeURIComponent(params[0]!), { deleteFile: true }) }),
    },
    {
      method: 'GET',
      pattern: /^\/asset\/([^/]+)$/,
      handler: ({ params, url }) => {
        const asset = studio.getLibrary().get(decodeURIComponent(params[0]!))
        if (asset === undefined) return { status: 404, json: { ok: false, message: '素材不存在' } }
        if (!fs.existsSync(asset.path)) return { status: 404, json: { ok: false, message: '文件已不在磁盘上' } }
        return { file: asset.path, ...(url.searchParams.get('download') === '1' ? { downloadName: asset.name } : {}) }
      },
    },
    {
      method: 'GET',
      pattern: /^\/stats$/,
      handler: () => ({ ok: true, ...studio.libraryStats(), ...studio.diagnostics() }),
    },
    {
      method: 'POST',
      pattern: /^\/reveal$/,
      handler: ({ body }) => {
        const file = typeof body.path === 'string' ? body.path : ''
        if (file === '') return { status: 400, json: { ok: false, message: '需要 path' } }
        // Only indexed files or files under the allowed roots can be revealed.
        const asset = studio.getLibrary().getByPath(file)
        if (asset === undefined) assertImportable(studio.getConfig(), ctx, file)
        return { ok: true, path: file, dir: path.dirname(file) }
      },
    },
  ]

  async function dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const sub = url.pathname.slice(API_BASE.length) || '/'
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' })
      res.end()
      return
    }
    const method = req.method === 'HEAD' ? 'GET' : (req.method ?? 'GET')
    let matched: { route: Route; params: string[] } | undefined
    let methodMismatch = false
    for (const route of routes) {
      const match = route.pattern.exec(sub)
      if (match === null) continue
      if (route.method !== method) { methodMismatch = true; continue }
      matched = { route, params: match.slice(1) }
      break
    }
    if (matched === undefined) {
      sendJson(res, methodMismatch ? 405 : 404, { ok: false, message: methodMismatch ? '方法不允许' : `没有这个接口：${sub}` })
      return
    }
    try {
      const body = method === 'POST' || method === 'PUT' ? await readBody(req) : {}
      const result = await guard(matched.route.handler)({ params: matched.params, body, url, req, res }) as RouteResult | Record<string, unknown>
      if (typeof result === 'object' && result !== null && ('file' in result)) {
        const file = (result as { file: string }).file
        serveFile(req, res, file, (result as { downloadName?: string }).downloadName)
        return
      }
      const status = typeof result === 'object' && result !== null && typeof (result as { status?: unknown }).status === 'number'
        ? (result as { status: number }).status
        : 200
      const json = typeof result === 'object' && result !== null && 'json' in result
        ? (result as { json: unknown }).json
        : result
      sendJson(res, status, json)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendJson(res, 400, { ok: false, message })
    }
  }

  return { dispatch }
}

function optional(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  if (typeof value === 'string' && value.trim() !== '') return value.split(',').map(item => item.trim()).filter(item => item !== '')
  return []
}

/** Config for the browser: keys masked or omitted. */
function publicConfig(studio: StudioService): Record<string, unknown> {
  const config = studio.getConfig()
  return {
    ...config,
    channels: studio.channels().map(channel => ({
      ...channel,
      apiKey: channel.keySource === 'inline' ? '••••••••' : undefined,
    })),
  }
}

/** Job record for the panel: add anything the view needs but keep it small. */
function publicJob(job: import('./types.js').JobRecord): Record<string, unknown> {
  return { ...job, assets: (job.assets ?? []).map(assetView) }
}
