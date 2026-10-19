# Design principles: Billing & Inventory web app

This file describes how the UI should look, feel and behave. Every screen and component follows it. If a screen needs to break a rule, record the reason in `decisions.md`.

Requirement IDs (FR-_, BR-_, NFR-*) refer to `backend-api/Billing_Inventory_Requirements_HLD_v2.1.docx`.

---

## 1. Who we are designing for

| Person                | Where                                                                  | What they need                                                                                                           |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Counter staff (Admin) | Desktop at the shop counter, often with a queue of contractors waiting | To enter a bill of 5–20 lines quickly without the mouse, see stock at all three locations, and never print a wrong total |
| Owner (Super Admin)   | Phone at a site or godown, and desktop in the evening                  | To approve returns, act on shortage alerts, check today's sales and outstanding amounts, and edit or cancel bills safely |
| Godown staff          | Phone, in poor light and with a weak network                           | To receive purchases, transfer stock and count stock                                                                     |
| Accountant            | Desktop, monthly                                                       | To get GST reports, Tally exports and registers that match the books                                                     |

What follows from this:

- These people use the app **for hours every day**, so it is a working tool and is never trying to sell anything. The UI should be judged by how the hundredth bill of the day feels, not by how the login page looks.
- Most of them come from **Tally, Excel or paper bill books**. They read data in dense tables, rely on the keyboard, and trust numbers that line up in columns.
- Mistakes cost real money and can create GST problems. A clear, calm interface matters more than a lively one.

## 2. Character: "a well-kept ledger"

The app should feel like a good account book: precise, quiet and dense, with clear ruling lines, plus the speed of software. It should not look like a startup landing page or a template dashboard.

| We are                                                  | We are not                                        |
| ------------------------------------------------------- | ------------------------------------------------- |
| Dense, aligned, scannable                               | Airy cards with one number each                   |
| Ink on paper, with colour only where it carries meaning | Gradients, glows, glassmorphism, coloured shadows |
| Quick to act on: one key, one tap                       | Guided wizards for everyday tasks                 |
| Honest about state: pending, failed, unsynced           | Optimistic success messages that hide failures    |
| Plain shop language ("Save bill", "Godown 1")           | Marketing copy ("Let's get started! 🚀")          |

---

## 3. Principles

Each principle gives the rule, the reason for it, and how to apply it.

### P1. Design for the hundredth bill, not the first impression

**Rule:** Optimise the frequent paths (new bill, find item, record payment, check stock) for speed and repeat use. Learnability is secondary for these paths.
**Why:** FR-BL-12 asks for keyboard-first entry, and NFR-01 sets bill save under 2 s. The counter has a queue.
**Apply:**

- Count the keystrokes and clicks for every frequent flow, and write the count in the PR. A Cash bill for a known customer with 3 lines should take about 25 keystrokes and no mouse.
- Use smart defaults: the default location is Shop, the date is today, the place of supply comes from the customer's state, and the unit is the last unit used for that item.
- Never put a confirmation dialog in front of a routine action. Save directly, and offer a follow-up action (Print, Share, New bill).

### P2. Keyboard-first on desktop, thumb-first on phone

**Rule:** Every desktop flow can be completed with the keyboard alone. Phone screens get their own layout, not a squeezed version of the desktop one.
**Why:** FR-BL-12 and NFR-06 (360 px and up).
**Apply:**

- There is a global shortcut map (section 7). Show shortcuts in tooltips and menus, and show the full list on `?`.
- In the bill-entry grid, Enter moves to the next field and wraps to a new line, Tab behaves normally, and Esc closes the open picker before it does anything else.
- On phone, the bill becomes a list of line cards. Each line is edited in a bottom sheet, and the total and Save button stay pinned to the bottom. Tap targets are at least 44 × 44 px. Numeric fields use `inputmode="decimal"`.
- Focus is always visible (a 2 px ring with offset) and never trapped, except inside dialogs.

### P3. Numbers are the interface

**Rule:** Money, quantities and rates are the most important content. Typeset them with care, and never compute them in the browser.
**Why:** The API sends decimal strings, and totals come only from the server (API design 2.1 and 6.5; NFR-02).
**Apply:**

