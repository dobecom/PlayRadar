import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VersionPage } from './VersionPage'

afterEach(() => vi.unstubAllGlobals())
describe('VersionPage', () => {
  it('loads persistent versions and distinguishes uncommitted local releases', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ version: 'v1.0.0', description: 'Updated calendar', sourceRevision: null, releasedAt: '2026-10-14T02:00:00Z' }]), { status: 200 })))
    render(<VersionPage />)
    expect(await screen.findByText('v1.0.0')).toBeInTheDocument()
    expect(screen.getByText('Updated calendar')).toBeInTheDocument()
    expect(screen.getByText('Local working tree (uncommitted)')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/v1/playradar/versions', expect.objectContaining({ credentials: 'same-origin' }))
  })
  it('shows an explicit error rather than an empty success on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unavailable', { status: 503 })))
    render(<VersionPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable')
  })
})
