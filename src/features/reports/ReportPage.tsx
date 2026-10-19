import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { FileDown, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterSelect } from '@/components/shared/FilterBar'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { PartyPicker } from '@/components/shared/inputs/PartyPicker'
import { JobProgress } from '@/components/shared/JobProgress'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { DateText, Money, Qty } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { categoriesQuery } from '@/features/catalogue/api'
import { partyQuery } from '@/features/parties/api'
import type { Job } from '@/hooks/useJob'
import { api, call } from '@/lib/api/client'
import { problemMessage } from '@/lib/api/problem'
import { locationsQuery } from '@/lib/api/reference'
import { openSignedUrl } from '@/lib/download'
import { compact } from '@/lib/list'
import { percent } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { REPORTS, type ReportKey } from './catalogue'

const route = getRouteApi('/_app/reports/$key')
type ColumnMeta = {
  key?: string
  label?: string
  type?: 'text' | 'money' | 'qty' | 'date' | 'percent'
}
type Row = Record<string, unknown>

function cellFor(type: ColumnMeta['type'], v: unknown) {
  if (v === null || v === undefined || v === '') return null
  const s = String(v)
  switch (type) {
    case 'money':
      return <Money value={s} />
    case 'qty':
      return <Qty value={s} />
    case 'percent':
      return <span className="tabular">{percent(s)}</span>
    case 'date':
      return <DateText value={s} />
    default:
      return s
  }
}

/** One viewer for every report, driven by the server's column metadata (D-29, ui-plan #37). */
export function ReportPage() {
  const { key } = route.useParams()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const def = REPORTS.get(key as ReportKey)!
  const canExport = useCan('reports.export')
  const locations = useQuery(locationsQuery())
  const categories = useQuery({ ...categoriesQuery(), enabled: def.filters.includes('category') })
  const party = useQuery({ ...partyQuery(search.party_id ?? 0), enabled: !!search.party_id }).data
  const [job, setJob] = useState<Job | null>(null)
  const filters = compact({
    from: search.from,
    to: search.to,
    location_id: search.location_id,
    category_id: search.category_id,
    party_id: search.party_id,
  })
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })

  const report = useQuery({
    queryKey: ['reports', key, filters, search.page],
    queryFn: () =>
      call(
        api.GET('/reports/{key}', {
          params: {
            path: { key: key as ReportKey },
            query: { ...filters, format: 'json', page: search.page, page_size: 100 },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  })
  const data = report.data && 'columns' in report.data ? report.data : undefined

  const exportAs = useMutation({
    mutationFn: (format: 'xlsx' | 'pdf') =>
      call(
        api.GET('/reports/{key}', {
          params: { path: { key: key as ReportKey }, query: { ...filters, format } },
        }),
      ),
    onSuccess: (r) => {
      // Small reports come back as a link; large ones as a background job (D-22).
      if ('url' in r && r.url) openSignedUrl(r.url)
      else if ('status' in r) setJob(r as Job)
    },
    onError: (e) => toast.error(problemMessage(e)),
  })

  const meta = (data?.columns ?? []) as ColumnMeta[]
  const firstMoney = meta.find((c) => c.type === 'money')?.key
  const columns: Column<Row>[] = meta.map((c, i) => ({
    id: c.key ?? String(i),
    header: c.label ?? c.key,
    align: c.type === 'money' || c.type === 'qty' || c.type === 'percent' ? 'right' : 'left',
    required: i === 0,
    cell: (row) => cellFor(c.type, row[c.key ?? '']),
    footer:
      data?.totals && c.key && c.key in data.totals
        ? cellFor(c.type, data.totals[c.key])
        : undefined,
    mobile: i === 0 ? 'title' : c.key === firstMoney ? 'value' : i <= 2 ? 'subtitle' : undefined,
  }))

  return (
    <div className="grid gap-3">
      <PageHeader
        title={def.title}
        back={
          <Link to="/reports" className="hover:text-ink">
            Reports
          </Link>
        }
        meta={def.about}
        actions={
          canExport && (
            <>
              <Button
                variant="outline"
                disabled={exportAs.isPending}
                onClick={() => exportAs.mutate('xlsx')}
              >
                <FileSpreadsheet className="size-4" /> Excel
              </Button>
              <Button
                variant="outline"
                disabled={exportAs.isPending}
                onClick={() => exportAs.mutate('pdf')}
              >
                <FileDown className="size-4" /> PDF
              </Button>
            </>
          )
        }
      />
      {job && <JobProgress job={job} />}
      <FilterBar
        active={!!(search.location_id || search.category_id || search.party_id)}
        onClear={() => set({ location_id: undefined, category_id: undefined, party_id: undefined })}
      >
        {def.filters.includes('dates') && (
          <DateRange from={search.from} to={search.to} onChange={(r) => set(r)} />
        )}
        {def.filters.includes('location') && (
          <FilterSelect
            label="Location"
            value={search.location_id ? String(search.location_id) : undefined}
            onChange={(v) => set({ location_id: v ? Number(v) : undefined })}
            options={(locations.data ?? []).map((l) => ({ value: String(l.id), label: l.name }))}
          />
        )}
        {def.filters.includes('category') && (
          <FilterSelect
            label="Category"
            value={search.category_id ? String(search.category_id) : undefined}
            onChange={(v) => set({ category_id: v ? Number(v) : undefined })}
            options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
          />
        )}
        {def.filters.includes('party') && (
          <div className="grid w-64 gap-0.5">
            <span className="text-xs font-medium text-ink-muted">Party</span>
            <PartyPicker
              aria-label="Party"
              kind={/payable|purchase|payments-made/.test(key) ? 'supplier' : 'customer'}
              selectedLabel={party?.name ?? ''}
              onSelect={(p) => set({ party_id: p.id })}
            />
          </div>
        )}
      </FilterBar>
      <DataTable
        label={def.title}
        storageKey={`report-${key}`}
        columns={columns}
        rows={data?.rows}
        rowKey={(r) => JSON.stringify(r)}
        isLoading={report.isLoading}
        error={report.error}
        onRetry={() => void report.refetch()}
        empty="No rows for these filters."
      />
      <Pagination
        meta={data?.meta}
        onPage={(page) => void navigate({ search: (prev) => ({ ...prev, page }) })}
      />
    </div>
  )
}