- Every numeric column uses `font-variant-numeric: tabular-nums`, is right-aligned, and shows a fixed number of decimals: 2 for money, 3 for quantity where the unit allows decimals, and 4 for cost and rate hints.
- Use Indian grouping: ₹ 1,00,000.00 (`Intl.NumberFormat('en-IN')`). The ₹ sign goes in the column header, not on every cell, so columns stay aligned.
- Show negative and credit amounts with a minus sign and the semantic colour. Show ledger balances as `Dr` / `Cr` suffixes, the way accountants read them.
- Never add, multiply or round amounts in JavaScript. Live totals come from `POST /bills/calculate` (see P4).
- Show document numbers, GSTIN, IRN, HSN and UTR in IBM Plex Mono so that confusable characters (0/O, 1/I) are easy to tell apart.

### P4. The server is the source of truth, and the UI shows it honestly

**Rule:** The UI shows what the server computed and allows what the server allows. It never re-implements a business rule.
**Why:** `allowed_actions` on bills and the `/me` permissions exist so the UI cannot drift from the rules (FR-AU-04, BR-08).
**Apply:**

- Show or hide actions from `allowed_actions` and the permission keys. Hide an action the user can never take. Disable an action that is temporarily unavailable, and give the reason in a tooltip, for example "IRN older than 24 h – use a credit note".
- Live totals on the bill screen: call `/bills/calculate` with a 300 ms debounce. While the request is in flight, keep the previous totals, dimmed, with a small "updating" marker, so the numbers never flicker to zero. Send `expected_total` on save.
- Show asynchronous state explicitly: e-invoice `pending → generated / failed`, jobs with their progress, cheques `pending / cleared / bounced`. A bill whose IRN is pending shows "Print available after IRN" and does not show a broken print button.

### P5. Show the consequences before saving

**Rule:** Before the user commits, show what will happen to stock, the ledger and the customer's balance.
**Why:** A Cash bill reduces stock and an Account bill does not (BR-01). An Account copy does not post to the ledger (BR-04). Staff have to know which one they are making.
**Apply:**

- Cash and Account bills look different at a glance: a coloured band and label on the bill header (section 5.2), a different number prefix, and different wording on the Save button ("Save Cash bill" / "Save Account bill").
- The bill footer summarises the effects, for example: "Stock: −1.5 t TMT 12 mm at Godown 1 · Ledger: +₹ 98,450 due from Ravi Builders · Credit limit: 82% used".
- On Cash bills, every line shows stock at all three locations (FR-BL-03). A line that would go short is flagged inline **before** saving, using the calculate response.

### P6. An error should give the user a way forward

**Rule:** Every error says what happened and offers the next step, as close as possible to the field or line that caused it.
**Why:** The API returns stable problem codes with field paths (API design 2.3).
**Apply:**

- `VALIDATION_FAILED`: map each `errors[].field` (for example `lines[1].rate`) to its input and focus the first one. Never show only a toast for a field error.
- `INSUFFICIENT_STOCK`: highlight the short lines and show the available quantity per location, with one-click actions "Take from Godown 2" and "Create transfer" (FR-CB-02).
- `VERSION_MISMATCH`: "Someone else changed this bill. Reload to see their changes." Keep the user's unsaved edits visible so they are not lost.
- `CREDIT_LIMIT_EXCEEDED`: a Super Admin sees "Override and save", with a reason. An Admin sees who to ask.
- `EINVOICE_WINDOW_CLOSED`: offer "Create credit note" directly.
- Unknown and 500 errors: say so plainly and show the `request_id` with a copy button, for support.
- Never lose what the user typed. Bill drafts are kept locally until they are saved (FR-BL-09 server drafts are the durable copy).

### P7. Density, with hierarchy

**Rule:** Show a lot of information, and make it scannable with alignment, weight and spacing. Do not split it into cards.
**Why:** Breaking information into cards and pages hides it behind clicks. These users compare rows.
**Apply:**

- The default table density is 32 px rows on desktop. A "comfortable" setting gives 40 px rows. Headers stay fixed while scrolling. The first column stays fixed on wide registers.
- Use hairline row rules and subtle zebra striping only on very wide tables. Do not draw boxes around everything.
- Build hierarchy from type weight and colour (primary ink vs muted ink) before using size, borders or backgrounds.
- Filters sit in a persistent bar above the table and are stored in the URL, so a filtered register can be bookmarked and shared.
- No more than one primary (filled) button per view.

### P8. Colour has meaning

**Rule:** The interface is neutral ink on paper. Colour is used for status, bill type, focus and selection, and is never decorative.
**Why:** If everything is coloured, a red shortage warning cannot stand out.
**Apply:**

