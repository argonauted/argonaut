import { TabState } from "../appTypes"
import { initDoc } from "../session/sessionApi"

import {EditorView} from "@codemirror/view"

import {setup} from "./setup"
import {rlangsupport} from "../../argonaut-lezer-r/src"

import { repdoc } from "../repdoc/repdoc"
import { docchangedextension } from "../repdoc/docchangedextension"
import { Editor } from "../appTypes"

/////////////////////////////////////////

export function getEditorText(editor: Editor) {
    return (editor as EditorView).state.doc.sliceString(0)
}

export function destroyEditor(editor: Editor) {
    (editor as EditorView).destroy()
}

export function getEditor(tabState: TabState, data: string, element: HTMLDivElement): Editor {
    initDoc(tabState.id)
    let editor = new EditorView({
        doc: data,
        extensions: [
            setup,
            //images(), //ignore the name - this does a console log printout of the parse tree
            repdoc({docSessionId: tabState.id}),
            rlangsupport(),
            docchangedextension()
        ],
        parent: element
    })
    return editor
}


