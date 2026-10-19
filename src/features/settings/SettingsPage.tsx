import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { GstRateSelect } from '@/components/shared/inputs/GstRateSelect'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { StateSelect } from '@/components/shared/inputs/StateSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useFieldControl } from '@/components/shared/field-context'
import { formError } from '@/lib/api/forms'
import { problemMessage } from '@/lib/api/problem'
import { locationsQuery, settingsQuery } from '@/lib/api/reference'
import { GSTIN_RE } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  tallyMappingQuery,
  useSaveCredentials,
  useSaveLocation,
  useSaveSettings,
  useSaveTallyMapping,
  useTestCredentials,
  useUploadLogo,
  type Location,
  type Settings,
  type TallyMapping,
} from './api'

export const SECTIONS = {
  shop: 'Shop profile',
  invoice: 'Invoice and GST',
  bank: 'Bank and UPI',
  notifications: 'Notifications',
  einvoice: 'E-invoicing',
  tally: 'Tally ledgers',
  locations: 'Locations',
} as const
export type Section = keyof typeof SECTIONS

/** Settings (FR-ST-01, ui-plan #38). Only the owner changes them; others can read. */
export function SettingsPage({ section }: { section: Section }) {
  const canManage = useCan('settings.manage')
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Settings"
        meta={!canManage && 'Read only. Only the owner (Super Admin) can change settings.'}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:grid">
          {(Object.keys(SECTIONS) as Section[]).map((s) => (
            <Link
              key={s}
              to="/settings/$section"
              params={{ section: s }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-ink-muted hover:bg-surface hover:text-ink',
                s === section &&
                  'bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]',
              )}
            >
              {SECTIONS[s]}
            </Link>
          ))}
        </nav>
        <div className="max-w-3xl">
          {section === 'einvoice' ? (
            <EInvoiceSection canManage={canManage} />
          ) : section === 'tally' ? (
            <TallySection canManage={canManage} />
          ) : section === 'locations' ? (
            <LocationsSection />
          ) : (
            <SettingsForm section={section} canManage={canManage} />
          )}
        </div>
      </div>
    </div>
  )
}

const settingsSchema = z
  .object({
    shop_name: z.string().trim().min(1, 'Enter the shop name'),
    address: z.string().trim().min(1, 'Enter the address'),
    state_code: z.string().min(1, 'Choose the state'),
    gstin: z.string().trim().toUpperCase().regex(GSTIN_RE, 'Enter a valid 15-character GSTIN'),
    phone: z.string(),
    email: z
      .string()
      .trim()
      .refine((v) => !v || z.email().safeParse(v).success, 'Enter a valid email'),
    bank_name: z.string(),
    bank_account_no: z.string(),
    bank_ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^$|^[A-Z]{4}0[A-Z0-9]{6}$/, 'IFSC codes look like SBIN0001234'),
    upi_id: z
      .string()
      .trim()
      .regex(/^$|^[\w.-]+@[\w.-]+$/, 'UPI IDs look like shop@bank'),
    invoice_terms: z.string(),
    prices_include_gst: z.boolean(),
    default_charge_gst: z.string(),
    einvoice_enabled: z.boolean(),
    number_prefixes: z.record(z.string(), z.string()),
    notify_email: z.boolean(),
    notify_whatsapp: z.boolean(),
    whatsapp_number: z.string(),
  })
  .refine((v) => v.gstin.slice(0, 2) === v.state_code, {
    path: ['state_code'],
    message: 'The state does not match the GSTIN',
  })
type SettingsValues = z.infer<typeof settingsSchema>

