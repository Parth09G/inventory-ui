import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { components } from '@/lib/api/schema'

type Meta = components['schemas']['PageMeta']

export function Pagination({
  meta,
  onPage,
}: {
  meta: Meta | undefined
  onPage: (page: number) => void
}) {
  if (!meta || meta.total === 0) return null
  const first = (meta.page - 1) * meta.page_size + 1
  const last = Math.min(meta.page * meta.page_size, meta.total)
  const pages = Math.ceil(meta.total / meta.page_size)
  return (
    <nav
      aria-label="Pages"
      className="flex items-center justify-between gap-3 pt-2 text-sm text-ink-muted"
    >
      <span className="tabular">
        {first.toLocaleString('en-IN')}–{last.toLocaleString('en-IN')} of{' '}
        {meta.total.toLocaleString('en-IN')}
      </span>
      {pages > 1 && (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => onPage(meta.page - 1)}
          >
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= pages}
            onClick={() => onPage(meta.page + 1)}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </nav>
  )
}
