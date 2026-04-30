import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

/**
 * Singleton postgres client. We disable prepared statements because the
 * project is deployed to a serverless runtime where each invocation gets
 * a fresh connection pool — prepared statements would leak resources.
 */
const queryClient = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
})

export const db = drizzle(queryClient, { schema })
export { schema }
export type Database = typeof db
