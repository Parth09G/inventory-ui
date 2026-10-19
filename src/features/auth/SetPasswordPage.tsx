import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Field } from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/auth/supabase'

// Matches the Supabase Auth policy in backend-api/supabase/config.toml.
const schema = z
  .object({
    password: z
      .string()
      .min(10, 'At least 10 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/\d/, 'Include a digit'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'The passwords do not match',
  })

export function SetPasswordPage() {
  const navigate = useNavigate()
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  // Invite and recovery links sign the user in through the URL (detectSessionInUrl).
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session))
  }, [])

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null)
    const { error: e } = await supabase.auth.updateUser({ password })
    if (e) {
      setError(e.message)
      return
    }
    await navigate({ to: '/', replace: true })
  })

  if (hasSession === null) return null
  if (!hasSession)
    return (
      <div className="grid gap-3">
        <h1 className="text-xl font-semibold">Link expired</h1>
        <p>This link has expired or was already used.</p>
        <Link
          to="/forgot-password"
          className="text-sm text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
        >
          Send a new link
        </Link>
      </div>
    )

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <h1 className="text-xl font-semibold">Set your password</h1>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-danger"
        >
          {error}
        </p>
      )}
      <Field
        label="New password"
        error={form.formState.errors.password?.message}
        hint="At least 10 characters, with upper and lower case letters and a digit."
      >
        <Input
          type="password"
          autoComplete="new-password"
          autoFocus
          {...form.register('password')}
        />
      </Field>
      <Field label="Confirm password" error={form.formState.errors.confirm?.message}>
        <Input type="password" autoComplete="new-password" {...form.register('confirm')} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Save password
      </Button>
    </form>
  )
}
