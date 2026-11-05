/** Helpers shared by the cloud adapters. */
import type { GeneratedImage, GeneratedVideo, VideoRequest } from '../types.js'
import { dataUrl, download, errorBody, sniffImageMime } from '../util.js'

/** Headers for a bearer-token API. */
export function bearer(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return { authorization: `Bearer ${apiKey}`, ...extra }
}

/** Pull `{ data: [{ b64_json | url }] }` (OpenAI, Ark, xAI all use this shape). */
export function imagesFromPayload(payload: unknown): Array<{ b64?: string; url?: string; revised?: string; mime?: string }> {
  const bag = payload as { data?: unknown; images?: unknown; output?: unknown } | null
  const list = Array.isArray(bag?.data) ? bag.data : Array.isArray(bag?.images) ? bag.images : Array.isArray(bag?.output) ? bag.output : []
  const out: Array<{ b64?: string; url?: string; revised?: string; mime?: string }> = []
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const b64 = typeof record.b64_json === 'string' && record.b64_json.length > 0 ? record.b64_json : undefined
    const url = typeof record.url === 'string' && record.url.length > 0 ? record.url : undefined
    const mime = typeof record.mime_type === 'string' ? record.mime_type : undefined
    if (b64 === undefined && url === undefined) continue
    out.push({
      ...(b64 === undefined ? {} : { b64 }),
      ...(url === undefined ? {} : { url }),
      ...(typeof record.revised_prompt === 'string' ? { revised: record.revised_prompt } : {}),
      ...(mime === undefined ? {} : { mime }),
    })
  }
  return out
}

/** Turn the raw payload into image buffers, downloading URLs when needed. */
export async function decodeImages(
  payload: unknown,
  maxBytes: number,
  signal?: AbortSignal,
  secret?: string,
): Promise<GeneratedImage[]> {
  const entries = imagesFromPayload(payload)
  if (entries.length === 0) throw new Error('the provider returned no image')
  const images: GeneratedImage[] = []
  for (const entry of entries) {
    if (entry.b64 !== undefined) {
      const data = Buffer.from(entry.b64.replace(/\s+/g, ''), 'base64')
      if (data.length === 0) throw new Error('the provider returned empty base64 image data')
      if (data.length > maxBytes) throw new Error(`image exceeded ${String(maxBytes)} bytes`)
      images.push({
        data,
        mime: sniffImageMime(data) ?? entry.mime ?? 'image/png',
        ...(entry.revised === undefined ? {} : { revisedPrompt: entry.revised }),
      })
      continue
    }
    if (entry.url !== undefined) {
      if (entry.url.startsWith('data:')) {
        const match = /^data:([^;]+);base64,(.*)$/s.exec(entry.url)
        if (match === null) throw new Error('the provider returned a malformed data URL')
        const data = Buffer.from(match[2]!.replace(/\s+/g, ''), 'base64')
        images.push({ data, mime: sniffImageMime(data) ?? match[1]!, ...(entry.revised === undefined ? {} : { revisedPrompt: entry.revised }) })
        continue
      }
      const downloaded = await download(entry.url, maxBytes, signal)
      images.push({ data: downloaded.data, mime: downloaded.mime, ...(entry.revised === undefined ? {} : { revisedPrompt: entry.revised }) })
    }
  }
  return images
}

/** Size mapping used by providers that take pixels. */
export function pixelsOf(size: string | undefined, aspectRatio: string | undefined): string {
  if (size !== undefined && size !== '') return size.replace('*', 'x')
  return aspectToPixels(aspectRatio)
}

export function aspectToPixels(aspectRatio: string | undefined): string {
  switch (aspectRatio) {
    case '1:1': return '1024x1024'
    case '3:2': return '1536x1024'
    case '2:3': return '1024x1536'
    case '4:3': return '1280x960'
    case '3:4': return '960x1280'
    case '4:5': return '1024x1280'
    case '5:4': return '1280x1024'
    case '16:9': return '1536x864'
    case '9:16': return '864x1536'
    case '21:9': return '1680x720'
    default: return '1024x1024'
  }
}

/** Poll `read` until it reports a terminal state. */
export async function pollUntil<T>(
  read: () => Promise<{ done: true; value: T } | { done: false; note?: string }>,
  options: { deadlineMs: number; intervalMs: number; signal: AbortSignal; onProgress?: (stage: string) => void; label: string },
): Promise<T> {
  const started = Date.now()
  let attempt = 0
  for (;;) {
    if (options.signal.aborted) throw new Error('cancelled')
    const result = await read()
    if (result.done) return result.value
    if (result.note !== undefined) options.onProgress?.(result.note)
    else options.onProgress?.(`${options.label}：等待上游完成（第 ${String(attempt + 1)} 次查询）`)
    if (Date.now() - started > options.deadlineMs) throw new Error(`${options.label} timed out after ${String(Math.round(options.deadlineMs / 1000))}s`)
    const wait = attempt === 0 ? 1500 : attempt === 1 ? 3000 : options.intervalMs
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, wait)
      const onAbort = (): void => { clearTimeout(timer); reject(new Error('cancelled')) }
      if (options.signal.aborted) { clearTimeout(timer); reject(new Error('cancelled')); return }
      options.signal.addEventListener('abort', onAbort, { once: true })
    })
    attempt += 1
  }
}

/** Read a JSON error body into a readable message. */
export async function failure(response: Response, label: string, secret?: string): Promise<Error> {
  return new Error(`${label} failed (HTTP ${String(response.status)}): ${await errorBody(response, secret) || response.statusText}`)
}

/** Reference as data URL for providers that accept inline images. */
export function refDataUrl(ref: { data: Buffer; mime: string }): string {
  return dataUrl(ref.data, ref.mime)
}

/** First reference or throw. */
export function requireRef(request: VideoRequest, what: string): { data: Buffer; mime: string } {
  const ref = request.refs[0]
  if (ref === undefined) throw new Error(`${what} requires a reference image`)
  return ref
}

/** Pad a number of seconds into a provider's allowed set. */
export function clampSeconds(value: number, min: number, max: number): number {
  const rounded = Math.round(value)
  return Math.min(max, Math.max(min, rounded))
}

/** Completed video result. */
export function videoResult(data: Buffer, mime: string, sourceUrl?: string, poster?: Buffer): GeneratedVideo {
  return { data, mime, ...(sourceUrl === undefined ? {} : { sourceUrl }), ...(poster === undefined ? {} : { poster }) }
}
