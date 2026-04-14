import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/core'
import { Insertion } from './InsertionMark'

type Props = {
  content: JSONContent
  onChange: (json: JSONContent) => void
}

export function OrdinanceDraftEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Insertion,
    ],
    content,
    editorProps: {
      attributes: {
        class: 'ordProseMirror',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
  })

  if (!editor) {
    return <div className="loading"><span className="spinner" /> Loading editor…</div>
  }

  return (
    <div className="ordEditorWrap">
      <div className="ordEditorToolbar" role="toolbar" aria-label="Text formatting">
        <button
          type="button"
          className="button buttonSecondary ordTbBtn"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
        >
          Strikethrough
        </button>
        <button
          type="button"
          className="button buttonSecondary ordTbBtn"
          onClick={() => editor.chain().focus().toggleMark('insertion').run()}
        >
          Green insertion
        </button>
        <span className="muted ordTbHint">
          Select text, then apply strikethrough (red) or green insertion. Add new text and mark it green with the same button.
        </span>
      </div>
      <EditorContent editor={editor} className="ordEditorContent" />
    </div>
  )
}
