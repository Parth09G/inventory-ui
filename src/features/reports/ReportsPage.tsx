import { Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/shared/PageHeader'
import { REPORT_GROUPS } from './catalogue'

/** Report catalogue (ui-plan #36): links, not KPI cards. */
export function ReportsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Reports"
        meta="Every report filters by period and exports to Excel or PDF."
      />
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {REPORT_GROUPS.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-ink-muted uppercase">
              {g.title}
            </h2>
            <ul className="grid divide-y rounded-lg border bg-surface">
              {g.reports.map((r) => (
                <li key={r.key}>
                  <Link
                    to="/reports/$key"
                    params={{ key: r.key }}
                    className="block px-4 py-2.5 hover:bg-paper"
                  >
                    <span className="font-medium">{r.title}</span>
                    <span className="block text-sm text-ink-muted">{r.about}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
