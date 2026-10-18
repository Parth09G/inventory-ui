import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { FileDown, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Field } from '@/components/shared/Field'
import { DateInput } from '@/components/shared/inputs/DateInput'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { FilterBar } from '@/components/shared/FilterBar'
import { FormAlert } from '@/components/shared/FormAlert'
import { KeyValueGrid } from '@/components/shared/KeyValueGrid'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Balance, Code, DateText, Money } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { problemMessage } from '@/lib/api/problem'
import { statesQuery } from '@/lib/api/reference'
import { openSignedUrl } from '@/lib/download'
import { balance as fmtBalance, isZero } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import {
  KIND_LABEL,
  ledgerQuery,
  partyQuery,
  useDeactivateParty,
  useStatement,
  type LedgerEntry,
} from './api'
import { whatsappLink } from './party-form'

const route = getRouteApi('/_app/parties/$id/')

/** Party with its ledger, statement and reminder (FR-CU-02, FR-CU-04, ui-plan #18). */
export function PartyPage() {
  const { id } = route.useParams()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const go = useNavigate()
  const { data: party } = useSuspenseQuery(partyQuery(id))
  const states = useQuery(statesQuery())
  const canManage = useCan('party.manage')
  const canDeactivate = useCan('party.deactivate')
  const canPay = useCan('payment.create')
  const deactivate = useDeactivateParty()
  const statement = useStatement()
  const [statementOpen, setStatementOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tab = search.tab ?? 'ledger'
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
  const state = states.data?.find((s) => s.code === party.state_code)

  const sendReminder = async () => {
    try {
      const { url } = await statement.mutateAsync({ id })
      const b = fmtBalance(party.balance)
      const link = whatsappLink(
        party.mobile,
        `Dear ${party.name}, your outstanding balance with us is ₹ ${b.text}${b.side ? ` ${b.side}` : ''}. Statement of account: ${url}`,
      )
      if (link) window.open(link, '_blank', 'noopener')
    } catch (e) {
      toast.error(problemMessage(e))
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title={party.name}
        back={
          <Link to="/parties" className="hover:text-ink">
            Parties
          </Link>
        }
        meta={
          <span className="flex flex-wrap items-center gap-2">
            {KIND_LABEL[party.kind]}
            {party.gstin && <Code copy>{party.gstin}</Code>}
            {!party.is_active && <StatusBadge status="inactive" />}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setStatementOpen(true)}>
              <FileDown className="size-4" /> Statement
            </Button>
            {canPay && (
              <Button variant="outline" asChild>
                <Link
                  to="/payments/new"
                  search={{ direction: party.kind === 'supplier' ? 'paid' : 'received', party: id }}
                >
                  Record payment
                </Link>
              </Button>
            )}
            {party.mobile && !isZero(party.balance) && (
              <Button
                variant="outline"
                onClick={() => void sendReminder()}
                disabled={statement.isPending}
              >
                <MessageCircle className="size-4" /> WhatsApp reminder
              </Button>
            )}
            {canManage && (
              <Button variant="outline" asChild>
                <Link to="/parties/$id/edit" params={{ id }}>
                  Edit
                </Link>
              </Button>
            )}
            {canDeactivate && party.is_active && (
              <Button variant="outline" onClick={() => setConfirm(true)}>
                Deactivate
              </Button>
            )}
          </>
        }
      />

      <section
        aria-label="Balance"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-rule sm:grid-cols-3"
      >
        <div className="col-span-2 bg-surface px-4 py-3 sm:col-span-1">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Balance</p>
          <p className="mt-1 text-figure font-semibold whitespace-nowrap">
            ₹ <Balance value={party.balance} />
          </p>
          <p className="text-sm text-ink-muted">
            {party.balance.startsWith('-')
              ? 'We owe them'
              : isZero(party.balance)
                ? 'Settled'
                : 'They owe us'}
          </p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Credit limit</p>
          <p className="mt-1 text-lg">
            {party.credit_limit ? (
              <Money value={party.credit_limit} symbol />
            ) : (
              <span className="text-ink-faint">None</span>
            )}
          </p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Contact</p>
          <p className="mt-1 tabular">
            {party.mobile ?? <span className="text-ink-faint">No mobile</span>}
          </p>
          {state && <p className="text-sm text-ink-muted">{state.name}</p>}
        </div>
      </section>

      <Tabs value={tab} onValueChange={(t) => set({ tab: t as 'ledger' | 'details' })}>
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="details">Details and sites</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'ledger' ? (
        <Ledger partyId={id} from={search.from} to={search.to} set={set} />
      ) : (
        <div className="grid gap-4">
          <KeyValueGrid
            className="rounded-lg border bg-surface p-4"
            items={[
              ['Billing address', party.billing_address],
              ['PIN code', party.pincode],
              ['Other phone', party.alt_phone],
              ['Opening balance', <Balance key="o" value={party.opening_balance} />],
              ['Notes', party.notes],
            ]}
          />
          <div>
            <h2 className="mb-2 text-lg font-semibold">Sites</h2>
            {party.sites?.length ? (
              <ul className="grid divide-y rounded-lg border bg-surface">
                {party.sites.map((s) => (
                  <li key={s.id} className="px-4 py-2.5">
                    <p className="font-medium">{s.label}</p>
                    <p className="text-sm text-ink-muted">{s.address}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted">No delivery sites.</p>
            )}
          </div>
        </div>
      )}

      <StatementDialog
        open={statementOpen}
        onOpenChange={setStatementOpen}
        pending={statement.isPending}
        onDownload={async (from, to) => {
          try {
            const { url } = await statement.mutateAsync({ id, from, to })
            openSignedUrl(url)
            setStatementOpen(false)
          } catch (e) {
            return problemMessage(e)
          }
        }}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={(o) => !o && (setConfirm(false), setError(null))}
        title={`Deactivate ${party.name}?`}
        effect="They are hidden from new bills, purchases and payments. Their ledger and history stay."
        confirmLabel="Deactivate party"
        danger
        error={error}
        pending={deactivate.isPending}
        onConfirm={async () => {
          try {
            await deactivate.mutateAsync(id)
            toast.success(`${party.name} deactivated`)
            setConfirm(false)
            await go({ to: '/parties' })
          } catch (e) {
            setError(problemMessage(e))
          }
        }}
      />
    </div>
  )
}

function Ledger({
  partyId,
  from,
  to,
  set,
}: {
  partyId: number
  from?: string
  to?: string
  set: (p: { from?: string; to?: string }) => void
}) {
  const ledger = useQuery(ledgerQuery(partyId, { from, to }))
  const columns: Column<LedgerEntry>[] = [
    {
      id: 'date',
      header: 'Date',
      width: '7rem',
      required: true,
      cell: (e) => <DateText value={e.date} />,
      footer: 'Closing balance',
      mobile: 'title',
    },
    {
      id: 'doc',
      header: 'Document',
      cell: (e) => (e.ref_no ? <Code>{e.ref_no}</Code> : null),
      mobile: 'subtitle',
    },
    { id: 'narration', header: 'Particulars', cell: (e) => e.narration, mobile: 'subtitle' },
    {
      id: 'debit',
      header: 'Debit ₹',
      align: 'right',
      cell: (e) => (isZero(e.debit) ? null : <Money value={e.debit} />),
      mobile: 'value',
    },
    {
      id: 'credit',
      header: 'Credit ₹',
      align: 'right',
      cell: (e) => (isZero(e.credit) ? null : <Money value={e.credit} className="text-success" />),
      mobile: 'value',
    },
    {
      id: 'balance',
      header: 'Balance ₹',
      align: 'right',
      cell: (e) => <Balance value={e.balance} className="font-medium" />,
      footer: ledger.data && <Balance value={ledger.data.closing} />,
      mobile: 'meta',
    },
  ]
  return (
    <div>
      <FilterBar active={!!(from || to)} onClear={() => set({ from: undefined, to: undefined })}>
        <DateRange from={from} to={to} onChange={(r) => set(r)} />
      </FilterBar>
      {ledger.data && (
        <p className="mb-2 text-sm text-ink-muted">
          Opening balance
          {from && (
            <>
              {' '}
              on <DateText value={from} />
            </>
          )}
          : <Balance value={ledger.data.opening} className="text-ink" />
        </p>
      )}
      <DataTable
        label="Ledger"
        columns={columns}
        rows={ledger.data?.entries}
        rowKey={(e) => `${e.id}-${e.date}-${e.ref_no}`}
        isLoading={ledger.isLoading}
        error={ledger.error}
        onRetry={() => void ledger.refetch()}
        empty="No entries in this period."
      />
      {ledger.data && (
        <p className="mt-2 text-right text-sm text-ink-muted lg:hidden">
          Closing balance: <Balance value={ledger.data.closing} className="font-medium text-ink" />
        </p>
      )}
    </div>
  )
}

function StatementDialog({
  open,
  onOpenChange,
  onDownload,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDownload: (from?: string, to?: string) => Promise<string | void>
  pending: boolean
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), setError(null))}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Statement of account</DialogTitle>
          <DialogDescription>
            A PDF of the ledger for the period. Leave the dates empty for everything.
          </DialogDescription>
        </DialogHeader>
        <FormAlert message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <DateInput value={from} onChange={setFrom} />
          </Field>
          <Field label="To">
            <DateInput value={to} onChange={setTo} />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={async () =>
              setError((await onDownload(from || undefined, to || undefined)) ?? null)
            }
          >
            <FileDown className="size-4" /> Download statement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
