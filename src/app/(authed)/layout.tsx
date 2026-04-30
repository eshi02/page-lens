import { redirect } from 'next/navigation'

import { TopBar } from '@/components/landing/top-bar'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Middleware already redirects unauth'd users; this is the second
  // line of defense (defense in depth).
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in?next=/dashboard')
  }

  return (
    <div className="flex min-h-svh flex-col">
      <TopBar
        user={{
          email: user.email ?? '',
          fullName: user.user_metadata?.full_name ?? null,
          avatarUrl: user.user_metadata?.avatar_url ?? null,
        }}
      />
      <div className="flex-1">{children}</div>
    </div>
  )
}
