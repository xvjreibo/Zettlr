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

import { countColumn, type EditorState, type StateCommand } from '@codemirror/state'
import type { Tree } from '@lezer/common'
import {
  ensureSyntaxTree,
  foldable,
  foldEffect,
  foldService,
  foldState,
  syntaxTree,
  unfoldEffect
} from '@codemirror/language'

interface HeadingInfo {
  /** The start of the heading's first line */
  lineFrom: number
  /** The end of the heading's first line */
  lineTo: number
  /** The heading level (1-6) */
  level: number
  /** The indentation of the heading's first line, in columns */
  indent: number
}

// Caches the headings per syntax tree, since the fold service below is called
// for every visible line.
const headingCache = new WeakMap<Tree, HeadingInfo[]>()

/**
 * Returns all headings of the document in document order.
 *
 * @param   {EditorState}    state  The editor state
 * @param   {Tree}           tree   The syntax tree of the state
 *
 * @return  {HeadingInfo[]}         The headings
 */
function getHeadings (state: EditorState, tree: Tree): HeadingInfo[] {
  const cached = headingCache.get(tree)
  if (cached !== undefined) {
    return cached
  }

  const headings: HeadingInfo[] = []
  tree.iterate({
    enter (node) {
      const match = /^(?:ATX|Setext)Heading(\d)$/.exec(node.name)
      if (match === null) {
        return
      }

      const line = state.doc.lineAt(node.from)
      const whitespace = /^\s*/.exec(line.text)?.[0] ?? ''
      headings.push({
        lineFrom: line.from,
        lineTo: line.to,
        level: parseInt(match[1], 10),
        indent: countColumn(whitespace, state.tabSize)
      })
      return false // Headings contain no further headings
    }
  })

  headingCache.set(tree, headings)
  return headings
}

/**
 * Determines the foldable section of headings. NOTE: This deliberately deviates
 * from Markdown, where only the heading level determines the section: Here, a
 * heading's section ends before the next heading that is either less indented,
 * or equally indented and of the same or a higher level (i.e., fewer `#`). So
 * indentation determines nesting first, and the heading level only matters
 * among equally indented headings. Without indentation, this is identical to
 * Markdown sections.
 */
export const headingSectionFolding = foldService.of((state, lineStart, lineEnd) => {
  const headings = getHeadings(state, syntaxTree(state))
  const idx = headings.findIndex(h => h.lineFrom === lineStart)
  if (idx < 0) {
    return null
  }

  const heading = headings[idx]
  const next = headings.slice(idx + 1).find(h => {
    return h.indent < heading.indent || (h.indent === heading.indent && h.level <= heading.level)
  })

  // The section ends at the last non-empty line before the next section
  let lineNo = next !== undefined ? state.doc.lineAt(next.lineFrom).number - 1 : state.doc.lines
  while (lineNo > 0 && state.doc.line(lineNo).text.trim() === '') {
    lineNo--
  }

  const to = lineNo > 0 ? state.doc.line(lineNo).to : 0
  return to > lineEnd ? { from: lineEnd, to } : null
})

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
