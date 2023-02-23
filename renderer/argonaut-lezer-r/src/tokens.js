/* Hand-written tokenizers for R tokens that can't be
   expressed by lezer's built-in tokenizer. */

import {ContextTracker} from "@lezer/lr"

import { openBrace, closeBrace, openParen, closeParen,
         openBrack, closeBrack, openDBrack, closeDBrack,
         hnl, snl } from "./parser.terms"

const opens = new Set([openBrace,openParen,openBrack,openDBrack])
const closes  = new Set([closeBrace,closeParen,closeBrack,closeDBrack])

class ContextState {
  constructor(parent, delimiter) {
    this.parent = parent
    this.delimiter = delimiter
    this.hardDelim = (delimiter == openBrace)
  }

  canPopWith(delimiter) {
    if(this.parent == null) return false
    switch(this.delimiter) {
      case openBrace: return delimiter == closeBrace
      case openParen: return delimiter == closeParen
      case openBrack: return delimiter == closeBrack
      case openDBrack: return delimiter == closeDBrack
      default: false
    }
  }
}

export const trackDelims = new ContextTracker({
  start: new ContextState(null,openBrace), //initial state, Script, is like a block
  shift(context, term) {
    if(opens.has(term)) {
      return new ContextState(context,term)
    }
    else if( closes.has(term) && context.canPopWith(term) ) {
        return context.parent
    }
    else {
      return context
    }
  },
  strict: false
})

export const replaceNewline = function(token,stack) {
  if(stack.context.hardDelim) {
    return hnl
  }
  else {
    return snl
  }
}