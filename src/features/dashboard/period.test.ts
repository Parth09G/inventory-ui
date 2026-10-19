import { describe, expect, it } from 'vitest'
import { fyStart, monthStart } from './period'

describe('dashboard periods', () => {
  it('starts the financial year on 1 April', () => {
    expect(fyStart('2026-10-19')).toBe('2026-04-01')
    expect(fyStart('2027-03-31')).toBe('2026-04-01')
    expect(fyStart('2027-04-01')).toBe('2027-04-01')
    expect(monthStart('2026-10-19')).toBe('2026-10-01')
  })
})
