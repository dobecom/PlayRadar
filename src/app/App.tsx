import { CalendarDays, Newspaper, RefreshCw, Settings, Star, TowerControl } from 'lucide-react'
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { apiDelete, ApiError, apiGet, apiPost, apiPut } from '../services/apiClient'
import type {
  CalendarFeedResponse,
  DigestKind,
  DigestResponse,
  DigestSendResponse,
  LatestRunResponse,
  PickRecord,
  ProfileResponse,
  RadarDataset,
  SourceInfo,
  SourcesResponse,
  StoredEvent,
} from '../services/types'
import { displayDate, formatYmd, monthCells, parseDateKey } from '../features/calendar/dateUtils'
import { parseDigestMessage } from '../features/digest/digestSafe'
import {
  CATEGORY_COLORS,
  categoryCounts,
  eventFlags,
  eventOverlapsDay,
  eventOverlapsRange,
  isLongEvent,
  isNewEvent,
  passesFilters,
  safeHttpUrl,
  sortEvents,
  whenText,
  type EventFilters,
} from '../features/events/eventUtils'
import { sanitizeNext } from '../features/login/redirect'

const navItems = [
  { path: '/', label: '캘린더', icon: CalendarDays },
  { path: '/news', label: '새 소식', icon: Newspaper },
  { path: '/picks', label: '내 일정', icon: Star },
  { path: '/sources', label: '수집 소스', icon: TowerControl },
  { path: '/settings', label: '설정', icon: Settings },
]

const emptyFilters = (data: RadarDataset, pickIds: Set<string>): EventFilters => ({
  query: '',
  categories: new Set<string>(),
  minScore: 2,
  recommendedOnly: false,
  showLong: false,
  newOnly: false,
  picksOnly: false,
  pickIds,
  today: data.today,
  baseline: data.baseline,
})

function currentPath(): string {
  return window.location.pathname || '/'
}

function formatStamp(value?: string | null): string {
  if (!value) return '수집 전'
  return value.replace('T', ' ').slice(0, 16)
}

function appErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.status === 409 ? '이미 수집 중입니다.' : error.message
  if (error instanceof Error) return error.message
  return '알 수 없는 오류가 발생했습니다.'
}

function categoryLabel(data: RadarDataset, category: string): string {
  return data.categories[category] ?? category
}

