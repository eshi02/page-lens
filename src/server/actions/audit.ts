'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { runAudit, type RunAuditResult } from '@/server/audit/run-audit'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const inputSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'URL is required.')
    .max(2048, 'URL is too long.')
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`)),
})

/**
 * Public Server Action exposed to the dashboard.
 *
 * Auth is enforced inside the action (defense in depth — middleware
 * already gates /dashboard but the action could be called from anywhere
 * once a path is known).
 */
export async function runAuditAction(input: { url: string }): Promise<RunAuditResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid-url',
      error: parsed.error.issues[0]?.message ?? 'Invalid URL.',
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, code: 'invalid-url', error: 'You must be signed in to run an audit.' }
  }

  const result = await runAudit(user.id, parsed.data.url)

  if (result.ok) {
    revalidatePath('/dashboard')
    revalidatePath('/audits')
  }

  return result
}
