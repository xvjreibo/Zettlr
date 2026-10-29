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
import {
  ensureSyntaxTree,
  foldable,
  foldEffect,
  foldState,
  syntaxTree,
  unfoldEffect
} from '@codemirror/language'

/**
 * Returns a StateCommand that toggles the folding of the sections of all
 * headings of the given level in the document: If at least one of these
 * sections is unfolded, folds all of them. If all of them are already folded,
 * unfolds them. Folded sections of other levels remain untouched.
 *
 * @param   {number}        level  The heading level (1-6)
 *
 * @return  {StateCommand}         A StateCommand that returns whether any
 *                                 section was folded or unfolded.
 */
export function toggleFoldHeadings (level: number): StateCommand {
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

    const folded = state.field(foldState, false)
    const isFolded = ({ from, to }: { from: number, to: number }): boolean => {
      let found = false
      folded?.between(from, from, (a, b) => {
        if (a === from && b === to) {
          found = true
        }
      })
      return found
    }

    const unfolded = ranges.filter(range => !isFolded(range))
    const effects = unfolded.length > 0
      ? unfolded.map(range => foldEffect.of(range))
      : ranges.map(range => unfoldEffect.of(range))

    dispatch(state.update({ effects }))
    return true
  }
}
