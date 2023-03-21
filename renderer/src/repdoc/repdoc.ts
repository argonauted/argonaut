import {EditorView} from "@codemirror/view"
import type { Extension} from '@codemirror/state'


import { rsessioncompletions } from "./rsessioncompletions"

import { InteractiveCodeField } from "./interactiveCode"

//===================================
// Theme
//===================================

const baseTheme = EditorView.baseTheme({
    "&light .cm-rd-errText": {color: "red", fontWeight: "bold"},
    "&light .cm-rd-wrnText": {color: "orange", fontWeight: "bold"},
    "&light .cm-rd-msgText": {color: "blue"},
    "&dark .cm-rd-errText": {color: "red", fontWeight: "bold"},
    "&dark .cm-rd-wrnText": {color: "orange", fontWeight: "bold"},
    "&dark .cm-rd-msgText": {color: "lightblue"},

    "&light .cm-rd-codeDirtyShade": {backgroundColor: "rgba(145,200,255,0.5)"},
    "&light .cm-rd-valuePendingShade": {backgroundColor: "rgba(180,180,180,0.5)"},
    "&dark .cm-rd-codeDirtyShade": {backgroundColor: "rgba(52,26,0,0.5)"},
    "&dark .cm-rd-valuePendingShade": {backgroundColor: "rgba(31,31,31,0.5)"}
  })

/** This is the extension to interface with the reactive code model and display the output in the editor */
export const repdoc = (): Extension => {
    return [
        baseTheme,
        InteractiveCodeField,
        rsessioncompletions
    ]
}
