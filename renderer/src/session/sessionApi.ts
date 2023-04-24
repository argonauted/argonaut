import { DocEnvUpdateData } from "../repdoc/sessionValues" 

const ERROR_REGEX = /^<text>:[0-9]?:[0-9]?:/

//===========================
// Type Definitions
//===========================

/** This is the format for a command argument in the function sendCmd and multiCmd */
export type CodeCommand = {
    type: string,
    lineId: string,
    code?: string,
    after?: number
}

export interface LineDisplayData  {
    label: string
    lookupKey?: string
    value?: any
}

export type SessionOutputData = {
    newStatusUpdate?: boolean
    cellEvalStarted?: boolean
    addedConsoleLines?: [string,string][]
    addedPlots?: string[]
    addedValues?: string[]
    addedErrorInfos?: ErrorInfoStruct[]
    cellEvalCompleted?: boolean
    outputVersion?: number
    lineDisplayDatas?: LineDisplayData[]
    cellEnv?: Record<string,string>
    docEnvUpdate?: DocEnvUpdateData
    docEvalCompleted?: boolean
    nextLineIndex1?: number
}

//This is the line ID that is sent corresponding to a dos variable table update before any lines are added
export const PRE_LINE_ID = ""

//event messages to client
export type SessionOutputEvent = {
    session: string | null,
    lineId: string | null
    data: SessionOutputData,
    nextId?: string
}

export type ErrorInfoStruct = {
    line: number,
    charNum: number,
    msg: string
}

export type EventPayload = SessionOutputEvent[]  /* sessionOutput */ | any  /* DOH! fix this*/ |
                           null /* initComplete */
  
/** This is the format used in the sendCommand function for a RSession request. */
type SessionRequestWrapper = {
    scope: string
    method: string
    params: any[]
}

/** This is the format of a response from the RSession. */
type SessionResponse = any


type CommandQueueEntry = {
    f: any,
    session: string, 
    args: any[]
}

type SessionLineInfo = {
    maxEvalLine1: number | null 
    pendingLineIndex1: number | null
    docSessionId: string 
}

//===========================
// Fields
//===========================

const MESSAGE_START1 = '[1] "|$($|'
const MESSAGE_START2 = ' "|$($|'
const MESSAGE_END = '|$)$|"'
const MESSAGE_PREFIX1 = '[1] '
const MESSAGE_PREFIX2 = ' '
const MESSAGE_HEADER = '|$($|'
const MESSAGE_FOOTER = '|$)$|'

let DUMMY_CMD: SessionRequestWrapper = {scope: 'rpc', method: 'console_input', params: ["111","",0]}

let listeners: Record<string,((eventName: string, data: any) => void)[]>  = {}

let eventIndex = 0

let firstPass = true
let continueEvents = true

let activeSession: string | null = null
let activeLineId: string | null = null
let lastEvaluatedLineId: string | null = null
let lineActive: boolean = false

let pendingCommand: CommandQueueEntry | null = null
let sessionCmdQueue: CommandQueueEntry[] = []
let cmdDisabled = true
let cmdDisabledReason = "Init not yet completed!"
let cmdTimeoutHandle: NodeJS.Timeout | null = null
//let cmdTimeoutHandle: Timer | null = null

let sessionLineInfoMap: Record<string,SessionLineInfo> = {}

function addSessionLineInfo(docSessionId: string) {
    sessionLineInfoMap[docSessionId] = {
        docSessionId: docSessionId,
        maxEvalLine1:  null,
        pendingLineIndex1:  null
    }
}

//===========================
// Main Functions
//===========================

//R SESSION LISTENER

export function startSessionListener() {   
    if(firstPass) {
        sendCommand(DUMMY_CMD) //send a dummy command - does this do anything?
    }
    listenForEvents()
}

export function stopSessionListener() {
    continueEvents = false;
}

//CLIENT LISTENER

export function addEventListener(eventName: string, callback: (eventName: string, data: EventPayload) => void ) {
    let listenerList = listeners[eventName]
    if(listenerList === undefined) {
        listenerList = []
        listeners[eventName] = listenerList
    }
    listenerList.push(callback)
}


