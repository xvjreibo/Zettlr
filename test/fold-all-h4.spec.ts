/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Tests for the foldAllH4 function
 * CVM-Role:        TESTING
 * Maintainers:     Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This file tests the foldAllH4 function.
 *
 * END HEADER
 */

import { deepStrictEqual, strictEqual } from 'assert'
import { EditorState, type Transaction } from '@codemirror/state'
import { codeFolding, foldState } from '@codemirror/language'
import { foldAllH4 } from 'source/common/modules/markdown-editor/commands/folding'
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

Body 1.1.1.1.1

#### Section 1.1.1.2

Body 1.1.1.2

### Section 1.1.2

Body 1.1.2

#### Empty section
# Section 2

Body 2`

/**
 * Runs foldAllH4 on the document, and returns its return value together with
 * the start and end line numbers of all folded ranges afterwards.
 */
function runFoldAllH4 (doc: string): { result: boolean, folded: Array<[number, number]> } {
  let state = EditorState.create({ doc, extensions: [ markdownParser(), codeFolding() ] })
  const result = foldAllH4({ state, dispatch: (tr: Transaction) => { state = tr.state } })

  const folded: Array<[number, number]> = []
  state.field(foldState).between(0, state.doc.length, (from, to) => {
    folded.push([ state.doc.lineAt(from).number, state.doc.lineAt(to).number ])
  })
  return { result, folded }
}

describe('MarkdownEditor#foldAllH4()', function () {
  it('should fold every level 4 section, and nothing else', function () {
    const { result, folded } = runFoldAllH4(doc)
    strictEqual(result, true)
    // Each fold runs from the end of the heading line to the end of its
    // section, which stops before the next heading of level 4 or higher.
    deepStrictEqual(folded, [ [ 3, 5 ], [ 11, 17 ], [ 19, 21 ] ])
  })

  it('should do nothing if there are no level 4 headings', function () {
    const { result, folded } = runFoldAllH4('# One\n\nText\n\n### Three\n\nText')
    strictEqual(result, false)
    deepStrictEqual(folded, [])
  })
})
