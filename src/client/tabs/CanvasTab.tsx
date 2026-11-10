/**
 * 画布工作室：左侧历史、中间无限画布、右侧生成面板。
 *
 * - 文生图：prompt + 通道/模型/比例/分辨率/数量 → 直接生成。
 * - 图生图：局部重绘（框选 + 原生 mask）、扩图、标注改图（Cowart 式）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import type { AssetView, ChannelView } from '../types.js'
import { Icon } from '../icons.js'
import { Button, Empty, Field, Modal, Segmented, Spinner } from '../ui.js'

type PanelTab = 'text' | 'image'
type HistTab = 'recent' | 'favorite'
type EditMode = 'inpaint' | 'outpaint' | 'annotate'
interface Region { x: number; y: number; w: number; h: number }
interface ArrowAnno { id: string; kind: 'arrow'; x0: number; y0: number; x1: number; y1: number }
interface LabelAnno { id: string; kind: 'label'; x: number; y: number; text: string }
type Annotation = ArrowAnno | LabelAnno

const MAX_W = 640
const MAX_H = 520
const ANNO_COLOR = '#ff3b30'
const ASPECTS = ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'] as const

function drawArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, lineWidth: number): void {
  ctx.strokeStyle = ANNO_COLOR
  ctx.fillStyle = ANNO_COLOR
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  const angle = Math.atan2(y1 - y0, x1 - x0)
  const head = Math.max(8, lineWidth * 3.2)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - head * Math.cos(angle - Math.PI / 6), y1 - head * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(x1 - head * Math.cos(angle + Math.PI / 6), y1 - head * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, fontSize: number): void {
  ctx.font = `600 ${fontSize}px -apple-system, system-ui, "Segoe UI", sans-serif`
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = Math.max(3, fontSize / 5)
  ctx.strokeText(text, x, y)
  ctx.fillStyle = ANNO_COLOR
  ctx.fillText(text, x, y)
}

function sizeFor(aspect: string, resolution: string, natural?: { w: number; h: number } | null): string | undefined {
  if (aspect === 'auto') {
    if (natural === null || natural === undefined) return undefined
    const long = Math.max(natural.w, natural.h)
    const max = resolution === '4K' ? 4096 : resolution === '1K' ? 1024 : 2048
    if (long <= max) return `${natural.w}x${natural.h}`
    const s = max / long
    return `${Math.round(natural.w * s)}x${Math.round(natural.h * s)}`
  }
  const long = resolution === '4K' ? 4096 : resolution === '1K' ? 1024 : 2048
  const parts = aspect.split(':')
  const aw = Number(parts[0])
  const ah = Number(parts[1])
  if (!Number.isFinite(aw) || !Number.isFinite(ah) || aw <= 0 || ah <= 0) return undefined
  return aw >= ah ? `${long}x${Math.round((long * ah) / aw)}` : `${Math.round((long * aw) / ah)}x${long}`
}

function parseSize(s: string | undefined): { w: number; h: number } | null {
  if (s === undefined) return null
  const match = /^(\d+)x(\d+)$/.exec(s)
  if (match === null) return null
  const w = Number(match[1])
  const h = Number(match[2])
  return w > 0 && h > 0 ? { w, h } : null
}

/** Clamp the image offset so it stays reachable within the target board. */
function clampOffset(value: number, naturalDim: number, targetDim: number): number {
  const min = Math.min(0, targetDim - naturalDim)
  const max = Math.max(0, targetDim - naturalDim)
  return Math.min(max, Math.max(min, value))
}

interface CanvasProps {
  channels: ChannelView[]
  notify: (text: string, tone?: 'info' | 'error' | 'ok') => void
  onProduced: () => void
}

