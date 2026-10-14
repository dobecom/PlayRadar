import { describe, expect, it } from 'vitest'
import type { StoredEvent } from '../../services/types'
import { calendarCategoryCounts, calendarEvents, dayGroup, eventOverlapsDay, isLongEvent, isNewEvent, isRecentEvent, passesFilters, sortChronologically } from './eventUtils'

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

  it('counts exactly the displayed month candidates, ignoring only the category selection', () => {
    const events = [
      baseEvent,
      { ...baseEvent, id: 'later', category: 'workation', start: '2026-11-03', end: '2026-11-03' },
      { ...baseEvent, id: 'news', category: 'workation', kind: 'news' as const },
      { ...baseEvent, id: 'ongoing', category: 'exhibition', start: '2026-09-20', end: '2026-10-20' },
    ]
    const active = { ...filters, showLong: false, categories: new Set(['workation']) }
    expect(calendarCategoryCounts(events, active, '2026-10-01', '2026-10-31')).toEqual({ concert: 1 })
    expect(calendarEvents(events, { ...active, categories: new Set() }, '2026-10-01', '2026-10-31')).toHaveLength(1)
    expect(calendarCategoryCounts(events, { ...active, showLong: true }, '2026-10-01', '2026-10-31')).toEqual({ concert: 1, exhibition: 1 })
    expect(calendarCategoryCounts(events, { ...active, query: '불일치' }, '2026-10-01', '2026-10-31')).toEqual({})
  })

  it('includes the three-day boundary, uses published dates, and sorts full timestamps rather than alerts', () => {
    const old = { ...baseEvent, kind: 'news' as const, published: '2026-09-28T12:00', first_seen: '2026-10-02T09:00' }
    const early = { ...old, published: '2026-09-29T09:00', alert: false }
    const late = { ...old, published: '2026-09-29T18:00', alert: true }
    expect(isRecentEvent(old, '2026-10-02')).toBe(false)
    expect(isRecentEvent(early, '2026-10-02')).toBe(true)
    expect([late, early].sort(sortChronologically)).toEqual([early, late])
    expect(isRecentEvent({ ...baseEvent, start: null, end: null }, '2026-10-02')).toBe(false)
  })
  it('separates both future and ongoing long programs from calendar counts and day items', () => {
    const events = [baseEvent, { ...baseEvent, start: '2026-10-20', end: '2026-11-20' }, { ...baseEvent, start: '2026-09-20', end: '2026-10-20' }]
    expect(calendarEvents(events, filters, '2026-10-01', '2026-10-31', true)).toEqual([baseEvent])
    expect(calendarCategoryCounts(events, filters, '2026-10-01', '2026-10-31', true)).toEqual({ concert: 1 })
  })
  it.each([['concert', '문화'], ['exhibition', '문화'], ['library', '문학'], ['running', '운동'], ['cycling', '운동'], ['tech', '커리어'], ['community', '기타']])('groups %s as %s', (category, group) => {
    expect(dayGroup({ ...baseEvent, category })).toBe(group)
  })
  it('recognizes reading programs outside the library category', () => {
    expect(dayGroup({ ...baseEvent, category: 'class', title: '작가와의 만남' })).toBe('문학')
  })
})
