/**
 * Agent tools. Every tool returns JSON text; successful image jobs also attach
 * the generated files when the host exposes an attachment service, so the chat
 * can render them inline. File paths and library ids are always included, so
 * the result is still useful in a host without attachments.
 */
import fs from 'node:fs'
import path from 'node:path'

import type { AssetRecord, HostContext, JobRecord, ToolSpec } from './types.js'
import type { StudioService } from './studio.js'
import { capabilitiesOf, findChannel } from './config.js'

function text(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function jsonOutput(): ToolSpec['output'] {
  return {
    schema: { type: 'object', additionalProperties: true },
    render: (_args, value) => {
      const blocks: Array<Record<string, unknown>> = []
      const marker = '__attachments'
      let textValue: unknown = value
      if (value !== null && typeof value === 'object' && Array.isArray((value as Record<string, unknown>)[marker])) {
        // Destructure instead of `delete`: the host may hand us a frozen object,
        // and deleting a property from it throws in strict mode.
        const { [marker]: attachments, ...rest } = value as Record<string, unknown>
        for (const item of attachments as Array<Record<string, unknown>>) blocks.push(item)
        textValue = rest
      }
      let text = typeof textValue === 'string' ? textValue : JSON.stringify(textValue, null, 2)
      // Inline images in the chat are previews; add explicit Save-As links so a
      // click downloads the original instead of opening another preview.
      const links: string[] = []
      if (textValue !== null && typeof textValue === 'object') {
        const bag = textValue as Record<string, unknown>
        const list = Array.isArray(bag.assets) ? bag.assets : Array.isArray(bag.items) ? bag.items : []
        list.forEach((item, index) => {
          if (item === null || typeof item !== 'object') return
          const asset = item as Record<string, unknown>
          if (typeof asset.downloadUrl !== 'string') return
          links.push(`[下载${list.length > 1 ? ` ${String(index + 1)}` : ''}](${asset.downloadUrl})`)
        })
      }
      if (links.length > 0) text += `\n\n下载原图：${links.join(' · ')}`
      blocks.unshift({ type: 'text', text })
      return blocks
    },
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  if (typeof value === 'string' && value.trim() !== '') return value.split(',').map(item => item.trim()).filter(item => item !== '')
  return []
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function assetView(asset: AssetRecord): Record<string, unknown> {
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    path: asset.path,
    url: `/media-studio/api/asset/${asset.id}`,
    downloadUrl: `/media-studio/api/asset/${asset.id}?download=1`,
    bytes: asset.bytes,
    ...(asset.width === undefined ? {} : { width: asset.width }),
    ...(asset.height === undefined ? {} : { height: asset.height }),
    ...(asset.duration === undefined ? {} : { duration: asset.duration }),
    prompt: asset.prompt,
    channel: asset.channelId,
    model: asset.model,
    favorite: asset.favorite === true,
    tags: asset.tags ?? [],
    origin: asset.origin,
    createdAt: new Date(asset.createdAt).toISOString(),
  }
}

export function jobView(job: JobRecord): Record<string, unknown> {
  return {
    jobId: job.id,
    kind: job.kind,
    state: job.state,
    prompt: job.prompt,
    channel: job.channelId,
    model: job.model,
    progress: job.progress?.stage,
    ...(job.kind === 'comfy' && typeof job.params?.promptId === 'string' ? { promptId: job.params.promptId, canCollect: job.state === 'failed' } : {}),
    error: job.error,
    createdAt: new Date(job.createdAt).toISOString(),
    ...(job.finishedAt === undefined ? {} : { finishedAt: new Date(job.finishedAt).toISOString() }),
    assets: (job.assets ?? []).map(assetView),
    ...(job.shots === undefined ? {} : { shots: job.shots }),
    ...(job.state === 'running' || job.state === 'queued'
      ? { hint: `任务还在进行。用 media_job { action: "get", jobId: "${job.id}" } 查询，或 { action: "wait", jobId: "${job.id}" } 阻塞等待。` }
      : {}),
  }
}

export function buildTools(studio: StudioService, ctx: HostContext): ToolSpec[] {
  const waitFor = async (job: JobRecord, wait: boolean, timeoutMs: number): Promise<Record<string, unknown>> => {
    const settled = wait ? await studio.jobs.wait(job.id, timeoutMs) : job
    const view = jobView(settled)
    const attachments = await studio.attach(settled.assets ?? [])
    if (attachments.length > 0) view.__attachments = attachments
    return view
  }

  const channelsTool: ToolSpec = {
    name: 'media_channels',
    description: '列出媒体工作台的通道：id、名称、协议族、能力（image/video/workflow）、是否就绪、默认模型。生图/生视频前如果不确定用哪个通道，先调它。ComfyUI 的在线状态也在这里。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    output: jsonOutput(),
    async execute() {
      const channels = studio.channels().map(channel => ({
        id: channel.id,
        label: channel.label,
        kind: channel.kind,
        ready: channel.ready,
        capabilities: channel.capabilities,
        ...(channel.imageModel === undefined ? {} : { imageModel: channel.imageModel }),
        ...(channel.videoModel === undefined ? {} : { videoModel: channel.videoModel }),
        key: channel.keyHint,
      }))
      const comfy = await studio.comfyOnline()
      return {
        ok: true,
        channels,
        defaults: studio.getConfig().defaults,
        comfyui: {
          baseUrl: studio.getConfig().channels.find(item => item.kind === 'comfyui')?.baseUrl ?? '',
          online: comfy.online,
          ...(comfy.detail === undefined ? {} : { detail: comfy.detail }),
        },
        hint: channels.some(channel => channel.ready)
          ? 'ready=false 的通道缺少 API Key（面板 → 通道）。ComfyUI 需要先导入工作流，再用 media_comfy_run。'
          : '还没有可用通道：在面板「通道」里填一个 API Key，或把 ComfyUI 地址指到本机已启动的实例。',
      }
    },
  }

  const imageTool: ToolSpec = {
    name: 'media_generate_image',
    description:
      '生成图片（文生图 / 图生图），支持一次 1–10 张、最多 5 张参考图。异步：默认立即返回 jobId，之后用 media_job 查；wait=true 会等到出图（最长 5 分钟）。'
      + '通道可用 openai / google / dashscope / ark / xai / openai-compat，也可用 channel 指定面板里配置的任意通道。'
      + '图片会写进素材库并返回本地路径与预览 URL。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: '画面描述；写清主体、风格、构图、光线' },
        negative: { type: 'string', description: '负面提示词（部分通道支持）' },
        n: { type: 'integer', minimum: 1, maximum: 10, description: '张数，默认 1' },
        channel: { type: 'string', description: '通道 id 或名称；省略用默认图像通道' },
        model: { type: 'string', description: '模型 id；省略用通道默认模型' },
        size: { type: 'string', description: '像素尺寸，如 1024x1024；与 aspect_ratio 二选一' },
        aspect_ratio: { type: 'string', enum: ['1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '16:9', '9:16', '21:9'] },
        quality: { type: 'string', description: 'quality（OpenAI 通道：low/medium/high）' },
        refs: {
          oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }],
          description: '参考图：素材库 id、绝对路径，或工作区内的相对路径；最多 5 张',
        },
        wait: { type: 'boolean', description: 'true = 阻塞到出图（默认 false）' },
      },
    },
    output: jsonOutput(),
    async execute(args) {
      const job = studio.startImage({
        prompt: asString(args.prompt),
        channel: asString(args.channel) || undefined,
        model: asString(args.model) || undefined,
        negative: asString(args.negative) || undefined,
        size: asString(args.size) || undefined,
        aspectRatio: asString(args.aspect_ratio) || undefined,
        quality: asString(args.quality) || undefined,
        n: asInt(args.n, 1, 1, 10),
        refs: asStringArray(args.refs),
      })
      return waitFor(job, args.wait === true, 5 * 60_000)
    },
  }

  const videoTool: ToolSpec = {
    name: 'media_generate_video',
    description:
      '生成视频：文生视频、图生视频、首尾帧、多参考图。默认异步返回 jobId；云端渲染通常 1–10 分钟，用 media_job 查询。'
      + 'mode 省略时按参考图数量推断（0=text，1=image，2=keyframe）。输出为 mp4 并写入素材库。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: '镜头描述：主体动作、运镜、光线、时长内的变化' },
        mode: { type: 'string', enum: ['text', 'image', 'keyframe', 'reference'] },
        refs: {
          oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }],
          description: '参考图（0–5 张）：素材库 id 或本机路径。keyframe 模式顺序为首帧、尾帧',
        },
        seconds: { type: 'number', description: '时长（秒），默认 5；各通道会夹到自己的范围' },
        resolution: { type: 'string', description: '480P / 720P / 1080P，默认 720P' },
        aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] },
        channel: { type: 'string' },
        model: { type: 'string' },
        negative: { type: 'string' },
        wait: { type: 'boolean', description: 'true = 阻塞到渲染完成（最长 40 分钟）' },
      },
    },
    output: jsonOutput(),
    async execute(args) {
      const job = studio.startVideo({
        prompt: asString(args.prompt),
        channel: asString(args.channel) || undefined,
        model: asString(args.model) || undefined,
        negative: asString(args.negative) || undefined,
        mode: (asString(args.mode) || undefined) as 'text' | 'image' | 'keyframe' | 'reference' | undefined,
        refs: asStringArray(args.refs),
        seconds: typeof args.seconds === 'number' ? args.seconds : undefined,
        resolution: asString(args.resolution) || undefined,
        aspectRatio: asString(args.aspect_ratio) || undefined,
      })
      return waitFor(job, args.wait === true, studio.getConfig().videoTimeoutMs)
    },
  }

  const comfyListTool: ToolSpec = {
    name: 'media_comfy_workflows',
    description:
      '列出/查看本机导入的 ComfyUI 工作流（API 格式）。每项含 id、标题、备注、可填变量（prompt/negative/width/height/seed/…）、图片槽位与输出节点。'
      + 'action=inspect 传 workflowId 可看单个工作流的完整变量默认值。用户没指定工作流时先列出来挑。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['list', 'inspect'], description: '默认 list' },
        workflowId: { type: 'string', description: 'inspect 时要看的工作流 id' },
      },
    },
    output: jsonOutput(),
    async execute(args) {
      const action = asString(args.action, 'list')
      const listed = studio.comfyWorkflows()
      const online = await studio.comfyOnline()
      if (action === 'inspect') {
        const id = asString(args.workflowId)
        const found = listed.workflows.find(item => item.workflowId === id)
        if (found === undefined) throw new Error(`没有工作流 ${id}；先 action=list 看看有哪些`)
        return { ok: true, workflow: found, comfyui: { online: online.online } }
      }
      return {
        ok: true,
        count: listed.workflows.length,
        workflows: listed.workflows.map(item => ({
          workflowId: item.workflowId,
          title: item.title,
          description: item.description,
          enabled: item.enabled,
          variables: item.slots.map(slot => ({ name: slot.name, type: slot.type, required: slot.required, ...(slot.value === undefined ? {} : { default: slot.value }) })),
          outputs: item.outputs.map(output => output.kind),
        })),
        ...(listed.broken.length > 0 ? { broken: listed.broken } : {}),
        comfyui: { online: online.online, ...(online.detail === undefined ? {} : { detail: online.detail }) },
        ...(listed.workflows.length === 0
          ? { hint: '还没有工作流。在面板「ComfyUI」页签导入一份 API 格式 JSON（ComfyUI → Save (API Format)），或把文件放进 ~/.dsh-media-studio/workflows/' }
          : {}),
      }
    },
  }

  const comfyRunTool: ToolSpec = {
    name: 'media_comfy_run',
    description:
      '运行一个 ComfyUI 工作流。vars 里放变量（如 prompt、negative、width、height、seed）；images 传参考图，按工作流的图片槽位顺序或 {slot, path} 指定。'
      + '默认异步返回 jobId；wait=true 会等到产物落盘。工作流需要 ComfyUI 在线，离线时任务会直接失败而不是假装排队。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['workflowId'],
      properties: {
        workflowId: { type: 'string' },
        vars: { type: 'object', additionalProperties: true, description: '变量表；省略则用工作流里的默认值' },
        images: {
          oneOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'array', items: { type: 'object', additionalProperties: true, required: ['path'], properties: { slot: { type: 'string' }, path: { type: 'string' } } } },
            { type: 'string' },
          ],
          description: '参考图（素材库 id 或路径），可写 "6.image" 之外的槽位名',
        },
        overrides: { type: 'object', additionalProperties: true, description: '高级：{"节点id.输入名": 值}，直接改节点参数' },
        wait: { type: 'boolean' },
      },
    },
    output: jsonOutput(),
    async execute(args) {
      const imagesRaw = args.images
      const images: Array<string | { slot?: string; path: string }> = []
      if (Array.isArray(imagesRaw)) {
        for (const item of imagesRaw) {
          if (typeof item === 'string') { images.push(item); continue }
          if (item !== null && typeof item === 'object' && typeof (item as { path?: unknown }).path === 'string') {
            const slot = (item as { slot?: unknown }).slot
            images.push({ path: (item as { path: string }).path, ...(typeof slot === 'string' ? { slot } : {}) })
          }
        }
      } else {
        images.push(...asStringArray(imagesRaw))
      }
      const job = studio.startComfy({
        workflowId: asString(args.workflowId),
        vars: asRecord(args.vars),
        overrides: asRecord(args.overrides),
        images,
      })
      return waitFor(job, args.wait === true, studio.getConfig().comfyTimeoutMs)
    },
  }

  const jobTool: ToolSpec = {
    name: 'media_job',
    description: '查询/等待/取消媒体任务。action=list 列出最近任务；get 查单个；wait 阻塞到完成；cancel 取消（云端渲染可能仍在计费）；collect 对超时的 ComfyUI 任务重新取回产物。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'wait', 'cancel', 'collect'], description: '默认 list' },
        jobId: { type: 'string' },
        state: { type: 'string', enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'] },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
        timeoutMs: { type: 'integer', minimum: 1000, maximum: 2400000, description: 'wait 的上限，默认 120000' },
      },
    },
    output: jsonOutput(),
    async execute(args) {
      const action = asString(args.action, 'list')
      const jobId = asString(args.jobId)
      if (action === 'list') {
        const jobs = studio.jobs.list({ state: asString(args.state) || undefined, limit: asInt(args.limit, 10, 1, 50) })
        return { ok: true, count: jobs.length, jobs: jobs.map(jobView) }
      }
      if (jobId === '') throw new Error(`${action} 需要 jobId`)
      if (action === 'cancel') {
        const ok = studio.jobs.cancel(jobId)
        return { ok, jobId, state: studio.jobs.stateOf(jobId), hint: '已在本机取消；云端任务未必真的停止计费。' }
      }
      if (action === 'collect') {
        const job = await studio.collectComfyJob(jobId)
        const view = jobView(job)
        const attachments = await studio.attach(job.assets ?? [])
        if (attachments.length > 0) view.__attachments = attachments
        return view
      }
      if (action === 'wait') {
        const job = await studio.jobs.wait(jobId, asInt(args.timeoutMs, 120_000, 1000, 2_400_000))
        const view = jobView(job)
        const attachments = await studio.attach(job.assets ?? [])
        if (attachments.length > 0) view.__attachments = attachments
        return view
      }
      const job = studio.jobs.get(jobId)
      if (job === undefined) throw new Error(`没有任务 ${jobId}`)
      const view = jobView(job)
      const attachments = await studio.attach(job.assets ?? [])
      if (attachments.length > 0) view.__attachments = attachments
      return view
    },
  }

  const libraryTool: ToolSpec = {
    name: 'media_library',
    description:
      '素材库：搜索/浏览已生成的图片与视频、查看详情、收藏、删除、把本机文件登记进来。'
      + '返回条目含 id、本地 path、预览 url 与生成参数；把 id 传给 media_generate_image 的 refs 即可当参考图继续编辑。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'import', 'favorite', 'delete', 'stats'], description: '默认 list' },
        query: { type: 'string', description: '按提示词/文件名/模型/标签搜索' },
        kind: { type: 'string', enum: ['image', 'video', 'audio', 'all'] },
        favorite: { type: 'boolean' },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
        offset: { type: 'integer', minimum: 0 },
        id: { type: 'string' },
        path: { type: 'string', description: 'import 时的本机路径' },
      },
    },
    output: jsonOutput(),
    async execute(args) {
      const action = asString(args.action, 'list')
      if (action === 'stats') return { ok: true, ...studio.libraryStats() }
      if (action === 'import') {
        const file = asString(args.path)
        if (file === '') throw new Error('import 需要 path')
        const asset = studio.importAsset(file)
        return { ok: true, asset: assetView(asset) }
      }
      if (action === 'get') {
        const id = asString(args.id)
        const asset = studio.getLibrary().get(id)
        if (asset === undefined) throw new Error(`没有素材 ${id}`)
        return { ok: true, asset: assetView(asset) }
      }
      if (action === 'favorite') {
        const id = asString(args.id)
        const asset = studio.getLibrary().setFavorite(id, args.favorite !== false)
        if (asset === undefined) throw new Error(`没有素材 ${id}`)
        return { ok: true, asset: assetView(asset) }
      }
      if (action === 'delete') {
        const id = asString(args.id)
        const ok = studio.getLibrary().remove(id, { deleteFile: true })
        return { ok, id }
      }
      const listed = studio.getLibrary().list({
        query: asString(args.query) || undefined,
        kind: asString(args.kind) || undefined,
        favorite: args.favorite === true ? true : undefined,
        limit: asInt(args.limit, 40, 1, 200),
        offset: asInt(args.offset, 0, 0, 100000),
      })
      return { ok: true, total: listed.total, count: listed.items.length, items: listed.items.map(assetView) }
    },
  }

  const storyboardTool: ToolSpec = {
    name: 'media_storyboard',
    description:
      '一句话拆成分镜并批量生成视频：每镜一条 prompt，按顺序渲染；chain=true 时取上一镜尾帧作为下一镜首帧（需要 ffmpeg，画面更连贯）；'
      + 'concat=true 时自动用本机 ffmpeg 拼成一条成片。默认异步，先返回 jobId，镜头状态可在 media_job 里看。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['shots'],
      properties: {
        shots: {
          type: 'array',
          minItems: 1,
          maxItems: 12,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['prompt'],
            properties: {
              prompt: { type: 'string' },
              seconds: { type: 'number' },
              ref: { type: 'string', description: '该镜的参考图（素材库 id 或路径）' },
            },
          },
        },
        style: { type: 'string', description: '统一风格前缀，会拼到每镜 prompt 前面' },
        chain: { type: 'boolean', description: '接上一镜尾帧（默认 false）' },
        concat: { type: 'boolean', description: '自动拼接成片（默认 true）' },
        seconds: { type: 'number', description: '每镜默认时长' },
        resolution: { type: 'string' },
        aspect_ratio: { type: 'string' },
        channel: { type: 'string' },
        model: { type: 'string' },
        wait: { type: 'boolean' },
      },
    },
    output: jsonOutput(),
    async execute(args) {
      const raw = Array.isArray(args.shots) ? args.shots : []
      const shots = raw.flatMap(item => {
        if (item === null || typeof item !== 'object') return []
        const shot = item as Record<string, unknown>
        const prompt = asString(shot.prompt)
        if (prompt.trim() === '') return []
        return [{
          prompt,
          ...(typeof shot.seconds === 'number' ? { seconds: shot.seconds } : {}),
          ...(typeof shot.ref === 'string' && shot.ref !== '' ? { ref: shot.ref } : {}),
        }]
      })
      const job = studio.startStoryboard({
        shots,
        style: asString(args.style) || undefined,
        chain: args.chain === true,
        concat: args.concat !== false,
        seconds: typeof args.seconds === 'number' ? args.seconds : undefined,
        resolution: asString(args.resolution) || undefined,
        aspectRatio: asString(args.aspect_ratio) || undefined,
        channel: asString(args.channel) || undefined,
        model: asString(args.model) || undefined,
      })
      return waitFor(job, args.wait === true, studio.getConfig().videoTimeoutMs)
    },
  }

  const concatTool: ToolSpec = {
    name: 'media_concat',
    description: '用本机 ffmpeg 把两段以上视频拼成一条 MP4（统一尺寸/帧率后拼接，无音轨）。传素材库 id 或本机路径。不消耗任何模型额度。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['inputs'],
      properties: {
        inputs: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }], description: '两段以上视频：素材库 id 或路径' },
        size: { type: 'string', description: '输出尺寸，如 1280x720；省略沿用第一段的尺寸（长边上限 1920）' },
        wait: { type: 'boolean' },
      },
    },
    output: jsonOutput(),
    async execute(args) {
      const inputs = asStringArray(args.inputs).map(id => {
        const asset = studio.getLibrary().get(id)
        return asset?.kind === 'video' ? asset.id : id
      })
      if (inputs.length < 2) throw new Error('至少需要两段视频')
      const job = studio.startConcat({ ids: inputs, ...(asString(args.size) === '' ? {} : { size: asString(args.size) }) })
      return waitFor(job, args.wait !== false, 10 * 60_000)
    },
  }

  return [channelsTool, imageTool, videoTool, comfyListTool, comfyRunTool, jobTool, libraryTool, storyboardTool, concatTool]
}

