import { TabState, AppFunctions } from "../appTypes"
import { initDoc } from "../session/sessionApi"

import {EditorView, keymap} from "@codemirror/view"

import { repdocDark } from "./repdocDarkTheme"

import {setup} from "./setup"
import {rlangsupport} from "../../argonaut-lezer-r/src"

import { repdoc } from "../repdoc/repdoc"
import { docchangedextension } from "./docchangedextension"
import { Editor } from "../appTypes"
import { AppFunctionsFacet, IdFacet } from "./editorConfig"
import { editorKeymap } from "./editorKeymap"

//=======================
// exports
//=======================

export function getEditorText(editor: Editor) {
    return (editor as EditorView).state.doc.sliceString(0)
}

export function destroyEditor(editor: Editor) {
    (editor as EditorView).destroy()
}

export function getEditor(tabState: TabState, tabFunctions: AppFunctions, data: string, element: HTMLDivElement): Editor {
    initDoc(tabState.id)
    let editor = new EditorView({
        doc: data,
        extensions: [
            setup,
            keymap.of(editorKeymap),
            AppFunctionsFacet.of(tabFunctions),
            IdFacet.of(tabState.id),
            //images(), //ignore the name - this does a console log printout of the parse tree
            repdoc(),
            rlangsupport(),
            docchangedextension(),
            repdocDark
        ],
        parent: element
    })
    return editor
}


