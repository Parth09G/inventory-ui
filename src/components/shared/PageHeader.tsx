import type { ReactNode } from 'react'

type Props = {
  title: ReactNode
  /** Small line under the title: counts, filters in force, "Updated 2 min ago". */
  meta?: ReactNode
  actions?: ReactNode
  /** Breadcrumb or back link above the title. */
  back?: ReactNode
}

export function PageHeader({ title, meta, actions, back }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        {back && <div className="mb-1 text-sm text-ink-muted">{back}</div>}
        <h1 className="truncate text-xl font-semibold">{title}</h1>
        {meta && <div className="mt-0.5 text-sm text-ink-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
