/**
 * Async job manager. One shape covers image batches, video renders, ComfyUI
 * runs, storyboards and ffmpeg concat: submit -> running -> succeeded/failed.
 *
 * Tools return the id immediately so the conversation is never blocked on a
 * multi-minute render; the panel polls /jobs and `media_job` exposes the same
 * records to the agent.
 */
import fs from 'node:fs'
import path from 'node:path'

import type { AssetRecord, JobKind, JobRecord, JobState, Logger } from './types.js'
import { dataDir, ensureDir, makeId, readJson } from './util.js'

export interface JobContext {
  job: JobRecord
  signal: AbortSignal
  progress: (stage: string, value?: number, max?: number) => void
}

export interface JobInit {
  kind: JobKind
  prompt?: string
  channelId?: string
  provider?: string
  model?: string
  params?: Record<string, unknown>
  parentId?: string
  shots?: JobRecord['shots']
}

export interface JobResult {
  assets?: AssetRecord[]
  shots?: JobRecord['shots']
  note?: string
}

const KEEP_JOBS = 200

export class JobManager {
  private readonly jobs = new Map<string, JobRecord>()
  private readonly controllers = new Map<string, AbortController>()

  constructor(private readonly logger?: Logger) {
    this.load()
  }

  private dir(): string {
    return path.join(dataDir(), 'jobs')
  }

  private load(): void {
    ensureDir(this.dir())
    const files = fs.readdirSync(this.dir()).filter(file => file.endsWith('.json'))
    const records: JobRecord[] = []
    for (const file of files) {
      const record = readJson<JobRecord>(path.join(this.dir(), file))
      if (record !== undefined && typeof record.id === 'string') records.push(record)
    }
    records.sort((a, b) => b.createdAt - a.createdAt)
    for (const record of records.slice(0, KEEP_JOBS)) this.jobs.set(record.id, record)
    // A process that died mid-render leaves `running` records behind: say so
    // instead of pretending the render is still alive.
    for (const job of this.jobs.values()) {
      if (job.state === 'running' || job.state === 'queued') {
        job.state = 'failed'
        job.error = '宿主重启，任务中断'
        job.finishedAt = Date.now()
        this.persist(job)
      }
    }
  }

  private persist(job: JobRecord): void {
    try {
      ensureDir(this.dir())
      fs.writeFileSync(path.join(this.dir(), `${job.id}.json`), `${JSON.stringify(job, null, 2)}\n`, 'utf8')
    } catch (error) {
      this.logger?.warn(`[media-studio] 任务落盘失败：${String(error)}`)
    }
  }

  list(filter: { state?: string; kind?: string; limit?: number } = {}): JobRecord[] {
    let items = [...this.jobs.values()]
    if (filter.state !== undefined && filter.state !== '') items = items.filter(job => job.state === filter.state)
    if (filter.kind !== undefined && filter.kind !== '') items = items.filter(job => job.kind === filter.kind)
    items.sort((a, b) => b.createdAt - a.createdAt)
    return items.slice(0, filter.limit ?? 100)
  }

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id)
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id)
    if (job === undefined) return false
    const controller = this.controllers.get(id)
    if (controller !== undefined) controller.abort(new Error('cancelled by user'))
    if (job.state === 'queued' || job.state === 'running') {
      job.state = 'cancelled'
      job.finishedAt = Date.now()
      job.error = '已取消'
      this.persist(job)
    }
    return true
  }

  /**
   * Start a job. `task` must resolve to the produced assets; the manager owns
   * state transitions, cancellation and persistence.
   */
  start(init: JobInit, task: (context: JobContext) => Promise<JobResult>): JobRecord {
    const job: JobRecord = {
      id: makeId('job'),
      kind: init.kind,
      state: 'queued',
      createdAt: Date.now(),
      ...(init.prompt === undefined ? {} : { prompt: init.prompt }),
      ...(init.channelId === undefined ? {} : { channelId: init.channelId }),
      ...(init.provider === undefined ? {} : { provider: init.provider }),
      ...(init.model === undefined ? {} : { model: init.model }),
      ...(init.params === undefined ? {} : { params: init.params }),
      ...(init.parentId === undefined ? {} : { parentId: init.parentId }),
      ...(init.shots === undefined ? {} : { shots: init.shots }),
    }
    this.jobs.set(job.id, job)
    this.trim()
    const controller = new AbortController()
    this.controllers.set(job.id, controller)

    const context: JobContext = {
      job,
      signal: controller.signal,
      progress: (stage, value, max) => {
        if (job.state !== 'running' && job.state !== 'queued') return
        job.progress = { stage, ...(value === undefined ? {} : { value }), ...(max === undefined ? {} : { max }) }
      },
    }

    queueMicrotask(() => {
      if (job.state === 'cancelled') return
      job.state = 'running'
      job.startedAt = Date.now()
      this.persist(job)
      void task(context)
        .then(result => {
          if (job.state === 'cancelled') return
          job.state = 'succeeded'
          job.finishedAt = Date.now()
          job.assets = result.assets ?? []
          if (result.shots !== undefined) job.shots = result.shots
          delete job.error
          this.persist(job)
          this.logger?.info?.(`[media-studio] 任务 ${job.id} 完成（${String(job.assets.length)} 个产物）`)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          if (job.state === 'cancelled') {
            this.persist(job)
            return
          }
          job.state = message === 'cancelled' ? 'cancelled' : 'failed'
          job.error = message
          job.finishedAt = Date.now()
          this.persist(job)
          this.logger?.warn?.(`[media-studio] 任务 ${job.id} 失败：${message}`)
        })
        .finally(() => { this.controllers.delete(job.id) })
    })

    return job
  }

  /** Drop the oldest settled records beyond the cap, memory and disk. */
  private trim(): void {
    const settled = [...this.jobs.values()].filter(job => job.state !== 'running' && job.state !== 'queued').sort((a, b) => a.createdAt - b.createdAt)
    const excess = Math.max(0, this.jobs.size - KEEP_JOBS)
    for (const job of settled.slice(0, excess)) {
      this.jobs.delete(job.id)
      try { fs.rmSync(path.join(this.dir(), `${job.id}.json`), { force: true }) } catch { /* ignore */ }
    }
  }

  /** Block until a job settles (tools with `wait: true`). */
  async wait(id: string, timeoutMs: number): Promise<JobRecord> {
    const started = Date.now()
    for (;;) {
      const job = this.jobs.get(id)
      if (job === undefined) throw new Error(`没有这个任务：${id}`)
      if (job.state !== 'running' && job.state !== 'queued') return job
      if (Date.now() - started > timeoutMs) return job
      await new Promise(resolve => setTimeout(resolve, 700))
    }
  }

  activeCount(): number {
    return [...this.jobs.values()].filter(job => job.state === 'running' || job.state === 'queued').length
  }

  stateOf(id: string): JobState | undefined {
    return this.jobs.get(id)?.state
  }
}
