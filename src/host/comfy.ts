/**
 * ComfyUI: a small client, workflow storage, IO-surface inference and a runner.
 *
 * The inference rules are the interesting part. A workflow is just a graph, but
 * what a caller needs is "which values are knobs": prompt, negative, size, seed,
 * steps, cfg, image slots. Everything else (model names, vae, lora, batch) is
 * left alone, because changing it is how you break a working template.
 */
import fs from 'node:fs'
import path from 'node:path'

import type { Logger } from './types.js'
import { dataDir, ensureDir, errorBody, fetchWithTimeout, joinUrl, readJson, writeJson } from './util.js'

export type ApiNode = { class_type?: string; inputs?: Record<string, unknown>; _meta?: { title?: string } }
export type ApiWorkflow = Record<string, ApiNode>

export interface WorkflowMeta {
  title?: string
  description?: string
  enabled?: boolean
  updatedAt?: number
}

export interface WorkflowSlot {
  name: string
  type: 'string' | 'number' | 'boolean' | 'enum' | 'image'
  nodeId: string
  input: string
  required: boolean
  value?: string | number | boolean
  enumValues?: string[]
  label?: string
}

export interface WorkflowSurface {
  workflowId: string
  title: string
  description: string
  enabled: boolean
  slots: WorkflowSlot[]
  outputs: Array<{ nodeId: string; kind: 'image' | 'video' | 'file'; label: string }>
  nodeCount: number
}

export function workflowsDir(): string {
  return path.join(dataDir(), 'workflows')
}

function metaPath(id: string): string {
  return path.join(workflowsDir(), `${id}.meta.json`)
}

function workflowPath(id: string): string {
  return path.join(workflowsDir(), `${id}.json`)
}

/** Filename-safe id; keeps CJK so users can name templates in Chinese. */
export function safeWorkflowId(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|#]/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'workflow'
}

export function listWorkflows(): { entries: Array<{ id: string; workflow: ApiWorkflow; meta: WorkflowMeta }>; broken: string[] } {
  const dir = workflowsDir()
  ensureDir(dir)
  const entries: Array<{ id: string; workflow: ApiWorkflow; meta: WorkflowMeta }> = []
  const broken: string[] = []
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json') || file.endsWith('.meta.json')) continue
    const id = file.slice(0, -5)
    const workflow = readJson<ApiWorkflow>(path.join(dir, file))
    if (workflow === undefined || typeof workflow !== 'object' || Object.keys(workflow).length === 0) {
      broken.push(id)
      continue
    }
    entries.push({ id, workflow, meta: readJson<WorkflowMeta>(metaPath(id)) ?? {} })
  }
  return { entries, broken }
}

export function getWorkflow(id: string): { id: string; workflow: ApiWorkflow; meta: WorkflowMeta } | undefined {
  const workflow = readJson<ApiWorkflow>(workflowPath(id))
  if (workflow === undefined) return undefined
  return { id, workflow, meta: readJson<WorkflowMeta>(metaPath(id)) ?? {} }
}

export function saveWorkflow(id: string, workflow: ApiWorkflow, meta: WorkflowMeta): string {
  ensureDir(workflowsDir())
  const clean = safeWorkflowId(id)
  writeJson(workflowPath(clean), workflow)
  writeJson(metaPath(clean), { ...meta, updatedAt: Date.now() })
  return clean
}

export function deleteWorkflow(id: string): boolean {
  try {
    fs.rmSync(workflowPath(id))
    fs.rmSync(metaPath(id), { force: true })
    return true
  } catch {
    return false
  }
}

/** Reject UI-format exports early with a message that says how to fix it. */
export function assertApiWorkflow(value: unknown): ApiWorkflow {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('工作流必须是 API 格式 JSON 对象')
  const bag = value as Record<string, unknown>
  if (Array.isArray(bag.nodes)) throw new Error('这是 UI 格式工作流。请在 ComfyUI 里用 “Save (API Format)” 导出，或开启 “Dev mode” 后重新导出。')
  const nodes: ApiWorkflow = {}
  for (const [id, raw] of Object.entries(bag)) {
    if (raw === null || typeof raw !== 'object') continue
    const node = raw as Record<string, unknown>
    if (typeof node.class_type !== 'string') continue
    nodes[id] = raw as ApiNode
  }
  if (Object.keys(nodes).length === 0) throw new Error('工作流里没有任何 class_type 节点，不是 API 格式')
  return nodes
}

