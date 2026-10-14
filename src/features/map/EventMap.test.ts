import { describe, expect, it } from 'vitest'
import { eventCoordinates } from './coordinates'

describe('eventCoordinates', () => {
  const event = (extra: Record<string, unknown>) => ({ extra })
  it('uses source coordinates without guessing or geocoding missing locations', () => {
    expect(eventCoordinates(event({ lat: '37.5665', lng: '126.978' }))).toEqual([37.5665, 126.978])
    expect(eventCoordinates(event({}))).toBeNull()
    expect(eventCoordinates(event({ lat: '', lng: null }))).toBeNull()
    expect(eventCoordinates(event({ lat: 126.978, lng: 37.5665 }))).toBeNull()
  })
})
