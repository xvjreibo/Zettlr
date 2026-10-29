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
 * Returns a StateCommand that folds the sections of all headings of the given
 * level in the document.
 *
 * @param   {number}        level  The heading level (1-6)
 *
 * @return  {StateCommand}         A StateCommand that returns whether any
 *                                 section was folded.
 */
export function foldHeadings (level: number): StateCommand {
  return ({ state, dispatch }) => {
    // Make sure we see every heading, even in long documents
    const tree = ensureSyntaxTree(state, state.doc.length, 1000) ?? syntaxTree(state)

    const ranges: Array<{ from: number, to: number }> = []
    tree.iterate({
      enter (node) {
        const match = /^(?:ATX|Setext)Heading(\d)$/.exec(node.name)
        if (match === null) {
          return
        }

        if (parseInt(match[1], 10) === level) {
          const line = state.doc.lineAt(node.from)
          const range = foldable(state, line.from, line.to)
          if (range !== null) {
            ranges.push(range)
          }
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
}
