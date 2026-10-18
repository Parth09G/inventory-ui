# UI plan: Billing & Inventory web app

The end-to-end UI architecture: pages, shared components, theme, page business logic and build order. Read it alongside [design.md](design.md) (how the UI looks and behaves) and [decisions.md](decisions.md) (why).

## Context

The Go API (`backend-api/`, 102 operations in `openapi.yaml`) is built. The web repo (`frontend-web/`) is set up with the stack, `design.md` (UX principles) and `decisions.md` (D-01…D-27). There are no screens yet. This plan defines:

- every page,
- the shared components,
- the theme (fonts, colours, tokens),
- each page's business logic, mapped to real endpoints and permission keys,
- the overall architecture and build order.

---

## 1. Architecture overview

```
Browser
 ├─ supabase-js ── sign-in, password reset/set, refresh, sign-out only (D-11)
 └─ React SPA
     ├─ TanStack Router (file routes, zod-validated search params, beforeLoad guards)
     │    context: { queryClient, auth }
     ├─ TanStack Query (all server state; queryOptions factories per feature)
     ├─ lib/api/client.ts  openapi-fetch + middleware ──► Go API /api/v1
     │    • Authorization: Bearer <supabase access token>
     │    • Idempotency-Key (document POSTs), If-Match (bill edit/cancel)
     │    • problem+json → ApiProblem{status, code, errors[], request_id}
     │    • 401 → sign out + redirect /login
     └─ Feature modules (src/features/*) → shared components → re-skinned shadcn primitives
```

### 1.1 Route tree (TanStack file routes in `src/routes/`)

- `__root.tsx`: providers, Toaster, OfflineBanner, UpdatePrompt.
- `_public/`: login, forgot-password, set-password. Redirects to `/` if already signed in.
- `_app.tsx` (layout, protected):
  - `beforeLoad` requires a session, then `ensureQueryData(meQuery)`.
  - Renders the AppShell.
  - Child routes declare `staticData: { perm: 'settings.manage' }`. A guard redirects to the 403 screen if the user lacks it. This only shapes the UI; the server enforces permissions (D-10).
- Routes stay thin. Their loaders call `queryClient.ensureQueryData(feature.queries.x(params))` and render a component from `features/<x>/`.

### 1.2 Data layer conventions

- Each feature has `features/<x>/api.ts` with query-key factories, `queryOptions()` and mutation hooks. Types come only from `src/lib/api/schema.d.ts` (D-06).
- **Invalidation matrix** (in `lib/api/invalidate.ts`):

| After this save                      | Invalidate                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Bill save / edit / cancel / finalize | bills, bill(id), items (stock), party(id) and ledger, dashboard, notifications |
| Payment                              | payments, bills, purchases, party ledger, dashboard                            |
| Return approve                       | returns, bill, items, party, dashboard                                         |
| Purchase / purchase return           | purchases, items, party, dashboard                                             |
| Transfer / adjustment / count        | items, transfers or adjustments, dashboard                                     |

- **Polling:**
  - Jobs: `useJob(id)` polls every 2 s.
  - Bill whose e-invoice is pending: every 3 s, for at most 2 min.
  - Notification count: every 60 s and on window focus.
- **Reference data** (`/locations`, `/units`, `/categories`, `/lookups/states`, `/settings`): `staleTime` 10 min, preloaded in `_app` beforeLoad after `/me`.

---

## 2. Theme (final tokens, set in `src/styles/index.css` with `@theme`)

**Fonts:** IBM Plex Sans Variable for the UI, IBM Plex Mono for codes. Both are already installed through fontsource. Numbers always use `tabular-nums`.

| Type token    | Size / line height / weight                 |
| ------------- | ------------------------------------------- |
| `text-xs`     | 12/16 (meta, badges)                        |
| `text-sm`     | 13/18 (table cells, dense)                  |
| `text-base`   | 14/20 desktop, 15/22 phone                  |
| `text-lg`     | 16/24 (section titles)                      |
| `text-xl`     | 20/28 weight 600 (page titles; 18 on phone) |
| `text-figure` | 24/32 weight 600, tabular (grand totals)    |

