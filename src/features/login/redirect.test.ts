import { describe, expect, it } from 'vitest'
import { sanitizeNext } from './redirect'

describe('login redirect sanitization', () => {
  it('allows same-origin absolute paths only', () => {
    expect(sanitizeNext('/sources?x=1')).toBe('/sources?x=1')
    expect(sanitizeNext('//evil.test')).toBe('/')
    expect(sanitizeNext('/\\evil.test')).toBe('/')
    expect(sanitizeNext('https://evil.test')).toBe('/')
    expect(sanitizeNext(null)).toBe('/')
  })
})
