import type { RadarDataset, StoredEvent } from '../../services/types'
import { addDays, diffDays, displayDate } from '../calendar/dateUtils'

export const CATEGORY_COLORS: Record<string, string> = {
  classical: '#8b5cf6',
  concert: '#ec4899',
  theater: '#f97316',
  exhibition: '#14b8a6',
  festival: '#eab308',
  film: '#64748b',
  library: '#22c55e',
  class: '#0ea5e9',
  community: '#a855f7',
  running: '#ef4444',
  cycling: '#10b981',
  sports: '#f43f5e',
  tech: '#3b82f6',
  workation: '#06b6d4',
  social: '#f472b6',
  news: '#94a3b8',
}

export interface EventFilters {
  query: string
  categories: Set<string>
  minScore: number
  recommendedOnly: boolean
  showLong: boolean
  newOnly: boolean
  picksOnly: boolean
  pickIds: Set<string>
  today: string
  baseline: Record<string, string>
}

export function safeHttpUrl(value?: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function eventDate(e: StoredEvent): string | null {
  return (e.start || e.published || e.first_seen || null)?.slice(0, 10) ?? null
}

export function eventDays(e: StoredEvent): number {
  if (!e.start) return 0
  return Math.max(1, diffDays((e.end || e.start).slice(0, 10), e.start.slice(0, 10)) + 1)
}

export function isLongEvent(e: StoredEvent, minDays = 4): boolean {
  return eventDays(e) >= minDays
}

export function isSideLongProgram(e: StoredEvent, today: string): boolean {
  return e.kind !== 'news' && isLongEvent(e) && (e.end || e.start || '').slice(0, 10) >= today
}

export const DAY_GROUPS = ['문화', '문학', '운동', '커리어', '기타'] as const

export function dayGroup(e: StoredEvent): typeof DAY_GROUPS[number] {
  if (e.category === 'tech') return '커리어'
  if (e.category === 'library' || /독서|도서관|북토크|작가와의 만남|문학/.test(`${e.title} ${e.tags.join(' ')}`)) return '문학'
  if (['running', 'cycling', 'sports'].includes(e.category)) return '운동'
  if (['classical', 'concert', 'theater', 'exhibition', 'film', 'festival'].includes(e.category)) return '문화'
  return '기타'
}

export function isNewEvent(
  e: Pick<StoredEvent, 'source' | 'first_seen'>,
  today: string,
  baseline: Record<string, string> = {},
): boolean {
  const since = addDays(today, -7)
  const base = baseline[e.source] ?? ''
  return Boolean(e.first_seen && e.first_seen >= since && e.first_seen > base)
}

export function eventOverlapsDay(e: StoredEvent, day: string): boolean {
  if (!e.start) return false
  return e.start.slice(0, 10) <= day && (e.end || e.start).slice(0, 10) >= day
}

export function eventOverlapsRange(e: StoredEvent, start: string, end: string): boolean {
  if (!e.start) return false
  return e.start.slice(0, 10) <= end && (e.end || e.start).slice(0, 10) >= start
}

export function whenText(e: StoredEvent): string {
  if (!e.start) return e.published ? displayDate(e.published) : ''
  const start = displayDate(e.start)
  if (e.end && e.end.slice(0, 10) !== e.start.slice(0, 10)) return `${start} ~ ${displayDate(e.end)}`
  return start
}

export function passesFilters(e: StoredEvent, filters: EventFilters): boolean {
  const query = filters.query.trim().toLowerCase()
  if (query) {
    const hay = [
      e.title,
      e.venue,
      e.region,
      e.address,
      e.price,
      e.organizer,
      e.description,
      e.tags.join(' '),
      e.reasons.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!hay.includes(query)) return false
  }
  if (filters.categories.size > 0 && !filters.categories.has(e.category)) return false
  if (filters.newOnly && !isNewEvent(e, filters.today, filters.baseline)) return false
  if (filters.picksOnly && !filters.pickIds.has(e.id)) return false
  if (!filters.showLong && isLongEvent(e) && (e.start ?? '').slice(0, 10) < filters.today) return false
  const threshold = filters.recommendedOnly ? Math.max(filters.minScore, 4) : filters.minScore
  if (e.score < threshold && !e.alert && !filters.pickIds.has(e.id)) return false
  return true
}

export function categoryCounts(events: StoredEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1
    return acc
  }, {})
}

export function calendarEvents(events: StoredEvent[], filters: EventFilters, start: string, end: string, separateLong = false): StoredEvent[] {
  return events.filter((e) => e.kind !== 'news' && eventOverlapsRange(e, start, end) && (!separateLong || !isSideLongProgram(e, filters.today)) && passesFilters(e, filters))
}

export function calendarCategoryCounts(events: StoredEvent[], filters: EventFilters, start: string, end: string, separateLong = false): Record<string, number> {
  return categoryCounts(calendarEvents(events, { ...filters, categories: new Set() }, start, end, separateLong))
}

export function isRecentEvent(e: StoredEvent, today: string): boolean {
  const stamp = e.kind === 'news' ? e.published || e.first_seen : e.end || e.start
  return Boolean(stamp && stamp.slice(0, 10) >= addDays(today, -3))
}

export function sortChronologically(a: StoredEvent, b: StoredEvent): number {
  const stamp = (e: StoredEvent) => (e.kind === 'news' ? e.published || e.first_seen : e.start) || '9999'
  return stamp(a).localeCompare(stamp(b)) || b.score - a.score || a.title.localeCompare(b.title)
}

export function eventFlags(e: StoredEvent, data: RadarDataset, pickIds: Set<string>): string {
  return `${e.alert ? '🔔' : ''}${pickIds.has(e.id) ? '⭐' : ''}${isNewEvent(e, data.today, data.baseline) ? '🆕' : ''}`
}

export function sortEvents(a: StoredEvent, b: StoredEvent): number {
  if (a.alert !== b.alert) return a.alert ? -1 : 1
  const ad = eventDate(a) ?? '9999-99-99'
  const bd = eventDate(b) ?? '9999-99-99'
  if (ad !== bd) return ad < bd ? -1 : 1
  return b.score - a.score
}
