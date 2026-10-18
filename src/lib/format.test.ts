import { describe, expect, it } from 'vitest'
import { balance, date, dateTime, isZero, money, qty, rate, shortDate } from './format'

describe('format', () => {
  it('formats money with Indian grouping and exact decimals', () => {
    expect(money('148450')).toBe('1,48,450.00')
    expect(money('10000000.5')).toBe('1,00,00,000.50')
    expect(money('98450.00', { symbol: true })).toBe('₹ 98,450.00')
    expect(money('-1200.10', { symbol: true })).toBe('−₹ 1,200.10')
    // Large values keep every digit (no float rounding).
    expect(money('999999999999.99')).toBe('9,99,99,99,99,999.99')
  })
  it('formats quantities and rates', () => {
    expect(qty('1.500')).toBe('1.5')
    expect(qty('50.000')).toBe('50')
    expect(qty('1234.5', 0)).toBe('1,235')
    expect(rate('62.5000')).toBe('62.50')
    expect(rate('62.1234')).toBe('62.1234')
  })
  it('shows ledger balances as Dr/Cr', () => {
    expect(balance('98450.00')).toEqual({ text: '98,450.00', side: 'Dr' })
    expect(balance('-500')).toEqual({ text: '500.00', side: 'Cr' })
    expect(balance('0.00').side).toBe('')
    expect(isZero('-0.00')).toBe(true)
  })
  it('formats dates without time-zone conversion', () => {
    expect(date('2026-04-01')).toBe('01-04-2026')
    expect(shortDate('2026-10-18')).toBe('18 Oct')
    expect(dateTime('2026-10-18T09:35:00Z')).toBe('18-10-2026, 3:05 pm')
  })
})
