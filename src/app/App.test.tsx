import { render, screen } from '@testing-library/react'
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
})
