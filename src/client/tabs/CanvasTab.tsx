/**
 * 画布：局部重绘（inpaint）、定向扩图（outpaint）、标注改图（annotate）。
 *
 * - inpaint/outpaint：浏览器用 HTML5 canvas 合成「白遮罩」PNG，Ark 走原生
 *   mask（image+mask），其他通道走软遮罩参考图编辑。
 * - annotate：在图上画红色箭头 + 文字标注，导出带标注的截图交给模型，模型读
 *   箭头指向与标注文字，生成去掉标注痕迹的干净成品图（Cowart 式）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import type { AssetView, ChannelView } from '../types.js'
import { Icon } from '../icons.js'
import { Button, Empty, Field, Modal, Segmented, Spinner } from '../ui.js'

type Mode = 'inpaint' | 'outpaint' | 'annotate'
type Direction = 'left' | 'right' | 'top' | 'bottom' | 'all'
interface Region { x: number; y: number; w: number; h: number }
interface ArrowAnno { id: string; kind: 'arrow'; x0: number; y0: number; x1: number; y1: number }
interface LabelAnno { id: string; kind: 'label'; x: number; y: number; text: string }
type Annotation = ArrowAnno | LabelAnno

const MAX_W = 560
const MAX_H = 420
const ANNO_COLOR = '#ff3b30'
const DIRECTIONS: Array<{ value: Direction; label: string }> = [
  { value: 'left', label: '← 左' },
  { value: 'right', label: '→ 右' },
  { value: 'top', label: '↑ 上' },
  { value: 'bottom', label: '↓ 下' },
  { value: 'all', label: '↔ 四周' },
]

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

interface CanvasProps {
  channels: ChannelView[]
  notify: (text: string, tone?: 'info' | 'error' | 'ok') => void
  onProduced: () => void
}

export function CanvasTab({ channels, notify, onProduced }: CanvasProps): React.ReactElement {
  const imageChannels = channels.filter(channel => channel.capabilities.includes('image') && channel.kind !== 'comfyui')

  const [mode, setMode] = useState<Mode>('inpaint')
  const [source, setSource] = useState<AssetView | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [region, setRegion] = useState<Region | null>(null)
  const [direction, setDirection] = useState<Direction>('right')
  const [amount, setAmount] = useState(0.5)
  const [prompt, setPrompt] = useState('')
  const [channelId, setChannelId] = useState('')
  const [model, setModel] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AssetView | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerItems, setPickerItems] = useState<AssetView[]>([])

  // annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [annotateTool, setAnnotateTool] = useState<'arrow' | 'text'>('arrow')
  const [draftArrow, setDraftArrow] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [labelText, setLabelText] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const idRef = useRef(0)
  const uid = (): string => { idRef.current += 1; return `a${String(idRef.current)}` }

  const activeChannel = imageChannels.find(channel => channel.id === channelId)

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
    setResult(null)
    const image = new Image()
    image.onload = () => {
      imgRef.current = image
      setNatural({ w: image.naturalWidth, h: image.naturalHeight })
    }
    image.onerror = () => notify('图片载入失败', 'error')
    image.src = source.url
  }, [source, notify])

  const compositeDim = useCallback((): { w: number; h: number } => {
    if (natural === null) return { w: MAX_W, h: MAX_H }
    if (mode === 'outpaint') {
      const horizontal = direction === 'left' || direction === 'right' || direction === 'all'
      const vertical = direction === 'top' || direction === 'bottom' || direction === 'all'
      const dx = horizontal ? Math.round(natural.w * amount) : 0
      const dy = vertical ? Math.round(natural.h * amount) : 0
      return { w: natural.w + dx, h: natural.h + dy }
    }
    return { w: natural.w, h: natural.h }
  }, [natural, mode, direction, amount])

  const sourceOffset = useCallback((): { x: number; y: number } => {
    if (natural === null || mode !== 'outpaint') return { x: 0, y: 0 }
    const horizontal = direction === 'left' || direction === 'right' || direction === 'all'
    const vertical = direction === 'top' || direction === 'bottom' || direction === 'all'
    const dx = horizontal ? Math.round(natural.w * amount) : 0
    const dy = vertical ? Math.round(natural.h * amount) : 0
    return {
      x: direction === 'left' ? dx : direction === 'all' ? Math.round(dx / 2) : 0,
      y: direction === 'top' ? dy : direction === 'all' ? Math.round(dy / 2) : 0,
    }
  }, [natural, mode, direction, amount])

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
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, dw, dh)
    const off = sourceOffset()
    ctx.drawImage(image, off.x * scale, off.y * scale, natural.w * scale, natural.h * scale)
    if (mode === 'inpaint' && region !== null) {
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.fillRect(region.x * dw, region.y * dh, region.w * dw, region.h * dh)
      ctx.strokeStyle = '#7c5cff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(region.x * dw, region.y * dh, region.w * dw, region.h * dh)
    }
    if (mode === 'annotate') {
      const fontSize = Math.max(13, Math.round(dw / 42))
      const lineWidth = Math.max(2, dw / 260)
      for (const anno of annotations) {
        if (anno.kind === 'arrow') drawArrow(ctx, anno.x0 * dw, anno.y0 * dh, anno.x1 * dw, anno.y1 * dh, lineWidth)
        else drawLabel(ctx, anno.x * dw, anno.y * dh, anno.text, fontSize)
      }
      if (draftArrow !== null) drawArrow(ctx, draftArrow.x0 * dw, draftArrow.y0 * dh, draftArrow.x1 * dw, draftArrow.y1 * dh, lineWidth)
    }
  }, [natural, mode, region, annotations, draftArrow, compositeDim, sourceOffset])

  useEffect(() => { draw() }, [draw])

  // ── mouse interaction ─────────────────────────────────────────────────────
  const toNormalised = (event: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (canvas === null) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }

  const onMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (running || natural === null) return
    const p = toNormalised(event)
    if (mode === 'inpaint') {
      dragRef.current = p
      setRegion({ x: p.x, y: p.y, w: 0, h: 0 })
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
  const onMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (dragRef.current === null || running) return
    const p = toNormalised(event)
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
  const onMouseUp = (): void => {
    if (mode === 'annotate' && annotateTool === 'arrow' && draftArrow !== null) {
      const { x0, y0, x1, y1 } = draftArrow
      if (Math.hypot(x1 - x0, y1 - y0) > 0.015) {
        setAnnotations(current => [...current, { id: uid(), kind: 'arrow', x0, y0, x1, y1 }])
      }
      setDraftArrow(null)
    }
    dragRef.current = null
  }

  const removeAnnotation = (id: string): void => setAnnotations(current => current.filter(item => item.id !== id))
  const clearAnnotations = (): void => { setAnnotations([]); setDraftArrow(null) }

  // Cap the long side so the native-mask payload stays small and Ark accepts the size.
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

  // Bake annotations onto the source (full resolution, capped) for annotate mode.
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

  const run = async (): Promise<void> => {
    if (source === null) { notify('先选一张底图', 'error'); return }
    if (mode === 'inpaint' && (region === null || region.w < 0.004 || region.h < 0.004)) { notify('先在图上框选要改的区域', 'error'); return }
    if (mode !== 'annotate' && prompt.trim() === '') { notify('写一句要改/要扩展的内容', 'error'); return }
    if (mode === 'annotate' && annotations.length === 0 && prompt.trim() === '') { notify('画上箭头/文字标注，或写一句要求', 'error'); return }
    setRunning(true)
    setResult(null)
    try {
      const body: Record<string, unknown> = {
        mode,
        prompt: prompt.trim(),
        ...(channelId === '' ? {} : { channel: channelId }),
        ...(model === '' ? {} : { model }),
      }
      if (mode === 'annotate') {
        body.composite = buildAnnotated()
      } else {
        const { image, mask, composite } = buildPayload()
        body.image = image
        body.mask = mask
        body.composite = composite
        if (mode === 'inpaint') body.region = region
        else body.expand = { direction, amount }
      }
      const { job } = await api.canvasEdit(body)
      for (let i = 0; i < 120; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 2500))
        const current = await api.job(job.jobId)
        if (current.job.state === 'succeeded') {
          const asset = current.job.assets?.[0]
          if (asset !== undefined) { setResult(asset); notify('画布编辑完成', 'ok') }
          else notify('完成，但没有返回图片', 'error')
          onProduced()
          return
        }
        if (current.job.state === 'failed' || current.job.state === 'cancelled') {
          notify(current.job.error ?? '任务失败', 'error')
          onProduced()
          return
        }
      }
      notify('等待超时，稍后在「任务」里查看', 'error')
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
      notify('已导入底图', 'ok')
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const arrowCount = annotations.filter(item => item.kind === 'arrow').length
  const labelCount = annotations.filter(item => item.kind === 'label').length

  return (
    <div className="ms-canvas">
      <div className="ms-canvas-head">
        <div>
          <h3>画布编辑</h3>
          <p className="ms-hint">框选区域做局部重绘、向某方向扩图，或在图上画箭头/文字标注让模型按标注改图。</p>
        </div>
        <div className="ms-inline-actions">
          <Button size="sm" variant="soft" icon="grid" onClick={() => { void openPicker() }}>从素材库选</Button>
          <Button size="sm" variant="soft" icon="upload" onClick={() => fileRef.current?.click()}>上传图片</Button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => { const file = event.target.files?.[0]; if (file !== undefined) void onFile(file); event.target.value = '' }} />
        </div>
      </div>

      {source === null || natural === null ? (
        <Empty icon="image" title="还没有底图" hint="从素材库选一张，或上传本机图片，然后在这里框选 / 扩图 / 标注。" />
      ) : (
        <>
          <Segmented<Mode>
            value={mode}
            options={[
              { value: 'inpaint', label: '局部重绘', icon: 'crop' },
              { value: 'outpaint', label: '扩图', icon: 'expand' },
              { value: 'annotate', label: '标注改图', icon: 'paint' },
            ]}
            onChange={value => { setMode(value); setRegion(null); setDraftArrow(null) }}
          />

          {mode === 'annotate' ? (
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
              <input
                className="ms-input ms-anno-text"
                value={labelText}
                placeholder="标注文字（加文字时用）"
                onChange={event => setLabelText(event.target.value)}
              />
              <Button size="sm" variant="ghost" icon="trash" onClick={clearAnnotations}>清空标注</Button>
            </div>
          ) : null}

          <div className="ms-canvas-stage">
            <canvas
              ref={canvasRef}
              className={`ms-canvas-draw${mode === 'inpaint' || mode === 'annotate' ? ' croppable' : ''}`}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
            <div className="ms-canvas-stage-meta">
              {mode === 'inpaint'
                ? (region !== null && region.w >= 0.004
                    ? `选区：${Math.round(region.w * 100)}% × ${Math.round(region.h * 100)}%（拖动重画）`
                    : '在图上按住拖动，框出要改的区域')
                : mode === 'annotate'
                  ? `${arrowCount} 个箭头 · ${labelCount} 条标注${annotateTool === 'arrow' ? '（拖动画箭头）' : '（点图放置文字）'}`
                  : `原图 ${natural.w}×${natural.h} → ${compositeDim().w}×${compositeDim().h}`}
            </div>
          </div>

          {mode === 'inpaint' ? (
            <div className="ms-inline-actions">
              <Button size="sm" variant="ghost" icon="trash" onClick={() => setRegion(null)}>清除选区</Button>
            </div>
          ) : mode === 'outpaint' ? (
            <div className="ms-canvas-expand">
              <Field label="扩展方向">
                <div className="ms-inline-actions">
                  {DIRECTIONS.map(item => (
                    <Button key={item.value} size="sm" variant={direction === item.value ? 'primary' : 'soft'} onClick={() => setDirection(item.value)}>{item.label}</Button>
                  ))}
                </div>
              </Field>
              <Field label={`扩展比例：${Math.round(amount * 100)}%`} hint="向所选方向扩出原图该维度的一定比例">
                <input type="range" min={0.1} max={1} step={0.05} value={amount} onChange={event => setAmount(Number(event.target.value))} className="ms-range" />
              </Field>
            </div>
          ) : null}

          {mode === 'annotate' && labelCount > 0 ? (
            <div className="ms-anno-list">
              {annotations.map(item => item.kind === 'label' ? (
                <span key={item.id} className="ms-anno-chip">
                  <span>{item.text}</span>
                  <button type="button" onClick={() => removeAnnotation(item.id)} aria-label="删除"><Icon name="close" size={11} /></button>
                </span>
              ) : null)}
            </div>
          ) : null}

          <div className="ms-grid-2">
            <Field label="使用通道" hint="图像通道；留空用默认">
              <select className="ms-select" value={channelId} onChange={event => { setChannelId(event.target.value); setModel('') }}>
                <option value="">默认通道</option>
                {imageChannels.map(channel => <option key={channel.id} value={channel.id}>{channel.label}（{channel.kind}）</option>)}
              </select>
            </Field>
            <Field label="模型" hint="留空用通道默认模型">
              <select className="ms-select" value={model} onChange={event => setModel(event.target.value)}>
                <option value="">默认模型</option>
                {(activeChannel?.models?.image ?? []).map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
          </div>

          <Field
            label={mode === 'inpaint' ? '改什么' : mode === 'outpaint' ? '扩出的区域画什么' : '补充要求（可选）'}
            hint={mode === 'annotate' ? '标注本身已含要求；这里可补充整体要求' : mode === 'inpaint' ? '只描述选区里要变成的内容' : '只描述新增空白区域的内容'}
          >
            <input
              className="ms-input"
              value={prompt}
              placeholder={mode === 'inpaint' ? '例如：把猫换成一只戴红围巾的柴犬' : mode === 'outpaint' ? '例如：向右延伸的柏油路与晚霞天空' : '例如：整体保持油画质感'}
              onChange={event => setPrompt(event.target.value)}
            />
          </Field>

          <div className="ms-inline-actions">
            <Button variant="primary" icon="sparkles" disabled={running} onClick={() => { void run() }}>
              {running ? <><Spinner size={13} /> 生成中…</> : mode === 'annotate' ? '按标注修改' : '生成'}
            </Button>
            {result !== null ? (
              <Button variant="soft" icon="refresh" onClick={() => { setSource(result); notify('已把结果设为底图，可继续编辑', 'info') }}>把结果设为底图继续改</Button>
            ) : null}
          </div>
        </>
      )}

      {result === null ? null : (
        <div className="ms-canvas-result">
          <div className="ms-result-title">结果</div>
          <a href={result.downloadUrl} download>
            <img src={result.url} alt={result.name} />
          </a>
          <div className="ms-hint">点击图片下载原图。</div>
        </div>
      )}

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="选择底图" wide>
        {pickerItems.length === 0 ? (
          <Empty icon="image" title="素材库没有图片" hint="先到「创作」生成，或直接上传本机图片。" />
        ) : (
          <div className="ms-canvas-picker">
            {pickerItems.map(item => (
              <button key={item.id} type="button" className="ms-canvas-pick" onClick={() => { setSource(item); setPickerOpen(false) }}>
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