function fromSettings(s: Settings): SettingsValues {
  return {
    shop_name: s.shop_name,
    address: s.address,
    state_code: s.state_code,
    gstin: s.gstin,
    phone: s.phone ?? '',
    email: s.email ?? '',
    bank_name: s.bank_name ?? '',
    bank_account_no: s.bank_account_no ?? '',
    bank_ifsc: s.bank_ifsc ?? '',
    upi_id: s.upi_id ?? '',
    invoice_terms: s.invoice_terms ?? '',
    prices_include_gst: !!s.prices_include_gst,
    default_charge_gst: s.default_charge_gst ?? '18',
    einvoice_enabled: !!s.einvoice_enabled,
    number_prefixes: s.number_prefixes ?? {},
    notify_email: !!s.notification_channels?.email,
    notify_whatsapp: !!s.notification_channels?.whatsapp,
    whatsapp_number: s.notification_channels?.whatsapp_number ?? '',
  }
}

function toSettings(v: SettingsValues, current: Settings): Settings {
  return {
    ...current,
    shop_name: v.shop_name,
    address: v.address,
    state_code: v.state_code,
    gstin: v.gstin,
    phone: v.phone,
    email: v.email,
    bank_name: v.bank_name,
    bank_account_no: v.bank_account_no,
    bank_ifsc: v.bank_ifsc,
    upi_id: v.upi_id,
    invoice_terms: v.invoice_terms,
    prices_include_gst: v.prices_include_gst,
    default_charge_gst: v.default_charge_gst as Settings['default_charge_gst'],
    einvoice_enabled: v.einvoice_enabled,
    number_prefixes: v.number_prefixes,
    notification_channels: {
      email: v.notify_email,
      whatsapp: v.notify_whatsapp,
      whatsapp_number: v.whatsapp_number,
    },
  }
}

const PREFIX_LABEL: Record<string, string> = {
  cash: 'Cash bills',
  account: 'Account bills',
  credit_note: 'Credit notes',
}

function Card({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="grid gap-4 rounded-lg border bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
      {footer && <div className="flex justify-end border-t pt-4">{footer}</div>}
    </section>
  )
}

