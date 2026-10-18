import type { ReactNode } from 'react'

/** One sentence on what appears here, and the action that creates it (design P9). */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-3 px-4 py-10 sm:justify-items-center sm:text-center">
      <p className="text-ink-muted">{children}</p>
      {action}
    </div>
  )
}
