'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  sendMagicLink,
  signInWithGoogle,
  type SignInState,
} from '@/server/actions/auth'

const initial: SignInState = {}

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(sendMagicLink, initial)

  return (
    <div className="flex w-full flex-col gap-6">
      <form action={signInWithGoogle} className="contents">
        <input type="hidden" name="next" value={next} />
        <GoogleButton />
      </form>

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

function GoogleButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      variant="outline"
      disabled={pending}
      className="w-full gap-2"
    >
      <GoogleLogo aria-hidden />
      {pending ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  )
}

function GoogleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      role="presentation"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.65 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.94 3.4 14.7 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12s4.26 9.5 9.5 9.5c5.49 0 9.13-3.86 9.13-9.27 0-.62-.07-1.1-.16-1.57H12z"
      />
    </svg>
  )
}
