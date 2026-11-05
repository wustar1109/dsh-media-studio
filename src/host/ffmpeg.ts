/**
 * Local ffmpeg helpers: concat storyboard clips and grab a tail frame.
 *
 * Everything runs on the user's machine, so stitching costs no credits. The
 * filter graph normalises size/fps/sample aspect first — concatenating clips
 * from different providers otherwise fails or produces a stretched result.
 */
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { dataDir, ensureDir, makeId } from './util.js'

const run = promisify(execFile)

export interface FfmpegInfo {
  ffmpeg?: string
  ffprobe?: string
  error?: string
}

let cached: FfmpegInfo | undefined

/** Find ffmpeg/ffprobe once per process. */
export function detectFfmpeg(configured?: string | null): FfmpegInfo {
  if (cached !== undefined && (configured === undefined || configured === null || configured === cached.ffmpeg)) return cached
  const candidates: string[] = []
  if (configured !== undefined && configured !== null && configured.trim() !== '') candidates.push(configured.trim())
  const env = process.env.FFMPEG_PATH?.trim()
  if (env !== undefined && env !== '') candidates.push(env)

  const exe = process.platform === 'win32' ? '.exe' : ''
  const dirs = [
    path.join(dataDir(), 'bin'),
    process.platform === 'win32' ? 'C:\\ffmpeg\\bin' : '/usr/local/bin',
    process.platform === 'win32' ? 'C:\\Program Files\\ffmpeg\\bin' : '/opt/homebrew/bin',
    '/usr/bin',
    '/usr/local/bin',
  ]
  for (const dir of dirs) candidates.push(path.join(dir, `ffmpeg${exe}`))

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const probe = path.join(path.dirname(candidate), `ffprobe${exe}`)
        cached = { ffmpeg: candidate, ...(fs.existsSync(probe) ? { ffprobe: probe } : {}) }
        return cached
      }
    } catch {
      // keep looking
    }
  }

  // Fall back to PATH. `where`/`which` is cheap and avoids spawning ffmpeg -version.
  const finder = process.platform === 'win32' ? 'where' : 'which'
  try {
    const stdout = execFileSync(finder, ['ffmpeg'], { encoding: 'utf8', timeout: 4000 })
    const first = stdout.split(/\r?\n/).map((line: string) => line.trim()).find((line: string) => line !== '')
    if (first !== undefined) {
      const probe = path.join(path.dirname(first), `ffprobe${exe}`)
      cached = { ffmpeg: first, ...(fs.existsSync(probe) ? { ffprobe: probe } : {}) }
      return cached
    }
  } catch {
    // not installed
  }
  cached = { error: '找不到 ffmpeg。把它放进 PATH，或在面板「通道 → 高级」里填写 ffmpegPath。' }
  return cached
}

/** Probe width/height/duration; `undefined` when ffprobe is missing. */
export async function probe(file: string, configured?: string | null): Promise<{ width?: number; height?: number; duration?: number; hasAudio?: boolean }> {
  const info = detectFfmpeg(configured)
  if (info.ffprobe === undefined) return {}
  try {
    const { stdout } = await run(info.ffprobe, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 })
    const payload = JSON.parse(stdout) as {
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>
      format?: { duration?: string }
    }
    const video = payload.streams?.find(stream => stream.codec_type === 'video')
    const duration = Number.parseFloat(payload.format?.duration ?? '')
    return {
      ...(video?.width === undefined ? {} : { width: video.width }),
      ...(video?.height === undefined ? {} : { height: video.height }),
      ...(Number.isFinite(duration) ? { duration } : {}),
      hasAudio: payload.streams?.some(stream => stream.codec_type === 'audio') === true,
    }
  } catch {
    return {}
  }
}

export interface ConcatOptions {
  inputs: string[]
  outputDir: string
  size?: string
  fps?: number
  ffmpegPath?: string | null
  onProgress?: (stage: string) => void
}

