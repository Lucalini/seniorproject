import { Mark, mergeAttributes } from '@tiptap/core'

export const Insertion = Mark.create({
  name: 'insertion',

  parseHTML() {
    return [{ tag: 'span[data-insertion]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-insertion': 'true', class: 'ordInsertion' }), 0]
  },
})
