import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { CodeNode } from '../types'

type ExportSection = {
  node: CodeNode
  body: string
  titleHeading: string
  chapterHeading: string
}

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.5 },
  titleBlock: { marginBottom: 12 },
  titleText: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  chapterBlock: { marginBottom: 8 },
  chapterText: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  sectionBlock: { marginBottom: 14 },
  sectionHeading: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 4 },
  bodyText: { fontSize: 10, lineHeight: 1.6 },
  footer: { position: 'absolute', bottom: 30, left: 48, right: 48, fontSize: 8, color: '#888', textAlign: 'center' },
})

function CodePdfDocument({ sections }: { sections: ExportSection[] }) {
  let lastTitle = ''
  let lastChapter = ''

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {sections.map((sec, i) => {
          const elements: React.ReactNode[] = []

          if (sec.titleHeading !== lastTitle) {
            lastTitle = sec.titleHeading
            lastChapter = ''
            elements.push(
              <View key={`t-${i}`} style={s.titleBlock}>
                <Text style={s.titleText}>{sec.titleHeading}</Text>
              </View>,
            )
          }

          if (sec.chapterHeading !== lastChapter) {
            lastChapter = sec.chapterHeading
            elements.push(
              <View key={`c-${i}`} style={s.chapterBlock}>
                <Text style={s.chapterText}>{sec.chapterHeading}</Text>
              </View>,
            )
          }

          elements.push(
            <View key={`s-${i}`} style={s.sectionBlock}>
              <Text style={s.sectionHeading}>
                {sec.node.number} {sec.node.heading}
              </Text>
              <Text style={s.bodyText}>{sec.body}</Text>
            </View>,
          )

          return elements
        })}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}

/** Resolve the title and chapter heading for each selected section */
function resolveAncestors(
  node: CodeNode,
  allNodesById: Map<string, CodeNode>,
): { titleHeading: string; chapterHeading: string } {
  let titleHeading = ''
  let chapterHeading = ''

  if (node.parentId) {
    const chapter = allNodesById.get(node.parentId)
    if (chapter) {
      chapterHeading = `Chapter ${chapter.number} — ${chapter.heading}`
      if (chapter.parentId) {
        const title = allNodesById.get(chapter.parentId)
        if (title) titleHeading = `Title ${title.number} — ${title.heading}`
      }
    }
  }

  return { titleHeading, chapterHeading }
}

export async function generateCodePdf(
  selectedNodes: CodeNode[],
  editsMap: Map<string, string>,
  allNodesById: Map<string, CodeNode>,
) {
  const sections: ExportSection[] = selectedNodes
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(node => ({
      node,
      body: editsMap.get(node.id) ?? node.body ?? '',
      ...resolveAncestors(node, allNodesById),
    }))

  const blob = await pdf(<CodePdfDocument sections={sections} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'municipal-code-selections.pdf'
  a.click()
  URL.revokeObjectURL(url)
}
