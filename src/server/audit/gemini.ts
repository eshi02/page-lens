import 'server-only'

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import { z } from 'zod'

import { env } from '@/lib/env'
import type { AuditIssue } from '@/db/schema'

import type { Extracted } from './extract'
import { renderForPrompt } from './extract'

const SYSTEM_PROMPT = `You are a senior conversion-rate-optimization (CRO) consultant grading a landing page for an indie SaaS or B2B founder. You receive structured content extracted from the page (no screenshots).

Score the page from 0 to 100. Be honest and specific — most pages score 40-70. Reserve 90+ for genuinely excellent pages.

Return STRICTLY a JSON object matching this shape (no markdown, no preamble, no commentary):
{
  "score": <integer 0-100>,
  "summary": "<one tight sentence calling out the biggest strength and biggest gap>",
  "issues": [
    { "key": "<kebab-case slug>", "severity": "good"|"warning"|"error", "message": "<one specific, actionable sentence>" }
  ]
}

Severity rules:
- "error" — critical conversion blocker (unclear value prop, no visible CTA, broken trust)
- "warning" — real opportunity (weak headline, missing social proof, vague CTA copy)
- "good" — something the page does well; include 2-4 of these

Cover at least 8-12 of these heuristics:
- hero-clarity — does the headline state what the product does in <5 seconds?
- headline-specificity — specific ("send 10x more emails") vs generic ("all-in-one solution")
- value-prop — is the differentiator obvious in the first viewport?
- target-audience — clear who this is for?
- cta-presence — is there a primary CTA?
- cta-copy — specific ("Start free trial") vs generic ("Submit", "Click here")
- cta-friction — implies effort (long form) or ease (one click)?
- social-proof — testimonials, customer logos, user counts, ratings present?
- social-proof-specificity — testimonials with names + companies, or anonymous?
- trust-signals — security badges, money-back guarantees, certifications?
- pricing-transparency — pricing visible or hidden behind "contact us"?
- pricing-anchor — clear price comparison or anchor?
- friction-signals — long forms, jargon, friction in copy?
- jargon — industry buzzwords without explanation?
- benefit-vs-feature — copy benefit-led ("save 5 hrs/week") or feature-led ("AI-powered analytics")?
- objection-handling — does the page address common doubts (cost, time, trust)?
- copy-clarity — short sentences, plain language?
- meta-title — is the <title> descriptive and benefit-led?
- meta-description — does it earn the click in search results?
- nav-simplicity — focused or cluttered with everything?
- visual-hierarchy — logical flow (headline → benefit → proof → CTA)?
- mobile-readiness — viewport meta tag present, responsive hints?

Issue messages must be specific and actionable. Avoid "improve copy" — instead say "The H1 'All-in-one platform' is generic; try a benefit-led version like 'Send invoices in 30 seconds'".

Output ONLY valid JSON, nothing else.`

const responseSchema = z.object({
  score: z.number().min(0).max(100).int(),
  summary: z.string().max(400),
  issues: z
    .array(
      z.object({
        key: z.string().max(80),
        severity: z.enum(['good', 'warning', 'error']),
        message: z.string().max(500),
      }),
    )
    .max(30),
})

let cachedModel: GenerativeModel | null = null

function getModel(): GenerativeModel {
  if (cachedModel) return cachedModel
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.')
  }
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  cachedModel = client.getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  })
  return cachedModel
}

export type AuditPayload = {
  score: number
  summary: string
  issues: AuditIssue[]
}

export type GeminiErrorCode = 'overloaded' | 'rate-limited' | 'invalid-output' | 'unknown'
export class GeminiError extends Error {
  constructor(
    public code: GeminiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

const RETRY_BACKOFF_MS = [800, 2000, 4000]

function classifyGeminiError(err: unknown): GeminiErrorCode {
  const msg = err instanceof Error ? err.message : String(err)
  if (/\b503\b|overload|unavailable|high demand|spike/i.test(msg)) return 'overloaded'
  if (/\b429\b|rate.?limit|quota/i.test(msg)) return 'rate-limited'
  return 'unknown'
}

export async function gradeWithGemini(extracted: Extracted): Promise<AuditPayload> {
  const model = getModel()
  const prompt = renderForPrompt(extracted)

  // Retry transient errors (503 overloaded, 429 rate-limited) with
  // exponential backoff. Most 503s clear within 1-3 seconds.
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text()

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new GeminiError('invalid-output', 'The AI returned an unexpected output format.')
      }

      const safe = responseSchema.safeParse(parsed)
      if (!safe.success) {
        throw new GeminiError(
          'invalid-output',
          `AI response did not match the expected shape: ${safe.error.message}`,
        )
      }

      const issues: AuditIssue[] = safe.data.issues.map((i) => ({
        key: i.key.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
        severity: i.severity,
        message: i.message,
      }))

      return {
        score: safe.data.score,
        summary: safe.data.summary,
        issues,
      }
    } catch (err) {
      lastErr = err
      // Don't retry on permanent failures (bad JSON, schema mismatch).
      if (err instanceof GeminiError && err.code === 'invalid-output') throw err
      const code = classifyGeminiError(err)
      if (code !== 'overloaded' && code !== 'rate-limited') break
      const backoff = RETRY_BACKOFF_MS[attempt]
      if (backoff === undefined) break
      console.warn(
        `[gemini] ${code} on attempt ${attempt + 1}; retrying in ${backoff}ms`,
      )
      await new Promise((r) => setTimeout(r, backoff))
    }
  }

  const code = classifyGeminiError(lastErr)
  const message =
    code === 'overloaded'
      ? 'The AI is currently overloaded. We retried a few times — please try again in a moment.'
      : code === 'rate-limited'
        ? 'The AI rate-limited us briefly. Try again in a few seconds.'
        : 'The AI failed to grade this page. Try again, or pick a different URL.'
  throw new GeminiError(code, message)
}
