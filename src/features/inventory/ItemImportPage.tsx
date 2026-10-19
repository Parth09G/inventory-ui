import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Download, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { JobProgress } from '@/components/shared/JobProgress'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { categoriesQuery } from '@/features/catalogue/api'
import { useJob, type Job } from '@/hooks/useJob'
import { useFieldControl } from '@/components/shared/field-context'
import { api, call } from '@/lib/api/client'
import { problemMessage } from '@/lib/api/problem'
import { saveBlob } from '@/lib/download'

/** Bulk item import from the category's Excel template (FR-IN-06, ui-plan #22). */
export function ItemImportPage() {
  const qc = useQueryClient()
  const categories = useQuery(categoriesQuery())
  const [categoryId, setCategoryId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [alert, setAlert] = useState<string | null>(null)
  const category = categories.data?.find((c) => String(c.id) === categoryId)
  const status = useJob(job?.id, job ?? undefined).data?.status

  // New items appear in the inventory as soon as the import finishes.
  useEffect(() => {
    if (status === 'succeeded') void qc.invalidateQueries({ queryKey: ['items'] })
  }, [status, qc])

  const template = useMutation({
    mutationFn: async (id: number) => {
      const { data, error, response } = await api.GET('/categories/{id}/import-template', {
        params: { path: { id } },
        parseAs: 'blob',
      })
      if (error || !response.ok || !data) throw new Error('Could not download the template.')
      return data
    },
    onSuccess: (blob) => saveBlob(blob, `${category?.name ?? 'items'} import template.xlsx`),
    onError: (e) => setAlert(problemMessage(e)),
  })

  const upload = useMutation({
    mutationFn: (args: { file: File; categoryId: number }) =>
      call(
        api.POST('/items/import', {
          body: { file: args.file as unknown as string, category_id: args.categoryId },
          bodySerializer: (b) => {
            const fd = new FormData()
            fd.append('file', b.file as unknown as File)
            fd.append('category_id', String(b.category_id))
            return fd
          },
        }),
      ),
    onSuccess: setJob,
    onError: (e) => setAlert(problemMessage(e)),
  })

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Import items"
        back={
          <Link to="/inventory" className="hover:text-ink">
            Inventory
          </Link>
        }
      />
      <ol className="grid gap-4">
        <li className="grid gap-3 rounded-lg border bg-surface p-4">
          <h2 className="font-semibold">1. Choose the category</h2>
          <p className="text-sm text-ink-muted">
            Each category has its own template, with one column per attribute.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-64">
              <Field label="Category">
                <NativeSelect
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value)
                    setJob(null)
                  }}
                >
                  <option value="">Choose a category</option>
                  {categories.data
                    ?.filter((c) => c.is_active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            </div>
            <Button
              variant="outline"
              disabled={!category || template.isPending}
              onClick={() => category && template.mutate(category.id)}
            >
              <Download className="size-4" /> Download template
            </Button>
          </div>
        </li>
        <li className="grid gap-3 rounded-lg border bg-surface p-4">
          <h2 className="font-semibold">2. Upload the filled template</h2>
          <FormAlert message={alert} />
          <Field label="Excel file (.xlsx)">
            <FileInput
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setJob(null)
                setAlert(null)
              }}
              className="text-sm file:mr-3 file:h-(--control-h) file:rounded-md file:border file:border-input file:bg-surface file:px-3 file:font-medium"
            />
          </Field>
          <p className="text-sm text-ink-muted">
            All rows are checked first. If any row has a problem, nothing is imported.
          </p>
          <div>
            <Button
              disabled={
                !file || !category || upload.isPending || (!!job && job.status !== 'failed')
              }
              onClick={() => {
                setAlert(null)
                if (file && category) upload.mutate({ file, categoryId: category.id })
              }}
            >
              <Upload className="size-4" /> Import items
            </Button>
          </div>
          {job && (
            <JobProgress
              job={job}
              done={() => (
                <span>
                  Import finished.{' '}
                  <Link
                    to="/inventory"
                    search={{ category_id: category?.id }}
                    className="text-steel hover:underline"
                  >
                    Check the {category?.name} items
                  </Link>
                </span>
              )}
            />
          )}
        </li>
      </ol>
    </div>
  )
}

/** File chooser labelled by its Field. */
function FileInput(props: React.ComponentProps<'input'>) {
  return <input type="file" {...useFieldControl(props)} />
}
