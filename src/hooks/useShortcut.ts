import { useEffect, useRef } from 'react'

type Options = {
  enabled?: boolean
  /** Fire even when focus is in a text field (Ctrl+Enter, Alt+L …). */
  allowInInputs?: boolean
}

type Combo = { ctrl: boolean; alt: boolean; shift: boolean; key: string }

function parse(combo: string): Combo {
  const parts = combo.toLowerCase().split('+')
  const key = parts.pop() ?? ''
  return {
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    key,
  }
}

function keyOf(e: KeyboardEvent): string {
  // Use the physical key for letters and digits so Alt+N works on every layout.
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase()
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5)
  return e.key.toLowerCase()
}

export function matches(e: KeyboardEvent, combo: string): boolean {
  const c = parse(combo)
  if (c.key === '?') return e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey
  return (
    (e.ctrlKey || e.metaKey) === c.ctrl &&
    e.altKey === c.alt &&
    e.shiftKey === c.shift &&
    keyOf(e) === c.key
  )
}

function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Keyboard shortcut while the calling component is mounted (D-28). Mounting is the scope:
 * a document screen registers its own keys and they go away with it.
 */
export function useShortcut(
  combo: string | string[],
  handler: (e: KeyboardEvent) => void,
  opts: Options = {},
) {
  const { enabled = true, allowInInputs = false } = opts
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  const combos = Array.isArray(combo) ? combo.join('|') : combo
  useEffect(() => {
    if (!enabled) return
    const list = combos.split('|')
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (!allowInInputs && inTextField(e.target)) return
      if (list.some((c) => matches(e, c))) {
        e.preventDefault()
        ref.current(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combos, enabled, allowInInputs])
}