- Semantic colours: success (cleared, generated), warning (low stock, pending), danger (out of stock, failed, bounced, cancelled), info (draft, in progress).
- Colour is never the only signal. Status badges always include text, and an icon where it helps.
- There are no gradients anywhere. Shadows appear only on floating layers (menus, popovers, dialogs).
- Charts use a restrained palette from the same tokens (see the dataviz rules when the dashboard is built).

### P9. Calm states: loading, empty, stale

**Rule:** Every view handles loading, empty, error and stale data on purpose.
**Apply:**

- Loading: skeletons shaped like the real layout (table rows, form fields). No full-screen spinners, and no spinner for loads under 300 ms.
- Empty: one sentence on what will appear here, and the action that creates it ("No purchases this month. New purchase (P)").
- Stale: TanStack Query refetches on window focus. Show "Updated 2 min ago" on the dashboard and on stock views.
- Offline: a thin banner saying "Offline – billing needs internet". Disable saving while offline, and keep the form editable.

### P10. The weight of an action matches its consequence

**Rule:** Routine actions feel light. Irreversible or money-affecting actions feel deliberate.
**Apply:**

| Action                                                                        | Treatment                                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save bill, record payment, transfer                                           | Primary button and shortcut, no confirmation                                                                                                                                                         |
| Delete a draft                                                                | Undo toast for 5 s, no dialog                                                                                                                                                                        |
| Edit a saved bill, cancel a bill, cancel an IRN, approve a return, deactivate | Dialog that states the effect ("Reverses stock and ledger. Number C/26-27/0418 is kept."), a required reason where the API needs one, and a button that names the action ("Cancel bill"), never "OK" |
| Super Admin overrides (credit limit, period unlock)                           | As above, plus a note that the action is written to the audit log                                                                                                                                    |

### P11. Accessible by default

**Rule:** Meet WCAG 2.2 AA.
**Apply:**

- Text contrast is at least 4.5:1, and 3:1 for UI component boundaries and focus rings.
- Every input has a visible label. Placeholders are examples, never labels.
- Use Radix primitives (through shadcn/ui) for dialogs, menus, comboboxes and popovers. Do not build custom controls that lose keyboard behaviour.
- The bill grid follows the ARIA grid pattern. Line changes and total changes are announced politely.
- Respect `prefers-reduced-motion`.

### P12. Indian business conventions throughout

- Show dates as DD-MM-YYYY (with "18 Oct" in dense lists) and times in IST. FY labels look like `26-27`.
- Use ₹ with Indian grouping, and amounts in words in the Indian format (the server provides these).
- Use GST vocabulary exactly: Taxable value, CGST, SGST, IGST, Place of supply, HSN/SAC, Round off.
- Use the shop's own words: Godown (not Warehouse), Party/Dealer, Cash bill/Account bill, Credit note.

---

## 4. Patterns that make an app look "vibe-coded" (and are banned)

AI-generated interfaces look alike because they all use the same defaults. Treat these as review failures:

- Indigo, violet or purple as the brand colour, purple-to-blue gradients, and gradient text.
- Glassmorphism, blurred backgrounds, glows and coloured drop shadows.
- `rounded-2xl` on everything, pill buttons, and cards inside cards.
- A grid of KPI cards with a big number, a coloured icon in a circle and "+12%", with no action attached.
- Emoji in the UI, exclamation marks, and copy like "Welcome back! 👋" or "Oops! Something went wrong."
- Centred, narrow layouts with large whitespace on a data screen.
- Inter or the system font with default sizes and no tabular figures.
- Icons with no label, in a row, as the only way to act.
- Spinners everywhere. Toasts for validation errors. "Are you sure?" dialogs on routine actions.
- shadcn/ui components left in their default theme. We use shadcn for behaviour and structure, and re-skin every component with our tokens.
- Placeholder content (lorem ipsum, "John Doe") in shipped screens. Use realistic shop data: "Ravi Builders", "TMT 12 mm Tata", "Godown 1".

---

## 5. Visual language

These are the final token values (ui-plan.md §2). The first UI task writes them as tokens in `src/styles/index.css` and adjusts them after a contrast check.

### 5.1 Typography

Fonts: IBM Plex Sans Variable for the UI and IBM Plex Mono for codes (bill no., GSTIN, IRN, HSN, UTR), self-hosted (D-15). Numbers always use `tabular-nums`. Inputs are 16 px on phone so iOS does not zoom on focus.

