/**
 * Volcengine Ark (火山方舟): Seedream images and Seedance video.
 *
 * Both APIs live under `/api/v3`; image is synchronous, video is the async
 * `contents/generations/tasks` collection.
 */
import type { GeneratedImage, GeneratedVideo, ImageRequest, VideoRequest } from '../types.js'
import { bearer, clampSeconds, decodeImages, failure, pollUntil, refDataUrl, videoResult } from './common.js'
import { download, errorBody, getWithRetry, joinUrl, postJson } from '../util.js'

function base(request: { channel: { baseUrl?: string } }): string {
  return (request.channel.baseUrl ?? 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '')
}

export async function generateArkImage(request: ImageRequest): Promise<GeneratedImage[]> {
  const model = (request.channel.imageModel ?? '').trim()
  if (model === '') throw new Error('Ark 通道没有配置 imageModel')
  const size = request.size !== undefined && request.size !== ''
    ? request.size
    : request.aspectRatio === undefined || request.aspectRatio === ''
      ? '2048x2048'
      : { '1:1': '2048x2048', '4:3': '2304x1728', '3:4': '1728x2304', '16:9': '2560x1440', '9:16': '1440x2560', '3:2': '2496x1664', '2:3': '1664x2496', '21:9': '3024x1296' }[request.aspectRatio] ?? '2048x2048'
  const body: Record<string, unknown> = {
    model,
    prompt: request.prompt,
    ...(request.refs.length === 0 ? {} : { image: request.refs.map(ref => refDataUrl(ref)) }),
    size,
    response_format: 'b64_json',
    watermark: false,
    sequential_image_generation: 'disabled',
    ...request.channel.extraBody,
  }
  const response = await postJson(joinUrl(base(request), 'images/generations'), body, bearer(request.apiKey, request.channel.headers), 300_000, request.signal)
  if (!response.ok) throw await failure(response, 'Seedream 图像生成', request.apiKey)
  const payload = await response.json()
  return (await decodeImages(payload, request.maxBytes, request.signal, request.apiKey)).slice(0, request.n)
}

export async function generateArkVideo(request: VideoRequest): Promise<GeneratedVideo> {
  const model = (request.channel.videoModel ?? '').trim()
  if (model === '') throw new Error('Ark 通道没有配置 videoModel')
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: request.prompt }]
  const asImage = (ref: { data: Buffer; mime: string }): Record<string, unknown> => ({
    type: 'image_url',
    image_url: { url: refDataUrl(ref) },
  })
  if (request.mode === 'keyframe') {
    if (request.refs[0] !== undefined) content.push({ ...asImage(request.refs[0]), role: 'first_frame' })
    if (request.refs[1] !== undefined) content.push({ ...asImage(request.refs[1]), role: 'last_frame' })
  } else if (request.mode === 'reference') {
    for (const ref of request.refs) content.push({ ...asImage(ref), role: 'reference_image' })
  } else if (request.refs[0] !== undefined) {
    content.push({ ...asImage(request.refs[0]), role: 'first_frame' })
  }
  const body: Record<string, unknown> = {
    model,
    content,
    resolution: request.resolution.toLowerCase() === '1080p' ? '1080p' : request.resolution.toLowerCase() === '480p' ? '480p' : '720p',
    duration: clampSeconds(request.seconds, 2, 15),
    ratio: request.aspectRatio === '' ? '16:9' : request.aspectRatio,
    watermark: false,
    ...(request.seed === undefined ? {} : { seed: request.seed }),
    ...request.channel.extraBody,
  }
  if (!/seedance[-_.]?1/i.test(model)) body.generate_audio = false
  const response = await postJson(joinUrl(base(request), 'contents/generations/tasks'), body, bearer(request.apiKey, request.channel.headers), 120_000, request.signal)
  if (!response.ok) throw await failure(response, 'Seedance 视频提交', request.apiKey)
  const submitted = await response.json() as { id?: unknown }
  const id = typeof submitted.id === 'string' ? submitted.id : ''
  if (id === '') throw new Error('Seedance 提交没有返回任务 id（确认模型 id 与计费开通状态）')
  request.onProgress?.('Seedance 任务已提交，等待渲染')

  return pollUntil<GeneratedVideo>(async () => {
    const poll = await getWithRetry(joinUrl(base(request), `contents/generations/tasks/${encodeURIComponent(id)}`), bearer(request.apiKey, request.channel.headers), 60_000, request.signal)
    if (!poll.ok) throw new Error(`Seedance 任务查询失败：HTTP ${String(poll.status)} ${await errorBody(poll, request.apiKey)}`)
    const payload = await poll.json() as {
      status?: unknown
      error?: { message?: string }
      content?: { video_url?: unknown; last_frame_url?: unknown }
    }
    const status = String(payload.status ?? '').toLowerCase()
    if (status === 'failed' || status === 'cancelled') throw new Error(`Seedance 渲染失败：${payload.error?.message ?? status}`)
    if (status === 'succeeded') {
      const url = typeof payload.content?.video_url === 'string' ? payload.content.video_url : ''
      if (url === '') throw new Error('Seedance 已完成但没有返回 video_url')
      const downloaded = await download(url, request.maxBytes, request.signal)
      let poster: Buffer | undefined
      if (typeof payload.content?.last_frame_url === 'string' && payload.content.last_frame_url !== '') {
        poster = await download(payload.content.last_frame_url, 20 * 1024 * 1024, request.signal).then(item => item.data).catch(() => undefined)
      }
      return { done: true, value: videoResult(downloaded.data, downloaded.mime, url, poster) }
    }
    return { done: false, note: `Seedance 渲染中（${status || 'queued'}）` }
  }, { deadlineMs: 40 * 60_000, intervalMs: 5000, signal: request.signal, onProgress: request.onProgress, label: 'Seedance' })
}
