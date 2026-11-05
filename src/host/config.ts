/**
 * Configuration: built-in channel presets, merge rules, key resolution and
 * output directory discovery.
 *
 * Precedence for every value: `config.json` (panel writes it) > cordis entry
 * config > environment > built-in default. Keeping the built-ins here means a
 * fresh install shows all six families in the panel with the right endpoints.
 */
import fs from 'node:fs'
import path from 'node:path'

import type { Capability, ChannelConfig, ChannelKind, StudioConfig } from './types.js'
import { canonical, dataDir, ensureDir, foldPath, isInside, readJson, writeJson } from './util.js'

/** Data-dir config file written by the panel. */
export function configFile(): string {
  return path.join(dataDir(), 'config.json')
}

const BUILTINS: ChannelConfig[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    imageModel: 'gpt-image-1',
    videoModel: 'sora-2',
    models: { image: ['gpt-image-1', 'gpt-image-1-mini'], video: ['sora-2', 'sora-2-pro'] },
  },
  {
    id: 'google',
    label: 'Google Gemini / Veo',
    kind: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GEMINI_API_KEY',
    imageModel: 'gemini-2.5-flash-image',
    videoModel: 'veo-3.0-fast-generate-001',
    models: {
      image: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
      video: ['veo-3.0-fast-generate-001', 'veo-3.0-generate-001'],
    },
  },
  {
    id: 'dashscope',
    label: '阿里云百炼 Qwen / Wan',
    kind: 'dashscope',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    imageModel: 'qwen-image-plus',
    videoModel: 'wan2.2-i2v-flash',
    models: {
      image: ['qwen-image-plus', 'qwen-image-edit'],
      video: ['wan2.2-i2v-flash', 'wan2.2-t2v-plus'],
    },
  },
  {
    id: 'ark',
    label: '火山方舟 Seedream / Seedance',
    kind: 'ark',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyEnv: 'ARK_API_KEY',
    imageModel: 'doubao-seedream-4-0-250828',
    videoModel: 'doubao-seedance-1-0-pro-250528',
    models: {
      image: ['doubao-seedream-4-0-250828', 'doubao-seedream-3-0-t2i-250415'],
      video: ['doubao-seedance-1-0-pro-250528', 'doubao-seedance-1-0-lite-i2v-250428'],
    },
  },
  {
    id: 'xai',
    label: 'xAI Grok Imagine',
    kind: 'xai',
    baseUrl: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
    imageModel: 'grok-imagine-image',
    videoModel: 'grok-imagine-video',
    models: { image: ['grok-imagine-image'], video: ['grok-imagine-video'] },
  },
  {
    id: 'comfyui',
    label: 'ComfyUI（本机 / 反代）',
    kind: 'comfyui',
    // Intentionally empty: no host is shipped in the repository. The user
    // fills this in the panel; an empty address keeps the channel not-ready.
    baseUrl: '',
    enabled: true,
  },
]

/** Empty but valid config. */
export function emptyConfig(): StudioConfig {
  return {
    channels: BUILTINS.map(channel => ({ ...channel, models: channel.models === undefined ? undefined : { ...channel.models } })),
    defaults: {},
    outputDir: null,
    libraryRoots: [],
    maxImageBytes: 40 * 1024 * 1024,
    maxVideoBytes: 512 * 1024 * 1024,
    videoTimeoutMs: 40 * 60_000,
    comfyTimeoutMs: 20 * 60_000,
    ffmpegPath: null,
    importRoots: [],
    locale: 'auto',
  }
}

const CAPABILITIES: Record<ChannelKind, Capability[]> = {
  openai: ['image', 'video'],
  'openai-compat': ['image'],
  google: ['image', 'video'],
  dashscope: ['image', 'video'],
  ark: ['image', 'video'],
  xai: ['image', 'video'],
  comfyui: ['image', 'video', 'workflow'],
}

export function capabilitiesOf(channel: ChannelConfig): Capability[] {
  return CAPABILITIES[channel.kind] ?? []
}

/** Resolve the API key for a channel (inline > env). */
export function apiKeyOf(channel: ChannelConfig): string {
  const inline = channel.apiKey?.trim() ?? ''
  if (inline !== '') return inline
  const env = channel.apiKeyEnv?.trim() ?? ''
  if (env !== '') return (process.env[env] ?? '').trim()
  return ''
}

