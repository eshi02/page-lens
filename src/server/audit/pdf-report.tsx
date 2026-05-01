import 'server-only'

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'

import type { Audit, AuditIssue } from '@/db/schema'

import { exportHelpers } from './export'

type ExportableAudit = Pick<
  Audit,
  'url' | 'score' | 'summary' | 'createdAt' | 'issues'
>

const palette = {
  bg: '#ffffff',
  text: '#101014',
  subtle: '#5b5b66',
  border: '#e5e7eb',
  primary: '#7c3aed',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  cardBg: '#fafafa',
} as const

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: palette.bg,
    color: palette.text,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  brand: {
    fontSize: 14,
    fontWeight: 700,
    color: palette.primary,
  },
  brandSub: {
    fontSize: 8,
    color: palette.subtle,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 8,
    color: palette.subtle,
    textAlign: 'right',
  },
  url: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 4,
  },
  date: {
    fontSize: 9,
    color: palette.subtle,
    marginBottom: 16,
  },
  scoreBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: palette.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 700,
  },
  scoreOf: {
    fontSize: 16,
    color: palette.subtle,
    marginLeft: 4,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 2,
  },
  summary: {
    fontSize: 10,
    color: palette.subtle,
    lineHeight: 1.5,
  },
  countsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  countTile: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  countLabel: {
    fontSize: 7,
    color: palette.subtle,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  countValue: {
    fontSize: 18,
    fontWeight: 700,
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
    color: palette.subtle,
  },
  issueRow: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: 'row',
    gap: 8,
  },
  issueDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 5,
  },
  issueBody: {
    flex: 1,
  },
  issueKey: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
  },
  issueMessage: {
    fontSize: 9.5,
    color: palette.text,
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7,
    color: palette.subtle,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
})

function severityColor(s: 'error' | 'warning' | 'good') {
  if (s === 'error') return palette.rose
  if (s === 'warning') return palette.amber
  return palette.emerald
}

function scoreColor(score: number | null) {
  if (score === null) return palette.subtle
  if (score >= 75) return palette.emerald
  if (score >= 50) return palette.amber
  return palette.rose
}

function AuditPdf({ audit }: { audit: ExportableAudit }) {
  const issues = (audit.issues ?? []) as AuditIssue[]
  const grouped = {
    error: issues.filter((i) => i.severity === 'error'),
    warning: issues.filter((i) => i.severity === 'warning'),
    good: issues.filter((i) => i.severity === 'good'),
  }

  return (
    <Document
      title={`PageLens — ${audit.url}`}
      author="PageLens"
      creator="PageLens"
      producer="PageLens"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>PageLens</Text>
            <Text style={styles.brandSub}>AI-graded landing page audit</Text>
          </View>
          <Text style={styles.meta}>
            {exportHelpers.formatDate(audit.createdAt)}
          </Text>
        </View>

        <Text style={styles.url}>{audit.url}</Text>
        <Text style={styles.date}>
          Audited on {audit.createdAt.toLocaleString()}
        </Text>

        <View style={styles.scoreBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              style={{ ...styles.scoreNumber, color: scoreColor(audit.score) }}
            >
              {audit.score ?? '—'}
            </Text>
            <Text style={styles.scoreOf}>/ 100</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreLabel}>
              {exportHelpers.scoreLabel(audit.score)}
            </Text>
            {audit.summary ? (
              <Text style={styles.summary}>{audit.summary}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.countsRow}>
          <View style={styles.countTile}>
            <Text style={styles.countLabel}>Critical</Text>
            <Text style={{ ...styles.countValue, color: palette.rose }}>
              {grouped.error.length}
            </Text>
          </View>
          <View style={styles.countTile}>
            <Text style={styles.countLabel}>Needs work</Text>
            <Text style={{ ...styles.countValue, color: palette.amber }}>
              {grouped.warning.length}
            </Text>
          </View>
          <View style={styles.countTile}>
            <Text style={styles.countLabel}>Passing</Text>
            <Text style={{ ...styles.countValue, color: palette.emerald }}>
              {grouped.good.length}
            </Text>
          </View>
        </View>

        {(['error', 'warning', 'good'] as const).map((sev) => {
          const group = grouped[sev]
          if (group.length === 0) return null
          const titleMap = {
            error: 'Critical',
            warning: 'Needs work',
            good: 'Passing',
          }
          return (
            <View key={sev} wrap>
              <Text style={styles.groupTitle}>
                {titleMap[sev]} ({group.length})
              </Text>
              {group.map((i) => (
                <View
                  key={i.key}
                  style={styles.issueRow}
                  wrap={false}
                  break={false}
                >
                  <View
                    style={{ ...styles.issueDot, backgroundColor: severityColor(sev) }}
                  />
                  <View style={styles.issueBody}>
                    <Text style={styles.issueKey}>
                      {exportHelpers.unkebab(i.key)}
                    </Text>
                    <Text style={styles.issueMessage}>{i.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        })}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `PageLens · Page ${pageNumber} of ${totalPages} · pagelens.app`
          }
          fixed
        />
      </Page>
    </Document>
  )
}

export async function renderAuditPdf(audit: ExportableAudit): Promise<Buffer> {
  return renderToBuffer(<AuditPdf audit={audit} />)
}
