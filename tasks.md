# Tasks

Built from [ui-plan.md](ui-plan.md). Page numbers (#n) refer to ui-plan §4. A task is done when typecheck, lint, unit tests, build and its Playwright spec pass.

Playwright specs run against a mocked API (`e2e/support/`), with fixtures typed from `src/lib/api/schema.d.ts` (decisions D-32).

## M0 Foundation

- [x] T0.1 Theme tokens, base styles, density (ui-plan §2)
- [x] T0.2 UI primitives (shadcn, re-skinned)
- [x] T0.3 Core lib: format, API client + problems, auth, permissions, hooks
- [x] T0.4 Playwright harness: mock Supabase auth + mock API
- [x] T0.5 Router: public/app layouts, guards, 404 (#42), 403 (#43), error boundary
- [x] T0.6 Auth pages: login (#1), forgot password (#2), set password (#3)
- [x] T0.7 App shell: sidebar, top bar, bottom nav, command palette, notification bell, user menu, offline banner, update prompt, shortcuts help

## M1 Catalogue and inventory

- [x] T1.1 Shared data display: PageHeader, DataTable, FilterBar, MobileCardList, Money/Qty/Rate, StatusBadge, StockByLocation, Empty/Error states
- [x] T1.2 Units (#35)
- [x] T1.3 Categories list (#33) and wizard/editor (#34)
- [x] T1.4 Inventory grid (#19)
- [x] T1.5 Item form (#20) and item detail with stock ledger (#21)
- [x] T1.6 Item import (#22)

## M2 Parties

- [x] T2.1 Party list (#16), party form (#17)
- [x] T2.2 Party detail with ledger (#18)

## M3 Billing core

- [x] T3.1 Shared inputs: Money/Qty inputs, DateInput (done in M2), ItemPicker, PartyPicker, PaymentSplitEditor, ReasonDialog
- [x] T3.2 LineGrid engine + phone LineCards
- [x] T3.3 Bill editor create/edit (#7, #8), calculate, shortage, credit limit
- [x] T3.4 Bill view (#9): tabs, allowed actions, e-invoice, print/share, history
- [x] T3.5 Bill register (#6)

## M4 Payments and returns

- [x] T4.1 Payments register (#13), record payment (#14), payment view (#15)
- [x] T4.2 Returns register (#10), create return (#11), return view (#12)

## M5 Purchases and stock operations

- [x] T5.1 Purchases register (#23), entry (#24), view (#25), purchase return (#26)
- [x] T5.2 Transfers (#27–29)
- [x] T5.3 Adjustments (#30, #31)
- [x] T5.4 Physical count (#32)

## M6 Dashboard, notifications, reports

- [x] T6.1 Dashboard (#4)
- [x] T6.2 Notifications (#5)
- [x] T6.3 Report catalogue (#36) and viewer (#37)

## M7 Admin

- [ ] T7.1 Settings (#38) incl. locations
- [ ] T7.2 Users (#39)
- [ ] T7.3 Tally (#40)
- [ ] T7.4 Audit log (#41)

## M8 Polish

- [ ] T8.1 PWA update prompt check, accessibility pass, keystroke audit, full e2e run
