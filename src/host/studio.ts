/**
 * The service layer. It owns the merged config, the channel adapters, the job
 * manager and the asset library, and exposes one method per capability to both
 * the agent tools and the HTTP routes.
 */
import fs from 'node:fs'
import path from 'node:path'

import { AssetLibrary } from './library.js'
import { JobManager, type JobContext } from './jobs.js'
import { ComfyClient, applyVars, assertApiWorkflow, historyFiles, historyState, inferSurface, listWorkflows, getWorkflow, saveWorkflow, deleteWorkflow, type ApiWorkflow, type WorkflowSurface } from './comfy.js'
import { capabilitiesOf, findChannel, importRootsOf, isReady, loadStoredConfig, mergeConfig, resolveChannel, resolveModel, resolveOutputDir, saveStoredConfig, workspaceDirOf, apiKeyOf, assertImportable, configFile } from './config.js'
import { concatVideos, detectFfmpeg, extractLastFrame } from './ffmpeg.js'
import { generateOpenAIImage, generateOpenAIVideo } from './providers/openai.js'
import { generateGoogleImage, generateGoogleVideo } from './providers/google.js'
import { generateDashScopeImage, generateDashScopeVideo } from './providers/dashscope.js'
import { generateArkImage, generateArkVideo } from './providers/ark.js'
import { generateXaiImage, generateXaiVideo } from './providers/xai.js'
import type { AssetRecord, ChannelConfig, GeneratedImage, GeneratedVideo, HostContext, ImageRequest, JobRecord, Logger, StudioConfig, VideoRequest } from './types.js'
import { canonical, dataDir, ensureDir, imageSize, makeId, mimeOf, sniffImageMime } from './util.js'

export const API_BASE = '/media-studio/api'

export interface GenerationArgs {
  prompt: string
  channel?: string
  model?: string
  refs?: string[]
  negative?: string
  size?: string
  aspectRatio?: string
  quality?: string
  n?: number
  seed?: number
  wait?: boolean
}

export interface VideoArgs {
  prompt: string
  channel?: string
  model?: string
  refs?: string[]
  mode?: 'text' | 'image' | 'keyframe' | 'reference'
  seconds?: number
  resolution?: string
  aspectRatio?: string
  negative?: string
  seed?: number
  wait?: boolean
}

export interface ComfyArgs {
  workflowId: string
  vars?: Record<string, unknown>
  overrides?: Record<string, unknown>
  images?: Array<string | { slot?: string; path: string }>
  wait?: boolean
}

export interface StoryboardArgs {
  shots: Array<{ prompt: string; seconds?: number; ref?: string }>
  style?: string
  channel?: string
  model?: string
  seconds?: number
  resolution?: string
  aspectRatio?: string
  chain?: boolean
  concat?: boolean
  wait?: boolean
}

function loggerOf(ctx: HostContext): Logger {
  const raw = ctx.logger as { info?: Logger['info']; warn?: Logger['warn']; error?: Logger['error'] } | undefined
  if (typeof raw?.info === 'function') return raw as Logger
  return { info: (...args) => console.log(...args), warn: (...args) => console.warn(...args), error: (...args) => console.error(...args) }
}

export class StudioService {
  readonly logger: Logger
  private config: StudioConfig
  private readonly outputDir: string
  private readonly outputSource: string
  private readonly library: AssetLibrary
  readonly jobs: JobManager
  private readonly ctx: HostContext
  /** Serialised per-channel key so a panel edit is visible immediately. */
  private revision = 0

  constructor(ctx: HostContext, entryConfig: unknown) {
    this.ctx = ctx
    this.logger = loggerOf(ctx)
    this.config = mergeConfig(loadStoredConfig(), entryConfig)
    const resolved = resolveOutputDir(this.config, ctx)
    this.outputDir = canonical(resolved.dir)
    this.outputSource = resolved.source
    ensureDir(this.outputDir)
    const roots = [this.outputDir, ...this.config.libraryRoots.map(root => canonical(root))]
    this.library = new AssetLibrary(roots, this.logger)
    this.jobs = new JobManager(this.logger)
    this.library.scan(300)
  }

  // ── config ────────────────────────────────────────────────────────────────

  getConfig(): StudioConfig {
    return this.config
  }

  getOutputDir(): { dir: string; source: string } {
    // Fixed at startup: changing outputDir in the panel needs a restart, and
    // reporting the new path while writing to the old one would be a lie.
    return { dir: this.outputDir, source: this.outputSource }
  }

  getLibrary(): AssetLibrary {
    return this.library
  }

