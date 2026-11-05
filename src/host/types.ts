/** Shared shapes for the host half of dsh-media-studio. */

/** Protocol family of a channel. Each maps to one adapter implementation. */
export type ChannelKind = 'openai' | 'openai-compat' | 'google' | 'dashscope' | 'ark' | 'xai' | 'comfyui'

/** What a channel can produce. */
export type Capability = 'image' | 'video' | 'workflow'

/** One configured upstream. */
export interface ChannelConfig {
  id: string
  label: string
  kind: ChannelKind
  /** Explicit off-switch. Absent means "on when it has a key". */
  enabled?: boolean
  /** API base URL, no trailing slash. */
  baseUrl?: string
  /** Inline key. Prefer `apiKeyEnv` or the panel's write-only field. */
  apiKey?: string
  /** Environment variable that holds the key. */
  apiKeyEnv?: string
  /** Default image model. */
  imageModel?: string
  /** Default video model. */
  videoModel?: string
  /** Models offered by the panel; free text is still allowed. */
  models?: { image?: string[]; video?: string[] }
  /** Extra headers (gateway auth, org id, ...). */
  headers?: Record<string, string>
  /** Adapter specific switches, e.g. `{ nativeGoogle: true }`. */
  options?: Record<string, unknown>
  /** Optional extra request-body fields merged into OpenAI-compatible calls. */
  extraBody?: Record<string, unknown>
  /** Per-channel timeout override for one generation, ms. */
  timeoutMs?: number
}

/** Panel / library roots and runtime knobs. */
export interface StudioConfig {
  channels: ChannelConfig[]
  defaults: { image?: string; video?: string; comfyWorkflow?: string }
  /** Where generated media is written. Empty means `<workspace>/media-studio`. */
  outputDir?: string | null
  /** Extra directories listed in the library. */
  libraryRoots: string[]
  /** Image request ceiling. */
  maxImageBytes: number
  /** Video download ceiling. */
  maxVideoBytes: number
  /** Poll deadline for one async video task, ms. */
  videoTimeoutMs: number
  /** Poll deadline for one ComfyUI run, ms. */
  comfyTimeoutMs: number
  /** ffmpeg binary; empty means auto-detect. */
  ffmpegPath?: string | null
  /** Extra dirs allowed to import from (workspace is always allowed). */
  importRoots: string[]
  /** Panel language: auto | zh | en. */
  locale?: 'auto' | 'zh' | 'en'
}

export type MediaKind = 'image' | 'video' | 'audio' | 'file'

/** One indexed file. */
export interface AssetRecord {
  id: string
  path: string
  name: string
  kind: MediaKind
  mime: string
  bytes: number
  createdAt: number
  width?: number
  height?: number
  duration?: number
  prompt?: string
  negativePrompt?: string
  channelId?: string
  provider?: string
  model?: string
  seed?: number
  jobId?: string
  favorite?: boolean
  tags?: string[]
  origin?: 'generated' | 'imported' | 'comfy'
  refs?: string[]
  extra?: Record<string, unknown>
}

/** Async job, shared by images, videos, ComfyUI runs, storyboards and concat. */
export type JobKind = 'image' | 'video' | 'comfy' | 'storyboard' | 'concat'

export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface JobRecord {
  id: string
  kind: JobKind
  state: JobState
  createdAt: number
  startedAt?: number
  finishedAt?: number
  prompt?: string
  channelId?: string
  provider?: string
  model?: string
  params?: Record<string, unknown>
  progress?: { stage: string; value?: number; max?: number }
  assets?: AssetRecord[]
  error?: string
  parentId?: string
  shots?: Array<{ index: number; prompt: string; state: JobState; assetId?: string; error?: string }>
}

/** Generation arguments after normalisation. */
export interface ImageRequest {
  channel: ChannelConfig
  apiKey: string
  prompt: string
  negative?: string
  size?: string
  aspectRatio?: string
  quality?: string
  n: number
  refs: Array<{ data: Buffer; mime: string }>
  signal: AbortSignal
  maxBytes: number
}

export interface GeneratedImage {
  data: Buffer
  mime: string
  revisedPrompt?: string
}

export interface VideoRequest {
  channel: ChannelConfig
  apiKey: string
  prompt: string
  negative?: string
  mode: 'text' | 'image' | 'keyframe' | 'reference'
  refs: Array<{ data: Buffer; mime: string }>
  seconds: number
  resolution: string
  aspectRatio: string
  seed?: number
  signal: AbortSignal
  maxBytes: number
  onProgress?: (stage: string) => void
}

export interface GeneratedVideo {
  data: Buffer
  mime: string
  sourceUrl?: string
  poster?: Buffer
  duration?: number
}

/** Tool-spec shape accepted by `ctx.tools.register`. */
export interface ToolText {
  type: 'text'
  text: string
}

export interface ToolOutput {
  schema: Record<string, unknown>
  render: (args: unknown, value: unknown) => Array<Record<string, unknown>>
}

export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: ToolOutput
  execute: (args: Record<string, unknown>, exec?: { agent?: unknown }) => Promise<unknown>
}

/** Minimal host surface used by this plugin (no @deepseek-ai imports on purpose). */
export interface HostContext {
  root?: unknown
  get?: (name: string) => unknown
  effect?: (run: () => void | (() => void), label?: string) => void
  logger?: unknown
  inject?: (names: string[], run: (scope: HostContext) => void) => void
}

export interface Logger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}
