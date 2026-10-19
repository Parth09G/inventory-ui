import { describe, expect, it } from 'vitest'
import { niceTicks } from './SalesTrendChart'

describe('niceTicks', () => {
  it('rounds the axis to clean steps', () => {
    expect(niceTicks(38000)).toEqual([0, 10000, 20000, 30000, 40000])
    expect(niceTicks(412650)).toEqual([0, 200000, 400000, 600000])
    expect(niceTicks(900)).toEqual([0, 250, 500, 750, 1000])
    expect(niceTicks(0)).toEqual([0])
  })
})