| Token         | Size / line height / weight                 |
| ------------- | ------------------------------------------- |
| `text-xs`     | 12/16 (meta, badges)                        |
| `text-sm`     | 13/18 (table cells, dense)                  |
| `text-base`   | 14/20 desktop, 15/22 phone                  |
| `text-lg`     | 16/24 (section titles)                      |
| `text-xl`     | 20/28 weight 600 (page titles; 18 on phone) |
| `text-figure` | 24/32 weight 600, tabular (grand totals)    |

Use at most four sizes on a screen. Use weights 400, 500 and 600 only.

### 5.2 Colour (light theme)

| Token                                             | Light                                       | Use                                                                                                 |
| ------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `--paper`                                         | #F7F7F4                                     | App background                                                                                      |
| `--surface`                                       | #FFFFFF                                     | Tables, forms, sheets                                                                               |
| `--surface-sunken`                                | #EFEFEA                                     | Table header, read-only fields                                                                      |
| `--ink`                                           | #1C1F23                                     | Text, primary button                                                                                |
| `--ink-muted`                                     | #5B6169                                     | Secondary text, column headers                                                                      |
| `--ink-faint`                                     | #60666E                                     | Placeholders, de-emphasised zeros (raised from #8A9098 to pass 4.5:1)                               |
| `--rule`                                          | #DEDDD6                                     | Hairlines, borders                                                                                  |
| `--rule-strong`                                   | #C4C3BB                                     | Input borders                                                                                       |
| `--steel`                                         | #2F5D8A (the blue of TMT steel; not indigo) | Focus ring, links, selection                                                                        |
| `--steel-tint`                                    | `--steel` at 10%                            | Selected row                                                                                        |
| `--cash`                                          | #1C1F23                                     | Cash-bill band and label                                                                            |
| `--account`                                       | #0F6E6E (teal)                              | Account-bill band and label                                                                         |
| `--success` / `--warning` / `--danger` / `--info` | #23673F / #8A5300 / #B42318 / #2F5D8A       | Status only (each with a tint; text on tint ≥ 4.5:1, checked with axe)                              |
| `--chart-1`                                       | #2563A8                                     | Chart series (validated; steel failed the chroma floor). More slots only after the validator passes |

The primary button is `ink`, not a brand hue. Run a contrast check on these values when the tokens are written into `src/styles/index.css`.

### 5.3 Space, shape and depth

- Spacing uses a 4 px base (4, 8, 12, 16, 24, 32). Gutters are 16 px on phone and 24 px on desktop.
- Radius: 4 px for inputs and buttons, 6 px for popovers and dialogs. Nothing is fully rounded except avatars and dot indicators.
- Borders do the work. Shadows are only for floating layers, and use a single neutral shadow.
- Inputs and buttons are 32 px high on desktop and 44 px on phone.

### 5.4 Icons and motion

- Use Lucide icons at 16 px with a 1.5 px stroke. Pair them with a text label, except in dense toolbars, where they get a tooltip that shows the shortcut.
- Motion lasts 150 ms or less and is used only to show where something came from (popover, sheet, row inserted). No bouncing, no page transitions, no count-up animations on numbers.

---

## 6. Layout and navigation

- **Desktop shell:** a left sidebar (collapsible to icons) grouped as Sell (Bills, Returns, Payments), Stock (Inventory, Purchases, Transfers, Adjustments, Counts), Parties, Reports, and Admin (Settings, Users, Tally, Audit). The top bar holds global search (Ctrl+K), a "New bill" button, the notifications bell with a count, and the user menu.
- **Phone shell:** a bottom bar with Home, Bills, **New bill** (centre), Stock and More. The bell and search sit in the top bar.
- **Documents are pages, not modals.** Bills, purchases, returns and parties each have a URL, so they can be shared, reloaded and opened in a new tab. Dialogs are only for short tasks (record payment, transfer from a shortage, confirm cancel).
- **Pattern:** list → detail → action. Registers are full-width tables. A row opens the document page. Actions sit in the document's header toolbar.
- **Command palette (Ctrl+K):** uses `GET /search` to jump to items, parties and bills, and also lists commands ("New purchase", "Record payment").

## 7. Keyboard map (desktop)

