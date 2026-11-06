/** 素材库：搜索、筛选、收藏、详情、批量拼接、导入。 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import type { AssetView } from '../types.js'
import { AssetTile, AssetThumb } from '../components.js'
import { Icon } from '../icons.js'
import { bytes, Button, Empty, Modal, Segmented, Spinner, Tag, when } from '../ui.js'

type Kind = 'all' | 'image' | 'video'

interface LibraryProps {
  focusAssetId: string | null
  version: number
  onUseAsReference: (asset: AssetView) => void
  notify: (text: string, tone?: 'info' | 'error' | 'ok') => void
  onChanged: () => void
  onOpenJobs: () => void
}

export function LibraryTab({ focusAssetId, version, onUseAsReference, notify, onChanged, onOpenJobs }: LibraryProps): React.ReactElement {
  const [items, setItems] = useState<AssetView[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const [favorites, setFavorites] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AssetView | null>(null)
  const [selection, setSelection] = useState<string[]>([])
  const [importPath, setImportPath] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [concatenating, setConcatenating] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const handledFocus = useRef<string | null>(null)

  const load = useCallback(async (search: string, filter: Kind, onlyFavorites: boolean) => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '120' }
      if (search.trim() !== '') params.query = search.trim()
      if (filter !== 'all') params.kind = filter
      if (onlyFavorites) params.favorite = '1'
      const result = await api.library(params)
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(query, kind, favorites) }, 220)
    return () => window.clearTimeout(timer)
  }, [query, kind, favorites, load, version])

  useEffect(() => {
    if (focusAssetId === null || handledFocus.current === focusAssetId) return
    const found = items.find(item => item.id === focusAssetId)
    if (found !== undefined) {
      handledFocus.current = focusAssetId
      setDetail(found)
    }
  }, [focusAssetId, items])

  const reload = (): void => { void load(query, kind, favorites); onChanged() }

  const toggleFavorite = async (asset: AssetView): Promise<void> => {
    try {
      const result = await api.favorite(asset.id, !asset.favorite)
      setItems(current => current.map(item => item.id === asset.id ? result.asset : item))
      if (detail?.id === asset.id) setDetail(result.asset)
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const remove = async (asset: AssetView): Promise<void> => {
    try {
      await api.remove(asset.id)
      setItems(current => current.filter(item => item.id !== asset.id))
      setDetail(null)
      setSelection(current => current.filter(id => id !== asset.id))
      notify('已删除', 'ok')
      onChanged()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const concatSelected = async (): Promise<void> => {
    if (selection.length < 2) return
    setConcatenating(true)
    try {
      const result = await api.concat({ ids: selection })
      setJobId(result.job.jobId)
      setSelection([])
      notify('开始拼接，完成后可在「任务」查看', 'ok')
      onChanged()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setConcatenating(false)
    }
  }

  useEffect(() => {
    if (jobId === null) return undefined
    const timer = window.setInterval(async () => {
      try {
        const result = await api.job(jobId)
        if (result.job.state !== 'running' && result.job.state !== 'queued') {
          window.clearInterval(timer)
          if (result.job.state === 'succeeded') {
            notify('拼接完成', 'ok')
            reload()
          } else {
            notify(result.job.error ?? '拼接失败', 'error')
          }
        }
      } catch {
        window.clearInterval(timer)
      }
    }, 1500)
    return () => window.clearInterval(timer)
  }, [jobId, notify])

  return (
    <div className="ms-library">
      <div className="ms-toolbar">
        <div className="ms-search">
          <Icon name="grid" size={14} />
          <input value={query} placeholder="搜索提示词、文件名、模型…" onChange={event => setQuery(event.target.value)} />
        </div>
        <Segmented<Kind>
          value={kind}
          onChange={setKind}
          options={[{ value: 'all', label: '全部' }, { value: 'image', label: '图片' }, { value: 'video', label: '视频' }]}
        />
        <button type="button" className={`ms-chip${favorites ? ' on' : ''}`} onClick={() => setFavorites(value => !value)}>
          <Icon name="star" size={13} />收藏
        </button>
        <div className="ms-toolbar-right">
          <span className="ms-hint">{total} 个素材</span>
          <Button size="sm" variant="ghost" icon="folder" onClick={() => setImportOpen(true)}>登记文件</Button>
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => { void api.scan().then(result => { notify(`扫描完成，新增 ${String(result.added)} 个`); reload() }).catch(error => notify(String(error), 'error')) }}>扫描</Button>
        </div>
      </div>

      {selection.length > 0 ? (
        <div className="ms-selectbar">
          <span>已选 {selection.length} 段视频</span>
          <div className="ms-inline-actions">
            <Button size="sm" variant="primary" icon="layers" disabled={selection.length < 2 || concatenating} onClick={() => { void concatSelected() }}>
              {concatenating ? '拼接中…' : '拼接成片'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelection([])}>取消选择</Button>
          </div>
        </div>
      ) : null}

      {loading ? <div className="ms-loading"><Spinner /> 读取素材…</div> : null}

      {!loading && items.length === 0 ? (
        <Empty icon="grid" title="素材库是空的" hint="生成的图片和视频会自动进来；也可以「登记文件」把本机已有的媒体加进来。">
          <Button size="sm" variant="soft" icon="folder" onClick={() => setImportOpen(true)}>登记本机文件</Button>
        </Empty>
      ) : (
        <div className="ms-grid">
          {items.map(asset => {
            const selectable = asset.kind === 'video'
            const selected = selection.includes(asset.id)
            return (
              <div className="ms-grid-cell" key={asset.id}>
                <AssetTile
                  asset={asset}
                  selected={selected}
                  onClick={() => setDetail(asset)}
                  onFavorite={() => { void toggleFavorite(asset) }}
                  footer={selectable ? (
                    <label className="ms-select-toggle" onClick={event => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={event => setSelection(current => event.target.checked ? [...current, asset.id] : current.filter(id => id !== asset.id))}
                      />
                      选择
                    </label>
                  ) : undefined}
                />
              </div>
            )
          })}
        </div>
      )}

      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail?.name} wide>
        {detail === null ? null : (
          <div className="ms-detail">
            <div className="ms-detail-media">
              {detail.kind === 'image' ? (
                <img src={detail.url} alt={detail.name} />
              ) : detail.kind === 'video' ? (
                <video src={detail.url} controls autoPlay muted loop playsInline />
              ) : (
                <div className="ms-file"><Icon name="film" size={26} /></div>
              )}
            </div>
            <div className="ms-detail-side">
              <div className="ms-detail-tags">
                <Tag tone="accent">{detail.kind === 'video' ? '视频' : '图片'}</Tag>
                {detail.origin === 'comfy' ? <Tag>ComfyUI</Tag> : null}
                {detail.channel === undefined ? null : <Tag>{detail.channel}</Tag>}
                {detail.model === undefined ? null : <Tag>{detail.model}</Tag>}
                {detail.favorite ? <Tag tone="ok"><Icon name="star" size={10} />收藏</Tag> : null}
              </div>
              <p className="ms-detail-prompt">{detail.prompt ?? '（没有记录提示词）'}</p>
              <dl className="ms-kv">
                <dt>文件</dt><dd title={detail.path}>{detail.path}</dd>
                <dt>大小</dt><dd>{bytes(detail.bytes)}</dd>
                {detail.width === undefined ? null : <><dt>尺寸</dt><dd>{detail.width}×{detail.height}</dd></>}
                {detail.duration === undefined ? null : <><dt>时长</dt><dd>{detail.duration.toFixed(1)}s</dd></>}
                <dt>创建</dt><dd>{when(detail.createdAt)}</dd>
                {detail.tags.length === 0 ? null : <><dt>标签</dt><dd>{detail.tags.join(' · ')}</dd></>}
              </dl>
              <div className="ms-detail-actions">
                <Button size="sm" variant="primary" icon="sparkles" onClick={() => onUseAsReference(detail)}>作参考图</Button>
                <a className="ms-btn ghost sm" href={detail.downloadUrl}><Icon name="download" size={14} /><span>下载</span></a>
                <Button size="sm" variant="ghost" icon="star" onClick={() => { void toggleFavorite(detail) }}>{detail.favorite ? '取消收藏' : '收藏'}</Button>
                <Button size="sm" variant="danger" icon="trash" onClick={() => { void remove(detail) }}>删除</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="登记本机文件">
        <div className="ms-import-form">
          <p className="ms-hint">填写绝对路径（工作区内也可以写相对路径）。文件不会被复制，只登记进素材库。</p>
          <input className="ms-input" value={importPath} placeholder="D:\\work\\output\\hero.png" onChange={event => setImportPath(event.target.value)} />
          <div className="ms-submit-row">
            <Button
              variant="primary"
              icon="upload"
              disabled={importPath.trim() === ''}
              onClick={() => {
                if (importPath.trim() === '') return
                void api.importPath(importPath.trim()).then(result => {
                  setImportOpen(false)
                  setImportPath('')
                  notify(`已登记 ${result.asset.name}`, 'ok')
                  reload()
                }).catch(error => notify(error instanceof Error ? error.message : String(error), 'error'))
              }}
            >登记</Button>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>取消</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