/** A channel is usable when it is not switched off and has what it needs. */
export function isReady(channel: ChannelConfig): boolean {
  if (channel.enabled === false) return false
  if (channel.kind === 'comfyui') return (channel.baseUrl ?? '').trim() !== ''
  return apiKeyOf(channel) !== ''
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function asChannel(raw: unknown): ChannelConfig | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const item = raw as Record<string, unknown>
  const id = typeof item.id === 'string' ? item.id.trim() : ''
  if (id === '') return undefined
  const kind = String(item.kind ?? '') as ChannelKind
  if (!(kind in CAPABILITIES)) return undefined
  return { id, kind, label: typeof item.label === 'string' && item.label.trim() !== '' ? item.label.trim() : id, ...fieldsOf(item) }
}

/** Normalise an endpoint: strip trailing slashes, add http:// when no scheme. */
export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (trimmed === '') return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

/** Parse the mutable fields of a channel entry (no id/kind requirement). */
function fieldsOf(item: Record<string, unknown>): Partial<ChannelConfig> {
  const modelsRaw = item.models
  const models: { image?: string[]; video?: string[] } = {}
  if (modelsRaw !== null && typeof modelsRaw === 'object') {
    const bag = modelsRaw as Record<string, unknown>
    if (Array.isArray(bag.image)) models.image = bag.image.filter((v): v is string => typeof v === 'string')
    if (Array.isArray(bag.video)) models.video = bag.video.filter((v): v is string => typeof v === 'string')
  }
  return {
    ...(typeof item.label === 'string' && item.label.trim() !== '' ? { label: item.label.trim() } : {}),
    ...(typeof item.enabled === 'boolean' ? { enabled: item.enabled } : {}),
    ...(typeof item.baseUrl === 'string' ? { baseUrl: normalizeBaseUrl(item.baseUrl) } : {}),
    ...(typeof item.apiKey === 'string' ? { apiKey: item.apiKey } : {}),
    ...(typeof item.apiKeyEnv === 'string' ? { apiKeyEnv: item.apiKeyEnv } : {}),
    ...(typeof item.imageModel === 'string' ? { imageModel: item.imageModel } : {}),
    ...(typeof item.videoModel === 'string' ? { videoModel: item.videoModel } : {}),
    ...(Object.keys(models).length > 0 ? { models } : {}),
    ...(item.headers !== null && typeof item.headers === 'object'
      ? { headers: Object.fromEntries(Object.entries(item.headers as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string> }
      : {}),
    ...(item.options !== null && typeof item.options === 'object' ? { options: item.options as Record<string, unknown> } : {}),
    ...(item.extraBody !== null && typeof item.extraBody === 'object' ? { extraBody: item.extraBody as Record<string, unknown> } : {}),
    ...(typeof item.timeoutMs === 'number' ? { timeoutMs: item.timeoutMs } : {}),
  }
}

/**
 * Merge config layers. Channels are matched by id so a profile entry that only
 * sets `apiKeyEnv` keeps the rest of the built-in preset.
 */
export function mergeConfig(base: StudioConfig, patch: unknown): StudioConfig {
  if (patch === null || typeof patch !== 'object') return base
  const input = patch as Record<string, unknown>
  const merged: StudioConfig = { ...base, channels: base.channels.map(channel => ({ ...channel })), defaults: { ...base.defaults } }

  if (Array.isArray(input.channels)) {
    for (const raw of input.channels) {
      if (raw === null || typeof raw !== 'object') continue
      const item = raw as Record<string, unknown>
      const id = typeof item.id === 'string' ? item.id.trim() : ''
      const index = id === '' ? -1 : merged.channels.findIndex(channel => channel.id === id)
      if (index >= 0) {
        // A partial entry (id + one field) patches the existing channel; it must
        // not need to repeat `kind` just to change a key or endpoint.
        merged.channels[index] = { ...merged.channels[index]!, ...fieldsOf(item) }
        continue
      }
      const channel = asChannel(raw)
      if (channel !== undefined) merged.channels.push(channel)
    }
  }
  if (input.defaults !== null && typeof input.defaults === 'object') {
    const bag = input.defaults as Record<string, unknown>
    if (typeof bag.image === 'string') merged.defaults.image = bag.image
    if (typeof bag.video === 'string') merged.defaults.video = bag.video
    if (typeof bag.comfyWorkflow === 'string') merged.defaults.comfyWorkflow = bag.comfyWorkflow
  }
  if (typeof input.outputDir === 'string' || input.outputDir === null) merged.outputDir = input.outputDir as string | null
  if (Array.isArray(input.libraryRoots)) merged.libraryRoots = input.libraryRoots.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  if (Array.isArray(input.importRoots)) merged.importRoots = input.importRoots.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  if (typeof input.ffmpegPath === 'string' || input.ffmpegPath === null) merged.ffmpegPath = input.ffmpegPath as string | null
  merged.maxImageBytes = asNumber(input.maxImageBytes, merged.maxImageBytes)
  merged.maxVideoBytes = asNumber(input.maxVideoBytes, merged.maxVideoBytes)
  merged.videoTimeoutMs = asNumber(input.videoTimeoutMs, merged.videoTimeoutMs)
  merged.comfyTimeoutMs = asNumber(input.comfyTimeoutMs, merged.comfyTimeoutMs)
  if (input.locale === 'zh' || input.locale === 'en' || input.locale === 'auto') merged.locale = input.locale
  return merged
}

/** Config as persisted by the panel (no secrets from env, keys stay inline). */
export function loadStoredConfig(): StudioConfig {
  const stored = readJson<StudioConfig>(configFile())
  if (stored === undefined) return emptyConfig()
  // Rebuild over emptyConfig so new built-in presets appear after an upgrade.
  return mergeConfig(emptyConfig(), stored)
}

export function saveStoredConfig(config: StudioConfig): void {
  ensureDir(dataDir())
  writeJson(configFile(), config)
}

/** Channel by id or label, case-insensitive. */
export function findChannel(config: StudioConfig, needle: string | undefined): ChannelConfig | undefined {
  const key = needle?.trim().toLowerCase() ?? ''
  if (key === '') return undefined
  return config.channels.find(channel => channel.id.toLowerCase() === key || channel.label.toLowerCase() === key)
}

/** Pick the channel a generation should use. */
export function resolveChannel(
  config: StudioConfig,
  capability: 'image' | 'video',
  requested?: string,
  options: { cloudOnly?: boolean } = {},
): { channel?: ChannelConfig; error?: string } {
  const allowed = (channel: ChannelConfig): boolean => options.cloudOnly !== true || channel.kind !== 'comfyui'
  if (requested !== undefined && requested.trim() !== '') {
    const explicit = findChannel(config, requested)
    if (explicit === undefined) return { error: `没有 id 或名称为 “${requested}” 的通道。` }
    if (!capabilitiesOf(explicit).includes(capability)) return { error: `通道 “${explicit.label}” 不支持${capability === 'image' ? '图像' : '视频'}生成。` }
    if (!allowed(explicit)) return { error: `通道 “${explicit.label}” 是 ComfyUI，请改用 media_comfy_run 并先选定工作流。` }
    if (explicit.enabled === false) return { error: `通道 “${explicit.label}” 已被关闭。` }
    if (!isReady(explicit)) return { error: `通道 “${explicit.label}” 还没配置 API Key（${explicit.apiKeyEnv ?? '面板 → 通道'}）。` }
    return { channel: explicit }
  }
  const preferred = config.defaults[capability]
  if (preferred !== undefined) {
    const channel = findChannel(config, preferred)
    if (channel !== undefined && capabilitiesOf(channel).includes(capability) && isReady(channel) && allowed(channel)) return { channel }
  }
  const candidates = config.channels.filter(channel => capabilitiesOf(channel).includes(capability) && isReady(channel) && allowed(channel))
  if (candidates.length === 0) {
    return { error: `没有可用的${capability === 'image' ? '图像' : '视频'}通道。在面板「通道」里填一个 API Key，或配置本机 ComfyUI（ComfyUI 请用工作流工具）。` }
  }
  return { channel: candidates[0] }
}

/** Model: explicit > channel default > first catalog entry. */
export function resolveModel(channel: ChannelConfig, capability: 'image' | 'video', requested?: string): string {
  const explicit = requested?.trim() ?? ''
  if (explicit !== '') return explicit
  const fixed = capability === 'image' ? channel.imageModel : channel.videoModel
  if (fixed !== undefined && fixed.trim() !== '') return fixed.trim()
  const list = capability === 'image' ? channel.models?.image : channel.models?.video
  return list?.[0] ?? (capability === 'image' ? 'gpt-image-1' : 'sora-2')
}

/** Internal host directories must never become the media output root. */
function looksInternal(dir: string): boolean {
  const norm = dir.replace(/\\/g, '/').toLowerCase()
  return !fs.existsSync(dir)
    || norm.includes('/.dsh/profiles/')
    || norm.includes('/.dsh/plugins/')
    || norm.includes('/node_modules/')
    || norm.endsWith('/.dsh')
}

interface ServiceBag {
  get?: (name: string) => unknown
}

/** Guess the active workspace directory (env > workingDirectory > registry > cwd). */
export function workspaceDirOf(ctx: ServiceBag): string | undefined {
  const env = process.env.DSH_WORKSPACE?.trim() ?? ''
  if (env !== '') return path.resolve(env)

  try {
    const wd = ctx.get?.('workingDirectory') as { defaultDirectory?: unknown } | undefined
    const dir = wd?.defaultDirectory
    if (typeof dir === 'string' && dir !== '' && !looksInternal(dir)) return path.resolve(dir)
  } catch {
    // service not mounted: fall through
  }

  try {
    const service = ctx.get?.('workspaceRegistry') as { list?: () => unknown } | undefined
    const raw = typeof service?.list === 'function' ? service.list() : []
    const paths = Array.isArray(raw)
      ? raw.map(item => (item !== null && typeof item === 'object' ? (item as { path?: unknown }).path : undefined)).filter((item): item is string => typeof item === 'string' && item !== '')
      : []
    if (paths.length > 0) {
      const cwd = foldPath(process.cwd().replace(/\\/g, '/').replace(/\/+$/, ''))
      const related = paths
        .map(item => ({ item, target: foldPath(item.replace(/\\/g, '/').replace(/\/+$/, '')) }))
        .filter(({ target }) => cwd === target || cwd.startsWith(`${target}/`))
        .sort((a, b) => b.target.length - a.target.length)[0]?.item
      return path.resolve(related ?? paths[0]!)
    }
  } catch {
    // ignore
  }

  const cwd = process.cwd()
  return cwd !== '' && !looksInternal(cwd) ? cwd : undefined
}

/** Final output directory, created on demand. */
export function resolveOutputDir(config: StudioConfig, ctx: ServiceBag): { dir: string; source: string } {
  const configured = config.outputDir?.trim() ?? ''
  if (configured !== '') return { dir: canonical(configured), source: 'config' }
  const workspace = workspaceDirOf(ctx)
  if (workspace !== undefined) return { dir: path.join(workspace, 'media-studio'), source: 'workspace' }
  return { dir: path.join(dataDir(), 'outputs'), source: 'data' }
}

/** All roots an import may read from. */
export function importRootsOf(config: StudioConfig, ctx: ServiceBag): string[] {
  const roots = new Set<string>()
  const workspace = workspaceDirOf(ctx)
  if (workspace !== undefined) roots.add(canonical(workspace))
  roots.add(canonical(dataDir()))
  roots.add(canonical(resolveOutputDir(config, ctx).dir))
  for (const root of config.importRoots) {
    if (root.trim() !== '') roots.add(canonical(root))
  }
  return [...roots]
}

/** True when `target` may be read into the library. */
export function assertImportable(config: StudioConfig, ctx: ServiceBag, target: string): string {
  const abs = canonical(target)
  if (!fs.existsSync(abs)) throw new Error(`文件不存在：${abs}`)
  if (!isInside(abs, dataDir()) && !importRootsOf(config, ctx).some(root => isInside(abs, root))) {
    throw new Error(`拒绝导入工作区之外的路径：${abs}。把它的上级目录加到配置 importRoots 里再试。`)
  }
  const stat = fs.statSync(abs)
  if (!stat.isFile()) throw new Error(`不是文件：${abs}`)
  return abs
}

/** Create the data-dir skeleton. */
export function ensureDataLayout(): void {
  for (const dir of ['', 'workflows', 'jobs', 'library', 'cache']) ensureDir(path.join(dataDir(), dir))
}
