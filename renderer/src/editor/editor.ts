import { TabState } from "../appTypes"
import { SessionOutputEvent, initDoc } from "../session/sessionApi"
import { StateEffect } from '@codemirror/state'

import {EditorView} from "@codemirror/view"

import {setup} from "./setup"
import {EXAMPLE} from "../../argonaut-lezer-r/src"

import { repdoc } from "../repdoc/repdoc"

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
            repdoc(),
            EXAMPLE()
        ],
        parent: element
    })
    return editor
}

//==============================
// Sesssion Event Processing
//==============================

export const sessionOutputEffect = StateEffect.define<[SessionOutputEvent]>()

/** This function dispatches a document transaction for the given session event. */
export function sessionOutputToView(view: any, eventList: any) {
    if(view !== null) {
        let effects: StateEffect<any>[] = [sessionOutputEffect.of(eventList)]
        view.dispatch({effects: effects})
    }
}


