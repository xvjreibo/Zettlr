/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Tests for the foldHeadings function
 * CVM-Role:        TESTING
 * Maintainers:     Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This file tests the foldHeadings function.
 *
 * END HEADER
 */

import { deepStrictEqual, strictEqual } from 'assert'
import { EditorState, type Transaction } from '@codemirror/state'
import { codeFolding, foldState } from '@codemirror/language'
import { foldHeadings } from 'source/common/modules/markdown-editor/commands/folding'
import markdownParser from 'source/common/modules/markdown-editor/parser/markdown-parser'

const doc = `\
# Section 1

#### Section 1.0.0.1

Body 1.0.0.1

## Section 1.1

### Section 1.1.1

#### Section 1.1.1.1

Body 1.1.1.1

##### Section 1.1.1.1.1

###### Section 1.1.1.1.1.1

Body 1.1.1.1.1.1

#### Section 1.1.1.2

Body 1.1.1.2

### Section 1.1.2

Body 1.1.2

#### Empty section
Section 2
=========

Body 2

Section 2.1
-----------

Body 2.1`

/**
 * Runs foldHeadings for the given level on the document, and returns its
 * return value together with the start and end line numbers of all folded
 * ranges afterwards.
 */
function runFoldHeadings (doc: string, level: number): { result: boolean, folded: Array<[number, number]> } {
  let state = EditorState.create({ doc, extensions: [ markdownParser(), codeFolding() ] })
  const result = foldHeadings(level)({ state, dispatch: (tr: Transaction) => { state = tr.state } })

  const folded: Array<[number, number]> = []
  state.field(foldState).between(0, state.doc.length, (from, to) => {
    folded.push([ state.doc.lineAt(from).number, state.doc.lineAt(to).number ])
  })
  return { result, folded }
}

// Each fold runs from the end of the heading line to the end of its section,
// which stops before the next heading of the same or a higher level.
const expected: Array<[number, Array<[number, number]>]> = [
  [ 1, [ [ 1, 29 ], [ 30, 38 ] ] ],
  [ 2, [ [ 7, 29 ], [ 35, 38 ] ] ],
  [ 3, [ [ 9, 23 ], [ 25, 29 ] ] ],
  [ 4, [ [ 3, 5 ], [ 11, 19 ], [ 21, 23 ] ] ],
  [ 5, [ [ 15, 19 ] ] ],
  [ 6, [ [ 17, 19 ] ] ]
]

describe('MarkdownEditor#foldHeadings()', function () {
  for (const [ level, folded ] of expected) {
    it(`should fold every level ${level} section, and nothing else`, function () {
      const result = runFoldHeadings(doc, level)
      strictEqual(result.result, true)
      deepStrictEqual(result.folded, folded)
    })
  }

  it('should do nothing if there are no headings of the level', function () {
    const { result, folded } = runFoldHeadings('# One\n\nText\n\n### Three\n\nText', 4)
    strictEqual(result, false)
    deepStrictEqual(folded, [])
  })
})
