export function sanitizeNext(value: string | null): string {
  if (!value) return '/'
  // Reject protocol-relative forms ("//host", "/\host") that browsers treat as off-site.
  return /^\/(?![/\\])/.test(value) ? value : '/'
}
