/**
 * Host entry: one service, one HTTP prefix, nine tools.
 *
 * The plugin deliberately imports nothing from `@deepseek-ai/*`: everything it
 * needs (tools, webServer, attachments, workspace location) is reached through
 * `ctx.get(...)`, so the same build works for a linked checkout and an installed
 * tarball whose physical path is outside the profile's node_modules.
 */
import type { HostContext } from './types.js'
import { StudioService, API_BASE } from './studio.js'
import { createRoutes } from './routes.js'
import { registerTools } from './tools.js'
import { ensureDataLayout } from './config.js'

export const name = 'dsh-media-studio'

/** `tools` for the agent surface; `webServer` for the panel. */
export const inject = ['webServer', 'tools']

interface Shared {
  service?: StudioService
  disposeHttp?: () => void
  warned?: boolean
}

const SHARED_PROP = '__dshMediaStudio'

function sharedOf(ctx: HostContext): Shared {
  const anchor = ((ctx.root ?? ctx) as Record<string, Shared | undefined>)
  let slot = anchor[SHARED_PROP]
  if (slot === undefined) {
    slot = {}
    anchor[SHARED_PROP] = slot
  }
  return slot
}

export function apply(ctx: HostContext, config: unknown): void {
  const shared = sharedOf(ctx)
  ensureDataLayout()
  let service = shared.service
  if (service === undefined) {
    service = new StudioService(ctx, config)
    shared.service = service
  } else {
    service.setEntryConfig(config)
  }

  const server = ctx.get?.('webServer') as { register?: (route: unknown) => (() => void) | void } | undefined
  if (server === undefined || typeof server.register !== 'function') {
    service.logger.warn('[media-studio] 拿不到 webServer，面板接口未注册')
  } else if (shared.disposeHttp === undefined) {
    try {
      const routes = createRoutes(service, ctx)
      const dispose = server.register({ kind: 'prefix', path: API_BASE, handler: routes.dispatch })
      shared.disposeHttp = typeof dispose === 'function' ? dispose : () => undefined
      service.logger.info(`[media-studio] API 就绪：${API_BASE}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('duplicate prefix route')) {
        service.logger.info('[media-studio] HTTP 前缀已存在（热重载），沿用现有实例')
      } else {
        service.logger.warn(`[media-studio] 注册 HTTP 前缀失败：${message}`)
      }
    }
  }

  const tools = ctx.get?.('tools') as { register?: (spec: unknown) => (() => void) | void } | undefined
  if (tools === undefined || typeof tools.register !== 'function') {
    service.logger.warn('[media-studio] 拿不到 tools 服务，Agent 工具未注册')
  } else {
    const report = registerTools(service, ctx, { register: spec => tools.register!(spec) })
    for (const failure of report.failed) service.logger.warn(`[media-studio] 工具 ${failure.name} 未注册：${failure.message}`)
    service.logger.info(`[media-studio] 已注册工具：${report.registered.join(', ')}`)
  }

  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      shared.disposeHttp?.()
      shared.disposeHttp = undefined
    }, 'media-studio: http')
  }
}

export { StudioService, API_BASE } from './studio.js'
export { createRoutes } from './routes.js'
export { inferSurface, applyVars, assertApiWorkflow, listWorkflows, saveWorkflow, getWorkflow } from './comfy.js'
export { mergeConfig, emptyConfig, resolveChannel } from './config.js'
export { AssetLibrary } from './library.js'
export { JobManager } from './jobs.js'
export { concatVideos, detectFfmpeg } from './ffmpeg.js'
export { buildTools, jobView, assetView, sanitizeToolValue } from './tools.js'
