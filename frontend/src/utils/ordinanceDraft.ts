import type { JSONContent } from '@tiptap/core'
import type { CodeNode } from '../types'

/** Ordered section nodes for proposed changes editor */
export function selectedSectionsInOrder(roots: CodeNode[], selectedIds: Set<string>): CodeNode[] {
  const out: CodeNode[] = []
  function walk(nodes: CodeNode[]) {
    for (const n of nodes) {
      if (n.nodeType === 'section' && selectedIds.has(n.id)) out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(roots)
  out.sort((a, b) => a.sortOrder - b.sortOrder)
  return out
}

export function buildProposedChangesDoc(sections: CodeNode[]): JSONContent {
  const content: JSONContent[] = []
  for (const sec of sections) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: `${sec.number} ${sec.heading}` }],
    })
    const body = sec.body?.trim() ?? ''
    content.push({
      type: 'paragraph',
      content: body ? [{ type: 'text', text: body }] : [],
    })
  }
  if (content.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  }
  return { type: 'doc', content }
}
