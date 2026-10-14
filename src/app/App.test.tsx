import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import type { RadarDataset } from '../services/types'

const dataset: RadarDataset = {
  today: '2026-10-02',
  generated: '2026-10-02T08:00:00.000Z',
  running: false,
  categories: { concert: '콘서트/대중음악' },
  baseline: { sample: '2026-09-30T00:00' },
  sources: [{ id: 'sample', name: '샘플 소스', group: 'sample', homepage: 'https://example.com', status: 'ok', count: 1, error: null, missingEnv: [], durationMs: 10, baselineAt: '2026-09-30T00:00', lastRunAt: '2026-10-02T08:00:00.000Z', lastSuccessAt: '2026-10-02T08:00:00.000Z' }],
  picks: [],
  events: [{ id: 'aaaaaaaaaaaaaaaa', source: 'sample', title: '샘플 콘서트', url: 'https://example.com/event', category: 'concert', kind: 'event', start: '2026-10-03', end: '2026-10-03', venue: '샘플홀', address: null, region: '서울', price: '무료', organizer: '샘플', description: '샘플 설명', image: null, booking_open: null, booking_close: null, published: null, tags: [], extra: {}, score: 5, reasons: ['추천'], alert: true, first_seen: '2026-10-01T09:00' }],
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn())
    window.history.pushState({}, '', '/')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(dataset), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the calendar from mocked events', async () => {
    render(<App />)
    expect(await screen.findByText('2026년 10월')).toBeInTheDocument()
    expect(screen.getAllByText(/샘플 콘서트/).length).toBeGreaterThan(0)
    expect(fetch).toHaveBeenCalledWith('/api/v1/playradar/events', expect.objectContaining({ credentials: 'same-origin' }))
  })

  it('uses the new login branding and copy', () => {
    window.history.pushState({}, '', '/login')
    render(<App />)
    expect(screen.getByLabelText('Access Key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Access' })).toBeInTheDocument()
    expect(screen.queryByText(/개인 일정 레이더/)).not.toBeInTheDocument()
    expect(screen.getByText('☀️')).toBeInTheDocument()
  })

  it('loads version history independently of an unavailable event snapshot', async () => {
    window.history.pushState({}, '', '/version')
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/versions') ? new Response(JSON.stringify([{ version: 'v1.0.0', description: 'Release', releasedAt: '2026-10-14T02:00:00Z', sourceRevision: null }]), { status: 200 }) : new Response('Unavailable', { status: 503 })))
    render(<App />)
    expect(await screen.findByText('v1.0.0')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '불러오지 못했습니다' })).not.toBeInTheDocument()
  })

  it('resets filters and opens an expanded day page from the calendar overflow', async () => {
    const events = Array.from({ length: 8 }, (_, i) => ({ ...dataset.events[0], id: String(i), title: `일정 ${i}`, alert: false }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...dataset, events }), { status: 200 })))
    render(<App />)
    await screen.findByText('2026년 10월')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '존재하지 않음' } })
    expect(screen.queryByRole('button', { name: '+2 더보기' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '초기화' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: '+2 더보기' }))
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
    expect(await screen.findByRole('heading', { name: '10/3(토) 일정 · 8건' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '상세정보' })).toHaveLength(8)
    for (const name of ['문화 8', '문학 0', '운동 0', '커리어 0', '기타 0']) expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: '상세정보' })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('separates long programs and shows only the selected month favorites with an exclusion notice', async () => {
    const events = [
      dataset.events[0],
      { ...dataset.events[0], id: 'long', title: '장기 전시', start: '2026-10-01', end: '2026-10-30', alert: false },
      { ...dataset.events[0], id: 'future', title: '다음달 관심 공연', start: '2026-11-03', end: '2026-11-03' },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...dataset, events, favorites: [events[0].id, 'long', 'future'], exclusionNotice: '제외 규칙 안내' }), { status: 200 })))
    const { container } = render(<App />)
    await screen.findByText('2026년 10월')
    expect(screen.getByRole('note')).toHaveTextContent('제외 규칙 안내')
    expect(container.querySelector('.calendar-grid')).not.toHaveTextContent('장기 전시')
    const favorites = container.querySelector('.favorite-events')!
    expect(within(favorites as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
    expect(favorites).not.toHaveTextContent('다음달 관심 공연')
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
    expect(favorites).toHaveTextContent('다음달 관심 공연')
    expect(favorites).not.toHaveTextContent('장기 전시')
  })

  it('excludes stale news and expands each topic after ten items in timestamp order', async () => {
    window.history.pushState({}, '', '/news')
    const events = Array.from({ length: 12 }, (_, i) => ({
      ...dataset.events[0], id: `news${i}`, title: `새 기사 ${i}`, kind: 'news', start: null, end: null,
      published: `2026-10-01T${String(23 - i).padStart(2, '0')}:00`, extra: { topic: '클래식' },
    }))
    events.push({ ...events[0], id: 'old', title: '오래된 기사', published: '2026-09-28T09:00' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...dataset, events }), { status: 200 })))
    render(<App />)
    const topic = (await screen.findByRole('heading', { name: '클래식 12' })).closest('section')!
    expect(within(topic).getAllByRole('listitem')).toHaveLength(10)
    expect(screen.queryByText(/오래된 기사/)).not.toBeInTheDocument()
    expect(within(topic).getAllByRole('button')[0]).toHaveTextContent('새 기사 11')
    fireEvent.click(within(topic).getByRole('button', { name: '더보기 (2)' }))
    expect(within(topic).getAllByRole('listitem')).toHaveLength(12)
    fireEvent.click(within(topic).getByRole('button', { name: '접기' }))
    expect(within(topic).getAllByRole('listitem')).toHaveLength(10)
  })
})
