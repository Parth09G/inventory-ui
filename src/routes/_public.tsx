import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Signed-out pages: a plain column, no marketing (design §2). */
export const Route = createFileRoute('/_public')({
  component: () => (
    <div className="min-h-dvh bg-paper">
      <header className="px-4 py-4 sm:px-6">
        <p className="text-sm font-semibold tracking-wide text-ink uppercase">
          Billing &amp; Inventory
        </p>
      </header>
      <main className="mx-auto w-full max-w-sm px-4 pt-[8vh] pb-16 sm:px-0">
        <Outlet />
      </main>
    </div>
  ),
})
