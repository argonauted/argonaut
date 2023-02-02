

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
let DISPLAY_INIT_CMD: SessionRequestWrapper = {scope: "rpc" , method: "set_workbench_metrics", params: [{
    "consoleWidth":120, 
    "buildConsoleWidth":120, 
    "graphicsWidth":600, 
    "graphicsHeight":300, 
    "devicePixelRatio":1
}]}

let listeners: Record<string,((eventName: string, data: any) => void)[]>  = {}

let initComplete = false
let eventIndex = 0

let firstPass = true
let continueEvents = true

let activeSession: string | null = null
let activeLineId: string | null = null
let lineActive: boolean = false

let sessionCmdPending = false
let rCmdQueue: string[] = []
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
    let rCmd = `initializeDocState("${docSessionId}")`
    //ADD COMMENTED OUT CODE WHEN I ADD RESPONSE TO INITIALIZE DOC STATE FUNCTION
    //if(sessionCmdPending) {
    //    rCmdQueue.push(rCmd)
    //}
    //else {
    //    sessionCmdPending = true
        sendRCommand(rCmd)
    //}
}

export function evaluateSessionCmds(docSessionId: string, cmds: CodeCommand[], cmdIndex: number) {
    let childCmdStrings = cmds.map(cmdToCmdListString)
    let childCmdListString = "list(" + childCmdStrings.join(",") + ")"

    let rCmd = `multiCmd("${docSessionId}",${childCmdListString},${cmdIndex})`
    if(sessionCmdPending) {
        rCmdQueue.push(rCmd)
    }
    else {
        sessionCmdPending = true
        sendRCommand(rCmd)
    }
}

function evaluateSessionUpdate(docSessionId: string) {
    sessionCmdPending = true
    sendRCommand(`evaluate("${docSessionId}")`)
}

function sessionCommandCompleted(statusJson: any) {
    setTimeout(() => {
        if(rCmdQueue.length > 0) {
            sendRCommand(rCmdQueue.splice(0,1)[0])
        }
        else if(statusJson.data.evalComplete === false) {
            //more lines to evaluate
            evaluateSessionUpdate(statusJson.session)
        }
        else {
            sessionCmdPending = false
        }
    },0)
}
                            

//=================================
// internal functions
//=================================

//---------------------------
// Command Helpers
//---------------------------

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

function sendRCommand(rCode: string) {
    if(!initComplete) {
        throw new Error("R command can not be sent becaues init is not yet completed")
    }
    sendCommand({scope: 'rpc', method: 'execute_code', params: [rCode]})
}

//--------------------------
//-------------------------

function dispatch(eventName: string, data: any) {
    let listenerList = listeners[eventName]
    if(listenerList !== undefined) {
        listenerList.forEach(callback => callback(eventName,data))
    }
}



//----------------------------
// Event listener functions
//----------------------------

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

function onInitComplete() {
    initComplete = true
    //console.log("R session init complete!")

    //r session is initialized
    //repdoc session is not really intialized until after these
    sendCommand(DISPLAY_INIT_CMD)
    sendRCommand('require(repdoc)')
    sendRCommand(`initializeSession()`)

    dispatch("initComplete",null)
}

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
        
                        if(msgJson.session !== activeSession) {
                            //IS THERE SOMETHING I SHOULD DO HERE?
                            console.error("Session msg Event not equal to active session")
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
    let sessionOutputEvent = createSessionOutputEvent()
    sessionOutputEvent.data.addedConsoleLines = [["stderr",msg]]
    dispatch("sessionOutput", [sessionOutputEvent])
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
// RPC Functions
//-------------------------

/** This function sends a generic RPC command. If the command includes a field "processResponse",
 * this is called to process the response. The response json is also printed. */
function sendCommand(cmd: SessionRequestWrapper) {
    console.log("Send command: " + JSON.stringify(cmd))
    window.rSessionApi.sendRpcRequest(cmd.scope,cmd.method,cmd.params).then( (response: SessionResponse) => {
        console.log("Command response: " + JSON.stringify(response))

        if(cmd.processResponse) cmd.processResponse!(response)
    }).catch(e => {
        if(e) console.error(e.toString())
        else console.error("Unknown error in request")
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
                        onInitComplete()
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

