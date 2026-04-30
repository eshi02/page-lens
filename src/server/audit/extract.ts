import 'server-only'

import * as cheerio from 'cheerio'

const MAX_BODY_TEXT_CHARS = 6_000
const MAX_HEADINGS = 30
const MAX_CTAS = 20
const MAX_NAV_LINKS = 15

const CTA_PATTERN = /\b(sign\s?up|start|try|get|book|buy|join|subscribe|register|demo|free|download|contact|learn\s?more|see\s?(plans|pricing)|create\s?account|request|schedule)\b/i

export type Extracted = {
  url: string
  title: string
  metaDescription: string
  ogTitle: string
  ogDescription: string
  viewport: string
  headings: string[]
  ctas: string[]
  navLinks: string[]
  bodyText: string
}

/**
 * Pull the bits a CRO consultant would actually look at, drop everything
 * else. Keeping the prompt tight is the cheapest cost-saver — Gemini bills
 * by token.
 */
export function extractFromHtml(html: string, url: string): Extracted {
  const $ = cheerio.load(html)

  $('script, style, noscript, iframe, svg').remove()

  const title = $('title').text().trim().slice(0, 200)
  const metaDescription = ($('meta[name="description"]').attr('content') ?? '').trim().slice(0, 300)
  const ogTitle = ($('meta[property="og:title"]').attr('content') ?? '').trim().slice(0, 200)
  const ogDescription = ($('meta[property="og:description"]').attr('content') ?? '').trim().slice(0, 300)
  const viewport = ($('meta[name="viewport"]').attr('content') ?? '').trim().slice(0, 200)

  const headings: string[] = []
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text && text.length < 200) {
      headings.push(`${(el as { tagName?: string }).tagName?.toUpperCase() ?? 'H'}: ${text}`)
    }
    return headings.length < MAX_HEADINGS
  })

  const ctas = new Set<string>()
  $('a, button').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (
      text &&
      text.length >= 2 &&
      text.length < 60 &&
      CTA_PATTERN.test(text)
    ) {
      ctas.add(text)
    }
    return ctas.size < MAX_CTAS
  })

  const navLinks = new Set<string>()
  $('nav a, header a').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text && text.length < 30) navLinks.add(text)
    return navLinks.size < MAX_NAV_LINKS
  })

  const bodyText = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BODY_TEXT_CHARS)

  return {
    url,
    title,
    metaDescription,
    ogTitle,
    ogDescription,
    viewport,
    headings: headings.slice(0, MAX_HEADINGS),
    ctas: Array.from(ctas),
    navLinks: Array.from(navLinks),
    bodyText,
  }
}

/**
 * Format the extracted content as a single chat message. Kept compact so
 * the entire prompt + response stays well under any model's context limit.
 */
export function renderForPrompt(e: Extracted): string {
  return [
    `URL: ${e.url}`,
    '',
    `<title>: ${e.title || '(none)'}`,
    `<meta description>: ${e.metaDescription || '(none)'}`,
    `<og:title>: ${e.ogTitle || '(none)'}`,
    `<og:description>: ${e.ogDescription || '(none)'}`,
    `<viewport>: ${e.viewport || '(none)'}`,
    '',
    'Headings:',
    e.headings.join('\n') || '(none)',
    '',
    'Detected CTAs:',
    e.ctas.join(' | ') || '(none)',
    '',
    'Nav links:',
    e.navLinks.join(' | ') || '(none)',
    '',
    `Visible body text (first ~${MAX_BODY_TEXT_CHARS} chars):`,
    e.bodyText || '(none)',
  ].join('\n')
}
