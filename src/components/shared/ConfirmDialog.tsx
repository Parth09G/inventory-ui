import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FormAlert } from './FormAlert'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** What will happen, in plain words (design P10). */
  effect: ReactNode
  /** Names the action: "Deactivate category", never "OK". */
  confirmLabel: string
  onConfirm: () => void
  pending?: boolean
  danger?: boolean
  error?: string | null
  children?: ReactNode
}

export function ConfirmDialog(p: Props) {
  return (
    <AlertDialog open={p.open} onOpenChange={p.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{p.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-ink">{p.effect}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FormAlert message={p.error} />
        {p.children}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep as is</AlertDialogCancel>
          <Button
            variant={p.danger ? 'destructive' : 'default'}
            disabled={p.pending}
            onClick={p.onConfirm}
          >
            {p.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
