export type DigestSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string }

function safeHref(href: string): string | null {
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function parseDigestMessage(input: string): DigestSegment[] {
  const tagPattern = /<\/?b>|<a\s+href="([^"]+)">|<\/a>/gi
  const segments: DigestSegment[] = []
  let cursor = 0
  let bold = false
  let link: string | null = null

  const push = (text: string) => {
    if (!text) return
    if (link) segments.push({ kind: 'link', text, href: link })
    else if (bold) segments.push({ kind: 'bold', text })
    else segments.push({ kind: 'text', text })
  }

  for (const match of input.matchAll(tagPattern)) {
    const index = match.index ?? 0
    push(input.slice(cursor, index))
    const tag = match[0].toLowerCase()
    if (tag === '<b>') bold = true
    else if (tag === '</b>') bold = false
    else if (tag === '</a>') link = null
    else {
      const href = safeHref(match[1] ?? '')
      if (href) link = href
      else push(match[0])
    }
    cursor = index + match[0].length
  }
  push(input.slice(cursor))
  return segments
}
