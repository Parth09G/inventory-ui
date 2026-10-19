/** Starts the in-browser mock API for demo mode (npm run demo). Never imported in production. */
export async function startDemo() {
  const { network } = await import('virtual:msw')
  const { handlers } = await import('./handlers')
  const { saveDb } = await import('./db')
  // Requests the demo does not mock (Vite's own files, fonts) go to the network as usual.
  network.configure({ handlers, onUnhandledFrame: 'bypass' })
  await network.enable()
  // Keep what was entered across refreshes and closed tabs.
  window.addEventListener('pagehide', saveDb)
  document.addEventListener(
    'visibilitychange',
    () => document.visibilityState === 'hidden' && saveDb(),
  )
}

/** Clears the demo data and reloads with the original sample data. */
export async function resetDemo() {
  const { resetDb } = await import('./db')
  window.removeEventListener('pagehide', (await import('./db')).saveDb)
  resetDb()
  // Reload without letting pagehide save the old data again.
  window.addEventListener('pagehide', resetDb)
  window.location.reload()
}