export function randomIdString() {
    //Make the biggest positive int random number possible (it doesn't have to be positive really)
    //and express it as a string in the largest base possible
    //Prefix with a letter ("f" for field) so we can use this as a field name symbol in R (as in data$f4j543k45) 
    return "f" + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(32)
}

export function setMaxEvalLine1(docSessionId: string, maxLine1: number) {
    let sessionLineInfo = sessionLineInfoMap[docSessionId]
    if(sessionLineInfo !== undefined) {
        sessionLineInfo.maxEvalLine1 = maxLine1
        requestEvaluateSessionCheck(docSessionId)
    }
    else {
        console.log("Trying to set max eval line on unknown session: " + docSessionId)
    }
}

export function clearMaxEvalLine1(docSessionId: string) {
    let sessionLineInfo = sessionLineInfoMap[docSessionId]
    if(sessionLineInfo !== undefined) {
        sessionLineInfo.maxEvalLine1 = null
        requestEvaluateSessionCheck(docSessionId)
    }
    else {
        console.log("Trying to clear max eval line on unknown session: " + docSessionId)
    }
}

//---------------------------
// TESTING
//---------------------------

async function testOnInit() {
    try {
        //let result = await sendDirectCommand("loadLibEnvVars()")
        //let envData = JSON.parse(JSON.parse(result.data.result))
        //dispatch("envData", envData)

        //KLUDGE FOR TESTING
        let result1 = await sendDirectCommand("search()")
        let fullList = JSON.parse("[" + result1.data.result.substring(2,result1.data.result.length-1) + "]")
        let libList = fullList.slice(1)
        getLib(libList,0)
    }
    catch(err: any) {
        if(err) {
            if(err.stack) console.error(err.stack)
            else console.error(err.toString())
        }
        else {
            console.error("Error loading env data")
        }
    }
}

//KLUDGE FOR TESTING
function getLib(libList: string[], index: number) {
    let pkgName = libList[index]
    sendDirectCommand(`loadNamedLibEnvVars("${pkgName}")`).then(libResult => {
        try {
            if(libResult.data.result) {
                let pkgData = JSON.parse(JSON.parse(libResult.data.result))
                if(pkgData) {
                    dispatch("pkgData",pkgData)
                }
            }
        }
        catch(err: any) {
            console.log("Error loading data for package " + pkgName)
            if(err.stack) console.error(err.stack)
        }

        if(index < libList.length - 1) {
            getLib(libList,index+1)
        }
    }).catch(err => console.log("Error loading env data!"))
}

export function sendDirectCommand(codeText: string): Promise<any> {
    return window.rSessionApi.sendRpcRequest('rpc','execute_r_code',[codeText])
}


//---------------------------
// Commands
//---------------------------

//TODO - I need to work on session and cmd queue startup
//cmdQueue notes
// - One reason to do this is so I can decide to sent the eval cmd or just send a new cmd
// - There might also be trouble tracking cmds or sending too many to R (probably not that though)
// - I would like to merge multiple session cmds into one if they are in the queue
// - Right now it is not robust to failed commands - fix that!
// - I have to manage fialed commands better generally

export function initDoc(docSessionId: string) {
    addSessionLineInfo(docSessionId)
    sendSessionCommand({f: initDocImpl, session: docSessionId, args: [docSessionId]})
}

export function closeDoc(docSessionId: string) {
    console.log("IMPLEMENT CLOSE DOC IN SessionApi!")
}

export function evaluateSessionCmds(docSessionId: string, cmds: CodeCommand[], cmdIndex: number) {
    sendSessionCommand({f: evaluateSessionCmdsImpl, session: docSessionId, args: [docSessionId, cmds, cmdIndex]})
}


export function setActiveCell(docSessionId: string, prevLineId: string, force = false) {
    if(activeSession != docSessionId || activeLineId != prevLineId || force) {
        sendSessionCommand({f: setActiveCellImpl, session: docSessionId, args: [docSessionId, prevLineId]})
    }
}

