const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1/playradar').replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function loginUrlForCurrentPath(): string {
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return `/login?next=${encodeURIComponent(here)}`
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return res.statusText || `HTTP ${res.status}`
  try {
    const parsed = JSON.parse(text) as { message?: unknown }
    if (typeof parsed.message === 'string') return parsed.message
    if (Array.isArray(parsed.message)) return parsed.message.join(', ')
  } catch {
    return text.slice(0, 300)
  }
  return text.slice(0, 300)
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: { skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (res.status === 401 && !options.skipAuthRedirect) {
    window.location.assign(loginUrlForCurrentPath())
    throw new ApiError(401, '로그인이 필요합니다.')
  }
  if (!res.ok) throw new ApiError(res.status, await readError(res))
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const apiGet = <T>(path: string, options?: { skipAuthRedirect?: boolean }) =>
  apiFetch<T>(path, { method: 'GET', cache: 'no-store' }, options)

export const apiPost = <T>(path: string, body?: unknown, options?: { skipAuthRedirect?: boolean }) =>
  apiFetch<T>(
    path,
    { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) },
    options,
  )

export const apiPut = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) })

export const apiDelete = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' })
