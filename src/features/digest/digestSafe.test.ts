import { describe, expect, it } from 'vitest'
import { parseDigestMessage } from './digestSafe'

describe('digest safe rendering parser', () => {
  it('allows bold and http links without returning raw html', () => {
    expect(parseDigestMessage('<b>오늘</b> <a href="https://example.com/a">보기</a>')).toEqual([
      { kind: 'bold', text: '오늘' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: '보기', href: 'https://example.com/a' },
    ])
  })

  it('leaves unsafe markup as text and rejects javascript links', () => {
    const parsed = parseDigestMessage('<img src=x onerror=alert(1)> <a href="javascript:alert(1)">bad</a>')
    expect(parsed.some((segment) => segment.kind === 'link')).toBe(false)
    expect(parsed.map((segment) => segment.text).join('')).toContain('<img src=x onerror=alert(1)>')
  })
})