export function getAutocomplete(docSessionId: string, prevLineId: string | null, expressionText: string, expressionLine: string) {
    if(activeSession != docSessionId || activeLineId != prevLineId) return Promise.resolve(null)
    
    let cmd: SessionRequestWrapper = {
        scope: 'rpc',
        method: 'get_completions',
        params: [
            "",
            [expressionText],
            [6],
            [0],
            "",
            "",
            [],
            [],
            false,
            "",
            "",
            expressionLine,
            true
        ]
    }
    return new Promise((resolve,reject) => {   
        sendCommand(cmd,arg0 => resolve(arg0),arg0 => reject(arg0))
    })
}
                

//=================================
// internal functions
//=================================

//---------------------------
// Command Helpers
//---------------------------

function enableSessionCommands() {
    cmdDisabled = false
    cmdDisabledReason = ""
}

function disableSessionCommands(reason: string) {
    cmdDisabled = true
    cmdDisabledReason = reason
}

function sendSessionCommand(cmdEntry: CommandQueueEntry) {
    if(cmdDisabled) {
        //FIGURE OUT STANDARD ERROR HANDLING
        window.dialogApi.alertDialog("Error! A command could not be sent: " + cmdDisabledReason,"error")
        return
    }

    if(pendingCommand !== null) {
        sessionCmdQueue.push(cmdEntry)
    }
    else {
        pendingCommand = cmdEntry
        cmdEntry.f.apply(null,cmdEntry.args)
    }
}

function sendCommandFromQueue() {
    let cmdEntry = sessionCmdQueue.shift()!
    pendingCommand = cmdEntry
    cmdEntry.f.apply(null,cmdEntry.args)
}

function initDocImpl(docSessionId: string) {
    let rCmd = `initializeDocState("${docSessionId}")`
    activeSession = docSessionId
    sendSessionCommandImpl(rCmd) //docSessionId is the command key for init cmd
}

function evaluateSessionCmdsImpl(docSessionId: string, cmds: CodeCommand[], cmdIndex: number) {
    let childCmdStrings = cmds.map(cmdToCmdListString)
    let childCmdListString = "list(" + childCmdStrings.join(",") + ")"
    let rCmd = `multiCmd("${docSessionId}",${childCmdListString},${cmdIndex})`
    sendSessionCommandImpl(rCmd)
}

function setActiveCellImpl(docSessionId: string, prevLineId: string) {
    let rCmd = `setActiveLine("${docSessionId},${prevLineId}")`
    sendSessionCommandImpl(rCmd)
}

function cmdToCmdListString(cmd: CodeCommand) {
    let cmdListString = `list(type="${cmd.type}",lineId="${cmd.lineId}"`
    if(cmd.code !== undefined) {
        cmdListString += `,code=${JSON.stringify(cmd.code)}`
    }
    if(cmd.after !== undefined) {
        cmdListString += `,after=${cmd.after}`
    }
    cmdListString += ")"
    return cmdListString
}

const EVALUATE_SESSION_COMMAND_ENTRY = {f:evaluateSessionUpdateImpl, session: "", args: []} //we don't set the args or session since this is not used
const SESSION_CMD_TIMEOUT_MSEC = 60000

function evaluateSessionUpdateImpl(docSessionId: string) {
    pendingCommand = EVALUATE_SESSION_COMMAND_ENTRY
    sendSessionCommandImpl(`evaluate("${docSessionId}")`)
}

function sendSessionCommandImpl(rCode: string) {
    cmdTimeoutHandle = setInterval(sessionCommandTimeout,SESSION_CMD_TIMEOUT_MSEC)
    sendCommand({scope: 'rpc', method: 'execute_code', params: [rCode]},undefined,sessionCommandSendFailed)
    //code to sent over consile input rather than execute code
    //sendCommand({scope: 'rpc', method: 'console_input', params: [rCode,"",0]},undefined,sessionCommandSendFailed)
}

function sessionCommandCompleted(statusJson: any) {
    let sessionLineInfo = sessionLineInfoMap[statusJson.session]
    if(sessionLineInfo) {
        if(statusJson.data.evalComplete) {
            sessionLineInfo.pendingLineIndex1 = null
        }
        else {
            sessionLineInfo.pendingLineIndex1 = statusJson.data.nextLineIndex
        }

        if(cmdTimeoutHandle !== null) {
            clearTimeout(cmdTimeoutHandle) 
            cmdTimeoutHandle = null
        }
        setTimeout(() => cmdCompleted(statusJson.session),0)
    }
}

