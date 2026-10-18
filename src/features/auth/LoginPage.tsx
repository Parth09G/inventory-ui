import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Field } from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isProblem, problemMessage } from '@/lib/api/problem'
import { supabase } from '@/lib/auth/supabase'
import { meQuery } from './api'

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
type Values = z.infer<typeof schema>

const REASONS = {
  expired: 'Your session ended. Sign in again.',
  removed: 'Your access was removed. Ask the owner if this is a mistake.',
}

export function LoginPage() {
  const search = useSearch({ from: '/_public/login' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(search.reason ? REASONS[search.reason] : null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword(values)
    if (authError) {
      setError(
        authError.status === 400 || authError.status === 401
          ? 'Email or password is incorrect.'
          : 'Could not sign in. Check the internet connection and try again.',
      )
      return
    }
    try {
      await queryClient.fetchQuery(meQuery())
    } catch (e) {
      await supabase.auth.signOut()
      setError(isProblem(e) && e.status === 401 ? REASONS.removed : problemMessage(e))
      return
    }
    await navigate({ href: search.redirect ?? '/', replace: true })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-danger"
        >
          {error}
        </p>
      )}
      <Field label="Email" error={form.formState.errors.email?.message}>
        <Input type="email" autoComplete="username" autoFocus {...form.register('email')} />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...form.register('password')} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting} className="mt-1">
        {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
      <Link to="/forgot-password" className="text-sm text-steel underline-offset-4 hover:underline">
        Forgot password?
      </Link>
      <p className="text-sm text-ink-muted">
        Accounts are created by the owner. There is no public sign-up.
      </p>
    </form>
  )
}
