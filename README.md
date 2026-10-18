# Billing & Inventory — web app

React + TypeScript UI for the billing and inventory API in [`../backend-api`](../backend-api).

- How the UI should look and behave: [design.md](design.md)
- Why the stack and patterns were chosen: [decisions.md](decisions.md)

## Setup

```bash
nvm use                      # Node 24
npm install
cp .env.example .env.local   # fill in the Supabase anon key
npm run dev                  # http://localhost:5173
```

The API must be running (see `backend-api/README.md`).

## Scripts

| Script                                  | What                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run gen:api`                       | Regenerate `src/lib/api/schema.d.ts` from `../backend-api/openapi.yaml`          |
| `npm run typecheck` · `lint` · `format` | Checks                                                                           |
| `npm test`                              | Vitest unit/component tests                                                      |
| `npm run test:e2e`                      | Playwright (desktop + 360 px phone); first run `npx playwright install chromium` |
| `npm run build`                         | Production build to `dist/`                                                      |
