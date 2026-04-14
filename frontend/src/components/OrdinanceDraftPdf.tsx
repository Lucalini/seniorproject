/* eslint-disable react-refresh/only-export-components -- PDF helper exports non-React factory */
import { Document, Page, Text, StyleSheet, pdf } from '@react-pdf/renderer'
import type { JSONContent } from '@tiptap/core'

type Run = { text: string; strike: boolean; insertion: boolean }

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', lineHeight: 1.45 },
  centerTitle: { textAlign: 'center', fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  centerSub: { textAlign: 'center', fontSize: 10, marginBottom: 16 },
  ordinanceTitle: { textAlign: 'center', fontSize: 9, lineHeight: 1.5, marginBottom: 20 },
  sectionHead: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  body: { fontSize: 10, lineHeight: 1.55 },
  runStrike: { textDecoration: 'line-through', color: '#b00020' },
  runInsert: { backgroundColor: '#d4edda', color: '#155724' },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
  },
})

function inlineRuns(block: JSONContent): Run[] {
  const out: Run[] = []
  function walk(n: JSONContent) {
    if (n.type === 'text') {
      const marks = n.marks ?? []
      out.push({
        text: String(n.text ?? ''),
        strike: marks.some(m => m.type === 'strike'),
        insertion: marks.some(m => m.type === 'insertion'),
      })
      return
    }
    if (n.type === 'hardBreak') {
      out.push({ text: '\n', strike: false, insertion: false })
      return
    }
    for (const c of n.content ?? []) walk(c as JSONContent)
  }
  for (const c of block.content ?? []) walk(c as JSONContent)
  return out
}

function flattenProposedDoc(doc: JSONContent): Run[] {
  const out: Run[] = []
  for (const block of doc.content ?? []) {
    if (block.type === 'heading') {
      out.push(...inlineRuns(block))
      out.push({ text: '\n\n', strike: false, insertion: false })
    } else if (block.type === 'paragraph') {
      out.push(...inlineRuns(block))
      out.push({ text: '\n\n', strike: false, insertion: false })
    }
  }
  return out
}

function mergeRuns(runs: Run[]): Run[] {
  const merged: Run[] = []
  for (const r of runs) {
    const prev = merged[merged.length - 1]
    if (prev && prev.strike === r.strike && prev.insertion === r.insertion) {
      prev.text += r.text
    } else {
      merged.push({ ...r })
    }
  }
  return merged
}

function RunsText({ runs }: { runs: Run[] }) {
  const merged = mergeRuns(runs)
  return (
    <Text style={s.body}>
      {merged.map((r, i) => {
        let style = s.body
        if (r.strike) style = { ...style, ...s.runStrike }
        if (r.insertion) style = { ...style, ...s.runInsert }
        return (
          <Text key={i} style={style}>
            {r.text}
          </Text>
        )
      })}
    </Text>
  )
}

type OrdinancePdfInput = {
  sectionNumbers: string[]
  subject: string
  summary: string
  reason: string
  proposedDoc: JSONContent
}

function OrdinancePdfDocument({
  sectionNumbers,
  subject,
  summary,
  reason,
  proposedDoc,
}: OrdinancePdfInput) {
  const secLine =
    sectionNumbers.length <= 1
      ? `SECTION${sectionNumbers.length === 1 ? '' : 'S'} ${sectionNumbers[0] ?? '_____'}`
      : `SECTIONS ${sectionNumbers.join(', ')}`

  const relating = subject.trim() || '[SUBJECT]'

  const proposedRuns = flattenProposedDoc(proposedDoc)

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={s.centerTitle}>DRAFT ORDINANCE</Text>
        <Text style={s.centerSub}>Proposed Amendments</Text>
        <Text style={s.ordinanceTitle}>
          {`AN ORDINANCE OF THE CITY OF SAN LUIS OBISPO, CALIFORNIA, AMENDING ${secLine} OF THE SAN LUIS OBISPO MUNICIPAL CODE RELATING TO ${relating.toUpperCase()}`}
        </Text>

        <Text style={s.sectionHead}>Summary of current code</Text>
        <Text style={s.body}>{summary.trim() || ' '}</Text>

        <Text style={s.sectionHead}>Proposed changes</Text>
        <RunsText runs={proposedRuns} />

        <Text style={s.sectionHead}>Reason for changes</Text>
        <Text style={s.body}>{reason.trim() || ' '}</Text>

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}

export async function generateOrdinanceDraftPdf(input: OrdinancePdfInput) {
  const blob = await pdf(<OrdinancePdfDocument {...input} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'draft-ordinance-slo.pdf'
  a.click()
  URL.revokeObjectURL(url)
}
