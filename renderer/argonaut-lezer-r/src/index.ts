import {parser} from "./syntax.grammar"
import {LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"

export const RLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Block: delimitedIndent({closing: "}", align: false})
      }),
      foldNodeProp.add({
        Block: foldInside
      }),
      styleTags({
        "if else repeat while function for in next break": t.controlKeyword,
        "NULL NA NA_integer_ NA_real_ NA_complex_ NA_Character_": t.null,
        "Inf NaN": t.float,
        Numeric: t.float,
        Integer: t.integer,
        Complex: t.float,
        Logical: t.bool,
        Character: t.string,
        Comment: t.lineComment,
        Identifier: t.variableName,
        "[ ]  [[  ]]": t.bracket,
        ArithOp: t.arithmeticOperator,
        CompOp: t.compareOperator,
        LogicOp: t.logicOperator,
        AssignOp: t.definitionOperator,
        GenOp: t.operator
      })
    ]
  }),
  languageData: {
    commentTokens: {line: "#"},
    closeBrackets: {brackets: ["(", "[", "[[", "{", "'", '"', "`"]}
  }
})

export function rlang(config: {autocomplete?: any[]} = {}) {
  let langConfig = config.autocomplete !== undefined ? config.autocomplete.map(acext => RLanguage.data.of({autocomplete: acext})) : []
  return new LanguageSupport(RLanguage,langConfig)
}


