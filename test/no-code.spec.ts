/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Tests that code is not parsed
 * CVM-Role:        TESTING
 * Maintainers:     Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     Klotz does not work with code. This file tests that the
 *                  Markdown parser treats code as regular text, but still
 *                  parses math.
 *
 * END HEADER
 */

import { deepStrictEqual } from 'assert'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import markdownParser from 'source/common/modules/markdown-editor/parser/markdown-parser'

/**
 * Returns the names of all syntax nodes in the given document that are listed
 * in `names`, in document order.
 */
function findNodes (doc: string, names: string[]): string[] {
  const state = EditorState.create({ doc, extensions: [markdownParser()] })
  const found: string[] = []
  ensureSyntaxTree(state, state.doc.length, 5000)?.iterate({
    enter (node) {
      if (names.includes(node.name)) {
        found.push(node.name)
      }
    }
  })
  return found
}

const codeNodes = [ 'IndentedCode', 'FencedCode', 'InlineCode', 'CodeBlock', 'CodeText' ]

describe('MarkdownEditor#markdownParser() without code', function () {
  it('should parse indented lines as a paragraph', function () {
    deepStrictEqual(findNodes('Text\n\n    1\n    2\n    3', [ ...codeNodes, 'Paragraph' ]), [ 'Paragraph', 'Paragraph' ])
  })

  it('should parse lines indented with a tab as a paragraph', function () {
    deepStrictEqual(findNodes('Text\n\n\t1\n\t2', [ ...codeNodes, 'Paragraph' ]), [ 'Paragraph', 'Paragraph' ])
  })

  it('should parse fenced code as regular text', function () {
    deepStrictEqual(findNodes('```js\nlet a = 1\n```\n\n~~~\nb\n~~~', codeNodes), [])
  })

  it('should parse inline code as regular text', function () {
    deepStrictEqual(findNodes('Some `inline` code', codeNodes), [])
  })

  it('should still parse inline and block math', function () {
    deepStrictEqual(findNodes('Inline $a^2$ math\n\n$$\nb^2\n$$', [ 'InlineCode', 'FencedCode' ]), [ 'InlineCode', 'FencedCode' ])
  })
})