const INTERNAL_INPUT = [/^model$/i, /^vae$/i, /^clip$/i, /^lora/i, /^batch_size$/i, /^filename_prefix$/i, /^noise_seed$/i, /^control_after_generate$/i, /^upload$/i]

function isLink(value: unknown): boolean {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'number'
}

function textOf(workflow: ApiWorkflow, start: unknown): { nodeId: string; key: string } | undefined {
  if (!isLink(start)) return undefined
  const nodeId = String((start as [string, number])[0])
  const node = workflow[nodeId]
  if (node === undefined) return undefined
  const inputs = node.inputs ?? {}
  if (typeof inputs.text === 'string') return { nodeId, key: 'text' }
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'string' && !isLink(value)) return { nodeId, key }
    if (isLink(value)) {
      const nested = textOf(workflow, value)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}

function placeholderNames(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const names: string[] = []
  for (const match of value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) names.push(match[1]!)
  return names
}

/**
 * Infer the caller-facing surface of one workflow.
 *
 * Prompt/negative are named from the sampler's graph trace rather than from the
 * input key (`text`), because a workflow can have several CLIPTextEncode nodes
 * and the caller needs to know which one is the positive prompt.
 */
export function inferSurface(id: string, workflow: ApiWorkflow, meta: WorkflowMeta): WorkflowSurface {
  const entries = Object.entries(workflow)
  const sampler = entries.find(([, node]) => /sampler/i.test(node.class_type ?? '') && node.inputs?.positive !== undefined && node.inputs?.negative !== undefined)
  const positive = sampler === undefined ? undefined : textOf(workflow, sampler[1].inputs!.positive)
  const negative = sampler === undefined ? undefined : textOf(workflow, sampler[1].inputs!.negative)

  const promptSources = new Map<string, 'prompt' | 'negative_prompt'>()
  const markSource = (target: unknown, kind: 'prompt' | 'negative_prompt'): void => {
    const text = textOf(workflow, target)
    if (text !== undefined) {
      const key = `${text.nodeId}.${text.key}`
      if (!promptSources.has(key)) promptSources.set(key, kind)
    }
  }
  if (positive !== undefined) promptSources.set(`${positive.nodeId}.${positive.key}`, 'prompt')
  if (negative !== undefined) promptSources.set(`${negative.nodeId}.${negative.key}`, 'negative_prompt')

  // Many video workflows do not have a KSampler with positive/negative links
  // (MiniMax H3, WAN, custom guiders). Find the prompt by looking at the input
  // that consumes it (`prompt`, `text`, `positive`) and at primitives whose
  // title says "Prompt"/"Text".
  for (const [nodeId, node] of entries) {
    const inputs = node.inputs ?? {}
    const title = node._meta?.title ?? ''
    for (const [key, value] of Object.entries(inputs)) {
      const isNegative = /^negative/i.test(key)
      const isPositive = /^(prompt|text|positive|positive_prompt)$/i.test(key)
      if (!isNegative && !isPositive) continue
      if (isLink(value)) {
        markSource(value, isNegative ? 'negative_prompt' : 'prompt')
      } else if (isPositive && typeof value === 'string' && value !== '' && /condition|guider|encode/i.test(node.class_type ?? '')) {
        if (!promptSources.has(`${nodeId}.${key}`)) promptSources.set(`${nodeId}.${key}`, 'prompt')
      }
    }
    if (/prompt|text/i.test(title)) {
      const textKey = ['value', 'text', 'string'].find(candidate => typeof inputs[candidate] === 'string')
      if (textKey !== undefined && !promptSources.has(`${nodeId}.${textKey}`)) {
        promptSources.set(`${nodeId}.${textKey}`, /negative/i.test(title) ? 'negative_prompt' : 'prompt')
      }
    }
  }

  const slots: WorkflowSlot[] = []
  const taken = new Map<string, WorkflowSlot>()
  const add = (slot: WorkflowSlot): void => {
    const existing = taken.get(slot.name)
    if (existing !== undefined) {
      if (existing.type === slot.type && existing.value === slot.value) return
      let suffix = 2
      let candidate = `${slot.name}_${String(suffix)}`
      while (taken.has(candidate)) {
        suffix += 1
        candidate = `${slot.name}_${String(suffix)}`
      }
      slot.name = candidate
    }
    taken.set(slot.name, slot)
    slots.push(slot)
  }
  let imageCount = 0

  for (const [nodeId, node] of entries) {
    const inputs = node.inputs ?? {}
    const className = node.class_type ?? ''
    for (const [key, value] of Object.entries(inputs)) {      if (isLink(value)) continue
      if (INTERNAL_INPUT.some(pattern => pattern.test(key))) continue

      // Explicit placeholders win over heuristics: the author said "this is a knob".
      const placeholders = placeholderNames(value)
      for (const name of placeholders) {
        add({ name, type: 'string', nodeId, input: key, required: true, value: typeof value === 'string' ? value : undefined, label: key })
      }
      if (placeholders.length > 0) continue

      const isImage = /loadimage|loadimages|imageinput/i.test(className) && /image/i.test(key)
      if (isImage) {
        // A LoadImage with a filename baked into the template is optional: the
        // user may run it as-is, replace it, or build a text-only variant by
        // clearing the slot in ComfyUI first. Only an empty slot is mandatory.
        const required = (typeof value === 'string' ? value.trim() : '') === ''
        imageCount += 1
        add({ name: 'image', type: 'image', nodeId, input: key, required, value: typeof value === 'string' ? value : '', label: `参考图 ${String(imageCount)}` })
        continue
      }

      let name: string | undefined = promptSources.get(`${nodeId}.${key}`)
      if (name === undefined && typeof value === 'number' && /duration|seconds|length/i.test(node._meta?.title ?? '') && /^(value|duration|seconds|length)$/i.test(key)) {
        name = 'duration'
      }
      if (name === undefined) {
        if (key === 'seed' || key === 'noise_seed') name = 'seed'
        else if (key === 'width') name = 'width'
        else if (key === 'height') name = 'height'
        else if (key === 'steps') name = 'steps'
        else if (key === 'cfg') name = 'cfg'
        else if (key === 'denoise') name = 'denoise'
        else if (key === 'text') name = 'text'
      }
      if (name === undefined) continue

      const type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string'
      const label = name === 'prompt' ? '提示词' : name === 'negative_prompt' ? '负面提示词' : name === 'duration' ? '时长（秒）' : (node._meta?.title ?? key)
      add({ name, type, nodeId, input: key, required: false, value: value as string | number | boolean, label })
    }
  }

  // Sort so prompt comes first: that is what the panel and the model fill in.
  const order = ['prompt', 'negative_prompt', 'image', 'duration', 'width', 'height', 'seed', 'steps', 'cfg', 'denoise']
  const rank = (name: string): number => {
    for (const [index, prefix] of order.entries()) {
      if (name === prefix || name.startsWith(`${prefix}_`)) return index
    }
    return 99
  }
  slots.sort((a, b) => rank(a.name) - rank(b.name))

  const outputs: WorkflowSurface['outputs'] = []
  const referenced = new Set<string>()
  for (const [, node] of entries) {
    for (const value of Object.values(node.inputs ?? {})) if (isLink(value)) referenced.add((value as [string, number])[0])
  }
  for (const [nodeId, node] of entries) {
    if (referenced.has(nodeId)) continue
    const className = node.class_type ?? ''
    if (!/save|preview|combine|output|video/i.test(className)) continue
    outputs.push({
      nodeId,
      kind: /video|gif|animated|h264|mp4/i.test(className) ? 'video' : 'image',
      label: node._meta?.title ?? className,
    })
  }

  return {
    workflowId: id,
    title: meta.title ?? id,
    description: meta.description ?? '',
    enabled: meta.enabled !== false,
    slots,
    outputs,
    nodeCount: entries.length,
  }
}

