import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

// pgbouncer transaction mode requires prepare:false. Connect/statement
// timeouts are critical on serverless: without them a stuck query hangs
// the entire instance until Cloud Run kills it at 300s. We'd rather
// surface a real error after 30s than show a blank gateway timeout.
const queryClient = postgres(connectionString, {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: {
    statement_timeout: 30_000,
  },
})

export const db = drizzle(queryClient, { schema })
export { schema }
export type Database = typeof db
