/** Thin fetch layer. Every non-2xx or `ok:false` becomes an Error with the host message. */
import type { AssetView, ConfigView, JobView, StatsView, WorkflowView } from './types.js'

export const BASE = '/media-studio/api'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(BASE + path, {
    ...init,
    headers: { ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init?.headers as Record<string, string> | undefined) },
  })
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const bag = payload !== null && typeof payload === 'object' ? payload as Record<string, unknown> : null
  if (!response.ok || bag?.ok === false) {
    throw new Error(typeof bag?.message === 'string' ? bag.message : `请求失败：HTTP ${String(response.status)}`)
  }
  return payload as T
}

export const api = {
  config: () => call<{ config: ConfigView; outputDir: { dir: string; source: string }; diagnostics: Record<string, unknown> }>('/config'),
  saveConfig: (patch: Record<string, unknown>) => call<{ config: ConfigView }>('/config', { method: 'POST', body: JSON.stringify(patch) }),
  /**
   * A failed probe is a normal answer (`ok: false` + a human detail), not an
   * HTTP error — do not route it through `call()`, or the panel shows
   * "请求失败：HTTP 200" instead of why the connection failed.
   */
  testChannel: async (id: string, overrides: { apiKey?: string; baseUrl?: string } = {}): Promise<{ ok: boolean; detail: string; latencyMs?: number }> => {
    const response = await fetch(`${BASE}/channels/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...overrides }),
    })
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    const bag = payload !== null && typeof payload === 'object' ? payload as Record<string, unknown> : null
    if (!response.ok) throw new Error(typeof bag?.message === 'string' ? bag.message : `请求失败：HTTP ${String(response.status)}`)
    return {
      ok: bag?.ok === true,
      detail: typeof bag?.detail === 'string' ? bag.detail : typeof bag?.message === 'string' ? bag.message : '没有返回探测结果',
      ...(typeof bag?.latencyMs === 'number' ? { latencyMs: bag.latencyMs } : {}),
    }
  },
  /** Model catalog for one channel; `ok:false` still carries the built-in list. */
  listModels: async (id: string, overrides: { apiKey?: string; baseUrl?: string } = {}): Promise<{ ok: boolean; models: string[]; image: string[]; video: string[]; detail: string; source: 'remote' | 'catalog' }> => {
    const response = await fetch(`${BASE}/channels/models`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...overrides }),
    })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : `请求失败：HTTP ${String(response.status)}`)
    const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    return {
      ok: payload?.ok === true,
      models: strings(payload?.models),
      image: strings(payload?.image),
      video: strings(payload?.video),
      detail: typeof payload?.detail === 'string' ? payload.detail : '',
      source: payload?.source === 'remote' ? 'remote' : 'catalog',
    }
  },

  jobs: (query = '') => call<{ jobs: JobView[] }>(`/jobs${query}`),
  job: (id: string) => call<{ job: JobView }>(`/jobs/${encodeURIComponent(id)}`),
  cancelJob: (id: string) => call<{ ok: boolean; state?: string }>(`/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}' }),
  collectJob: (id: string) => call<{ ok: boolean; job: JobView }>(`/jobs/${encodeURIComponent(id)}/collect`, { method: 'POST', body: '{}' }),

  generateImage: (body: Record<string, unknown>) => call<{ job: JobView }>('/generate/image', { method: 'POST', body: JSON.stringify(body) }),
  generateVideo: (body: Record<string, unknown>) => call<{ job: JobView }>('/generate/video', { method: 'POST', body: JSON.stringify(body) }),
  canvasEdit: (body: Record<string, unknown>) => call<{ job: JobView }>('/canvas/edit', { method: 'POST', body: JSON.stringify(body) }),
  canvasState: () => call<{ state: Record<string, unknown>; revision: number }>('/canvas/state'),
  setCanvasState: (patch: Record<string, unknown>) => call<{ state: Record<string, unknown>; revision: number }>('/canvas/state', { method: 'PUT', body: JSON.stringify(patch) }),
  storyboard: (body: Record<string, unknown>) => call<{ job: JobView }>('/storyboard', { method: 'POST', body: JSON.stringify(body) }),
  concat: (body: Record<string, unknown>) => call<{ job: JobView }>('/concat', { method: 'POST', body: JSON.stringify(body) }),

  workflows: () => call<{ workflows: WorkflowView[]; broken: string[]; online: boolean; detail?: string }>('/comfy/workflows'),
  runWorkflow: (body: Record<string, unknown>) => call<{ job: JobView }>('/comfy/run', { method: 'POST', body: JSON.stringify(body) }),
  comfyStatus: () => call<{ status: { online: boolean; detail?: string; system?: Record<string, unknown> } }>('/comfy/status'),
  importWorkflow: (body: Record<string, unknown>) => call<{ workflow: WorkflowView }>('/comfy/import', { method: 'POST', body: JSON.stringify(body) }),
  updateWorkflow: (id: string, body: Record<string, unknown>) => call<{ workflow: WorkflowView }>(`/comfy/workflows/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(body) }),
  deleteWorkflow: (id: string) => call<{ ok: boolean }>(`/comfy/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  library: (query: Record<string, string> = {}) => call<{ total: number; items: AssetView[] }>(`/library?${new URLSearchParams(query).toString()}`),
  scan: () => call<{ added: number }>('/library/scan', { method: 'POST', body: '{}' }),
  importPath: (path: string) => call<{ asset: AssetView }>('/library/import', { method: 'POST', body: JSON.stringify({ path }) }),
  importDataUrl: (dataUrl: string, name?: string) => call<{ asset: AssetView }>('/library/import', { method: 'POST', body: JSON.stringify({ dataUrl, ...(name === undefined ? {} : { name }) }) }),
  favorite: (id: string, favorite: boolean) => call<{ asset: AssetView }>(`/library/${encodeURIComponent(id)}/favorite`, { method: 'POST', body: JSON.stringify({ favorite }) }),
  remove: (id: string) => call<{ ok: boolean }>(`/library/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  stats: () => call<StatsView & Record<string, unknown>>('/stats'),
}