/** Apply explicit `vars` and `{{placeholders}}` to a cloned workflow. */
export function applyVars(workflow: ApiWorkflow, surface: WorkflowSurface, vars: Record<string, unknown>): { workflow: ApiWorkflow; applied: string[]; unknown: string[] } {
  const clone = JSON.parse(JSON.stringify(workflow)) as ApiWorkflow
  const known = new Set(surface.slots.map(slot => slot.name))
  const unknown = Object.keys(vars).filter(key => !known.has(key))
  const byName = new Map(surface.slots.map(slot => [slot.name, slot]))
  const applied: string[] = []

  for (const [name, raw] of Object.entries(vars)) {
    const slot = byName.get(name)
    if (slot === undefined) continue
    const node = clone[slot.nodeId]
    if (node === undefined) continue
    node.inputs = node.inputs ?? {}
    node.inputs[slot.input] = coerce(slot, raw)
    applied.push(name)
  }

  for (const [, node] of Object.entries(clone)) {
    for (const [key, value] of Object.entries(node.inputs ?? {})) {
      if (typeof value !== 'string') continue
      node.inputs![key] = value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, name: string) => {
        const raw = vars[name]
        return raw === undefined || raw === null ? whole : String(raw)
      })
    }
  }

  // Required slots without a value must fail before the submission, with the
  // names the caller can actually pass. Image slots are validated by the
  // runner after upload (they are filled from files, not from `vars`).
  const missing = surface.slots
    .filter(slot => slot.required && slot.type !== 'image' && (vars[slot.name] === undefined || vars[slot.name] === ''))
    .map(slot => slot.name)
  if (missing.length > 0) throw new Error(`工作流缺少必填变量：${missing.join('、')}。可用变量：${surface.slots.map(slot => slot.name).join('、')}`)
  return { workflow: clone, applied, unknown }
}

