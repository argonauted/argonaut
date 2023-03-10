import * as React from "react"
import { renderAppElement, initUi } from "./appframe/appUi"
import { DocSession, TabState, TabFunctions } from "./appTypes"
import { getEditor, getEditorText, destroyEditor } from "./editor/editor"
import { sessionOutputToView } from "./editor/sessionEvents"
import {startSessionListener,addEventListener,EventPayload,SessionOutputEvent,initDoc} from "./session/sessionApi"

//=============================================
// app state 
//=============================================

let activeSessionId: string | null = null
let docSessions: Record<string,DocSession> = {}

addEventListener("initComplete",onInitComplete)
addEventListener("sessionOutput",onSessionOutput)
startSessionListener()

function onInitComplete(eventName: string, data: EventPayload) {
    console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$ INIT COMPLETE")
    console.log("Init complete!")

    //END LOAD SCREEN AND ALLOW USER TO START (or something like that)
}

function onSessionOutput(eventName: string, data: EventPayload) {
    let sessionOutputEvents = (data as SessionOutputEvent[])
    if(sessionOutputEvents.length > 0) {
        //I SHOULD WRITE ALL THIS DIFFERENTLY WHEN I CAN REFACTOR THE SESSION OUTPUT FOR MULTI SESSIONS
        let docSessionId = sessionOutputEvents[0].session
        if(docSessionId !== null) {
            let docSession = docSessions[docSessionId]
            let editor = docSession.editor
            if(editor !== null) {
                sessionOutputToView(editor, data)
            }
            else {
                console.log("Session event for session with null editor")
            }
        }
        else {
            console.log("Session ID missing for session event")
        }
    }
}

//==============================================
// actions
//==============================================

function startDocSession(fileInfo: {data: string, filePath: string} | undefined = undefined) {
    const id = "ds" + getNewInt()
    let docSession: DocSession =  {
        id: id,
        lastSavedText: fileInfo !== undefined ? fileInfo.data : undefined,
        filePath: fileInfo !== undefined ? fileInfo.filePath : undefined, 
        isDirty: false,
        editor: null
    }
    docSessions[id] = docSession
    activeSessionId = id
    renderApp()
}

function closeDocSession(id: string) {
    if(docSessions[id] !== undefined) {
        let docSession = docSessions[id]
        //-- VERIFY DELETE HERE?? --
        
        docSession.editor = null  //we already do this, but do it again, I guess 

        delete docSessions[id]
        //-- DO DELETE HERE --

        if(activeSessionId == id) {
            //clumsy way of reading first key - clean this up
            let firstKey: string | null = null
            for(let key in docSessions) {
                firstKey = key
                break
            }
            activeSessionId = firstKey
        }
        renderApp()
    }
    else {
        console.log("Doc Session ID not found: " + id)
    }
}

function selectDocSession(id: string) {
    if(docSessions[id] !== undefined) {
        activeSessionId = id
        renderApp()
    }
    else {
        console.log("Doc Session ID not found: " + id)
    }
}

function newFile() {
    startDocSession()
}

function openFile() {
    window.openSaveApi.openFile().then( result => { 
        if(result !== null) {
            startDocSession(result)
        } 
    }).catch(err => {
        //NEED ERROR HANDLING!
        console.log(err)
    })
}

function saveFileAs() {
    saveFile(true)
}

function saveFile(doSaveAs: boolean = false) {
    if(activeSessionId === null) {
        console.log("There is no active session")
        return
    }
    let docSession = docSessions[activeSessionId]

    //do I want this check?
    if(docSession.isDirty && !doSaveAs) {
        console.log("The file is not dirty")
        return
    }

    if(docSession.editor === null) {
        console.log("Editor not set for this doc session!")
        return
    }

    const data = getEditorText(docSession.editor)
    let savePromise = (doSaveAs || docSession.filePath === undefined) ? 
        window.openSaveApi.saveFileAs(data,docSession.filePath) :
        window.openSaveApi.saveFile(data,docSession.filePath!)

    savePromise.then( filePath => { 
        if(filePath !== null) {
            docSession.filePath = filePath
            docSession.lastSavedText = data
        } 
    }).catch(err => {
        //NEED ERROR HANDLING!
        console.log(err)
    })
  
}

//==============================================
// Utilities
//==============================================

let nextIntVal = 1
function getNewInt() {
    return nextIntVal++
}

//==============================================
// UI
//==============================================

/** This is the lookup function to retrieve a tab element. */
function getTabElement(tabState: TabState, isShowing: boolean) {
    return <EditorFrame tabState={tabState} />
}

/** This generates an editor tab object. */
function EditorFrame({tabState}:{tabState: TabState}) {
    let tabRef = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
        //create editor - (non-react element)
        let element = tabRef.current
        let docSession = docSessions[tabState.id]
        if(element !== null && docSession !== undefined) {
            const data = docSession!.lastSavedText !== undefined ? docSession.lastSavedText! : ''
            docSession.editor = getEditor(tabState,data,element)
            //destroy
            return () => {
                if(docSession.editor) {
                    destroyEditor(docSession.editor)
                    docSession.editor = null
                }
            }
        }
        else {
            console.log("Error - ref element not found or doc state not found!")

        }
    },[])
    return <div className="app-editor-container" ref={tabRef}></div>
}

function renderApp() {
    renderAppElement(docSessions,activeSessionId,menuList,tabFunctions)
}

//---------------------
// other state objects to pass into app element
//---------------------

//I should make the contents dynamic, depending on active file
let menuList = [{
    text: "File",
    items: [
        { text: "New", action: newFile },
        { text: "Open", action: openFile },
        { text: "Save", action: saveFile },
        { text: "Save As", action: saveFileAs },
        { text: "Quit", action: () => console.log("Quit pressed") }
    ]
}]

const tabFunctions: TabFunctions = {
    selectTab: selectDocSession,
    closeTab: closeDocSession,
    getTabElement: getTabElement
}

//===========================
//initialize UI
//===========================

initUi()
renderApp()




