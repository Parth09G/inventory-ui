import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Field } from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/auth/supabase'

const schema = z.object({ email: z.email('Enter a valid email address') })

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit(async ({ email }) => {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    })
    // Same message whether or not the account exists.
    setSentTo(email)
  })

  if (sentTo)
    return (
      <div className="grid gap-3">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p role="status">
          If an account exists for <strong>{sentTo}</strong>, we have sent a link to set a new
          password.
        </p>
        <Link
          to="/login"
          className="text-sm text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
        >
          Back to sign in
        </Link>
      </div>
    )

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <h1 className="text-xl font-semibold">Forgot password</h1>
      <p className="text-ink-muted">Enter your email. We will send a link to set a new password.</p>
      <Field label="Email" error={form.formState.errors.email?.message}>
        <Input type="email" autoComplete="username" autoFocus {...form.register('email')} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Send link
      </Button>
      <Link
        to="/login"
        className="text-sm text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
      >
        Back to sign in
      </Link>
    </form>
  )
}
