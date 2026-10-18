import { describe, expect, it } from 'vitest'
import { formatDateInput, parseDateInput } from './dates'

describe('date input parsing', () => {
  it('accepts the ways people type Indian dates', () => {
    expect(parseDateInput('18-10-2026')).toBe('2026-10-18')
    expect(parseDateInput('1/4/26')).toBe('2026-04-01')
    expect(parseDateInput('01.04.2026')).toBe('2026-04-01')
    expect(parseDateInput('18102026')).toBe('2026-10-18')
    expect(parseDateInput('181026')).toBe('2026-10-18')
  })
  it('rejects impossible dates and other text', () => {
    expect(parseDateInput('31-02-2026')).toBeNull()
    expect(parseDateInput('29-02-2027')).toBeNull()
    expect(parseDateInput('29-02-2028')).toBe('2028-02-29')
    expect(parseDateInput('13-13-2026')).toBeNull()
    expect(parseDateInput('tomorrow')).toBeNull()
  })
  it('formats ISO for the box', () => {
    expect(formatDateInput('2026-04-01')).toBe('01-04-2026')
    expect(formatDateInput(undefined)).toBe('')
  })
})
