/** Reusable bits: asset tiles, job cards, reference rows. */
import type { AssetView, JobView } from './types.js'
import { Icon } from './icons.js'
import { bytes, stateLabel, when } from './ui.js'

export function AssetThumb({ asset, size = 'md' }: { asset: AssetView; size?: 'sm' | 'md' | 'lg' }): React.ReactElement {
  return (
    <div className={`ms-thumb ${size} ${asset.kind}`}>
      {asset.kind === 'image' || asset.kind === 'file' ? (
        <img src={asset.url} alt={asset.name} loading="lazy" />
      ) : asset.kind === 'video' ? (
        <>
          <video src={asset.url} preload="metadata" muted playsInline />
          <span className="ms-play"><Icon name="play" size={14} /></span>
        </>
      ) : (
        <span className="ms-file"><Icon name="film" size={18} /></span>
      )}
    </div>
  )
}

export function AssetTile(props: {
  asset: AssetView
  onClick?: () => void
  onFavorite?: () => void
  selected?: boolean
  footer?: React.ReactNode
}): React.ReactElement {
  const { asset } = props
  return (
    <div className={`ms-tile${props.selected === true ? ' on' : ''}`}>
      <button type="button" className="ms-tile-main" onClick={props.onClick} title={asset.prompt ?? asset.name}>
        <AssetThumb asset={asset} />
        <span className="ms-tile-meta">
          <span className="ms-tile-name">{asset.prompt?.slice(0, 60) ?? asset.name}</span>
          <span className="ms-tile-sub">
            {asset.kind === 'video' ? '视频' : '图片'} · {bytes(asset.bytes)}
            {asset.width === undefined ? '' : ` · ${String(asset.width)}×${String(asset.height)}`}
          </span>
        </span>
      </button>
      {props.onFavorite === undefined ? null : (
        <button
          type="button"
          className={`ms-star${asset.favorite ? ' on' : ''}`}
          onClick={props.onFavorite}
          title={asset.favorite ? '取消收藏' : '收藏'}
        >
          <Icon name="star" size={14} />
        </button>
      )}
      {props.footer}
    </div>
  )
}

export function JobStatePill({ state }: { state: string }): React.ReactElement {
  return <span className={`ms-state ${state}`}>{stateLabel(state)}</span>
}

export function JobCard(props: {
  job: JobView
  onCancel?: () => void
  onOpenAsset?: (asset: AssetView) => void
  onUseRef?: (asset: AssetView) => void
}): React.ReactElement {
  const { job } = props
  const busy = job.state === 'running' || job.state === 'queued'
  return (
    <div className={`ms-job ${job.state}`}>
      <div className="ms-job-head">
        <JobStatePill state={job.state} />
        <span className="ms-job-kind">{job.kind === 'image' ? '图像' : job.kind === 'video' ? '视频' : job.kind === 'storyboard' ? '分镜' : job.kind === 'concat' ? '拼接' : 'ComfyUI'}</span>
        {job.channel === undefined ? null : <span className="ms-job-channel">{job.channel}</span>}
        <span className="ms-job-time">{when(job.createdAt)}</span>
        {busy && props.onCancel !== undefined ? (
          <button type="button" className="ms-text-btn danger" onClick={props.onCancel}>取消</button>
        ) : null}
      </div>
      <div className="ms-job-prompt">{job.prompt ?? '（无提示词）'}</div>
      {busy ? (
        <div className="ms-job-progress">
          <span className="ms-progress-bar"><i /></span>
          <span>{job.progress ?? '等待上游…'}</span>
        </div>
      ) : null}
      {job.error === undefined || job.error === '' ? null : <div className="ms-job-error"><Icon name="alert" size={13} />{job.error}</div>}
      {job.shots !== undefined && job.shots.length > 0 ? (
        <ol className="ms-shots">
          {job.shots.map(shot => (
            <li key={shot.index} className={shot.state}>
              <span className="ms-shot-index">{shot.index + 1}</span>
              <span className="ms-shot-prompt">{shot.prompt}</span>
              <span className="ms-shot-state">{stateLabel(shot.state)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {job.assets.length > 0 ? (
        <div className="ms-job-assets">
          {job.assets.map(asset => (
            <AssetTile
              key={asset.id}
              asset={asset}
              onClick={() => props.onOpenAsset?.(asset)}
              footer={props.onUseRef === undefined ? undefined : (
                <button type="button" className="ms-tile-action" onClick={() => props.onUseRef?.(asset)}>作参考</button>
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
