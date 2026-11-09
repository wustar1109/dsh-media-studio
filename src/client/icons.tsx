/** Inline icons: no icon package, no extra bundle weight. */
import type { JSX } from 'react'

export type IconName =
  | 'sparkles' | 'film' | 'grid' | 'plug' | 'close' | 'play' | 'star'
  | 'trash' | 'refresh' | 'upload' | 'download' | 'check' | 'alert' | 'plus'
  | 'image' | 'clock' | 'settings' | 'folder' | 'link' | 'chevron' | 'layers'
  | 'paint' | 'expand' | 'crop'

const PATHS: Record<IconName, JSX.Element> = {
  sparkles: <><path d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7L12 3Z" /><path d="M18.5 14.5l.9 2.4 2.1.8-2.1.8-.9 2.4-.9-2.4-2.1-.8 2.1-.8.9-2.4Z" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.6" /><rect x="14" y="3" width="7" height="7" rx="1.6" /><rect x="3" y="14" width="7" height="7" rx="1.6" /><rect x="14" y="14" width="7" height="7" rx="1.6" /></>,
  plug: <><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-6 6v0a6 6 0 0 1-6-6V8ZM12 17v4" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5.5v13l11-6.5-11-6.5Z" />,
  star: <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8L12 3.6Z" />,
  trash: <><path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.5h9.4L17.5 7" /><path d="M10 11v5M14 11v5" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  check: <path d="M4.5 12.5l5 5L20 6.5" />,
  alert: <><path d="M12 3.5L22 20H2L12 3.5Z" /><path d="M12 9v5M12 17v.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M4 18l5-5 4 4 3-3 4 4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.2 2" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M12 3.5l1 2.6 2.6-1 1 2.1 2.7.4-.4 2.7 1.9 1.9-1.9 1.9.4 2.7-2.7.4-1 2.1-2.6-1-1 2.6-1-2.6-2.6 1-1-2.1-2.7-.4.4-2.7L2.2 12l1.9-1.9-.4-2.7 2.7-.4 1-2.1 2.6 1 1-2.6Z" /></>,
  folder: <path d="M3 6.5A2 2 0 0 1 5 4.5h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11Z" />,
  link: <><path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.3 1.3" /><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.3-1.3" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  layers: <><path d="M12 3l9 5-9 5-9-5 9-5Z" /><path d="M3 12l9 5 9-5M3 16l9 5 9-5" /></>,
  paint: <><path d="M3 21v-4.2L12.8 7a2.05 2.05 0 0 1 2.9 2.9L6 20.8H3Z" /><path d="M11.2 8.5l4.3 4.3" /></>,
  expand: <><path d="M4 4v3M4 7h3M20 4v3M20 7h-3M4 20v-3M4 17h3M20 20v-3M20 17h-3" /><rect x="8" y="8" width="8" height="8" rx="1" /></>,
  crop: <><path d="M7 2v20M17 2v20M2 7h20M2 17h20" /><rect x="7" y="7" width="10" height="10" /></>,
}

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