function cmdCompleted(docSessionId: string) {
    pendingCommand = null
    //complete evaluation for the current session if needed
    if(sessionEvaluateNeeded(docSessionId)) {
        if(isNextComdQueueForSession(docSessionId)) {
            sendCommandFromQueue() //do a pending command instead of eval - only if next for now. TBR
        }
        else {
            evaluateSessionUpdateImpl(docSessionId) //send evaluate
        }
    }
    else if(sessionCmdQueue.length > 0) {
        sendCommandFromQueue() //execute any queued command
    }
    else {
        evaluateAnySessionUpdates() //execute any need eval (I don't think we should have them?)
    }
}

function isNextComdQueueForSession(docSessionId: string) {
    if(sessionCmdQueue.length > 0) {
        return (sessionCmdQueue[0].session == docSessionId)
    }
    else {
        return false
    }
}

function requestEvaluateSessionCheck(docSessionId: string) {
    setTimeout(() => {
        //this code assumes pendingCommand will act in place of a evaluate command
        if( !pendingCommand && sessionEvaluateNeeded(docSessionId) ) {
            evaluateSessionUpdateImpl(docSessionId)
        }
    },0)
}

function sessionEvaluateNeeded(docSessionId: string) {
    let sessionLineInfo = sessionLineInfoMap[docSessionId]
    if(sessionLineInfo) {
        return ( sessionLineInfo.pendingLineIndex1 !== null && 
            (sessionLineInfo.maxEvalLine1 == null || sessionLineInfo.maxEvalLine1! >= sessionLineInfo.pendingLineIndex1!) )
    }
    else {
        return false
    }
}

function evaluateAnySessionUpdates() {
    for(let sessionId in sessionLineInfoMap) {
        if(sessionEvaluateNeeded(sessionId)) {
            evaluateSessionUpdateImpl(sessionId)
            return
        }
    }
}

function sessionCommandSendFailed(e: any) {
    
    setTimeout(() => window.dialogApi.errorDialog("(IMPLEMENT RECOVERY 1) Error in sending command: " + e.toString()),0)
    disableSessionCommands("Send Failed - Recovery Implementation needed")
}

function sessionCommandErrorResponse(msg: string) {
    setTimeout(() => window.dialogApi.errorDialog("(IMPLEMENT RECOVERY 2) Error in sending command: " + msg),0)
    disableSessionCommands("Session failure response - Recovery Implementation needed")
}
            
function sessionCommandTimeout() { 
    window.dialogApi.okCancelDialog("The response is taking a while. Press OK to continue waiting, CANCEL to stop.").then(okPressed => {
        if(!okPressed) {
            if(cmdTimeoutHandle !== null) {
                clearTimeout(cmdTimeoutHandle) 
                cmdTimeoutHandle = null
            }
            window.dialogApi.alertDialog("Well, actually you still have to keep waiting. We have no other options now.")
        }
    })
}

//----------------------------
// Event functions
//----------------------------

function dispatch(eventName: string, data: any) {
    let listenerList = listeners[eventName]
    if(listenerList !== undefined) {
        listenerList.forEach(callback => callback(eventName,data))
    }
}

function listenForEvents() {
    try {
        getEvents()
    }
    catch(err: any) {
        console.error("Error in event listener loop!")
        console.error(err.toString())
        //issue another event request
        continueListener()
    }
}

const EVENT_DELAY = 10 //this is thrown in just because
function continueListener() {
    if(continueEvents) {
        setTimeout(listenForEvents,EVENT_DELAY)
    }
}

//-------------------------
// Events handler functions
//-------------------------

