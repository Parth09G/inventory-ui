import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, type LinkProps } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Truck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Money, Qty } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MODE_LABEL } from '@/components/shared/inputs/PaymentSplitEditor'
import { isZero, money, percent, todayIST } from '@/lib/format'
import { useNow } from '@/hooks/useNow'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  categoryBreakdownQuery,
  lowStockQuery,
  pendingQuery,
  summaryQuery,
  topItemsQuery,
  trendQuery,
} from './api'
import { fyStart, monthStart } from './period'
import { SalesTrendChart } from './SalesTrendChart'

const route = getRouteApi('/_app/')
type Period = 'today' | 'month' | 'fy'
const PERIOD_LABEL: Record<Period, string> = {
  today: 'Today',
  month: 'This month',
  fy: 'This financial year',
}

/** Dashboard (ui-plan #4): pending work first; every number leads somewhere (design §8.3). */
export function DashboardPage() {
  const { period = 'month' } = route.useSearch()
  const navigate = route.useNavigate()
  const today = todayIST()
  const range = {
    from: period === 'today' ? today : period === 'month' ? monthStart(today) : fyStart(today),
    to: today,
  }
  const summary = useQuery(summaryQuery(range))
  const pending = useQuery(pendingQuery())
  const trend = useQuery(trendQuery(range, period === 'fy' ? 'month' : 'day'))
  const low = useQuery(lowStockQuery())
  const s = summary.data
  const now = useNow()
  const updated = summary.dataUpdatedAt
    ? Math.max(0, Math.round((now - summary.dataUpdatedAt) / 60_000))
    : null

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Dashboard"
        meta={updated !== null && (updated < 1 ? 'Updated just now' : `Updated ${updated} min ago`)}
        actions={
          <Tabs
            value={period}
            onValueChange={(p) => void navigate({ search: { period: p as Period }, replace: true })}
          >
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="fy">FY</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <PendingStrip counts={pending.data} />

      <section
        aria-label="Sales"
        className="grid gap-px overflow-hidden rounded-lg border bg-rule sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]"
      >
        <div className="bg-surface px-4 py-3">
          <p className="text-sm text-ink-muted">Sales · {PERIOD_LABEL[period].toLowerCase()}</p>
          {/* The one hero figure on this page; proportional digits read better this large. */}
          <p className="mt-1 text-[2.5rem] leading-tight font-semibold" data-testid="hero-sales">
            {s ? `₹ ${money(s.sales?.period)}` : '—'}
          </p>
          {s && (
            <p className="text-sm text-ink-muted">
              {s.sales?.bill_count ?? 0} bills · Cash ₹ {money(s.sales?.cash_bills)} · Account ₹{' '}
              {money(s.sales?.account_bills)}
            </p>
          )}
        </div>
        <Tile
          label="Gross profit"
          value={s && `₹ ${money(s.gross_profit)}`}
          note={s?.gross_margin_pct && `${percent(s.gross_margin_pct)} margin`}
          to={{ to: '/reports/$key', params: { key: 'profit' } }}
        />
        <Tile
          label="Receivables"
          value={s && `₹ ${money(s.receivables)}`}
          note="Customers owe"
          to={{ to: '/parties', search: { balance: 'receivable' } }}
        />
        <Tile
          label="Payables"
          value={s && `₹ ${money(s.payables)}`}
          note={
            s?.cheques_pending && !isZero(s.cheques_pending)
              ? `Cheques pending ₹ ${money(s.cheques_pending)}`
              : 'We owe dealers'
          }
          to={{ to: '/parties', search: { balance: 'payable' } }}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <SalesTrendChart points={trend.data ?? []} bucket={period === 'fy' ? 'month' : 'day'} />
        <LowStock items={low.data} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <StockByLocation summary={s} />
        <TopItems range={range} />
        <Categories range={range} />
        <Collections modes={s?.collections_by_mode} />
      </div>

      <p className="text-sm text-ink-muted">
        Review{' '}
        <Link
          to="/bills"
          search={{ unlinked_account_bills: true }}
          className="text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
        >
          Account bills not linked to a Cash bill
        </Link>{' '}
        – they do not reduce stock (R-1).
      </p>
    </div>
  )
}

