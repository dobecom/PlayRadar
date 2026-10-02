import { describe, expect, it } from 'vitest'
import { addDays, diffDays, displayDate, formatYmd, monthCells, parseDateKey } from './dateUtils'

describe('date and calendar helpers', () => {
  it('parses KST-naive date keys without timezone shifting', () => {
    const date = parseDateKey('2026-10-02')
    expect(formatYmd(date)).toBe('2026-10-02')
    expect(displayDate('2026-10-02T19:30')).toBe('10/2(금) 19:30')
  })

  it('builds a 42-cell month grid starting on Sunday', () => {
    const cells = monthCells(2026, 9, '2026-10-02')
    expect(cells).toHaveLength(42)
    expect(cells[0].key).toBe('2026-09-27')
    expect(cells.find((cell) => cell.key === '2026-10-02')?.isToday).toBe(true)
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31)
  })

  it('adds and compares days', () => {
    expect(addDays('2026-10-02', -7)).toBe('2026-09-25')
    expect(diffDays('2026-10-10', '2026-10-02')).toBe(8)
  })
})