function coerce(slot: WorkflowSlot, raw: unknown): unknown {
  if (slot.type === 'number') {
    const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
    if (!Number.isFinite(n)) throw new Error(`变量 ${slot.name} 需要数字，收到 ${JSON.stringify(raw)}`)
    return n
  }
  if (slot.type === 'boolean') return raw === true || raw === 'true' || raw === '1'
  return String(raw)
}

/** ComfyUI HTTP client. */
export class ComfyClient {
  constructor(
    readonly baseUrl: string,
    private readonly headers: Record<string, string> = {},
    private readonly logger?: Logger,
  ) {}

  private async request(pathname: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
    const url = pathname.startsWith('http') ? pathname : joinUrl(this.baseUrl, pathname)
    try {
      return await fetchWithTimeout(url, { ...init, headers: { ...this.headers, ...(init.headers as Record<string, string> | undefined) } }, timeoutMs)
    } catch (error) {
      this.logger?.warn(`[media-studio] ComfyUI 请求失败 ${url}: ${String(error)}`)
      throw new Error(`连不上 ComfyUI（${this.baseUrl}）：确认服务在运行，或到面板「通道」里改地址。`)
    }
  }

  async systemStats(): Promise<{ ok: boolean; system?: Record<string, unknown>; error?: string }> {
    try {
      const response = await this.request('system_stats', { method: 'GET' }, 8_000)
      if (!response.ok) return { ok: false, error: `HTTP ${String(response.status)}` }
      const system = await response.json() as Record<string, unknown>
      return { ok: true, system }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async objectInfo(): Promise<Record<string, unknown>> {
    const response = await this.request('object_info', { method: 'GET' }, 60_000)
    if (!response.ok) throw new Error(`拉取 /object_info 失败：HTTP ${String(response.status)}`)
    return await response.json() as Record<string, unknown>
  }

  async queuePrompt(workflow: ApiWorkflow): Promise<{ promptId: string; warnings: string[] }> {
    const response = await this.request('prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: `media-studio-${String(process.pid)}` }),
    }, 60_000)
    if (response.status === 400) {
      const body = await response.text()
      throw new Error(`ComfyUI 拒绝了这份工作流：${body.slice(0, 600)}`)
    }
    if (!response.ok) throw new Error(`提交工作流失败：HTTP ${String(response.status)} ${await errorBody(response)}`)
    const payload = await response.json() as { prompt_id?: unknown; node_errors?: unknown }
    const promptId = typeof payload.prompt_id === 'string' ? payload.prompt_id : ''
    if (promptId === '') throw new Error('ComfyUI 没有返回 prompt_id')
    const warnings = payload.node_errors !== undefined && payload.node_errors !== null && Object.keys(payload.node_errors as object).length > 0
      ? [`ComfyUI 报告节点警告：${JSON.stringify(payload.node_errors).slice(0, 400)}`]
      : []
    return { promptId, warnings }
  }

  async history(promptId: string): Promise<Record<string, unknown> | undefined> {
    const response = await this.request(`history/${encodeURIComponent(promptId)}`, { method: 'GET' }, 30_000)
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`查询 /history 失败：HTTP ${String(response.status)}`)
    const payload = await response.json() as Record<string, unknown>
    const entry = payload[promptId]
    return entry !== null && typeof entry === 'object' ? entry as Record<string, unknown> : undefined
  }

