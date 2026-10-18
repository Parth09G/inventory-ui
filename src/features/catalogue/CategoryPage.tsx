import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormAlert } from '@/components/shared/FormAlert'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { formError } from '@/lib/api/forms'
import { isProblem, problemMessage } from '@/lib/api/problem'
import { useCan } from '@/lib/permissions'
import {
  categoryQuery,
  useDeactivateCategory,
  useDeleteAttribute,
  useSaveAttribute,
  useSaveCategory,
  type Category,
} from './api'
import { AttributeDialog } from './AttributeDialog'
import { AttributeTable } from './AttributeTable'
import { CategoryBasics } from './CategoryBasics'
import {
  categorySchema,
  fromCategory,
  toAttributeInput,
  toCategoryInput,
  type CategoryValues,
} from './category-form'
import { UnitsPicker } from './UnitsPicker'

/** Edit an existing category: details and units are one form; attributes save one by one. */
export function CategoryPage({ id }: { id: number }) {
  const { data: category } = useQuery(categoryQuery(id))
  if (!category) return null
  return <CategoryEditor key={category.id} category={category} />
}

function CategoryEditor({ category }: { category: Category }) {
  const navigate = useNavigate()
  const canManage = useCan('catalogue.manage')
  const canDeactivate = useCan('category.deactivate')
  const canDeleteAttr = useCan('attribute.delete')
  const save = useSaveCategory()
  const saveAttr = useSaveAttribute(category.id)
  const deleteAttr = useDeleteAttribute(category.id)
  const deactivate = useDeactivateCategory()
  const [alert, setAlert] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: fromCategory(category),
  })
  const sorted = [...(category.attributes ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const attributes = fromCategory(category).attributes

  const onSubmit = form.handleSubmit(async (v) => {
    setAlert(null)
    try {
      await save.mutateAsync({ id: category.id, body: toCategoryInput(v, false) })
      form.reset(v)
      toast.success('Category saved')
    } catch (e) {
      setAlert(
        formError(e, form.setError, {
          duplicateField: 'name',
          duplicateMessage: 'A category with this name already exists',
        }),
      )
    }
  })

  const move = async (i: number, dir: -1 | 1) => {
    const a = sorted[i]!
    const b = sorted[i + dir]!
    try {
      await saveAttr.mutateAsync({
        attrId: a.id,
        body: toAttributeInput(attributes[i]!, i + dir + 1),
      })
      await saveAttr.mutateAsync({
        attrId: b.id,
        body: toAttributeInput(attributes[i + dir]!, i + 1),
      })
    } catch (e) {
      toast.error(problemMessage(e))
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title={category.name}
        meta={
          <span className="flex items-center gap-2">
            {category.item_count ?? 0} items{' '}
            {!category.is_active && <StatusBadge status="inactive" />}
          </span>
        }
        back={
          <Link to="/catalogue/categories" className="hover:text-ink">
            Categories
          </Link>
        }
        actions={
          canDeactivate &&
          category.is_active && (
            <Button variant="outline" onClick={() => setConfirmDeactivate(true)}>
              Deactivate
            </Button>
          )
        }
      />

      <form
        onSubmit={onSubmit}
        noValidate
        className="grid gap-5 rounded-lg border bg-surface p-4 sm:p-5"
      >
        <h2 className="text-lg font-semibold">Details and units</h2>
        <FormAlert message={alert} />
        <fieldset disabled={!canManage} className="grid gap-5">
          <CategoryBasics form={form} excludeId={category.id} />
          <UnitsPicker
            value={form.watch('units')}
            onChange={(u) =>
              form.setValue('units', u, {
                shouldDirty: true,
                shouldValidate: form.formState.isSubmitted,
              })
            }
            error={
              form.formState.errors.units?.message ?? form.formState.errors.units?.root?.message
            }
          />
        </fieldset>
        {canManage && (
          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={!form.formState.isDirty || save.isPending}>
              Save category
            </Button>
          </div>
        )}
      </form>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Attributes</h2>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Add attribute
            </Button>
          )}
        </div>
        <AttributeTable
          attributes={attributes}
          onEdit={setEditing}
          onMove={(i, d) => void move(i, d)}
          onDelete={canDeleteAttr ? setDeleting : undefined}
        />
      </section>

      {editing !== null && (
        <AttributeDialog
          initial={editing === 'new' ? undefined : attributes[editing]}
          takenCodes={attributes.filter((_, i) => i !== editing).map((a) => a.code)}
          onSave={async (v) => {
            try {
              await saveAttr.mutateAsync({
                attrId: editing === 'new' ? undefined : sorted[editing]!.id,
                body: toAttributeInput(v, editing === 'new' ? attributes.length + 1 : editing + 1),
              })
              toast.success(
                editing === 'new' ? `Attribute ${v.label} added` : `Attribute ${v.label} saved`,
              )
            } catch (e) {
              return problemMessage(e)
            }
          }}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && (setDeleting(null), setActionError(null))}
        title={`Remove attribute ${deleting !== null ? attributes[deleting]?.label : ''}?`}
        effect="It can be removed only while no item uses it. Items keep their history either way."
        confirmLabel="Remove attribute"
        danger
        pending={deleteAttr.isPending}
        error={actionError}
        onConfirm={async () => {
          try {
            await deleteAttr.mutateAsync(sorted[deleting!]!.id)
            setDeleting(null)
            toast.success('Attribute removed')
          } catch (e) {
            setActionError(
              isProblem(e, 'CONFLICT') || isProblem(e, 'INVALID_STATE')
                ? 'Items use this attribute, so it cannot be removed.'
                : problemMessage(e),
            )
          }
        }}
      />
      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={(o) => !o && (setConfirmDeactivate(false), setActionError(null))}
        title={`Deactivate ${category.name}?`}
        effect="It disappears from new items and billing searches. Its history stays. Only categories with no active items can be deactivated."
        confirmLabel="Deactivate category"
        danger
        pending={deactivate.isPending}
        error={actionError}
        onConfirm={async () => {
          try {
            await deactivate.mutateAsync(category.id)
            toast.success(`${category.name} deactivated`)
            await navigate({ to: '/catalogue/categories' })
          } catch (e) {
            setActionError(
              isProblem(e, 'INVALID_STATE') || isProblem(e, 'CONFLICT')
                ? 'This category still has active items. Deactivate or move them first.'
                : problemMessage(e),
            )
          }
        }}
      />
    </div>
  )
}
