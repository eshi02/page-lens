import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Phase 2 · Auth working
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}
        </h1>
        <p className="text-muted-foreground">Signed in as {user?.email}.</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Run an audit</CardTitle>
            <CardDescription>Coming in Phase 3 — paste a URL, get a graded report.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Backed by Gemini Vision and 30+ heuristics.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quota</CardTitle>
            <CardDescription>Free plan: 3 audits per rolling 30 days.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Upgrade to Pro for unlimited audits + saved history.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent audits</CardTitle>
            <CardDescription>Coming in Phase 4.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">No audits yet.</CardContent>
        </Card>
      </div>
    </main>
  )
}