function onPlotReceived(fileRef: string) {
    let sessionOutputEvent = createSessionOutputEvent(true)
    //get plot data as base64
    //DOH! soemtimes I get something funny
    window.rSessionApi.getBinary(fileRef).then( (response: any) => {  
        sessionOutputEvent.data.addedPlots = [response.data]
        dispatch("sessionOutput", [sessionOutputEvent])
    })
    .catch(err => {
        let msg = "Error getting plot data: " + err.toString()
        sessionOutputEvent.data.addedConsoleLines = [["stderr",msg]]
        dispatch("sessionOutput", [sessionOutputEvent])
    })
}

function onConsoleOut(text: string) {
    let sessionOutputEvents: SessionOutputEvent[] = []
    //assume one session for now!!!
    let currentEvent: SessionOutputEvent | null = null

    let lines = text.split("\n")
    lines.forEach(line => {
        //I don't know why, but the session messages seem to end up inn two different formats
        //when they come out the console
        if(line.endsWith(MESSAGE_END)) {
            let msgJson = getMessageJson(line)
            if(msgJson) {
                switch(msgJson.type) {
                    case "evalStart": {
                        activeSession = msgJson.session
                        activeLineId = msgJson.data.lineId
                        lastEvaluatedLineId = msgJson.data.lineId
                        lineActive = true
        
                        //I ASSUME CURRENT EVENT NOT SET. IS THAT OK?
                        if(currentEvent !== null) throw new Error("Unepxected: start eval not first message in a console out")

                        currentEvent = createSessionOutputEvent()
                        sessionOutputEvents.push(currentEvent)
                        currentEvent.data.newStatusUpdate = true
                        currentEvent.data.cellEvalStarted = true
                        currentEvent.data.outputVersion = msgJson.data.cmdIndex
                        break
                    }
                    case "console": {
                        if(currentEvent === null) {
                            currentEvent = createSessionOutputEvent()
                            sessionOutputEvents.push(currentEvent)
                        }
                        let errorInfo: ErrorInfoStruct | null = null
                        if( msgJson.data.msgType == "stderr") {
                            errorInfo = convertConsoleError(msgJson.data.msg)
                        }
                        if(errorInfo !== null) {
                            if(currentEvent.data.addedErrorInfos === undefined) {
                                currentEvent.data.addedErrorInfos = []
                            }
                            currentEvent.data.addedErrorInfos!.push(errorInfo!)
                        }
                        else {
                            if(currentEvent.data.addedConsoleLines === undefined) {
                                currentEvent.data.addedConsoleLines = []
                            }
                            currentEvent.data.addedConsoleLines!.push([msgJson.data.msgType,msgJson.data.msg])
                        }
                        break
                    }
                    case "lineDisplay": {
                        if(msgJson.session !== activeSession) {
                            //FIGURE OUT WHAT TO DO HERE...
                            throw new Error("Line Display event with session not equal to active session")
                        }
                        if(currentEvent === null) {
                            activeLineId = msgJson.data.lineId
                            lineActive = true
                            currentEvent = createSessionOutputEvent()
                            sessionOutputEvents.push(currentEvent)
                            currentEvent.data.newStatusUpdate = true
                        }
                        else if(msgJson.data.lineId != activeLineId) {
                            throw new Error("Line Display event with line id not equal current event")
                        }
                        currentEvent.data.lineDisplayDatas = msgJson.data.valList
                        break
                    }
                    case "cellEnv": {
                        if(msgJson.session !== activeSession) {
                            //FIGURE OUT WHAT TO DO HERE...
                            throw new Error("Cell Env event with session not equal to active session")
                        }
                        if(currentEvent === null) {
                            activeLineId = msgJson.data.lineId
                            lineActive = true
                            currentEvent = createSessionOutputEvent()
                            sessionOutputEvents.push(currentEvent)
                            currentEvent.data.newStatusUpdate = true
                        }
                        else if(msgJson.data.lineId != activeLineId) {
                            throw new Error("Cell Env event with line id not equal current event")
                        }
                        currentEvent.data.cellEnv = msgJson.data.varList
                        break
                    }
                    case "docEnv": {
                        if(msgJson.session !== activeSession) {
                            //FIGURE OUT WHAT TO DO HERE...
                            throw new Error("Cell Doc Env event with session not equal to active session")
                        }
                        if(currentEvent === null) {
                            activeLineId = msgJson.data.lineId
                            lineActive = true
                            currentEvent = createSessionOutputEvent()
                            sessionOutputEvents.push(currentEvent)
                            currentEvent.data.newStatusUpdate = true
                        }
                        else if(msgJson.data.lineId != activeLineId) {
                            throw new Error("Cell Doc Env event with line id not equal current event")
                        }
                        currentEvent.data.docEnvUpdate = msgJson.data //pass the complete structure
                        break
                    }
                    case "cellStatus": {
                        if(msgJson.session !== activeSession) {
                            //FIGURE OUT WHAT TO DO HERE...
                            throw new Error("Cell Status event with session not equal to active session")
                        }
                        if(currentEvent === null) {
                            activeLineId = msgJson.data.lineId
                            lineActive = true
                            currentEvent = createSessionOutputEvent()
                            sessionOutputEvents.push(currentEvent)
                            currentEvent.data.newStatusUpdate = true
                        }
                        else if(msgJson.data.lineId != activeLineId) {
                            //FIGURE OUT WHAT TO DO HERE...
                            throw new Error("Cell Status event not equal to active session with line active")
                        }
                        currentEvent.data.cellEvalCompleted = true
                        currentEvent.data.outputVersion = msgJson.data.cmdIndex

                        currentEvent = null
                        lineActive = false
                        break
                    }
                    case "docStatus": {
                        if((msgJson.session !== activeSession)&&(lineActive)) {
                            //FIGURE OUT WHAT TO DO HERE...
                            throw new Error("Doc Status event not equal to active session with line active")
                        }

                        //manage command queue
                        sessionCommandCompleted(msgJson)
                        break
                    }
                    case "activeLineStatus": {
                        if(lineActive) {
                            //Doh! We don't want this to happen
                            console.log("Warning! Active line status reset while line active!")
                        }
                        activeSession = msgJson.session
                        activeLineId = msgJson.data.activeLineId
                        break
                    }
        
                    default:
                        console.error("Unknown message: " + JSON.stringify(msgJson,null,4))
                        break
                }
            }
        }
        else {
            //for now throw away empty events - at least some of these should not be here
            if((line != "")&&(line != "[1]")) {
                if(currentEvent === null) {
                    currentEvent = createSessionOutputEvent()
                    sessionOutputEvents.push(currentEvent)
                }
                if(currentEvent.data.addedConsoleLines === undefined) {
                    currentEvent.data.addedConsoleLines = []
                }
                currentEvent.data.addedConsoleLines!.push(["stdout",line])
            }
        }
    })

    if(sessionOutputEvents.length > 0) {
        dispatch("sessionOutput",sessionOutputEvents)
    }
}

