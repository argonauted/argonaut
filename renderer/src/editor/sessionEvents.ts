import { SessionOutputEvent } from "../session/sessionApi"
import { StateEffect } from '@codemirror/state'

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