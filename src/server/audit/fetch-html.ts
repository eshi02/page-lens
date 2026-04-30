import 'server-only'

const FETCH_TIMEOUT_MS = 8_000
const MAX_HTML_BYTES = 800_000

const USER_AGENT = 'LandingcheckBot/1.0 (+https://landingcheck.app/about/bot)'

export type FetchResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; reason: string }

/**
 * Fetch a remote HTML page with safety rails:
 *   - timeout (8s)
 *   - max body size (≈800 KB) — reject huge responses early
 *   - rejects non-HTML content types
 *   - follows redirects, returns the final URL
 *
 * Should only be called *after* `validateUrl` from `./url-guard`.
 */
export async function fetchHtml(url: URL): Promise<FetchResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en',
      },
    })

    if (!res.ok) {
      return { ok: false, reason: `Page returned HTTP ${res.status}.` }
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { ok: false, reason: `Page returned ${contentType || 'non-HTML'} content; need HTML.` }
    }

    if (!res.body) {
      return { ok: false, reason: 'Page returned an empty response body.' }
    }

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      if (received > MAX_HTML_BYTES) {
        await reader.cancel()
        break
      }
    }

    return {
      ok: true,
      html: new TextDecoder('utf-8', { fatal: false }).decode(concat(chunks)),
      finalUrl: res.url,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (/abort/i.test(message)) {
      return { ok: false, reason: `Page took longer than ${FETCH_TIMEOUT_MS / 1000}s to respond.` }
    }
    return { ok: false, reason: `Could not fetch the page: ${message}` }
  } finally {
    clearTimeout(timer)
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
