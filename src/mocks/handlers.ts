import { http, HttpResponse, type JsonBodyType } from 'msw'
import type { components } from '@/lib/api/schema'
import { billFrom, calculate } from './calc'
import * as data from './data'
import { actionsFor, db, source, summarize } from './db'

type S = components['schemas']

/** Same hosts as .env.demo. */
export const API = '/demo-api/v1'
export const AUTH = 'https://demo.supabase.local/auth/v1'
/** Any password works in the demo; these are the accounts. */
export const DEMO_USERS = [data.superAdmin, data.admin]

const f2 = (n: number) => n.toFixed(2)
const f3 = (n: number) => n.toFixed(3)
const nowIso = () => new Date().toISOString()
const todayIST = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const json = (body: JsonBodyType, status = 200) => HttpResponse.json(body, { status })
const problem = (
  status: number,
  code: string,
  detail: string,
  extra: Record<string, unknown> = {},
) =>
  HttpResponse.json(
    { title: detail, detail, status, code, request_id: 'demo', ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
const signed = (name: string) => ({
  url: `/demo-files/${name}`,
  expires_at: new Date(Date.now() + 600_000).toISOString(),
})
const job = (kind: S['Job']['kind'], result?: string): S['Job'] => ({
  id: crypto.randomUUID(),
  kind,
  status: 'succeeded',
  progress: 100,
  result_url: result ? signed(result).url : null,
  created_at: nowIso(),
  finished_at: nowIso(),
})

function paged<T>(rows: T[], url: URL) {
  const page = Number(url.searchParams.get('page') ?? 1)
  const size = Number(url.searchParams.get('page_size') ?? 50)
  return {
    data: rows.slice((page - 1) * size, page * size),
    meta: { page, page_size: size, total: rows.length },
  }
}
const q = (url: URL) => (url.searchParams.get('q') ?? '').toLowerCase()
const byId = <T extends { id?: number }>(list: T[], id: string | readonly string[] | undefined) =>
  list.find((x) => x.id === Number(id))

function audit(action: string, entity: string, entity_id?: number, after?: unknown) {
  db.audit.unshift({
    id: db.audit.length + 1,
    user_name: db.me.full_name,
    action,
    entity,
    entity_id,
    after: (after ?? null) as never,
    created_at: nowIso(),
  })
}

/** Stock change at a location, keeping totals and status in step (base units). */
function moveStock(itemId: number, locationId: number, delta: number) {
  const it = db.items.find((i) => i.id === itemId)
  if (!it) return
  const loc = it.stock?.find((s) => s.location_id === locationId)
  if (loc) loc.qty = f3(Number(loc.qty) + delta)
  const total = (it.stock ?? []).reduce((s, x) => s + Number(x.qty), 0)
  it.stock_total = f3(total)
  it.stock_value = f2(total * Number(it.avg_cost ?? 0))
  it.stock_status = total <= 0 ? 'out' : total <= Number(it.reorder_level ?? 0) ? 'low' : 'ok'
}
const baseQty = (itemId: number, unitId: number, qty: string) =>
  Number(qty) *
  Number(
    db.items.find((i) => i.id === itemId)?.units?.find((u) => u.unit_id === unitId)
      ?.factor_to_base ?? 1,
  )

function partyBalance(partyId: number | null | undefined, delta: number) {
  const p = db.parties.find((x) => x.id === partyId)
  if (p) p.balance = f2(Number(p.balance) + delta)
}

function saveBill(input: S['BillInput'], existing?: S['Bill']) {
  const calc = calculate(input, source())
  if (input.status === 'active' && input.bill_type === 'cash' && calc.stock_warnings.length) {
    db.notifications.unshift({
      id: ++db.seq.misc,
      kind: 'stock_short',
      title: `Bill blocked: ${calc.stock_warnings[0]!.item_name} short at ${calc.stock_warnings[0]!.location_name}`,
      body: `${db.me.full_name} tried to bill more than is in stock`,
      item_id: calc.stock_warnings[0]!.item_id,
      is_read: false,
      created_at: nowIso(),
    })
    return problem(422, 'INSUFFICIENT_STOCK', 'Not enough stock for some lines', {
      short_lines: calc.stock_warnings,
      alert_sent: true,
    })
  }
  if (input.expected_total && input.expected_total !== calc.totals.grand_total)
    return problem(400, 'VALIDATION_FAILED', 'Totals changed', {
      errors: [
        {
          field: 'expected_total',
          message: `the server's grand total is ${calc.totals.grand_total}`,
        },
      ],
    })
  if (existing?.status === 'active') undoBill(existing)
  const id = existing?.id ?? ++db.seq.bill
  const becomesActive = input.status === 'active'
  const no =
    existing?.bill_no ??
    (becomesActive
      ? input.bill_type === 'cash'
        ? `C/26-27/${String(++db.seq.cash).padStart(4, '0')}`
        : `A/26-27/${String(++db.seq.account).padStart(4, '0')}`
      : null)
  const b = billFrom(
    input,
    {
      id,
      bill_no: no,
      version: (existing?.version ?? 0) + 1,
      created_at: existing?.created_at ?? nowIso(),
      created_by_name: existing?.created_by_name ?? db.me.full_name,
      source_bill: existing?.source_bill ?? null,
      einvoice:
        becomesActive &&
        input.customer.party_id &&
        db.parties.find((p) => p.id === input.customer.party_id)?.gstin
          ? { status: 'pending' }
          : { status: 'not_required' },
    },
    source(),
  )
  b.lines = b.lines.map((l, i) => ({ ...l, id: id * 10 + i }))
  b.allowed_actions = actionsFor(b)
  if (becomesActive) applyBill(b)
  if (existing) db.bills[db.bills.indexOf(existing)] = b
  else db.bills.unshift(b)
  audit(existing ? 'edit' : 'create', 'bill', id, {
    bill_no: no,
    grand_total: b.totals.grand_total,
  })
  return json(b, existing ? 200 : 201)
}

function applyBill(b: S['Bill'], sign = 1) {
  if (b.bill_type === 'cash' && !b.source_bill)
    for (const l of b.lines)
      moveStock(l.item_id!, l.location_id!, -sign * baseQty(l.item_id!, l.unit_id!, l.qty!))
  if (!b.source_bill) partyBalance(b.customer.party_id, sign * Number(b.totals.balance_due ?? 0))
}
const undoBill = (b: S['Bill']) => applyBill(b, -1)

// The e-invoice "worker": pending IRNs arrive a few seconds after the bill is opened.
function settleEInvoice(b: S['Bill']) {
  if (b.einvoice.status !== 'pending') return
  const since = Date.parse(b.updated_at ?? b.created_at ?? nowIso())
  if (Date.now() - since > 5000) {
    b.einvoice = {
      status: 'generated',
      irn: crypto.randomUUID().replace(/-/g, '').slice(0, 32),
      ack_no: String(Date.now()).slice(-12),
      ack_date: nowIso(),
      cancel_deadline: new Date(Date.now() + 86_400_000).toISOString(),
    }
    b.allowed_actions = actionsFor(b)
  } else b.updated_at ??= nowIso()
}

export const handlers = [
  // ---------------------------------------------------------------- Supabase Auth (sign-in only)
  http.post(`${AUTH}/token`, async ({ request }) => {
    const url = new URL(request.url)
    if (url.searchParams.get('grant_type') !== 'password') return json(session(db.me))
    const body = (await request.json()) as { email: string }
    const user = DEMO_USERS.find((u) => u.email === body.email.trim().toLowerCase())
    if (!user)
      return json(
        { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
        400,
      )
    db.me = structuredClone(user)
    for (const b of db.bills) b.allowed_actions = actionsFor(b)
    return json(session(user))
  }),
  http.get(`${AUTH}/user`, () => json(session(db.me).user)),
  http.put(`${AUTH}/user`, () => json(session(db.me).user)),
  http.post(`${AUTH}/logout`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${AUTH}/recover`, () => json({})),

  // ---------------------------------------------------------------- system
  http.get(`${API}/me`, () => json(db.me)),
  http.get(`${API}/lookups/states`, () => json(data.states)),
  http.get(`${API}/jobs/:id`, ({ params }) =>
    json({ ...job('report_export', 'export.pdf'), id: String(params.id) }),
  ),
  http.get(`${API}/search`, ({ request }) => {
    const term = q(new URL(request.url))
    return json({
      items: db.items
        .filter((i) => i.name.toLowerCase().includes(term))
        .slice(0, 5)
        .map((i) => ({ id: i.id, name: i.name, stock_total: i.stock_total })),
      parties: db.parties
        .filter((p) => p.name.toLowerCase().includes(term))
        .slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, mobile: p.mobile ?? undefined })),
      bills: db.bills
        .filter(
          (b) =>
            (b.bill_no ?? '').toLowerCase().includes(term) ||
            (b.customer.name ?? '').toLowerCase().includes(term),
        )
        .slice(0, 5)
        .map((b) => ({
          id: b.id,
          bill_no: b.bill_no ?? 'Draft',
          customer_name: b.customer.name,
          grand_total: b.totals.grand_total,
        })),
    })
  }),
  http.get(`${API}/notifications`, ({ request }) => {
    const url = new URL(request.url)
    const rows =
      url.searchParams.get('unread_only') === 'true'
        ? db.notifications.filter((n) => !n.is_read)
        : db.notifications
    return json(paged(rows, url))
  }),
  http.post(
    `${API}/notifications/read-all`,
    () => (
      db.notifications.forEach((n) => (n.is_read = true)),
      new HttpResponse(null, { status: 204 })
    ),
  ),
  http.post(`${API}/notifications/:id/read`, ({ params }) => {
    const n = byId(db.notifications, params.id)
    if (n) n.is_read = true
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------------------------------------------------------------- settings, users
  http.get(`${API}/settings`, () => json(db.settings)),
  http.put(
    `${API}/settings`,
    async ({ request }) => (
      (db.settings = (await request.json()) as S['Settings']),
      audit('settings', 'settings'),
      json(db.settings)
    ),
  ),
  http.put(`${API}/settings/logo`, () => json(db.settings)),
  http.put(`${API}/settings/einvoice-credentials`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API}/settings/einvoice-credentials/test`, () =>
    json({ ok: true, message: 'Sandbox login succeeded (demo).' }),
  ),
  http.get(`${API}/settings/tally-mapping`, () => json(db.tallyMapping)),
  http.put(
    `${API}/settings/tally-mapping`,
    async ({ request }) => (
      (db.tallyMapping = (await request.json()) as S['TallyMapping']),
      json(db.tallyMapping)
    ),
  ),
  http.get(`${API}/users`, () => json(db.users)),
  http.post(`${API}/users`, async ({ request }) => {
    const u = {
      id: crypto.randomUUID(),
      is_active: true,
      ...((await request.json()) as S['UserInvite']),
    } as S['User']
    db.users.push(u)
    return json(u, 201)
  }),
  http.patch(`${API}/users/:id`, async ({ params, request }) => {
    const u = db.users.find((x) => x.id === params.id)!
    const patch = (await request.json()) as S['UserPatch']
    if (
      patch.role === 'admin' &&
      u.role === 'super_admin' &&
      db.users.filter((x) => x.role === 'super_admin' && x.is_active).length === 1
    )
      return problem(409, 'CONFLICT', 'At least one active Super Admin must remain')
    Object.assign(u, patch)
    return json(u)
  }),
  http.post(`${API}/users/:id/deactivate`, ({ params }) => {
    const u = db.users.find((x) => x.id === params.id)!
    if (
      u.role === 'super_admin' &&
      db.users.filter((x) => x.role === 'super_admin' && x.is_active).length === 1
    )
      return problem(409, 'CONFLICT', 'At least one active Super Admin must remain')
    u.is_active = false
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(
    `${API}/users/:id/reactivate`,
    ({ params }) => (
      (db.users.find((x) => x.id === params.id)!.is_active = true),
      new HttpResponse(null, { status: 204 })
    ),
  ),
  http.post(`${API}/users/:id/password-reset`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/audit-log`, ({ request }) => {
    const url = new URL(request.url)
    const entity = url.searchParams.get('entity')
    const action = url.searchParams.get('action')
    return json(
      paged(
        db.audit.filter(
          (a) => (!entity || a.entity?.includes(entity)) && (!action || a.action?.includes(action)),
        ),
        url,
      ),
    )
  }),

  // ---------------------------------------------------------------- catalogue
  http.get(`${API}/locations`, () => json(db.locations)),
  http.post(`${API}/locations`, async ({ request }) => {
    const l = {
      id: db.locations.length + 1,
      is_active: true,
      ...((await request.json()) as S['LocationInput']),
    }
    db.locations.push(l)
    for (const it of db.items)
      it.stock?.push({ location_id: l.id, location_name: l.name, qty: '0.000' })
    return json(l, 201)
  }),
  http.patch(`${API}/locations/:id`, async ({ params, request }) =>
    json(Object.assign(byId(db.locations, params.id)!, await request.json())),
  ),
  http.get(`${API}/units`, () => json(db.units)),
  http.post(`${API}/units`, async ({ request }) => {
    const body = (await request.json()) as S['UnitInput']
    if (db.units.some((u) => u.symbol === body.symbol))
      return problem(409, 'DUPLICATE', 'A unit with this symbol exists')
    const u = { id: db.units.length + 1, decimals: 0, ...body }
    db.units.push(u)
    return json(u, 201)
  }),
  http.patch(`${API}/units/:id`, async ({ params, request }) =>
    json(Object.assign(byId(db.units, params.id)!, await request.json())),
  ),
  http.get(`${API}/categories`, () => json(db.categories)),
  http.get(`${API}/categories/:id`, ({ params }) => json(byId(db.categories, params.id)!)),
  http.post(`${API}/categories`, async ({ request }) => {
    const body = (await request.json()) as S['CategoryInput']
    const c: S['Category'] = {
      id: db.categories.length + 10,
      name: body.name,
      default_hsn: body.default_hsn,
      default_gst: body.default_gst,
      is_active: true,
      item_count: 0,
      units: (body.units ?? []).map((u) => ({
        unit: db.units.find((x) => x.id === u.unit_id),
        is_default: u.is_default,
      })),
      attributes: (body.attributes ?? []).map((a, i) => ({ ...a, id: 900 + i })),
    }
    db.categories.push(c)
    return json(c, 201)
  }),
  http.patch(`${API}/categories/:id`, async ({ params, request }) => {
    const c = byId(db.categories, params.id)!
    const body = (await request.json()) as S['CategoryInput']
    Object.assign(c, {
      name: body.name,
      default_hsn: body.default_hsn,
      default_gst: body.default_gst,
      units: (body.units ?? []).map((u) => ({
        unit: db.units.find((x) => x.id === u.unit_id),
        is_default: u.is_default,
      })),
    })
    return json(c)
  }),
  http.post(`${API}/categories/:id/deactivate`, ({ params }) => {
    const c = byId(db.categories, params.id)!
    if (db.items.some((i) => i.category_id === c.id && i.is_active))
      return problem(409, 'INVALID_STATE', 'The category has active items')
    c.is_active = false
    return json(c)
  }),
  http.post(`${API}/categories/:id/attributes`, async ({ params, request }) => {
    const a = {
      id: Date.now() % 100000,
      ...((await request.json()) as S['CategoryAttributeInput']),
    }
    byId(db.categories, params.id)!.attributes?.push(a)
    return json(a, 201)
  }),
  http.patch(`${API}/categories/:id/attributes/:attrId`, async ({ params, request }) =>
    json(
      Object.assign(
        byId(db.categories, params.id)!.attributes!.find((a) => a.id === Number(params.attrId))!,
        await request.json(),
      ),
    ),
  ),
  http.delete(`${API}/categories/:id/attributes/:attrId`, ({ params }) => {
    const c = byId(db.categories, params.id)!
    c.attributes = c.attributes?.filter((a) => a.id !== Number(params.attrId))
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(
    `${API}/categories/:id/import-template`,
    () =>
      new HttpResponse('Demo: the real API returns an Excel template here.', {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      }),
  ),

  // ---------------------------------------------------------------- items
  http.get(`${API}/items`, ({ request }) => {
    const url = new URL(request.url)
    const cat = url.searchParams.get('category_id')
    const status = url.searchParams.get('stock_status')
    const inactive = url.searchParams.get('include_inactive') === 'true'
    const attrs = [...url.searchParams].filter(([k]) => k.startsWith('attr['))
    const rows = db.items.filter(
      (i) =>
        (inactive || i.is_active !== false) &&
        (!cat || i.category_id === Number(cat)) &&
        (!status || i.stock_status === status) &&
        i.name.toLowerCase().includes(q(url)) &&
        attrs.every(
          ([k, v]) =>
            String(i.attributes?.[k.slice(5, -1)] ?? '').toLowerCase() === v.toLowerCase(),
        ),
    )
    return json(paged(rows, url))
  }),
  http.get(`${API}/items/:id`, ({ params }) =>
    byId(db.items, params.id)
      ? json(byId(db.items, params.id)!)
      : problem(404, 'NOT_FOUND', 'No such item'),
  ),
  http.post(`${API}/items`, async ({ request }) => {
    const body = (await request.json()) as S['ItemInput']
    const cat = byId(db.categories, String(body.category_id))!
    const attrs = [...(cat.attributes ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    const name =
      body.name ||
      attrs
        .filter((a) => a.part_of_name && body.attributes[a.code])
        .map(
          (a) =>
            `${body.attributes[a.code]}${a.data_type === 'number' && a.value_unit ? ` ${a.value_unit}` : ''}`,
        )
        .join(' ')
    if (db.items.some((i) => i.category_id === body.category_id && i.name === name))
      return problem(409, 'DUPLICATE', 'Same attributes as an existing item')
    const base = db.units.find((u) => u.id === body.base_unit_id)!
    const it: S['Item'] = {
      id: ++db.seq.item,
      category_id: cat.id,
      category_name: cat.name,
      name,
      attributes: body.attributes,
      hsn_code: body.hsn_code,
      gst_rate: body.gst_rate,
      base_unit: base,
      units: [
        { unit_id: base.id, symbol: base.symbol, factor_to_base: '1.0000' },
        ...(body.units ?? []).map((u) => ({
          ...u,
          symbol: db.units.find((x) => x.id === u.unit_id)?.symbol,
        })),
      ],
      reorder_level: body.reorder_level ?? '0',
      avg_cost: body.opening_stock?.[0]?.unit_cost ?? '0',
      is_active: true,
      stock_total: '0.000',
      stock_status: 'out',
      stock: db.locations.map((l) => ({ location_id: l.id, location_name: l.name, qty: '0.000' })),
    }
    db.items.push(it)
    for (const s of body.opening_stock ?? []) moveStock(it.id, s.location_id, Number(s.qty))
    cat.item_count = (cat.item_count ?? 0) + 1
    return json(it, 201)
  }),
  http.patch(`${API}/items/:id`, async ({ params, request }) => {
    const it = byId(db.items, params.id)!
    const body = (await request.json()) as S['ItemInput']
    Object.assign(it, {
      name: body.name ?? it.name,
      hsn_code: body.hsn_code,
      gst_rate: body.gst_rate,
      reorder_level: body.reorder_level ?? it.reorder_level,
      attributes: body.attributes,
    })
    return json(it)
  }),
  http.post(
    `${API}/items/:id/deactivate`,
    ({ params }) => (
      (byId(db.items, params.id)!.is_active = false),
      new HttpResponse(null, { status: 204 })
    ),
  ),
  http.get(`${API}/items/:id/movements`, ({ params, request }) => {
    const it = byId(db.items, params.id)!
    const rows: S['StockMovement'][] = [
      {
        id: 3,
        date: todayIST(),
        kind: 'sale',
        qty_in: '0.000',
        qty_out: '20.000',
        balance: it.stock_total,
        location_id: 1,
        location_name: 'Shop',
        ref_no: 'C/26-27/0420',
        user_name: 'Suresh B',
      },
      {
        id: 2,
        date: todayIST(),
        kind: 'transfer_in',
        qty_in: '100.000',
        qty_out: '0.000',
        balance: f3(Number(it.stock_total) + 20),
        location_id: 1,
        location_name: 'Shop',
        ref_no: 'T/26-27/0012',
        user_name: 'Suresh B',
      },
      {
        id: 1,
        date: todayIST(),
        kind: 'opening',
        qty_in: f3(Number(it.stock_total) - 80),
        qty_out: '0.000',
        balance: f3(Number(it.stock_total) - 80),
        location_id: 2,
        location_name: 'Godown 1',
        user_name: 'Ramesh Kumar',
      },
    ]
    return json(paged(rows, new URL(request.url)))
  }),
  http.get(`${API}/items/:id/price-hints`, ({ params }) => {
    const it = byId(db.items, params.id)!
    return json({
      last_rate_to_customer: null,
      recent_rates: [],
      last_purchase_rate: it.last_purchase_rate ?? null,
      avg_cost: it.avg_cost ?? '0',
      unit: it.base_unit.symbol,
    })
  }),
  http.post(`${API}/items/import`, () => json(job('item_import'), 202)),

  // ---------------------------------------------------------------- parties
  http.get(`${API}/parties`, ({ request }) => {
    const url = new URL(request.url)
    const kind = url.searchParams.get('kind')
    const bal = url.searchParams.get('with_balance')
    const rows = db.parties.filter(
      (p) =>
        (!kind || p.kind === kind || p.kind === 'both') &&
        (bal !== 'receivable' || Number(p.balance) > 0) &&
        (bal !== 'payable' || Number(p.balance) < 0) &&
        [p.name, p.mobile, p.gstin].some((x) => (x ?? '').toLowerCase().includes(q(url))),
    )
    return json(paged(rows, url))
  }),
  http.get(`${API}/parties/:id`, ({ params }) =>
    byId(db.parties, params.id)
      ? json(byId(db.parties, params.id)!)
      : problem(404, 'NOT_FOUND', 'No such party'),
  ),
  http.post(`${API}/parties`, async ({ request }) => {
    const body = (await request.json()) as S['PartyInput']
    if (body.gstin && db.parties.some((p) => p.gstin === body.gstin))
      return problem(409, 'DUPLICATE', 'Another party has this GSTIN')
    const p: S['Party'] = {
      ...body,
      id: ++db.seq.party,
      balance: body.opening_balance ?? '0.00',
      is_active: true,
      sites: (body.sites ?? []).map((s, i) => ({ ...s, id: i + 100 })),
    }
    db.parties.push(p)
    audit('create', 'party', p.id, { name: p.name })
    return json(p, 201)
  }),
  http.patch(`${API}/parties/:id`, async ({ params, request }) => {
    const p = byId(db.parties, params.id)!
    const body = (await request.json()) as S['PartyInput']
    Object.assign(p, { ...body, sites: (body.sites ?? []).map((s, i) => ({ ...s, id: i + 100 })) })
    return json(p)
  }),
  http.post(
    `${API}/parties/:id/deactivate`,
    ({ params }) => (
      (byId(db.parties, params.id)!.is_active = false),
      new HttpResponse(null, { status: 204 })
    ),
  ),
  http.get(`${API}/parties/:id/ledger`, ({ params }) => {
    const p = byId(db.parties, params.id)!
    let bal = 0
    const entries: S['LedgerEntry'][] = []
    for (const b of [...db.bills]
      .reverse()
      .filter((x) => x.customer.party_id === p.id && x.status === 'active' && !x.source_bill)) {
      bal += Number(b.totals.grand_total)
      entries.push({
        id: b.id,
        date: b.bill_date,
        ref_type: 'bill',
        ref_id: b.id,
        ref_no: b.bill_no ?? '',
        narration: b.bill_type === 'cash' ? 'Cash bill' : 'Account bill',
        debit: b.totals.grand_total,
        credit: '0.00',
        balance: f2(bal),
      })
    }
    for (const pay of db.payments.filter((x) => x.party_id === p.id && x.status !== 'cancelled')) {
      bal += pay.direction === 'received' ? -Number(pay.amount) : Number(pay.amount)
      entries.push({
        id: pay.id,
        date: pay.pay_date ?? todayIST(),
        ref_type: 'payment',
        ref_id: pay.id,
        ref_no: pay.doc_no,
        narration: `${pay.mode.toUpperCase()} ${pay.reference ?? ''}`.trim(),
        debit: pay.direction === 'paid' ? pay.amount : '0.00',
        credit: pay.direction === 'received' ? pay.amount : '0.00',
        balance: f2(bal),
      })
    }
    const opening = f2(Number(p.balance) - bal)
    return json({
      party: p,
      opening,
      entries: entries.map((e) => ({ ...e, balance: f2(Number(e.balance) + Number(opening)) })),
      closing: p.balance,
    })
  }),
  http.get(`${API}/parties/:id/statement`, () => json(signed('statement.pdf'))),

  // ---------------------------------------------------------------- bills
  http.get(`${API}/bills`, ({ request }) => {
    const url = new URL(request.url)
    const p = Object.fromEntries(url.searchParams)
    const rows = db.bills
      .map(summarize)
      .filter(
        (b) =>
          (!p.status || b.status === p.status) &&
          (!p.bill_type || b.bill_type === p.bill_type) &&
          (!p.payment_status || b.payment_status === p.payment_status) &&
          (!p.einvoice_status || b.einvoice_status === p.einvoice_status) &&
          (!p.party_id || b.party_id === Number(p.party_id)) &&
          (p.unlinked_account_bills !== 'true' ||
            (b.bill_type === 'account' && !b.source_bill_id)) &&
          [b.bill_no, b.customer_name].some((x) => (x ?? '').toLowerCase().includes(q(url))),
      )
    return json(paged(rows, url))
  }),
  http.post(`${API}/bills/calculate`, async ({ request }) =>
    json(calculate((await request.json()) as S['BillInput'], source())),
  ),
  http.post(`${API}/bills`, async ({ request }) =>
    saveBill((await request.json()) as S['BillInput']),
  ),
  http.get(`${API}/bills/:id`, ({ params }) => {
    const b = byId(db.bills, params.id)
    if (!b) return problem(404, 'NOT_FOUND', 'No such bill')
    settleEInvoice(b)
    return json(b, 200)
  }),
  http.put(`${API}/bills/:id`, async ({ params, request }) => {
    const b = byId(db.bills, params.id)!
    if (request.headers.get('If-Match') !== `"${b.version}"`)
      return problem(412, 'VERSION_MISMATCH', 'Someone else changed this bill')
    const body = (await request.json()) as S['BillEditInput']
    if (b.status === 'active')
      db.revisions.set(b.id, [
        {
          version: b.version,
          reason: body.reason,
          edited_by_name: db.me.full_name,
          edited_at: nowIso(),
          snapshot: structuredClone(b),
        },
        ...(db.revisions.get(b.id) ?? []),
      ])
    return saveBill(body, b)
  }),
  http.delete(
    `${API}/bills/:id`,
    ({ params }) => (
      (db.bills = db.bills.filter((b) => b.id !== Number(params.id))),
      new HttpResponse(null, { status: 204 })
    ),
  ),
  http.post(`${API}/bills/:id/cancel`, async ({ params, request }) => {
    const b = byId(db.bills, params.id)!
    if (request.headers.get('If-Match') !== `"${b.version}"`)
      return problem(412, 'VERSION_MISMATCH', 'Someone else changed this bill')
    undoBill(b)
    Object.assign(b, {
      status: 'cancelled',
      cancel_reason: ((await request.json()) as { reason: string }).reason,
      version: b.version + 1,
    })
    b.allowed_actions = actionsFor(b)
    audit('cancel', 'bill', b.id)
    return json(b)
  }),
  http.post(`${API}/bills/:id/copy-to-account`, ({ params }) => {
    const src = byId(db.bills, params.id)!
    const id = ++db.seq.bill
    const copy: S['Bill'] = {
      ...structuredClone(src),
      id,
      bill_type: 'account',
      bill_no: `A/26-27/${String(++db.seq.account).padStart(4, '0')}`,
      version: 1,
      source_bill: { id: src.id, bill_no: src.bill_no ?? '' },
      account_copy: null,
      affects_stock: false,
      posts_to_ledger: false,
      payments: [],
      einvoice: { status: 'not_required' },
      created_at: nowIso(),
    }
    copy.allowed_actions = actionsFor(copy)
    src.account_copy = { id, bill_no: copy.bill_no ?? '' }
    src.allowed_actions = actionsFor(src).filter((a) => a !== 'copy_to_account')
    db.bills.unshift(copy)
    return json(copy, 201)
  }),
  http.get(`${API}/bills/:id/revisions`, ({ params }) =>
    json(db.revisions.get(Number(params.id)) ?? []),
  ),
  http.get(`${API}/bills/:id/pdf`, () => json(signed('invoice.pdf'))),
  http.post(`${API}/bills/:id/share`, ({ params }) => {
    const b = byId(db.bills, params.id)!
    return json({
      whatsapp_url: `https://wa.me/?text=${encodeURIComponent(`Bill ${b.bill_no} for ₹ ${b.totals.grand_total} (demo)`)}`,
      pdf_url: signed('invoice.pdf').url,
    })
  }),
  http.post(`${API}/bills/:id/einvoice`, ({ params }) => {
    const b = byId(db.bills, params.id)!
    b.einvoice = { status: 'pending' }
    b.updated_at = nowIso()
    b.allowed_actions = actionsFor(b)
    return json(b.einvoice, 202)
  }),
  http.post(`${API}/bills/:id/einvoice/cancel`, ({ params }) => {
    const b = byId(db.bills, params.id)!
    b.einvoice = { ...b.einvoice, status: 'cancelled' }
    b.allowed_actions = actionsFor(b)
    return json(b.einvoice, 202)
  }),
  http.post(`${API}/bills/:id/ewaybill`, ({ params }) => {
    const b = byId(db.bills, params.id)!
    b.einvoice = {
      ...b.einvoice,
      ewb_no: String(Date.now()).slice(-12),
      ewb_valid_until: new Date(Date.now() + 86_400_000).toISOString(),
    }
    return json(b.einvoice, 202)
  }),

  // ---------------------------------------------------------------- payments
  http.get(`${API}/payments`, ({ request }) => {
    const url = new URL(request.url)
    const p = Object.fromEntries(url.searchParams)
    return json(
      paged(
        db.payments.filter(
          (x) =>
            (!p.direction || x.direction === p.direction) &&
            (!p.mode || x.mode === p.mode) &&
            (!p.cheque_status || x.cheque_status === p.cheque_status),
        ),
        url,
      ),
    )
  }),
  http.post(`${API}/payments`, async ({ request }) => {
    const body = (await request.json()) as S['PaymentInput']
    const party = byId(db.parties, String(body.party_id))!
    let left = Number(body.amount)
    const allocations: NonNullable<S['Payment']['allocations']> = []
    const open = db.bills
      .filter(
        (b) =>
          b.customer.party_id === party.id &&
          b.status === 'active' &&
          !b.source_bill &&
          Number(b.totals.balance_due) > 0,
      )
      .reverse()
    const targets = body.auto_allocate
      ? open.map((b) => ({ b, amount: Number(b.totals.balance_due) }))
      : (body.allocations ?? []).flatMap((a) =>
          byId(db.bills, String(a.ref_id))
            ? [{ b: byId(db.bills, String(a.ref_id))!, amount: Number(a.amount) }]
            : [],
        )
    for (const { b, amount } of targets) {
      const take = Math.min(left, amount, Number(b.totals.balance_due))
      if (take <= 0) continue
      b.totals.amount_paid = f2(Number(b.totals.amount_paid ?? 0) + take)
      b.totals.balance_due = f2(Number(b.totals.balance_due) - take)
      b.allowed_actions = actionsFor(b)
      allocations.push({
        ref_type: b.bill_type === 'cash' ? 'cash_bill' : 'account_bill',
        ref_id: b.id,
        ref_no: b.bill_no ?? '',
        amount: f2(take),
      })
      left -= take
    }
    const pay: S['Payment'] = {
      id: ++db.seq.payment,
      doc_no: `${body.direction === 'received' ? 'R' : 'PY'}/26-27/${String(++db.seq.receipt).padStart(4, '0')}`,
      direction: body.direction,
      party_id: party.id,
      party_name: party.name,
      pay_date: body.pay_date ?? todayIST(),
      mode: body.mode,
      amount: f2(Number(body.amount)),
      reference: body.reference ?? null,
      cheque_no: body.cheque_no ?? null,
      cheque_date: body.cheque_date ?? null,
      bank_name: body.bank_name ?? null,
      cheque_status: body.mode === 'cheque' ? 'pending' : null,
      status: 'active',
      allocations,
      unallocated: f2(left),
    }
    partyBalance(
      party.id,
      body.direction === 'received' ? -Number(body.amount) : Number(body.amount),
    )
    db.payments.unshift(pay)
    return json(pay, 201)
  }),
  http.get(`${API}/payments/:id`, ({ params }) => json(byId(db.payments, params.id)!)),
  http.post(`${API}/payments/:id/cheque-status`, async ({ params, request }) => {
    const p = byId(db.payments, params.id)!
    p.cheque_status = ((await request.json()) as { status: 'cleared' | 'bounced' }).status
    if (p.cheque_status === 'bounced') partyBalance(p.party_id, Number(p.amount))
    return json(p)
  }),
  http.post(`${API}/payments/:id/cancel`, ({ params }) => {
    const p = byId(db.payments, params.id)!
    p.status = 'cancelled'
    partyBalance(p.party_id, p.direction === 'received' ? Number(p.amount) : -Number(p.amount))
    return json(p)
  }),
  http.get(`${API}/payments/:id/receipt`, () => json(signed('receipt.pdf'))),

  // ---------------------------------------------------------------- returns
  http.get(`${API}/returns`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    return json(
      paged(
        db.returns.filter((r) => !status || r.status === status),
        url,
      ),
    )
  }),
  http.get(`${API}/returns/:id`, ({ params }) => json(byId(db.returns, params.id)!)),
  http.post(`${API}/returns`, async ({ request }) => {
    const body = (await request.json()) as S['ReturnInput']
    const bill = byId(db.bills, String(body.bill_id))!
    const lines = body.lines.map((l) => {
      const bl = bill.lines.find((x) => x.id === l.bill_line_id)!
      return {
        bill_line_id: l.bill_line_id,
        item_id: bl.item_id,
        description: bl.description,
        qty: f3(Number(l.qty)),
        unit: bl.unit,
        location_id: l.location_id,
        rate: bl.rate,
        taxable_value: f2(Number(l.qty) * Number(bl.rate)),
        restock: l.restock,
      }
    })
    const taxable = lines.reduce((s, l) => s + Number(l.taxable_value), 0)
    const sa = db.me.role === 'super_admin'
    const cn: S['CreditNote'] = {
      id: ++db.seq.misc,
      cn_no: sa ? `CN/26-27/${String(++db.seq.cn).padStart(4, '0')}` : null,
      cn_date: body.cn_date ?? todayIST(),
      bill_id: bill.id,
      bill_no: bill.bill_no ?? '',
      party_name: bill.customer.name,
      status: sa ? 'approved' : 'pending',
      reason: body.reason,
      settlement: body.settlement,
      created_by_name: db.me.full_name,
      approved_by_name: sa ? db.me.full_name : null,
      lines,
      totals: {
        taxable_total: f2(taxable),
        cgst: f2(taxable * 0.09),
        sgst: f2(taxable * 0.09),
        grand_total: f2(Math.round(taxable * 1.18)),
      },
    }
    db.returns.unshift(cn)
    if (!sa)
      db.notifications.unshift({
        id: ++db.seq.misc,
        kind: 'return_pending',
        title: `Return against ${bill.bill_no} waiting for approval`,
        ref_type: 'credit_note',
        ref_id: cn.id,
        is_read: false,
        created_at: nowIso(),
      })
    return json(cn, 201)
  }),
  http.post(`${API}/returns/:id/approve`, ({ params }) => {
    const cn = byId(db.returns, params.id)!
    Object.assign(cn, {
      status: 'approved',
      cn_no: `CN/26-27/${String(++db.seq.cn).padStart(4, '0')}`,
      approved_by_name: db.me.full_name,
      approved_at: nowIso(),
    })
    for (const l of cn.lines ?? [])
      if (l.restock && l.item_id) moveStock(l.item_id, l.location_id ?? 1, Number(l.qty))
    return json(cn)
  }),
  http.post(`${API}/returns/:id/reject`, ({ params }) =>
    json(Object.assign(byId(db.returns, params.id)!, { status: 'rejected' })),
  ),
  http.get(`${API}/returns/:id/pdf`, () => json(signed('credit-note.pdf'))),

  // ---------------------------------------------------------------- purchases and stock
  http.get(`${API}/purchases`, ({ request }) => {
    const url = new URL(request.url)
    const party = url.searchParams.get('party_id')
    return json(
      paged(
        db.purchases.filter(
          (p) =>
            (!party || p.supplier_id === Number(party)) &&
            [p.doc_no, p.supplier_name, p.supplier_invoice_no].some((x) =>
              (x ?? '').toLowerCase().includes(q(url)),
            ),
        ),
        url,
      ),
    )
  }),
  http.get(`${API}/purchases/:id`, ({ params }) => json(byId(db.purchases, params.id)!)),
  http.post(`${API}/purchases`, async ({ request }) => {
    const body = (await request.json()) as S['PurchaseInput']
    if (
      db.purchases.some(
        (p) =>
          p.supplier_id === body.supplier_id && p.supplier_invoice_no === body.supplier_invoice_no,
      )
    )
      return problem(409, 'DUPLICATE', 'This dealer invoice is already entered')
    const dealer = byId(db.parties, String(body.supplier_id))!
    const lines = body.lines.map((l, i) => {
      const it = byId(db.items, String(l.item_id))!
      const loc = l.location_id ?? body.location_id
      const bq = baseQty(l.item_id, l.unit_id, l.qty)
      moveStock(l.item_id, loc, bq)
      it.last_purchase_rate = l.rate
      return {
        id: 800 + i,
        item_id: l.item_id,
        item_name: it.name,
        location_id: loc,
        qty: f3(Number(l.qty)),
        unit: db.units.find((u) => u.id === l.unit_id)?.symbol,
        base_qty: f3(bq),
        rate: l.rate,
        taxable_value: f2(Number(l.qty) * Number(l.rate) - Number(l.discount_amt ?? 0)),
        gst_rate: l.gst_rate ?? it.gst_rate,
        landed_unit_cost: l.rate,
      }
    })
    const taxable =
      lines.reduce((s, l) => s + Number(l.taxable_value), 0) + Number(body.freight ?? 0)
    const total = Math.round(taxable * 1.18)
    const paid = Number(body.payment?.amount ?? 0)
    const p: S['Purchase'] = {
      id: ++db.seq.purchase,
      doc_no: `P/26-27/${String(db.seq.purchase).padStart(4, '0')}`,
      supplier_id: dealer.id,
      supplier_name: dealer.name,
      supplier_invoice_no: body.supplier_invoice_no,
      supplier_invoice_dt: body.supplier_invoice_dt,
      received_date: body.received_date ?? todayIST(),
      location_id: body.location_id,
      location_name: db.locations.find((l) => l.id === body.location_id)?.name,
      status: 'active',
      lines,
      totals: body.is_interstate
        ? { taxable_total: f2(taxable), igst: f2(taxable * 0.18), grand_total: f2(total) }
        : {
            taxable_total: f2(taxable),
            cgst: f2(taxable * 0.09),
            sgst: f2(taxable * 0.09),
            grand_total: f2(total),
          },
      balance_payable: f2(total - paid),
    }
    partyBalance(dealer.id, -(total - paid))
    db.purchases.unshift(p)
    return json(p, 201)
  }),
  http.post(`${API}/purchases/:id/cancel`, () =>
    problem(422, 'INSUFFICIENT_STOCK', 'Some of this stock has been sold'),
  ),
  http.post(`${API}/purchase-returns`, () =>
    json({ id: ++db.seq.misc, doc_no: `PR/26-27/${String(db.seq.misc).padStart(4, '0')}` }, 201),
  ),
  http.get(`${API}/stock-transfers`, ({ request }) =>
    json(paged(db.transfers, new URL(request.url))),
  ),
  http.get(`${API}/stock-transfers/:id`, ({ params }) => json(byId(db.transfers, params.id)!)),
  http.post(`${API}/stock-transfers`, async ({ request }) => {
    const body = (await request.json()) as S['TransferInput']
    const short = body.lines.flatMap((l, i) => {
      const it = byId(db.items, String(l.item_id))!
      const at = it.stock?.find((s) => s.location_id === body.from_location_id)
      const need = baseQty(l.item_id, l.unit_id, l.qty)
      return Number(at?.qty ?? 0) < need
        ? [
            {
              line_no: i + 1,
              item_id: it.id,
              item_name: it.name,
              location_id: body.from_location_id,
              location_name: at?.location_name,
              required: f3(need),
              available: at?.qty ?? '0',
              unit: it.base_unit.symbol,
            },
          ]
        : []
    })
    if (short.length)
      return problem(422, 'INSUFFICIENT_STOCK', 'Not enough stock at the source', {
        short_lines: short,
      })
    const t: S['Transfer'] = {
      id: ++db.seq.transfer,
      doc_no: `T/26-27/${String(db.seq.transfer).padStart(4, '0')}`,
      transfer_date: body.transfer_date ?? todayIST(),
      from_location_id: body.from_location_id,
      to_location_id: body.to_location_id,
      created_by_name: db.me.full_name,
      lines: body.lines.map((l) => {
        const bq = baseQty(l.item_id, l.unit_id, l.qty)
        moveStock(l.item_id, body.from_location_id, -bq)
        moveStock(l.item_id, body.to_location_id, bq)
        const it = byId(db.items, String(l.item_id))!
        return { item_id: it.id, item_name: it.name, base_qty: f3(bq), unit: it.base_unit.symbol }
      }),
    }
    db.transfers.unshift(t)
    return json(t, 201)
  }),
  http.get(`${API}/stock-adjustments`, ({ request }) =>
    json(paged(db.adjustments, new URL(request.url))),
  ),
  http.post(`${API}/stock-adjustments`, async ({ request }) => {
    const body = (await request.json()) as S['AdjustmentInput']
    const a: S['Adjustment'] = {
      id: ++db.seq.adjustment,
      doc_no: `ADJ/26-27/${String(db.seq.adjustment).padStart(4, '0')}`,
      adj_date: body.adj_date ?? todayIST(),
      location_id: body.location_id,
      reason: body.reason,
      notes: body.notes,
      created_by_name: db.me.full_name,
      lines: body.lines.map(
        (l) => (
          moveStock(l.item_id, body.location_id, Number(l.qty_change)),
          {
            item_id: l.item_id,
            item_name: byId(db.items, String(l.item_id))?.name,
            qty_change: f3(Number(l.qty_change)),
          }
        ),
      ),
    }
    db.adjustments.unshift(a)
    return json(a, 201)
  }),
  http.post(`${API}/stock-counts/preview`, async ({ request }) => {
    const body = (await request.json()) as S['StockCountInput']
    return json({
      location_id: body.location_id,
      lines: body.lines.map((l) => {
        const it = byId(db.items, String(l.item_id))!
        const sys = Number(it.stock?.find((s) => s.location_id === body.location_id)?.qty ?? 0)
        const diff = Number(l.counted_qty) - sys
        return {
          item_id: it.id,
          item_name: it.name,
          system_qty: f3(sys),
          counted_qty: f3(Number(l.counted_qty)),
          difference: f3(diff),
          value_difference: f2(diff * Number(it.avg_cost ?? 0)),
        }
      }),
    })
  }),
  http.post(`${API}/stock-counts`, async ({ request }) => {
    const body = (await request.json()) as S['StockCountInput']
    const lines = body.lines.flatMap((l) => {
      const sys = Number(
        byId(db.items, String(l.item_id))?.stock?.find((s) => s.location_id === body.location_id)
          ?.qty ?? 0,
      )
      const diff = Number(l.counted_qty) - sys
      if (!diff) return []
      moveStock(l.item_id, body.location_id, diff)
      return [
        {
          item_id: l.item_id,
          item_name: byId(db.items, String(l.item_id))?.name,
          qty_change: f3(diff),
        },
      ]
    })
    const a: S['Adjustment'] = {
      id: ++db.seq.adjustment,
      doc_no: `ADJ/26-27/${String(db.seq.adjustment).padStart(4, '0')}`,
      adj_date: todayIST(),
      location_id: body.location_id,
      reason: 'count_correction',
      created_by_name: db.me.full_name,
      lines,
    }
    db.adjustments.unshift(a)
    return json(a, 201)
  }),

  // ---------------------------------------------------------------- dashboard, reports, tally
  http.get(`${API}/dashboard/summary`, () => {
    const active = db.bills.filter((b) => b.status === 'active' && !b.source_bill)
    const sum = (bs: S['Bill'][]) => f2(bs.reduce((s, b) => s + Number(b.totals.grand_total), 0))
    const value = db.items.reduce((s, i) => s + Number(i.stock_value ?? 0), 0)
    return json({
      ...data.dashboard.summary,
      stock: {
        items: db.items.length,
        value: f2(value),
        low_count: db.items.filter((i) => i.stock_status === 'low').length,
        out_count: db.items.filter((i) => i.stock_status === 'out').length,
        by_location: db.locations.map((l) => ({
          location_id: l.id,
          name: l.name,
          value: f2(
            db.items.reduce(
              (s, i) =>
                s +
                Number(i.stock?.find((x) => x.location_id === l.id)?.qty ?? 0) *
                  Number(i.avg_cost ?? 0),
              0,
            ),
          ),
        })),
      },
      sales: {
        ...data.dashboard.summary.sales,
        today: sum(active.filter((b) => b.bill_date === todayIST())),
        bill_count: active.length + 32,
      },
      receivables: f2(
        db.parties.filter((p) => Number(p.balance) > 0).reduce((s, p) => s + Number(p.balance), 0),
      ),
      payables: f2(
        -db.parties.filter((p) => Number(p.balance) < 0).reduce((s, p) => s + Number(p.balance), 0),
      ),
    })
  }),
  http.get(`${API}/dashboard/pending`, () =>
    json({
      einvoice_failed: db.bills.filter((b) => b.einvoice.status === 'failed').length,
      einvoice_pending: db.bills.filter((b) => b.einvoice.status === 'pending').length,
      returns_pending: db.returns.filter((r) => r.status === 'pending').length,
      blocked_bills_today: db.notifications.filter((n) => n.kind === 'stock_short' && !n.is_read)
        .length,
      tally_unexported: 6,
      cheques_due: db.payments.filter((p) => p.cheque_status === 'pending').length,
    }),
  ),
  http.get(`${API}/dashboard/sales-trend`, ({ request }) => {
    const url = new URL(request.url)
    if (url.searchParams.get('bucket') === 'month')
      return json(
        ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map(
          (m, i) => ({
            bucket: `${m}-01`,
            sales: f2(420000 + ((i * 91813) % 230000)),
            profit: f2(48000 + ((i * 7919) % 21000)),
            bills: 30 + i * 3,
          }),
        ),
      )
    return json(data.dashboard.trend)
  }),
  http.get(`${API}/dashboard/categories`, () =>
    json(
      db.categories
        .filter((c) => c.is_active)
        .map((c, i) => ({
          category_id: c.id,
          name: c.name,
          sales: f2(260300 / (i + 1)),
          profit: f2(28400 / (i + 1)),
          stock_value: f2(
            db.items
              .filter((it) => it.category_id === c.id)
              .reduce((s, it) => s + Number(it.stock_value ?? 0), 0),
          ),
        })),
    ),
  ),
  http.get(`${API}/dashboard/top-items`, ({ request }) => {
    const slow = new URL(request.url).searchParams.get('kind') === 'slow'
    const rows = db.items.map((i, n) => ({
      item_id: i.id,
      name: i.name,
      qty_sold: f3(slow ? n * 3 + 1 : 3800 / (n + 1)),
      unit: i.base_unit.symbol,
      sales: f2(slow ? (n + 1) * 900 : 260300 / (n + 1)),
    }))
    return json(slow ? rows.reverse().slice(0, 5) : rows.slice(0, 5))
  }),
  http.get(`${API}/dashboard/low-stock`, () =>
    json(db.items.filter((i) => i.stock_status !== 'ok' && i.is_active !== false)),
  ),
  http.get(`${API}/reports/:key`, ({ params, request }) => {
    const url = new URL(request.url)
    const format = url.searchParams.get('format')
    if (format === 'xlsx') return json(signed(`${String(params.key)}.xlsx`))
    if (format === 'pdf') return json(job('report_export', `${String(params.key)}.pdf`), 202)
    const bills = db.bills.filter((b) => b.status === 'active' && !b.source_bill)
    const rows = bills.map((b) => ({
      bill_no: b.bill_no,
      bill_date: b.bill_date,
      customer: b.customer.name,
      taxable: b.totals.taxable_total,
      tax: f2(Number(b.totals.cgst ?? 0) + Number(b.totals.sgst ?? 0) + Number(b.totals.igst ?? 0)),
      total: b.totals.grand_total,
    }))
    return json({
      columns: [
        { key: 'bill_no', label: 'Bill no.', type: 'text' },
        { key: 'bill_date', label: 'Date', type: 'date' },
        { key: 'customer', label: 'Customer', type: 'text' },
        { key: 'taxable', label: 'Taxable ₹', type: 'money' },
        { key: 'tax', label: 'GST ₹', type: 'money' },
        { key: 'total', label: 'Total ₹', type: 'money' },
      ],
      rows,
      totals: {
        taxable: f2(rows.reduce((s, r) => s + Number(r.taxable), 0)),
        tax: f2(rows.reduce((s, r) => s + Number(r.tax), 0)),
        total: f2(rows.reduce((s, r) => s + Number(r.total), 0)),
      },
      meta: { page: 1, page_size: 100, total: rows.length },
    })
  }),
  http.post(`${API}/tally/exports`, async ({ request }) => {
    const body = (await request.json()) as S['TallyExportInput']
    db.syncs.unshift({
      id: db.syncs.length + 1,
      direction: 'export',
      scope: body.scope.join(', '),
      period_from: body.from,
      period_to: body.to,
      record_count: 42,
      status: 'succeeded',
      created_by_name: db.me.full_name,
      created_at: nowIso(),
    })
    return json(job('tally_export', 'tally-export.xml'), 202)
  }),
  http.post(`${API}/tally/imports`, () =>
    json(
      {
        import_id: 1,
        source: 'tally_xml',
        cutover_date: todayIST(),
        counts: {
          groups: { new: 6, existing: 3, errors: 0 },
          items: { new: 120, existing: 4, errors: 1 },
          customers: { new: 35, existing: 2, errors: 0 },
        },
        issues: [
          {
            entity: 'item',
            name: 'TMT 10mm Qtl',
            problem: 'Unit "Qtl" is not set up',
            suggestion: 'Add the unit in Units, then upload again',
          },
        ],
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      },
      201,
    ),
  ),
  http.post(`${API}/tally/imports/:id/commit`, () => json(job('tally_import'), 202)),
  http.get(`${API}/tally/syncs`, ({ request }) => json(paged(db.syncs, new URL(request.url)))),
]

function session(user: { id: string; email: string }) {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  const exp = Math.floor(Date.now() / 1000) + 3600
  return {
    access_token: `${b64({ alg: 'none' })}.${b64({ sub: user.id, email: user.email, exp })}.demo`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'demo-refresh',
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-04-01T00:00:00Z',
    },
  }
}
