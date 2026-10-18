import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ApiProblem, problemMessage } from '@/lib/api/problem'

/** Error block with the request id for support (design P6). */
export function ErrorState({
  error,
  onRetry,
  title = 'Could not load this',
}: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  const requestId = error instanceof ApiProblem ? error.requestId : undefined
  return (
    <div
      role="alert"
      className="grid max-w-prose gap-2 rounded-lg border border-danger/30 bg-danger-tint px-4 py-3"
    >
      <p className="font-medium text-ink">{title}</p>
      <p className="text-ink-muted">{problemMessage(error)}</p>
      <div className="flex flex-wrap items-center gap-3">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        {requestId && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
            onClick={() => {
              void navigator.clipboard?.writeText(requestId)
              toast.success('Request id copied')
            }}
          >
            Request id <span className="code">{requestId}</span> <Copy className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
