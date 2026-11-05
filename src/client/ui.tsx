/** Small presentational primitives shared by the four tabs. */
import { useEffect, type ReactNode } from 'react'

import { Icon, type IconName } from './icons.js'

export function Button(props: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'soft'
  size?: 'sm' | 'md'
  disabled?: boolean
  title?: string
  icon?: IconName
  type?: 'button' | 'submit'
}): React.ReactElement {
  return (
    <button
      type={props.type ?? 'button'}
      className={`ms-btn ${props.variant ?? 'soft'} ${props.size ?? 'md'}`}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
    >
      {props.icon === undefined ? null : <Icon name={props.icon} size={props.size === 'sm' ? 13 : 15} />}
      <span>{props.children}</span>
    </button>
  )
}

export function Field(props: { label: string; children: ReactNode; hint?: string; right?: ReactNode }): React.ReactElement {
  return (
    <label className="ms-field">
      <span className="ms-field-label">
        <span>{props.label}</span>
        {props.right}
      </span>
      {props.children}
      {props.hint === undefined ? null : <span className="ms-hint">{props.hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>(props: {
  value: T
  options: Array<{ value: T; label: string; icon?: IconName }>
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}): React.ReactElement {
  return (
    <div className={`ms-seg ${props.size ?? 'md'}`} role="tablist">
      {props.options.map(option => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={props.value === option.value}
          className={props.value === option.value ? 'on' : ''}
          onClick={() => props.onChange(option.value)}
        >
          {option.icon === undefined ? null : <Icon name={option.icon} size={14} />}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Spinner({ size = 14 }: { size?: number }): React.ReactElement {
  return <span className="ms-spinner" style={{ width: size, height: size }} aria-label="加载中" />
}

export function Empty(props: { icon?: IconName; title: string; hint?: string; children?: ReactNode }): React.ReactElement {
  return (
    <div className="ms-empty">
      {props.icon === undefined ? null : <Icon name={props.icon} size={26} />}
      <div className="ms-empty-title">{props.title}</div>
      {props.hint === undefined ? null : <div className="ms-empty-hint">{props.hint}</div>}
      {props.children}
    </div>
  )
}

export function Modal(props: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }): React.ReactElement | null {
  useEffect(() => {
    if (!props.open) return undefined
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.open, props.onClose])
  if (!props.open) return null
  return (
    <div className="ms-modal-mask" onMouseDown={event => { if (event.target === event.currentTarget) props.onClose() }}>
      <div className={`ms-modal${props.wide === true ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <header className="ms-modal-head">
          <span>{props.title ?? ''}</span>
          <button type="button" className="ms-icon-btn" onClick={props.onClose} aria-label="关闭"><Icon name="close" size={16} /></button>
        </header>
        <div className="ms-modal-body">{props.children}</div>
      </div>
    </div>
  )
}

export function Tag(props: { children: ReactNode; tone?: 'accent' | 'muted' | 'danger' | 'ok' }): React.ReactElement {
  return <span className={`ms-tag ${props.tone ?? 'muted'}`}>{props.children}</span>
}

export function bytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  let size = value
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1 }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function when(value: string | number | undefined): string {
  if (value === undefined) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${String(Math.floor(diff / 60_000))} 分钟前`
  if (diff < 86_400_000) return `${String(Math.floor(diff / 3_600_000))} 小时前`
  return `${String(date.getMonth() + 1)}/${String(date.getDate())} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function stateLabel(state: string): string {
  switch (state) {
    case 'queued': return '排队'
    case 'running': return '进行中'
    case 'succeeded': return '完成'
    case 'failed': return '失败'
    case 'cancelled': return '已取消'
    default: return state
  }
}
