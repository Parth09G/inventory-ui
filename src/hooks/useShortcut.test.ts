import { describe, expect, it } from 'vitest'
import { matches } from './useShortcut'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)

describe('useShortcut matching', () => {
  it('matches by physical key with modifiers', () => {
    expect(matches(key({ code: 'KeyN', key: 'ñ', altKey: true }), 'alt+n')).toBe(true)
    expect(matches(key({ code: 'KeyK', key: 'k', ctrlKey: true }), 'ctrl+k')).toBe(true)
    expect(matches(key({ code: 'KeyK', key: 'k', metaKey: true }), 'ctrl+k')).toBe(true)
    expect(matches(key({ code: 'KeyK', key: 'k' }), 'ctrl+k')).toBe(false)
    expect(matches(key({ code: 'Enter', key: 'Enter', ctrlKey: true }), 'ctrl+enter')).toBe(true)
    expect(matches(key({ code: 'Slash', key: '?', shiftKey: true }), '?')).toBe(true)
  })
})
