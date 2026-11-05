/**
 * Browser entry. Registers the panel in two host slots:
 *
 *   sidebar.panellist  — the icon in DSH's left rail
 *   main               — the page that icon switches to (same key)
 *
 * plus an optional tab when dsh-better-sidebar is installed. The bundle is
 * wrapped in `window.__ModuleLoader__.load` by scripts/build.mjs, so this file
 * must only import react (injected by the host loader).
 */
import { Studio } from './Studio.js'
import { Icon } from './icons.js'

export const name = 'dsh-media-studio'

/** Only slots are required; betterSidebar is optional. */
export const inject = ['slots']

interface ClientContext {
  get: (name: string) => any
  inject: (names: string[], run: (scope: any) => void) => void
}

interface SlotRegistry {
  inject: (name: string, register: () => () => void) => void
  register: (options: Record<string, unknown>, component: unknown) => () => void
}

const PANEL_ID = 'media-studio'
const TAB_ID = 'media-studio:studio'

/** Panel icon, shared by the rail, the page and the optional sidebar tab. */
function PanelIcon({ size }: { size?: number }): React.ReactElement {
  return (
    <span style={{ display: 'grid', placeItems: 'center' }}>
      <Icon name="layers" size={size ?? 18} />
    </span>
  )
}

export function apply(ctx: ClientContext): void {
  // better-sidebar is optional: without it, inject never resolves.
  ctx.inject(['betterSidebar'], (scope: any) => {
    scope.effect(() => {
      const service = scope.betterSidebar
      const dispose: () => void = service.registerTab({
        id: TAB_ID,
        title: () => '媒体工作台',
        description: () => '图像、视频与 ComfyUI 任务',
        icon: (size?: number) => <Icon name="layers" size={size ?? 16} />,
        order: 41,
        single: true,
        component: (props?: { visible?: boolean }) => <Studio visible={props?.visible !== false} />,
      })
      return () => { dispose() }
    }, 'media-studio: better-sidebar tab')
  })

  const slots = ctx.get('slots') as SlotRegistry | undefined
  if (slots === undefined) {
    console.warn('[media-studio] 拿不到 slots 服务，面板未注册。')
    return
  }

  slots.inject('sidebar.panellist', () => slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 41,
    label: () => '媒体工作台',
  }, (props: { size?: number }) => <PanelIcon size={props?.size} />))

  slots.inject('main', () => slots.register({
    name: 'main',
    key: PANEL_ID,
  }, () => <Studio visible />))

  console.info('[media-studio] 已注册侧栏入口与主面板')
}

/** Render helper for the SSR smoke test (tests/render.test.mjs). */
export const __test = { Studio, PanelIcon }
