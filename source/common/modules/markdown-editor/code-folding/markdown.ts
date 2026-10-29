/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Markdown code folding service
 * CVM-Role:        View
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     Folding service that can fold Markdown files.
 *
 * END HEADER
 */

import { foldService, syntaxTree } from '@codemirror/language'
import { countColumn, type EditorState } from '@codemirror/state'
import type { Tree } from '@lezer/common'

interface HeadingInfo {
  /** The start of the heading's first line */
  lineFrom: number
  /** The heading level (1-6) */
  level: number
  /** The indentation of the heading's first line, in columns */
  indent: number
  /** The end of the blockquote containing the heading, if any */
  quoteTo: number|undefined
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

      let quoteTo: number|undefined
      for (let parent = node.node.parent; parent !== null; parent = parent.parent) {
        if (parent.name === 'Blockquote') {
          quoteTo = parent.to
          break
        }
      }

      const line = state.doc.lineAt(node.from)
      headings.push({
        lineFrom: line.from,
        level: parseInt(match[1], 10),
        indent: countColumn(/^\s*/.exec(line.text)?.[0] ?? '', state.tabSize),
        quoteTo
      })
      return false // Headings contain no further headings
    }
  })

  headingCache.set(tree, headings)
  return headings
}

// Code folding for Markdown headings. NOTE: This deliberately deviates from
// Markdown, where only the heading level determines a heading's section: Here,
// a section ends before the next heading that is either less indented, or
// equally indented and of the same or a higher level (i.e., fewer `#`). So
// indentation determines nesting first, and the heading level only matters
// among equally indented headings. Without indentation, this is identical to
// Markdown sections. Headings within a blockquote only relate to headings in
// the same blockquote, and their sections end with it. NOTE: The Markdown mode
// provides its own heading folding, which `markdownParser` removes, so that
// this is the only folding for headings. All other folding is provided by the
// Markdown mode.
export const markdownFolding = foldService.of((state, lineStart, lineEnd) => {
  const headings = getHeadings(state, syntaxTree(state))
  const idx = headings.findIndex(h => h.lineFrom === lineStart)
  if (idx < 0) {
    return null // No heading starts on this line
  }

  const heading = headings[idx]
  let end = heading.quoteTo ?? state.doc.length
  for (const next of headings.slice(idx + 1)) {
    if (next.quoteTo !== heading.quoteTo) {
      continue
    }

    if (next.indent < heading.indent || (next.indent === heading.indent && next.level <= heading.level)) {
      end = next.lineFrom - 1
      break
    }
  }

  // The section ends at the last non-empty line before the end
  let lineNo = state.doc.lineAt(Math.max(end, lineStart)).number
  while (lineNo > 1 && state.doc.line(lineNo).text.trim() === '') {
    lineNo--
  }

  const to = Math.min(state.doc.line(lineNo).to, end)
  return to > lineEnd ? { from: lineEnd, to } : null
})
