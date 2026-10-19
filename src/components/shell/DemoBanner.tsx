/** Shown only in demo mode, so nobody mistakes mock data for the shop's books. */
export function DemoBanner() {
  if (import.meta.env.VITE_DEMO !== 'true') return null
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-3 bg-ink px-4 py-1 text-center text-xs text-white print:hidden"
    >
      <span>
        Demo mode – sample data kept in this browser. Sign in as <strong>owner@shop.test</strong>{' '}
        (Super Admin) or <strong>counter@shop.test</strong> (Admin) with any password.
      </span>
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={() => void import('@/mocks/start').then((m) => m.resetDemo())}
      >
        Reset demo data
      </button>
    </div>
  )
}
