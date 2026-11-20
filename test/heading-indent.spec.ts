/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Tests for the HeadingIndentPlugin
 * CVM-Role:        TESTING
 * Maintainers:     Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This file tests that the HeadingIndentPlugin marks the
 *                  leading whitespace of headings, and nothing else.
 *
 * END HEADER
 */

import { deepStrictEqual } from 'assert'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import markdownParser from 'source/common/modules/markdown-editor/parser/markdown-parser'
import { headingIndent } from 'source/common/modules/markdown-editor/plugins/heading-indent'

/**
 * Renders the document in an editor and returns the marked whitespace, along
 * with the text that follows it on the same line.
 */
function markedIndents (doc: string): string[] {
  // JSDOM does not provide requestAnimationFrame, which the view requires
  const win = window as unknown as Record<string, unknown>
  win.requestAnimationFrame ??= (cb: () => void) => setTimeout(cb, 0)
  win.cancelAnimationFrame ??= (id: number) => { clearTimeout(id) }

  const view = new EditorView({ state: EditorState.create({ doc, extensions: [ markdownParser(), headingIndent() ] }) })
  const marked = [...view.contentDOM.querySelectorAll('.cm-heading-indent')].map(span => {
    return JSON.stringify(span.textContent) + ' ' + (span.nextSibling?.textContent ?? '').trim()
  })
  view.destroy()
  return marked
}

describe('MarkdownEditor#headingIndent', function () {
  it('should mark the leading whitespace of indented headings', function () {
    deepStrictEqual(markedIndents('# A\n  ## B\n   ### C'), [ '"  " ## B', '"   " ### C' ])
  })

  it('should not mark unindented headings or other lines', function () {
    deepStrictEqual(markedIndents('# A\n  Text\n  * Item\n\n  > Quote'), [])
  })

  it('should mark setext headings', function () {
    deepStrictEqual(markedIndents('  Title\n  ====='), ['"  " Title'])
  })
})
