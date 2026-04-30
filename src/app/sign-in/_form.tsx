'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { sendMagicLink, type SignInState } from '@/server/actions/auth'

import { GoogleIdButton } from './_google-button'

const initial: SignInState = {}

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(sendMagicLink, initial)

  return (
    <div className="flex w-full flex-col gap-6">
      <GoogleIdButton next={next} />

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        <span>or with email</span>
        <Separator className="flex-1" />
      </div>

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@yourcompany.com"
            required
            autoComplete="email"
            disabled={state.ok}
          />
        </div>

        {state.message ? (
          <div
            role="alert"
            className={`rounded-md border px-3 py-2 text-sm ${
              state.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <SubmitButton ok={state.ok} />
      </form>
    </div>
  )
}

function SubmitButton({ ok }: { ok?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending || ok} className="w-full">
      {ok ? 'Magic link sent' : pending ? 'Sending…' : 'Send magic link'}
    </Button>
  )
}
