export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export interface CalendarCell {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
  isWeekend: boolean
  weekday: number
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addDays(value: string, days: number): string {
  const date = parseDateKey(value)
  date.setDate(date.getDate() + days)
  return formatYmd(date)
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDateKey(a).getTime() - parseDateKey(b).getTime()) / 86_400_000)
}

export function monthCells(year: number, monthIndex: number, today: string): CalendarCell[] {
  const first = new Date(year, monthIndex, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const cells: CalendarCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const key = formatYmd(date)
    cells.push({
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
      isToday: key === today,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      weekday: date.getDay(),
    })
  }
  return cells
}

export function displayDate(value?: string | null): string {
  if (!value) return ''
  const date = parseDateKey(value)
  const time = value.length > 10 ? ` ${value.slice(11, 16)}` : ''
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})${time}`
}
