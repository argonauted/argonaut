

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

//event messages to client
export type SessionOutputEvent = {
    session: string | null,
    lineId: string | null
    data: {
        evalStarted?: boolean
        addedConsoleLines?: [string,string][]
        addedPlots?: [string]
        addedValues?: [string]
        evalCompleted?: boolean
        outputVersion?: number
    },
    nextId?: string
}

/** This is the format used in the sendCommand function for a RSession request. */
type SessionRequestWrapper = {
    scope: string
    method: string
    params: any[]
    processResponse?: ((arg0: any) => void)
}

/** This is the format of a response from the RSession. */
type SessionResponse = any


type CommandQueueEntry = {
    f: any,
    args: IArguments | any[]
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

let initComplete = false
let eventIndex = 0

let firstPass = true
let continueEvents = true

let activeSession: string | null = null
let activeLineId: string | null = null
let lineActive: boolean = false

let pendingCommand: CommandQueueEntry | null = null
let sessionCmdQueue: CommandQueueEntry[] = []
let cmdDisabled = true
let cmdDisabledReason = "Init not yet completed!"
//let cmdTimeoutHandle: NodeJS.Timeout | null = null
let cmdTimeoutHandle: number | null = null

//===========================
// Main Functions
//===========================

//R SESSION LISTENER

export function startSessionListener() {   
    if(firstPass) {
        //send a dummy command
        sendCommand(DUMMY_CMD)
    }

    //start event listener
    listenForEvents()
}

export function stopSessionListener() {
    continueEvents = false;
}

//CLIENT LISTENER

export function addEventListener(eventName: string, callback: (eventName: string, data: any) => void ) {
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
    sendSessionCommand({f: initDocImpl, args: arguments})
}

export function evaluateSessionCmds(docSessionId: string, cmds: CodeCommand[], cmdIndex: number) {
    sendSessionCommand({f: evaluateSessionCmdsImpl, args: arguments})
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
        alert("Error! A command could not be sent: " + cmdDisabledReason)
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
    let cmdEntry = sessionCmdQueue.splice(0,1)[0]
    cmdEntry.f.apply(null,cmdEntry.args)
}

function initDocImpl(docSessionId: string) {
    let rCmd = `initializeDocState("${docSessionId}")`
    activeSession = docSessionId
    sendSessionCommandImpl(docSessionId,rCmd)
}

function evaluateSessionCmdsImpl(docSessionId: string, cmds: CodeCommand[], cmdIndex: number) {
    let childCmdStrings = cmds.map(cmdToCmdListString)
    let childCmdListString = "list(" + childCmdStrings.join(",") + ")"
    let rCmd = `multiCmd("${docSessionId}",${childCmdListString},${cmdIndex})`
    sendSessionCommandImpl(docSessionId,rCmd)
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

const EVALUATE_SESSION_COMMAND_ENTRY = {f:null, args: []}
const SESSION_CMD_TIMEOUT_MSEC = 60000

function evaluateSessionUpdateImpl(docSessionId: string) {
    pendingCommand = EVALUATE_SESSION_COMMAND_ENTRY //this is a placeholder!
    sendSessionCommandImpl(docSessionId,`evaluate("${docSessionId}")`)
}

function sendSessionCommandImpl(docSessionId: string, rCode: string) {
    cmdTimeoutHandle = setInterval(sessionCommandTimeout,SESSION_CMD_TIMEOUT_MSEC)
    sendCommand({scope: 'rpc', method: 'execute_code', params: [rCode]},undefined,sessionCommandSendFailed)
}

function sessionCommandCompleted(statusJson: any) {
    if(cmdTimeoutHandle !== null) {
        clearTimeout(cmdTimeoutHandle) 
        cmdTimeoutHandle = null
    }
    setTimeout(() => {
        if(sessionCmdQueue.length > 0) {
            sendCommandFromQueue() 
        }
        else if(statusJson.data.evalComplete === false) {
            //more lines to evaluate
            evaluateSessionUpdateImpl(statusJson.session)
        }
        else {
            pendingCommand = null
        }
    },0)
}

function sessionCommandSendFailed(e: any) {
    setTimeout(() => alert("(IMPLEMENT RECOVERY) Error in sending command: " + e.toString()),0)
    disableSessionCommands("Send Failed - Recovery Implementation needed")
}

function sessionCommandErrorResponse(msg: string) {
    setTimeout(() => alert("(IMPLEMENT RECOVERY) Error in sending command: " + msg),0)
    disableSessionCommands("Session failure response - Recovery Implementation needed")
}
            
function sessionCommandTimeout() {
    let keepWaiting = confirm("The response is taking a while. Press OK to continue waiting, CANCEL to stop.")
    if(!keepWaiting) {
        if(cmdTimeoutHandle !== null) {
            clearTimeout(cmdTimeoutHandle) 
            cmdTimeoutHandle = null
        }
        alert("Well, actually you still have to keep waiting. We have not other options now.")
    }
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
                        lineActive = true
        
                        currentEvent = createSessionOutputEvent()
                        sessionOutputEvents.push(currentEvent)
                        currentEvent.data.evalStarted = true
                        currentEvent.data.outputVersion = msgJson.data.cmdIndex
                        break
                    }
                    case "console": {
                        if(currentEvent === null) {
                            currentEvent = createSessionOutputEvent()
                            sessionOutputEvents.push(currentEvent)
                        }
                        if(currentEvent.data.addedConsoleLines === undefined) {
                            currentEvent.data.addedConsoleLines = []
                        }
                        currentEvent.data.addedConsoleLines!.push([msgJson.data.msgType,msgJson.data.msg])
                        break
                    }
                    case "docStatus": {
                        //manage command queue
                        sessionCommandCompleted(msgJson)
        
                        if((msgJson.session !== activeSession)&&(lineActive)) {
                            //FIGURE OUT WHAT TO DO HERE...
                            console.error("Session msg Event not equal to active session with line active")
                        }

                        if(currentEvent === null) {
                            currentEvent = createSessionOutputEvent()
                            sessionOutputEvents.push(currentEvent)
                        }
                        currentEvent.data.evalCompleted = true
                        currentEvent.data.outputVersion = msgJson.data.cmdIndex //should be the same as above if in the same line
                        //LATER - we need to add next id/index to evaluate
                        lineActive = false
                        currentEvent = null
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

    dispatch("sessionOutput",sessionOutputEvents)
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

function createSessionOutputEvent(ignoreLineActive = false): SessionOutputEvent {
    return {
        session: activeSession,
        lineId: (ignoreLineActive || lineActive) ?  activeLineId : null,
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
                    initComplete = true
                    enableSessionCommands()
                    dispatch("initComplete",null)
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
                catch(err) {
                    console.error("Error processing messages!")
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

