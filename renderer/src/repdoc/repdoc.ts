import {EditorView} from "@codemirror/view"
import type { Extension} from '@codemirror/state'

import { repdoclint } from './repdoclint'
import { rsessioncompletions, identifierHover, cursorTooltip } from "./rsessioncompletions"

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
    "&dark .cm-rd-valuePendingShade": {backgroundColor: "rgba(31,31,31,0.5)"},

    "&light .cm-vardisplay-main": {color: "rgb(60,60,60)", backgroundColor: "rgb(253,234,210)", marginLeft: "15px"},
    "&light .cm-vardisplay-label": {paddingLeft: "5px"},
    "&light .cm-vardisplay-value": {fontStyle: "italic"},
    "&light .cm-vardisplay-added": {fontStyle: "italic", paddingRight: "5px" }
  })

/** This is the extension to interface with the reactive code model and display the output in the editor */
export const repdoc = (): Extension => {
    return [
        baseTheme,
        InteractiveCodeField,
        repdoclint,
        rsessioncompletions,
        cursorTooltip(),
        identifierHover
    ]
}
