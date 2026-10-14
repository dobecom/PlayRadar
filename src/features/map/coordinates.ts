import type { StoredEvent } from '../../services/types'

export function eventCoordinates(event: Pick<StoredEvent, 'extra'>): [number, number] | null {
  const lat = typeof event.extra.lat === 'string' || typeof event.extra.lat === 'number' ? Number(event.extra.lat) : NaN
  const lng = typeof event.extra.lng === 'string' || typeof event.extra.lng === 'number' ? Number(event.extra.lng) : NaN
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132 ? [lat, lng] : null
}
