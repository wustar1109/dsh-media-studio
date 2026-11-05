/** Small host-side helpers: paths, ids, mime sniffing, bounded HTTP. */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

/** Home directory (Windows / POSIX). */
export function homeDir(): string {
  return process.env.USERPROFILE ?? process.env.HOME ?? os.homedir()
}

/** `~/.dsh-media-studio` — plugin-owned state. */
export function dataDir(): string {
  return path.join(homeDir(), '.dsh-media-studio')
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

/** Absolute, normalised, realpath when it exists. */
export function canonical(target: string): string {
  const abs = path.resolve(target)
  try {
    return fs.realpathSync.native(abs)
  } catch {
    return abs
  }
}

/** Case-folded comparison, because Windows paths are case-insensitive. */
export function foldPath(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value
}

/** True when `target` is `root` or lives under it. */
export function isInside(target: string, root: string): boolean {
  const t = foldPath(canonical(target))
  const r = foldPath(canonical(root))
  return t === r || t.startsWith(r.endsWith(path.sep) ? r : r + path.sep)
}

/** Short random id with a human-readable prefix. */
export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`
}

/** Content hash used for dedupe / stable ids. */
export function shortHash(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16)
}

/** Read JSON, `undefined` on absence or parse failure. */
export function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return undefined
  }
}

/** Write JSON atomically (tmp + rename). */
export function writeJson(file: string, value: unknown): void {
  ensureDir(path.dirname(file))
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(tmp, file)
}

export async function pathExists(file: string): Promise<boolean> {
  try {
    await fsp.access(file)
    return true
  } catch {
    return false
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.json': 'application/json',
  '.txt': 'text/plain',
}

export function mimeOf(file: string): string {
  return MIME_BY_EXT[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/** Sniff the real mime from magic bytes; provider headers are not trusted. */
export function sniffImageMime(data: Buffer): string | undefined {
  if (data.length < 12) return undefined
  if (data[0] === 0x89 && data.toString('ascii', 1, 4) === 'PNG') return 'image/png'
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg'
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (data.toString('ascii', 0, 4) === 'GIF8') return 'image/gif'
  if (data.toString('ascii', 4, 8) === 'ftyp') {
    const brand = data.toString('ascii', 8, 12)
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif'
    return 'video/mp4'
  }
  if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return 'video/webm'
  return undefined
}

/** Width/height from PNG / JPEG / WebP / GIF headers, best effort. */
export function imageSize(data: Buffer): { width: number; height: number } | undefined {
  try {
    if (data[0] === 0x89 && data.toString('ascii', 1, 4) === 'PNG' && data.length > 24) {
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
    }
    if (data.toString('ascii', 0, 4) === 'GIF8' && data.length > 10) {
      return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) }
    }
    if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' && data.length > 30) {
      const chunk = data.toString('ascii', 12, 16)
      if (chunk === 'VP8X') return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) }
      if (chunk === 'VP8 ' && data.length > 30) return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff }
      if (chunk === 'VP8L' && data.length > 25) {
        const bits = data.readUInt32LE(21)
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
      }
    }
    if (data[0] === 0xff && data[1] === 0xd8) {
      let offset = 2
      while (offset + 9 < data.length) {
        if (data[offset] !== 0xff) { offset += 1; continue }
        const marker = data[offset + 1]!
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) }
        }
        offset += 2 + data.readUInt16BE(offset + 2)
      }
    }
  } catch {
    // headers malformed: dimensions are optional metadata, never a hard error
  }
  return undefined
}

/** Keep provider keys and headers out of error text and logs. */
export function redact(text: string, secret?: string): string {
  let out = text
  if (secret !== undefined && secret.length >= 6) out = out.split(secret).join('[redacted]')
  return out.replace(/(authorization|api[-_]?key|x-goog-api-key)(["'\s:=]+)([^\s"',}]{8,})/gi, '$1$2[redacted]')
}

/** One `fetch` with a deadline; the caller owns the signal. */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`request timed out after ${String(timeoutMs)}ms`)), timeoutMs)
  timer.unref?.()
  const onAbort = (): void => controller.abort(init.signal?.reason)
  if (init.signal !== undefined && init.signal !== null) {
    if (init.signal.aborted) controller.abort(init.signal.reason)
    else init.signal.addEventListener('abort', onAbort, { once: true })
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener?.('abort', onAbort)
  }
}

/** Read a body while refusing to blow past `maxBytes`. */
export async function readBounded(response: Response, maxBytes: number): Promise<Buffer> {
  if (response.body === null) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let bytes = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > maxBytes) throw new Error(`response exceeded ${String(maxBytes)} bytes`)
      chunks.push(Buffer.from(next.value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, bytes)
}

/** Error text from a failed response, bounded and redacted. */
export async function errorBody(response: Response, secret?: string): Promise<string> {
  let text = ''
  try {
    text = await response.text()
  } catch {
    text = ''
  }
  const clean = redact(text, secret).replace(/\s+/g, ' ').trim()
  return clean.length > 800 ? `${clean.slice(0, 800)}…` : clean
}

/** JSON POST/GET with one retry on 429/5xx. */
export async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  let last: Response | undefined
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    }, timeoutMs)
    if (response.status !== 429 && response.status < 500) return response
    last = response
    if (attempt === 0) await sleep(600 + Math.random() * 600)
  }
  return last!
}

/** GET with the same retry policy. */
export async function getWithRetry(url: string, headers: Record<string, string>, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  let last: Response | undefined
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithTimeout(url, { headers, ...(signal === undefined ? {} : { signal }) }, timeoutMs)
    if (response.status !== 429 && response.status < 500) return response
    last = response
    if (attempt === 0) await sleep(600 + Math.random() * 600)
  }
  return last!
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new Error('cancelled'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('cancelled'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** `${base}${path}` with exactly one slash. */
export function joinUrl(base: string, suffix: string): string {
  return `${base.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`
}

/** `data:<mime>;base64,...` */
export function dataUrl(data: Buffer, mime: string): string {
  return `data:${mime};base64,${data.toString('base64')}`
}

/** Download a provider-hosted artifact with a size ceiling. */
export async function download(url: string, maxBytes: number, signal?: AbortSignal, headers?: Record<string, string>): Promise<{ data: Buffer; mime: string }> {
  const response = await fetchWithTimeout(url, { redirect: 'follow', ...(signal === undefined ? {} : { signal }), ...(headers === undefined ? {} : { headers }) }, 180_000)
  if (!response.ok) throw new Error(`download failed: HTTP ${String(response.status)}`)
  const data = await readBounded(response, maxBytes)
  const header = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  const mime = sniffImageMime(data) ?? (header.length > 0 ? header : mimeOf(url))
  return { data, mime }
}

/** Normalise a user-supplied size: `1024x1024`, `1024*1024`, `1024X1024`. */
export function parseSize(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const match = /^(\d{2,5})\s*[x*×]\s*(\d{2,5})$/i.exec(trimmed)
  return match === null ? undefined : `${match[1]}x${match[2]}`
}

/** Map an aspect ratio to a concrete size for providers that only take pixels. */
export function sizeForAspect(aspect: string | undefined, fallback = '1024x1024'): string {
  switch (aspect) {
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
    default: return fallback
  }
}
