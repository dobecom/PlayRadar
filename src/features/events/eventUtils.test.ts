import { describe, expect, it } from 'vitest'
import type { StoredEvent } from '../../services/types'
import { eventOverlapsDay, isLongEvent, isNewEvent, passesFilters } from './eventUtils'

const baseEvent: StoredEvent = {
  id: 'aaaaaaaaaaaaaaaa',
  source: 'sample',
  title: '테스트 콘서트',
  url: 'https://example.com/event',
  category: 'concert',
  kind: 'event',
  start: '2026-10-03',
  end: '2026-10-03',
  venue: '공연장',
  address: null,
  region: '서울',
  price: '무료',
  organizer: '샘플',
  description: '현악 공연',
  image: null,
  booking_open: null,
  booking_close: null,
  published: null,
  tags: ['music'],
  extra: {},
  score: 5,
  reasons: ['관심 태그'],
  alert: false,
  first_seen: '2026-10-01T09:00',
}

const filters = {
  query: '',
  categories: new Set<string>(),
  minScore: 2,
  recommendedOnly: false,
  showLong: true,
  newOnly: false,
  picksOnly: false,
  pickIds: new Set<string>(),
  today: '2026-10-02',
  baseline: { sample: '2026-09-30T00:00' },
}

describe('event filter helpers', () => {
  it('matches server isNew semantics with a seven-day window and source baseline', () => {
    expect(isNewEvent(baseEvent, '2026-10-02', { sample: '2026-09-30T00:00' })).toBe(true)
    expect(isNewEvent(baseEvent, '2026-10-02', { sample: '2026-10-02T00:00' })).toBe(false)
    expect(isNewEvent({ ...baseEvent, first_seen: '2026-09-20T00:00' }, '2026-10-02', {})).toBe(false)
  })

  it('filters by category, score, search, new-only, and picks-only', () => {
    expect(passesFilters(baseEvent, filters)).toBe(true)
    expect(passesFilters(baseEvent, { ...filters, query: '현악' })).toBe(true)
    expect(passesFilters(baseEvent, { ...filters, categories: new Set(['classical']) })).toBe(false)
    expect(passesFilters(baseEvent, { ...filters, minScore: 8 })).toBe(false)
    expect(passesFilters(baseEvent, { ...filters, newOnly: true })).toBe(true)
    expect(passesFilters(baseEvent, { ...filters, picksOnly: true })).toBe(false)
    expect(passesFilters(baseEvent, { ...filters, picksOnly: true, pickIds: new Set([baseEvent.id]) })).toBe(true)
  })

  it('detects long inclusive events and day overlap', () => {
    const longEvent = { ...baseEvent, start: '2026-10-01', end: '2026-10-05' }
    expect(isLongEvent(longEvent)).toBe(true)
    expect(eventOverlapsDay(longEvent, '2026-10-04')).toBe(true)
    expect(eventOverlapsDay(longEvent, '2026-10-06')).toBe(false)
  })
})