  setEntryConfig(entryConfig: unknown): void {
    this.config = mergeConfig(this.config, entryConfig)
  }

  /** Merge a panel patch, persist, and forget stale channels. */
  updateConfig(patch: unknown): StudioConfig {
    const next = mergeConfig(this.config, patch)
    // `channels` in a patch must be able to delete a channel: an explicit array
    // replaces the list, while the merge above only adds/updates by id.
    if (patch !== null && typeof patch === 'object' && Array.isArray((patch as { channels?: unknown }).channels)) {
      const wanted = (patch as { channels: Array<Record<string, unknown>> }).channels
      next.channels = wanted
        .map(item => findChannel({ ...next, channels: next.channels }, String(item.id ?? '')))
        .filter((item): item is ChannelConfig => item !== undefined)
    }
    this.config = next
    saveStoredConfig(this.config)
    this.revision += 1
    return this.config
  }

  channels(): Array<ChannelConfig & { capabilities: string[]; ready: boolean; keyHint: string; keySource: 'inline' | 'env' | 'none' }> {
    return this.config.channels.map(channel => {
      const inline = channel.apiKey?.trim() ?? ''
      const env = channel.apiKeyEnv?.trim() ?? ''
      const envValue = env === '' ? '' : (process.env[env] ?? '').trim()
      // Explicit field list: headers/options/extraBody can carry gateway auth
      // and must not travel to the browser just because they sit on the config.
      return {
        id: channel.id,
        label: channel.label,
        kind: channel.kind,
        ...(channel.enabled === undefined ? {} : { enabled: channel.enabled }),
        ...(channel.baseUrl === undefined ? {} : { baseUrl: channel.baseUrl }),
        ...(channel.apiKeyEnv === undefined ? {} : { apiKeyEnv: channel.apiKeyEnv }),
        ...(channel.imageModel === undefined ? {} : { imageModel: channel.imageModel }),
        ...(channel.videoModel === undefined ? {} : { videoModel: channel.videoModel }),
        ...(channel.models === undefined ? {} : { models: channel.models }),
        apiKey: inline === '' ? undefined : maskKey(inline),
        capabilities: capabilitiesOf(channel),
        ready: isReady(channel),
        keyHint: inline !== '' ? maskKey(inline) : envValue !== '' ? `环境变量 ${env}` : env !== '' ? `未设置（${env}）` : '未配置',
        keySource: inline !== '' ? 'inline' : envValue !== '' ? 'env' : 'none',
      }
    })
  }

  /** Keep the write-only key semantics: masked values sent back are ignored. */
  maskIncomingChannels(raw: unknown): unknown {
    if (!Array.isArray(raw)) return raw
    return raw.map(item => {
      if (item === null || typeof item !== 'object') return item
      const channel = { ...(item as Record<string, unknown>) }
      if (typeof channel.apiKey === 'string' && channel.apiKey.includes('…')) delete channel.apiKey
      return channel
    })
  }

  channelById(id: string): ChannelConfig | undefined {
    return findChannel(this.config, id)
  }

  /** A client for the configured ComfyUI endpoint, or the reason there is none. */
  private comfyClient(): { client?: ComfyClient; error?: string } {
    const channel = this.config.channels.find(item => item.kind === 'comfyui')
    if (channel === undefined) return { error: '没有 ComfyUI 通道' }
    const base = channel.baseUrl?.trim() ?? ''
    // No built-in fallback address: the repository must not ship a host, and a
    // silent localhost default hides a missing configuration.
    if (base === '') return { error: '还没有填写 ComfyUI 地址（面板 → 通道 → ComfyUI）' }
    return { client: new ComfyClient(base, channel.headers, this.logger) }
  }