function navigate(path: string): void {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function AppHeader({ path, data, running, onRefresh }: { path: string; data: RadarDataset | null; running: boolean; onRefresh: () => void }) {
  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={() => navigate('/')} aria-label="PlayRadar 홈">
        <span className="brand-mark">🎻</span>
        <span><strong>PlayRadar</strong><small>개인용 즐길거리 레이더</small></span>
      </button>
      <nav className="nav" aria-label="주요 메뉴">
        {navItems.map(({ path: href, label, icon: Icon }) => (
          <button type="button" className={path === href ? 'active' : ''} key={href} onClick={() => navigate(href)}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>
      <div className="statusbar">
        <span className="muted small">마지막 수집 {formatStamp(data?.generated)}</span>
        {running || data?.running ? <span className="run-pill">수집 중</span> : null}
        <button className="ghost" type="button" onClick={onRefresh} disabled={running}>
          <RefreshCw size={15} aria-hidden="true" /> 새로 수집
        </button>
      </div>
    </header>
  )
}

function LoginPage() {
  const [accessKey, setAccessKey] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await apiPost<void>('/auth/login', { accessKey }, { skipAuthRedirect: true })
      const params = new URLSearchParams(window.location.search)
      window.location.assign(sanitizeNext(params.get('next')))
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      setError(status === 429 ? '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' : '접근 키를 확인하세요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="hero-icon">🎻</div>
        <h1>PlayRadar</h1>
        <p className="muted">개인 일정 레이더입니다. 접근 키를 입력하세요.</p>
        <form onSubmit={submit} className="login-form">
          <label>접근 키<input autoFocus type="password" value={accessKey} onChange={(event) => setAccessKey(event.currentTarget.value)} autoComplete="current-password" required /></label>
          {error ? <p className="error">{error}</p> : null}
          <button className="primary" type="submit" disabled={pending}>{pending ? '확인 중…' : '들어가기'}</button>
        </form>
      </section>
    </main>
  )
}

function EventChip({ event, data, pickIds, compact = true, onOpen }: { event: StoredEvent; data: RadarDataset; pickIds: Set<string>; compact?: boolean; onOpen: (event: StoredEvent) => void }) {
  const color = CATEGORY_COLORS[event.category] ?? '#64748b'
  const title = compact ? event.title : `${whenText(event)} · ${event.title}`
  const time = compact && event.start && event.start.length > 10 ? `${event.start.slice(11, 16)} ` : ''
  return (
    <button type="button" className="event-chip" style={{ '--c': color } as React.CSSProperties} title={`${event.title} (${event.score})`} onClick={() => onOpen(event)}>
      {eventFlags(event, data, pickIds)}{time}{title}
    </button>
  )
}

function EventLine({ event, data, pickIds, onOpen }: { event: StoredEvent; data: RadarDataset; pickIds: Set<string>; onOpen: (event: StoredEvent) => void }) {
  const meta = [event.venue || event.region || event.organizer, event.price, event.reasons.slice(0, 3).join(', ')].filter(Boolean).join(' · ')
  return <li className={event.alert ? 'alert-line' : ''}><EventChip event={event} data={data} pickIds={pickIds} compact={false} onOpen={onOpen} />{meta ? <div className="meta">{meta}</div> : null}</li>
}

function FilterPanel({ data, filters, onFilters }: { data: RadarDataset; filters: EventFilters; onFilters: (next: EventFilters) => void }) {
  const counts = categoryCounts(data.events)
  const sortedCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
  const toggleCategory = (category: string) => {
    const next = new Set(filters.categories)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    onFilters({ ...filters, categories: next })
  }

  return (
    <section className="filters">
      <input type="search" value={filters.query} onChange={(event) => onFilters({ ...filters, query: event.currentTarget.value })} placeholder="검색 (예: 첼로, 무료, 도서관, 러닝)" aria-label="일정 검색" />
      <div className="chips" aria-label="카테고리 필터">
        {sortedCats.map((category) => (
          <button key={category} type="button" className={filters.categories.has(category) ? 'cat on' : 'cat'} style={{ '--c': CATEGORY_COLORS[category] ?? '#64748b' } as React.CSSProperties} onClick={() => toggleCategory(category)}>
            {categoryLabel(data, category)} <small>{counts[category]}</small>
          </button>
        ))}
      </div>
      <div className="filter-row">
        <label>추천도 ≥ <strong>{filters.minScore}</strong><input type="range" min="-3" max="10" step="0.5" value={filters.minScore} onChange={(event) => onFilters({ ...filters, minScore: Number(event.currentTarget.value) })} /></label>
        <label><input type="checkbox" checked={filters.recommendedOnly} onChange={(event) => onFilters({ ...filters, recommendedOnly: event.currentTarget.checked })} /> 추천만</label>
        <label><input type="checkbox" checked={filters.showLong} onChange={(event) => onFilters({ ...filters, showLong: event.currentTarget.checked })} /> 진행 중 장기 프로그램 표시</label>
        <label><input type="checkbox" checked={filters.newOnly} onChange={(event) => onFilters({ ...filters, newOnly: event.currentTarget.checked })} /> 새 소식</label>
        <label><input type="checkbox" checked={filters.picksOnly} onChange={(event) => onFilters({ ...filters, picksOnly: event.currentTarget.checked })} /> 내 일정만</label>
      </div>
    </section>
  )
}

function CalendarPage({ data, onPick }: { data: RadarDataset; onPick: (event: StoredEvent) => Promise<void> }) {
  const pickIds = useMemo(() => new Set(data.picks), [data.picks])
  const [filters, setFilters] = useState(() => emptyFilters(data, pickIds))
  const [cursor, setCursor] = useState(() => {
    const date = parseDateKey(data.today)
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const [selected, setSelected] = useState<StoredEvent | null>(null)
  const activeFilters = useMemo<EventFilters>(() => ({ ...filters, pickIds, today: data.today, baseline: data.baseline }), [data.baseline, data.today, filters, pickIds])
  const monthStart = formatYmd(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
  const monthEnd = formatYmd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))
  const cells = monthCells(cursor.getFullYear(), cursor.getMonth(), data.today)
  const visibleEvents = data.events.filter((event) => event.kind !== 'news' && passesFilters(event, activeFilters)).filter((event) => eventOverlapsRange(event, monthStart, monthEnd)).sort(sortEvents)
  const agenda = visibleEvents.filter((event) => (event.end || event.start || '') >= data.today)
  const moveMonth = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))

  return (
    <>
      <div className="monthbar">
        <button className="ghost" type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
        <h1>{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</h1>
        <button className="ghost" type="button" onClick={() => moveMonth(1)} aria-label="다음 달">›</button>
        <button className="ghost" type="button" onClick={() => { const today = parseDateKey(data.today); setCursor(new Date(today.getFullYear(), today.getMonth(), 1)) }}>오늘</button>
      </div>
      <FilterPanel data={data} filters={activeFilters} onFilters={setFilters} />
      <main className="calendar-layout">
        <section>
          <div className="weekday-row" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <div key={day}>{day}</div>)}</div>
          <div className="calendar-grid">
            {cells.map((cell) => {
              const list = visibleEvents.filter((event) => eventOverlapsDay(event, cell.key)).sort(sortEvents)
              return (
                <article key={cell.key} className={`day-cell ${cell.inMonth ? '' : 'other'} ${cell.isToday ? 'today' : ''} ${cell.weekday === 0 ? 'sun' : ''} ${cell.weekday === 6 ? 'sat' : ''}`}>
                  <div className="date-num">{cell.day}</div>
                  {list.slice(0, 4).map((event) => <EventChip key={event.id} event={event} data={data} pickIds={pickIds} onOpen={setSelected} />)}
                  {list.length > 4 ? <span className="more">+{list.length - 4} 더보기</span> : null}
                </article>
              )
            })}
          </div>
          <ul className="mobile-agenda">{agenda.length ? agenda.map((event) => <EventLine key={event.id} event={event} data={data} pickIds={pickIds} onOpen={setSelected} />) : <li className="muted empty">조건에 맞는 일정이 없습니다.</li>}</ul>
        </section>
        <CalendarSide data={data} pickIds={pickIds} filters={activeFilters} onOpen={setSelected} />
      </main>
      {selected ? <EventModal event={selected} data={data} pickIds={pickIds} onClose={() => setSelected(null)} onPick={onPick} /> : null}
    </>
  )
}

function CalendarSide({ data, pickIds, filters, onOpen }: { data: RadarDataset; pickIds: Set<string>; filters: EventFilters; onOpen: (event: StoredEvent) => void }) {
  const alerts = data.events.filter((event) => event.alert && (event.kind === 'news' || (event.end || event.start || '') >= data.today)).sort(sortEvents)
  const picks = data.events.filter((event) => pickIds.has(event.id)).sort(sortEvents)
  const booking = data.events.filter((event) => event.booking_open && event.booking_open.slice(0, 10) >= data.today && passesFilters(event, filters)).sort((a, b) => (a.booking_open ?? '').localeCompare(b.booking_open ?? ''))
  const long = data.events.filter((event) => event.kind !== 'news' && isLongEvent(event) && (event.end || event.start || '') >= data.today).filter((event) => passesFilters(event, { ...filters, showLong: true })).sort((a, b) => b.score - a.score)
  const news = data.events.filter((event) => event.kind === 'news' && passesFilters(event, filters)).sort(sortEvents)

  return (
    <aside className="side-panel">
      <SideCard title="🔔 알림" count={alerts.length} empty="관심 알림이 없습니다.">{alerts.slice(0, 12).map((event) => <EventLine key={event.id} event={event} data={data} pickIds={pickIds} onOpen={onOpen} />)}</SideCard>
      <SideCard title="⭐ 내 일정" count={picks.length} empty="일정을 눌러 내 일정에 추가하세요.">{picks.slice(0, 12).map((event) => <EventLine key={event.id} event={event} data={data} pickIds={pickIds} onOpen={onOpen} />)}</SideCard>
      <SideCard title="🎫 예매/접수 오픈" count={booking.length} empty="다가오는 오픈 정보가 없습니다.">{booking.slice(0, 12).map((event) => <EventLine key={event.id} event={event} data={data} pickIds={pickIds} onOpen={onOpen} />)}</SideCard>
      <SideCard title="📌 장기 프로그램" count={long.length} empty="진행 중인 장기 프로그램이 없습니다.">{long.slice(0, 16).map((event) => <EventLine key={event.id} event={event} data={data} pickIds={pickIds} onOpen={onOpen} />)}</SideCard>
      <SideCard title="📰 소식 피드" count={news.length} empty="소식이 없습니다.">{news.slice(0, 16).map((event) => <EventLine key={event.id} event={event} data={data} pickIds={pickIds} onOpen={onOpen} />)}</SideCard>
      <section className="card compact-list"><h2>🛰 소스 상태</h2>{data.sources.slice(0, 12).map((source) => <div key={source.id} className={`source-mini ${source.status}`}><span>{source.status === 'ok' ? '🟢' : source.status === 'limited' ? '🟡' : source.status === 'error' ? '🔴' : '⚪'}</span>{source.name} · {source.count}건</div>)}</section>
    </aside>
  )
}

function SideCard({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return <details className="card" open><summary>{title} <span className="badge">{count || ''}</span></summary><ul className="mini-list">{count ? children : <li className="muted">{empty}</li>}</ul></details>
}

function EventModal({ event, data, pickIds, onClose, onPick }: { event: StoredEvent; data: RadarDataset; pickIds: Set<string>; onClose: () => void; onPick: (event: StoredEvent) => Promise<void> }) {
  const link = safeHttpUrl(event.url)
  const image = safeHttpUrl(event.image)
  const picked = pickIds.has(event.id)
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="event-title" onClick={(click) => click.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="닫기">×</button>
        {image ? <img className="poster" src={image} alt="" referrerPolicy="no-referrer" /> : null}
        <div className="modal-pills"><span className="pill" style={{ '--c': CATEGORY_COLORS[event.category] ?? '#64748b' } as React.CSSProperties}>{categoryLabel(data, event.category)}</span>{event.alert ? <span className="pill alert">🔔 알림</span> : null}{isNewEvent(event, data.today, data.baseline) ? <span className="pill new">🆕 신규</span> : null}</div>
        <h2 id="event-title">{event.title}</h2>
        <dl className="kv">
          <div><dt>일시</dt><dd>{whenText(event) || '일정 미정'}</dd></div>
          {event.venue || event.region ? <div><dt>장소</dt><dd>{[event.venue, event.region].filter(Boolean).join(' · ')}</dd></div> : null}
          {event.price ? <div><dt>가격</dt><dd>{event.price}</dd></div> : null}
          {event.booking_open ? <div><dt>예매/접수</dt><dd>{event.booking_open.replace('T', ' ')}{event.booking_close ? ` ~ ${event.booking_close.replace('T', ' ')}` : ''}</dd></div> : null}
          {event.organizer ? <div><dt>주최/출처</dt><dd>{event.organizer}</dd></div> : null}
          <div><dt>추천도</dt><dd>{event.score}{event.reasons.length ? ` — ${event.reasons.join(', ')}` : ''}</dd></div>
        </dl>
        {event.description ? <p className="description">{event.description}</p> : null}
        <div className="actions">{link ? <a className="primary" href={link} target="_blank" rel="noopener noreferrer">자세히 보기 ↗</a> : null}<button className="ghost" type="button" onClick={() => void onPick(event)}>{picked ? '⭐ 내 일정에서 제거' : '☆ 내 일정에 추가'}</button></div>
        <p className="muted small">source: {event.source} · 처음 발견 {formatStamp(event.first_seen)}</p>
      </section>
    </div>
  )
}

function NewsPage({ data, onPick }: { data: RadarDataset; onPick: (event: StoredEvent) => Promise<void> }) {
  const [selected, setSelected] = useState<StoredEvent | null>(null)
  const pickIds = useMemo(() => new Set(data.picks), [data.picks])
  const grouped = data.events.filter((event) => event.kind === 'news').sort((a, b) => (a.alert === b.alert ? b.score - a.score : a.alert ? -1 : 1)).reduce<Record<string, StoredEvent[]>>((acc, event) => {
    const topic = typeof event.extra.topic === 'string' ? event.extra.topic : '기타 소식'
    ;(acc[topic] ??= []).push(event)
    return acc
  }, {})
  return (
    <main className="page narrow"><h1>새 소식</h1>{Object.entries(grouped).map(([topic, events]) => <section key={topic} className="card"><h2>{topic}</h2><ul className="list">{events.map((event) => <EventLine key={event.id} event={event} data={data} pickIds={pickIds} onOpen={setSelected} />)}</ul></section>)}{Object.keys(grouped).length === 0 ? <p className="muted">소식이 없습니다.</p> : null}{selected ? <EventModal event={selected} data={data} pickIds={pickIds} onClose={() => setSelected(null)} onPick={onPick} /> : null}</main>
  )
}

function PicksPage({ data, onPick }: { data: RadarDataset; onPick: (event: StoredEvent) => Promise<void> }) {
  const [records, setRecords] = useState<PickRecord[]>([])
  const [selected, setSelected] = useState<StoredEvent | null>(null)
  const pickIds = useMemo(() => new Set(data.picks), [data.picks])
  useEffect(() => { void apiGet<{ picks: PickRecord[] }>('/picks').then((res) => setRecords(res.picks)) }, [])
  const byId = new Map(data.events.map((event) => [event.id, event]))
  return (
    <main className="page narrow"><h1>내 일정</h1><p className="muted">서버에 저장된 참여 예정 목록입니다. 원본 이벤트가 사라진 일정도 스냅샷으로 표시됩니다.</p><ul className="list pick-list">{records.map((pick) => { const event = byId.get(pick.eventId); const url = safeHttpUrl(pick.url); return event ? <EventLine key={pick.eventId} event={event} data={data} pickIds={pickIds} onOpen={setSelected} /> : <li key={pick.eventId} className="snapshot-pick"><strong>{pick.title}</strong><span className="meta">{pick.start ? displayDate(pick.start) : '일정 미정'} · 저장 {formatStamp(pick.createdAt)}</span>{url ? <a href={url} target="_blank" rel="noopener noreferrer">원문 ↗</a> : null}</li> })}</ul>{records.length === 0 ? <p className="muted">저장된 일정이 없습니다.</p> : null}{selected ? <EventModal event={selected} data={data} pickIds={pickIds} onClose={() => setSelected(null)} onPick={onPick} /> : null}</main>
  )
}

function SourcesPage({ onRun }: { onRun: (only?: string[]) => Promise<void> }) {
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [channels, setChannels] = useState<string[]>([])
  const [latest, setLatest] = useState<LatestRunResponse | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const [sourceRes, runRes] = await Promise.all([apiGet<SourcesResponse>('/sources'), apiGet<LatestRunResponse>('/runs/latest')])
    setSources(sourceRes.sources)
    setChannels(sourceRes.channels)
    setLatest(runRes)
  }, [])
  useEffect(() => { void load().catch((err) => setError(appErrorMessage(err))) }, [load])
  async function run(only?: string[]) {
    setBusy(true); setError('')
    try { await onRun(only); await load() } catch (err) { setError(appErrorMessage(err)) } finally { setBusy(false) }
  }
  return (
    <main className="page wide">
      <div className="page-head"><div><h1>수집 소스</h1><p className="muted">알림 채널: {channels.length ? channels.join(', ') : '설정 없음'}</p></div><button className="primary" type="button" onClick={() => void run()} disabled={busy || latest?.running}>지금 수집</button></div>
      {error ? <p className="error">{error}</p> : null}
      {latest?.run ? <section className="card run-summary"><strong>최근 실행 #{latest.run.id}</strong> · {latest.run.status} · 원천 {latest.run.rawCount}건 / 이벤트 {latest.run.eventCount}건 / 오류 {latest.run.errorCount}건<br /><span className="muted">시작 {formatStamp(latest.run.startedAt)} · 종료 {formatStamp(latest.run.finishedAt)}</span>{latest.run.message ? <p className="error">{latest.run.message}</p> : null}</section> : null}
      <div className="source-table-wrap"><table className="source-table"><thead><tr><th>상태</th><th>소스</th><th>그룹</th><th>설정</th><th>최근</th><th>건수</th><th></th></tr></thead><tbody>{sources.map((source) => { const status = source.health?.status ?? 'disabled'; const homepage = safeHttpUrl(source.homepage); return <tr key={source.id}><td><span className={`status-dot ${status}`}>{status}</span></td><td>{homepage ? <a href={homepage} target="_blank" rel="noopener noreferrer">{source.name}</a> : source.name}<div className="muted small">{source.description}</div>{source.health?.error ? <div className="error small">{source.health.error}</div> : null}</td><td>{source.group}</td><td>{source.enabled ? (source.configured ? '완료' : `키 필요: ${source.requiresEnv.join(', ')}`) : '비활성'}</td><td>{formatStamp(source.health?.lastRunAt)}</td><td>{source.health?.count ?? 0}</td><td><button className="ghost" type="button" onClick={() => void run([source.id])} disabled={busy}>이 소스 수집</button></td></tr> })}</tbody></table></div>
    </main>
  )
}

function DigestPreview({ message }: { message: string }) {
  const nodes = parseDigestMessage(message)
  return <div className="digest-preview">{nodes.map((node, index) => { if (node.kind === 'bold') return <strong key={`${node.kind}-${index}`}>{node.text}</strong>; if (node.kind === 'link') return <a key={`${node.kind}-${index}`} href={node.href} target="_blank" rel="noopener noreferrer">{node.text}</a>; return <span key={`${node.kind}-${index}`}>{node.text}</span> })}</div>
}

function SettingsPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [yaml, setYaml] = useState('')
  const [digestKind, setDigestKind] = useState<DigestKind>('daily')
  const [digest, setDigest] = useState<DigestResponse | null>(null)
  const [feeds, setFeeds] = useState<CalendarFeedResponse | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const loadDigest = useCallback(async (kind: DigestKind) => { const res = await apiGet<DigestResponse>(`/digest?kind=${kind}`); setDigest(res) }, [])
  useEffect(() => {
    void Promise.all([apiGet<ProfileResponse>('/profile'), apiGet<CalendarFeedResponse>('/calendar/feed'), loadDigest(digestKind)]).then(([profileRes, feedRes]) => { setProfile(profileRes); setYaml(profileRes.yaml); setFeeds(feedRes) }).catch((err) => setError(appErrorMessage(err)))
  }, [digestKind, loadDigest])
  async function saveProfile() {
    setNotice(''); setError('')
    try { const res = await apiPut<{ rescored: number }>('/profile', { yaml }); setNotice(`저장했습니다. ${res.rescored}건을 다시 평가했습니다.`); setProfile((prev) => (prev ? { ...prev, origin: 'database' } : prev)) } catch (err) { setError(appErrorMessage(err)) }
  }
  async function sendDigest() {
    setNotice(''); setError('')
    try { const res = await apiPost<DigestSendResponse>(`/digest/${digestKind}/send`); setNotice(res.empty ? '보낼 내용이 없습니다.' : `${res.sent.join(', ')} 채널로 전송했습니다. (${res.marked}건 표시)`) } catch (err) { setError(appErrorMessage(err)) }
  }
  async function logout() { await apiPost<void>('/auth/logout', undefined, { skipAuthRedirect: true }); window.location.assign('/login') }
  return (
    <main className="page settings-page">
      <h1>설정</h1>{profile?.origin === 'example' ? <p className="warning">아직 개인 프로필이 저장되지 않았습니다. 개인 정보는 이 화면에서만 저장하고 저장소에는 커밋하지 마세요.</p> : null}{notice ? <p className="success">{notice}</p> : null}{error ? <p className="error">{error}</p> : null}
      <section className="card profile-editor"><div className="section-head"><h2>프로필 YAML</h2><button className="primary" type="button" onClick={() => void saveProfile()}>저장</button></div><textarea value={yaml} onChange={(event) => setYaml(event.currentTarget.value)} spellCheck={false} /></section>
      <section className="card digest-card"><div className="section-head"><h2>Digest 미리보기</h2><div className="row-actions"><select value={digestKind} onChange={(event) => setDigestKind(event.currentTarget.value as DigestKind)}><option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option></select><button className="ghost" type="button" onClick={() => void loadDigest(digestKind)}>다시 보기</button><button className="primary" type="button" onClick={() => void sendDigest()}>전송</button></div></div><p className="muted">항목 {digest?.items ?? 0}건 · 채널 {digest?.channels.length ? digest.channels.join(', ') : '없음'}</p><DigestPreview message={digest?.message || '보낼 내용이 없습니다.'} /></section>
      <section className="card feed-card"><h2>캘린더 구독</h2><p className="muted">휴대폰 캘린더에서 URL로 구독하거나 .ics 파일로 내려받으세요.</p><ul className="feed-list">{feeds?.scopes.map((feed) => { const url = `${window.location.origin}${feed.path}`; return <li key={feed.scope}><strong>{feed.scope}</strong><code>{url}</code><button className="ghost" type="button" onClick={() => void navigator.clipboard?.writeText(url)}>복사</button><a className="ghost as-link" href={feed.path}>.ics 다운로드</a></li> })}</ul></section>
      <button className="danger" type="button" onClick={() => void logout()}>로그아웃</button>
    </main>
  )
}

