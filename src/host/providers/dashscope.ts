/**
 * Aliyun DashScope / Bailian: Qwen-Image (synchronous, multimodal-generation)
 * and Wan video synthesis (async task API).
 */
import type { GeneratedImage, GeneratedVideo, ImageRequest, VideoRequest } from '../types.js'
import { bearer, clampSeconds, failure, pollUntil, refDataUrl, videoResult } from './common.js'
import { download, errorBody, getWithRetry, joinUrl, postJson, readBounded } from '../util.js'

function base(request: { channel: { baseUrl?: string } }): string {
  return (request.channel.baseUrl ?? 'https://dashscope.aliyuncs.com/api/v1').replace(/\/+$/, '')
}

function dashHeaders(apiKey: string, extra: Record<string, string> = {}): Record<string, string> {
  return { authorization: `Bearer ${apiKey}`, ...extra }
}

/** Wan sizes are `W*H` strings, and the video API only takes 480P/720P/1080P. */
function wanSize(aspectRatio: string, resolution: string): string {
  const long = resolution === '1080P' || resolution === '1080p' ? '1920*1080' : resolution === '480P' || resolution === '480p' ? '832*480' : '1280*720'
  if (aspectRatio === '9:16') return long === '832*480' ? '480*832' : long === '1920*1080' ? '1080*1920' : '720*1280'
  if (aspectRatio === '1:1') return resolution === '1080P' ? '1080*1080' : '960*960'
  return long
}

/** Wan accepts 5 or 10 second clips; anything else is rounded to the nearer one. */
function wanDuration(seconds: number): number {
  return clampSeconds(seconds, 5, 10) <= 7 ? 5 : 10
}

export async function generateDashScopeImage(request: ImageRequest): Promise<GeneratedImage[]> {
  const model = (request.channel.imageModel ?? '').trim()
  if (model === '') throw new Error('DashScope 通道没有配置 imageModel')
  const content: Array<Record<string, unknown>> = request.refs.map(ref => ({ image: refDataUrl(ref) }))
  content.push({ text: request.prompt })
  const size = (request.size ?? '').replace('*', 'x')
  const body = {
    model,
    input: { messages: [{ role: 'user', content }] },
    parameters: {
      ...(size === '' ? {} : { size: size.replace('x', '*') }),
      watermark: false,
      prompt_extend: true,
      n: request.n,
      ...request.channel.extraBody,
    },
  }
  const response = await postJson(joinUrl(base(request), 'services/aigc/multimodal-generation/generation'), body, dashHeaders(request.apiKey, request.channel.headers), 300_000, request.signal)
  if (!response.ok) throw await failure(response, 'DashScope 图像生成', request.apiKey)
  const payload = await response.json() as {
    output?: { choices?: Array<{ message?: { content?: Array<Record<string, unknown>> } }> }
    message?: string
    code?: string
  }
  const urls: string[] = []
  for (const choice of payload.output?.choices ?? []) {
    for (const item of choice.message?.content ?? []) {
      const url = typeof item.image === 'string' ? item.image : typeof item.image_url === 'string' ? item.image_url : typeof item.url === 'string' ? item.url : ''
      if (url !== '') urls.push(url)
    }
  }
  if (urls.length === 0) throw new Error(`DashScope 没有返回图片：${payload.message ?? payload.code ?? '响应里没有 image 字段'}`)
  const images: GeneratedImage[] = []
  for (const url of urls.slice(0, request.n)) {
    const downloaded = url.startsWith('data:')
      ? (() => {
          const match = /^data:([^;]+);base64,(.*)$/s.exec(url)
          return { data: Buffer.from(match?.[2] ?? '', 'base64'), mime: match?.[1] ?? 'image/png' }
        })()
      : await download(url, request.maxBytes, request.signal)
    images.push({ data: downloaded.data, mime: downloaded.mime })
  }
  return images
}

export async function generateDashScopeVideo(request: VideoRequest): Promise<GeneratedVideo> {
  const model = (request.channel.videoModel ?? '').trim()
  if (model === '') throw new Error('DashScope 通道没有配置 videoModel')
  const first = request.refs[0]
  const input: Record<string, unknown> = { prompt: request.prompt }
  if (first !== undefined) input.img_url = refDataUrl(first)
  if (request.negative !== undefined && request.negative !== '') input.negative_prompt = request.negative
  const body = {
    model,
    input,
    parameters: {
      size: wanSize(request.aspectRatio === '' ? '16:9' : request.aspectRatio, request.resolution),
      duration: wanDuration(request.seconds),
      prompt_extend: true,
      watermark: false,
      ...request.channel.extraBody,
    },
  }
  const response = await postJson(
    joinUrl(base(request), 'services/aigc/video-generation/video-synthesis'),
    body,
    dashHeaders(request.apiKey, { 'X-DashScope-Async': 'enable', ...request.channel.headers }),
    120_000,
    request.signal,
  )
  if (!response.ok) throw await failure(response, 'DashScope 视频提交', request.apiKey)
  const submitted = await response.json() as { output?: { task_id?: unknown; task_status?: unknown }; message?: string }
  const taskId = typeof submitted.output?.task_id === 'string' ? submitted.output.task_id : ''
  if (taskId === '') throw new Error(`DashScope 视频提交没有返回 task_id：${submitted.message ?? '检查模型是否开通'}`)
  request.onProgress?.('Wan 任务已提交，等待渲染')

  return pollUntil<GeneratedVideo>(async () => {
    const poll = await getWithRetry(joinUrl(base(request), `tasks/${encodeURIComponent(taskId)}`), dashHeaders(request.apiKey, request.channel.headers), 60_000, request.signal)
    if (!poll.ok) throw new Error(`DashScope 任务查询失败：HTTP ${String(poll.status)} ${await errorBody(poll, request.apiKey)}`)
    const payload = await poll.json() as {
      output?: { task_status?: unknown; video_url?: unknown; message?: unknown; code?: unknown }
      message?: string
    }
    const status = String(payload.output?.task_status ?? '').toUpperCase()
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      throw new Error(`Wan 渲染失败：${String(payload.output?.message ?? payload.output?.code ?? payload.message ?? status)}`)
    }
    if (status === 'SUCCEEDED') {
      const url = typeof payload.output?.video_url === 'string' ? payload.output.video_url : ''
      if (url === '') throw new Error('Wan 已完成但没有返回 video_url')
      const downloaded = await download(url, request.maxBytes, request.signal)
      return { done: true, value: videoResult(downloaded.data, downloaded.mime, url) }
    }
    return { done: false, note: `Wan 渲染中（${status || 'PENDING'}）` }
  }, { deadlineMs: 40 * 60_000, intervalMs: 5000, signal: request.signal, onProgress: request.onProgress, label: 'Wan' })
}