function Tile({
  label,
  value,
  note,
  to,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  to: LinkProps
}) {
  return (
    <Link {...to} className="block bg-surface px-4 py-3 hover:bg-paper">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value ?? '—'}</p>
      {note && <p className="text-sm text-ink-muted">{note}</p>}
    </Link>
  )
}

function PendingStrip({ counts }: { counts: Record<string, number | undefined> | undefined }) {
  const canApprove = useCan('return.approve')
  if (!counts) return null
  const items: {
    n: number | undefined
    label: string
    to: LinkProps
    tone: 'danger' | 'warning'
  }[] = [
    {
      n: counts.einvoice_failed,
      label: 'e-invoices failed',
      to: { to: '/bills', search: { einvoice_status: 'failed' } },
      tone: 'danger',
    },
    {
      n: counts.blocked_bills_today,
      label: 'bills blocked for stock today',
      to: { to: '/notifications' },
      tone: 'danger',
    },
    {
      n: counts.returns_pending,
      label: canApprove ? 'returns to approve' : 'returns awaiting approval',
      to: { to: '/returns', search: { status: 'pending' } },
      tone: 'warning',
    },
    {
      n: counts.einvoice_pending,
      label: 'e-invoices pending',
      to: { to: '/bills', search: { einvoice_status: 'pending' } },
      tone: 'warning',
    },
    {
      n: counts.cheques_due,
      label: 'cheques to clear',
      to: { to: '/payments', search: { cheque_status: 'pending' } },
      tone: 'warning',
    },
    {
      n: counts.tally_unexported,
      label: 'documents not yet in Tally',
      to: { to: '/tally' },
      tone: 'warning',
    },
  ]
  const open = items.filter((i) => i.n)
  return (
    <section aria-label="Pending work" className="flex flex-wrap items-center gap-2">
      {open.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <CheckCircle2 className="size-4 text-success" aria-hidden /> Nothing waiting: no failed
          e-invoices, pending returns or blocked bills.
        </p>
      ) : (
        open.map((i) => (
          <Link
            key={i.label}
            {...i.to}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-surface',
              i.tone === 'danger'
                ? 'border-danger/40 bg-danger-tint'
                : 'border-warning/40 bg-warning-tint',
            )}
          >
            <AlertTriangle
              className={cn('size-4', i.tone === 'danger' ? 'text-danger' : 'text-warning')}
              aria-hidden
            />
            <span className="font-semibold tabular">{i.n}</span> {i.label}
          </Link>
        ))
      )}
    </section>
  )
}

