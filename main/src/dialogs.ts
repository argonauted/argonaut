import { dialog } from 'electron'

/** This shows a dialog with a single button, which defaults to "OK".
 * The type options are: "none", "info", "error", "question" (which won't make sense here) and "warning"
 */
export function alertDialog(event: any, body: string, type: string = "info", okText = "OK") {
    dialog.showMessageBox({message: body, type: type, buttons: [okText]})
}

/** This shows a dialog with a single button, which defaults to "OK".
 * The type options are: "none", "info", "error", "question" (which won't make sense here) and "warning"
 */
export function okCancelDialog(event: any, body: string, type: string = "info", okText = "OK", cancelText = "Cancel") {
    return dialog.showMessageBox({message: body, type, buttons: [okText, cancelText], defaultId: 0, cancelId: 1})
}

export function messageDialog(event: any, body: string, type: string, buttons: [string], defaultId: number, cancelId: number) {
    return dialog.showMessageBox({message: body, type, buttons, defaultId, cancelId})
}

export function errorDialog(event: any, title: string, body: string) {
    dialog.showErrorBox(title, body)
}