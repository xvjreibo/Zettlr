/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Folding Commands
 * CVM-Role:        Extension
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     Commands to fold sections of a document.
 *
 * END HEADER
 */

import type { StateCommand } from '@codemirror/state'
import { ensureSyntaxTree, foldable, foldEffect, syntaxTree } from '@codemirror/language'

/**
 * Folds the sections of all level 4 headings in the document.
 *
 * @param   {EditorState}  state     The editor state
 * @param   {Function}     dispatch  The dispatch function
 *
 * @return  {boolean}                Whether any section was folded
 */
export const foldAllH4: StateCommand = ({ state, dispatch }) => {
  // Make sure we see every heading, even in long documents
  const tree = ensureSyntaxTree(state, state.doc.length, 1000) ?? syntaxTree(state)

  const ranges: Array<{ from: number, to: number }> = []
  tree.iterate({
    enter (node) {
      if (node.name !== 'ATXHeading4') {
        return
      }

      const line = state.doc.lineAt(node.from)
      const range = foldable(state, line.from, line.to)
      if (range !== null) {
        ranges.push(range)
      }

      return false // Headings contain no further headings
    }
  })

  if (ranges.length === 0) {
    return false
  }

  dispatch(state.update({ effects: ranges.map(range => foldEffect.of(range)) }))
  return true
}
