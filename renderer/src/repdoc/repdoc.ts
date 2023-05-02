/** This is the main file for the extensions that implements the repdoc functionality. */

import type { Extension} from '@codemirror/state'

import { repdocLint } from './document/repdocLint'
import { mainCompletions, packageCompletions, keywordCompletions, cleanupExtension } from "./contextInfo/repdocCompletions"
import { repdocHover } from "./contextInfo/repdocHover"
import { repdocCursorContext } from "./contextInfo/repdocCursorContext"
import { repdocTheme } from "./repdocTheme"

import { repdocState } from "./document/repdocState"

/** This is the extension to interface with the reactive code model and display the output in the editor */
export const repdoc = (): Extension => {
    return [
        repdocTheme,
        repdocState,
        repdocLint,
        mainCompletions,
        packageCompletions,
        keywordCompletions,
        repdocCursorContext(),
        repdocHover,
        cleanupExtension
    ]
}
