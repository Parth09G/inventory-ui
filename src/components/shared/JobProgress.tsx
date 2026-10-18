import { Download } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useJob, type Job } from '@/hooks/useJob'
import { openSignedUrl } from '@/lib/download'
import { StatusBadge } from './StatusBadge'

/** Live status of a background job, with the result download when there is one. */
export function JobProgress({ job, done }: { job: Job; done?: (job: Job) => ReactNode }) {
  const { data = job } = useJob(job.id, job)
  const running = data.status === 'queued' || data.status === 'running'
  return (
    <div role="status" aria-live="polite" className="grid gap-2 rounded-lg border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={data.status} />
        {running && data.progress != null && (
          <span className="text-sm text-ink-muted tabular">{data.progress}%</span>
        )}
      </div>
      {running && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full bg-steel transition-[width]"
            style={{ width: `${Math.max(4, data.progress ?? 0)}%` }}
            role="progressbar"
            aria-valuenow={data.progress ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress"
          />
        </div>
      )}
      {data.status === 'failed' && <p className="text-danger">{data.error ?? 'The job failed.'}</p>}
      {data.status === 'succeeded' && (
        <div className="flex flex-wrap items-center gap-3">
          {done?.(data)}
          {data.result_url && (
            <Button variant="outline" size="sm" onClick={() => openSignedUrl(data.result_url!)}>
              <Download className="size-4" /> Download result
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
