/** 创作页：图像 / 视频 / 分镜，一个表单 + 结果区。 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api.js'
import type { AssetView, ChannelView, ConfigView, JobView } from '../types.js'
import { AssetThumb, JobCard } from '../components.js'
import { Icon } from '../icons.js'
import { Button, Field, Segmented, Spinner, Tag } from '../ui.js'
import { ComfyPanel } from './ComfyPanel.js'

type Mode = 'image' | 'video' | 'storyboard' | 'comfy'

interface RefItem {
  key: string
  name: string
  url: string
  id?: string
  path?: string
  uploading?: boolean
}

interface ShotItem {
  id: string
  prompt: string
  seconds: string
  ref?: RefItem
}

interface CreateProps {
  channels: ChannelView[]
  config: ConfigView
  useRefAsset: { asset: AssetView; nonce: number } | null
  onConsumeRef: () => void
  notify: (text: string, tone?: 'info' | 'error' | 'ok') => void
  onProduced: () => void
  onOpenJobs: () => void
}

const RATIOS = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9']
const SIZES = ['1024x1024', '1536x1024', '1024x1536', '1280x960', '960x1280', '1536x864', '864x1536']

function newKey(): string {
  return Math.random().toString(36).slice(2, 9)
}

function fromAsset(asset: AssetView): RefItem {
  return { key: newKey(), name: asset.name, url: asset.url, id: asset.id, path: asset.path }
}

export function CreateTab(props: CreateProps): React.ReactElement {
  const [mode, setMode] = useState<Mode>('image')
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')
  const [channelId, setChannelId] = useState('')
  const [model, setModel] = useState('')
  const [count, setCount] = useState(1)
  const [size, setSize] = useState('')
  const [aspect, setAspect] = useState('1:1')
  const [quality, setQuality] = useState('')
  const [refs, setRefs] = useState<RefItem[]>([])
  const [videoMode, setVideoMode] = useState<'text' | 'image' | 'keyframe' | 'reference'>('text')
  const [seconds, setSeconds] = useState('5')
  const [resolution, setResolution] = useState('720P')
  const [videoAspect, setVideoAspect] = useState('16:9')
  const [shots, setShots] = useState<ShotItem[]>([{ id: newKey(), prompt: '', seconds: '5' }])
  const [style, setStyle] = useState('')
  const [chain, setChain] = useState(true)
  const [concat, setConcat] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [job, setJob] = useState<JobView | null>(null)
  const [recent, setRecent] = useState<AssetView[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerKind, setPickerKind] = useState<'image' | 'video'>('image')
  const [pickerTarget, setPickerTarget] = useState<{ kind: 'refs' } | { kind: 'shot'; id: string } | null>({ kind: 'refs' })
  const [libraryItems, setLibraryItems] = useState<AssetView[]>([])
  const fileInput = useRef<HTMLInputElement | null>(null)
  const pollRef = useRef<number | undefined>(undefined)

  const imageChannels = useMemo(() => props.channels.filter(item => item.capabilities.includes('image') && item.kind !== 'comfyui'), [props.channels])
  const videoChannels = useMemo(() => props.channels.filter(item => item.capabilities.includes('video') && item.kind !== 'comfyui'), [props.channels])
  const comfyChannel = useMemo(() => props.channels.find(item => item.kind === 'comfyui'), [props.channels])
  const pickChannel = (value: string): void => {
    if (value === '__comfyui__') {
      setMode('comfy')
      return
    }
    setChannelId(value)
  }
  const pool = mode === 'image' ? imageChannels : videoChannels
  const channel = pool.find(item => item.id === channelId) ?? pool.find(item => item.ready) ?? pool[0]

  useEffect(() => {
    if (channel === undefined) return
    if (channel.id !== channelId) setChannelId(channel.id)
    setModel(mode === 'image' ? channel.imageModel ?? channel.models?.image?.[0] ?? '' : channel.videoModel ?? channel.models?.video?.[0] ?? '')
  }, [channel, channelId, mode])

  useEffect(() => {
    if (props.useRefAsset === null) return
    setRefs(current => [...current, fromAsset(props.useRefAsset!.asset)].slice(0, 5))
    setMode(current => current === 'video' ? 'video' : 'image')
    props.onConsumeRef()
  }, [props.useRefAsset, props.onConsumeRef])

  const loadRecent = useCallback(async () => {
    try {
      const result = await api.library({ limit: '8' })
      setRecent(result.items)
    } catch {
      // recent strip is optional
    }
  }, [])

  useEffect(() => { void loadRecent() }, [loadRecent])

  useEffect(() => () => {
    if (pollRef.current !== undefined) window.clearInterval(pollRef.current)
  }, [])

  const watchJob = useCallback((initial: JobView) => {
    setJob(initial)
    if (pollRef.current !== undefined) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      try {
        const result = await api.job(initial.jobId)
        setJob(result.job)
        if (result.job.state !== 'running' && result.job.state !== 'queued') {
          if (pollRef.current !== undefined) window.clearInterval(pollRef.current)
          if (result.job.state === 'succeeded') {
            props.onProduced()
            void loadRecent()
          }
        }
      } catch (error) {
        props.notify(error instanceof Error ? error.message : String(error), 'error')
        if (pollRef.current !== undefined) window.clearInterval(pollRef.current)
      }
    }, 1800)
  }, [props, loadRecent])

  const addFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return
    for (const file of files.slice(0, 5 - refs.length)) {
      const key = newKey()
      const localUrl = URL.createObjectURL(file)
      setRefs(current => [...current, { key, name: file.name, url: localUrl, uploading: true }].slice(0, 5))
      try {
        const dataUrl = await readAsDataUrl(file)
        const result = await api.importDataUrl(dataUrl, file.name)
        setRefs(current => current.map(item => item.key === key ? { ...fromAsset(result.asset) } : item))
      } catch (error) {
        setRefs(current => current.filter(item => item.key !== key))
        props.notify(error instanceof Error ? error.message : String(error), 'error')
      }
    }
  }

  const openPicker = async (target: { kind: 'refs' } | { kind: 'shot'; id: string }, kind: 'image' | 'video'): Promise<void> => {
    setPickerTarget(target)
    setPickerKind(kind)
    setPickerOpen(true)
    try {
      const result = await api.library({ kind, limit: '60' })
      setLibraryItems(result.items)
    } catch (error) {
      props.notify(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const pickAsset = (asset: AssetView): void => {
    const ref = fromAsset(asset)
    if (pickerTarget?.kind === 'shot') {
      setShots(current => current.map(shot => shot.id === pickerTarget.id ? { ...shot, ref } : shot))
    } else {
      setRefs(current => [...current, ref].slice(0, 5))
    }
    setPickerOpen(false)
  }

  const submit = async (): Promise<void> => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (mode === 'image') {
        if (prompt.trim() === '') throw new Error('先写点画面描述')
        const result = await api.generateImage({
          prompt,
          ...(channel === undefined ? {} : { channel: channel.id }),
          ...(model === '' ? {} : { model }),
          n: count,
          ...(refs.length === 0 ? {} : { refs: refs.map(item => item.id ?? item.path ?? '') }),
          ...(size === '' ? { aspectRatio: aspect } : { size }),
          ...(quality === '' ? {} : { quality }),
          ...(negative === '' ? {} : { negative }),
        })
        watchJob(result.job)
        props.notify('已提交图像任务', 'ok')
      } else if (mode === 'video') {
        if (prompt.trim() === '') throw new Error('先写点镜头描述')
        const inferredMode = refs.length === 0 ? 'text' : refs.length > 1 ? 'keyframe' : videoMode === 'reference' ? 'reference' : 'image'
        const result = await api.generateVideo({
          prompt,
          ...(channel === undefined ? {} : { channel: channel.id }),
          ...(model === '' ? {} : { model }),
          mode: inferredMode,
          ...(refs.length === 0 ? {} : { refs: refs.map(item => item.id ?? item.path ?? '') }),
          seconds: Number.parseFloat(seconds) || 5,
          resolution,
          aspectRatio: videoAspect,
          ...(negative === '' ? {} : { negative }),
        })
        watchJob(result.job)
        props.notify('已提交视频任务（云端渲染可能需要几分钟）', 'ok')
      } else if (mode === 'storyboard') {
        const clean = shots.filter(shot => shot.prompt.trim() !== '')
        if (clean.length === 0) throw new Error('至少写一个镜头')
        const result = await api.storyboard({
          shots: clean.map(shot => ({
            prompt: shot.prompt,
            seconds: Number.parseFloat(shot.seconds) || undefined,
            ...(shot.ref === undefined ? {} : { ref: shot.ref.id ?? shot.ref.path }),
          })),
          ...(style === '' ? {} : { style }),
          chain,
          concat,
          ...(channel === undefined ? {} : { channel: channel.id }),
          ...(model === '' ? {} : { model }),
          resolution,
          aspectRatio: videoAspect,
        })
        watchJob(result.job)
        props.notify('已提分镜任务，按镜头顺序渲染', 'ok')
      }
    } catch (error) {
      props.notify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ms-create">
      <div className="ms-compose">
        <div className="ms-mode-row">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'image', label: '图像', icon: 'image' },
              { value: 'video', label: '视频', icon: 'film' },
              { value: 'storyboard', label: '分镜', icon: 'layers' },
              { value: 'comfy', label: 'ComfyUI', icon: 'plug' },
            ]}
          />
          {mode === 'image' || mode === 'video' || mode === 'storyboard' ? (
            <span className="ms-inline-status">
              <span className={`ms-dot${channel?.ready === true ? ' on' : ''}`} />
              {channel === undefined ? '没有可用通道' : channel.ready ? `${channel.label}${channel.keySource === 'env' ? '（环境变量）' : ''}` : `${channel.label} 缺 Key`}
            </span>
          ) : null}
        </div>

        {mode === 'comfy' ? (
          <ComfyPanel notify={props.notify} onProduced={props.onProduced} watchJob={watchJob} />
        ) : (
          <>
            {mode === 'storyboard' ? (
              <StoryboardForm
                shots={shots}
                style={style}
                chain={chain}
                concat={concat}
                onChange={setShots}
                onStyle={setStyle}
                onChain={setChain}
                onConcat={setConcat}
                onPickRef={id => { void openPicker({ kind: 'shot', id }, 'image') }}
                onClearRef={id => setShots(current => current.map(shot => shot.id === id ? { ...shot, ref: undefined } : shot))}
              />
            ) : (
              <>
                <Field label={mode === 'image' ? '画面描述' : '镜头描述'} hint={mode === 'video' ? '写清主体动作、运镜、光线；时长内的变化也要写' : undefined}>
                  <textarea
                    className="ms-textarea"
                    rows={5}
                    value={prompt}
                    placeholder={mode === 'image' ? '雨夜霓虹街头的一只赛博朋克猫，电影感光线，浅景深，35mm' : '镜头缓慢推近，霓虹灯在湿地面反光，猫抬头看向镜头'}
                    onChange={event => setPrompt(event.target.value)}
                  />
                </Field>
                <Field label="负面提示词" hint="可选；部分通道会忽略">
                  <input className="ms-input" value={negative} placeholder="low quality, watermark, text" onChange={event => setNegative(event.target.value)} />
                </Field>
              </>
            )}

            {mode === 'image' ? (
              <>
                <div className="ms-grid-2">
                  <Field label="通道">
                    <select className="ms-select" value={channel?.id ?? ''} onChange={event => pickChannel(event.target.value)}>
                      {imageChannels.length === 0 ? <option value="">没有图像通道</option> : null}
                      {imageChannels.map(item => <option key={item.id} value={item.id}>{item.label}{item.ready ? '' : '（缺 Key）'}</option>)}
                      {comfyChannel === undefined ? null : (
                        <option value="__comfyui__">ComfyUI（{comfyChannel.ready ? '工作流模式' : '未配置地址'}）</option>
                      )}
                    </select>
                  </Field>
                  <Field label="模型">
                    <input className="ms-input" value={model} onChange={event => setModel(event.target.value)} list="ms-image-models" />
                    <datalist id="ms-image-models">
                      {(channel?.models?.image ?? []).map(item => <option key={item} value={item} />)}
                    </datalist>
                  </Field>
                </div>
                <div className="ms-grid-3">
                  <Field label="张数">
                    <input className="ms-input" type="number" min={1} max={10} value={count} onChange={event => setCount(Math.max(1, Math.min(10, Number.parseInt(event.target.value || '1', 10))))} />
                  </Field>
                  <Field label="尺寸">
                    <select className="ms-select" value={size} onChange={event => setSize(event.target.value)}>
                      <option value="">按比例</option>
                      {SIZES.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field label="比例">
                    <select className="ms-select" value={aspect} onChange={event => setAspect(event.target.value)} disabled={size !== ''}>
                      {RATIOS.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="质量" hint="OpenAI 通道支持 low / medium / high">
                  <input className="ms-input" value={quality} placeholder="默认" onChange={event => setQuality(event.target.value)} />
                </Field>
              </>
            ) : mode === 'video' ? (
              <>
                <div className="ms-grid-2">
                  <Field label="通道">
                    <select className="ms-select" value={channel?.id ?? ''} onChange={event => pickChannel(event.target.value)}>
                      {videoChannels.length === 0 ? <option value="">没有视频通道</option> : null}
                      {videoChannels.map(item => <option key={item.id} value={item.id}>{item.label}{item.ready ? '' : '（缺 Key）'}</option>)}
                      {comfyChannel === undefined ? null : (
                        <option value="__comfyui__">ComfyUI（{comfyChannel.ready ? '工作流模式' : '未配置地址'}）</option>
                      )}
                    </select>
                  </Field>
                  <Field label="模型">
                    <input className="ms-input" value={model} onChange={event => setModel(event.target.value)} list="ms-video-models" />
                    <datalist id="ms-video-models">
                      {(channel?.models?.video ?? []).map(item => <option key={item} value={item} />)}
                    </datalist>
                  </Field>
                </div>
                <div className="ms-grid-3">
                  <Field label="时长（秒）">
                    <input className="ms-input" type="number" min={1} max={20} value={seconds} onChange={event => setSeconds(event.target.value)} />
                  </Field>
                  <Field label="分辨率">
                    <select className="ms-select" value={resolution} onChange={event => setResolution(event.target.value)}>
                      {['480P', '720P', '1080P'].map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field label="比例">
                    <select className="ms-select" value={videoAspect} onChange={event => setVideoAspect(event.target.value)}>
                      {['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            ) : (
              <>
                <div className="ms-grid-2">
                  <Field label="通道">
                    <select className="ms-select" value={channel?.id ?? ''} onChange={event => setChannelId(event.target.value)}>
                      {videoChannels.map(item => <option key={item.id} value={item.id}>{item.label}{item.ready ? '' : '（缺 Key）'}</option>)}
                    </select>
                  </Field>
                  <Field label="模型">
                    <input className="ms-input" value={model} onChange={event => setModel(event.target.value)} />
                  </Field>
                </div>
                <div className="ms-grid-2">
                  <Field label="统一分辨率">
                    <select className="ms-select" value={resolution} onChange={event => setResolution(event.target.value)}>
                      {['480P', '720P', '1080P'].map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field label="统一比例">
                    <select className="ms-select" value={videoAspect} onChange={event => setVideoAspect(event.target.value)}>
                      {['16:9', '9:16', '1:1'].map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            )}

            {mode !== 'storyboard' && comfyChannel !== undefined ? (
              <button type="button" className="ms-comfy-link" onClick={() => setMode('comfy')}>
                <Icon name="plug" size={13} />
                <span>本地 ComfyUI {comfyChannel.ready ? '已就绪' : '地址未配置'}：用工作流模式出图 / 视频</span>
                <Icon name="chevron" size={12} />
              </button>
            ) : null}

            {mode !== 'storyboard' ? (
              <div className="ms-refs">
                <div className="ms-refs-head">
                  <span>参考图 {refs.length > 0 ? `（${String(refs.length)}/5）` : '（可选）'}</span>
                  <div className="ms-refs-actions">
                    <button type="button" className="ms-text-btn" onClick={() => fileInput.current?.click()}><Icon name="upload" size={13} />上传</button>
                    <button type="button" className="ms-text-btn" onClick={() => { void openPicker({ kind: 'refs' }, 'image') }}><Icon name="grid" size={13} />素材库</button>
                  </div>
                </div>
                <div
                  className="ms-drop"
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault()
                    void addFiles(Array.from(event.dataTransfer.files))
                  }}
                >
                  {refs.length === 0 ? <span className="ms-drop-hint">拖入图片，或使用上面的按钮</span> : null}
                  {refs.map(ref => (
                    <div className="ms-ref" key={ref.key}>
                      {ref.uploading === true ? <span className="ms-ref-loading"><Spinner size={12} /></span> : <img src={ref.url} alt={ref.name} />}
                      <button type="button" className="ms-ref-remove" onClick={() => setRefs(current => current.filter(item => item.key !== ref.key))} aria-label="移除">
                        <Icon name="close" size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="ms-submit-row">
              <Button variant="primary" size="md" icon="sparkles" disabled={submitting} onClick={() => { void submit() }}>
                {submitting ? '提交中…' : mode === 'image' ? `生成 ${String(count)} 张` : mode === 'video' ? '生成视频' : '开始分镜'}
              </Button>
              <span className="ms-hint">
                {mode === 'image' ? '出图后点结果里的「作参考」可继续改' : '云端渲染通常 1–10 分钟；可切到「任务」页跟进'}
              </span>
            </div>
          </>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={event => {
            void addFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
      </div>

      <aside className="ms-result">
        <div className="ms-result-head">
          <span>{job === null ? '最近生成' : '本次结果'}</span>
          {job !== null ? <button type="button" className="ms-text-btn" onClick={props.onOpenJobs}>全部任务</button> : null}
        </div>
        {job !== null ? (
          <div className="ms-result-job">
            <JobCard
              job={job}
              onCancel={() => { void api.cancelJob(job.jobId).then(() => props.notify('已请求取消')).catch(error => props.notify(String(error), 'error')) }}
              onCollect={() => {
                void api.collectJob(job.jobId)
                  .then(result => { setJob(result.job); props.onProduced(); props.notify(`已取回 ${String(result.job.assets.length)} 个产物`, 'ok') })
                  .catch(error => props.notify(error instanceof Error ? error.message : String(error), 'error'))
              }}
              onUseRef={asset => {
                setRefs(current => [...current, fromAsset(asset)].slice(0, 5))
                props.notify('已加入参考图')
              }}
            />
          </div>
        ) : null}
        {job === null && recent.length === 0 ? (
          <div className="ms-result-empty">
            <Icon name="image" size={26} />
            <p>还没有作品。写一句描述，生成第一张图。</p>
          </div>
        ) : null}
        {recent.length > 0 ? (
          <div className="ms-recent">
            {recent.map(asset => (
              <button
                key={asset.id}
                type="button"
                className="ms-recent-item"
                onClick={() => {
                  if (asset.kind !== 'image') {
                    props.notify('视频不能作参考图；图片才行')
                    return
                  }
                  setRefs(current => [...current, fromAsset(asset)].slice(0, 5))
                  setMode(current => current === 'video' ? 'video' : 'image')
                  props.notify('已加入参考图')
                }}
                title={asset.prompt ?? asset.name}
              >
                <AssetThumb asset={asset} size="sm" />
              </button>
            ))}
          </div>
        ) : null}
        {job !== null && job.assets.length > 0 ? (
          <div className="ms-result-hint">
            <Tag tone="ok"><Icon name="check" size={11} /> 已存入素材库</Tag>
            <span>镜像路径：{hostDirOf(job.assets[0]!.path)}</span>
          </div>
        ) : null}
      </aside>

      {pickerOpen ? (
        <div className="ms-modal-mask" onMouseDown={event => { if (event.target === event.currentTarget) setPickerOpen(false) }}>
          <div className="ms-modal wide">
            <header className="ms-modal-head">
              <span>从素材库选择{pickerKind === 'image' ? '图片' : '视频'}</span>
              <button type="button" className="ms-icon-btn" onClick={() => setPickerOpen(false)}><Icon name="close" size={16} /></button>
            </header>
            <div className="ms-modal-body">
              {libraryItems.length === 0 ? <p className="ms-hint">素材库还是空的。</p> : (
                <div className="ms-pick-grid">
                  {libraryItems.map(asset => (
                    <button key={asset.id} type="button" className="ms-pick" onClick={() => pickAsset(asset)} title={asset.prompt ?? asset.name}>
                      <AssetThumb asset={asset} size="sm" />
                      <span>{asset.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StoryboardForm(props: {
  shots: ShotItem[]
  style: string
  chain: boolean
  concat: boolean
  onChange: (shots: ShotItem[]) => void
  onStyle: (value: string) => void
  onChain: (value: boolean) => void
  onConcat: (value: boolean) => void
  onPickRef: (id: string) => void
  onClearRef: (id: string) => void
}): React.ReactElement {
  const total = props.shots.reduce((sum, shot) => sum + (Number.parseFloat(shot.seconds) || 5), 0)
  return (
    <div className="ms-storyboard">
      <Field label="统一风格" hint="会拼到每个镜头前面">
        <input className="ms-input" value={props.style} placeholder="例如：赛博朋克，霓虹紫青，35mm 电影感" onChange={event => props.onStyle(event.target.value)} />
      </Field>
      <div className="ms-shot-list">
        {props.shots.map((shot, index) => (
          <div className="ms-shot" key={shot.id}>
            <span className="ms-shot-no">{index + 1}</span>
            <div className="ms-shot-body">
              <textarea
                className="ms-textarea small"
                rows={2}
                value={shot.prompt}
                placeholder={index === 0 ? '起始镜头：角色站在雨夜街头' : '下一镜：镜头推近，角色抬头'}
                onChange={event => props.onChange(props.shots.map(item => item.id === shot.id ? { ...item, prompt: event.target.value } : item))}
              />
              <div className="ms-shot-tools">
                <label className="ms-mini-field">
                  时长
                  <input
                    className="ms-input mini"
                    type="number"
                    min={1}
                    max={20}
                    value={shot.seconds}
                    onChange={event => props.onChange(props.shots.map(item => item.id === shot.id ? { ...item, seconds: event.target.value } : item))}
                  />
                  秒
                </label>
                {shot.ref === undefined ? (
                  <button type="button" className="ms-text-btn" onClick={() => props.onPickRef(shot.id)}><Icon name="image" size={12} />参考图</button>
                ) : (
                  <span className="ms-shot-ref">
                    <img src={shot.ref.url} alt="" />
                    {shot.ref.name.slice(0, 18)}
                    <button type="button" className="ms-text-btn" onClick={() => props.onClearRef(shot.id)}>移除</button>
                  </span>
                )}
                {props.shots.length > 1 ? (
                  <button type="button" className="ms-text-btn danger" onClick={() => props.onChange(props.shots.filter(item => item.id !== shot.id))}>删除</button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="ms-shot-add">
        <button
          type="button"
          className="ms-add-shot"
          onClick={() => props.onChange([...props.shots, { id: newKey(), prompt: '', seconds: '5' }])}
        >
          <Icon name="plus" size={14} /> 添加镜头
        </button>
        <span className="ms-hint">共 {props.shots.length} 镜 · 约 {total} 秒</span>
      </div>
      <div className="ms-toggles">
        <label className="ms-check">
          <input type="checkbox" checked={props.chain} onChange={event => props.onChain(event.target.checked)} />
          接上一镜尾帧（需要 ffmpeg）
        </label>
        <label className="ms-check">
          <input type="checkbox" checked={props.concat} onChange={event => props.onConcat(event.target.checked)} />
          自动拼成一条成片
        </label>
      </div>
    </div>
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function hostDirOf(file: string): string {
  const parts = file.split(/[\\/]/)
  parts.pop()
  return parts.join('/')
}
