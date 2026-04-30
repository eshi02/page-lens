import 'server-only'

import { eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type { Plan } from '@/db/schema'

export type PlanSlug = 'free' | 'pro' | 'agency'

export async function getPlanBySlug(slug: PlanSlug): Promise<Plan | null> {
  const [row] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.slug, slug))
    .limit(1)
  return row ?? null
}

export async function listPlans(): Promise<Plan[]> {
  return db.select().from(schema.plans)
}
