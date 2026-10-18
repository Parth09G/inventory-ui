import { useCallback, useEffect, useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'

type Stored<T> = { savedAt: string; values: T }

function read<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Stored<T>) : null
  } catch {
    return null
  }
}

/**
 * Keeps unsaved form input in this browser so a refresh or a closed tab does not lose
 * it (D-17). It is a convenience only: server drafts are the durable copy.
 */
export function useLocalDraft<T extends FieldValues>(key: string, form: UseFormReturn<T>) {
  const [restorable, setRestorable] = useState(() => read<T>(key))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const sub = form.watch((values) => {
      if (!form.formState.isDirty) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), values }))
        } catch {
          /* storage full or blocked: nothing to do */
        }
      }, 500)
    })
    return () => {
      clearTimeout(timer)
      sub.unsubscribe()
    }
  }, [key, form])

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    setRestorable(null)
  }, [key])

  return {
    restorable,
    restore: () => {
      if (restorable) form.reset(restorable.values, { keepDefaultValues: true })
      setRestorable(null)
    },
    discard: clear,
    clear,
  }
}
