import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { StoredEvent } from '../../services/types'
import { CATEGORY_COLORS, whenText } from '../events/eventUtils'
import { eventCoordinates } from './coordinates'

export function EventMap({ events, onOpen }: { events: StoredEvent[]; onOpen: (event: StoredEvent) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const [tileError, setTileError] = useState(false)
  useEffect(() => {
    if (!container.current) return
    const map = L.map(container.current).setView([37.5665, 126.978], 11)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      referrerPolicy: 'strict-origin-when-cross-origin',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    tiles.on('tileerror', () => setTileError(true))
    const locations = new Map<string, { point: [number, number]; events: StoredEvent[] }>()
    for (const event of events) {
      const point = eventCoordinates(event)
      if (!point) continue
      const key = point.join(',')
      const group = locations.get(key) ?? { point, events: [] }
      group.events.push(event)
      locations.set(key, group)
    }
    for (const { point, events: items } of locations.values()) {
      const popup = document.createElement('div')
      popup.className = 'map-popup'
      for (const event of items) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = `${whenText(event)} · ${event.title}`
        button.addEventListener('click', () => onOpen(event))
        popup.append(button)
      }
      const color = CATEGORY_COLORS[items[0].category] ?? '#64748b'
      L.marker(point, {
        title: `${items[0].venue || items[0].title} · ${items.length}건`,
        alt: `${items[0].venue || items[0].title} 일정 보기`,
        icon: L.divIcon({ className: 'event-map-pin', html: `<span style="background:${color}">${items.length}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
      }).addTo(map).bindPopup(popup)
    }
    const points = [...locations.values()].map((group) => group.point)
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 14 })
    const resize = new ResizeObserver(() => map.invalidateSize())
    resize.observe(container.current)
    return () => { resize.disconnect(); map.remove() }
  }, [events, onOpen])
  return <>{tileError ? <p className="error" role="status">지도 배경을 불러오지 못했습니다. 네트워크를 확인하고 지도 탭을 다시 여세요. 아래 행사 목록은 계속 이용할 수 있습니다.</p> : null}<div ref={container} className="event-map" role="region" aria-label="행사 위치 지도" /></>
}
