# Decisions: Billing & Inventory web app

This file records the important decisions for the web app: what we chose, why, and what we rejected. Add new entries at the end. Never delete an entry. If a decision changes, mark the old one **Superseded by D-xx**.

**Status values:** Accepted · Proposed (needs the owner's confirmation) · Superseded

Requirement IDs refer to `backend-api/Billing_Inventory_Requirements_HLD_v2.1.docx`. Open items (O-xx) are listed in `backend-api/AGENTS.md`.

## Index

| ID   | Decision                                                                 | Status                          |
| ---- | ------------------------------------------------------------------------ | ------------------------------- |
| D-01 | Separate repository for the web app                                      | Accepted (differs from HLD 6.8) |
| D-02 | React 19, not React 18                                                   | Proposed (differs from HLD 6.2) |
| D-03 | Vite 8, TypeScript 5.9 (strict), Node 24, npm                            | Accepted                        |
| D-04 | TanStack Router with file-based routes and typed search params           | Accepted                        |
| D-05 | Server state in TanStack Query; no global client store                   | Accepted                        |
| D-06 | API client generated from `openapi.yaml`                                 | Accepted                        |
| D-07 | Money as decimal strings; no arithmetic in the browser                   | Accepted                        |
| D-08 | Idempotency-Key per form; If-Match for edits; no automatic write retries | Accepted                        |
| D-09 | Live totals from `/bills/calculate`                                      | Accepted                        |
| D-10 | Permissions come from `/me` and `allowed_actions`                        | Accepted                        |
| D-11 | Supabase used only for sign-in                                           | Accepted                        |
| D-12 | PWA caches the app shell only; no offline billing                        | Accepted                        |
| D-13 | shadcn/ui on Radix, re-skinned with our own tokens                       | Accepted                        |
| D-14 | Tailwind CSS v4, tokens in CSS                                           | Accepted                        |
| D-15 | IBM Plex Sans and Mono, self-hosted                                      | Accepted                        |
| D-16 | Light theme only in v1                                                   | Proposed                        |
| D-17 | Forms with React Hook Form and Zod                                       | Accepted                        |
| D-18 | Tables with TanStack Table v9, server-side paging                        | Accepted                        |
| D-19 | Charts with Recharts                                                     | Accepted                        |
| D-20 | Dates with date-fns; IST display; business dates from the server         | Accepted                        |
| D-21 | Errors handled by problem `code`                                         | Accepted                        |
| D-22 | Background jobs and e-invoices tracked by polling                        | Accepted                        |
| D-23 | Feature-based folder structure                                           | Accepted                        |
| D-24 | Tooling: oxlint, Prettier, Vitest, Playwright                            | Accepted                        |
| D-25 | English only; no i18n library in v1                                      | Accepted                        |
| D-26 | Hosting: Vercel in development; production host open                     | Proposed (O-08)                 |
| D-27 | Separate phone layout for document entry                                 | Accepted                        |
| D-28 | Own `useShortcut` hook for keyboard shortcuts                            | Accepted                        |
| D-29 | One generic report viewer driven by column metadata                      | Accepted                        |
| D-30 | One LineGrid engine for all line-based documents                         | Accepted                        |
| D-31 | Phone shell and entry layouts below 1024 px                              | Accepted                        |
| D-32 | Playwright runs against a typed mock API                                 | Accepted                        |
| D-33 | Own DataTable instead of TanStack Table v9                               | Accepted                        |
| D-34 | Accessibility is checked by axe in Playwright                            | Accepted                        |
| D-35 | Inputs get their label from a Field context                              | Accepted                        |
| D-36 | Demo mode with an in-browser mock API                                    | Accepted                        |

---

### D-01 Separate repository for the web app

- **Context:** HLD 6.8 and `backend-api/AGENTS.md` describe one repository, with the web app in `/web`. The owner asked for a new repository for the UI.
- **Decision:** The web app lives in its own repository, `frontend-web/`, next to `backend-api/`. The API contract is read from `../backend-api/openapi.yaml` (see D-06).
- **Consequences:**
  - The API and UI version and deploy separately.
  - A contract change needs two PRs: the API PR first, then the UI PR that regenerates the types.
  - CI must check out both repositories, or use a pinned copy of `openapi.yaml`.
  - `backend-api/README.md` and `AGENTS.md` still mention `web/` and should be updated to point here.
- **Rejected:** A `web/` folder inside `backend-api`. It keeps the contract in sync for free, but it is not what the owner asked for.

### D-02 React 19, not React 18 (Proposed)

- **Context:** HLD 6.2 says React 18. The current Vite template, shadcn/ui and Tailwind v4 all target React 19, and React 18 now only receives maintenance fixes.
- **Decision:** Use React 19. The HLD's intent (React + TypeScript + Vite) is unchanged. We do not use React Server Components or other server features; this is a client-side single-page app.
- **To confirm:** The owner or architect approves this change from the HLD. Going back to 18 is cheap now and expensive later.

### D-03 Vite 8, TypeScript 5.9 (strict), Node 24, npm

- **Decision:**
  - TypeScript runs with `strict` and `noUncheckedIndexedAccess`.
  - TypeScript is pinned to 5.9 because `openapi-typescript` 7 does not yet support TypeScript 6.
  - Node 24 LTS (`.nvmrc`), with npm as the package manager.
- **Why npm:** It is one less tool to install on the developer's machines and on Vercel. pnpm would save little at this size.
- **Revisit:** Move to TypeScript 6 when `openapi-typescript` supports it.

### D-04 TanStack Router with file-based routes and typed search params

- **Context:** The app has many filterable registers. Filters must live in the URL so that a filtered view can be bookmarked and shared (design P7).
- **Decision:** Use TanStack Router with routes in `src/routes/`. Each register validates its search params with a Zod schema. `src/routeTree.gen.ts` is generated by the Vite plugin and committed to the repository.
- **Rejected:** React Router 7. It has weaker typing for search params and its framework mode is server-oriented.

### D-05 Server state in TanStack Query; no global client store

- **Decision:**
  - All API data goes through TanStack Query.
  - Local UI state stays in components, or in the URL for filters.
  - No Redux or Zustand. Add a small store only if a real cross-screen client state appears (an open bill draft is not one; see D-17).
- **Settings:**
  - `staleTime` is 30 s and data refetches on window focus.
  - Mutations never retry automatically (see D-08).
  - After a save, the related lists are invalidated (bills, stock, party balance).

### D-06 API client generated from `openapi.yaml`

- **Context:** API design §1 says the client types come from the contract, so the two cannot drift.
- **Decision:**
  - `npm run gen:api` runs `openapi-typescript`, which writes `src/lib/api/schema.d.ts`. That file is committed.
  - Calls go through one `openapi-fetch` client. Its middleware adds the bearer token, reads `X-Request-Id`, and turns `application/problem+json` responses into typed errors.
  - Nobody writes request or response types by hand.
- **Rule:** Every UI change that follows an API change regenerates the file in the same PR.

### D-07 Money as decimal strings; no arithmetic in the browser

- **Context:** The API sends money, quantity and rate as decimal strings (2, 3 and 4 decimal places). Totals and tax are computed only on the server (NFR-02; API design 6.5).
- **Decision:**
  - Values stay as strings from the API to the screen.
  - One formatting module, `lib/format`, uses `Intl.NumberFormat('en-IN')` for display only.
  - Inputs keep the typed string and validate its format (for example `^\d+(\.\d{1,3})?$` for quantity). They never parse it into `number` to do arithmetic.
  - No decimal library for now. Add one only if a real client-side calculation becomes unavoidable, and record that here.

### D-08 Idempotency-Key per form; If-Match for edits; no automatic write retries

- **Decision:**
  - A form that creates a document makes a UUID (`crypto.randomUUID()`) when it opens. It reuses that key for every retry of the same save, and makes a new one after a successful save.
  - Bill edits and cancels send `If-Match` with the ETag from `GET /bills/{id}`.
  - A `412 VERSION_MISMATCH` shows the reload flow from design P6 and keeps the user's edits visible.
  - Writes are retried only when the user clicks Retry, with the same key. This makes duplicate bills impossible, even on a slow phone network.

### D-09 Live totals from `/bills/calculate`

- **Decision:**
  - The bill form posts its current body to `/bills/calculate`, debounced by 300 ms. Requests that have been overtaken by newer ones are cancelled with `AbortController`.
  - While a request is in flight, the previous totals stay on screen, dimmed.
  - On save, the form sends the grand total it displayed as `expected_total`.
  - The same approach applies to purchases and returns if the API offers a calculate endpoint for them. Otherwise totals appear after saving. Totals are never computed in the browser.

### D-10 Permissions come from `/me` and `allowed_actions`

- **Decision:**
  - After sign-in, the app loads `/me` once (it is cached and refetched on focus).
  - Navigation and buttons use its permission keys. Bill actions use `allowed_actions`.
  - Routes check permissions only to shape the UI. The server enforces every permission (FR-AU-04), and a 403 is always handled.
  - The UI never re-implements rules such as the 24-hour IRN window or "Super Admin only".

### D-11 Supabase used only for sign-in

- **Context:** NFR-03 and API rule 1: the browser never reads business data from Supabase.
- **Decision:**
  - `supabase-js` handles only sign-in, the password reset email, session refresh and sign-out.
  - The access token is attached to API calls by the fetch middleware.
  - Only the anon key is in the client environment.
  - No `supabase.from(...)` calls anywhere. This is enforced in code review and with a lint rule.
- **Consequence:** If a user is deactivated, their next API call fails with 401. The app signs them out with the message "Your access was removed".

### D-12 PWA caches the app shell only; no offline billing

- **Context:** HLD 6.3 says billing still needs the internet. Stock and numbering need the server's transaction.
- **Decision:**
  - `vite-plugin-pwa` precaches the app shell, so the app is installable and opens quickly.
  - API responses are never cached by the service worker.
  - When offline, the app shows a banner and saving is disabled (design P9).
  - Updates use `registerType: 'prompt'`, so a new version never reloads the page in the middle of a bill. The user sees "New version available – Reload".

### D-13 shadcn/ui on Radix, re-skinned with our own tokens

- **Context:** HLD 6.3 chooses shadcn/ui. Its default theme is one of the clearest signs of a vibe-coded app (design §4).
- **Decision:**
  - Components are added with `npx shadcn add` into `src/components/ui/`, and their styles are edited to our tokens straight away. These files are ours and are expected to change.
  - App-level components that are shared across features go in `src/components/shared/`.
  - `components.json` exists, but `shadcn init` was not run, so its default theme was never imported.

### D-14 Tailwind CSS v4, tokens in CSS

- **Decision:**
  - Use Tailwind v4 through `@tailwindcss/vite`.
  - Design tokens (colour, radius, font, spacing additions) are CSS custom properties in `src/styles/index.css`, defined with `@theme`. There is no `tailwind.config.js`.
  - Components use only token-based classes. Hex values in components are a review failure.
  - Prettier sorts class names (`prettier-plugin-tailwindcss`).

### D-15 IBM Plex Sans and Mono, self-hosted

- **Why:**
  - Plex has clear tabular figures and includes the ₹ sign.
  - Plex Mono keeps codes (GSTIN, IRN) unambiguous.
  - It is distinctive without being decorative, and it is not Inter, the default in most generated UIs.
- **Decision:** Load the fonts through `@fontsource` packages, so they are bundled, cached by the PWA and need no request to a third-party font host.

### D-16 Light theme only in v1 (Proposed)

- **Why:**
  - The counter is brightly lit and the printed documents are light.
  - Shipping one theme well is better than shipping two at half quality.
- **Decision:** Ship a light theme only. Tokens are named by role (`paper`, `ink`, `rule`, and so on), so a dark theme can be added later without touching components.

### D-17 Forms with React Hook Form and Zod

- **Decision:**
  - Use RHF with `@hookform/resolvers` and Zod 4.
  - Zod schemas cover input format and required fields only. Business validation stays on the server, and its field errors are mapped back with `setError` (design P6).
  - Bill and purchase line grids use `useFieldArray`.
  - An unsaved bill form is autosaved to `localStorage` per tab, so a refresh does not lose work. Saving a server draft (FR-BL-09) remains an explicit action.

### D-18 Tables with TanStack Table v9, server-side paging

**Superseded by D-33** for the table library; server-side paging, sorting and totals still apply.

- **Decision:**
  - Registers use server-side paging, sorting and filtering, which the API supports (max `page_size` 200).
  - TanStack Table renders them headlessly with our own markup.
  - `@tanstack/react-virtual` is used only for long client-side lists, such as the item picker and stock count sheets.
  - Totals rows come from the server.

### D-19 Charts with Recharts

- **Decision:** Use Recharts, as in HLD 6.3, for the dashboard trend and the breakdown charts. Charts follow the dataviz rules: restrained palette from the tokens, direct labels, and a table alternative. Keep charts to a minimum (design 8.3).

### D-20 Dates with date-fns; IST display; business dates from the server

- **Decision:**
  - Display dates as DD-MM-YYYY, and timestamps in IST.
  - Business dates (`bill_date`) are plain `YYYY-MM-DD` strings and are never converted through `Date` and time zones.
  - The default "today" comes from the server's IST date where the API provides it. Otherwise it is computed in the `Asia/Kolkata` time zone.
  - The FY label (`26-27`) is shown as the server sends it.

### D-21 Errors handled by problem `code`

- **Decision:**
  - The API client throws an `ApiProblem` with `status`, `code`, `errors[]` and `request_id`.
  - Screens handle the codes listed in API design 2.3, as described in design P6.
  - Unknown errors fall back to a message showing the `request_id`.
  - 401 leads to sign-in. 429 shows "Too many requests – try again in a moment".

### D-22 Background jobs and e-invoices tracked by polling

- **Decision:**
  - A 202 response with a Job is polled at `GET /jobs/{id}` every 2 s until it succeeds or fails. Progress is shown inline.
  - A bill with `einvoice.status = pending` is refetched every 3 s while it is open, and stops after 2 minutes with "Still waiting for the portal".
  - Signed download URLs (valid for 10 minutes) are opened immediately and never stored.

### D-23 Feature-based folder structure

```
src/
  app/            providers, router, query client
  routes/         TanStack file routes (thin: layout + data loading, render feature components)
  features/<x>/   screens, components, hooks, queries and schemas for one area
                  (auth, dashboard, billing, returns, payments, parties, purchases,
                   inventory, catalogue, reports, tally, notifications, settings, users)
  components/ui/  shadcn primitives (re-skinned)
  components/shared/  app-wide composites (DataTable, MoneyCell, StatusBadge, PageHeader …)
  lib/            api client + generated schema, env, format, utils
  hooks/          app-wide hooks (shortcuts, debounce, online status)
  styles/         index.css with tokens
  test/           test setup
e2e/              Playwright specs (desktop + 360 px phone projects)
```

- **Rule:** Features never import from each other's internals. Anything shared moves to `components/shared` or `lib`.

### D-24 Tooling: oxlint, Prettier, Vitest, Playwright

- **Decision:**
  - oxlint, from the Vite template; it is fast and covers the React hooks rules.
  - Prettier with the Tailwind plugin.
  - Vitest with Testing Library and jsdom for unit and component tests.
  - Playwright for end-to-end tests, with two projects: desktop, and a phone at 360 px (NFR-06). The locale is `en-IN` and the time zone `Asia/Kolkata`.
- **CI gate:** `typecheck`, `lint`, `test` and `build` must pass. Playwright runs against a seeded local API.
- **Setup note:** Playwright browsers are not downloaded yet. Run `npx playwright install chromium` before the first end-to-end test.

### D-25 English only; no i18n library in v1

- **Context:** Kannada invoices are out of scope for v1 (PRD 1.1).
- **Decision:**
  - Write strings in English, directly in the components.
  - Keep wording consistent with the glossary (design §9), so that extracting the strings later is mechanical.
  - Do not add an i18n library until a second language is actually planned.

### D-26 Hosting: Vercel in development; production host open (Proposed, O-08)

- **Decision:** Use Vercel Hobby for development and preview deployments. Before real billing starts, move to either Vercel Pro or Cloudflare Pages (free tier, business use allowed), whichever the owner chooses (O-08). The build is a plain static `dist/`, so both hosts work without changes.
- **Required:** The SPA fallback (rewrite all paths to `/index.html`) must be configured on the chosen host. The API's CORS list must include the web domain.

### D-27 Separate phone layout for document entry

- **Context:** A desktop bill grid squeezed to 360 px cannot be used (NFR-06).
- **Decision:**
  - Bill, purchase, transfer and count entry each have a phone layout: line cards, a bottom-sheet editor, and a pinned total and save bar.
  - Both layouts share the same form state and API calls. Only the presentation differs.
  - Registers on phone show a card list with the 3–4 key fields instead of a wide table.

### D-28 Own `useShortcut` hook for keyboard shortcuts

- **Decision:** A small scoped hook (`src/hooks/useShortcut.ts`, about 60 lines) handles a global scope plus one document scope (bill editor, purchase entry …). It ignores browser-reserved keys (Ctrl+N, Ctrl+T, Ctrl+W) and does not fire inside text inputs unless the shortcut is marked as allowed there (Ctrl+Enter, Ctrl+S, Alt+L, Alt+D).
- **Rejected:** `react-hotkeys-hook` and similar libraries. Our map is small and fixed (design §7), and we want full control over scope and input behaviour.

### D-29 One generic report viewer driven by column metadata

- **Context:** The API has 21 report keys under `GET /reports/{key}`. Each JSON response includes column metadata with a type (`text`, `money`, `qty`, `date`, `percent`).
- **Decision:** One page, `/reports/$key`, renders every report. It maps column types to the shared cell components (Money, Qty, DateText …), and takes filters from the URL. Excel and PDF exports use `format=xlsx|pdf`. There are no per-report screens.
- **Consequence:** A new report on the server appears in the UI by adding one entry to the report catalogue.

### D-30 One LineGrid engine for all line-based documents

- **Decision:** Bills, purchases, purchase returns, transfers, adjustments, sales returns and stock counts all use one keyboard grid (`components/shared/line-grid/`), configured by a column list and built on RHF `useFieldArray`. Its phone twin (LineCards + LineSheet) shares the same form state (D-27).
- **Why:** The keyboard behaviour (Enter to advance, F4 picker, Alt+L, Alt+D), accessibility and server error markers are written and tested once.

### D-31 Phone shell and entry layouts below 1024 px

- **Decision:** Below 1024 px the app uses the phone shell (bottom nav) and the phone document-entry layouts. Tablets therefore get the touch layout. At 1024 px and above it uses the desktop shell and LineGrid.
- **Why:** Tablets at the shop are used by touch, and a desktop grid at 768 px is too cramped for 7–8 columns.

### D-32 Playwright runs against a typed mock API

- **Context:** Each task is checked with Playwright. Running the real stack needs Go, the Supabase CLI and Docker images, and gives slow, stateful tests.
- **Decision:**
  - The app runs in Vite mode `e2e` (`.env.e2e`), pointing at the fake hosts `api.mock` and `supabase.mock`.
  - `e2e/support/mock-api.ts` intercepts them in the browser. Supabase Auth (password sign-in, refresh, sign-out, recover, update user) is mocked as well.
  - Handlers are typed from `src/lib/api/schema.d.ts`: `mock.on('get', '/items/{id}', …)` must return that operation's success body, so fixtures that drift from `openapi.yaml` fail to compile.
  - Any API call without a handler fails the test, so new calls cannot slip through unmocked.
  - Both projects run every spec: desktop (1366 px) and phone (360 px).
- **Limits:** This tests the UI against the contract, not the Go server's behaviour. Before go-live, add a small smoke suite against the real local stack (`supabase start` + `go run ./cmd/api`).

### D-33 Own DataTable instead of TanStack Table v9

- **Context:** Every register pages, sorts and totals on the server (D-18), so a table library would only render rows. TanStack Table v9 has a new store/atoms API that adds complexity for no gain here.
- **Decision:** `components/shared/DataTable.tsx` takes typed column definitions (`header`, `cell`, `align`, `sortKey`, `footer`, `mobile` role). It provides a sticky header and first column, server sort through the URL, a column picker saved in localStorage, a totals row from server values, skeleton/empty/error states, and a card list below 1024 px (D-31). `@tanstack/react-table` was removed.
- **Revisit:** If a screen needs client-side grouping or editing in a grid, use TanStack Table for that screen only. The LineGrid (D-30) is separate.

### D-34 Accessibility is checked by axe in Playwright

- **Decision:** `e2e/a11y.spec.ts` scans the sign-in page and the main screens (dashboard, bills, bill editor, bill view, inventory, item, party, settings, reports) with `@axe-core/playwright` against WCAG 2.2 AA, on desktop and at 360 px. It also asserts that no page scrolls sideways. A new violation fails the suite.
- **What it found and changed:**
  - `--ink-faint` went from #8A9098 to #60666E, and status text from #2E7D4F/#B26B00 to #23673F/#8A5300, so they reach 4.5:1 on their backgrounds.
  - Filter tabs no longer point `aria-controls` at panels that do not exist.
  - Inline links are underlined.
  - Horizontally scrolling tables can be focused with the keyboard.
  - The account menu is named by its visible text.
- **Limits:** axe catches about a third of WCAG issues. Keyboard flows are covered by the e2e specs; a screen-reader pass by a person is still needed before go-live.

### D-35 Inputs get their label from a Field context

- **Context:** `<Field>` first labelled its input by cloning the child with an `id`. That silently failed for inputs wrapped in a react-hook-form `Controller` or a picker, so date, amount and picker fields had no accessible label.
- **Decision:** `Field` provides `{id, describedBy, invalid}` through `FieldContext`. `Input`, `Textarea`, `NativeSelect`, `DecimalInput`, `DateInput`, the combobox and the file inputs read it with `useFieldControl`. Any new input component must do the same.

### D-36 Demo mode with an in-browser mock API

- **Context:** The UI should be viewable and testable by hand without the Go API, Supabase or Docker.
- **Decision:**
  - `npm run demo` starts Vite in mode `demo` (`.env.demo`). `main.tsx` then starts MSW through its Vite plugin, before the app renders.
  - Handlers in `src/mocks/handlers.ts` answer every endpoint the UI calls, including Supabase sign-in, from an in-memory store (`src/mocks/db.ts`). They follow the main server rules: stock goes down on Cash bills, a short line refuses the save, payments reduce balances, and an Admin's returns wait for approval.
  - The store is kept in `localStorage` and has a reset button in the banner.
  - Fixtures are shared with the Playwright mocks (`src/mocks/data.ts`, `calc.ts`), so both stay typed against `openapi.yaml`.
- **Production safety:** The demo code is behind `import.meta.env.VITE_DEMO`, which is constant-false in a normal build. The build was checked to contain no demo code or worker.
- **Side effect:** Each Vite mode has its own dependency cache (`node_modules/.vite-<mode>`), so dev, demo and the e2e server can run together.
