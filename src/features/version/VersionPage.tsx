import { useEffect, useState } from 'react'
import { apiGet } from '../../services/apiClient'

interface ApplicationVersion {
  version: string
  description: string
  sourceRevision: string | null
  releasedAt: string
}

export function VersionPage() {
  const [versions, setVersions] = useState<ApplicationVersion[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    const title = document.title
    document.title = 'PlayRadar version history'
    let active = true
    void apiGet<ApplicationVersion[]>('/versions').then((history) => {
      if (active) { setVersions(history); setStatus('ready') }
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false; document.title = title }
  }, [])
  return <main className="version-page"><section className="version-page__panel"><p className="version-page__eyebrow">PlayRadar</p><h1>Version history</h1>{status === 'loading' ? <p role="status">Loading version history…</p> : null}{status === 'error' ? <p role="alert">Version history is temporarily unavailable.</p> : null}{status === 'ready' && !versions.length ? <p>No tracked releases are available.</p> : null}{versions.length ? <ol className="version-list">{versions.map((release) => <li key={release.version}><div><strong>{release.version}</strong><time dateTime={release.releasedAt}>{new Date(release.releasedAt).toLocaleString()}</time></div><p>{release.description}</p>{release.sourceRevision ? <code>{release.sourceRevision.slice(0, 7)}</code> : <span className="muted small">Local working tree (uncommitted)</span>}</li>)}</ol> : null}</section></main>
}
