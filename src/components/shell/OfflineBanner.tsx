import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/** design P9: saving is disabled offline; forms stay editable. */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div
      role="status"
      className="flex items-center gap-2 bg-warning px-4 py-1.5 text-sm font-medium text-white"
    >
      <WifiOff className="size-4" aria-hidden />
      Offline – billing needs internet. You can keep typing; saving is paused.
    </div>
  )
}