  /** Live probe for the panel and the `test` route. */
  async testChannel(id: string): Promise<{ ok: boolean; detail: string; latencyMs?: number }> {
    const started = Date.now()
    const channel = this.channelById(id)
    if (channel === undefined) return { ok: false, detail: `没有通道 ${id}` }
    if (channel.kind === 'comfyui') {
      const built = this.comfyClient()
      if (built.client === undefined) return { ok: false, detail: built.error ?? 'ComfyUI 未配置' }
      const stats = await built.client.systemStats()
      return stats.ok
        ? { ok: true, detail: `ComfyUI 在线${systemSummary(stats.system)}`, latencyMs: Date.now() - started }
        : { ok: false, detail: stats.error ?? '连不上' }
    }
    const key = apiKeyOf(channel)
    if (key === '') return { ok: false, detail: `还没有 API Key（${channel.apiKeyEnv ?? '面板里填写'}）` }
    const base = (channel.baseUrl ?? '').replace(/\/+$/, '')
    if (base === '') return { ok: false, detail: '缺少 baseUrl' }
    const url = channel.kind === 'google'
      ? `${base}/models?key=${encodeURIComponent(key)}`
      : channel.kind === 'dashscope'
        ? `${base}/models`
        : `${base}/models`
    try {
      const headers: Record<string, string> = channel.kind === 'google' ? { 'x-goog-api-key': key } : { authorization: `Bearer ${key}` }
      const response = await fetch(url, { headers: { ...headers, ...channel.headers }, signal: AbortSignal.timeout(15_000) })
      if (response.ok) return { ok: true, detail: `连接正常（HTTP ${String(response.status)}）`, latencyMs: Date.now() - started }
      if (response.status === 401 || response.status === 403) return { ok: false, detail: '鉴权失败：API Key 无效或没有该模型的权限' }
      // A gateway may not implement /models even though generation works.
      return { ok: response.status === 404, detail: response.status === 404 ? '端点可达（该网关未实现 /models，可直接试生成）' : `HTTP ${String(response.status)}` }
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) }
    }
  }

  // ── references ────────────────────────────────────────────────────────────

  /** Asset id, absolute path, or path inside the workspace. */
  resolveRef(input: string): { path: string; data: Buffer; mime: string } {
    const trimmed = input.trim()
    if (trimmed === '') throw new Error('空的参考图')
    const asset = this.library.get(trimmed)
    const file = asset?.path ?? trimmed
    const abs = assertImportable(this.config, this.ctx, path.isAbsolute(file) ? file : path.resolve(file))
    const data = fs.readFileSync(abs)
    if (data.length > 20 * 1024 * 1024) throw new Error(`参考图超过 20MB：${abs}`)
    return { path: abs, data, mime: sniffImageMime(data) ?? mimeOf(abs) }
  }

  // ── generation ────────────────────────────────────────────────────────────

  private adapterFor(channel: ChannelConfig): { image: ((request: ImageRequest) => Promise<GeneratedImage[]>) | undefined; video: ((request: VideoRequest) => Promise<GeneratedVideo>) | undefined } {
    switch (channel.kind) {
      case 'openai':
      case 'openai-compat': return { image: generateOpenAIImage, video: generateOpenAIVideo }
      case 'google': return { image: generateGoogleImage, video: generateGoogleVideo }
      case 'dashscope': return { image: generateDashScopeImage, video: generateDashScopeVideo }
      case 'ark': return { image: generateArkImage, video: generateArkVideo }
      case 'xai': return { image: generateXaiImage, video: generateXaiVideo }
      case 'comfyui': return { image: undefined, video: undefined }
      default: return { image: undefined, video: undefined }
    }
  }

  private requireChannel(capability: 'image' | 'video', requested?: string): ChannelConfig {
    // Cloud adapters cannot run a ComfyUI channel; workflows go through
    // startComfy, so exclude it instead of failing with a confusing message.
    const resolved = resolveChannel(this.config, capability, requested, { cloudOnly: true })
    if (resolved.channel === undefined) throw new Error(resolved.error ?? '没有可用通道')
    return resolved.channel
  }

  startImage(args: GenerationArgs): JobRecord {
    const prompt = args.prompt.trim()
    if (prompt === '') throw new Error('prompt 不能为空')
    const n = Math.max(1, Math.min(10, Math.round(args.n ?? 1)))
    const channel = this.requireChannel('image', args.channel)
    if (channel.kind === 'comfyui') throw new Error('ComfyUI 通道请用 media_comfy_run（需要先选定工作流）')
    const model = resolveModel(channel, 'image', args.model)
    const refs = (args.refs ?? []).slice(0, 5).map(ref => this.resolveRef(ref))
    const key = apiKeyOf(channel)
    if (key === '') throw new Error(`通道 ${channel.label} 缺少 API Key`)

    return this.jobs.start({
      kind: 'image',
      prompt,
      channelId: channel.id,
      provider: channel.kind,
      model,
      params: { n, refs: refs.map(ref => ref.path), size: args.size, aspectRatio: args.aspectRatio, negative: args.negative },
    }, async context => {
      const request: ImageRequest = {
        channel: { ...channel, imageModel: model },
        apiKey: key,
        prompt,
        ...(args.negative === undefined ? {} : { negative: args.negative }),
        ...(args.size === undefined ? {} : { size: args.size }),
        ...(args.aspectRatio === undefined ? {} : { aspectRatio: args.aspectRatio }),
        ...(args.quality === undefined ? {} : { quality: args.quality }),
        n,
        refs: refs.map(ref => ({ data: ref.data, mime: ref.mime })),
        signal: context.signal,
        maxBytes: this.config.maxImageBytes,
      }
      context.progress('正在请求图像模型…')
      const adapter = this.adapterFor(channel).image
      if (adapter === undefined) throw new Error(`通道 ${channel.label} 不支持图像生成`)
      const images = await adapter(request)
      return { assets: this.saveImages(images, { prompt, channel, model, jobId: context.job.id, refs: refs.map(ref => ref.path), params: { n, aspectRatio: args.aspectRatio, size: args.size } }) }
    })
  }

  startVideo(args: VideoArgs): JobRecord {
    const prompt = args.prompt.trim()
    if (prompt === '') throw new Error('prompt 不能为空')
    const channel = this.requireChannel('video', args.channel)
    if (channel.kind === 'comfyui') throw new Error('ComfyUI 通道请用 media_comfy_run')
    const model = resolveModel(channel, 'video', args.model)
    const refs = (args.refs ?? []).slice(0, 5).map(ref => this.resolveRef(ref))
    const mode = args.mode ?? (refs.length === 0 ? 'text' : refs.length >= 2 ? 'keyframe' : 'image')
    const key = apiKeyOf(channel)
    if (key === '') throw new Error(`通道 ${channel.label} 缺少 API Key`)

    return this.jobs.start({
      kind: 'video',
      prompt,
      channelId: channel.id,
      provider: channel.kind,
      model,
      params: { mode, refs: refs.map(ref => ref.path), seconds: args.seconds, resolution: args.resolution, aspectRatio: args.aspectRatio },
    }, async context => {
      context.progress('正在提交视频任务…')
      const adapter = this.adapterFor(channel).video
      if (adapter === undefined) throw new Error(`通道 ${channel.label} 不支持视频生成`)
      const video = await adapter({
        channel: { ...channel, videoModel: model },
        apiKey: key,
        prompt,
        ...(args.negative === undefined ? {} : { negative: args.negative }),
        mode,
        refs: refs.map(ref => ({ data: ref.data, mime: ref.mime })),
        seconds: args.seconds ?? 5,
        resolution: args.resolution ?? '720P',
        aspectRatio: args.aspectRatio ?? '16:9',
        ...(args.seed === undefined ? {} : { seed: args.seed }),
        signal: context.signal,
        maxBytes: this.config.maxVideoBytes,
        onProgress: stage => context.progress(stage),
      })
      const asset = this.saveVideo(video, { prompt, channel, model, jobId: context.job.id, refs: refs.map(ref => ref.path), seconds: args.seconds })
      const assets = [asset]
      if (video.poster !== undefined && video.poster.length > 0) {
        try {
          const poster = this.library.addBuffer(video.poster, { kind: 'image', name: `poster-${asset.name.replace(/\.[a-z0-9]+$/i, '')}`, meta: { prompt, channelId: channel.id, provider: channel.kind, model, jobId: context.job.id } })
          asset.extra = { ...(asset.extra ?? {}), posterId: poster.id }
          assets.push(poster)
        } catch {
          // poster is a convenience; never fail the video because of it
        }
      }
      return { assets }
    })
  }

  startComfy(args: ComfyArgs): JobRecord {
    const entry = getWorkflow(args.workflowId)
    if (entry === undefined) throw new Error(`没有工作流 ${args.workflowId}。先列一下 media_comfy_workflows。`)
    if (entry.meta.enabled === false) throw new Error(`工作流 ${args.workflowId} 已被停用`)
    const channel = findChannel(this.config, 'comfyui') ?? this.config.channels.find(item => item.kind === 'comfyui')
    if (channel === undefined) throw new Error('没有 ComfyUI 通道')
    const built = this.comfyClient()
    if (built.client === undefined) throw new Error(built.error ?? 'ComfyUI 未配置')
    const client = built.client
    const surface = inferSurface(entry.id, entry.workflow, entry.meta)
    const overrides = normaliseOverrides(args.overrides)
    const vars: Record<string, unknown> = { ...(args.vars ?? {}) }
    const base: ApiWorkflow = JSON.parse(JSON.stringify(entry.workflow)) as ApiWorkflow
    for (const [key, value] of Object.entries(overrides)) {
      const [nodeId, input] = key.split('.')
      if (nodeId === undefined || input === undefined) continue
      // Explicit overrides are advanced; they do not need a surface slot.
      if (base[nodeId]?.inputs !== undefined) base[nodeId]!.inputs![input] = value
    }
    const images = args.images ?? []

    return this.jobs.start({
      kind: 'comfy',
      prompt: String(vars.prompt ?? vars.text ?? surface.title),
      channelId: channel.id,
      provider: 'comfyui',
      model: surface.title,
      params: { workflowId: entry.id, vars, overrides },
    }, async context => {
      const applied = applyVars(base, surface, vars)
      const uploaded = await this.uploadComfyImages(client, surface, images, context.signal)
      const missingImages = surface.slots
        .filter(slot => slot.type === 'image' && slot.required && !uploaded.some(([name]) => name === slot.name))
        .map(slot => slot.name)
      if (missingImages.length > 0) throw new Error(`工作流需要参考图：${missingImages.join('、')}。用 images 参数传本机图片或素材库 id。`)
      for (const [slot, name] of uploaded) {
        const target = surface.slots.find(item => item.name === slot)
        if (target !== undefined) {
          applied.workflow[target.nodeId]!.inputs![target.input] = name
          applied.applied.push(slot)
        }
      }
      context.progress('正在提交到 ComfyUI…')
      const submitted = await client.queuePrompt(applied.workflow)
      context.progress('ComfyUI 执行中…')
      const assets: AssetRecord[] = []
      const deadline = Date.now() + this.config.comfyTimeoutMs
      for (;;) {
        if (context.signal.aborted) throw new Error('cancelled')
        const history = await client.history(submitted.promptId)
        if (history !== undefined) {
          const state = historyState(history)
          if (state.state === 'failed') throw new Error(state.message ?? 'ComfyUI 执行失败')
          if (state.state === 'succeeded') {
            const files = historyFiles(history)
            if (files.length === 0) throw new Error('ComfyUI 执行完成但没有产物（工作流可能没有 SaveImage 节点）')
            for (const file of files) {
              const data = await client.view(file)
              const asset = file.kind === 'video'
                ? this.library.addBuffer(data, { ext: path.extname(file.filename) || '.mp4', kind: 'video', name: path.basename(file.filename, path.extname(file.filename)), meta: { prompt: String(vars.prompt ?? ''), channelId: channel.id, provider: 'comfyui', model: surface.title, jobId: context.job.id, origin: 'comfy' } })
                : this.library.addBuffer(data, { ext: path.extname(file.filename) || '.png', kind: 'image', name: path.basename(file.filename, path.extname(file.filename)), meta: { prompt: String(vars.prompt ?? ''), channelId: channel.id, provider: 'comfyui', model: surface.title, jobId: context.job.id, origin: 'comfy' } })
              assets.push(asset)
            }
            return { assets }
          }
        }
        if (Date.now() > deadline) throw new Error(`ComfyUI 超时（${String(Math.round(this.config.comfyTimeoutMs / 1000))}s）。任务可能还在跑，去 ComfyUI 队列确认。`)
        await new Promise(resolve => setTimeout(resolve, 1200))
      }
    })
  }

  private async uploadComfyImages(client: ComfyClient, surface: WorkflowSurface, images: Array<string | { slot?: string; path: string }>, signal: AbortSignal): Promise<Array<[string, string]>> {
    const slots = surface.slots.filter(slot => slot.type === 'image')
    if (images.length === 0) return []
    if (slots.length === 0) throw new Error('这个工作流没有图片输入槽位')
    const result: Array<[string, string]> = []
    let index = 0
    for (const item of images) {
      if (signal.aborted) throw new Error('cancelled')
      const ref = typeof item === 'string' ? this.resolveRef(item) : this.resolveRef(item.path)
      const slot = typeof item === 'string' ? slots[index] : slots.find(candidate => candidate.name === item.slot) ?? slots[index]
      if (slot === undefined) throw new Error('图片数量超过工作流的图片槽位')
      const name = await client.uploadImage(ref.data, `${makeId('ref')}${path.extname(ref.path) || '.png'}`)
      result.push([slot.name, name])
      index += 1
    }
    return result
  }

  saveImages(images: GeneratedImage[], meta: { prompt: string; channel: ChannelConfig; model: string; jobId?: string; refs?: string[]; params?: Record<string, unknown> }): AssetRecord[] {
    return images.map((image, index) => this.library.addBuffer(image.data, {
      kind: 'image',
      name: `${meta.channel.id}-${index + 1}`,
      meta: {
        prompt: meta.prompt,
        ...(image.revisedPrompt === undefined ? {} : { extra: { revisedPrompt: image.revisedPrompt } }),
        channelId: meta.channel.id,
        provider: meta.channel.kind,
        model: meta.model,
        ...(meta.jobId === undefined ? {} : { jobId: meta.jobId }),
        ...(meta.refs === undefined || meta.refs.length === 0 ? {} : { refs: meta.refs }),
        tags: [meta.channel.kind, meta.model].filter(Boolean),
        origin: 'generated',
      },
    }))
  }

  saveVideo(video: GeneratedVideo, meta: { prompt: string; channel: ChannelConfig; model: string; jobId?: string; refs?: string[]; seconds?: number }): AssetRecord {
    return this.library.addBuffer(video.data, {
      kind: 'video',
      ext: extForMime(video.mime),
      name: `${meta.channel.id}-video`,
      meta: {
        prompt: meta.prompt,
        channelId: meta.channel.id,
        provider: meta.channel.kind,
        model: meta.model,
        ...(meta.jobId === undefined ? {} : { jobId: meta.jobId }),
        ...(meta.refs === undefined || meta.refs.length === 0 ? {} : { refs: meta.refs }),
        ...(video.duration === undefined ? {} : { duration: video.duration }),
        ...(meta.seconds === undefined ? {} : { extra: { seconds: meta.seconds, sourceUrl: video.sourceUrl } }),
        tags: [meta.channel.kind, meta.model].filter(Boolean),
        origin: 'generated',
      },
    })
  }

  // ── storyboard ────────────────────────────────────────────────────────────

  startStoryboard(args: StoryboardArgs): JobRecord {
    const shots = args.shots.filter(shot => shot.prompt.trim() !== '')
    if (shots.length === 0) throw new Error('分镜里没有有效镜头（每镜都要有 prompt）')
    if (shots.length > 12) throw new Error('一次最多 12 个镜头')
    const channel = this.requireChannel('video', args.channel)
    if (channel.kind === 'comfyui') throw new Error('分镜目前只支持云端视频通道')
    const model = resolveModel(channel, 'video', args.model)
    const key = apiKeyOf(channel)
    if (key === '') throw new Error(`通道 ${channel.label} 缺少 API Key`)

    return this.jobs.start({
      kind: 'storyboard',
      prompt: shots[0]!.prompt,
      channelId: channel.id,
      provider: channel.kind,
      model,
      params: { shots: shots.map(shot => shot.prompt), chain: args.chain === true, concat: args.concat !== false },
      shots: shots.map((shot, index) => ({ index, prompt: shot.prompt, state: 'queued' })),
    }, async context => {
      const assets: AssetRecord[] = []
      const clips: string[] = []
      let previousTail: string | undefined
      for (const [index, shot] of shots.entries()) {
        if (context.signal.aborted) throw new Error('cancelled')
        const shotState = context.job.shots?.[index]
        if (shotState !== undefined) shotState.state = 'running'
        context.progress(`镜头 ${String(index + 1)}/${String(shots.length)}：生成中`)
        const prompt = args.style === undefined || args.style.trim() === '' ? shot.prompt : `${args.style.trim()}，${shot.prompt.trim()}`
        let refPath = shot.ref
        if (refPath === undefined && args.chain === true) refPath = previousTail
        const ref = refPath === undefined ? undefined : this.resolveRef(refPath)
        const adapter = this.adapterFor(channel).video
        if (adapter === undefined) throw new Error('通道不支持视频')
        const video = await adapter({
          channel: { ...channel, videoModel: model },
          apiKey: key,
          prompt,
          mode: ref === undefined ? 'text' : 'image',
          refs: ref === undefined ? [] : [{ data: ref.data, mime: ref.mime }],
          seconds: shot.seconds ?? args.seconds ?? 5,
          resolution: args.resolution ?? '720P',
          aspectRatio: args.aspectRatio ?? '16:9',
          signal: context.signal,
          maxBytes: this.config.maxVideoBytes,
          onProgress: stage => context.progress(`镜头 ${String(index + 1)}/${String(shots.length)}：${stage}`),
        })
        const asset = this.saveVideo(video, { prompt, channel, model, jobId: context.job.id, refs: ref === undefined ? [] : [ref.path], seconds: shot.seconds ?? args.seconds })
        assets.push(asset)
        clips.push(asset.path)
        if (shotState !== undefined) {
          shotState.state = 'succeeded'
          shotState.assetId = asset.id
        }
        if (args.chain === true) {
          try {
            previousTail = await extractLastFrame(asset.path, path.join(dataDir(), 'cache', 'frames'), this.config.ffmpegPath)
          } catch (error) {
            context.progress(`镜头 ${String(index + 1)} 取尾帧失败，下一镜改用文生视频：${error instanceof Error ? error.message : String(error)}`)
            previousTail = undefined
          }
        }
      }
      if (args.concat !== false && clips.length > 1) {
        context.progress('拼接全部镜头…')
        const result = await concatVideos({ inputs: clips, outputDir: path.join(this.outputDir, 'compose'), ffmpegPath: this.config.ffmpegPath, onProgress: stage => context.progress(stage) })
        const data = fs.readFileSync(result.file)
        const final = this.library.addBuffer(data, {
          kind: 'video',
          name: 'storyboard',
          meta: { prompt: shots.map(shot => shot.prompt).join(' / '), channelId: channel.id, provider: channel.kind, model, jobId: context.job.id, tags: ['storyboard'], origin: 'generated' },
        })
        assets.push(final)
      }
      return { assets, shots: context.job.shots }
    })
  }

  // ── concat ────────────────────────────────────────────────────────────────

  startConcat(input: { ids: string[]; size?: string; keepAudio?: boolean }): JobRecord {
    if (input.ids.length < 2) throw new Error('至少选两段视频')
    const files = input.ids.map(id => {
      const asset = this.library.get(id)
      if (asset === undefined) throw new Error(`素材 ${id} 不存在`)
      if (asset.kind !== 'video') throw new Error(`${asset.name} 不是视频`)
      return asset
    })
    return this.jobs.start({
      kind: 'concat',
      prompt: files.map(asset => asset.name).join(' + '),
      params: { ids: input.ids },
    }, async context => {
      const result = await concatVideos({
        inputs: files.map(asset => asset.path),
        outputDir: path.join(this.outputDir, 'compose'),
        ...(input.size === undefined ? {} : { size: input.size }),
        ffmpegPath: this.config.ffmpegPath,
        onProgress: stage => context.progress(stage),
      })
      const data = fs.readFileSync(result.file)
      const asset = this.library.addBuffer(data, {
        kind: 'video',
        name: 'concat',
        meta: { prompt: files.map(item => item.prompt ?? item.name).join(' | '), tags: ['concat'], jobId: context.job.id, origin: 'generated' },
      })
      return { assets: [asset] }
    })
  }

  // ── comfy workflows ───────────────────────────────────────────────────────

  comfyWorkflows(): { workflows: WorkflowSurface[]; broken: string[]; comfyui: { baseUrl: string; online: boolean; detail?: string } } {
    const listed = listWorkflows()
    const channel = this.config.channels.find(item => item.kind === 'comfyui')
    return {
      workflows: listed.entries.map(entry => inferSurface(entry.id, entry.workflow, entry.meta)),
      broken: listed.broken,
      comfyui: { baseUrl: channel?.baseUrl ?? '', online: false },
    }
  }

  comfyOnline(): Promise<{ online: boolean; detail?: string; system?: Record<string, unknown> }> {
    const built = this.comfyClient()
    if (built.client === undefined) return Promise.resolve({ online: false, detail: built.error ?? 'ComfyUI 未配置' })
    return built.client.systemStats().then(stats => ({ online: stats.ok, detail: stats.error, system: stats.system }))
  }

  importWorkflow(input: { json?: string; id?: string; title?: string; description?: string }): WorkflowSurface {
    const raw = input.json ?? ''
    if (raw.trim() === '') throw new Error('缺少工作流 JSON')
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { throw new Error('工作流 JSON 解析失败') }
    const workflow = assertApiWorkflow(parsed)
    const id = saveWorkflow(input.id ?? input.title ?? `workflow-${String(Date.now())}`, workflow, {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: input.description }),
      enabled: true,
    })
    return inferSurface(id, workflow, { title: input.title ?? id, description: input.description ?? '', enabled: true })
  }

  importWorkflowFile(file: string, title?: string): WorkflowSurface {
    const abs = assertImportable(this.config, this.ctx, file)
    return this.importWorkflow({ json: fs.readFileSync(abs, 'utf8'), ...(title === undefined ? {} : { id: title, title }) })
  }

  removeWorkflow(id: string): boolean {
    return deleteWorkflow(id)
  }

  setWorkflowMeta(id: string, patch: { enabled?: boolean; title?: string; description?: string }): WorkflowSurface {
    const entry = getWorkflow(id)
    if (entry === undefined) throw new Error(`没有工作流 ${id}`)
    const meta = { ...entry.meta, ...patch, updatedAt: Date.now() }
    saveWorkflow(id, entry.workflow, meta)
    return inferSurface(id, entry.workflow, meta)
  }

  // ── library ───────────────────────────────────────────────────────────────

  importAsset(file: string): AssetRecord {
    const abs = assertImportable(this.config, this.ctx, file)
    return this.library.register(abs)
  }

  /** Save an inline base64 image (pasted from the browser). */
  importBase64(data: string, name?: string): AssetRecord {
    const match = /^data:([^;]+);base64,(.*)$/s.exec(data)
    const mime = match?.[1] ?? 'image/png'
    const buffer = Buffer.from((match?.[2] ?? data).replace(/\s+/g, ''), 'base64')
    if (buffer.length === 0) throw new Error('空的图片数据')
    if (buffer.length > this.config.maxImageBytes) throw new Error('图片太大')
    const ext = mime.includes('jpeg') ? '.jpg' : mime.includes('webp') ? '.webp' : mime.includes('gif') ? '.gif' : mime.includes('mp4') ? '.mp4' : '.png'
    return this.library.addBuffer(buffer, { kind: mime.startsWith('video') ? 'video' : 'image', ext, ...(name === undefined ? {} : { name }) })
  }

  /** Optional inline attachments for tool results. */
  async attach(assets: AssetRecord[]): Promise<Array<Record<string, unknown>>> {
    const service = this.ctx.get?.('attachments') as { saveImage?: (input: unknown) => Promise<unknown> } | undefined
    if (typeof service?.saveImage !== 'function') return []
    const blocks: Array<Record<string, unknown>> = []
    for (const asset of assets) {
      if (asset.kind !== 'image') continue
      try {
        const data = fs.readFileSync(asset.path)
        const ref = await service.saveImage({ data: new Uint8Array(data), mediaType: asset.mime, name: asset.name })
        if (ref !== undefined && ref !== null) blocks.push({ type: 'image', attachment: ref })
      } catch (error) {
        this.logger.warn(`[media-studio] 内联附件失败（仍可用路径预览）：${String(error)}`)
      }
    }
    return blocks
  }

  // ── diagnostics ───────────────────────────────────────────────────────────

  /** Counts for the panel header and the stats tool. */
  libraryStats(): { total: number; images: number; videos: number; bytes: number; favorites: number; activeJobs: number } {
    const all = this.library.list({ limit: 100_000 }).items
    return {
      total: all.length,
      images: all.filter(item => item.kind === 'image').length,
      videos: all.filter(item => item.kind === 'video').length,
      bytes: all.reduce((sum, item) => sum + item.bytes, 0),
      favorites: all.filter(item => item.favorite === true).length,
      activeJobs: this.jobs.activeCount(),
    }
  }

  diagnostics(): Record<string, unknown> {
    const ffmpeg = detectFfmpeg(this.config.ffmpegPath)
    return {
      plugin: 'dsh-media-studio',
      version: '0.1.0',
      configFile: configFile(),
      dataDir: dataDir(),
      outputDir: this.outputDir,
      workspace: workspaceDirOf(this.ctx) ?? null,
      importRoots: importRootsOf(this.config, this.ctx),
      ffmpeg: { found: ffmpeg.ffmpeg !== undefined, path: ffmpeg.ffmpeg ?? null, error: ffmpeg.error ?? null },
      activeJobs: this.jobs.activeCount(),
      revision: this.revision,
    }
  }
}

function normaliseOverrides(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[^.]+\.[^.]+$/.test(key)) throw new Error(`overrides 的键必须形如 "6.text"，收到 ${key}`)
    out[key] = raw
  }
  return out
}

function maskKey(key: string): string {
  if (key.length <= 8) return `${key.slice(0, 2)}…`
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

function extForMime(mime: string): string {
  if (mime.includes('webm')) return '.webm'
  if (mime.includes('quicktime')) return '.mov'
  if (mime.includes('matroska')) return '.mkv'
  return '.mp4'
}

function systemSummary(system: Record<string, unknown> | undefined): string {
  if (system === undefined) return ''
  const devices = system.devices
  if (Array.isArray(devices) && devices.length > 0) {
    const first = devices[0] as { name?: unknown; vram_total?: unknown }
    const vram = typeof first.vram_total === 'number' ? ` · ${String(Math.round(first.vram_total / 1024 / 1024 / 1024))}GB` : ''
    return ` · ${typeof first.name === 'string' ? first.name : 'GPU'}${vram}`
  }
  return ''
}

/** Validate an image dimension helper is exported for tests. */
export { imageSize }
