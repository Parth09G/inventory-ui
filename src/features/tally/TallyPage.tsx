import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { useFieldControl } from '@/components/shared/field-context'
import { DateInput } from '@/components/shared/inputs/DateInput'
import { JobProgress } from '@/components/shared/JobProgress'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DateText } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { monthStart } from '@/features/dashboard/period'
import type { Job } from '@/hooks/useJob'
import { api, call } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { problemMessage } from '@/lib/api/problem'
import { dateTime, todayIST } from '@/lib/format'
import { useCan } from '@/lib/permissions'

type S = components['schemas']
type ExportScope = S['TallyExportInput']['scope'][number]
type ImportScope =
  'groups' | 'units' | 'items' | 'customers' | 'suppliers' | 'opening_stock' | 'opening_balances'
const route = getRouteApi('/_app/tally')

const EXPORT_SCOPE: [ExportScope, string][] = [
  ['masters', 'New ledgers and items'],
  ['sales', 'Sales vouchers (Cash and Account bills)'],
  ['credit_notes', 'Credit notes'],
  ['receipts', 'Receipts'],
  ['purchases', 'Purchases'],
  ['payments', 'Payments to dealers'],
]
const IMPORT_SCOPE: [ImportScope, string][] = [
  ['groups', 'Stock groups → categories'],
  ['units', 'Units'],
  ['items', 'Stock items'],
  ['customers', 'Customer ledgers'],
  ['suppliers', 'Dealer ledgers'],
  ['opening_stock', 'Opening stock per godown'],
  ['opening_balances', 'Opening balances'],
]

/** Tally export (ongoing) and one-time import (FR-TI-01..04, ui-plan #40). */
export function TallyPage() {
  const { tab = 'export' } = route.useSearch()
  const navigate = route.useNavigate()
  const canImport = useCan('tally.import')
  return (
    <div className="grid max-w-4xl gap-4">
      <PageHeader
        title="Tally"
        meta="Export vouchers and masters as Tally XML; import masters and opening balances once, at cut-over."
      />
      <Tabs
        value={tab}
        onValueChange={(t) => void navigate({ search: { tab: t as typeof tab }, replace: true })}
      >
        <TabsList>
          <TabsTrigger value="export">Export</TabsTrigger>
          {canImport && <TabsTrigger value="import">Import</TabsTrigger>}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'export' && <ExportPanel />}
      {tab === 'import' && canImport && <ImportPanel />}
      {tab === 'history' && <History />}
    </div>
  )
}

function Checks<T extends string>({
  options,
  value,
  onChange,
  legend,
}: {
  options: [T, string][]
  value: T[]
  onChange: (v: T[]) => void
  legend: string
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {options.map(([k, label]) => (
        <label key={k} className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-ink"
            checked={value.includes(k)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))
            }
          />
          {label}
        </label>
      ))}
    </fieldset>
  )
}

function ExportPanel() {
  const qc = useQueryClient()
  const [from, setFrom] = useState(monthStart(todayIST()))
  const [to, setTo] = useState(todayIST())
  const [scope, setScope] = useState<ExportScope[]>(EXPORT_SCOPE.map(([k]) => k))
  const [again, setAgain] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const exp = useMutation({
    mutationFn: () =>
      call(
        api.POST('/tally/exports', {
          body: { from, to, scope, include_already_exported: again || undefined },
        }),
      ),
    onSuccess: (j) => {
      setJob(j)
      void qc.invalidateQueries({ queryKey: ['tally'] })
    },
  })
  return (
    <section className="grid gap-4 rounded-lg border bg-surface p-4 sm:p-5">
      <FormAlert message={exp.error ? problemMessage(exp.error) : null} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From">
          <DateInput value={from} onChange={setFrom} />
        </Field>
        <Field label="To">
          <DateInput value={to} onChange={setTo} />
        </Field>
      </div>
      <Checks legend="Include" options={EXPORT_SCOPE} value={scope} onChange={setScope} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-ink"
          checked={again}
          onChange={(e) => setAgain(e.target.checked)}
        />
        Include documents already exported (normally each version is exported once; edits go as
        alterations)
      </label>
      <div>
        <Button
          disabled={!scope.length || !from || !to || exp.isPending}
          onClick={() => exp.mutate()}
        >
          Export to Tally XML
        </Button>
      </div>
      {job && <JobProgress job={job} />}
    </section>
  )
}

function FileInput(props: React.ComponentProps<'input'>) {
  return (
    <input
      type="file"
      {...useFieldControl(props)}
      className="text-sm file:mr-3 file:h-(--control-h) file:rounded-md file:border file:border-input file:bg-surface file:px-3 file:font-medium"
    />
  )
}

function ImportPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [cutover, setCutover] = useState(todayIST())
  const [scope, setScope] = useState<ImportScope[]>(IMPORT_SCOPE.map(([k]) => k))
  const [preview, setPreview] = useState<S['TallyImportPreview'] | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const upload = useMutation({
    mutationFn: () =>
      call(
        api.POST('/tally/imports', {
          body: { file: file as unknown as string, cutover_date: cutover, scope },
          bodySerializer: (b) => {
            const fd = new FormData()
            fd.append('file', b.file as unknown as File)
            fd.append('cutover_date', b.cutover_date)
            for (const s of b.scope ?? []) fd.append('scope', s)
            return fd
          },
        }),
      ),
    onSuccess: (p) => {
      setPreview(p)
      setJob(null)
    },
  })
  const commit = useMutation({
    mutationFn: (id: number) =>
      call(api.POST('/tally/imports/{id}/commit', { params: { path: { id } }, body: {} })),
    onSuccess: setJob,
  })
  const errors = Object.values(preview?.counts ?? {}).some((c) => (c.errors ?? 0) > 0)

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-lg border bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold">1. Upload and preview</h2>
        <p className="text-sm text-ink-muted">
          Nothing is written until you confirm the preview. The import is all-or-nothing.
        </p>
        <FormAlert message={upload.error ? problemMessage(upload.error) : null} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tally export (XML or Excel)">
            <FileInput
              accept=".xml,.xlsx"
              onChange={(e) => (setFile(e.target.files?.[0] ?? null), setPreview(null))}
            />
          </Field>
          <Field label="Cut-over date" hint="Opening stock and balances as on this date">
            <DateInput value={cutover} onChange={setCutover} />
          </Field>
        </div>
        <Checks legend="Import" options={IMPORT_SCOPE} value={scope} onChange={setScope} />
        <div>
          <Button
            disabled={!file || !scope.length || upload.isPending}
            onClick={() => upload.mutate()}
          >
            Upload and preview
          </Button>
        </div>
      </section>

      {preview && (
        <section
          aria-label="Import preview"
          className="grid gap-4 rounded-lg border bg-surface p-4 sm:p-5"
        >
          <h2 className="text-lg font-semibold">2. Check and confirm</h2>
          <table className="w-full max-w-lg text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-ink-muted uppercase">
                <th className="pb-1 font-medium">What</th>
                <th className="pb-1 text-right font-medium">New</th>
                <th className="pb-1 text-right font-medium">Already here</th>
                <th className="pb-1 text-right font-medium">Problems</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(preview.counts ?? {}).map(([k, c]) => (
                <tr key={k} className="border-t">
                  <td className="py-1.5">
                    {IMPORT_SCOPE.find(([s]) => s === k)?.[1] ?? k.replace(/_/g, ' ')}
                  </td>
                  <td className="py-1.5 text-right tabular">{c.new ?? 0}</td>
                  <td className="py-1.5 text-right tabular">{c.existing ?? 0}</td>
                  <td
                    className={`py-1.5 text-right tabular ${c.errors ? 'font-medium text-danger' : ''}`}
                  >
                    {c.errors ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!!preview.issues?.length && (
            <table aria-label="Problems found" className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-ink-muted uppercase">
                  <th className="pb-1 font-medium">Record</th>
                  <th className="pb-1 font-medium">Problem</th>
                  <th className="pb-1 font-medium">Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {preview.issues.map((i, n) => (
                  <tr key={n} className="border-t align-top">
                    <td className="py-1.5">
                      {i.entity}: <strong>{i.name}</strong>
                    </td>
                    <td className="py-1.5 text-danger">{i.problem}</td>
                    <td className="py-1.5 text-ink-muted">{i.suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview.expires_at && (
            <p className="text-sm text-ink-muted">
              This preview expires at {dateTime(preview.expires_at)}.
            </p>
          )}
          <FormAlert message={commit.error ? problemMessage(commit.error) : null} />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={errors || commit.isPending || !!job || !preview.import_id}
              onClick={() => commit.mutate(preview.import_id!)}
            >
              Import into the app
            </Button>
            {errors && (
              <span className="text-sm text-danger">
                Fix the problems in Tally and upload again; the import is all-or-nothing.
              </span>
            )}
          </div>
          {job && <JobProgress job={job} done={() => <span>Import finished.</span>} />}
        </section>
      )}
    </div>
  )
}

function History() {
  const [page, setPage] = useState(1)
  const syncs = useQuery({
    queryKey: ['tally', 'syncs', page],
    queryFn: () => call(api.GET('/tally/syncs', { params: { query: { page } } })),
  })
  const columns: Column<S['TallySync']>[] = [
    {
      id: 'when',
      header: 'When',
      required: true,
      cell: (s) => dateTime(s.created_at),
      mobile: 'title',
    },
    {
      id: 'dir',
      header: 'Type',
      cell: (s) => (s.direction === 'import' ? 'Import' : 'Export'),
      mobile: 'subtitle',
    },
    {
      id: 'period',
      header: 'Period',
      cell: (s) =>
        s.period_from ? (
          <>
            <DateText value={s.period_from} /> – <DateText value={s.period_to} />
          </>
        ) : null,
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: (s) => <span className="text-ink-muted">{s.scope}</span>,
    },
    {
      id: 'count',
      header: 'Records',
      align: 'right',
      cell: (s) => <span className="tabular">{s.record_count}</span>,
      mobile: 'value',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (s) => <StatusBadge status={s.status} />,
      mobile: 'meta',
    },
    {
      id: 'by',
      header: 'By',
      cell: (s) => <span className="text-ink-muted">{s.created_by_name}</span>,
    },
  ]
  return (
    <>
      <DataTable
        label="Tally history"
        columns={columns}
        rows={syncs.data?.data}
        rowKey={(s) => s.id ?? 0}
        isLoading={syncs.isLoading}
        error={syncs.error}
        empty="No imports or exports yet."
      />
      <Pagination meta={syncs.data?.meta} onPage={setPage} />
    </>
  )
}
