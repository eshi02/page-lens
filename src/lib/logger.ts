import 'server-only'

/**
 * Tiny structured logger that writes JSON to stdout. Google Cloud Run
 * captures stdout/stderr and forwards to Cloud Logging, where the JSON
 * payload is auto-parsed into structured fields.
 *
 * The `severity` field maps to Cloud Logging severity levels and is
 * what Error Reporting groups by. Stack traces in `error` are picked
 * up automatically by Error Reporting.
 *
 * Why not console.error directly?
 *   - Cloud Logging treats raw stderr as plain text — no fields to filter on
 *   - Error Reporting groups by stack trace, but we want to attach
 *     context (user_id, audit_id, route) for triage
 *   - This file is one place to add log shipping later if needed
 */

export type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

type Fields = Record<string, unknown>

function emit(severity: Severity, message: string, fields: Fields = {}) {
  const entry: Record<string, unknown> = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  }
  // Cloud Logging recommends `message` for the human string and
  // top-level fields for everything else. Stringify once.
  const line = JSON.stringify(entry)
  if (severity === 'ERROR' || severity === 'CRITICAL') {
    process.stderr.write(`${line}\n`)
  } else {
    process.stdout.write(`${line}\n`)
  }
}

function serializeError(err: unknown): Fields {
  if (err instanceof Error) {
    return {
      error: {
        name: err.name,
        message: err.message,
        // Stack is what Error Reporting uses for grouping. Keep newlines.
        stack: err.stack,
      },
    }
  }
  return { error: String(err) }
}

export const log = {
  debug(message: string, fields?: Fields) {
    if (process.env.NODE_ENV !== 'production') {
      emit('DEBUG', message, fields)
    }
  },
  info(message: string, fields?: Fields) {
    emit('INFO', message, fields)
  },
  warn(message: string, fields?: Fields) {
    emit('WARNING', message, fields)
  },
  error(message: string, err?: unknown, fields?: Fields) {
    emit('ERROR', message, { ...fields, ...(err ? serializeError(err) : {}) })
  },
  critical(message: string, err?: unknown, fields?: Fields) {
    emit('CRITICAL', message, { ...fields, ...(err ? serializeError(err) : {}) })
  },
}
