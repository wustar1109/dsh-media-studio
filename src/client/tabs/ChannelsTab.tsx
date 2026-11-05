/** 通道页：通道增删改测、默认值、高级路径、ComfyUI 工作流管理。 */
import { useCallback, useEffect, useState } from 'react'

import { api } from '../api.js'
import type { ChannelKind, ChannelView, ConfigView, WorkflowView } from '../types.js'
import { Icon } from '../icons.js'
import { Button, Field, Modal, Spinner, Tag } from '../ui.js'

const KINDS: Array<{ value: ChannelKind; label: string; baseUrl: string }> = [
  { value: 'openai', label: 'OpenAI Images / Sora', baseUrl: 'https://api.openai.com/v1' },
  { value: 'openai-compat', label: 'OpenAI 兼容中转', baseUrl: 'https://api.example.com/v1' },
  { value: 'google', label: 'Google Gemini / Veo', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { value: 'dashscope', label: '阿里云百炼 Qwen / Wan', baseUrl: 'https://dashscope.aliyuncs.com/api/v1' },
  { value: 'ark', label: '火山方舟 Seedream / Seedance', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { value: 'xai', label: 'xAI Grok Imagine', baseUrl: 'https://api.x.ai/v1' },
  { value: 'comfyui', label: 'ComfyUI', baseUrl: '' },
]

interface Draft {
  id: string
  label: string
  kind: ChannelKind
  enabled: boolean
  baseUrl: string
  apiKey: string
  apiKeyEnv: string
  imageModel: string
  videoModel: string
}

function draftOf(channel: ChannelView): Draft {
  return {
    id: channel.id,
    label: channel.label,
    kind: channel.kind,
    enabled: channel.enabled !== false,
    baseUrl: channel.baseUrl ?? '',
    apiKey: '',
    apiKeyEnv: channel.apiKeyEnv ?? '',
    imageModel: channel.imageModel ?? '',
    videoModel: channel.videoModel ?? '',
  }
}

interface ChannelsProps {
  config: ConfigView
  onSaved: () => void
  notify: (text: string, tone?: 'info' | 'error' | 'ok') => void
}

export function ChannelsTab({ config, onSaved, notify }: ChannelsProps): React.ReactElement {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; detail: string }>>({})
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newKind, setNewKind] = useState<ChannelKind>('openai')
  const [newId, setNewId] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [outputDir, setOutputDir] = useState(config.outputDir ?? '')
  const [ffmpegPath, setFfmpegPath] = useState(config.ffmpegPath ?? '')
  const [importRoots, setImportRoots] = useState(config.importRoots.join(', '))
  const [workflows, setWorkflows] = useState<WorkflowView[]>([])
  const [comfyOnline, setComfyOnline] = useState(false)
  const [loadingFlows, setLoadingFlows] = useState(false)

  useEffect(() => {
    setDrafts(Object.fromEntries(config.channels.map(channel => [channel.id, draftOf(channel)])))
    setOutputDir(config.outputDir ?? '')
    setFfmpegPath(config.ffmpegPath ?? '')
    setImportRoots(config.importRoots.join(', '))
  }, [config])

  const loadWorkflows = useCallback(async () => {
    setLoadingFlows(true)
    try {
      const result = await api.workflows()
      setWorkflows(result.workflows)
      setComfyOnline(result.online)
    } catch {
      setWorkflows([])
    } finally {
      setLoadingFlows(false)
    }
  }, [])

  useEffect(() => { void loadWorkflows() }, [loadWorkflows])

  const patchDraft = (id: string, patch: Partial<Draft>): void => {
    setDrafts(current => current[id] === undefined ? current : { ...current, [id]: { ...current[id]!, ...patch } })
  }

  const saveAll = async (nextDrafts?: Record<string, Draft>, extra: Record<string, unknown> = {}): Promise<void> => {
    const source = nextDrafts ?? drafts
    setSaving(true)
    try {
      const channels = Object.values(source).map(draft => ({
        id: draft.id,
        label: draft.label,
        kind: draft.kind,
        enabled: draft.enabled,
        baseUrl: draft.baseUrl,
        ...(draft.apiKey.trim() === '' ? {} : { apiKey: draft.apiKey.trim() }),
        ...(draft.apiKeyEnv.trim() === '' ? {} : { apiKeyEnv: draft.apiKeyEnv.trim() }),
        ...(draft.imageModel.trim() === '' ? {} : { imageModel: draft.imageModel.trim() }),
        ...(draft.videoModel.trim() === '' ? {} : { videoModel: draft.videoModel.trim() }),
      }))
      await api.saveConfig({ channels, ...extra })
      notify('已保存', 'ok')
      onSaved()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  const test = async (id: string): Promise<void> => {
    setTesting(id)
    try {
      const result = await api.testChannel(id)
      setTestResult(current => ({ ...current, [id]: { ok: result.ok, detail: `${result.detail}${result.latencyMs === undefined ? '' : ` · ${String(result.latencyMs)}ms`}` } }))
    } catch (error) {
      setTestResult(current => ({ ...current, [id]: { ok: false, detail: error instanceof Error ? error.message : String(error) } }))
    } finally {
      setTesting(null)
    }
  }

  const addChannel = (): void => {
    const id = newId.trim() || `${newKind}-${String(Date.now()).slice(-4)}`
    const meta = KINDS.find(item => item.value === newKind)!
    setDrafts(current => ({
      ...current,
      [id]: {
        id,
        label: newLabel.trim() || meta.label,
        kind: newKind,
        enabled: true,
        baseUrl: meta.baseUrl,
        apiKey: '',
        apiKeyEnv: '',
        imageModel: '',
        videoModel: '',
      },
    }))
    setAddOpen(false)
    setNewId('')
    setNewLabel('')
    setOpenId(id)
  }

  const removeChannel = async (id: string): Promise<void> => {
    const next = { ...drafts }
    delete next[id]
    setDrafts(next)
    await saveAll(next)
  }

  return (
    <div className="ms-channels">
      <div className="ms-channels-head">
        <div>
          <h3>通道</h3>
          <p className="ms-hint">每个通道就是一套上游配置：协议族、地址、Key、默认模型。图像与视频共用同一张表。</p>
        </div>
        <div className="ms-inline-actions">
          <Button size="sm" variant="ghost" icon="settings" onClick={() => setAdvancedOpen(true)}>高级</Button>
          <Button size="sm" variant="primary" icon="plus" onClick={() => setAddOpen(true)}>添加通道</Button>
        </div>
      </div>

      <div className="ms-channel-list">
        {config.channels.map(channel => {
          const draft = drafts[channel.id] ?? draftOf(channel)
          const open = openId === channel.id
          return (
            <div className={`ms-channel${open ? ' open' : ''}`} key={channel.id}>
              <button type="button" className="ms-channel-head" onClick={() => setOpenId(open ? null : channel.id)}>
                <span className={`ms-dot${channel.ready ? ' on' : ''}`} />
                <span className="ms-channel-name">{draft.label}</span>
                <span className="ms-channel-kind">{channel.kind}</span>
                {channel.capabilities.map(capability => <Tag key={capability}>{capability === 'image' ? '图' : capability === 'video' ? '视频' : '工作流'}</Tag>)}
                <span className="ms-channel-key">{channel.keyHint}</span>
                {channel.ready ? <Tag tone="ok">就绪</Tag> : <Tag tone="danger">缺配置</Tag>}
                <Icon name="chevron" size={14} className={open ? 'rot90' : ''} />
              </button>
              {open ? (
                <div className="ms-channel-body">
                  <div className="ms-grid-2">
                    <Field label="名称"><input className="ms-input" value={draft.label} onChange={event => patchDraft(channel.id, { label: event.target.value })} /></Field>
                    <Field label="地址" hint={draft.kind === 'comfyui' ? '填 ComfyUI 的根地址，可省略 http://' : '不含尾斜杠；Google 填到 /v1beta，其他填到 /v1 或 /api/v3'}>
                      <input className="ms-input" value={draft.baseUrl} onChange={event => patchDraft(channel.id, { baseUrl: event.target.value })} />
                    </Field>
                  </div>
                  {draft.kind === 'comfyui' ? (
                    <p className="ms-hint">
                      ComfyUI 不需要 API Key；地址填根路径即可，不写 http:// 也会自动补。
                      工作流在「创作 → ComfyUI」导入，变量与图片槽位会从工作流里推断。
                    </p>
                  ) : (
                    <>
                      <div className="ms-grid-2">
                        <Field label="API Key" hint={channel.keySource === 'env' ? `当前来自环境变量 ${channel.apiKeyEnv ?? ''}；填写会覆盖` : '留空保持现有 Key'}>
                          <input className="ms-input" type="password" value={draft.apiKey} placeholder={channel.keySource === 'inline' ? '已保存（留空不修改）' : 'sk-…'} onChange={event => patchDraft(channel.id, { apiKey: event.target.value })} />
                        </Field>
                        <Field label="环境变量名" hint="没有 Key 时读这个变量">
                          <input className="ms-input" value={draft.apiKeyEnv} placeholder="OPENAI_API_KEY" onChange={event => patchDraft(channel.id, { apiKeyEnv: event.target.value })} />
                        </Field>
                      </div>
                      <div className="ms-grid-2">
                        <Field label="默认图像模型"><input className="ms-input" value={draft.imageModel} onChange={event => patchDraft(channel.id, { imageModel: event.target.value })} /></Field>
                        <Field label="默认视频模型"><input className="ms-input" value={draft.videoModel} onChange={event => patchDraft(channel.id, { videoModel: event.target.value })} /></Field>
                      </div>
                    </>
                  )}
                  {testResult[channel.id] === undefined ? null : (
                    <div className={`ms-test ${testResult[channel.id]!.ok ? 'ok' : 'bad'}`}>
                      <Icon name={testResult[channel.id]!.ok ? 'check' : 'alert'} size={13} />
                      {testResult[channel.id]!.detail}
                    </div>
                  )}
                  <div className="ms-channel-actions">
                    <Button size="sm" variant="primary" disabled={saving} onClick={() => { void saveAll(undefined, { defaults: config.defaults }) }}>保存</Button>
                    <Button size="sm" variant="soft" icon={testing === channel.id ? undefined : 'plug'} disabled={testing === channel.id} onClick={() => { void test(channel.id) }}>
                      {testing === channel.id ? '测试中…' : '测试连接'}
                    </Button>
                    <label className="ms-check">
                      <input type="checkbox" checked={draft.enabled} onChange={event => patchDraft(channel.id, { enabled: event.target.checked })} />
                      启用
                    </label>
                    <span className="ms-spacer" />
                    <Button size="sm" variant="danger" icon="trash" onClick={() => { void removeChannel(channel.id) }}>删除</Button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="ms-defaults">
        <h3>默认通道</h3>
        <div className="ms-grid-2">
          <Field label="图像默认">
            <select
              className="ms-select"
              value={config.defaults.image ?? ''}
              onChange={event => { void saveAll(undefined, { defaults: { ...config.defaults, image: event.target.value || undefined } }) }}
            >
              <option value="">自动（第一个就绪）</option>
              {config.channels.filter(channel => channel.capabilities.includes('image')).map(channel => <option key={channel.id} value={channel.id}>{channel.label}</option>)}
            </select>
          </Field>
          <Field label="视频默认">
            <select
              className="ms-select"
              value={config.defaults.video ?? ''}
              onChange={event => { void saveAll(undefined, { defaults: { ...config.defaults, video: event.target.value || undefined } }) }}
            >
              <option value="">自动（第一个就绪）</option>
              {config.channels.filter(channel => channel.capabilities.includes('video')).map(channel => <option key={channel.id} value={channel.id}>{channel.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="ms-comfy-admin">
        <div className="ms-channels-head">
          <div>
            <h3>ComfyUI 工作流</h3>
            <p className="ms-hint">导入后的工作流对 Agent 可见；变量与图片槽位从图里推断。</p>
          </div>
          <div className="ms-inline-actions">
            <Tag tone={comfyOnline ? 'ok' : 'danger'}>{comfyOnline ? '在线' : '离线'}</Tag>
            <Button size="sm" variant="ghost" icon="refresh" onClick={() => { void loadWorkflows() }}>刷新</Button>
          </div>
        </div>
        {loadingFlows ? <div className="ms-loading"><Spinner /> 读取中…</div> : null}
        {!loadingFlows && workflows.length === 0 ? <p className="ms-hint">还没有工作流。到「创作 → ComfyUI」导入一份 API 格式 JSON。</p> : null}
        <div className="ms-flow-list">
          {workflows.map(workflow => (
            <div className="ms-flow" key={workflow.workflowId}>
              <span className="ms-flow-name">{workflow.title}</span>
              <span className="ms-flow-slots">{workflow.slots.map(slot => slot.name).slice(0, 5).join(' · ')}</span>
              <label className="ms-check">
                <input
                  type="checkbox"
                  checked={workflow.enabled}
                  onChange={event => {
                    void api.updateWorkflow(workflow.workflowId, { enabled: event.target.checked }).then(updated => {
                      setWorkflows(current => current.map(item => item.workflowId === workflow.workflowId ? updated.workflow : item))
                    }).catch(error => notify(String(error), 'error'))
                  }}
                />
                可用
              </label>
              <button
                type="button"
                className="ms-text-btn danger"
                onClick={() => {
                  void api.deleteWorkflow(workflow.workflowId).then(() => {
                    setWorkflows(current => current.filter(item => item.workflowId !== workflow.workflowId))
                    notify('已删除工作流')
                  }).catch(error => notify(String(error), 'error'))
                }}
              >删除</button>
            </div>
          ))}
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="添加通道">
        <div className="ms-add-form">
          <Field label="协议族">
            <select className="ms-select" value={newKind} onChange={event => setNewKind(event.target.value as ChannelKind)}>
              {KINDS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="id" hint="模型调用时用的标识，小写英文"><input className="ms-input" value={newId} placeholder="my-gateway" onChange={event => setNewId(event.target.value)} /></Field>
          <Field label="显示名称"><input className="ms-input" value={newLabel} placeholder="我的中转站" onChange={event => setNewLabel(event.target.value)} /></Field>
          <div className="ms-submit-row">
            <Button variant="primary" onClick={addChannel}>添加</Button>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>取消</Button>
          </div>
        </div>
      </Modal>

      <Modal open={advancedOpen} onClose={() => setAdvancedOpen(false)} title="高级设置">
        <div className="ms-advanced">
          <Field label="输出目录" hint="留空 = <工作区>/media-studio；改完需重启 DSH">
            <input className="ms-input" value={outputDir} placeholder="D:\\ai\\media" onChange={event => setOutputDir(event.target.value)} />
          </Field>
          <Field label="ffmpeg 路径" hint="留空自动在 PATH / 常见目录里找；改完需重启 DSH">
            <input className="ms-input" value={ffmpegPath} placeholder="C:\\ffmpeg\\bin\\ffmpeg.exe" onChange={event => setFfmpegPath(event.target.value)} />
          </Field>
          <Field label="允许导入的额外目录" hint="逗号分隔；工作区与输出目录始终允许">
            <input className="ms-input" value={importRoots} placeholder="D:\\pictures, E:\\refs" onChange={event => setImportRoots(event.target.value)} />
          </Field>
          <div className="ms-submit-row">
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => {
                void saveAll(undefined, {
                  outputDir: outputDir.trim() === '' ? null : outputDir.trim(),
                  ffmpegPath: ffmpegPath.trim() === '' ? null : ffmpegPath.trim(),
                  importRoots: importRoots.split(',').map(item => item.trim()).filter(item => item !== ''),
                }).then(() => setAdvancedOpen(false))
              }}
            >保存</Button>
            <Button variant="ghost" onClick={() => setAdvancedOpen(false)}>取消</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
