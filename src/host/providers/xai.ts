/**
 * xAI Grok Imagine: images through `/images/generations`, video through
 * `/videos/generations` + `GET /videos/{request_id}`.
 */
import type { GeneratedImage, GeneratedVideo, ImageRequest, VideoRequest } from '../types.js'
import { bearer, clampSeconds, decodeImages, failure, pollUntil, refDataUrl, videoResult } from './common.js'
import { download, errorBody, getWithRetry, joinUrl, postJson } from '../util.js'

function base(request: { channel: { baseUrl?: string } }): string {
  return (request.channel.baseUrl ?? 'https://api.x.ai/v1').replace(/\/+$/, '')
}

export async function generateXaiImage(request: ImageRequest): Promise<GeneratedImage[]> {
  const model = (request.channel.imageModel ?? '').trim()
  if (model === '') throw new Error('xAI 通道没有配置 imageModel')
  const body: Record<string, unknown> = {
    model,
    prompt: request.prompt,
    n: request.n,
    response_format: 'b64_json',
    ...(request.aspectRatio === undefined || request.aspectRatio === '' ? {} : { aspect_ratio: request.aspectRatio }),
    ...(request.size === undefined || request.size === '' ? {} : { size: request.size }),
    ...request.channel.extraBody,
  }
  const response = await postJson(joinUrl(base(request), 'images/generations'), body, bearer(request.apiKey, request.channel.headers), 300_000, request.signal)
  if (!response.ok) throw await failure(response, 'Grok 图像生成', request.apiKey)
  const payload = await response.json()
  return (await decodeImages(payload, request.maxBytes, request.signal, request.apiKey)).slice(0, request.n)
}

export async function generateXaiVideo(request: VideoRequest): Promise<GeneratedVideo> {
  const model = (request.channel.videoModel ?? '').trim()
  if (model === '') throw new Error('xAI 通道没有配置 videoModel')
  const first = request.refs[0]
  const body: Record<string, unknown> = {
    model,
    prompt: request.prompt,
    duration: clampSeconds(request.seconds, 1, 15),
    resolution: request.resolution.toLowerCase(),
    ...(request.aspectRatio === '' ? {} : { aspect_ratio: request.aspectRatio }),
    ...(first === undefined ? {} : { image: { url: refDataUrl(first) } }),
    ...request.channel.extraBody,
  }
  const response = await postJson(joinUrl(base(request), 'videos/generations'), body, bearer(request.apiKey, request.channel.headers), 120_000, request.signal)
  if (!response.ok) throw await failure(response, 'Grok 视频提交', request.apiKey)
  const submitted = await response.json() as { request_id?: unknown; id?: unknown }
  const id = typeof submitted.request_id === 'string' ? submitted.request_id : typeof submitted.id === 'string' ? submitted.id : ''
  if (id === '') throw new Error('Grok 视频提交没有返回 request_id')
  request.onProgress?.('Grok 任务已提交，等待渲染')

  return pollUntil<GeneratedVideo>(async () => {
    const poll = await getWithRetry(joinUrl(base(request), `videos/${encodeURIComponent(id)}`), bearer(request.apiKey, request.channel.headers), 60_000, request.signal)
    if (!poll.ok) throw new Error(`Grok 视频查询失败：HTTP ${String(poll.status)} ${await errorBody(poll, request.apiKey)}`)
    const payload = await poll.json() as {
      status?: unknown
      error?: { message?: string } | string
      video?: { url?: unknown; duration?: unknown }
      url?: unknown
    }
    const status = String(payload.status ?? '').toLowerCase()
    if (status === 'failed' || status === 'error' || status === 'expired') {
      const message = typeof payload.error === 'string' ? payload.error : payload.error?.message ?? status
      throw new Error(`Grok 渲染失败：${message}`)
    }
    const url = typeof payload.video?.url === 'string' ? payload.video.url : typeof payload.url === 'string' ? payload.url : ''
    if (status === 'completed' || status === 'succeeded' || (url !== '' && status === 'done')) {
      if (url === '') throw new Error('Grok 已完成但没有返回视频地址')
      const downloaded = await download(url, request.maxBytes, request.signal)
      return { done: true, value: videoResult(downloaded.data, downloaded.mime, url) }
    }
    return { done: false, note: `Grok 渲染中（${status || 'pending'}）` }
  }, { deadlineMs: 40 * 60_000, intervalMs: 5000, signal: request.signal, onProgress: request.onProgress, label: 'Grok' })
}
