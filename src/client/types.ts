/** Shapes returned by the host API. Kept hand-written and small on purpose. */

export type ChannelKind = 'openai' | 'openai-compat' | 'google' | 'dashscope' | 'ark' | 'xai' | 'comfyui'

export interface ChannelView {
  id: string
  label: string
  kind: ChannelKind
  enabled?: boolean
  baseUrl?: string
  apiKeyEnv?: string
  imageModel?: string
  videoModel?: string
  models?: { image?: string[]; video?: string[] }
  headers?: Record<string, string>
  ready: boolean
  capabilities: string[]
  keyHint: string
  keySource: 'inline' | 'env' | 'none'
}

export interface ConfigView {
  channels: ChannelView[]
  defaults: { image?: string; video?: string; comfyWorkflow?: string }
  outputDir?: string | null
  libraryRoots: string[]
  importRoots: string[]
  maxImageBytes: number
  maxVideoBytes: number
  videoTimeoutMs: number
  comfyTimeoutMs: number
  ffmpegPath?: string | null
  locale?: 'auto' | 'zh' | 'en'
}

export type MediaKind = 'image' | 'video' | 'audio' | 'file'

export interface AssetView {
  id: string
  kind: MediaKind
  name: string
  path: string
  url: string
  bytes: number
  width?: number
  height?: number
  duration?: number
  prompt?: string
  channel?: string
  model?: string
  favorite: boolean
  tags: string[]
  origin?: string
  createdAt: string
}

export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface ShotView {
  index: number
  prompt: string
  state: JobState
  assetId?: string
  error?: string
}

export interface JobView {
  jobId: string
  kind: 'image' | 'video' | 'comfy' | 'storyboard' | 'concat'
  state: JobState
  prompt?: string
  channel?: string
  model?: string
  promptId?: string
  canCollect?: boolean
  progress?: string
  error?: string
  createdAt: string
  finishedAt?: string
  assets: AssetView[]
  shots?: ShotView[]
  hint?: string
}

export interface WorkflowSlot {
  name: string
  type: 'string' | 'number' | 'boolean' | 'enum' | 'image'
  nodeId: string
  input: string
  required: boolean
  value?: string | number | boolean
  label?: string
}

export interface WorkflowView {
  workflowId: string
  title: string
  description: string
  enabled: boolean
  slots: WorkflowSlot[]
  outputs: Array<{ nodeId: string; kind: string; label: string }>
  nodeCount: number
}

export interface StatsView {
  total: number
  images: number
  videos: number
  bytes: number
  favorites: number
  activeJobs: number
  outputDir: string
  ffmpeg?: { found: boolean; path: string | null; error: string | null }
  configFile: string
}