export function CanvasTab({ channels, notify, onProduced }: CanvasProps): React.ReactElement {
  const imageChannels = channels.filter(channel => channel.capabilities.includes('image') && channel.kind !== 'comfyui')
  const readyCount = imageChannels.filter(channel => channel.ready).length

  const [panelTab, setPanelTab] = useState<PanelTab>('text')
  const [histTab, setHistTab] = useState<HistTab>('recent')
  const [history, setHistory] = useState<AssetView[]>([])
  const [source, setSource] = useState<AssetView | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [mode, setMode] = useState<EditMode>('inpaint')
  const [region, setRegion] = useState<Region | null>(null)
  const [targetAspect, setTargetAspect] = useState('16:9')
  const [targetRes, setTargetRes] = useState('2K')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [imagePos, setImagePos] = useState<{ x: number; y: number } | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [annotateTool, setAnnotateTool] = useState<'arrow' | 'text'>('arrow')
  const [draftArrow, setDraftArrow] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [labelText, setLabelText] = useState('')
  const [prompt, setPrompt] = useState('')
  const [channelId, setChannelId] = useState('')
  const [model, setModel] = useState('')
  const [aspect, setAspect] = useState('auto')
  const [resolution, setResolution] = useState('2K')
  const [watermark, setWatermark] = useState('default')
  const [count, setCount] = useState(1)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AssetView | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerItems, setPickerItems] = useState<AssetView[]>([])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const outpaintDragRef = useRef<{ nx: number; ny: number; offX: number; offY: number } | null>(null)
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const cardSizeRef = useRef<{ w: number; h: number }>({ w: MAX_W, h: MAX_H })
  const fileRef = useRef<HTMLInputElement | null>(null)
  const idRef = useRef(0)
  const uid = (): string => { idRef.current += 1; return `a${String(idRef.current)}` }

  const activeChannel = imageChannels.find(channel => channel.id === channelId)

  const loadHistory = useCallback(async (): Promise<void> => {
    try {
      const listed = await api.library({ kind: 'image', limit: '48', ...(histTab === 'favorite' ? { favorite: '1' } : {}) })
      setHistory(listed.items)
    } catch {
      // history is decorative; keep the previous list
    }
  }, [histTab])

  useEffect(() => { void loadHistory() }, [loadHistory])

  // Load the source image into an HTMLImageElement and read its natural size.
  useEffect(() => {
    if (source === null) {
      imgRef.current = null
      setNatural(null)
      return
    }
    setRegion(null)
    setAnnotations([])
    setDraftArrow(null)
    setImagePos(null)
    const image = new Image()
    image.onload = () => {
      imgRef.current = image
      setNatural({ w: image.naturalWidth, h: image.naturalHeight })
    }
    image.onerror = () => notify('图片载入失败', 'error')
    image.src = source.url
  }, [source, notify])

  // Target board (底) size: custom W×H wins, else the aspect + resolution preset.
  const targetSize = useCallback((): { w: number; h: number } => {
    const cw = Number.parseInt(customW, 10)
    const ch = Number.parseInt(customH, 10)
    if (cw > 0 && ch > 0) return { w: cw, h: ch }
    const preset = parseSize(sizeFor(targetAspect, targetRes))
    if (preset !== null) return preset
    return natural === null ? { w: 1024, h: 1024 } : { w: natural.w, h: natural.h }
  }, [customW, customH, targetAspect, targetRes, natural])

  // Image offset inside the target board (pixels); null = centered.
  const imageOffset = useCallback((): { x: number; y: number } => {
    if (natural === null) return { x: 0, y: 0 }
    const t = targetSize()
    if (imagePos === null) return { x: Math.round((t.w - natural.w) / 2), y: Math.round((t.h - natural.h) / 2) }
    return { x: imagePos.x, y: imagePos.y }
  }, [natural, targetSize, imagePos])

  const compositeDim = useCallback((): { w: number; h: number } => {
    if (natural === null) return { w: MAX_W, h: MAX_H }
    if (mode === 'outpaint' && panelTab === 'image') return targetSize()
    return { w: natural.w, h: natural.h }
  }, [natural, mode, panelTab, targetSize])

  const sourceOffset = useCallback((): { x: number; y: number } => {
    if (natural === null || mode !== 'outpaint' || panelTab !== 'image') return { x: 0, y: 0 }
    return imageOffset()
  }, [natural, mode, panelTab, imageOffset])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const image = imgRef.current
    if (canvas === null || image === null || natural === null) return
    const { w: cw, h: ch } = compositeDim()
    const scale = Math.min(MAX_W / cw, MAX_H / ch)
    const dw = Math.max(1, Math.round(cw * scale))
    const dh = Math.max(1, Math.round(ch * scale))
    canvas.width = dw
    canvas.height = dh
    cardSizeRef.current = { w: dw, h: dh }
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    if (mode === 'outpaint' && panelTab === 'image') {
      // Board: white target canvas, purple tint over the to-be-filled area, image on top.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, dw, dh)
      ctx.fillStyle = 'rgba(124,92,255,0.10)'
      ctx.fillRect(0, 0, dw, dh)
      const off = imageOffset()
      ctx.drawImage(image, off.x * scale, off.y * scale, natural.w * scale, natural.h * scale)
      ctx.strokeStyle = '#7c5cff'
      ctx.lineWidth = 2
      ctx.setLineDash([7, 5])
      ctx.strokeRect(0, 0, dw, dh)
      ctx.setLineDash([])
      return
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, dw, dh)
    ctx.drawImage(image, 0, 0, dw, dh)
    if (mode === 'inpaint' && panelTab === 'image' && region !== null) {
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.fillRect(region.x * dw, region.y * dh, region.w * dw, region.h * dh)
      ctx.strokeStyle = '#7c5cff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(region.x * dw, region.y * dh, region.w * dw, region.h * dh)
    }
    if (mode === 'annotate' && panelTab === 'image') {
      const fontSize = Math.max(13, Math.round(dw / 42))
      const lineWidth = Math.max(2, dw / 260)
      for (const anno of annotations) {
        if (anno.kind === 'arrow') drawArrow(ctx, anno.x0 * dw, anno.y0 * dh, anno.x1 * dw, anno.y1 * dh, lineWidth)
        else drawLabel(ctx, anno.x * dw, anno.y * dh, anno.text, fontSize)
      }
      if (draftArrow !== null) drawArrow(ctx, draftArrow.x0 * dw, draftArrow.y0 * dh, draftArrow.x1 * dw, draftArrow.y1 * dh, lineWidth)
    }
  }, [natural, mode, region, annotations, draftArrow, compositeDim, sourceOffset, imageOffset, panelTab])

  useEffect(() => { draw() }, [draw])

  // Wheel zoom (non-passive so the page does not scroll while zooming the canvas).
  useEffect(() => {
    const element = viewportRef.current
    if (element === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const factor = event.deltaY > 0 ? 0.9 : 1.1
      setZoom(current => Math.max(0.1, Math.min(4, current * factor)))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  const fitView = (): void => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const card = cardSizeRef.current
    const factor = Math.min(viewport.clientWidth / card.w, viewport.clientHeight / card.h) * 0.88
    setZoom(Math.max(0.1, Math.min(4, factor)))
    setPan({ x: 0, y: 0 })
  }

  // ── mouse interaction on the image card ──────────────────────────────────
  const toNormalised = (event: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (canvas === null) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }

  const onCardMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (running || natural === null || panelTab !== 'image') return
    const p = toNormalised(event)
    if (mode === 'inpaint') {
      dragRef.current = p
      setRegion({ x: p.x, y: p.y, w: 0, h: 0 })
      return
    }
    if (mode === 'outpaint') {
      const off = imageOffset()
      outpaintDragRef.current = { nx: p.x, ny: p.y, offX: off.x, offY: off.y }
      return
    }
    if (mode === 'annotate') {
      if (annotateTool === 'arrow') {
        dragRef.current = p
        setDraftArrow({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
      } else {
        const text = labelText.trim()
        if (text === '') { notify('先在上方写标注文字，再点图上的位置', 'info'); return }
        setAnnotations(current => [...current, { id: uid(), kind: 'label', x: p.x, y: p.y, text }])
      }
    }
  }
  const onCardMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (running) return
    const p = toNormalised(event)
    if (mode === 'outpaint' && outpaintDragRef.current !== null) {
      const t = targetSize()
      const dx = (p.x - outpaintDragRef.current.nx) * t.w
      const dy = (p.y - outpaintDragRef.current.ny) * t.h
      setImagePos({
        x: Math.round(clampOffset(outpaintDragRef.current.offX + dx, natural!.w, t.w)),
        y: Math.round(clampOffset(outpaintDragRef.current.offY + dy, natural!.h, t.h)),
      })
      return
    }
    if (dragRef.current === null) return
    if (mode === 'inpaint') {
      const start = dragRef.current
      setRegion({
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      })
    } else if (mode === 'annotate' && annotateTool === 'arrow') {
      const start = dragRef.current
      setDraftArrow({ x0: start.x, y0: start.y, x1: p.x, y1: p.y })
    }
  }
  const onCardMouseUp = (): void => {
    if (mode === 'annotate' && annotateTool === 'arrow' && draftArrow !== null) {
      const { x0, y0, x1, y1 } = draftArrow
      if (Math.hypot(x1 - x0, y1 - y0) > 0.015) {
        setAnnotations(current => [...current, { id: uid(), kind: 'arrow', x0, y0, x1, y1 }])
      }
      setDraftArrow(null)
    }
    dragRef.current = null
    outpaintDragRef.current = null
  }

  // ── viewport pan ──────────────────────────────────────────────────────────
  const onViewportPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return
    panRef.current = { sx: event.clientX, sy: event.clientY, ox: pan.x, oy: pan.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onViewportPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const start = panRef.current
    if (start === null) return
    setPan({ x: start.ox + (event.clientX - start.sx), y: start.oy + (event.clientY - start.sy) })
  }
  const onViewportPointerUp = (): void => { panRef.current = null }

  // ── payload builders ──────────────────────────────────────────────────────
  const buildPayload = useCallback((): { image: string; mask: string; composite: string } => {
    const src = imgRef.current
    if (src === null || natural === null) throw new Error('还没有底图')
    const { w: cw, h: ch } = compositeDim()
    const scale = Math.min(1, 2048 / Math.max(cw, ch))
    const W = Math.max(1, Math.round(cw * scale))
    const H = Math.max(1, Math.round(ch * scale))
    const off = sourceOffset()
    const ox = Math.round(off.x * scale)
    const oy = Math.round(off.y * scale)
    const sw = Math.max(1, Math.round(natural.w * scale))
    const sh = Math.max(1, Math.round(natural.h * scale))
    const make = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (ctx === null) throw new Error('无法创建画布')
      return [canvas, ctx]
    }

    const [imageCanvas, imageCtx] = make()
    imageCtx.fillStyle = '#ffffff'
    imageCtx.fillRect(0, 0, W, H)
    imageCtx.drawImage(src, ox, oy, sw, sh)
    const image = imageCanvas.toDataURL('image/png')

    const [maskCanvas, maskCtx] = make()
    if (mode === 'inpaint' && region !== null && region.w > 0.004 && region.h > 0.004) {
      maskCtx.fillStyle = '#000000'
      maskCtx.fillRect(0, 0, W, H)
      maskCtx.fillStyle = '#ffffff'
      maskCtx.fillRect(region.x * W, region.y * H, region.w * W, region.h * H)
    } else {
      maskCtx.fillStyle = '#ffffff'
      maskCtx.fillRect(0, 0, W, H)
      maskCtx.fillStyle = '#000000'
      maskCtx.fillRect(ox, oy, sw, sh)
    }
    const mask = maskCanvas.toDataURL('image/png')

    const [compositeCanvas, compositeCtx] = make()
    compositeCtx.fillStyle = '#ffffff'
    compositeCtx.fillRect(0, 0, W, H)
    compositeCtx.drawImage(src, ox, oy, sw, sh)
    if (mode === 'inpaint' && region !== null && region.w > 0.004 && region.h > 0.004) {
      compositeCtx.fillStyle = '#ffffff'
      compositeCtx.fillRect(region.x * W, region.y * H, region.w * W, region.h * H)
    }
    const composite = compositeCanvas.toDataURL('image/png')

    return { image, mask, composite }
  }, [natural, mode, region, compositeDim, sourceOffset])

  const buildAnnotated = useCallback((): string => {
    const src = imgRef.current
    if (src === null || natural === null) throw new Error('还没有底图')
    const scale = Math.min(1, 2048 / Math.max(natural.w, natural.h))
    const W = Math.max(1, Math.round(natural.w * scale))
    const H = Math.max(1, Math.round(natural.h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('无法创建画布')
    ctx.drawImage(src, 0, 0, W, H)
    const fontSize = Math.max(24, Math.round(W / 40))
    const lineWidth = Math.max(4, W / 160)
    for (const anno of annotations) {
      if (anno.kind === 'arrow') drawArrow(ctx, anno.x0 * W, anno.y0 * H, anno.x1 * W, anno.y1 * H, lineWidth)
      else drawLabel(ctx, anno.x * W, anno.y * H, anno.text, fontSize)
    }
    return canvas.toDataURL('image/png')
  }, [natural, annotations])

  const pollJob = async (jobId: string): Promise<AssetView | null> => {
    for (let i = 0; i < 160; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 2500))
      const current = await api.job(jobId)
      if (current.job.state === 'succeeded') return current.job.assets?.[0] ?? null
      if (current.job.state === 'failed' || current.job.state === 'cancelled') {
        notify(current.job.error ?? '任务失败', 'error')
        return null
      }
    }
    notify('等待超时，稍后在「任务」里查看', 'error')
    return null
  }

  const generate = async (): Promise<void> => {
    if (running) return
    if (panelTab === 'image' && source === null) { notify('先选一张底图（左侧历史或上传）', 'error'); return }
    if (panelTab === 'image' && mode === 'inpaint' && (region === null || region.w < 0.004 || region.h < 0.004)) { notify('先在图上框选要改的区域', 'error'); return }
    if (panelTab === 'image' && mode !== 'annotate' && prompt.trim() === '') { notify('写一句要改/要扩展的内容', 'error'); return }
    if (panelTab === 'image' && mode === 'annotate' && annotations.length === 0 && prompt.trim() === '') { notify('画上箭头/文字标注，或写一句要求', 'error'); return }
    if (panelTab === 'text' && prompt.trim() === '') { notify('写一句画面描述', 'error'); return }
    setRunning(true)
    setResult(null)
    try {
      if (panelTab === 'text') {
        const { job } = await api.generateImage({
          prompt: prompt.trim(),
          ...(channelId === '' ? {} : { channel: channelId }),
          ...(model === '' ? {} : { model }),
          ...(aspect === 'auto' ? {} : { aspectRatio: aspect }),
          ...(sizeFor(aspect, resolution) === undefined ? {} : { size: sizeFor(aspect, resolution) }),
          n: count,
          ...(watermark === 'default' ? {} : { watermark: watermark === 'show' }),
        })
        const asset = await pollJob(job.jobId)
        if (asset !== null) {
          setResult(asset)
          setSource(asset)
          notify('已生成', 'ok')
          onProduced()
          void loadHistory()
        }
      } else {
        const body: Record<string, unknown> = {
          mode,
          prompt: prompt.trim(),
          ...(channelId === '' ? {} : { channel: channelId }),
          ...(model === '' ? {} : { model }),
          ...(watermark === 'default' ? {} : { watermark: watermark === 'show' }),
        }
        if (mode === 'annotate') {
          body.composite = buildAnnotated()
        } else {
          const { image, mask, composite } = buildPayload()
          body.image = image
          body.mask = mask
          body.composite = composite
          if (mode === 'inpaint') {
            body.region = region
          } else {
            // Derive a direction/ratio hint from where the image sits in the board.
            const t = targetSize()
            const off = imageOffset()
            const left = off.x > 0 ? off.x / t.w : 0
            const right = off.x + natural!.w < t.w ? (t.w - off.x - natural!.w) / t.w : 0
            const top = off.y > 0 ? off.y / t.h : 0
            const bottom = off.y + natural!.h < t.h ? (t.h - off.y - natural!.h) / t.h : 0
            const sides = [
              left > 0.01 ? 'left' : '',
              right > 0.01 ? 'right' : '',
              top > 0.01 ? 'top' : '',
              bottom > 0.01 ? 'bottom' : '',
            ].filter(item => item !== '')
            const hintAmount = Math.min(1, Math.max(left, right, top, bottom, 0.05))
            body.expand = { direction: sides.length === 1 ? sides[0] : 'all', amount: hintAmount }
          }
        }
        const { job } = await api.canvasEdit(body)
        const asset = await pollJob(job.jobId)
        if (asset !== null) {
          setResult(asset)
          setSource(asset)
          notify('画布编辑完成', 'ok')
          onProduced()
          void loadHistory()
        }
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setRunning(false)
    }
  }

  const openPicker = async (): Promise<void> => {
    try {
      const listed = await api.library({ kind: 'image', limit: '60' })
      setPickerItems(listed.items)
      setPickerOpen(true)
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const onFile = async (file: File): Promise<void> => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsDataURL(file)
      })
      const { asset } = await api.importDataUrl(dataUrl, file.name.replace(/\.[a-z0-9]+$/i, ''))
      setSource(asset)
      setPanelTab('image')
      notify('已导入底图', 'ok')
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const arrowCount = annotations.filter(item => item.kind === 'arrow').length
  const labelCount = annotations.filter(item => item.kind === 'label').length
  const showCard = source !== null && natural !== null

  return (
    <div className="ms-studio">
      {/* ── left history ─────────────────────────────────────────────── */}
      <aside className="ms-studio-left">
        <div className="ms-studio-left-head">
          <Segmented<HistTab>
            value={histTab}
            size="sm"
            options={[{ value: 'recent', label: '最新生成' }, { value: 'favorite', label: '收藏' }]}
            onChange={setHistTab}
          />
        </div>
        <div className="ms-studio-history">
          {history.length === 0 ? (
            <div className="ms-studio-history-empty">暂无生成历史</div>
          ) : history.map(item => (
            <button
              key={item.id}
              type="button"
              className={`ms-hist-item${source?.id === item.id ? ' on' : ''}`}
              title={item.name}
              onClick={() => { setSource(item); setPanelTab('image') }}
            >
              <img src={item.url} alt={item.name} loading="lazy" />
            </button>
          ))}
        </div>
      </aside>

      {/* ── center canvas ────────────────────────────────────────────── */}
      <main className="ms-studio-center">
        <div className="ms-studio-topbar">
          <span className="ms-studio-status"><span className={`ms-dot${readyCount > 0 ? ' on' : ''}`} /> API 已配置 · {readyCount}</span>
          <div className="ms-studio-tools">
            <span className="ms-studio-chip"><Icon name="layers" size={13} /> 无限画布</span>
            <button type="button" className="ms-studio-tool" onClick={fitView}>适应窗口</button>
            <div className="ms-zoom">
              <button type="button" onClick={() => setZoom(value => Math.max(0.1, value / 1.15))}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom(value => Math.min(4, value * 1.15))}>+</button>
            </div>
            <button type="button" className="ms-studio-tool" onClick={() => { void openPicker() }}>选图</button>
            <button type="button" className="ms-studio-tool" onClick={() => fileRef.current?.click()}>上传</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => { const file = event.target.files?.[0]; if (file !== undefined) void onFile(file); event.target.value = '' }} />
          </div>
        </div>

        <div
          className="ms-studio-viewport"
          ref={viewportRef}
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={onViewportPointerUp}
          onPointerLeave={onViewportPointerUp}
        >
          {!showCard ? (
            <div className="ms-studio-empty">
              <Icon name="image" size={34} />
              <div>从左侧选择一张图片，或在右侧开始新的生成。</div>
            </div>
          ) : (
            <div className="ms-studio-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <div className="ms-studio-card">
                <canvas
                  ref={canvasRef}
                  className={panelTab === 'image' ? 'croppable' : ''}
                  onMouseDown={onCardMouseDown}
                  onMouseMove={onCardMouseMove}
                  onMouseUp={onCardMouseUp}
                  onMouseLeave={onCardMouseUp}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── right generation panel ───────────────────────────────────── */}
      <aside className="ms-studio-right">
        <div className="ms-studio-panel-head">生成面板</div>
        <div className="ms-studio-panel-body">
          <Segmented<PanelTab>
            value={panelTab}
            options={[
              { value: 'text', label: '文生图', icon: 'sparkles' },
              { value: 'image', label: '图生图', icon: 'image' },
            ]}
            onChange={setPanelTab}
          />

          {panelTab === 'image' ? (
            <Segmented<EditMode>
              value={mode}
              size="sm"
              options={[
                { value: 'inpaint', label: '局部重绘', icon: 'crop' },
                { value: 'outpaint', label: '扩图', icon: 'expand' },
                { value: 'annotate', label: '标注改图', icon: 'paint' },
              ]}
              onChange={value => { setMode(value); setRegion(null); setDraftArrow(null); setImagePos(null) }}
            />
          ) : null}

          <Field
            label={panelTab === 'text' ? '提示词 Prompt *' : mode === 'inpaint' ? '改什么 *' : mode === 'outpaint' ? '扩出的区域画什么 *' : '补充要求（可选）'}
            hint={panelTab === 'image' ? (mode === 'annotate' ? '标注本身已含要求；这里可补充整体要求' : mode === 'inpaint' ? '只描述选区里要变成的内容' : '只描述新增空白区域的内容') : undefined}
          >
            <textarea
              className="ms-textarea ms-studio-prompt"
              rows={3}
              value={prompt}
              placeholder={panelTab === 'text' ? '描述主体、构图、风格、光线…' : mode === 'inpaint' ? '例如：把猫换成一只戴红围巾的柴犬' : mode === 'outpaint' ? '例如：向右延伸的柏油路与晚霞天空' : '例如：整体保持油画质感'}
              onChange={event => setPrompt(event.target.value)}
            />
          </Field>

          {panelTab === 'image' && mode === 'annotate' ? (
            <div className="ms-anno-bar">
              <Segmented<'arrow' | 'text'>
                value={annotateTool}
                size="sm"
                options={[
                  { value: 'arrow', label: '画箭头', icon: 'arrow' },
                  { value: 'text', label: '加文字', icon: 'type' },
                ]}
                onChange={setAnnotateTool}
              />
              <input className="ms-input ms-anno-text" value={labelText} placeholder="标注文字（加文字时用）" onChange={event => setLabelText(event.target.value)} />
              <Button size="sm" variant="ghost" icon="trash" onClick={() => { setAnnotations([]); setDraftArrow(null) }}>清空</Button>
            </div>
          ) : null}

          {panelTab === 'image' && mode === 'annotate' && labelCount > 0 ? (
            <div className="ms-anno-list">
              {annotations.map(item => item.kind === 'label' ? (
                <span key={item.id} className="ms-anno-chip">
                  <span>{item.text}</span>
                  <button type="button" onClick={() => setAnnotations(current => current.filter(entry => entry.id !== item.id))} aria-label="删除"><Icon name="close" size={11} /></button>
                </span>
              ) : null)}
            </div>
          ) : null}

          {panelTab === 'image' && mode === 'outpaint' ? (
            <div className="ms-canvas-expand">
              <Field label="目标画布尺寸（底）" hint={`当前底：${compositeDim().w}×${compositeDim().h}；在画布上拖动原图摆到任意位置，紫色区域就是扩图区`}>
                <div className="ms-inline-actions">
                  <select className="ms-select" value={targetAspect} onChange={event => { setTargetAspect(event.target.value); setImagePos(null) }}>
                    {['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9'].map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select className="ms-select" value={targetRes} onChange={event => { setTargetRes(event.target.value); setImagePos(null) }}>
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
              </Field>
              <Field label="自定义尺寸（覆盖预设）" hint="填宽 × 高，例如 2048×1536；留空用上面的预设">
                <div className="ms-inline-actions">
                  <input className="ms-input" value={customW} placeholder="宽" onChange={event => { setCustomW(event.target.value); setImagePos(null) }} />
                  <span className="ms-hint">×</span>
                  <input className="ms-input" value={customH} placeholder="高" onChange={event => { setCustomH(event.target.value); setImagePos(null) }} />
                </div>
              </Field>
              {imagePos !== null ? (
                <Button size="sm" variant="ghost" icon="refresh" onClick={() => setImagePos(null)}>回到居中</Button>
              ) : null}
            </div>
          ) : null}

          <div className="ms-grid-2">
            <Field label="Provider">
              <select className="ms-select" value={channelId} onChange={event => { setChannelId(event.target.value); setModel('') }}>
                <option value="">默认通道</option>
                {imageChannels.map(channel => <option key={channel.id} value={channel.id}>{channel.label}（{channel.kind}）</option>)}
              </select>
            </Field>
            <Field label="Model">
              <select className="ms-select" value={model} onChange={event => setModel(event.target.value)}>
                <option value="">默认模型</option>
                {(activeChannel?.models?.image ?? []).map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
          </div>

          <div className="ms-grid-2">
            <Field label="比例">
              <select className="ms-select" value={aspect} onChange={event => setAspect(event.target.value)}>
                {ASPECTS.map(item => <option key={item} value={item}>{item === 'auto' ? '自动' : item}</option>)}
              </select>
            </Field>
            <Field label="分辨率">
              <select className="ms-select" value={resolution} onChange={event => setResolution(event.target.value)}>
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </Field>
          </div>

          <div className="ms-grid-2">
            <Field label="可见水印" hint="方舟通道生效">
              <select className="ms-select" value={watermark} onChange={event => setWatermark(event.target.value)}>
                <option value="default">渠道默认</option>
                <option value="show">显示</option>
                <option value="hide">隐藏</option>
              </select>
            </Field>
            <Field label="生成数量">
              <select className="ms-select" value={count} onChange={event => setCount(Number(event.target.value))} disabled={panelTab === 'image'}>
                {[1, 2, 3, 4].map(item => <option key={item} value={item}>{item} 张</option>)}
              </select>
            </Field>
          </div>

          <Button variant="primary" icon="sparkles" disabled={running} onClick={() => { void generate() }}>
            {running ? <><Spinner size={13} /> 生成中…</> : panelTab === 'image' && mode === 'annotate' ? '按标注修改' : '开始生成'}
          </Button>

          {result !== null ? (
            <div className="ms-studio-result">
              <a href={result.downloadUrl} download><img src={result.url} alt={result.name} /></a>
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => { setSource(result); setPanelTab('image'); notify('已把结果设为底图，可继续编辑', 'info') }}>设为底图继续改</Button>
            </div>
          ) : null}

          {panelTab === 'image' && region !== null && mode === 'inpaint' ? (
            <Button size="sm" variant="ghost" icon="trash" onClick={() => setRegion(null)}>清除选区</Button>
          ) : null}
        </div>
      </aside>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="选择底图" wide>
        {pickerItems.length === 0 ? (
          <Empty icon="image" title="素材库没有图片" hint="先到「创作」生成，或直接上传本机图片。" />
        ) : (
          <div className="ms-canvas-picker">
            {pickerItems.map(item => (
              <button key={item.id} type="button" className="ms-canvas-pick" onClick={() => { setSource(item); setPanelTab('image'); setPickerOpen(false) }}>
                <img src={item.url} alt={item.name} loading="lazy" />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
