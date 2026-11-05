/** 任务页：全部异步任务，支持筛选、取消、打开产物。 */
import { useMemo, useState } from 'react'

import type { AssetView, JobView } from '../types.js'
import { JobCard } from '../components.js'
import { Button, Empty, Segmented } from '../ui.js'
import { api } from '../api.js'

type Filter = 'all' | 'active' | 'done' | 'failed'

interface JobsProps {
  jobs: JobView[]
  onRefresh: () => void
  onOpenAsset: (asset: AssetView) => void
  notify: (text: string, tone?: 'info' | 'error' | 'ok') => void
}

export function JobsTab({ jobs, onRefresh, onOpenAsset, notify }: JobsProps): React.ReactElement {
  const [filter, setFilter] = useState<Filter>('all')
  const visible = useMemo(() => jobs.filter(job => {
    if (filter === 'active') return job.state === 'running' || job.state === 'queued'
    if (filter === 'done') return job.state === 'succeeded'
    if (filter === 'failed') return job.state === 'failed' || job.state === 'cancelled'
    return true
  }), [jobs, filter])

  return (
    <div className="ms-jobs">
      <div className="ms-toolbar">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: '全部' },
            { value: 'active', label: '进行中' },
            { value: 'done', label: '完成' },
            { value: 'failed', label: '失败' },
          ]}
        />
        <div className="ms-toolbar-right">
          <span className="ms-hint">{jobs.length} 条记录</span>
          <Button size="sm" variant="ghost" icon="refresh" onClick={onRefresh}>刷新</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty icon="clock" title="这里还没有任务" hint="在「创作」页提交一次生成，任务会出现在这里。" />
      ) : (
        <div className="ms-job-list">
          {visible.map(job => (
            <JobCard
              key={job.jobId}
              job={job}
              onCancel={() => { void api.cancelJob(job.jobId).then(() => { notify('已请求取消'); onRefresh() }).catch(error => notify(String(error), 'error')) }}
              onCollect={() => {
                void api.collectJob(job.jobId)
                  .then(result => { notify(`已取回 ${String(result.job.assets.length)} 个产物`, 'ok'); onRefresh() })
                  .catch(error => notify(error instanceof Error ? error.message : String(error), 'error'))
              }}
              onOpenAsset={onOpenAsset}
            />
          ))}
        </div>
      )}
    </div>
  )
}
