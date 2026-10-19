import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge, StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { formError } from '@/lib/api/forms'
import { isProblem, problemMessage } from '@/lib/api/problem'
import { dateTime } from '@/lib/format'
import { useMe } from '@/lib/permissions'
import {
  useDeactivateUser,
  useInviteUser,
  useReactivateUser,
  useResetPassword,
  useUpdateUser,
  usersQuery,
  type User,
} from './api'

const ROLE = { super_admin: 'Super Admin', admin: 'Admin' } as const
type Confirm = { kind: 'deactivate' | 'reactivate' | 'reset'; user: User }

/** Users and roles (FR-AU-02, ui-plan #39). Up to 10 accounts; at least one active Super Admin. */
export function UsersPage() {
  const users = useQuery(usersQuery())
  const me = useMe()
  const deactivate = useDeactivateUser()
  const reactivate = useReactivateUser()
  const reset = useResetPassword()
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [error, setError] = useState<string | null>(null)

  const columns: Column<User>[] = [
    { id: 'name', header: 'Name', required: true, cell: (u) => u.full_name, mobile: 'title' },
    { id: 'email', header: 'Email', cell: (u) => u.email, mobile: 'subtitle' },
    {
      id: 'role',
      header: 'Role',
      cell: (u) => (
        <Badge tone={u.role === 'super_admin' ? 'info' : 'neutral'}>{ROLE[u.role]}</Badge>
      ),
      mobile: 'meta',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (u) => (u.is_active ? null : <StatusBadge status="inactive" />),
      mobile: 'meta',
    },
    {
      id: 'last',
      header: 'Last sign-in',
      cell: (u) => (
        <span className="text-ink-muted">
          {u.last_login_at ? dateTime(u.last_login_at) : 'Never'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      required: true,
      mobile: 'meta',
      cell: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Actions for ${u.full_name}`}>
              Manage
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(u)}>
              Edit name, mobile or role
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConfirm({ kind: 'reset', user: u })}>
              Send password reset email
            </DropdownMenuItem>
            {u.is_active ? (
              <DropdownMenuItem
                disabled={u.id === me?.id}
                onSelect={() => setConfirm({ kind: 'deactivate', user: u })}
              >
                Deactivate{u.id === me?.id && ' (yourself)'}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setConfirm({ kind: 'reactivate', user: u })}>
                Reactivate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn()
      toast.success(done)
      setConfirm(null)
      setError(null)
    } catch (e) {
      setError(
        isProblem(e, 'CONFLICT') || isProblem(e, 'INVALID_STATE')
          ? 'At least one active Super Admin must remain.'
          : problemMessage(e),
      )
    }
  }
  const c = confirm
  return (
    <div className="grid gap-3">
      <PageHeader
        title="Users"
        meta="Accounts are created by invitation; there is no public sign-up."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Invite user
          </Button>
        }
      />
      <DataTable
        label="Users"
        columns={columns}
        rows={users.data}
        rowKey={(u) => u.id}
        isLoading={users.isLoading}
        error={users.error}
        onRetry={() => void users.refetch()}
        empty="No users."
        rowClassName={(u) => (u.is_active ? undefined : 'text-ink-muted')}
      />
      {editing && (
        <UserDialog
          user={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!c}
        onOpenChange={(o) => !o && (setConfirm(null), setError(null))}
        title={
          c?.kind === 'deactivate'
            ? `Deactivate ${c.user.full_name}?`
            : c?.kind === 'reactivate'
              ? `Reactivate ${c.user.full_name}?`
              : `Send a password reset to ${c?.user.email}?`
        }
        effect={
          c?.kind === 'deactivate'
            ? 'They are signed out on their next action and cannot sign in. Their history stays.'
            : c?.kind === 'reactivate'
              ? 'They can sign in again with their existing password.'
              : 'They get an email with a link to set a new password.'
        }
        confirmLabel={
          c?.kind === 'deactivate'
            ? 'Deactivate user'
            : c?.kind === 'reactivate'
              ? 'Reactivate user'
              : 'Send email'
        }
        danger={c?.kind === 'deactivate'}
        error={error}
        pending={deactivate.isPending || reactivate.isPending || reset.isPending}
        onConfirm={() => {
          if (!c) return
          if (c.kind === 'deactivate')
            void run(() => deactivate.mutateAsync(c.user.id), `${c.user.full_name} deactivated`)
          else if (c.kind === 'reactivate')
            void run(() => reactivate.mutateAsync(c.user.id), `${c.user.full_name} reactivated`)
          else
            void run(() => reset.mutateAsync(c.user.id), `Password reset sent to ${c.user.email}`)
        }}
      />
    </div>
  )
}

const schema = z.object({
  full_name: z.string().trim().min(1, 'Enter the name'),
  email: z.email('Enter a valid email address'),
  mobile: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^$|^\d{10}$/, 'Enter a 10-digit mobile number')),
  role: z.enum(['super_admin', 'admin']),
})

function UserDialog({ user, onClose }: { user?: User; onClose: () => void }) {
  const invite = useInviteUser()
  const update = useUpdateUser()
  const [alert, setAlert] = useState<string | null>(null)
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
      mobile: user?.mobile ?? '',
      role: user?.role ?? 'admin',
    },
  })
  const e = form.formState.errors
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.full_name}` : 'Invite user'}</DialogTitle>
          {!user && <DialogDescription>They get an email to set their password.</DialogDescription>}
        </DialogHeader>
        <form
          id="user-form"
          noValidate
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (v) => {
            try {
              if (user)
                await update.mutateAsync({
                  id: user.id,
                  body: { full_name: v.full_name, mobile: v.mobile || undefined, role: v.role },
                })
              else await invite.mutateAsync({ ...v, mobile: v.mobile || undefined })
              toast.success(user ? `${v.full_name} saved` : `Invitation sent to ${v.email}`)
              onClose()
            } catch (err) {
              setAlert(
                isProblem(err, 'CONFLICT') && user
                  ? 'At least one active Super Admin must remain.'
                  : formError(err, form.setError, {
                      duplicateField: 'email',
                      duplicateMessage: 'A user with this email already exists',
                    }),
              )
            }
          })}
        >
          <FormAlert message={alert} />
          <Field label="Name" error={e.full_name?.message}>
            <Input autoFocus {...form.register('full_name')} />
          </Field>
          <Field label="Email" error={e.email?.message}>
            <Input type="email" disabled={!!user} {...form.register('email')} />
          </Field>
          <Field label="Mobile" error={e.mobile?.message}>
            <Input type="tel" {...form.register('mobile')} />
          </Field>
          <Field
            label="Role"
            hint="Super Admins can edit and cancel saved bills, approve returns and change settings."
          >
            <NativeSelect {...form.register('role')}>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </NativeSelect>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={invite.isPending || update.isPending}>
            {user ? 'Save user' : 'Send invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
