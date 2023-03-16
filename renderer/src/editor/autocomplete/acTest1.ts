import {CompletionContext} from "@codemirror/autocomplete"

export function acTest1(context: CompletionContext) {
  let word = context.matchBefore(/\w*/)
  if( word === null || (word.from == word.to && !context.explicit) )
    return null
  return {
    from: word.from,
    options: [
      {label: "match", type: "keyword"},
      {label: "hello", type: "variable", info: "(World)"},
      {label: "magic", type: "text", apply: "⠁⭒*.✩.*⭒⠁", detail: "macro"}
    ]
  }
}