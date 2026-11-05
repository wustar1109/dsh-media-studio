/** Shell: config loading, job polling, toasts and the four tabs. */
import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from './api.js'
import type { AssetView, ConfigView, JobView, StatsView } from './types.js'
import { Icon, type IconName } from './icons.js'
import { bytes, Spinner } from './ui.js'
import { CreateTab } from './tabs/CreateTab.js'
import { JobsTab } from './tabs/JobsTab.js'
import { LibraryTab } from './tabs/LibraryTab.js'
import { ChannelsTab } from './tabs/ChannelsTab.js'
import CSS from './styles.css'

type TabId = 'create' | 'jobs' | 'library' | 'channels'

const TABS: Array<{ id: TabId; label: string; icon: IconName }> = [
  { id: 'create', label: '创作', icon: 'sparkles' },
  { id: 'jobs', label: '任务', icon: 'clock' },
  { id: 'library', label: '素材库', icon: 'grid' },
  { id: 'channels', label: '通道', icon: 'plug' },
]

interface Toast {
  id: number
  text: string
  tone: 'info' | 'error' | 'ok'
}

export interface StudioProps {
  visible: boolean
}

export function Studio({ visible }: StudioProps): React.ReactElement {
  const [tab, setTab] = useState<TabId>('create')
  const [config, setConfig] = useState<ConfigView | null>(null)
  const [jobs, setJobs] = useState<JobView[]>([])
  const [stats, setStats] = useState<StatsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [useRefAsset, setUseRefAsset] = useState<{ asset: AssetView; nonce: number } | null>(null)
  const [focusAsset, setFocusAsset] = useState<string | null>(null)
  const [libraryVersion, setLibraryVersion] = useState(0)
  const toastTimer = useRef<number | undefined>(undefined)
  const active = jobs.filter(job => job.state === 'running' || job.state === 'queued').length

  const notify = useCallback((text: string, tone: 'info' | 'error' | 'ok' = 'info') => {
    setToast({ id: Date.now(), text, tone })
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 6000 : 3200)
  }, [])

  const refreshConfig = useCallback(async () => {
    try {
      const result = await api.config()
      setConfig(result.config)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshJobs = useCallback(async () => {
    try {
      const result = await api.jobs('?limit=40')
      setJobs(result.jobs)
    } catch {
      // the panel keeps working with the previous list
    }
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      setStats(await api.stats())
    } catch {
      // stats are decorative
    }
  }, [])

  useEffect(() => {
    void refreshConfig()
    void refreshJobs()
    void refreshStats()
  }, [refreshConfig, refreshJobs, refreshStats])

  useEffect(() => {
    if (!visible) return undefined
    const timer = window.setInterval(() => {
      void refreshJobs()
      void refreshStats()
    }, 2500)
    return () => window.clearInterval(timer)
  }, [visible, refreshJobs, refreshStats])

  const openAsset = (asset: AssetView): void => {
    setFocusAsset(asset.id)
    setLibraryVersion(value => value + 1)
    setTab('library')
  }

  const useAsReference = (asset: AssetView): void => {
    setUseRefAsset({ asset, nonce: Date.now() })
    setTab('create')
  }

  return (
    <div className="ms-root">
      <style>{CSS}</style>
      <header className="ms-header">
        <div className="ms-brand">
          <span className="ms-brand-mark"><Icon name="layers" size={17} /></span>
          <div className="ms-brand-text">
            <strong>媒体工作台</strong>
            <span>{config === null ? '正在连接宿主…' : `${config.channels.filter(channel => channel.ready).length} 个通道就绪 · ${bytes(stats?.bytes ?? 0)} 素材`}</span>
          </div>
        </div>
        <div className="ms-header-meta">
          {active > 0 ? <span className="ms-live"><Spinner size={11} />{active} 个任务进行中</span> : null}
          <button type="button" className="ms-icon-btn" title="刷新" onClick={() => { void refreshConfig(); void refreshJobs(); void refreshStats() }}>
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </header>

      <nav className="ms-tabs" role="tablist" aria-label="工作台页签">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`ms-tab${tab === item.id ? ' on' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <Icon name={item.icon} size={15} />
            <span>{item.label}</span>
            {item.id === 'jobs' && active > 0 ? <em>{active}</em> : null}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="ms-loading"><Spinner size={18} /> 正在载入配置…</div>
      ) : error !== null ? (
        <div className="ms-error">
          <Icon name="alert" size={18} />
          <div>
            <strong>宿主接口没响应</strong>
            <p>{error}</p>
            <p className="ms-hint">确认插件已启用；面板地址是 /media-studio/api。</p>
          </div>
        </div>
      ) : (
        <div className="ms-body">
          {tab === 'create' && config !== null ? (
            <CreateTab
              channels={config.channels}
              config={config}
              useRefAsset={useRefAsset}
              onConsumeRef={() => setUseRefAsset(null)}
              notify={notify}
              onProduced={() => { void refreshJobs(); void refreshStats(); setLibraryVersion(value => value + 1) }}
              onOpenJobs={() => setTab('jobs')}
            />
          ) : null}
          {tab === 'jobs' ? (
            <JobsTab jobs={jobs} onRefresh={() => { void refreshJobs(); void refreshStats() }} onOpenAsset={openAsset} notify={notify} />
          ) : null}
          {tab === 'library' ? (
            <LibraryTab
              focusAssetId={focusAsset}
              version={libraryVersion}
              onUseAsReference={useAsReference}
              notify={notify}
              onChanged={() => { void refreshStats(); setLibraryVersion(value => value + 1) }}
              onOpenJobs={() => setTab('jobs')}
            />
          ) : null}
          {tab === 'channels' && config !== null ? (
            <ChannelsTab config={config} onSaved={() => { void refreshConfig() }} notify={notify} />
          ) : null}
        </div>
      )}

      {toast === null ? null : (
        <div className={`ms-toast ${toast.tone}`} key={toast.id}>
          <Icon name={toast.tone === 'error' ? 'alert' : toast.tone === 'ok' ? 'check' : 'sparkles'} size={14} />
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  )
}
