/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Tests for the toggleFoldHeadings function
 * CVM-Role:        TESTING
 * Maintainers:     Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This file tests the toggleFoldHeadings function.
 *
 * END HEADER
 */

import { deepStrictEqual, strictEqual } from 'assert'
import { EditorState, type Extension, type Transaction } from '@codemirror/state'
import { codeFolding, foldable, foldEffect, foldService, foldState } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { markdownFolding } from 'source/common/modules/markdown-editor/code-folding/markdown'
import { toggleFoldHeadings } from 'source/common/modules/markdown-editor/commands/folding'
import markdownParser from 'source/common/modules/markdown-editor/parser/markdown-parser'

/**
 * The folding setup of the main editor (see editor-extension-sets.ts)
 */
function foldingSetup (): Extension[] {
  return [ markdownParser(), markdownFolding, codeFolding() ]
}

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
 * Runs toggleFoldHeadings once for each of the given levels, in order, on the
 * document, and returns the return value of the last run together with the
 * start and end line numbers of all folded ranges afterwards.
 */
function runToggles (doc: string, levels: number[]): { result: boolean, folded: Array<[number, number]> } {
  let state = EditorState.create({ doc, extensions: foldingSetup() })
  let result = false
  for (const level of levels) {
    result = toggleFoldHeadings(level)({ state, dispatch: (tr: Transaction) => { state = tr.state } })
  }

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

describe('MarkdownEditor#toggleFoldHeadings()', function () {
  for (const [ level, folded ] of expected) {
    it(`should fold every level ${level} section, and nothing else`, function () {
      const result = runToggles(doc, [level])
      strictEqual(result.result, true)
      deepStrictEqual(result.folded, folded)
    })

    it(`should unfold all level ${level} sections if they are all folded`, function () {
      const result = runToggles(doc, [ level, level ])
      strictEqual(result.result, true)
      deepStrictEqual(result.folded, [])
    })
  }

  it('should fold the remaining sections if only some are folded', function () {
    const doc = '# A\n\n#### B\n\nText\n\n#### C\n\nText'
    let state = EditorState.create({ doc, extensions: foldingSetup() })
    // Fold only the first level 4 section, as the fold gutter would
    state = state.update({ effects: foldEffect.of({ from: state.doc.line(3).to, to: state.doc.line(5).to }) }).state

    strictEqual(toggleFoldHeadings(4)({ state, dispatch: (tr: Transaction) => { state = tr.state } }), true)
    const folded: Array<[number, number]> = []
    state.field(foldState).between(0, state.doc.length, (from, to) => {
      folded.push([ state.doc.lineAt(from).number, state.doc.lineAt(to).number ])
    })
    deepStrictEqual(folded, [ [ 3, 5 ], [ 7, 9 ] ])
  })

  it('should leave folded sections of other levels folded when unfolding', function () {
    // Fold level 3, then fold and unfold level 2: The level 3 folds remain
    const result = runToggles(doc, [ 3, 2, 2 ])
    deepStrictEqual(result.folded, expected[2][1])
  })

  it('should do nothing if there are no headings of the level', function () {
    const { result, folded } = runToggles('# One\n\nText\n\n### Three\n\nText', [4])
    strictEqual(result, false)
    deepStrictEqual(folded, [])
  })
})

/**
 * Returns the start and end line numbers of the foldable section of the
 * heading on the given line, or null if it has none.
 */
function sectionOf (doc: string, lineNo: number): [number, number]|null {
  const state = EditorState.create({ doc, extensions: foldingSetup() })
  const line = state.doc.line(lineNo)
  const range = foldable(state, line.from, line.to)
  return range === null ? null : [ state.doc.lineAt(range.from).number, state.doc.lineAt(range.to).number ]
}

/**
 * Returns the start and end line numbers of the foldable range starting on each
 * of the given lines (or null), using the given extensions.
 */
function foldableLines (doc: string, lines: number[], extensions: Extension[] = foldingSetup()): Array<[number, number]|null> {
  const state = EditorState.create({ doc, extensions })
  return lines.map(lineNo => {
    const line = state.doc.line(lineNo)
    const range = foldable(state, line.from, line.to)
    return range === null ? null : [ state.doc.lineAt(range.from).number, state.doc.lineAt(range.to).number ]
  })
}

describe('MarkdownEditor#markdownFolding', function () {
  it('should be the only fold service for headings', function () {
    const parserOnly = EditorState.create({ doc: '', extensions: [markdownParser()] })
    strictEqual(parserOnly.facet(foldService).length, 0)
    const app = EditorState.create({ doc: '', extensions: foldingSetup() })
    strictEqual(app.facet(foldService).length, 1)
  })

  it('should nest more indented headings of the same level', function () {
    // NOTE: Four spaces or a tab would make the lines indented code, unless
    // indented code is disabled (see no-code.spec.ts)
    deepStrictEqual(foldableLines('#### A\n  #### B\n  Text B\n#### C\nText C', [ 1, 2, 4 ]), [ [ 1, 3 ], [ 2, 3 ], [ 4, 5 ] ])
    deepStrictEqual(foldableLines('#### A\n   #### B\n   Text B', [ 1, 2 ]), [ [ 1, 3 ], [ 2, 3 ] ])
  })

  it('should nest more indented headings of any level', function () {
    deepStrictEqual(foldableLines('#### A\n  # B\n  Text B\n#### C', [ 1, 2 ]), [ [ 1, 3 ], [ 2, 3 ] ])
  })

  it('should end a section at a less indented heading of any level', function () {
    deepStrictEqual(foldableLines('  # A\n  Text A\n#### B\nText B', [1]), [[ 1, 2 ]])
  })

  it('should not fold an indented heading over a following less indented one', function () {
    // A empty by indentation, but would contain B by its level
    deepStrictEqual(foldableLines('  # A\n#### B\nText B', [ 1, 2 ]), [ null, [ 2, 3 ] ])
  })

  it('should use heading levels among equally indented headings', function () {
    deepStrictEqual(foldableLines('  ## A\n  ### B\n  Text B\n  ## C\n  Text C', [ 1, 2, 4 ]), [ [ 1, 3 ], [ 2, 3 ], [ 4, 5 ] ])
  })

  it('should exclude trailing empty lines and not fold empty sections', function () {
    deepStrictEqual(foldableLines('#### A\nText\n\n\n#### B', [1]), [[ 1, 2 ]])
    deepStrictEqual(foldableLines('#### A\n\n#### B', [1]), [null])
    deepStrictEqual(foldableLines('Text\n\n#### A', [3]), [null])
    deepStrictEqual(foldableLines('#### A\n\n\n', [1]), [null])
  })

  it('should fold setext headings including their underline', function () {
    deepStrictEqual(foldableLines('A\n===\nText\n\nB\n---\nText', [ 1, 5 ]), [ [ 1, 7 ], [ 5, 7 ] ])
  })

  it('should keep headings in blockquotes within the blockquote', function () {
    const doc = '# A\nText\n> # Q\n> Quote\n\nMore text\n# B'
    // The quoted heading neither ends A, nor reaches beyond the blockquote
    deepStrictEqual(foldableLines(doc, [ 1, 3 ]), [ [ 1, 6 ], [ 3, 4 ] ])
  })

  it('should treat indented headings in list items like other headings', function () {
    deepStrictEqual(foldableLines('#### A\n- Item\n  #### B\n  Text B\n#### C', [ 1, 3 ]), [ [ 1, 4 ], [ 3, 4 ] ])
  })

  it('should still fold YAML frontmatter, Pandoc divs and blockquotes', function () {
    deepStrictEqual(foldableLines('---\ntitle: A\n---\n\n::: note\nText\n:::\n\n> Quote\n> More', [ 1, 5, 9 ]), [ [ 1, 3 ], [ 5, 7 ], [ 9, 10 ] ])
  })

  it('should fold nested indented headings with the level buttons', function () {
    const { folded } = runToggles('#### A\n  #### B\n  Text B\n#### C\nText C', [4])
    // Nested folds are not reported in document order, so sort them
    folded.sort((a, b) => a[0] - b[0])
    deepStrictEqual(folded, [ [ 1, 3 ], [ 2, 3 ], [ 4, 5 ] ])
  })

  it('should fold unindented headings exactly like Markdown', function () {
    // Generate random documents without indentation, and compare the sections
    // with those of the stock Markdown mode.
    let seed = 42
    const random = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }

    for (let i = 0; i < 300; i++) {
      const lines: string[] = []
      const length = 1 + random(25)
      for (let j = 0; j < length; j++) {
        const r = random(10)
        if (r < 4) {
          lines.push('#'.repeat(1 + random(6)) + ` H${j}`)
        } else if (r < 6) {
          lines.push('')
        } else if (r < 7) {
          lines.push(`Setext ${j}`, random(2) === 0 ? '===' : '---')
        } else {
          lines.push(`Text ${j}`)
        }
      }
      const doc = lines.join('\n')
      const state = EditorState.create({ doc })
      const headingLines = Array.from({ length: state.doc.lines }, (_, k) => k + 1)
        .filter(k => /^#|^Setext/.test(state.doc.line(k).text))
      const stock = foldableLines(doc, headingLines, [ markdown({ base: markdownLanguage }), codeFolding() ])
      deepStrictEqual(foldableLines(doc, headingLines), stock, `Document:\n${doc}`)
    }
  })
})
