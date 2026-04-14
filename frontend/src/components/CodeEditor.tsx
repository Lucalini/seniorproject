import { useCallback, useEffect, useRef, useState } from 'react'
import type { CodeNode } from '../types'

type Props = {
  node: CodeNode
  editedBody: string | null
  onSave: (nodeId: string, body: string) => void
  onReset: (nodeId: string) => void
}

export function CodeEditor({ node, editedBody, onSave, onReset }: Props) {
  const current = editedBody ?? node.body ?? ''
  const [local, setLocal] = useState(current)
  const editorRef = useRef<HTMLDivElement>(null)
  const isDirty = local !== (node.body ?? '')

  useEffect(() => {
    setLocal(editedBody ?? node.body ?? '')
  }, [node.id, editedBody, node.body])

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerText !== local) {
      editorRef.current.innerText = local
    }
  }, [node.id]) // only re-set DOM text when switching sections

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      setLocal(editorRef.current.innerText)
    }
  }, [])

  const handleBlur = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText
      setLocal(text)
      onSave(node.id, text)
    }
  }, [node.id, onSave])

  const handleReset = () => {
    const original = node.body ?? ''
    setLocal(original)
    if (editorRef.current) {
      editorRef.current.innerText = original
    }
    onReset(node.id)
  }

  return (
    <div className="codeEditor">
      <div className="codeEditorHeader">
        <div>
          <span className="codeEditorNumber">{node.number}</span>
          <h2 className="codeEditorTitle">{node.heading}</h2>
        </div>
        <div className="codeEditorActions">
          {isDirty && (
            <span className="codeEditorDirty">edited</span>
          )}
          <button type="button" className="button buttonSecondary" onClick={handleReset} disabled={!isDirty}>
            Reset to original
          </button>
        </div>
      </div>

      <div
        ref={editorRef}
        className="codeEditorBody"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        spellCheck={false}
      >
        {local}
      </div>
    </div>
  )
}
