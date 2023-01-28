

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

export type SessionMsg = {
    type: string
    session: string
    data: any
}

/** This is the format for a command argument in the function sendCmd and multiCmd */
export type CodeCommand = {
    type: string,
    lineId: string,
    code?: string,
    after?: number
}

export type ConsoleEventData = {
    session: string | null,
    lineId: string | null,
    type: string,
    msgs: string[]
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

//-----------------------------
// main functions
//-----------------------------
export function startListener() {   
    if(firstPass) {
        //send a dummy command
        sendCommand(DUMMY_CMD)
    }

    //start event listener
    listenForEvents()
}

export function stopListener() {
    continueEvents = false;
}

export function initDoc(docSessionId: string) {
    sendRCommand(`initializeDocState("${docSessionId}")`)
}

export function addCmd(docSessionId: string, lineId: string, code: string, after: number) {
    sendRCommand(`addCmd("${docSessionId}","${lineId}","${code}",${after})`)
}

export function updateCmd(docSessionId: string, lineId: string, code: string) {
    sendRCommand(`updateCmd("${docSessionId}","${lineId}","${code}")`)
}

export function deleteCmd(docSessionId: string, lineId: string) {
    sendRCommand(`deleteCmd("${docSessionId}","${lineId}")`)
}

export function multiCmd(docSessionId: string, cmds: CodeCommand[] ) {
    let childCmdStrings = cmds.map(cmdToCmdListString)
    let childCmdListString = "list(" + childCmdStrings.join(",") + ")"
    //let cmdString = `list(type="multi",cmds=${childCmdListString})`
    sendRCommand(`multiCmd("${docSessionId}",${childCmdListString})`)
}

export function rawCmd(docSessionId: string, cmd: CodeCommand) {
    sendRCommand(`executeCommand("${docSessionId}",${cmdToCmdListString(cmd)})`)
}

function cmdToCmdListString(cmd: CodeCommand) {
    let cmdListString = `list(type="${cmd.type}",lineId="${cmd.lineId}"`
    if(cmd.code !== undefined) {
        cmdListString += `,code="${cmd.code}"`
    }
    if(cmd.after !== undefined) {
        cmdListString += `,after=${cmd.after}`
    }
    cmdListString += ")"
    return cmdListString
}

export function evaluateCmd(docSessionId: string) {
    sendRCommand(`evaluate("${docSessionId}")`)
}

export function addListener(eventName: string, callback: (eventName: string, data: any) => void ) {
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

//=================================
// internal functions
//=================================

function dispatch(eventName: string, data: any) {
    let listenerList = listeners[eventName]
    if(listenerList !== undefined) {
        listenerList.forEach(callback => callback(eventName,data))
    }
}

function sendRCommand(rCode: string) {
    if(!initComplete) {
        throw new Error("R command can not be sent becaues init is not yet completed")
    }
    sendCommand({scope: 'rpc', method: 'execute_code', params: [rCode]})
}

//----------------------------
// Event loop functions
//----------------------------

function listenForEvents() {
    try {
        getEvents();
    }
    catch(err: any) {
        console.log("Error in event listener loop!")
        console.log(err.toString())
        //issue another event request
        onEventCompleted()
    }
}

const EVENT_DELAY = 10 //this is thrown in just because
function onEventCompleted() {
    if(continueEvents) {
        setTimeout(listenForEvents,EVENT_DELAY)
    }
}

//-------------------------
// internal event handlers
//-------------------------

function onInitComplete() {
    initComplete = true
    //console.log("R session init complete!")

    //r session is initialized
    //repdoc session is not really intialized until after these
    sendRCommand('require(repdoc)')
    sendRCommand(`initializeSession()`)

    dispatch("initComplete",null)
}

function onPlotReceived(fileRef: string) {
    window.rSessionApi.getBinary(fileRef).then( (response: any) => {
        //console.log("Graphics file received:")
        //console.log(JSON.stringify(response.data))   
        dispatch("plotReceived",{data: response.data})
    })
    .catch(err => {
    console.error("Error getting graphics file:")
    console.error(err.toString())
    })
}

function onConsoleOut(text: string) {
    let lines = text.split("\n")
    let consoleLines: string[] = []
    lines.forEach(line => {
        //I don't know why, but the session messages seem to end up inn two different formats
        //when they come out the console
        if(line.endsWith(MESSAGE_END)) {
            let msgChars = null
            if(line.startsWith(MESSAGE_START1)) {
                msgChars = JSON.parse(line.slice(MESSAGE_PREFIX1.length))
            }
            else if(line.startsWith(MESSAGE_START2)) {
                msgChars = JSON.parse(line.slice(MESSAGE_PREFIX2.length))
            }
            else {
                console.log("SOMETHING HAPPENED!")
            }

            if(msgChars !== null) {
                try {
                    //parse the total message string
                    let msgJson = JSON.parse(msgChars.slice(MESSAGE_HEADER.length,-MESSAGE_FOOTER.length))
                    //send message, but send any queued console lines first
                    flushConsole(consoleLines)
                    consoleLines = []
                    onSessionMsg(msgJson)
                }
                catch(error: any) {
                    console.error("Error parsing msg body from session: " + error.toString())
                }
                return
            }
        }
        else {
            consoleLines.push(line)
        }
    })

    flushConsole(consoleLines)
}

function flushConsole(consoleLines: string[]) {
    if(consoleLines.length > 0) {
        let data: ConsoleEventData = {
            session: activeSession,
            lineId: lineActive ? activeLineId : null, //console output only comes when a line is active 
            type: "console",
            msgs: consoleLines
        }
        dispatch("console",data)
    }
}

function onSessionMsg(msgJson: SessionMsg) {
    try {
        switch(msgJson.type) {
            case "docStatus": {
                //Doc status triggers the end of the current active line, if there is one
                //Note that plot data can/will come in afterwards
                //So keep the activeSession and associated activeLineId
                lineActive = false
                //Doc status also tells if there are more lines to evaluate
                //This should be the same session as above, I think. If so, does enforcing that matter? 
                if(msgJson.data.evalComplete === false) {
                    //more lines to evaluate
                    evaluateCmd(msgJson.session)
                }
                dispatch("docStatus",msgJson)
                break
            }

            case "evalStart": {
                //Eval start triggers a new active line
                activeSession = msgJson.session
                activeLineId = msgJson.data
                lineActive = true
                dispatch("evalStart",msgJson)
                break
            }

            default:
                console.log("Unknown message: " + JSON.stringify(msgJson,null,4))
                break
        }
    }
    catch(err: any) {
        if(err && msgJson) {
            console.log("Error processing mesasge: " + err.toString() + " - " + msgJson.toString())
        }
    }
}

function onConsoleErr(msg: string) {
    let data: ConsoleEventData = {
        session: activeSession,
        lineId: lineActive ? activeLineId : null, //console output only comes when a line is active 
        type: "stderr",
        msgs: [msg]       
    }
    dispatch("console",data)
}

//-------------------------
// RPC and Other Requests
//-------------------------

/** This function sends a generic RPC command. If the command includes a field "processResponse",
 * this is called to process the response. The response json is also printed. */
function sendCommand(cmd: SessionRequestWrapper) {
    console.log("Send command: " + JSON.stringify(cmd))
    window.rSessionApi.sendRpcRequest(cmd.scope,cmd.method,cmd.params).then( (response: SessionResponse) => {
        console.log("Command response: " + JSON.stringify(response))

        if(cmd.processResponse) cmd.processResponse!(response)
    }).catch(e => {
        if(e) console.log(e.toString())
        else console.log("Unknown error in request")
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

                eventIndex = entry.id
            })
        }
        else {
            //console.log("Empty result in events")
        }

        onEventCompleted()
    }).catch(e => {
        if(e) console.log(e.toString())
        else console.log("Unknown error in request")

        onEventCompleted()
    })
}

