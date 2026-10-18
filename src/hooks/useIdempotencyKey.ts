import { useCallback, useState } from 'react'

/**
 * One Idempotency-Key per open form (D-08). Reuse it for every retry of the same save;
 * call renew() after a successful save.
 */
export function useIdempotencyKey(): [string, () => void] {
  const [key, setKey] = useState(() => crypto.randomUUID())
  const renew = useCallback(() => setKey(crypto.randomUUID()), [])
  return [key, renew]
}
