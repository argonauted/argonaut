import { StateField} from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { getSessionId } from './interactiveCode'

let onDocChanged: (docSessionId: string) => void | undefined

export function setDocChangedHandler(callback: (docSessionId: string) => void | undefined) {
    onDocChanged = callback
}

//===============================
// Repdoc Codemirror Extension
//===============================

export const OnChangeField = StateField.define<void>({
    create(editorState) {},
    update(dummy, transaction) {
        if(transaction.docChanged) {
            if(onDocChanged !== undefined) onDocChanged(getSessionId(transaction.state))
        }
    }
})

export const docchangedextension = (): Extension => {
    return [
        OnChangeField
    ]
}