| Colour token                                      | Light                                       | Use                                                                     |
| ------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `--paper`                                         | #F7F7F4                                     | App background                                                          |
| `--surface`                                       | #FFFFFF                                     | Tables, forms                                                           |
| `--surface-sunken`                                | #EFEFEA                                     | Table header, read-only fields                                          |
| `--ink`                                           | #1C1F23                                     | Text, primary button                                                    |
| `--ink-muted`                                     | #5B6169                                     | Secondary text                                                          |
| `--ink-faint`                                     | #8A9098                                     | Placeholders, disabled                                                  |
| `--rule`                                          | #DEDDD6                                     | Hairlines, borders                                                      |
| `--rule-strong`                                   | #C4C3BB                                     | Input borders, focus base                                               |
| `--steel`                                         | #2F5D8A                                     | Focus ring, links, selection                                            |
| `--steel-tint`                                    | #2F5D8A at 10%                              | Selected row                                                            |
| `--cash`                                          | #1C1F23                                     | Cash bill band                                                          |
| `--account`                                       | #0F6E6E                                     | Account bill band                                                       |
| `--success` / `--warning` / `--danger` / `--info` | #2E7D4F / #B26B00 / #B42318 / #2F5D8A       | Status (each with a `-tint` at 10%)                                     |
| `--chart-1…5`                                     | #2F5D8A, #0F6E6E, #B26B00, #6B5B95, #5B6169 | Charts (checked with the dataviz validator when the dashboard is built) |

- **Spacing:** 4 px scale. **Radius:** `--radius-sm` 4 px (controls), `--radius-md` 6 px (popovers, dialogs). **Shadow:** a single `--shadow-pop`, used only on floating layers.
- **Sizes:** control height 32 px desktop and 44 px on phones (`(pointer: coarse)` or width < 640). Table rows 32 px, or 40 px in comfortable mode.
- **Density:** a `data-density="compact|comfortable"` attribute on `<html>`, stored per user in localStorage.
- **Dark mode:** none in v1 (D-16). Tokens are named by role, so dark mode can be added later.
- **Breakpoints:** phone < 640, tablet 640–1023, desktop ≥ 1024. Below 1024 the app uses the phone shell and phone document-entry layouts (D-27).

---

## 3. Shared components (`src/components/`)

### 3.1 Primitives: `components/ui/` (shadcn, re-skinned, D-13)

Button, Input, Textarea, Label, Select, Checkbox, RadioGroup, Switch, Tabs, Dialog, AlertDialog, Sheet (side and bottom), Popover, DropdownMenu, Tooltip, Command (cmdk), Calendar, Badge, Skeleton, Separator, ScrollArea, Toaster (sonner).

### 3.2 App shell: `components/shell/`

| Component                                        | Notes                                                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| AppShell                                         | Sidebar + TopBar on desktop; TopBar + BottomNav on phone                                                                           |
| Sidebar                                          | Groups: Sell / Stock / Parties / Reports / Admin. Items are filtered by permission. Collapses to icons.                            |
| TopBar                                           | Search trigger, New bill split-button (Cash/Account), NotificationBell, UserMenu                                                   |
| BottomNav                                        | Home, Bills, **New bill**, Stock, More (sheet with the rest)                                                                       |
| CommandPalette                                   | Ctrl+K. `GET /search` (debounced 200 ms) shows items, parties and bills, plus a static list of commands                            |
| NotificationBell                                 | Unread count badge. Popover shows the latest 10 from `/notifications?unread_only` with "Mark all read" and a link to the full page |
| OfflineBanner, UpdatePrompt, ShortcutsHelp (`?`) | design P9, D-12, design §7                                                                                                         |

### 3.3 Data display: `components/shared/`

| Component               | Responsibility                                                                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PageHeader              | Title, breadcrumb, actions slot, optional "Updated n min ago"                                                                                                                                                          |
| DataTable               | TanStack Table v9 headless. Server paging and sorting through URL search params. Sticky header, sticky first column, totals row slot, column picker (localStorage), row link. Below 1024 px it renders MobileCardList. |
| FilterBar               | Declarative filters (text, select, date range, party, location, category, status) bound to zod search params                                                                                                           |
| MobileCardList          | Card per row, showing 3–4 fields set by the table's column metadata                                                                                                                                                    |
| Money / Qty / Rate      | Format decimal strings with en-IN grouping. Never parse them to numbers for arithmetic (D-07)                                                                                                                          |
| Balance                 | Shows `Dr` / `Cr` suffix with semantic colour                                                                                                                                                                          |
| DateText                | DD-MM-YYYY, plus IST time when it is a timestamp                                                                                                                                                                       |
| Code                    | Mono text for document numbers, GSTIN, IRN, HSN, UTR, with copy on hover                                                                                                                                               |
| StatusBadge             | One component with variants: bill status, payment status, e-invoice, cheque, return, stock (ok/low/out), job                                                                                                           |
| StockByLocation         | Compact "Shop 12 · G1 40 · G2 0" chips, with short or zero quantities highlighted                                                                                                                                      |
| KeyValueGrid            | Document metadata blocks                                                                                                                                                                                               |
| EmptyState / ErrorState | ErrorState shows the `request_id` with a copy button                                                                                                                                                                   |
| JobProgress             | Polls `useJob`, shows a progress bar, and offers the result download                                                                                                                                                   |
| DownloadButton          | Calls an endpoint that returns a SignedUrl and opens it immediately                                                                                                                                                    |
| DocumentHeader          | Doc number, type band (cash/account), status badges, toolbar driven by `allowed_actions`                                                                                                                               |
| RevisionDiff            | Side-by-side diff of bill revisions (lines, totals)                                                                                                                                                                    |

