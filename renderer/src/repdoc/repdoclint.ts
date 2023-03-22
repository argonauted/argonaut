import {syntaxTree} from "@codemirror/language"
import {linter, Diagnostic} from "@codemirror/lint"

export const repdoclint = linter(view => {
  let diagnostics: Diagnostic[] = []
  syntaxTree(view.state).cursor().iterate(node => {
    if (node.name == "\u26A0") diagnostics.push({
      from: node.from,
      to: node.to,
      severity: "error",
      message: "Preparser error",
    })
  })
  return diagnostics
})