| Key        | Action                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| Ctrl+K     | Search and command palette                                                   |
| Alt+N      | New Cash bill                                                                |
| Alt+A      | New Account bill                                                             |
| Alt+P      | New purchase                                                                 |
| Alt+R      | Record payment                                                               |
| Ctrl+Enter | Save the current document                                                    |
| Ctrl+S     | Save as draft (bill)                                                         |
| Alt+L      | Add a line (bill and purchase grids)                                         |
| Alt+D      | Remove the current line (Ctrl+Delete would clash with delete-word in inputs) |
| F4         | Open the picker for the current cell (item, unit, location)                  |
| Esc        | Close the picker, then the dialog, then leave the grid                       |
| ?          | Show all shortcuts                                                           |

Avoid shortcuts the browser reserves (Ctrl+N, Ctrl+T, Ctrl+W). Freeze this map before staff training, because changing it later breaks habits.

## 8. Key screen patterns

### 8.1 Bill entry (the most important screen)

- **Header row:** bill type (shown as a band), customer search with quick-add, place of supply, date, vehicle number. The customer's balance and credit limit are visible as soon as the customer is chosen.
- **Line grid:** item search (by name, category or attribute; results show stock per location), unit, location (Cash bills only), quantity, rate (with hints: last rate to this customer, last purchase rate, average cost, as quiet text under the field), discount, and the line total from the server.
- **Right panel (desktop) or pinned footer (phone):** charges, tax by rate, round off, the grand total in the large figure style, payments split by mode, balance due, and the effects summary (P5).
- **After saving:** stay on the saved bill, with Print, Share on WhatsApp, Copy to Account bill, and New bill (Alt+N) in focus order.

### 8.2 Registers and tables

- Use server-side paging and sorting (`page`, `page_size`, `sort`) with filters in the URL. Show the total count.
- Allow column choice per user, stored locally.
- Each table has a totals row for its money columns, using the totals the server returns where it provides them. Never sum in the browser.
- Exports (Excel/PDF) run as jobs, with progress and a download link when they finish.

### 8.3 Dashboard

- Every number leads to an action or a filtered list. "Low stock: 14" opens the filtered inventory with "Create purchase" and "Transfer" actions (FR-DB-02).
- The "Pending work" area (e-invoice failures, returns to approve, unsynced Tally exports) comes first for the Super Admin.
- At most two charts per view. Label them directly, use no 3D or donut gimmicks, and include a table fallback.

## 9. Words

- Buttons name the action and the object: "Save Cash bill", "Record payment", "Approve return". Never "Submit" or "OK".
- Errors say what happened and what to do: "Only 12 bags at Shop. Godown 1 has 40. Take from Godown 1?"
- Use sentence case everywhere. No exclamation marks or emoji.
- Use the glossary from the PRD (section 1.3) exactly. The printed document heading says "Tax Invoice". The app calls it a "bill".

## 10. PR review checklist (UI)

- [ ] Works with the keyboard only (desktop) and at 360 px wide (phone).
- [ ] Loading, empty, error and offline states handled.
- [ ] Numbers: tabular figures, right-aligned, en-IN format, no browser arithmetic.
- [ ] Actions come from `allowed_actions` and permissions. 403 is still handled.
- [ ] Problem codes mapped to fields or lines, and `request_id` shown for unknown errors.
- [ ] Nothing from section 4 is present.
- [ ] Contrast checked, labels present, focus visible.
- [ ] Keystroke count noted for frequent flows.

---

## Sources and further reading

- Requirements and HLD v2.2 (FR-BL-12, NFR-06) and API design v1 §2 and §6.5, in `backend-api/`.
- On information density and the cost of hiding complexity: [Designing for information density](https://uxdesign.cc/designing-for-information-density-69775165a18e) (UX Collective); [data-dense utilitarian UI](https://trends.daisyui.com/trend/data-dense-utilitarian-ui/).
- On why AI-built sites look alike: [Why your AI keeps building the same purple gradient website](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website); [AI slop design tells](https://www.925studios.co/blog/ai-slop-design-tells).
- On keyboard-driven POS entry: [POS shortcut keys](https://drs.kayako.com/article/132-what-shortcut-keys-can-be-used-in-pos); [Petpooja quick billing shortcuts](https://blog.petpooja.com/glossary/quick-billing-shortcut/).
- WCAG 2.2 and the WAI-ARIA Authoring Practices (grid, combobox, dialog patterns).