function onConsoleErr(msg: string) {
    if(pendingCommand !== null) {
        //For now I think this means there is a session error
        sessionCommandErrorResponse(msg)
    }
    else {
        console.error(msg)
    }
}

function createSessionOutputEvent(useLastEvaluated = false): SessionOutputEvent {
    return {
        session: activeSession,
        lineId: useLastEvaluated ? lastEvaluatedLineId : lineActive ? activeLineId : null,
        data: {
        }
    }
}

function getMessageJson(line: string) {
    let msgChars = null
    if(line.startsWith(MESSAGE_START1)) {
        msgChars = JSON.parse(line.slice(MESSAGE_PREFIX1.length))
    }
    else if(line.startsWith(MESSAGE_START2)) {
        msgChars = JSON.parse(line.slice(MESSAGE_PREFIX2.length))
    }
    else {
        //What do I do here? We will treat this as a normal line
        console.error("Bad message format: " + line)
        return null
    }

    try {
        return JSON.parse(msgChars.slice(MESSAGE_HEADER.length,-MESSAGE_FOOTER.length))
    }
    catch(error: any) {
        //we will ignore this line
        console.error("Error parsing msg body from session: " + error.toString())
        return undefined
    }
}

/** This function attempts to convert a session error message with line and character into a data structure.
 * It returns the data structure is it can and null if not. */
