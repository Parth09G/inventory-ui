import { useCallback, useState } from 'react'

export type Density = 'compact' | 'comfortable'
const KEY = 'ui.density'

function read(): Density {
  try {
    return localStorage.getItem(KEY) === 'comfortable' ? 'comfortable' : 'compact'
  } catch {
    return 'compact'
  }
}

/** Applies the saved table density before first paint (called from main.tsx). */
export function applySavedDensity() {
  document.documentElement.dataset.density = read()
}

export function useDensity(): [Density, (d: Density) => void] {
  const [density, setState] = useState<Density>(read)
  const set = useCallback((d: Density) => {
    document.documentElement.dataset.density = d
    try {
      localStorage.setItem(KEY, d)
    } catch {
      /* per-viewer convenience only */
    }
    setState(d)
  }, [])
  return [density, set]
}
