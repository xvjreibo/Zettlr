/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Indented Block Parser
 * CVM-Role:        BlockParser
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     Klotz does not parse indented code. Markdown additionally
 *                  forbids lines indented by four or more spaces from starting
 *                  a new block directly after a line of text, since such lines
 *                  used to be code. Indented headings, list items and
 *                  blockquotes would then be appended to the text above. This
 *                  parser lifts that restriction, so that they end the
 *                  paragraph just like unindented ones do.
 *
 * END HEADER
 */

import type { BlockContext, BlockParser, LeafBlock, LeafBlockParser, Line } from '@lezer/markdown'

/**
 * Returns true if the given context is within a list of the given type.
 *
 * @param   {BlockContext}  cx    The block context
 * @param   {string}        type  The list type
 *
 * @return  {boolean}             Whether the context is within such a list
 */
function inList (cx: BlockContext, type: 'BulletList'|'OrderedList'): boolean {
  for (let depth = cx.depth - 1; depth >= 0; depth--) {
    if (cx.parentType(depth).name === type) {
      return true
    }
  }
  return false
}

/**
 * Returns true if the line starts a block that may interrupt a paragraph,
 * following the same rules as for unindented lines.
 *
 * @param   {BlockContext}  cx    The block context
 * @param   {Line}          line  The line
 *
 * @return  {boolean}             Whether the line may interrupt a paragraph
 */
function interruptsParagraph (cx: BlockContext, line: Line): boolean {
  const text = line.text.slice(line.pos)

  // ATX headings and blockquotes
  if (/^#{1,6}(?:[ \t]|$)/.test(text) || text.startsWith('>')) {
    return true
  }

  // Bullet lists, but not horizontal rules such as `* * *`. Outside of lists,
  // empty items cannot interrupt a paragraph.
  if (/^[-+*](?:[ \t]|$)/.test(text) && !/^([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(text)) {
    return inList(cx, 'BulletList') || /^[-+*][ \t]+\S/.test(text)
  }

  // Ordered lists. Outside of lists, only non-empty items starting with 1 can
  // interrupt a paragraph.
  const ordered = /^(\d{1,9})[.)](?:[ \t]|$)/.exec(text)
  if (ordered !== null) {
    return inList(cx, 'OrderedList') || (ordered[1] === '1' && /^\d+[.)][ \t]+\S/.test(text))
  }

  return false
}

class IndentedBlockInterrupt implements LeafBlockParser {
  nextLine (cx: BlockContext, line: Line, leaf: LeafBlock): boolean {
    // Lines indented by less than four spaces are already handled by the parser
    if (line.indent < line.baseIndent + 4 || !interruptsParagraph(cx, line)) {
      return false
    }

    // End the paragraph before this line, which then starts its own block, as
    // the parser does for unindented lines. NOTE: `finishLeaf` is not part of
    // the public typings of `BlockContext`.
    ;(cx as unknown as { finishLeaf: (leaf: LeafBlock) => void }).finishLeaf(leaf)
    return true
  }

  finish (): boolean {
    return false
  }
}

export const indentedBlockParser: BlockParser = {
  name: 'IndentedBlockInterrupt',
  leaf: () => new IndentedBlockInterrupt()
}
