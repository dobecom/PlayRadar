export type EventKind = 'event' | 'program' | 'news'

export interface StoredEvent {
  id: string
  source: string
  title: string
  url: string
  category: string
  kind: EventKind
  start?: string | null
  end?: string | null
  venue?: string | null
  address?: string | null
  region?: string | null
  price?: string | null
  organizer?: string | null
  description?: string | null
  image?: string | null
  booking_open?: string | null
  booking_close?: string | null
  published?: string | null
  tags: string[]
  extra: Record<string, unknown>
  score: number
  reasons: string[]
  alert: boolean
  first_seen: string
}

export interface SourceHealth {
  id: string
  name: string
  group: string
  homepage: string
  status: 'ok' | 'limited' | 'error' | 'disabled'
  count: number
  error: string | null
  missingEnv: string[]
  durationMs: number
  baselineAt: string | null
  lastRunAt: string | null
  lastSuccessAt: string | null
}

export interface RadarDataset {
  exclusionNotice?: string
  favorites?: string[]
  holidays?: Record<string, string>
  today: string
  generated: string | null
  running: boolean
  categories: Record<string, string>
  baseline: Record<string, string>
  sources: SourceHealth[]
  picks: string[]
  events: StoredEvent[]
}

export interface SourceInfo {
  id: string
  name: string
  homepage: string
  group: string
  requiresEnv: string[]
  description: string
  enabled: boolean
  configured: boolean
  health: SourceHealth | null
}

export interface SourcesResponse {
  sources: SourceInfo[]
  channels: string[]
  connections: Array<{ name: string; homepage: string; status: string; purpose: string; needs: string[] }>
}

export interface RunRecord {
  id: number
  trigger: string
  status: 'running' | 'ok' | 'error'
  onlySources: string[]
  rawCount: number
  eventCount: number
  errorCount: number
  message: string | null
  startedAt: string
  finishedAt: string | null
}

export interface LatestRunResponse {
  run: RunRecord | null
  running: boolean
}

export interface PickRecord {
  eventId: string
  title: string
  start: string | null
  url: string
  createdAt: string
}

export interface ProfileResponse {
  yaml: string
  origin: 'database' | 'example'
  updatedAt: string | null
}

export type DigestKind = 'daily' | 'weekly' | 'monthly'

export interface DigestResponse {
  kind: DigestKind
  message: string
  items: number
  channels: string[]
}

export interface DigestSendResponse {
  kind: DigestKind
  sent: string[]
  marked: number
  empty: boolean
}

export interface CalendarFeedResponse {
  scopes: Array<{ scope: 'picks' | 'alerts' | 'recommended'; path: string }>
}