### 3.4 Inputs: `components/shared/inputs/`

| Component                                                                                                                                                                  | Notes                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MoneyInput / QtyInput / PercentInput                                                                                                                                       | String value, regex-validated, `inputmode="decimal"`, right-aligned, tabular                                                                                  |
| DateInput                                                                                                                                                                  | Typed DD-MM-YYYY with a calendar popover. Value is `YYYY-MM-DD`, never converted through `Date` (D-20)                                                        |
| ItemPicker                                                                                                                                                                 | Combobox on `GET /items?q=&attr[...]`. Each row shows name, attributes, stock by location and status. Inactive items are excluded. Keyboard-first.            |
| PartyPicker                                                                                                                                                                | Combobox on `/parties?kind=`. Shows balance and GSTIN. "Quick add" opens a sheet with a short party form. Walk-in option where allowed.                       |
| LocationSelect, UnitSelect (that item's units), GstRateSelect (0/0.25/3/5/12/18/28/40), StateSelect (`/lookups/states`), GstinInput (format check, derives the state code) |                                                                                                                                                               |
| PaymentSplitEditor                                                                                                                                                         | Rows of mode, amount and reference. Cheque fields appear only for cheque mode. A `modes` prop restricts the modes (Account bills: bank modes only, FR-AB-06). |
| ReasonDialog                                                                                                                                                               | Confirm dialog that states the effect, takes a required reason (`ReasonInput`), and has a button named after the action (design P10)                          |

### 3.5 Line-entry engine: `components/shared/line-grid/`

One keyboard grid is used for bills, purchases, purchase returns, transfers, adjustments, returns and counts:

- It takes a column config. It uses RHF `useFieldArray`.
- Enter moves to the next cell and adds a row after the last cell. F4 opens the cell's picker. Alt+L adds a line and Alt+D removes the current line.
- It follows the ARIA grid pattern and shows server-sent per-line error and shortage markers.
- Its phone twin is **LineCards + LineSheet**: card list, bottom-sheet editor, and a pinned footer with the total and Save.

### 3.6 Infrastructure (`lib/`, `hooks/`)

| Module                                                                                                                                         | Purpose                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/api/client.ts`                                                                                                                            | openapi-fetch client and middleware (token, request id, problem parsing)                                                                                  |
| `lib/api/problem.ts`                                                                                                                           | `ApiProblem` and `isProblem(code)`. `applyFieldErrors(setError, errors)` maps `lines[1].rate` to the RHF path `lines.1.rate` and focuses the first field. |
| `lib/auth/`                                                                                                                                    | supabase client, `AuthProvider` (session, onAuthStateChange → clears the query cache on sign-out), `useSession`                                           |
| `lib/permissions.ts`                                                                                                                           | `useCan(perm)`, `<Can perm>`, `hasAction(bill, 'cancel')`                                                                                                 |
| `lib/format.ts`                                                                                                                                | money, qty, rate, percent, date, datetime, Dr/Cr, plus input-format regexes                                                                               |
| `hooks/useIdempotencyKey`                                                                                                                      | Key made when the form mounts, `renew()` after success (D-08)                                                                                             |
| `hooks/useShortcut`                                                                                                                            | Scoped keydown hook. Global scope plus a document scope. Ignores reserved browser keys (D-28).                                                            |
| `hooks/useDebouncedValue`, `useOnlineStatus`, `useIsPhone`, `useLocalDraft` (autosave form state per tab, D-17), `useJob`, `useSignedDownload` |                                                                                                                                                           |

---

## 4. Pages: 43 screens (Auth 3 · Home 2 · Sell 10 · Parties 3 · Stock 14 · Catalogue 3 · Reports 2 · Admin 4 · System 2)

The Role column shows who sees each page. ALL means Super Admin and Admin; SA means Super Admin only. Action-level permission keys are listed in the logic.

### 4.1 Auth (public): 3

| #   | Route              | Page                               | Business logic                                                                                                                                                                      |
| --- | ------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/login`           | Sign in                            | `supabase.auth.signInWithPassword`, then `/me`. A 401 from `/me` (inactive or unknown user) signs the user out with "Your access was removed". There is no sign-up link (FR-AU-01). |
| 2   | `/forgot-password` | Forgot password                    | `resetPasswordForEmail` with redirect to `/set-password`. Always shows the same message, so it does not reveal whether an account exists.                                           |
| 3   | `/set-password`    | Set password (invite and recovery) | Handles Supabase invite and recovery links, then `updateUser({password})`. Validates the policy (≥10 characters, mixed case, digits), then goes to `/`.                             |

### 4.2 Home: 2

| #   | Route            | Page                | Business logic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | `/`              | Dashboard (ALL)     | `summary`, `sales-trend`, `categories`, `top-items`, `low-stock`, `pending`, with a period switcher (today / month / FY / custom).<br>**Order:** the Pending work strip comes first (e-invoice failed or pending, returns pending, blocked bills today, Tally unexported, cheques due). Each counter links to a filtered list.<br>**Headline row:** sales (today / period / FY, Cash vs Account), gross profit and margin, receivables, payables, cheques pending.<br>**Panels:** stock value by location, low and out of stock list (actions: New purchase prefilled, Transfer prefilled), sales trend chart, top and slow items, collections by mode.<br>**Also:** an "Account bills not linked to a Cash bill" count, linking to `/bills?unlinked_account_bills=true` (R-1). |
| 5   | `/notifications` | Notifications (ALL) | Full list with an unread filter, mark read and mark all. Clicking an item routes by `ref_type` and `ref_id`: `stock_short` → item, `return_pending` → return, `einv_failed` → bill. An Admin sees shortage alerts as view-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### 4.3 Sell: 10

| #                                                                | Route                                   | Page                              | Business logic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6                                                                | `/bills`                                | Bill register                     | Filters (FR-BL-11): number/q, date range, party, type, status, payment status, e-invoice status, location, unlinked Account bills. Tabs: All / Drafts / Cancelled. Totals row. Export comes from the sales-register report.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 7                                                                | `/bills/new?type=cash\|account&from=`   | **Bill editor: create**           | See §5.1 (the core flow). `bill.create`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8                                                                | `/bills/$id/edit`                       | Bill editor: edit                 | The same component as page 7.<br>**Draft:** `PUT` with no reason needed, `Delete draft`, `Finalize` (`POST /finalize` with an Idempotency-Key).<br>**Active bill:** only when `allowed_actions` includes `edit` (Super Admin, O-02). Needs a reason and `If-Match`. Shows a warning banner: "Reverses and re-applies stock and ledger; IRN will be cancelled and regenerated" when an IRN exists.<br>**Errors:** 412 → reload flow. 409 `EINVOICE_WINDOW_CLOSED` → "Create credit note" CTA. 409 `EDIT_NOT_ALLOWED` → explanation.                                                                                                                                                                                                                                                                                                                                      |
| 9                                                                | `/bills/$id`                            | Bill view                         | Header: number, type band, status, version, source or Account-copy link, customer with balance. Tabs: **Bill** (lines, charges, tax split, totals, amount in words), **Payments** (allocations, Record payment), **E-invoice** (status, IRN, ack, QR, cancel deadline countdown, EWB, last error, Retry), **History** (revisions plus RevisionDiff, FR-ED-06), **Returns**.<br>The toolbar comes from `allowed_actions`: Edit, Cancel (ReasonDialog with If-Match), Copy to Account (`POST /copy-to-account` with an Idempotency-Key, then open the new bill), Record payment, Create return, Generate or retry e-invoice, Cancel e-invoice, E-way bill, Print (`/pdf` SignedUrl; disabled with "Print after IRN" while pending, FR-EI-02), Share (`/share`, opens the WhatsApp URL).<br>Polls while the e-invoice is pending. A cancelled bill shows a CANCELLED band. |
| 10                                                               | `/returns`                              | Returns register                  | Filter by status (pending, approved, rejected, cancelled). For Super Admins the pending tab comes first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 11                                                               | `/returns/new?bill=$id`                 | Create return (`return.create`)   | Loads the bill. For each line, the user enters a quantity up to sold minus already returned, and a return location (Cash bills only). Also a restock/damaged flag, a reason, and the settlement (refund with PaymentSplitEditor, or adjust ledger). Sent with an Idempotency-Key. An Admin sees "Will be pending until approved"; for a Super Admin it is auto-approved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 12                                                               | `/returns/$id`                          | Return / credit note view         | Lines, settlement, status. Super Admin (`return.approve`): Approve (shows the effects: credit note numbered, stock restored at the location unless damaged, ledger credited or refund recorded) or Reject (with reason). Credit note PDF. E-invoice status when the original bill was e-invoiced (FR-RT-03).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 13                                                               | `/payments`                             | Payments register                 | Tabs: Received / Paid. Filters: mode, cheque status, party, dates. Totals by mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 14                                                               | `/payments/new?direction=&party=&bill=` | Record payment (`payment.create`) | Party picker, then the open documents for that party (`/bills?party_id&payment_status=unpaid,partial`, or `/purchases` for dealers). Allocation table with an "Auto-allocate oldest first" toggle (`auto_allocate`) or manual amounts. The unallocated remainder is "on account". Sent with an Idempotency-Key. Also opens as a Sheet from the bill and party pages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 15                                                               | `/payments/$id`                         | Payment view                      | Allocations. Cheque status actions: Cleared / Bounced (`payment.cheque_status`; Bounced shows "Re-opens ₹X on the ledger"). Cancel (SA, reason). Receipt PDF.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Drafts are a tab of the bill register (#6), not a separate page. |

### 4.4 Parties: 3

| #   | Route                               | Page         | Business logic                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | `/parties`                          | Party list   | Tabs: Customers / Dealers / All. Filter by balance (receivable or payable). Columns: name, mobile, GSTIN, balance (Dr/Cr), credit limit used %.                                                                                                                                                                                              |
| 17  | `/parties/new`, `/parties/$id/edit` | Party form   | `PartyInput`: kind, name, mobile, GSTIN (derives the state), billing address, pincode, sites (repeatable), credit limit, opening balance and date. `DUPLICATE` → field error. Deactivate (SA, `party.deactivate`).                                                                                                                           |
| 18  | `/parties/$id`                      | Party detail | Header: balance, credit limit meter, open documents count. Tabs: **Ledger** (`/ledger` with date range, running balance, Dr/Cr, document links), **Bills** / **Purchases**, **Payments**, **Sites**. Actions: Record payment, Statement PDF (date range), Share reminder (wa.me link built from the statement URL), New bill for this party. |

### 4.5 Stock: 14

| #   | Route                           | Page                               | Business logic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | `/inventory`                    | Inventory grid (FR-DB-08)          | `/items` with q, category, dynamic attribute filters (from the category's attributes, giving `attr[brand]=`), location, stock status, include inactive. Columns: item, category, attributes, stock per location, total, unit, status, value (avg cost × qty from the server). Row actions: View, New purchase, Transfer.                                                                                                                                                                                                                                   |
| 20  | `/items/new`, `/items/$id/edit` | Item form (`item.manage`)          | Choose the category first. The form then renders that category's attributes (text, number or select; required; unit suffix). The name is built automatically from the attributes marked `part_of_name` and can be edited.<br>HSN and GST default from the category. Base unit, plus alternate units with a factor; factors are **locked** once the item has transactions (FR-IN-07), so the UI disables them and offers "Add unit". Reorder level, SKU. Opening stock per location (create only).<br>`DUPLICATE` → "Same attributes as ‹item›" (FR-IN-04). |
| 21  | `/items/$id`                    | Item detail                        | Stock by location, avg cost, reorder level, units. **Stock ledger** tab (`/movements`: date, document, location, in, out, running balance, user; FR-PU-07; filter by location and dates). Deactivate (SA).                                                                                                                                                                                                                                                                                                                                                 |
| 22  | `/items/import`                 | Bulk item import                   | Choose a category → download the template (`/categories/$id/import-template`) → upload (`POST /items/import`) → JobProgress → result summary (created, skipped, errors file).                                                                                                                                                                                                                                                                                                                                                                              |
| 23  | `/purchases`                    | Purchase register                  | Filters: dealer, dates, location, status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 24  | `/purchases/new`                | Purchase entry (`purchase.create`) | Header: dealer (PartyPicker kind=supplier), dealer invoice number and date, received date, default location, interstate flag, freight, other charges. Lines (LineGrid): item, unit, qty, rate, GST, location (can differ per line).<br>Optional payment. Totals come from the save response (no calculate endpoint, D-09). Sent with an Idempotency-Key.<br>`DUPLICATE` → "Invoice ‹no› from ‹dealer› already entered" with a link to it. After save, shows the new average cost per item.                                                                 |
| 25  | `/purchases/$id`                | Purchase view                      | Lines, landed cost, payments. Actions: Record payment (paid), Return to dealer, Cancel (SA; on 409, explain that stock was already sold and suggest a purchase return).                                                                                                                                                                                                                                                                                                                                                                                    |
| 26  | `/purchases/$id/return`         | Purchase return                    | Choose lines and quantities up to the received quantity minus earlier returns, and a reason. `POST /purchase-returns`. 422 shortage → ShortagePanel.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 27  | `/transfers`                    | Transfer register                  | Filters: from and to location, dates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 28  | `/transfers/new`                | New transfer (`stock.transfer`)    | From and to locations (must differ), date, vehicle, lines showing "available at source". Sent with an Idempotency-Key. 422 → ShortagePanel. Also opens prefilled from the dashboard low-stock list and from a bill's shortage panel.                                                                                                                                                                                                                                                                                                                       |
| 29  | `/transfers/$id`                | Transfer note                      | Printable note: from, to, lines, vehicle, user (FR-PU-04).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 30  | `/adjustments`                  | Adjustments register               | Reason filter. Rows expand to show lines (there is no GET by id in the API).                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 31  | `/adjustments/new`              | New adjustment (`stock.adjust`)    | Location, reason (damage, breakage, wastage, count correction, sample, other; notes required for "other"), lines with a signed `qty_change`. A negative change past the available stock → 422 shortage.                                                                                                                                                                                                                                                                                                                                                    |
| 32  | `/stock-counts/new`             | Physical count (`stock.count`)     | Choose a location → count sheet (virtualised item list, filter by category, quantity per item; draft autosaved locally) → **Preview** (`POST /stock-counts/preview`: system qty, counted, difference, value difference) → **Post** (`POST /stock-counts` creates count-correction adjustments).                                                                                                                                                                                                                                                            |

### 4.6 Catalogue: 3

| #   | Route                               | Page                     | Business logic                                                                                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 33  | `/catalogue/categories`             | Categories               | List with item count, units and attribute summary. Deactivate (SA; only when there are no active items).                                                                                                                                                                                                                                         |
| 34  | `/catalogue/categories/new`, `/$id` | Category wizard / editor | Steps (FR-IN-01): (1) name, parent, default HSN and GST, Tally group; (2) allowed units (pick existing or create inline with `POST /units`); (3) attributes (code, label, type, options, unit, required, part of name, order; drag to reorder). Edit mode adds, edits or deletes attributes (delete is SA and fails if items use the attribute). |
| 35  | `/catalogue/units`                  | Units                    | Inline table: create and rename (name, symbol, UQC, decimals).                                                                                                                                                                                                                                                                                   |

### 4.7 Reports: 2

| #   | Route           | Page                    | Business logic                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 36  | `/reports`      | Report catalogue        | Grouped cards (links, not KPI cards): Sales (sales register, bill type register, item sales, category sales, profit, edits and cancellations), GST (B2B, B2C, HSN summary, credit notes, e-invoice status, input GST), Purchases (purchase register, payments made), Stock (stock summary, stock movement, transfers, adjustments), Ledger (receivables ageing, payables ageing, collections). |
| 37  | `/reports/$key` | Report viewer (generic) | Filters from the URL (from, to, location, category, party as relevant). `GET /reports/{key}?format=json` returns column metadata (`text`, `money`, `qty`, `date`, `percent`), which the viewer maps to cell components, plus rows and totals. Export as Excel or PDF with `format=xlsx                                                                                                         | pdf` (SignedUrl, or a Job with JobProgress for large reports). One component serves all 21 reports. |

### 4.8 Admin (SA): 4

| #   | Route                | Page                                                       | Business logic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | -------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 38  | `/settings/$section` | Settings (`settings.manage`; other users see it read-only) | Sections as sub-routes:<br>**Shop profile:** name, address, state, GSTIN, phone, email, logo upload (PNG/JPG ≤ 1 MB).<br>**Invoice & GST:** prices include GST, default charge GST, number prefixes, terms.<br>**Bank & UPI.**<br>**Notifications:** email, WhatsApp number.<br>**E-invoice:** enable flag; credentials form that is write-only (shows "Saved" but never echoes values); environment sandbox or production; "Test connection".<br>**Tally mapping:** ledger names.<br>**Locations:** list, add, rename (SA). |
| 39  | `/users`             | Users (`user.manage`)                                      | List with role and active state. Invite (name, email, role) → invite email. Edit role. Deactivate (blocked for the last Super Admin; shows the server error). Reactivate. Send password reset.                                                                                                                                                                                                                                                                                                                               |
| 40  | `/tally`             | Tally (export for ALL, import for SA)                      | Tabs:<br>**Export:** from and to dates, scope checkboxes (masters, sales, credit notes, receipts, purchases, payments), "include already exported" → Job → XML download (FR-TI-02/03).<br>**Import (SA):** upload XML or Excel and choose the cut-over date → preview (counts per entity of new, existing and errors, and an issues table with suggestions; the preview expires) → Commit (all-or-nothing).<br>**History:** `/tally/syncs` with downloads.                                                                   |
| 41  | `/audit-log`         | Audit log (`audit.view`)                                   | Filters: user, entity, entity id, action, dates. Rows expand to show a before/after JSON diff.                                                                                                                                                                                                                                                                                                                                                                                                                               |

### 4.9 System screens: 2 (+ an error boundary)

| #   | Screen                                                                      |
| --- | --------------------------------------------------------------------------- |
| 42  | 404 Not found                                                               |
| 43  | 403 No access ("Ask the owner"; shows the required permission)              |
| —   | Route error boundary (ErrorState with `request_id`), not counted separately |

**Total: 43 screens.** The bill editor (7/8), party form, item form and category wizard are each one component used for both create and edit.

---

## 5. Core flows in detail

### 5.1 Bill editor (pages 7 and 8)

1. **Init.**
   - Make the Idempotency-Key.
   - `type` comes from the route.
   - `from=$id` (copy-to-account prefill is server-side; the editor is for new bills only).
   - Restore any local draft (`useLocalDraft`).
2. **Header.**
   - PartyPicker (customers). Choosing a party fills GSTIN, address, sites and place of supply (the party's state), and shows balance and credit limit.
   - Walk-in is allowed only for Cash bills (BR-09). It needs a name.
   - Account bills need a named party (FR-AB-03).
   - Date defaults to today (IST). Vehicle number.
3. **Lines** (LineGrid):
   - Item (ItemPicker) → unit (item units; defaults to the last unit used) → location (Cash only; defaults to Shop) → qty → rate → discount % or amount.
   - On item and unit change, fetch `/items/$id/price-hints?party_id&unit_id` and show the last rate to this customer, the last purchase rate and the average cost under the rate cell (FR-BL-02). There is no default rate (BR-05).
   - The row shows StockByLocation for the item (FR-BL-03). On Account bills it is labelled "for information" (FR-AB-02).
4. **Charges:** labour, transport, other (description, amount, GST, SAC). Bill discount.
5. **Live calculation:**
   - When the form changes, take a debounced (300 ms) snapshot → `POST /bills/calculate`, aborting stale requests (D-09).
   - The TotalsPanel shows the server's line totals, tax by rate (CGST+SGST or IGST, decided by the server), round off, grand total and amount in words.
   - Per-line stock warnings from the response mark lines as short before save.
6. **Payments:**
   - PaymentSplitEditor. Account bills: UPI, cheque and bank transfer only (FR-AB-06).
   - Balance due = the server's grand total minus payments, shown from the calculate response.
   - Walk-in with a balance due > 0 → Save is disabled, with "Walk-in customers must pay in full".
7. **Effects summary** (design P5): stock out per location (Cash), ledger debit and the party's new balance, credit limit used %.
8. **Save:** "Save Cash bill" or "Save Account bill" (Ctrl+Enter, `status: active`), or Save draft (Ctrl+S, `status: draft`, no number). The body includes `expected_total`.
9. **Responses:**
   - 201 → clear the local draft, renew the key, go to `/bills/$id`, and focus the Print, Share and New bill actions.
   - 422 `INSUFFICIENT_STOCK` → **ShortagePanel**: per short line, required vs available and stock elsewhere. Actions: "Take from ‹Godown›" (changes the line's location and re-runs the calculation) and "Create transfer" (opens a Sheet with the transfer form prefilled, then retries). The server has already alerted the Super Admin; show "Owner notified".
   - 422 `CREDIT_LIMIT_EXCEEDED` → for a Super Admin (`credit_limit.override`), a ReasonDialog that resends with `override_credit_limit`; for an Admin, an explanation.
   - 400 → map field errors to cells.
   - 400 total mismatch → recalculate and ask the user to review.
   - 409 replay mismatch → reset the key and ask the user to retry.
10. **Phone:** the same form state rendered as LineCards and LineSheet, with a pinned footer (grand total and Save).

### 5.2 Permissions mapping

`useCan(key)` uses the keys from `/me`: `bill.create`, `bill.edit`, `bill.cancel`, `bill.finalize`, `bill.copy_to_account`, `bill.print`, `bill.share`, `einvoice.generate`, `einvoice.cancel`, `einvoice.credentials`, `credit_limit.override`, `return.create`, `return.approve`, `payment.create`, `payment.cancel`, `payment.cheque_status`, `purchase.create`, `purchase.cancel`, `purchase_return.create`, `stock.transfer`, `stock.adjust`, `stock.count`, `catalogue.manage`, `item.manage`, `item.deactivate`, `category.deactivate`, `attribute.delete`, `party.manage`, `party.deactivate`, `location.manage`, `reports.view`, `reports.export`, `dashboard.view`, `tally.export`, `tally.import`, `settings.manage`, `user.manage`, `audit.view`.

Bill actions use `allowed_actions` only.

---

## 6. Folder layout (adds to D-23)

```
src/features/billing/
  api.ts                 queries, mutations, keys
  schemas.ts             zod form schemas (format only)
  BillRegister.tsx  BillEditor/  (Header, Lines, Charges, TotalsPanel, PaymentsPanel,
  EffectsSummary, ShortagePanel, PriceHints, MobileBillEditor)  BillView/ (tabs)
src/routes/_app/bills/index.tsx  new.tsx  $id.index.tsx  $id.edit.tsx
```

Every feature follows the same pattern: `api.ts`, `schemas.ts`, page components, and a `components/` folder for pieces used only by that feature.

---

## 7. New decisions to record

- **D-28:** Keyboard shortcuts use our own `useShortcut` hook (about 60 lines, scoped), not a library.
- **D-29:** One generic Report viewer is driven by the report's column metadata. There are no per-report screens.
- **D-30:** One LineGrid engine (with its LineCards phone twin) serves all seven line-based documents.
- **D-31:** The phone shell and phone entry layouts apply below 1024 px, so tablets get the touch layout.

## 8. Build order (milestones)

| M   | Scope                                                                                                                  | Pages        |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------ |
| M0  | Tokens and theme, primitives re-skin, shell, auth pages, API client and problem handling, permissions, format, 403/404 | 1–3, 42, 43  |
| M1  | Reference data and catalogue: locations (in settings), units, categories wizard, items, inventory grid                 | 19–22, 33–35 |
| M2  | Parties and ledger                                                                                                     | 16–18        |
| M3  | **Billing core:** editor (desktop and phone), view, register, e-invoice states, print and share                        | 6–9          |
| M4  | Payments and returns                                                                                                   | 10–15        |
| M5  | Purchases, purchase returns, transfers, adjustments, counts                                                            | 23–32        |
| M6  | Dashboard, notifications, report catalogue and viewer                                                                  | 4, 5, 36, 37 |
| M7  | Settings, users, Tally, audit log                                                                                      | 38–41        |
| M8  | PWA polish, accessibility pass, end-to-end suite, keystroke audit                                                      | —            |

## 9. Verification

- Each milestone: `npm run typecheck && npm run lint && npm test && npm run build`.
- Component tests (Vitest and RTL):
  - format helpers;
  - `applyFieldErrors` path mapping;
  - LineGrid keyboard navigation;
  - PaymentSplitEditor mode restriction;
  - `useIdempotencyKey` reuse on retry.
- End-to-end tests (Playwright, desktop and 360 px projects) against a local API (`supabase start && supabase db reset` with the seed, plus `go run ./cmd/api`):
  - sign in;
  - create a Cash bill;
  - shortage → switch location → save;
  - copy to Account;
  - record a part payment;
  - return as Admin, approved as Super Admin;
  - purchase → stock rises;
  - transfer;
  - Admin cannot see cancel or edit.
- Manual checks: keyboard-only bill entry (keystroke count about 25 for 3 lines), contrast check of the tokens, and a review against the design.md §10 checklist.

## 10. API gaps to raise with the backend (not blockers)

- No `GET /stock-adjustments/{id}`, and no list endpoint for purchase returns or stock counts. The UI uses expandable rows and the purchase view instead.
- No calculate endpoint for purchases and returns, so their totals appear only after saving.
- **Item import results are not exposed.** The worker records `{rows, created, errors[]}`, but the `Job` schema has no `result` field. A job also succeeds when every row failed, because it rolls back and reports the errors only in that hidden result. The import page can therefore only say "finished". Proposed: add `result` (an object) to `Job` in `openapi.yaml` and `jobs.ToAPI`; the UI will then show counts and a row-error table.
- **Unit lock is not flagged on the item.** FR-IN-07 locks unit factors once an item has movements. The UI infers this from `GET /items/{id}/movements?page_size=1`. A `has_movements` (or `units_locked`) field on `Item` would save a call.
- **Returns have no preview.** The credit-note total is known only after saving, but a refund needs its amount up front (it must not exceed that total). The form shows each line's sold rate; the server's error states the exact total. Proposed: `POST /returns/calculate`, or let the refund amount default to the credit-note total.
- **Returnable quantity is not exposed.** `Bill.lines` has no "already returned" figure, so the return form shows the sold quantity and the server enforces the remaining limit. Proposed: `returned_qty` on `BillLine`.