function LoadingState() {
  return <main className="page"><p className="muted">PlayRadar를 불러오는 중…</p></main>
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <main className="page error-state"><h1>불러오지 못했습니다</h1><p className="error">{message}</p><button className="primary" type="button" onClick={onRetry}>다시 시도</button></main>
}

export function App() {
  const [path, setPath] = useState(currentPath)
  const [data, setData] = useState<RadarDataset | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const handler = () => setPath(currentPath())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const loadEvents = useCallback(async () => {
    setError('')
    const res = await apiGet<RadarDataset>('/events')
    setData(res)
    setRunning(res.running)
  }, [])

  useEffect(() => {
    if (path !== '/login') void loadEvents().catch((err) => setError(appErrorMessage(err)))
  }, [loadEvents, path])

  const pollRun = useCallback(async () => {
    const run = await apiGet<LatestRunResponse>('/runs/latest')
    setRunning(run.running)
    if (run.running) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000))
      await pollRun()
    } else {
      await loadEvents()
    }
  }, [loadEvents])

  const startRun = useCallback(async (only?: string[]) => {
    setRunning(true)
    await apiPost<{ runId: number }>('/runs', only?.length ? { only } : {})
    await new Promise((resolve) => window.setTimeout(resolve, 3000))
    await pollRun()
  }, [pollRun])

  async function togglePick(event: StoredEvent) {
    const picked = data?.picks.includes(event.id)
    if (picked) await apiDelete<void>(`/picks/${event.id}`)
    else await apiPut<void>(`/picks/${event.id}`)
    setData((prev) => {
      if (!prev) return prev
      const picks = picked ? prev.picks.filter((id) => id !== event.id) : [...prev.picks, event.id]
      return { ...prev, picks }
    })
  }

  if (path === '/login') return <LoginPage />

  const content = (() => {
    if (error) return <ErrorState message={error} onRetry={() => void loadEvents().catch((err) => setError(appErrorMessage(err)))} />
    if (!data) return <LoadingState />
    if (path === '/news') return <NewsPage data={data} onPick={togglePick} />
    if (path === '/picks') return <PicksPage data={data} onPick={togglePick} />
    if (path === '/sources') return <SourcesPage onRun={startRun} />
    if (path === '/settings') return <SettingsPage />
    return <CalendarPage data={data} onPick={togglePick} />
  })()

  return (
    <>
      <AppHeader path={path} data={data} running={running} onRefresh={() => void startRun().catch((err) => setError(appErrorMessage(err)))} />
      {content}
      <footer className="footer muted small">PlayRadar · 개인용 · 외부 공개 금지 · 정보는 각 출처에서 최종 확인하세요.</footer>
    </>
  )
}

