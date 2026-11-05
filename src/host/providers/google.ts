/**
 * Google Gemini image generation/editing and Veo video generation.
 *
 * Native `generateContent` is used rather than the newer Interactions endpoint:
 * it is the long-lived public contract and works against both Google and the
 * common Gemini-compatible relays.
 */
import type { GeneratedImage, GeneratedVideo, ImageRequest, VideoRequest } from '../types.js'
import { clampSeconds, failure, pollUntil, videoResult } from './common.js'
import { errorBody, fetchWithTimeout, getWithRetry, joinUrl, postJson, readBounded, sniffImageMime } from '../util.js'

function googleHeaders(request: { apiKey: string; channel: { headers?: Record<string, string> } }): Record<string, string> {
  return { 'x-goog-api-key': request.apiKey, ...request.channel.headers }
}

/** `models/foo` / `foo` -> `foo`, so both forms work in config. */
function bareModel(model: string): string {
  return model.replace(/^models\//, '')
}

export async function generateGoogleImage(request: ImageRequest): Promise<GeneratedImage[]> {
  const base = (request.channel.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '')
  const model = bareModel((request.channel.imageModel ?? '').trim())
  if (model === '') throw new Error('Google 通道没有配置 imageModel')
  const parts: Array<Record<string, unknown>> = []
  for (const ref of request.refs) {
    parts.push({ inlineData: { mimeType: ref.mime, data: ref.data.toString('base64') } })
  }
  parts.push({ text: request.prompt })

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      candidateCount: request.n,
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        ...(request.aspectRatio === undefined || request.aspectRatio === '' ? {} : { aspectRatio: request.aspectRatio }),
      },
    },
  }
  const response = await postJson(joinUrl(base, `models/${encodeURIComponent(model)}:generateContent`), body, googleHeaders(request), 300_000, request.signal)
  if (!response.ok) throw await failure(response, 'Gemini 图像生成', request.apiKey)
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>
  }
  const images: GeneratedImage[] = []
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.thought === true) continue
      const inline = (part.inlineData ?? part.inline_data) as { data?: unknown; mimeType?: unknown; mime_type?: unknown } | undefined
      if (typeof inline?.data !== 'string' || inline.data === '') continue
      const data = Buffer.from(inline.data, 'base64')
      if (data.length === 0) continue
      if (data.length > request.maxBytes) throw new Error(`Gemini 返回的图片超过 ${String(request.maxBytes)} 字节`)
      const declared = typeof inline.mimeType === 'string' ? inline.mimeType : typeof inline.mime_type === 'string' ? inline.mime_type : undefined
      images.push({ data, mime: sniffImageMime(data) ?? declared ?? 'image/png' })
    }
  }
  if (images.length === 0) throw new Error('Gemini 没有返回图片：确认模型支持图像输出（gemini-*-image），且账号已开通该模型')
  return images
}

export async function generateGoogleVideo(request: VideoRequest): Promise<GeneratedVideo> {
  const base = (request.channel.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '')
  const model = bareModel((request.channel.videoModel ?? '').trim())
  if (model === '') throw new Error('Google 通道没有配置 videoModel')
  const instance: Record<string, unknown> = { prompt: request.prompt }
  const first = request.refs[0]
  if (first !== undefined) {
    instance.image = { bytesBase64Encoded: first.data.toString('base64'), mimeType: first.mime }
  }
  const body = {
    instances: [instance],
    parameters: {
      aspectRatio: request.aspectRatio === '' ? '16:9' : request.aspectRatio,
      durationSeconds: clampSeconds(request.seconds, 4, 8),
      personGeneration: 'allow_adult',
      ...request.channel.extraBody,
    },
  }
  const submitted = await postJson(joinUrl(base, `models/${encodeURIComponent(model)}:predictLongRunning`), body, googleHeaders(request), 120_000, request.signal)
  if (!submitted.ok) throw await failure(submitted, 'Veo 视频提交', request.apiKey)
  const operation = await submitted.json() as { name?: unknown }
  const name = typeof operation.name === 'string' ? operation.name : ''
  if (name === '') throw new Error('Veo 提交没有返回 operation name')
  request.onProgress?.('Veo 任务已提交，等待渲染')

  return pollUntil<GeneratedVideo>(async () => {
    const poll = await getWithRetry(joinUrl(base, name), googleHeaders(request), 60_000, request.signal)
    if (!poll.ok) throw new Error(`Veo 查询失败：HTTP ${String(poll.status)} ${await errorBody(poll, request.apiKey)}`)
    const payload = await poll.json() as {
      done?: boolean
      error?: { message?: string }
      response?: {
        generatedVideos?: Array<{ video?: { uri?: string } }>
        generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> }
        videos?: Array<{ uri?: string; gcsUri?: string }>
      }
    }
    if (payload.error !== undefined) throw new Error(payload.error.message ?? 'Veo 渲染失败')
    if (payload.done !== true) return { done: false, note: 'Veo 渲染中' }
    const response = payload.response ?? {}
    const uri = response.generatedVideos?.[0]?.video?.uri
      ?? response.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
      ?? response.videos?.[0]?.uri
      ?? response.videos?.[0]?.gcsUri
    if (typeof uri !== 'string' || uri === '') throw new Error('Veo 已完成但没有返回视频地址')
    const download = await fetchWithTimeout(uri, { headers: googleHeaders(request), signal: request.signal }, 300_000)
    if (!download.ok) throw new Error(`下载 Veo 视频失败：HTTP ${String(download.status)}`)
    const data = await readBounded(download, request.maxBytes)
    return { done: true, value: videoResult(data, download.headers.get('content-type')?.split(';')[0] ?? 'video/mp4', uri) }
  }, { deadlineMs: 40 * 60_000, intervalMs: 5000, signal: request.signal, onProgress: request.onProgress, label: 'Veo' })
}