/** The settings object is saved whole (PUT); each section edits part of it. */
function SettingsForm({
  section,
  canManage,
}: {
  section: Exclude<Section, 'einvoice' | 'tally' | 'locations'>
  canManage: boolean
}) {
  const { data: settings } = useSuspenseQuery(settingsQuery())
  const save = useSaveSettings()
  const logo = useUploadLogo()
  const [alert, setAlert] = useState<string | null>(null)
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: fromSettings(settings),
  })
  const e = form.formState.errors
  const onSubmit = form.handleSubmit(async (v) => {
    setAlert(null)
    try {
      const saved = await save.mutateAsync(toSettings(v, settings))
      form.reset(fromSettings(saved))
      toast.success('Settings saved')
    } catch (err) {
      setAlert(formError(err, form.setError))
    }
  })
  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={!canManage} className="grid gap-4">
        <FormAlert message={alert} />
        <Card
          title={SECTIONS[section]}
          footer={
            canManage && (
              <Button type="submit" disabled={!form.formState.isDirty || save.isPending}>
                Save settings
              </Button>
            )
          }
        >
          {section === 'shop' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shop name" error={e.shop_name?.message} className="sm:col-span-2">
                <Input {...form.register('shop_name')} />
              </Field>
              <Field
                label="Address (printed on bills)"
                error={e.address?.message}
                className="sm:col-span-2"
              >
                <Textarea rows={2} {...form.register('address')} />
              </Field>
              <Field label="GSTIN" error={e.gstin?.message}>
                <Input className="code uppercase" maxLength={15} {...form.register('gstin')} />
              </Field>
              <Field
                label="State"
                error={e.state_code?.message}
                hint="Decides CGST + SGST or IGST on every bill"
              >
                <StateSelect {...form.register('state_code')} />
              </Field>
              <Field label="Phone">
                <Input type="tel" {...form.register('phone')} />
              </Field>
              <Field label="Email" error={e.email?.message}>
                <Input type="email" {...form.register('email')} />
              </Field>
              <div className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium">Logo</span>
                <div className="flex flex-wrap items-center gap-3">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt="Shop logo"
                      className="h-12 rounded border bg-paper p-1"
                    />
                  ) : (
                    <span className="text-sm text-ink-muted">No logo yet.</span>
                  )}
                  {canManage && (
                    <LogoInput
                      onFile={async (f) => {
                        try {
                          await logo.mutateAsync(f)
                          toast.success('Logo updated')
                        } catch (err) {
                          setAlert(problemMessage(err))
                        }
                      }}
                    />
                  )}
                </div>
                <p className="text-xs text-ink-muted">PNG or JPG, up to 1 MB.</p>
              </div>
            </div>
          )}
          {section === 'invoice' && (
            <div className="grid gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-ink"
                  {...form.register('prices_include_gst')}
                />
                Rates are entered including GST
              </label>
              <div className="max-w-48">
                <Field label="Default GST on charges">
                  <GstRateSelect {...form.register('default_charge_gst')} />
                </Field>
              </div>
              {Object.keys(settings.number_prefixes ?? {}).length > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {Object.keys(settings.number_prefixes ?? {}).map((k) => (
                    <Field
                      key={k}
                      label={`${PREFIX_LABEL[k] ?? k} prefix`}
                      hint="Numbers become PREFIX/26-27/0001"
                    >
                      <Input
                        className="code"
                        maxLength={4}
                        {...form.register(`number_prefixes.${k}`)}
                      />
                    </Field>
                  ))}
                </div>
              )}
              <Field label="Terms printed on bills">
                <Textarea rows={3} {...form.register('invoice_terms')} />
              </Field>
            </div>
          )}
          {section === 'bank' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bank">
                <Input {...form.register('bank_name')} />
              </Field>
              <Field label="Account number">
                <Input
                  inputMode="numeric"
                  className="tabular"
                  {...form.register('bank_account_no')}
                />
              </Field>
              <Field label="IFSC" error={e.bank_ifsc?.message}>
                <Input className="code uppercase" {...form.register('bank_ifsc')} />
              </Field>
              <Field label="UPI ID" error={e.upi_id?.message} hint="Printed with a QR on bills">
                <Input {...form.register('upi_id')} />
              </Field>
            </div>
          )}
          {section === 'notifications' && (
            <div className="grid gap-3">
              <p className="text-sm text-ink-muted">
                Shortage, reorder, return approval and e-invoice failure alerts always appear in the
                app. Also send them by:
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-ink"
                  {...form.register('notify_email')}
                />
                Email to the owner
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-ink"
                  {...form.register('notify_whatsapp')}
                />
                WhatsApp
              </label>
              <div className="max-w-xs">
                <Field label="WhatsApp number">
                  <Input type="tel" {...form.register('whatsapp_number')} />
                </Field>
              </div>
            </div>
          )}
        </Card>
      </fieldset>
    </form>
  )
}

function LogoInput({ onFile }: { onFile: (f: File) => void }) {
  const props = useFieldControl({})
  return (
    <input
      {...props}
      type="file"
      aria-label="Upload logo"
      accept="image/png,image/jpeg"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) onFile(f)
      }}
      className="text-sm file:mr-3 file:h-(--control-h) file:rounded-md file:border file:border-input file:bg-surface file:px-3 file:font-medium"
    />
  )
}

const credSchema = z.object({
  provider: z.string().trim().min(1, 'Enter the GSP / ASP name'),
  environment: z.enum(['sandbox', 'production']),
  username: z.string().trim().min(1, 'Enter the username'),
  password: z.string().min(1, 'Enter the password'),
  client_id: z.string(),
  client_secret: z.string(),
})

