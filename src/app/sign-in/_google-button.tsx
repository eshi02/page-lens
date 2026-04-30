'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { signInWithGoogleIdToken } from '@/server/actions/auth'

type GsiCredential = { credential: string }

type GsiAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GsiCredential) => void
    ux_mode?: 'popup' | 'redirect'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      logo_alignment?: 'left' | 'center'
      width?: number | string
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GsiAccountsId } }
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

export function GoogleIdButton({ next }: { next: string }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [pending, setPending] = useState(false)

  const onCredential = useCallback(
    async ({ credential }: GsiCredential) => {
      setError(null)
      setPending(true)
      try {
        const result = await signInWithGoogleIdToken({
          idToken: credential,
          next,
        })
        if (!result.ok) {
          setError(result.error)
          setPending(false)
          return
        }
        router.replace(result.next)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed.')
        setPending(false)
      }
    },
    [next, router],
  )

  useEffect(() => {
    if (!scriptReady || !CLIENT_ID || !containerRef.current) return
    const accountsId = window.google?.accounts?.id
    if (!accountsId) return

    accountsId.initialize({
      client_id: CLIENT_ID,
      callback: onCredential,
      ux_mode: 'popup',
      cancel_on_tap_outside: true,
    })
    accountsId.renderButton(containerRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 320,
    })
  }, [scriptReady, onCredential])

  if (!CLIENT_ID) {
    return (
      <div className="w-full rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
        Google sign-in is disabled — set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>.
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div
        ref={containerRef}
        className="flex h-[44px] w-full items-center justify-center"
        aria-busy={pending}
      />
      {error ? (
        <p className="text-center text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