function Panel({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="grid content-start gap-2 rounded-lg border bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function LowStock({ items }: { items: import('@/features/inventory/api').Item[] | undefined }) {
  const canBuy = useCan('purchase.create')
  const canMove = useCan('stock.transfer')
  return (
    <Panel
      title="Low and out of stock"
      action={
        <Link
          to="/inventory"
          search={{ stock_status: 'low' }}
          className="text-sm text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
        >
          All low stock
        </Link>
      }
    >
      {!items?.length ? (
        <p className="py-6 text-center text-ink-muted">Every item is above its reorder level.</p>
      ) : (
        <ul className="grid divide-y">
          {items.slice(0, 8).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <Link to="/items/$id" params={{ id: i.id }} className="font-medium hover:underline">
                  {i.name}
                </Link>
                <p className="text-sm text-ink-muted">
                  <Qty
                    value={i.stock_total}
                    decimals={i.base_unit.decimals}
                    unit={i.base_unit.symbol}
                  />{' '}
                  · reorder at <Qty value={i.reorder_level} decimals={i.base_unit.decimals} />
                </p>
              </div>
              <div className="flex items-center gap-1">
                <StatusBadge status={i.stock_status} />
                {canBuy && (
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link
                      to="/purchases/new"
                      search={{ item: i.id }}
                      aria-label={`New purchase of ${i.name}`}
                      title="New purchase"
                    >
                      <Truck className="size-4" />
                    </Link>
                  </Button>
                )}
                {canMove && i.stock_status !== 'out' && (
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link
                      to="/transfers/new"
                      search={{ item: i.id }}
                      aria-label={`Transfer ${i.name}`}
                      title="Transfer"
                    >
                      <ArrowLeftRight className="size-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

type Summary = NonNullable<
  ReturnType<
    typeof useQuery<Awaited<ReturnType<NonNullable<ReturnType<typeof summaryQuery>['queryFn']>>>>
  >['data']
>

function StockByLocation({ summary }: { summary: Summary | undefined }) {
  return (
    <Panel title="Stock value by location">
      <table className="w-full text-sm">
        <tbody>
          {summary?.stock?.by_location?.map((l) => (
            <tr key={l.location_id} className="border-t first:border-t-0">
              <td className="py-1.5">{l.name}</td>
              <td className="py-1.5 text-right">
                <Money value={l.value} symbol />
              </td>
            </tr>
          ))}
          {summary?.stock && (
            <tr className="border-t font-medium">
              <td className="py-1.5">
                Total · {summary.stock.items} items ({summary.stock.low_count} low,{' '}
                {summary.stock.out_count} out)
              </td>
              <td className="py-1.5 text-right">
                <Money value={summary.stock.value} symbol />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  )
}

function TopItems({ range }: { range: { from: string; to: string } }) {
  const [kind, setKind] = useState<'fast' | 'slow'>('fast')
  const top = useQuery(topItemsQuery(range, kind))
  return (
    <Panel
      title={kind === 'fast' ? 'Fast-moving items' : 'Slow-moving items'}
      action={
        <Tabs value={kind} onValueChange={(k) => setKind(k as 'fast' | 'slow')}>
          <TabsList>
            <TabsTrigger value="fast">Fast</TabsTrigger>
            <TabsTrigger value="slow">Slow</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      {!top.data?.length ? (
        <p className="py-6 text-center text-ink-muted">No sales in this period.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {top.data.map((t) => (
              <tr key={t.item_id} className="border-t first:border-t-0">
                <td className="py-1.5">
                  {t.item_id ? (
                    <Link to="/items/$id" params={{ id: t.item_id }} className="hover:underline">
                      {t.name}
                    </Link>
                  ) : (
                    t.name
                  )}
                </td>
                <td className="py-1.5 text-right">
                  <Qty value={t.qty_sold} unit={t.unit} />
                </td>
                <td className="py-1.5 text-right">
                  <Money value={t.sales} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function Categories({ range }: { range: { from: string; to: string } }) {
  const cats = useQuery(categoryBreakdownQuery(range))
  return (
    <Panel title="By category">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wide text-ink-muted uppercase">
            <th className="pb-1 font-medium">Category</th>
            <th className="pb-1 text-right font-medium">Sales ₹</th>
            <th className="pb-1 text-right font-medium">Profit ₹</th>
            <th className="hidden pb-1 text-right font-medium sm:table-cell">Stock ₹</th>
          </tr>
        </thead>
        <tbody>
          {cats.data?.map((c) => (
            <tr key={c.category_id} className="border-t">
              <td className="py-1.5">{c.name}</td>
              <td className="py-1.5 text-right">
                <Money value={c.sales} />
              </td>
              <td className="py-1.5 text-right">
                <Money value={c.profit} />
              </td>
              <td className="hidden py-1.5 text-right sm:table-cell">
                <Money value={c.stock_value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

function Collections({ modes }: { modes: { mode?: string; amount?: string }[] | undefined }) {
  return (
    <Panel title="Collections by mode">
      {!modes?.length ? (
        <p className="py-6 text-center text-ink-muted">No payments received in this period.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {modes.map((m) => (
              <tr key={m.mode} className="border-t first:border-t-0">
                <td className="py-1.5">
                  {MODE_LABEL[m.mode as keyof typeof MODE_LABEL] ?? m.mode}
                </td>
                <td className="py-1.5 text-right">
                  <Money value={m.amount} symbol />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
