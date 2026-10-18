import { describe, expect, it, vi } from 'vitest'
import { ApiProblem, applyFieldErrors, toFormPath } from './problem'

describe('problem', () => {
  it('maps API field paths to form paths', () => {
    expect(toFormPath('lines[1].rate')).toBe('lines.1.rate')
    expect(toFormPath('customer.gstin')).toBe('customer.gstin')
  })
  it('sets field errors, focusing only the first, and returns unmatched ones', () => {
    const setError = vi.fn()
    const rest = applyFieldErrors(setError, [
      { field: 'lines[1].rate', message: 'rate is required' },
      { field: 'customer.gstin', message: 'bad' },
      { message: 'total differs' },
    ])
    expect(setError).toHaveBeenNthCalledWith(
      1,
      'lines.1.rate',
      { type: 'server', message: 'rate is required' },
      { shouldFocus: true },
    )
    expect(setError).toHaveBeenNthCalledWith(
      2,
      'customer.gstin',
      { type: 'server', message: 'bad' },
      { shouldFocus: false },
    )
    expect(rest).toEqual([{ message: 'total differs' }])
  })
  it('keeps the code and request id', () => {
    const p = new ApiProblem(
      422,
      { code: 'INSUFFICIENT_STOCK', title: 'Short', status: 422 },
      'req-1',
    )
    expect(p.is('INSUFFICIENT_STOCK')).toBe(true)
    expect(p.requestId).toBe('req-1')
    expect(new ApiProblem(0, { title: 'x', status: 0 }).code).toBe('NETWORK')
  })
})