/** Concat clips into one H.264 MP4, normalising size/fps first. */
export async function concatVideos(options: ConcatOptions): Promise<{ file: string; width: number; height: number }> {
  if (options.inputs.length === 0) throw new Error('没有可拼接的片段')
  if (options.inputs.length === 1) throw new Error('至少需要两段视频')
  for (const file of options.inputs) {
    if (!fs.existsSync(file)) throw new Error(`片段不存在：${file}`)
  }
  const info = detectFfmpeg(options.ffmpegPath)
  if (info.ffmpeg === undefined) throw new Error(info.error ?? 'ffmpeg 不可用')

  let width = 1280
  let height = 720
  if (options.size !== undefined && options.size !== '') {
    const match = /^(\d{2,5})x(\d{2,5})$/.exec(options.size)
    if (match !== null) { width = Number(match[1]); height = Number(match[2]) }
  } else {
    const first = await probe(options.inputs[0]!, options.ffmpegPath)
    if (first.width !== undefined && first.height !== undefined) {
      // Keep the first clip's aspect but cap the long edge at 1920 so a 4K
      // render does not turn a 30s storyboard into a 40-minute encode.
      const long = Math.max(first.width, first.height)
      const scale = long > 1920 ? 1920 / long : 1
      width = Math.round(first.width * scale / 2) * 2
      height = Math.round(first.height * scale / 2) * 2
    }
  }

  const fps = options.fps ?? 30
  const filters: string[] = []
  const labels: string[] = []
  options.inputs.forEach((_, index) => {
    filters.push(`[${String(index)}:v]scale=${String(width)}:${String(height)}:force_original_aspect_ratio=decrease,pad=${String(width)}:${String(height)}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${String(fps)}[v${String(index)}]`)
    labels.push(`[v${String(index)}]`)
  })
  filters.push(`${labels.join('')}concat=n=${String(options.inputs.length)}:v=1:a=0[out]`)

  ensureDir(options.outputDir)
  const output = path.join(options.outputDir, `concat-${makeId('v')}.mp4`)
  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error']
  for (const file of options.inputs) args.push('-i', file)
  args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart')
  args.push('-an', output)
  options.onProgress?.(`拼接 ${String(options.inputs.length)} 段视频…`)
  try {
    await run(info.ffmpeg, args, { timeout: 30 * 60_000, maxBuffer: 8 * 1024 * 1024 })
  } catch (error) {
    const message = error instanceof Error && 'stderr' in error ? String((error as { stderr?: string }).stderr ?? '').slice(0, 800) : String(error)
    throw new Error(`ffmpeg 拼接失败：${message}`)
  }
  return { file: output, width, height }
}

/** Grab the last frame of a clip as PNG (storyboard continuity). */
export async function extractLastFrame(input: string, outputDir: string, ffmpegPath?: string | null): Promise<string> {
  const info = detectFfmpeg(ffmpegPath)
  if (info.ffmpeg === undefined) throw new Error(info.error ?? 'ffmpeg 不可用')
  ensureDir(outputDir)
  const output = path.join(outputDir, `tail-${makeId('f')}.png`)
  // Seeking near the probed duration is the reliable way to get the LAST frame;
  // `-sseof` is the fallback when ffprobe is missing, and a plain last-frame
  // extraction is the final attempt for exotic containers.
  const attempts: string[][] = []
  const probed = await probe(input, ffmpegPath)
  if (probed.duration !== undefined && probed.duration > 0.2) {
    attempts.push(['-ss', (probed.duration - 0.2).toFixed(2), '-i', input, '-frames:v', '1'])
  }
  attempts.push(['-sseof', '-1', '-i', input, '-frames:v', '1'])
  attempts.push(['-i', input, '-update', '1', '-frames:v', '1'])
  let lastError: unknown
  for (const args of attempts) {
    try {
      await run(info.ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args, output], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
      if (fs.existsSync(output) && fs.statSync(output).size > 0) return output
    } catch (error) {
      lastError = error
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? '未知错误')
  throw new Error(`取尾帧失败：${detail.slice(0, 300)}`)
}

/** Duration of a media file, if ffprobe knows. */
export async function durationOf(file: string, ffmpegPath?: string | null): Promise<number | undefined> {
  return (await probe(file, ffmpegPath)).duration
}
