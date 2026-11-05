/**
 * Asset library: every generated or imported file becomes an {@link AssetRecord}
 * with a sidecar `.meta.json` next to it plus a rebuildable central index.
 *
 * The sidecar keeps metadata portable with the file (copy the folder elsewhere
 * and it still explains itself); the index makes search cheap and survives the
 * file being moved out of the library.
 */
import fs from 'node:fs'
import path from 'node:path'

import type { AssetRecord, Logger, MediaKind } from './types.js'
import { dataDir, ensureDir, imageSize, makeId, mimeOf, readJson, shortHash, sniffImageMime, writeJson } from './util.js'

interface IndexFile {
  version: 1
  assets: AssetRecord[]
}

const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|mp4|m4v|webm|mov|mkv|mp3|wav|flac|m4a|ogg)$/i

export function kindOf(file: string): MediaKind {
  const ext = path.extname(file).toLowerCase()
  if (/^\.(png|jpe?g|webp|gif|avif|bmp)$/.test(ext)) return 'image'
  if (/^\.(mp4|m4v|webm|mov|mkv)$/.test(ext)) return 'video'
  if (/^\.(mp3|wav|flac|m4a|ogg)$/.test(ext)) return 'audio'
  return 'file'
}

export function indexFile(): string {
  return path.join(dataDir(), 'library', 'index.json')
}

export class AssetLibrary {
  private readonly assets = new Map<string, AssetRecord>()
  private readonly byPath = new Map<string, string>()
  private saveTimer: NodeJS.Timeout | undefined

  constructor(
    private readonly roots: string[],
    private readonly logger?: Logger,
  ) {
    this.load()
  }

  private load(): void {
    const stored = readJson<IndexFile>(indexFile())
    for (const asset of stored?.assets ?? []) {
      if (typeof asset.id !== 'string' || typeof asset.path !== 'string') continue
      this.assets.set(asset.id, asset)
      this.byPath.set(asset.path, asset.id)
    }
    this.logger?.info?.(`[media-studio] 素材库载入 ${String(this.assets.size)} 条`)
  }

