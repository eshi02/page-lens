import 'server-only'

import { db, schema } from '@/db/client'

/**
 * Idempotent profile bootstrap. Called from the auth callback on every
 * sign-in. If the row already exists we update fields that may have changed
 * (email, full_name, avatar_url); otherwise we insert.
 */
export async function ensureProfile(input: {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
}) {
  await db
    .insert(schema.profiles)
    .values({
      id: input.id,
      email: input.email,
      fullName: input.fullName,
      avatarUrl: input.avatarUrl,
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
