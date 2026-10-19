# Billing & Inventory — web app

React + TypeScript UI for the billing and inventory API in [`../backend-api`](../backend-api).

- How the UI should look and behave: [design.md](design.md)
- Why the stack and patterns were chosen: [decisions.md](decisions.md)
- Pages, components and architecture: [ui-plan.md](ui-plan.md) (API gaps found while building: §10)
- Build progress: [tasks.md](tasks.md)

## Setup

```bash
nvm use                      # Node 24
npm install
cp .env.example .env.local   # fill in the Supabase anon key
npm run dev                  # http://localhost:5173
```

The API must be running (see `backend-api/README.md`).

## Scripts

| Script                                  | What                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run gen:api`                       | Regenerate `src/lib/api/schema.d.ts` from `../backend-api/openapi.yaml`                                           |
| `npm run typecheck` · `lint` · `format` | Checks                                                                                                            |
| `npm test`                              | Vitest unit/component tests                                                                                       |
| `npm run test:e2e`                      | Playwright (desktop + 360 px phone) against a mocked API; first run `npx playwright install --with-deps chromium` |
| `npm run build`                         | Production build to `dist/`                                                                                       |

## Tests

- **Unit (Vitest):** formatting, date parsing, form-to-API mapping for bills, purchases, items, parties and categories, shortcuts, problem handling.
- **End to end (Playwright):** every page, on desktop (1366 px) and phone (360 px), against an in-browser mock of the Go API and Supabase Auth (`e2e/support`). Mock handlers are typed from `openapi.yaml`, and any call without a handler fails the test (decisions D-32).
- **Accessibility:** `e2e/a11y.spec.ts` runs axe (WCAG 2.2 AA) on the main pages at both sizes and checks that no page scrolls sideways at 360 px (D-34).

The e2e suite tests the UI against the contract, not the Go server. Before go-live, add a smoke run against the real local stack (`supabase start`, `go run ./cmd/api`).

## Keystroke audit (design P1)

| Flow (desktop, keyboard only)                        | Keys besides typed text                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Cash bill, known customer, 3 lines, paid in full | Alt+N · Enter (customer) · per line: Enter after item, unit, location, quantity, rate, discount (6) · Ctrl+Enter = about 20, plus one click on “Paid in full” |
| Record a receipt from a bill                         | One click on “Record payment” (party, bill and amount prefilled) · choose the mode · Ctrl+Enter                                                               |
| New purchase, 1 line                                 | Alt+P · type dealer, Enter · invoice no. · item, Enter ×6 · Ctrl+Enter                                                                                        |

Choosing a customer jumps straight to the first item; Enter skips the rarely changed discount %/₹ toggle.