function EInvoiceSection({ canManage }: { canManage: boolean }) {
  const { data: settings } = useSuspenseQuery(settingsQuery())
  const saveSettings = useSaveSettings()
  const saveCreds = useSaveCredentials()
  const testCreds = useTestCredentials()
  const canCreds = useCan('einvoice.credentials')
  const [alert, setAlert] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok?: boolean; message?: string } | null>(null)
  const form = useForm<z.infer<typeof credSchema>>({
    resolver: zodResolver(credSchema),
    defaultValues: {
      provider: '',
      environment: 'sandbox',
      username: '',
      password: '',
      client_id: '',
      client_secret: '',
    },
  })
  const e = form.formState.errors
  return (
    <div className="grid gap-4">
      <Card title="E-invoicing">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-ink"
            disabled={!canManage || saveSettings.isPending}
            checked={!!settings.einvoice_enabled}
            onChange={async (ev) => {
              try {
                await saveSettings.mutateAsync({ ...settings, einvoice_enabled: ev.target.checked })
                toast.success(
                  ev.target.checked ? 'E-invoicing turned on' : 'E-invoicing turned off',
                )
              } catch (err) {
                toast.error(problemMessage(err))
              }
            }}
          />
          Generate e-invoices (IRN) for B2B bills and credit notes
        </label>
      </Card>
      {canCreds && (
        <form
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            setAlert(null)
            try {
              await saveCreds.mutateAsync({
                ...v,
                client_id: v.client_id || undefined,
                client_secret: v.client_secret || undefined,
              })
              form.reset({ ...v, password: '', client_secret: '' })
              toast.success('Credentials saved')
            } catch (err) {
              setAlert(formError(err, form.setError))
            }
          })}
        >
          <Card
            title="GSP / ASP credentials"
            footer={
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={testCreds.isPending}
                  onClick={async () => {
                    try {
                      setTestResult(await testCreds.mutateAsync())
                    } catch (err) {
                      setTestResult({ ok: false, message: problemMessage(err) })
                    }
                  }}
                >
                  Test connection
                </Button>
                <Button type="submit" disabled={saveCreds.isPending}>
                  Save credentials
                </Button>
              </div>
            }
          >
            <p className="text-sm text-ink-muted">
              Stored encrypted on the server and never shown again. Enter them again to change them.
            </p>
            <FormAlert message={alert} />
            {testResult && (
              <p
                role="status"
                className={cn(
                  'rounded-md border px-3 py-2 text-sm',
                  testResult.ok
                    ? 'border-success/40 bg-success-tint'
                    : 'border-danger/40 bg-danger-tint',
                )}
              >
                {testResult.ok ? 'Connected. ' : 'Could not connect. '}
                {testResult.message}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Provider" error={e.provider?.message}>
                <Input {...form.register('provider')} />
              </Field>
              <Field label="Environment">
                <NativeSelect {...form.register('environment')}>
                  <option value="sandbox">Sandbox (testing)</option>
                  <option value="production">Production</option>
                </NativeSelect>
              </Field>
              <Field label="Username" error={e.username?.message}>
                <Input autoComplete="off" {...form.register('username')} />
              </Field>
              <Field label="Password" error={e.password?.message}>
                <Input type="password" autoComplete="new-password" {...form.register('password')} />
              </Field>
              <Field label="Client ID">
                <Input autoComplete="off" {...form.register('client_id')} />
              </Field>
              <Field label="Client secret">
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...form.register('client_secret')}
                />
              </Field>
            </div>
          </Card>
        </form>
      )}
    </div>
  )
}

const TALLY_FIELDS: [keyof TallyMapping, string][] = [
  ['sales_ledger_cash', 'Sales ledger (Cash bills)'],
  ['sales_ledger_account', 'Sales ledger (Account bills)'],
  ['voucher_type_cash', 'Voucher type (Cash bills)'],
  ['voucher_type_account', 'Voucher type (Account bills)'],
  ['purchase_ledger', 'Purchase ledger'],
  ['cgst_ledger', 'CGST ledger'],
  ['sgst_ledger', 'SGST ledger'],
  ['igst_ledger', 'IGST ledger'],
  ['labour_ledger', 'Labour charges ledger'],
  ['transport_ledger', 'Transport charges ledger'],
  ['round_off_ledger', 'Round-off ledger'],
  ['cash_ledger', 'Cash ledger'],
  ['bank_ledger', 'Bank ledger'],
]

function TallySection({ canManage }: { canManage: boolean }) {
  const mapping = useQuery(tallyMappingQuery())
  if (!mapping.data) return null
  return <TallyForm key="m" mapping={mapping.data} canManage={canManage} />
}

