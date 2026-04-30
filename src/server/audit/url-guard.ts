import 'server-only'

import { lookup } from 'node:dns/promises'

/**
 * SSRF guard for user-supplied URLs.
 *
 * URL-fetching apps are the #1 SSRF surface — a user can submit any URL
 * and the server fetches it. Without this guard a malicious user could
 * point us at internal services (cloud metadata at 169.254.169.254,
 * the local Postgres at 127.0.0.1:5432, etc.) and exfiltrate secrets
 * via the audit response.
 *
 * Rules:
 *   - http(s) only
 *   - No userinfo (foo:bar@host)
 *   - No non-default ports
 *   - DNS lookup → reject if any resolved address is private
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const ALLOWED_PORTS = new Set(['', '80', '443'])

const PRIVATE_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata',
])

export type GuardResult = { ok: true; url: URL } | { ok: false; reason: string }

export function quickValidateUrl(input: string): GuardResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, reason: 'URL is empty.' }
  if (trimmed.length > 2048) return { ok: false, reason: 'URL is too long.' }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'Not a valid URL.' }
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: `Only http(s) URLs are allowed, got ${url.protocol}` }
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'URLs with credentials are not allowed.' }
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: `Custom ports are not allowed (got ${url.port}).` }
  }

  const host = url.hostname.toLowerCase()
  if (PRIVATE_HOSTNAMES.has(host)) {
    return { ok: false, reason: 'Local addresses are not allowed.' }
  }

  return { ok: true, url }
}

/**
 * Network-level guard: resolve the hostname and reject if any address
 * is in a private range. Run *after* `quickValidateUrl`.
 */
export async function dnsResolveSafe(url: URL): Promise<GuardResult> {
  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(url.hostname, { all: true })
  } catch {
    return { ok: false, reason: `Could not resolve ${url.hostname}.` }
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) {
      return { ok: false, reason: `${url.hostname} resolves to a private address.` }
    }
    if (family === 6 && isPrivateIPv6(address)) {
      return { ok: false, reason: `${url.hostname} resolves to a private IPv6 address.` }
    }
  }

  return { ok: true, url }
}

function isPrivateIPv4(addr: string): boolean {
  const parts = addr.split('.').map((n) => Number.parseInt(n, 10))
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true

  const [a, b] = parts
  // 0.0.0.0/8 — "this network"
  if (a === 0) return true
  // 10.0.0.0/8
  if (a === 10) return true
  // 100.64.0.0/10 — carrier-grade NAT
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true
  // 127.0.0.0/8 — loopback
  if (a === 127) return true
  // 169.254.0.0/16 — link-local (cloud metadata!)
  if (a === 169 && b === 254) return true
  // 172.16.0.0/12
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true
  // 192.0.0.0/24, 192.0.2.0/24, 192.168.0.0/16
  if (a === 192) {
    if (b === 0) return true
    if (b === 168) return true
  }
  // 198.18.0.0/15 — benchmarking
  if (a === 198 && b !== undefined && b >= 18 && b <= 19) return true
  // 224.0.0.0/4 — multicast
  if (a >= 224) return true
  return false
}

function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  // fc00::/7 — unique local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  // fe80::/10 — link-local
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true
  }
  // ff00::/8 — multicast
  if (lower.startsWith('ff')) return true
  return false
}

/**
 * Convenience: run both guards. Returns the validated URL or a reason.
 */
export async function validateUrl(input: string): Promise<GuardResult> {
  const quick = quickValidateUrl(input)
  if (!quick.ok) return quick
  return dnsResolveSafe(quick.url)
}
