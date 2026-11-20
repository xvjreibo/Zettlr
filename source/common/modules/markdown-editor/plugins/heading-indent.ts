/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        HeadingIndentPlugin
 * CVM-Role:        View
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This file contains a small plugin that applies the class
 *                  `cm-heading-indent` to the leading whitespace of lines that
 *                  contain a heading, and `cm-heading-indent-line` to these
 *                  lines. Since headings use a larger font size, their
 *                  whitespace would otherwise be wider than the same
 *                  whitespace on other lines, so that indented headings would
 *                  not align with equally indented text. The classes render the
 *                  whitespace at the size of regular text (see editor.css).
 *
 * END HEADER
 */

import { syntaxTree } from '@codemirror/language'
import { type Extension, type Range } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'

const headingIndentDeco = Decoration.mark({ class: 'cm-heading-indent' })
// Tabs are rendered as widgets (see visual-indent.ts), which the mark does not
// wrap, so the line needs a class as well
const headingIndentLineDeco = Decoration.line({ class: 'cm-heading-indent-line' })

/**
 * This function returns a decoration set that marks the leading whitespace of
 * all visible lines that contain a heading, and these lines.
 *
 * @param   {EditorView}     view  The view
 *
 * @return  {DecorationSet}        The built set
 */
function retrieveHeadingIndents (view: EditorView): DecorationSet {
  const decoRanges: Array<Range<Decoration>> = []
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter (node) {
        if (!/^(?:ATX|Setext)Heading\d$/.test(node.name)) {
          return
        }

        const line = view.state.doc.lineAt(node.from)
        const whitespace = /^[ \t]+/.exec(line.text)
        if (whitespace !== null) {
          decoRanges.push(headingIndentLineDeco.range(line.from))
          decoRanges.push(headingIndentDeco.range(line.from, line.from + whitespace[0].length))
        }

        return false // Headings contain no further headings
      }
    })
  }

  return Decoration.set(decoRanges, true)
}

const headingIndentPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor (view: EditorView) {
    this.decorations = retrieveHeadingIndents(view)
  }

  update (update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
      this.decorations = retrieveHeadingIndents(update.view)
    }
  }
}, {
  decorations: v => v.decorations
})

export function headingIndent (): Extension[] {
  return [headingIndentPlugin]
}
