/** ComfyUI 页：工作流选择、变量表单、导入。 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api.js'
import type { JobView, WorkflowSlot, WorkflowView } from '../types.js'
import { Icon } from '../icons.js'
import { Button, Field, Spinner } from '../ui.js'

interface ComfyProps {
  notify: (text: string, tone?: 'info' | 'error' | 'ok') => void
  onProduced: () => void
  watchJob: (job: JobView) => void
}

interface RefImage {
  name: string
  url: string
  path: string
}

export function ComfyPanel({ notify, onProduced: _onProduced, watchJob }: ComfyProps): React.ReactElement {
  const [workflows, setWorkflows] = useState<WorkflowView[]>([])
  const [online, setOnline] = useState(false)
  const [detail, setDetail] = useState<string | undefined>(undefined)
  const [selectedId, setSelectedId] = useState('')
  const [vars, setVars] = useState<Record<string, string>>({})
  const [images, setImages] = useState<Record<string, RefImage>>({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importTitle, setImportTitle] = useState('')
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const importFile = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.workflows()
      setWorkflows(result.workflows)
      setOnline(result.online)
      setDetail(result.detail)
      if (result.workflows.length > 0) {
        setSelectedId(current => current !== '' && result.workflows.some(item => item.workflowId === current) ? current : result.workflows[0]!.workflowId)
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { void load() }, [load])

  const selected = useMemo(() => workflows.find(item => item.workflowId === selectedId), [workflows, selectedId])

  useEffect(() => {
    if (selected === undefined) return
    const next: Record<string, string> = {}
    for (const slot of selected.slots) {
      if (slot.type === 'image') continue
      next[slot.name] = slot.value === undefined ? '' : String(slot.value)
    }
    setVars(next)
    setImages({})
  }, [selected])

  const setVar = (name: string, value: string): void => setVars(current => ({ ...current, [name]: value }))

  const uploadFor = async (slot: string, file: File): Promise<void> => {
    try {
      const dataUrl = await readAsDataUrl(file)
      const result = await api.importDataUrl(dataUrl, file.name)
      setImages(current => ({ ...current, [slot]: { name: file.name, url: result.asset.url, path: result.asset.path } }))
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const run = async (): Promise<void> => {
    if (selected === undefined) return
    setRunning(true)
    try {
      const payloadVars: Record<string, unknown> = {}
      for (const slot of selected.slots) {
        if (slot.type === 'image') continue
        const raw = vars[slot.name] ?? ''
        if (raw === '' && !slot.required) continue
        payloadVars[slot.name] = slot.type === 'number' ? Number.parseFloat(raw) : slot.type === 'boolean' ? raw === 'true' : raw
      }
      const result = await api.runWorkflow({
        workflowId: selected.workflowId,
        vars: payloadVars,
        images: Object.entries(images).map(([slot, image]) => ({ slot, path: image.path })),
      })
      watchJob(result.job)
      notify('已提交到 ComfyUI', 'ok')
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setRunning(false)
    }
  }

  /** Read a .json workflow from disk (file picker or drag-drop) into the form. */
  const readImportFile = async (file: File): Promise<void> => {
    if (!/\.json$/i.test(file.name)) {
      notify('请选择 .json 工作流文件', 'error')
      return
    }
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('JSON 解析失败')
      }
      if (parsed === null || typeof parsed !== 'object') throw new Error('文件内容不是 JSON 对象')
      const uiFormat = Array.isArray((parsed as { nodes?: unknown }).nodes)
      setImportJson(text)
      if (importTitle.trim() === '') setImportTitle(file.name.replace(/\.json$/i, ''))
      setImportOpen(true)
      notify(
        uiFormat
          ? '这是 UI 格式工作流：请在 ComfyUI 里用 Save (API Format) 重新导出'
          : `已读取 ${file.name}，确认后点「导入」`,
        uiFormat ? 'error' : 'ok',
      )
    } catch (error) {
      notify(`读取失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  const importWorkflow = async (): Promise<void> => {
    setImporting(true)
    try {
      const result = await api.importWorkflow({
        json: importJson,
        ...(importTitle.trim() === '' ? {} : { id: importTitle.trim(), title: importTitle.trim() }),
      })
      setImportOpen(false)
      setImportJson('')
      setImportTitle('')
      await load()
      setSelectedId(result.workflow.workflowId)
      notify(`已导入 ${result.workflow.title}`, 'ok')
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className={`ms-comfy${dragActive ? ' dragging' : ''}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false)
      }}
      onDrop={event => {
        event.preventDefault()
        setDragActive(false)
        const file = event.dataTransfer.files?.[0]
        if (file !== undefined) void readImportFile(file)
      }}
    >
      {dragActive ? (
        <div className="ms-drop-overlay">
          <Icon name="upload" size={22} />
          <span>松开即可导入 .json 工作流</span>
        </div>
      ) : null}
      <div className="ms-comfy-head">
        <span className="ms-inline-status">
          <span className={`ms-dot${online ? ' on' : ''}`} />
          {online ? 'ComfyUI 在线' : `ComfyUI 离线${detail === undefined ? '' : `：${detail}`}`}
        </span>
        <div className="ms-inline-actions">
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => { void load() }}>刷新</Button>
          <Button size="sm" variant="soft" icon="upload" onClick={() => setImportOpen(true)}>导入工作流</Button>
        </div>
      </div>

      {loading ? <div className="ms-loading"><Spinner /> 读取工作流…</div> : null}

      {!loading && workflows.length === 0 ? (
        <div className="ms-comfy-empty">
          <Icon name="plug" size={26} />
          <p>还没有导入工作流。</p>
          <p className="ms-hint">在 ComfyUI 里打开工作流 → 勾选 Dev mode → <code>Save (API Format)</code>，然后上传或粘贴 JSON。</p>
          <Button variant="primary" size="sm" icon="upload" onClick={() => setImportOpen(true)}>导入 API 工作流</Button>
        </div>
      ) : null}

      {workflows.length > 0 ? (
        <>
          <div className="ms-grid-2">
            <Field label="工作流">
              <select className="ms-select" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                {workflows.map(item => <option key={item.workflowId} value={item.workflowId}>{item.title}{item.enabled ? '' : '（已停用）'}</option>)}
              </select>
            </Field>
            <Field label="输出">
              <span className="ms-static">{selected?.outputs.map(output => output.kind === 'video' ? '视频' : '图片').join(' / ') || '未识别'}</span>
            </Field>
          </div>
          {selected?.description === undefined || selected.description === '' ? null : <p className="ms-comfy-desc">{selected.description}</p>}

          <div className="ms-comfy-vars">
            {selected?.slots.map(slot => slot.type === 'image' ? (
              <div className="ms-slot-image" key={`${slot.nodeId}.${slot.input}`}>
                <div className="ms-slot-image-head">
                  <span>{slot.label ?? slot.name} <em>{slot.required ? '必填' : '可选'}</em></span>
                  {images[slot.name] === undefined ? null : (
                    <button type="button" className="ms-text-btn danger" onClick={() => setImages(current => {
                      const next = { ...current }
                      delete next[slot.name]
                      return next
                    })}>移除</button>
                  )}
                </div>
                {images[slot.name] === undefined ? (
                  <label className="ms-slot-drop">
                    <Icon name="image" size={18} />
                    <span>点击选择图片</span>
                    <input type="file" accept="image/*" hidden onChange={event => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file !== undefined) void uploadFor(slot.name, file)
                    }} />
                  </label>
                ) : (
                  <img className="ms-slot-preview" src={images[slot.name]!.url} alt={slot.name} />
                )}
              </div>
            ) : (
              <Field key={`${slot.nodeId}.${slot.input}`} label={`${slot.label ?? slot.name}${slot.required ? ' *' : ''}`} hint={`${slot.nodeId}.${slot.input}`}>
                {slot.type === 'string' && slot.name.startsWith('prompt') ? (
                  <textarea className="ms-textarea small" rows={3} value={vars[slot.name] ?? ''} onChange={event => setVar(slot.name, event.target.value)} />
                ) : slot.type === 'boolean' ? (
                  <select className="ms-select" value={vars[slot.name] ?? 'false'} onChange={event => setVar(slot.name, event.target.value)}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    className="ms-input"
                    type={slot.type === 'number' ? 'number' : 'text'}
                    value={vars[slot.name] ?? ''}
                    onChange={event => setVar(slot.name, event.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>

          <div className="ms-submit-row">
            <Button variant="primary" icon="play" disabled={running || !online} onClick={() => { void run() }}>
              {running ? '提交中…' : online ? '运行工作流' : 'ComfyUI 离线'}
            </Button>
            <span className="ms-hint">变量会写进工作流副本，不改模板文件</span>
          </div>
        </>
      ) : null}

      {importOpen ? (
        <div className="ms-modal-mask" onMouseDown={event => { if (event.target === event.currentTarget) setImportOpen(false) }}>
          <div className="ms-modal wide">
            <header className="ms-modal-head">
              <span>导入 ComfyUI 工作流（API 格式）</span>
              <button type="button" className="ms-icon-btn" onClick={() => setImportOpen(false)}><Icon name="close" size={16} /></button>
            </header>
            <div className="ms-modal-body">
              <Field label="名称" hint="留空自动按时间命名">
                <input className="ms-input" value={importTitle} placeholder="例如：SDXL 写实人像" onChange={event => setImportTitle(event.target.value)} />
              </Field>
              <div className="ms-import-actions">
                <Button size="sm" variant="soft" icon="upload" onClick={() => importFile.current?.click()}>选择 .json 文件</Button>
                <span className="ms-hint">也可以把文件拖进窗口，或直接粘贴到下面</span>
                <input
                  ref={importFile}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={event => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file !== undefined) void readImportFile(file)
                  }}
                />
              </div>
              <Field label="API JSON" hint="必须是 ComfyUI 的 API 格式；UI 格式会在导入时被拒绝并提示原因">
                <textarea className="ms-textarea mono" rows={12} value={importJson} placeholder='{"3":{"class_type":"KSampler",...}}' onChange={event => setImportJson(event.target.value)} />
              </Field>
              <div className="ms-submit-row">
                <Button variant="primary" disabled={importing || importJson.trim() === ''} onClick={() => { void importWorkflow() }}>
                  {importing ? '导入中…' : '导入'}
                </Button>
                <span className="ms-hint">也可以把 JSON 文件放到 ~/.dsh-media-studio/workflows/</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
