import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Document metadata blocks: label above value, wrapping into columns. */
export function KeyValueGrid({
  items,
  className,
}: {
  items: [ReactNode, ReactNode][]
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-6 gap-y-3',
        className,
      )}
    >
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">{k}</dt>
          <dd className="mt-0.5 truncate">{v ?? <span className="text-ink-faint">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