  private scheduleSave(): void {
    if (this.saveTimer !== undefined) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined
      this.saveNow()
    }, 150)
    this.saveTimer.unref?.()
  }

  saveNow(): void {
    ensureDir(path.dirname(indexFile()))
    writeJson(indexFile(), { version: 1, assets: [...this.assets.values()] } satisfies IndexFile)
  }

  private remember(asset: AssetRecord): AssetRecord {
    this.assets.set(asset.id, asset)
    this.byPath.set(asset.path, asset.id)
    this.writeSidecar(asset)
    this.scheduleSave()
    return asset
  }

  private writeSidecar(asset: AssetRecord): void {
    try {
      writeJson(`${asset.path}.meta.json`, { ...asset, sidecar: true })
    } catch {
      // the file may live in a read-only import root; the central index is enough
    }
  }

  /** Existing record for a path, if any. */
  getByPath(file: string): AssetRecord | undefined {
    const id = this.byPath.get(path.resolve(file))
    return id === undefined ? undefined : this.assets.get(id)
  }

  get(id: string): AssetRecord | undefined {
    return this.assets.get(id)
  }

  list(filter: { query?: string; kind?: string; favorite?: boolean; limit?: number; offset?: number; jobId?: string } = {}): { total: number; items: AssetRecord[] } {
    const query = filter.query?.trim().toLowerCase() ?? ''
    let items = [...this.assets.values()]
    if (filter.kind !== undefined && filter.kind !== '' && filter.kind !== 'all') items = items.filter(item => item.kind === filter.kind)
    if (filter.favorite === true) items = items.filter(item => item.favorite === true)
    if (filter.jobId !== undefined && filter.jobId !== '') items = items.filter(item => item.jobId === filter.jobId)
    if (query !== '') {
      items = items.filter(item => {
        const haystack = [item.name, item.prompt, item.negativePrompt, item.model, item.channelId, ...(item.tags ?? [])].join(' ').toLowerCase()
        return haystack.includes(query)
      })
    }
    items.sort((a, b) => b.createdAt - a.createdAt)
    const total = items.length
    const offset = filter.offset ?? 0
    const limit = filter.limit ?? 200
    return { total, items: items.slice(offset, offset + limit) }
  }

  /** Index an existing file without copying it. */
  register(file: string, meta: Partial<AssetRecord> = {}): AssetRecord {
    const abs = path.resolve(file)
    const existing = this.getByPath(abs)
    if (existing !== undefined) {
      const merged = { ...existing, ...stripUndefined(meta) }
      return this.remember(merged)
    }
    const stat = fs.statSync(abs)
    const head = readHead(abs, 64 * 1024)
    const kind = kindOf(abs)
    const dimensions = kind === 'image' ? imageSize(head) : undefined
    const asset: AssetRecord = {
      id: makeId('as'),
      path: abs,
      name: path.basename(abs),
      kind,
      mime: sniffImageMime(head) ?? mimeOf(abs),
      bytes: stat.size,
      createdAt: stat.birthtimeMs || Date.now(),
      origin: 'imported',
      ...(dimensions === undefined ? {} : { width: dimensions.width, height: dimensions.height }),
      ...stripUndefined(meta),
    }
    return this.remember(asset)
  }

  /** Write bytes into the library and index the result. */
  addBuffer(data: Buffer, options: { ext?: string; name?: string; kind?: MediaKind; meta?: Partial<AssetRecord>; dir?: string }): AssetRecord {
    const kind = options.kind ?? 'image'
    const ext = options.ext ?? extOfKind(kind)
    const stamp = new Date()
    const sub = path.join(String(stamp.getFullYear()), String(stamp.getMonth() + 1).padStart(2, '0'))
    const dir = options.dir ?? path.join(this.roots[0] ?? path.join(dataDir(), 'outputs'), sub)
    ensureDir(dir)
    const base = sanitizeName(options.name ?? 'asset')
    const file = path.join(dir, `${base}-${shortHash(data)}${ext}`)
    if (!fs.existsSync(file)) fs.writeFileSync(file, data)
    const dimensions = kind === 'image' ? imageSize(data) : undefined
    const asset: AssetRecord = {
      id: makeId('as'),
      path: file,
      name: path.basename(file),
      kind,
      mime: sniffImageMime(data) ?? mimeOf(file),
      bytes: data.length,
      createdAt: Date.now(),
      origin: 'generated',
      ...(dimensions === undefined ? {} : { width: dimensions.width, height: dimensions.height }),
      ...stripUndefined(options.meta ?? {}),
    }
    return this.remember(asset)
  }

  setFavorite(id: string, favorite: boolean): AssetRecord | undefined {
    const asset = this.assets.get(id)
    if (asset === undefined) return undefined
    asset.favorite = favorite
    this.writeSidecar(asset)
    this.scheduleSave()
    return asset
  }

  update(id: string, patch: Partial<AssetRecord>): AssetRecord | undefined {
    const asset = this.assets.get(id)
    if (asset === undefined) return undefined
    const next = { ...asset, ...stripUndefined(patch) }
    return this.remember(next)
  }

  remove(id: string, options: { deleteFile?: boolean } = {}): boolean {
    const asset = this.assets.get(id)
    if (asset === undefined) return false
    if (options.deleteFile !== false && asset.origin !== 'imported') {
      try { fs.rmSync(asset.path, { force: true }) } catch { /* already gone */ }
      try { fs.rmSync(`${asset.path}.meta.json`, { force: true }) } catch { /* optional */ }
    }
    this.assets.delete(id)
    this.byPath.delete(asset.path)
    this.scheduleSave()
    return true
  }

  /** Index untracked media under the configured roots. */
  scan(limit = 1000): number {
    let added = 0
    const walk = (dir: string, depth: number): void => {
      if (added >= limit || depth > 3) return
      let entries: fs.Dirent[]
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const entry of entries) {
        if (added >= limit) return
        if (entry.name.startsWith('.')) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) { walk(full, depth + 1); continue }
        if (!MEDIA_EXT.test(entry.name)) continue
        if (this.byPath.has(full)) continue
        try {
          this.register(full)
          added += 1
        } catch {
          // unreadable / vanished: skip, the next scan retries
        }
      }
    }
    for (const root of this.roots) walk(root, 0)
    return added
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}

function readHead(file: string, bytes: number): Buffer {
  try {
    const fd = fs.openSync(file, 'r')
    try {
      const buffer = Buffer.alloc(bytes)
      const read = fs.readSync(fd, buffer, 0, bytes, 0)
      return buffer.subarray(0, read)
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return Buffer.alloc(0)
  }
}

function sanitizeName(name: string): string {
  return name.trim().replace(/\.[a-z0-9]+$/i, '').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 48) || 'asset'
}

function extOfKind(kind: MediaKind): string {
  switch (kind) {
    case 'image': return '.png'
    case 'video': return '.mp4'
    case 'audio': return '.mp3'
    default: return '.bin'
  }
}