function convertConsoleError(msgBody: string): ErrorInfoStruct | null {
    if(ERROR_REGEX.test(msgBody)) {
        const lStart = 7
        const lEnd = msgBody.indexOf(":",lStart)
        const nEnd = msgBody.indexOf(":",lEnd+1)
        const nli = msgBody.indexOf("\n")
        const line = parseInt(msgBody.substring(lStart,lEnd))
        const charNum = parseInt(msgBody.substring(lEnd+1,nEnd))
        const msg = msgBody.substring(nEnd+2,nli)
        if(line !== null && charNum !== null) {
            return {line,charNum,msg}
        }
    }
    return null
}

//-------------------------
// INIT SEQUENCE
//-------------------------
let LOAD_REPDOC_CMD: SessionRequestWrapper = {scope: 'rpc', method: 'execute_r_code', params: ['require(repdoc)']}
let INIT_SESSION_CMD: SessionRequestWrapper = {scope: 'rpc', method: 'execute_r_code', params: [`initializeSession()`]}
let DISPLAY_INIT_CMD: SessionRequestWrapper = {scope: "rpc" , method: "set_workbench_metrics", params: [{
    "consoleWidth":120, 
    "buildConsoleWidth":120, 
    "graphicsWidth":600, 
    "graphicsHeight":300, 
    "devicePixelRatio":1
}]}

function initRepdocSequence() {
    sendCommand(LOAD_REPDOC_CMD,response => {
        if(response.data.result != "TRUE") {
            console.error("Error loading repdoc. Application init failed.")
        }
        else {
            sendCommand(INIT_SESSION_CMD,response => {
                if(response.data.result != "TRUE") {
                    console.error("Error initializing repdoc session. Application init failed.")
                }
                else {
                    //some r settings
                    sendCommand(DISPLAY_INIT_CMD)

                    //init complete
                    //initComplete = true
                    enableSessionCommands()
                    dispatch("initComplete",null)


                    setTimeout(testOnInit,0)
                }
            })
        }
    })
}

//-------------------------
// RPC Functions
//-------------------------

/** This function sends a generic RPC command. If the command includes a field "processResponse",
 * this is called to process the response. The response json is also printed. */
function sendCommand(cmd: SessionRequestWrapper, 
    onResponse?: (arg0: SessionResponse) => void,
    onError?: (arg0: any) => void) {
    console.log("Send command: " + JSON.stringify(cmd))
    window.rSessionApi.sendRpcRequest(cmd.scope,cmd.method,cmd.params).then( (response: SessionResponse) => {
        console.log("Command response: " + JSON.stringify(response))
        if(onResponse !== undefined) onResponse!(response)
    }).catch(e => {
        if(e) console.error(e.toString())
        else console.error("Unknown error in request")
        if(onError !== undefined) onError!(e)
    })
}

/** This funtion listens for and processes events. */
function getEvents() {
    let scope = "events"
    let method = "get_events"
    let params = [eventIndex]
    window.rSessionApi.sendRpcRequest(scope,method,params).then( (response: SessionResponse) => {
        if(response.data.result) {
            response.data.result.forEach( (entry: any,index: number) => {
                
                console.log(`type: ${entry.type}, index: ${index}`)
                console.log(JSON.stringify(entry))

                try {
                    if(entry.type == "deferred_init_completed") {
                        //init complete
                        initRepdocSequence()
                    }
                    else if(entry.type == "plots_state_changed") {
                        onPlotReceived(entry.data.filename)
                    }

                    else if(entry.type == "console_output") {
                        onConsoleOut(entry.data.text)
                    }
                    // else if(entry.type == "console_wite_prompt") {
                    //     console.log("console prompt:")
                    //     console.log(entry.data)
                    // }
                    else if(entry.type == "console_error") {
                        onConsoleErr(entry.data.text)
                    }
                    // else {
                    //     console.log("Unkown: " + entry.type)
                    //     console.log(JSON.stringify(entry))
                    // }
                }
                catch(err: any) {
                    console.error("Error processing messages: " + err.toString())
                }

                eventIndex = entry.id
            })
        }
        else {
            //console.log("Empty result in events")
        }

        continueListener()

    }).catch(e => {
        if(e) console.error(e.toString())
        else console.error("Unknown error in request")

        continueListener()
    })
}

