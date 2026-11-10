/**
 * 画布：局部重绘（inpaint）与定向扩图（outpaint）。
 *
 * 浏览器用 HTML5 canvas 直接把“要重绘的区域”或“扩出的空白”涂成白色，合成一张
 * 带软遮罩的 PNG 交给宿主，再走普通参考图编辑通道。这样无需各家支持原生 mask。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import type { AssetView, ChannelView } from '../types.js'
import { Icon } from '../icons.js'
import { Button, Empty, Field, Modal, Segmented, Spinner } from '../ui.js'

type Mode = 'inpaint' | 'outpaint'
type Direction = 'left' | 'right' | 'top' | 'bottom' | 'all'
interface Region { x: number; y: number; w: number; h: number }

const MAX_W = 560
const MAX_H = 420
const DIRECTIONS: Array<{ value: Direction; label: string }> = [
  { value: 'left', label: '← 左' },
  { value: 'right', label: '→ 右' },
  { value: 'top', label: '↑ 上' },
  { value: 'bottom', label: '↓ 下' },
  { value: 'all', label: '↔ 四周' },
]

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const activeChannel = imageChannels.find(channel => channel.id === channelId)

  // Load the source image into an HTMLImageElement and read its natural size.
  useEffect(() => {
    if (source === null) {
      imgRef.current = null
      setNatural(null)
      return
    }
    setRegion(null)
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
  }, [natural, mode, region, compositeDim, sourceOffset])

  useEffect(() => { draw() }, [draw])

  // ── mouse region drawing (inpaint) ────────────────────────────────────────
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
    if (mode !== 'inpaint' || running || natural === null) return
    const p = toNormalised(event)
    dragRef.current = p
    setRegion({ x: p.x, y: p.y, w: 0, h: 0 })
  }
  const onMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (dragRef.current === null || mode !== 'inpaint' || running) return
    const p = toNormalised(event)
    const start = dragRef.current
    setRegion({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    })
  }
  const onMouseUp = (): void => { dragRef.current = null }

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

    // image: source (inpaint) or padded source (outpaint)
    const [imageCanvas, imageCtx] = make()
    imageCtx.fillStyle = '#ffffff'
    imageCtx.fillRect(0, 0, W, H)
    imageCtx.drawImage(src, ox, oy, sw, sh)
    const image = imageCanvas.toDataURL('image/png')

    // mask: black keep + white regenerate
    const [maskCanvas, maskCtx] = make()
    if (mode === 'inpaint' && region !== null && region.w > 0.004 && region.h > 0.004) {
      maskCtx.fillStyle = '#000000'
      maskCtx.fillRect(0, 0, W, H)
      maskCtx.fillStyle = '#ffffff'
      maskCtx.fillRect(region.x * W, region.y * H, region.w * W, region.h * H)
    } else {
      // outpaint: white everywhere, black over the kept source rect
      maskCtx.fillStyle = '#ffffff'
      maskCtx.fillRect(0, 0, W, H)
      maskCtx.fillStyle = '#000000'
      maskCtx.fillRect(ox, oy, sw, sh)
    }
    const mask = maskCanvas.toDataURL('image/png')

    // composite: soft-mask fallback (white baked into the region / padding)
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

  const run = async (): Promise<void> => {
    if (source === null) { notify('先选一张底图', 'error'); return }
    if (prompt.trim() === '') { notify('写一句要改/要扩展的内容', 'error'); return }
    if (mode === 'inpaint' && (region === null || region.w < 0.004 || region.h < 0.004)) { notify('先在图上框选要改的区域', 'error'); return }
    setRunning(true)
    setResult(null)
    try {
      const { image, mask, composite } = buildPayload()
      const { job } = await api.canvasEdit({
        mode,
        prompt: prompt.trim(),
        image,
        mask,
        composite,
        ...(mode === 'inpaint' ? { region } : { expand: { direction, amount } }),
        ...(channelId === '' ? {} : { channel: channelId }),
        ...(model === '' ? {} : { model }),
      })
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

  const clearRegion = (): void => setRegion(null)

  return (
    <div className="ms-canvas">
      <div className="ms-canvas-head">
        <div>
          <h3>画布编辑</h3>
          <p className="ms-hint">选一张底图，框选区域做局部重绘（改元素 / 指定位置改图），或向某个方向扩图。</p>
        </div>
        <div className="ms-inline-actions">
          <Button size="sm" variant="soft" icon="grid" onClick={() => { void openPicker() }}>从素材库选</Button>
          <Button size="sm" variant="soft" icon="upload" onClick={() => fileRef.current?.click()}>上传图片</Button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => { const file = event.target.files?.[0]; if (file !== undefined) void onFile(file); event.target.value = '' }} />
        </div>
      </div>

      {source === null || natural === null ? (
        <Empty icon="image" title="还没有底图" hint="从素材库选一张，或上传本机图片，然后在这里框选 / 扩图。" />
      ) : (
        <>
          <Segmented<Mode>
            value={mode}
            options={[
              { value: 'inpaint', label: '局部重绘', icon: 'crop' },
              { value: 'outpaint', label: '扩图', icon: 'expand' },
            ]}
            onChange={value => { setMode(value); setRegion(null) }}
          />

          <div className="ms-canvas-stage">
            <canvas
              ref={canvasRef}
              className={`ms-canvas-draw${mode === 'inpaint' ? ' croppable' : ''}`}
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
                : `原图 ${natural.w}×${natural.h} → ${compositeDim().w}×${compositeDim().h}`}
            </div>
          </div>

          {mode === 'inpaint' ? (
            <div className="ms-inline-actions">
              <Button size="sm" variant="ghost" icon="trash" onClick={clearRegion}>清除选区</Button>
            </div>
          ) : (
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
          )}

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

          <Field label={mode === 'inpaint' ? '改什么' : '扩出的区域画什么'} hint={mode === 'inpaint' ? '只描述选区里要变成的内容' : '只描述新增空白区域的内容'}>
            <input className="ms-input" value={prompt} placeholder={mode === 'inpaint' ? '例如：把猫换成一只戴红围巾的柴犬' : '例如：向右延伸的柏油路与晚霞天空'} onChange={event => setPrompt(event.target.value)} />
          </Field>

          <div className="ms-inline-actions">
            <Button variant="primary" icon="sparkles" disabled={running} onClick={() => { void run() }}>
              {running ? <><Spinner size={13} /> 生成中…</> : '生成'}
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