/** Recursively drop `undefined` and turn non-finite numbers into null. */
export function sanitizeToolValue(value: unknown): unknown {
  if (value === null) return null
  if (value === undefined) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) {
    return value.map(item => {
      const clean = sanitizeToolValue(item)
      return clean === undefined ? null : clean
    })
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const clean = sanitizeToolValue(item)
      if (clean !== undefined) out[key] = clean
    }
    return out
  }
  return value
}

function sanitizeTool(spec: ToolSpec): ToolSpec {
  // The host validates tool results as lossless JSON: an `undefined` property
  // (e.g. `detail` when an upstream is online) makes the whole call fail with
  // "value is not lossless JSON". Normalise every result once, here.
  // `__attachments` holds host attachment refs — they are re-attached verbatim
  // instead of being walked (they are not ours to reshape).
  return {
    ...spec,
    execute: async (args, exec) => {
      const value = await spec.execute(args, exec)
      if (value !== null && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).__attachments)) {
        const { __attachments, ...rest } = value as Record<string, unknown>
        const clean = sanitizeToolValue(rest)
        if (clean !== null && typeof clean === 'object') (clean as Record<string, unknown>).__attachments = __attachments
        return clean
      }
      return sanitizeToolValue(value)
    },
  }
}

/** Register with the host `tools` service; failures are reported per tool. */
export function registerTools(studio: StudioService, ctx: HostContext, tools: { register: (spec: unknown) => (() => void) | void }): { registered: string[]; failed: Array<{ name: string; message: string }> } {
  const registered: string[] = []
  const failed: Array<{ name: string; message: string }> = []
  for (const spec of buildTools(studio, ctx)) {
    try {
      tools.register(sanitizeTool(spec))
      registered.push(spec.name)
    } catch (error) {
      failed.push({ name: spec.name, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { registered, failed }
}

/** Small helper kept for the routes: materialise a file path from an id. */
export function fileOf(studio: StudioService, id: string): string | undefined {
  const asset = studio.getLibrary().get(id)
  if (asset !== undefined && fs.existsSync(asset.path)) return asset.path
  if (path.isAbsolute(id) && fs.existsSync(id)) return id
  return undefined
}
