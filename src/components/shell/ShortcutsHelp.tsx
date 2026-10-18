import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// design.md §7. Keep in sync with the handlers in AppShell and the document screens.
const SHORTCUTS: [string, string][] = [
  ['Ctrl+K', 'Search and commands'],
  ['Alt+N', 'New Cash bill'],
  ['Alt+A', 'New Account bill'],
  ['Alt+P', 'New purchase'],
  ['Alt+R', 'Record payment'],
  ['Ctrl+Enter', 'Save the current document'],
  ['Ctrl+S', 'Save as draft (bill)'],
  ['Alt+L', 'Add a line'],
  ['Alt+D', 'Remove the current line'],
  ['F4', 'Open the picker for the current cell'],
  ['Esc', 'Close the picker, then the dialog'],
  ['?', 'Show this list'],
]

export function ShortcutsHelp({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>These work anywhere in the app unless noted.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
          {SHORTCUTS.map(([k, label]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="rounded-sm border bg-surface-sunken px-1.5 py-0.5 code text-xs">
                  {k}
                </kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
