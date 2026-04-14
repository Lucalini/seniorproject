import { useState } from 'react'
import type { CodeNode } from '../types'

type Props = {
  roots: CodeNode[]
  selectedIds: Set<string>
  activeId: string | null
  onSelect: (node: CodeNode) => void
  onActivate: (node: CodeNode) => void
}

function TreeNode({
  node,
  depth,
  selectedIds,
  activeId,
  onSelect,
  onActivate,
}: {
  node: CodeNode
  depth: number
  selectedIds: Set<string>
  activeId: string | null
  onSelect: (node: CodeNode) => void
  onActivate: (node: CodeNode) => void
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = (node.children?.length ?? 0) > 0
  const isSection = node.nodeType === 'section'
  const isActive = node.id === activeId

  return (
    <li className="codeTreeNode">
      <div
        className={`codeTreeRow ${isActive ? 'codeTreeRowActive' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="codeTreeToggle"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="codeTreeToggle" />
        )}

        {isSection && (
          <input
            type="checkbox"
            className="codeTreeCheck"
            checked={selectedIds.has(node.id)}
            onChange={() => onSelect(node)}
          />
        )}

        <button
          type="button"
          className="codeTreeLabel"
          onClick={() => {
            if (isSection) {
              onActivate(node)
            } else {
              setExpanded(e => !e)
            }
          }}
        >
          <span className="codeTreeNumber">{node.number}</span>
          <span className="codeTreeHeading">{node.heading}</span>
        </button>
      </div>

      {hasChildren && expanded && (
        <ul className="codeTreeList">
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              activeId={activeId}
              onSelect={onSelect}
              onActivate={onActivate}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function CodeTree({ roots, selectedIds, activeId, onSelect, onActivate }: Props) {
  return (
    <nav className="codeTree" aria-label="Municipal code outline">
      <ul className="codeTreeList">
        {roots.map(root => (
          <TreeNode
            key={root.id}
            node={root}
            depth={0}
            selectedIds={selectedIds}
            activeId={activeId}
            onSelect={onSelect}
            onActivate={onActivate}
          />
        ))}
      </ul>
    </nav>
  )
}
