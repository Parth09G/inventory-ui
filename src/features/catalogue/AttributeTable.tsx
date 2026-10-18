import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import type { AttributeValues } from './category-form'

const TYPE = { text: 'Text', number: 'Number', select: 'Pick-list' }

type Props = {
  attributes: AttributeValues[]
  onEdit: (index: number) => void
  onMove: (index: number, dir: -1 | 1) => void
  onDelete?: (index: number) => void
}

/** Ordered attribute list; buttons reorder (keyboard-friendly, no drag needed). */
export function AttributeTable({ attributes, onEdit, onMove, onDelete }: Props) {
  if (!attributes.length)
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-ink-muted">
        No attributes yet. Most categories have Brand and Size.
      </p>
    )
  return (
    <ol className="grid divide-y rounded-lg border bg-surface" aria-label="Attributes">
      {attributes.map((a, i) => (
        <li key={a.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className="w-5 text-right text-sm text-ink-faint tabular">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {a.label}
              {a.value_unit && (
                <span className="ml-1 font-normal text-ink-muted">({a.value_unit})</span>
              )}
            </p>
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
              <span className="code">{a.code}</span>·<span>{TYPE[a.data_type]}</span>
              {a.data_type === 'select' && <span className="truncate">: {a.options}</span>}
              {a.is_required && <Badge>Required</Badge>}
              {a.part_of_name && <Badge tone="info">In name</Badge>}
            </p>
          </div>
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${a.label} up`}
              disabled={i === 0}
              onClick={() => onMove(i, -1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${a.label} down`}
              disabled={i === attributes.length - 1}
              onClick={() => onMove(i, 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${a.label}`}
              onClick={() => onEdit(i)}
            >
              <Pencil className="size-4" />
            </Button>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${a.label}`}
                onClick={() => onDelete(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
