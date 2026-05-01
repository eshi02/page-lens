import 'server-only'

import { db, schema } from '@/db/client'

const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

/**
 * Idempotent profile bootstrap. Called from the auth callback on every
 * sign-in. If the row already exists we update fields that may have changed
 * (email, full_name, avatar_url); otherwise we insert.
 *
 * On first insert we also stamp trial_ends_at = now + 14 days. During
 * trial the user is on the Free plan but with a daily quota (3/day)
 * instead of the post-trial monthly cap (3/30 days). The conflict path
 * leaves trial_ends_at alone — re-signing in does not refresh the trial.
 */
export async function ensureProfile(input: {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
}) {
  const trialEndsAt = new Date(Date.now() + TRIAL_LENGTH_MS)

  await db
    .insert(schema.profiles)
    .values({
      id: input.id,
      email: input.email,
      fullName: input.fullName,
      avatarUrl: input.avatarUrl,
      trialEndsAt,
    })
    .onConflictDoUpdate({
      target: schema.profiles.id,
      set: {
        email: input.email,
        fullName: input.fullName,
        avatarUrl: input.avatarUrl,
        updatedAt: new Date(),
      },
    })
}
