import * as React from "react"
import { renderAppElement, initUi } from "./appframe/appUi"
import { DocSession, DocSessionUpdate, TabState, TabFunctions } from "./appTypes"
import { getEditor, getEditorText, destroyEditor } from "./editor/editor"
import { setDocChangedHandler } from "./repdoc/docchangedextension"
import { sessionOutputToView } from "./editor/sessionEvents"
import {startSessionListener,addEventListener,EventPayload,SessionOutputEvent,initDoc} from "./session/sessionApi"

interface OpenFileData {
    data?: string
    filePath?: string
    fileName: string
    fileExtension: string
}

interface SaveFileData {
    filePath: string
    fileName: string
    fileExtension: string
}

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

function onDocChanged(docSessionId: string) {
    let docSession = docSessions[docSessionId]
    if(docSession !== undefined) {
        if(!docSession.isDirty) {
            updateDocSession(docSession, {isDirty:true})
        }
    }
}

function updateDocSession(oldDocSession: DocSession, docSessionUpdate: DocSessionUpdate) {
    let newDocSession = Object.assign({}, oldDocSession)
    let updated = false
    if(docSessionUpdate.filePath && docSessionUpdate.filePath != oldDocSession.filePath) {
        newDocSession.filePath = docSessionUpdate.filePath
        updated = true
    }
    if(docSessionUpdate.fileName) {
        newDocSession.fileName = docSessionUpdate.fileName
        updated = true
    }
    if(docSessionUpdate.fileExtension) {
        newDocSession.fileExtension = docSessionUpdate.fileExtension
        updated = true
    }
    if(docSessionUpdate.isDirty) {
        newDocSession.isDirty = docSessionUpdate.isDirty
        updated = true
    }
    if(docSessionUpdate.lastSavedText) {
        newDocSession.lastSavedText = docSessionUpdate.lastSavedText
        updated = true
    }

    if(updated) {
        docSessions[newDocSession.id] = newDocSession
        renderApp()
    }
}

//set doc changed handler
setDocChangedHandler(onDocChanged)


//==============================================
// actions
//==============================================

function startDocSession(fileData: OpenFileData) {
    const id = "ds" + getNewInt()
    let docSession: DocSession =  {
        id: id,
        lastSavedText: (fileData.data !== undefined) ? fileData.data : undefined,
        filePath: (fileData.filePath !== undefined) ? fileData.filePath : undefined,
        fileName: fileData.fileName,
        fileExtension: fileData.fileExtension, 
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
    //for now make it a .R extension
    let fileExtension = "R"
    startDocSession({fileName: createFileName(fileExtension), fileExtension})
}

function openFile() {
    window.openSaveApi.openFile().then( (fileData: OpenFileData | null) => { 
        if(fileData !== null) {
            let docSessionId = getSessionIdForFilePath(fileData.filePath!)
            if(docSessionId !== null) {
                //IMPROVE HANDLING OF TWO WINDOWS OPENED
                const msg = "The file is already opened. The existing opened version will be used."
                window.dialogApi.alertDialog(msg,"info")
                selectDocSession(docSessionId)
            }
            else {
                startDocSession(fileData)
            }
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
    // if(!docSession.isDirty && !doSaveAs) {
    //     console.log("The file is not dirty")
    //     return
    // }

    if(docSession.editor === null) {
        console.log("Editor not set for this doc session!")
        return
    }

    const data = getEditorText(docSession.editor)
    let savePromise = (doSaveAs || docSession.filePath === undefined) ? 
        window.openSaveApi.saveFileAs(data,docSession.filePath) :
        window.openSaveApi.saveFile(data,docSession.filePath!)

    savePromise.then( (fileData: SaveFileData | null) => { 
        if(fileData !== null) {
            let docSessionId = getSessionIdForFilePath(fileData.filePath!)
            if(docSessionId !== null) {
                //IMPORVE HANDLING OF TWO WINDOWS OPENED
                const msg = "There are two files opened with the same name. It is recommended you close one of them."
                window.dialogApi.alertDialog(msg,"warning")
            }

            updateDocSession(docSession, {
                filePath: fileData.filePath,
                fileName: fileData.fileName,
                fileExtension: fileData.fileExtension,
                isDirty:false,
                lastSavedText:data
            })
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

let nextFileIntValue = 1
function getNewFileInt() {
    return nextFileIntValue++
}

function createFileName(fileExtension: string) {
    return `untitled${getNewFileInt()}.${fileExtension}`
}

/** This function checks the currently opend doc sessions to see if the given file path is already opened.
 * It returns the docSessionId or null. */
function getSessionIdForFilePath(filePath: string) {
    for(let docSessionId in docSessions) {
        if(docSessions[docSessionId].filePath == filePath) return docSessionId
    }
    return null
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
    renderAppElement(docSessions,activeSessionId,getMenuList(),tabFunctions)
}

//we should improve the menu logic when we add more functionality
function getMenuList() {
    if(activeSessionId !== null) {
        const docSession = docSessions[activeSessionId]
        if(docSession !== undefined) {
            if(docSession.isDirty && (docSession.filePath !== undefined) ) return menuListSave
            else return menuListSaveAs
        }
    }
    return menuListNoSave
}

//---------------------
// other state objects to pass into app element
//---------------------

//I should make the contents dynamic, depending on active file
let menuListSave = [{
    text: "File",
    items: [
        { text: "New", action: newFile },
        { text: "Open", action: openFile },
        { text: "Save", action: saveFile },
        { text: "Save As", action: saveFileAs },
        { text: "Quit", action: () => console.log("Quit pressed") }
    ]
}]

let menuListSaveAs = [{
    text: "File",
    items: [
        { text: "New", action: newFile },
        { text: "Open", action: openFile },
        { text: "Save As", action: saveFileAs },
        { text: "Quit", action: () => console.log("Quit pressed") }
    ]
}]

let menuListNoSave = [{
    text: "File",
    items: [
        { text: "New", action: newFile },
        { text: "Open", action: openFile },
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