  async view(ref: { filename: string; subfolder?: string; type?: string }): Promise<Buffer> {
    const query = new URLSearchParams({ filename: ref.filename, subfolder: ref.subfolder ?? '', type: ref.type ?? 'output' })
    const response = await this.request(`view?${query.toString()}`, { method: 'GET' }, 180_000)
    if (!response.ok) throw new Error(`取产物失败：HTTP ${String(response.status)}（${ref.filename}）`)
    return Buffer.from(await response.arrayBuffer())
  }

  async uploadImage(data: Buffer, filename: string): Promise<string> {
    const form = new FormData()
    form.append('image', new Blob([new Uint8Array(data)], { type: 'image/png' }), filename)
    form.append('overwrite', 'true')
    const response = await this.request('upload/image', { method: 'POST', body: form }, 120_000)
    if (!response.ok) throw new Error(`上传参考图失败：HTTP ${String(response.status)}`)
    const payload = await response.json() as { name?: unknown; subfolder?: unknown }
    const name = typeof payload.name === 'string' ? payload.name : ''
    if (name === '') throw new Error('ComfyUI 没有返回上传后的文件名')
    return typeof payload.subfolder === 'string' && payload.subfolder !== '' ? `${payload.subfolder}/${name}` : name
  }
}

/** File refs inside one history entry. */
export function historyFiles(entry: Record<string, unknown>): Array<{ filename: string; subfolder: string; type: string; kind: 'image' | 'video' }> {
  const outputs = entry.outputs
  const files: Array<{ filename: string; subfolder: string; type: string; kind: 'image' | 'video' }> = []
  if (outputs === null || typeof outputs !== 'object') return files
  for (const nodeOutput of Object.values(outputs as Record<string, unknown>)) {
    if (nodeOutput === null || typeof nodeOutput !== 'object') continue
    for (const [key, value] of Object.entries(nodeOutput as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue
      const kind: 'image' | 'video' = /gif|video/i.test(key) ? 'video' : 'image'
      for (const item of value) {
        if (item === null || typeof item !== 'object') continue
        const file = item as { filename?: unknown; subfolder?: unknown; type?: unknown }
        if (typeof file.filename !== 'string' || file.filename === '') continue
        files.push({
          filename: file.filename,
          subfolder: typeof file.subfolder === 'string' ? file.subfolder : '',
          type: typeof file.type === 'string' ? file.type : 'output',
          kind: /\.(mp4|webm|mov|mkv)$/i.test(file.filename) ? 'video' : kind,
        })
      }
    }
  }
  return files
}

/** Terminal state of one history entry. */
export function historyState(entry: Record<string, unknown>): { state: 'running' | 'succeeded' | 'failed'; message?: string } {
  const status = entry.status
  if (status !== null && typeof status === 'object') {
    const bag = status as { status_str?: unknown; completed?: unknown; messages?: unknown }
    if (bag.status_str === 'error') {
      const messages = Array.isArray(bag.messages) ? bag.messages : []
      const text = messages.map(item => JSON.stringify(item)).join(' ').slice(0, 500)
      return { state: 'failed', message: text === '' ? 'ComfyUI 执行报错' : text }
    }
    if (bag.completed === true) return { state: 'succeeded' }
    return { state: 'running' }
  }
  return { state: 'running' }
}
