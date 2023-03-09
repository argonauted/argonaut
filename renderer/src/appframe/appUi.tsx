import * as React from 'react'
import * as ReactDom from "react-dom/client"
import { MenuProps} from './SelectMenu'
import { DocSession, TabState, TabFunctions } from '../appTypes'
import { AppElement } from './AppElement'

let appElement: HTMLElement | null = null
let root: ReactDom.Root | null = null

//===================
// Exported Functions
//===================

/** This must be called to initialize the UI for the app element. */
export function initUi() {
    appElement = document.querySelector("#editorMD")
    if(appElement === null ) throw new Error("Document element not found!")
    root = ReactDom.createRoot(appElement)
}

/** This renders the app element.  */
export function renderAppElement(docSessions: Record<string,DocSession>, 
                                activeDocSessionId: string | null, 
                                menuList: MenuProps[], 
                                tabFunctions: TabFunctions) {
    if(root === null) return

    const tabStateArray = createTabStateArray(docSessions)
    const appContent =  <AppElement menuList={menuList} tabStateArray={tabStateArray} selectedId={activeDocSessionId} tabFunctions={tabFunctions} />
    root.render(appContent) 
} 

//=====================
// Internal Functions
//=====================

function createTabStateArray(docSessions: Record<string,DocSession>) {
    let tabStateArray: TabState[] = []
    for(const key in docSessions) {
        tabStateArray.push(createTabState(docSessions[key]))
    }
    return tabStateArray
}

function createTabState(docSession: DocSession) {
    return {
        id: docSession.id,
        label: docSession.id,
        isDirty: docSession.isDirty,
        type: "Rcode"
    }
}