function TallyForm({ mapping, canManage }: { mapping: TallyMapping; canManage: boolean }) {
  const save = useSaveTallyMapping()
  const form = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(TALLY_FIELDS.map(([k]) => [k, mapping[k] ?? ''])),
  })
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        try {
          await save.mutateAsync(v as TallyMapping)
          form.reset(v)
          toast.success('Tally ledgers saved')
        } catch (err) {
          toast.error(problemMessage(err))
        }
      })}
    >
      <fieldset disabled={!canManage}>
        <Card
          title="Tally ledger names"
          footer={
            canManage && (
              <Button type="submit" disabled={!form.formState.isDirty || save.isPending}>
                Save ledgers
              </Button>
            )
          }
        >
          <p className="text-sm text-ink-muted">
            Exports use these names exactly as they are in Tally.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TALLY_FIELDS.map(([k, label]) => (
              <Field key={k} label={label}>
                <Input {...form.register(k)} />
              </Field>
            ))}
          </div>
        </Card>
      </fieldset>
    </form>
  )
}

function LocationsSection() {
  const locations = useQuery(locationsQuery())
  const canManage = useCan('location.manage')
  const [editing, setEditing] = useState<Location | 'new' | null>(null)
  const columns: Column<Location>[] = [
    { id: 'name', header: 'Name', required: true, cell: (l) => l.name, mobile: 'title' },
    {
      id: 'kind',
      header: 'Kind',
      cell: (l) => (l.kind === 'shop' ? 'Shop' : 'Godown'),
      mobile: 'subtitle',
    },
    {
      id: 'address',
      header: 'Address',
      cell: (l) => <span className="text-ink-muted">{l.address}</span>,
    },
    {
      id: 'default',
      header: 'Billing default',
      cell: (l) => (l.is_default_billing ? <Badge tone="info">Default</Badge> : null),
      mobile: 'meta',
    },
  ]
  if (canManage)
    columns.push({
      id: 'edit',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      required: true,
      cell: (l) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(l)}
          aria-label={`Edit ${l.name}`}
        >
          Edit
        </Button>
      ),
      mobile: 'meta',
    })
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Locations</h2>
        {canManage && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add location
          </Button>
        )}
      </div>
      <DataTable
        label="Locations"
        columns={columns}
        rows={locations.data}
        rowKey={(l) => l.id}
        isLoading={locations.isLoading}
        error={locations.error}
        empty="No locations."
      />
      {editing && (
        <LocationDialog
          location={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

const locationSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  kind: z.enum(['shop', 'godown']),
  address: z.string().trim(),
  is_default_billing: z.boolean(),
})

function LocationDialog({ location, onClose }: { location?: Location; onClose: () => void }) {
  const save = useSaveLocation()
  const [alert, setAlert] = useState<string | null>(null)
  const form = useForm<z.infer<typeof locationSchema>>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: location?.name ?? '',
      kind: location?.kind ?? 'godown',
      address: location?.address ?? '',
      is_default_billing: !!location?.is_default_billing,
    },
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{location ? `Edit ${location.name}` : 'Add location'}</DialogTitle>
        </DialogHeader>
        <form
          id="location-form"
          noValidate
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await save.mutateAsync({
                id: location?.id,
                body: { ...v, address: v.address || undefined },
              })
              toast.success(location ? 'Location saved' : 'Location added')
              onClose()
            } catch (err) {
              setAlert(
                formError(err, form.setError, {
                  duplicateField: 'name',
                  duplicateMessage: 'A location with this name exists',
                }),
              )
            }
          })}
        >
          <FormAlert message={alert} />
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input autoFocus {...form.register('name')} />
          </Field>
          <Field label="Kind">
            <NativeSelect {...form.register('kind')}>
              <option value="shop">Shop</option>
              <option value="godown">Godown</option>
            </NativeSelect>
          </Field>
          <Field label="Address">
            <Input {...form.register('address')} />
          </Field>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              {...form.register('is_default_billing')}
            />
            Default location for bill lines
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="location-form" disabled={save.isPending}>
            {location ? 'Save location' : 'Add location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
